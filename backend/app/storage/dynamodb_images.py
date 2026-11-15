"""Namespaced, bounded DynamoDB repository; no network activity at import time."""
import hashlib
import os
from threading import RLock

from botocore.exceptions import ClientError

from ..errors import AppError

CHUNK_BYTES = 300 * 1024
MAX_IMAGE_BYTES = 3 * 1024 * 1024


class DynamoImages:
    memory = False
    backend = 'dynamodb'

    def __init__(self, client=None):
        self.client = client
        self.lock = RLock()
        self.table = os.getenv('DYNAMODB_TABLE', '')
        self.partition_key = os.getenv('DYNAMODB_PARTITION_KEY', '')
        self.sort_key = os.getenv('DYNAMODB_SORT_KEY', '')
        self.namespace = os.getenv('DYNAMODB_NAMESPACE', 'BARTR_V1')
        self.schema_checked = False

    def connection(self):
        if not self.table or self.partition_key != 'PK' or self.sort_key != 'SK':
            raise AppError('Configure the existing DYNAMODB_TABLE with String PK and SK keys.', 'DYNAMODB_NOT_CONFIGURED', 503)
        if self.partition_key == self.sort_key:
            raise AppError('DynamoDB partition and sort keys must differ.', 'INVALID_TABLE_SCHEMA', 503)
        if self.client is None:
            import boto3
            from botocore.config import Config
            self.client = boto3.client('dynamodb', region_name=os.getenv('AWS_REGION') or None,
                config=Config(connect_timeout=5, read_timeout=15, retries={'max_attempts': 0}))
        if not self.schema_checked:
            table = self.client.describe_table(TableName=self.table)['Table']
            actual = {x['KeyType']: x['AttributeName'] for x in table['KeySchema']}
            types = {x['AttributeName']: x['AttributeType'] for x in table['AttributeDefinitions']}
            expected = {'HASH': self.partition_key}
            if self.sort_key:
                expected['RANGE'] = self.sort_key
            if actual != expected or any(types.get(key) != 'S' for key in expected.values()):
                raise AppError('Configured key names/types do not match this DynamoDB table. String keys are required.', 'INVALID_TABLE_SCHEMA', 503)
            if any(x in expected.values() for x in ('payload', 'revision', 'kind', 'owner', 'mime_type', 'parts', 'checksum')):
                raise AppError('Table key name conflicts with a backend record attribute.', 'INVALID_TABLE_SCHEMA', 503)
            self.schema_checked = True
        return self.client

    def key(self, record, part='0'):
        if self.sort_key:
            return {self.partition_key: {'S': f'{self.namespace}#{record}'}, self.sort_key: {'S': part}}
        return {self.partition_key: {'S': f'{self.namespace}#{record}#{part}'}}

    def put_image(self, image_id, owner, image):
        data = image['data']
        if not data or len(data) > MAX_IMAGE_BYTES:
            raise AppError('Normalized photo must be at most 3 MiB for DynamoDB storage. Try a simpler or smaller photo.', 'IMAGE_STORAGE_LIMIT', 422)
        chunks = [data[i:i+CHUNK_BYTES] for i in range(0, len(data), CHUNK_BYTES)]
        checksum = hashlib.sha256(data).hexdigest()
        operations = []
        for index, chunk in enumerate(chunks):
            record = {**self.key(f'IMAGE#{image_id}', str(index)), 'kind': {'S': 'bartr-image-v1'},
                      'owner': {'S': owner}, 'mime_type': {'S': image['mime_type']},
                      'parts': {'N': str(len(chunks))}, 'checksum': {'S': checksum}, 'payload': {'B': chunk}}
            operations.append({'Put': {'TableName': self.table, 'Item': record,
                'ConditionExpression': 'attribute_not_exists(#pk)', 'ExpressionAttributeNames': {'#pk': self.partition_key}}})
        self.connection().transact_write_items(TransactItems=operations)

    def image(self, image_id):
        client = self.connection()
        first = client.get_item(TableName=self.table, Key=self.key(f'IMAGE#{image_id}'), ConsistentRead=True).get('Item')
        if first is None:
            return None
        count = int(first['parts']['N'])
        if first.get('kind', {}).get('S') != 'bartr-image-v1' or not 1 <= count <= 11:
            raise AppError('Image storage record is invalid.', 'INVALID_IMAGE_RECORD', 503)
        chunks = [bytes(first['payload']['B'])]
        for index in range(1, count):
            row = client.get_item(TableName=self.table, Key=self.key(f'IMAGE#{image_id}', str(index)), ConsistentRead=True).get('Item')
            if not row or row.get('owner') != first['owner'] or row.get('checksum') != first['checksum']:
                raise AppError('Stored photo is incomplete. Retry or upload it again.', 'INCOMPLETE_IMAGE', 503)
            chunks.append(bytes(row['payload']['B']))
        data = b''.join(chunks)
        if hashlib.sha256(data).hexdigest() != first['checksum']['S']:
            raise AppError('Stored photo failed its integrity check.', 'INVALID_IMAGE_RECORD', 503)
        return {'data': data, 'owner': first['owner']['S'], 'mime_type': first['mime_type']['S']}

    def delete_image(self, image_id):
        client = self.connection()
        row = client.get_item(TableName=self.table, Key=self.key(f'IMAGE#{image_id}'), ConsistentRead=True).get('Item')
        if row:
            client.transact_write_items(TransactItems=[{'Delete': {'TableName': self.table, 'Key': self.key(f'IMAGE#{image_id}', str(i))}} for i in range(int(row['parts']['N']))])

    def close(self):
        if self.client is not None:
            self.client.close()
