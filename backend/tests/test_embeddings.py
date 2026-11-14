import io
import json
from types import SimpleNamespace

import pytest

from backend.app.errors import AppError
from backend.app.services.embeddings import BedrockEmbeddings


def test_embedding_uses_runtime_and_preserves_model_dimensions(monkeypatch):
    import boto3
    monkeypatch.setenv('AWS_REGION', 'us-west-2')
    monkeypatch.setenv('BEDROCK_EMBEDDING_MODEL', 'amazon.titan-embed-text-v2:0')
    monkeypatch.setenv('BEDROCK_EMBEDDING_DIMENSIONS', '256')
    calls = []
    body = io.BytesIO(json.dumps({'embedding': [0.25]*256}).encode())
    def invoke(**kwargs):
        calls.append(kwargs)
        return {'body': body}
    def client(service, **kwargs):
        assert service == 'bedrock-runtime' and kwargs['region_name'] == 'us-west-2'
        return SimpleNamespace(invoke_model=invoke, close=lambda: None)
    monkeypatch.setattr(boto3, 'client', client)
    result = BedrockEmbeddings().embed('A used study chair')
    assert result['dimensions'] == 256 and result['model'] == 'amazon.titan-embed-text-v2:0'
    assert json.loads(calls[0]['body']) == {'inputText':'A used study chair','dimensions':256,'normalize':True}
    assert body.closed


def test_embeddings_without_configuration_do_not_make_calls(monkeypatch):
    monkeypatch.delenv('BEDROCK_EMBEDDING_MODEL', raising=False)
    with pytest.raises(AppError) as exc:
        BedrockEmbeddings().embed('chair')
    assert exc.value.code == 'EMBEDDINGS_NOT_CONFIGURED'
