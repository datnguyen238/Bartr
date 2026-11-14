"""Bedrock Titan text embeddings. No model calls happen at import/startup."""
import json
import math
import os

from ..errors import AppError


class BedrockEmbeddings:
    def __init__(self):
        self.model = os.getenv('BEDROCK_EMBEDDING_MODEL', '')
        self.region = os.getenv('AWS_REGION', '')
        self.dimensions = int(os.getenv('BEDROCK_EMBEDDING_DIMENSIONS', '1024'))
        if self.dimensions not in (256, 512, 1024):
            raise ValueError('Titan V2 embedding dimensions must be 256, 512 or 1024.')
        self.configured = bool(self.model and self.region)

    def embed(self, text):
        if not self.configured:
            raise AppError('Configure BEDROCK_EMBEDDING_MODEL and AWS_REGION.', 'EMBEDDINGS_NOT_CONFIGURED', 503)
        if not text.strip():
            raise AppError('Embedding text is empty.', 'EMPTY_TEXT', 422)
        import boto3
        from botocore.config import Config
        try:
            client = boto3.client('bedrock-runtime', region_name=self.region,
                                  config=Config(connect_timeout=5, read_timeout=20, retries={'max_attempts': 0}))
            try:
                response = client.invoke_model(modelId=self.model, contentType='application/json',
                    accept='application/json', body=json.dumps({'inputText': text, 'dimensions': self.dimensions, 'normalize': True}))
                try:
                    vector = json.loads(response['body'].read())['embedding']
                finally:
                    response['body'].close()
            finally:
                client.close()
        except Exception as exc:
            raise AppError('Bedrock embeddings are unavailable. Check AWS credentials, model access and region.', 'EMBEDDINGS_UNAVAILABLE', 503) from exc
        if len(vector) != self.dimensions or not all(type(x) in (int, float) and math.isfinite(x) for x in vector):
            raise AppError('Bedrock returned an incompatible embedding.', 'INVALID_EMBEDDING', 502)
        return {'vector': vector, 'model': self.model, 'dimensions': self.dimensions}
