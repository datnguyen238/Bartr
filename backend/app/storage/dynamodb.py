"""Normalized single-table MVP with atomic compatibility units of work.

See specs/001-smart-barter-marketplace/dynamodb-data-model.md for bounds and rollout.
"""
from copy import deepcopy
from decimal import Decimal
import json
from time import sleep
from uuid import uuid4

from boto3.dynamodb.types import TypeDeserializer, TypeSerializer
from botocore.exceptions import BotoCoreError, ClientError

from ..errors import AppError
from .dynamodb_images import DynamoImages
from .dynamodb_records import IMMUTABLE, assemble, canonical, records
from .state import empty_state

SCHEMA = 'bartr-single-table-v1'
SERIALIZER, DESERIALIZER = TypeSerializer(), TypeDeserializer()


def encode(value):
    value = json.loads(canonical(value), parse_float=Decimal)
    return {key: SERIALIZER.serialize(item) for key, item in value.items()}


def decode(value):
    native = {key: DESERIALIZER.deserialize(item) for key, item in value.items()}
    return json.loads(json.dumps(native, default=lambda x: int(x) if x.as_tuple().exponent >= 0 else float(x)))


class DynamoRepository(DynamoImages):
    def __init__(self, client=None, *, scope=''):
        super().__init__(client)
        if scope and (not scope.startswith('TEST#') or len(scope) > 120):
            raise ValueError('Only explicit TEST# scopes may prefix production keys.')
        self.scope = scope

    def entity_key(self, pk, sk):
        return {'PK': {'S': self.scope + pk}, 'SK': {'S': sk}}

    def _get(self, pk, sk):
        row = self.connection().get_item(TableName=self.table, Key=self.entity_key(pk, sk), ConsistentRead=True).get('Item')
        if row is None:
            return None
        result = decode(row)
        if result.get('_schema') != SCHEMA or result.get('_scope') != self.scope:
            raise AppError('An incompatible record occupies this key.', 'NAMESPACE_CONFLICT', 503)
        return result

    def _epoch(self):
        control = self._get('CONTROL#BARTR', 'DETAILS')
        if control is None:
            # Never silently replace an old whole-state deployment with empty accounts.
            legacy = self.connection().get_item(TableName=self.table, Key=self.key('STATE'),
                ConsistentRead=True, ProjectionExpression='kind').get('Item') if not self.scope else None
            if legacy:
                raise AppError('Legacy state requires a reviewed offline migration before enabling this schema.', 'MIGRATION_REQUIRED', 503)
        return control['_version'] if control else None

    def _scan(self):
        params = {'TableName': self.table, 'ConsistentRead': True,
                  'FilterExpression': '#schema = :schema AND #scope = :scope',
                  'ExpressionAttributeNames': {'#schema': '_schema', '#scope': '_scope'},
                  'ExpressionAttributeValues': {':schema': {'S': SCHEMA}, ':scope': {'S': self.scope}}}
        rows = {}
        while True:
            response = self.connection().scan(**params)
            for raw in response.get('Items', []):
                row = decode(raw)
                pk, sk = row.pop('PK'), row.pop('SK')
                row.pop('_schema'); row.pop('_scope')
                if pk == self.scope + 'CONTROL#BARTR':
                    continue
                rows[pk[len(self.scope):], sk] = row
            if not response.get('LastEvaluatedKey'):
                return rows
            params['ExclusiveStartKey'] = response['LastEvaluatedKey']

    def _snapshot(self):
        for _ in range(8):
            before = self._epoch()
            rows = self._scan()
            after = self._epoch()
            if before == after:
                if before is None and rows:
                    raise AppError('Unpublished data needs migration reconciliation.', 'MIGRATION_REQUIRED', 503)
                return before, rows, assemble({key: {k: v for k, v in row.items() if k != '_version'} for key, row in rows.items()})
        raise AppError('Marketplace changed during reading. Reload before retrying.', 'RETRY_CONFLICT', 409)

    def read(self):
        with self.lock:
            return self._snapshot()[2]

    def _condition(self, prior):
        if prior is None:
            return {'ConditionExpression': 'attribute_not_exists(#pk)', 'ExpressionAttributeNames': {'#pk': 'PK'}}
        return {'ConditionExpression': '#v = :v', 'ExpressionAttributeNames': {'#v': '_version'},
                'ExpressionAttributeValues': {':v': {'N': str(prior['_version'])}}}

    def _put(self, key, value, version, prior):
        row = encode({'PK': self.scope + key[0], 'SK': key[1], '_schema': SCHEMA,
                      '_scope': self.scope, '_version': version, **value})
        # Conservative wire-size budget is larger than the native stored value size.
        if len(canonical(row).encode()) > 350 * 1024:
            raise AppError('A persistent record exceeds the safe item size. No changes saved.', 'CAPACITY_LIMIT', 503)
        return {'Put': {'TableName': self.table, 'Item': row, **self._condition(prior)}}

    def _actions(self, epoch, previous, state):
        following = records(state)
        actions = []
        for key in sorted(set(previous) | set(following)):
            old = previous.get(key)
            before = {k: v for k, v in old.items() if k != '_version'} if old else None
            after = following.get(key)
            if before == after:
                continue
            if before and before['entity_type'] in IMMUTABLE:
                raise AppError('Recorded offer, consent, history or receipt is immutable.', 'IMMUTABLE_RECORD', 409)
            if after is None:
                actions.append({'Delete': {'TableName': self.table, 'Key': self.entity_key(*key), **self._condition(old)}})
            else:
                actions.append(self._put(key, after, (old['_version'] if old else 0) + 1, old))
        # Append one state event per new public trade revision; never rewrite old events.
        for id, trade in state['trades'].items():
            old = previous.get((f'TRADE#{id}', 'DETAILS'))
            if old and old['revision'] == trade['revision']:
                continue
            event_key = (f'TRADE#{id}', f'EVENT#{trade["updated_at"]}#STATE{trade["revision"]:010d}')
            actions.append(self._put(event_key, {'entity_type': 'EVENT', 'action': 'state',
                'timestamp': trade['updated_at'], 'trade_revision': trade['revision'],
                'status': trade['status'], 'offer_version': trade['offers'][-1]['version']}, 1, None))
        # Existing state events are not part of domain serialization; retain them.
        return actions

    def mutate(self, operation):
        with self.lock:
            for attempt in range(8):
                epoch, previous, state = self._snapshot()
                result = operation(state)
                # State events are append-only side records, not callback-owned arrays.
                business = {k: v for k, v in previous.items() if not (v['entity_type'] == 'EVENT' and v['action'] == 'state')}
                actions = self._actions(epoch, business, state)
                if not actions:
                    return deepcopy(result)
                control = self._put(('CONTROL#BARTR', 'DETAILS'), {'entity_type': 'CONTROL'},
                                    (epoch or 0) + 1, {'_version': epoch} if epoch is not None else None)
                actions.insert(0, control)
                if len(actions) > 100 or len(canonical(actions).encode()) > 4 * 1024 * 1024:
                    raise AppError('This atomic action exceeds the transaction capacity. No changes saved.', 'CAPACITY_LIMIT', 503)
                try:
                    self.connection().transact_write_items(TransactItems=actions, ClientRequestToken=uuid4().hex)
                    return deepcopy(result)
                except ClientError as exc:
                    code = exc.response.get('Error', {}).get('Code')
                    reasons = [x.get('Code') for x in exc.response.get('CancellationReasons', [])]
                    retry = code == 'TransactionConflictException' or (code == 'TransactionCanceledException' and
                        any(x in {'ConditionalCheckFailed', 'TransactionConflict'} for x in reasons) and
                        all(x in {'None', 'ConditionalCheckFailed', 'TransactionConflict'} for x in reasons))
                    if retry:
                        sleep(min(0.01 * 2 ** attempt, 0.2))
                        continue
                    if code in {'InternalServerError', 'RequestTimeout', 'TransactionInProgressException'}:
                        raise self._unresolved() from None
                    raise
                except BotoCoreError:
                    raise self._unresolved() from None
            raise AppError('Another request changed the marketplace. Reload the outcome before retrying.', 'RETRY_CONFLICT', 409)

    @staticmethod
    def _unresolved():
        return AppError('Commit outcome is unresolved. Reload the trade or retry the identical request with the SAME command ID.', 'COMMIT_UNRESOLVED', 503)

    def _query(self, pk, prefix=''):
        params = {'TableName': self.table, 'ConsistentRead': True,
                  'KeyConditionExpression': '#pk = :pk AND begins_with(#sk, :prefix)',
                  'ExpressionAttributeNames': {'#pk': 'PK', '#sk': 'SK'},
                  'ExpressionAttributeValues': {':pk': {'S': self.scope + pk}, ':prefix': {'S': prefix}}}
        rows = {}
        while True:
            response = self.connection().query(**params)
            for raw in response.get('Items', []):
                row = decode(raw)
                if row.get('_schema') != SCHEMA or row.get('_scope') != self.scope:
                    raise AppError('Incompatible query record.', 'NAMESPACE_CONFLICT', 503)
                key = (row.pop('PK')[len(self.scope):], row.pop('SK'))
                for field in ('_schema', '_scope', '_version'):
                    row.pop(field)
                rows[key] = row
            if not response.get('LastEvaluatedKey'):
                return rows
            params['ExclusiveStartKey'] = response['LastEvaluatedKey']

    def user_items(self, actor):
        return list(assemble(self._query(f'USER#{actor}', 'ITEM#'))['items'].values())

    def user_trades(self, actor):
        return [row['trade_id'] for row in self._query(f'USER#{actor}', 'TRADE#').values()]

    def item(self, owner, item_id):
        row = self._get(f'USER#{owner}', f'ITEM#{item_id}')
        if row is None:
            return None
        for field in ('PK', 'SK', '_schema', '_scope', '_version'):
            row.pop(field)
        return assemble({(f'USER#{owner}', f'ITEM#{item_id}'): row})['items'][item_id]
