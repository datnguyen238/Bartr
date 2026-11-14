from types import SimpleNamespace

import pytest

from backend.app.errors import AppError
from backend.app.services.search import SemanticSearch
from backend.app.storage.state import StateRepository


def test_semantic_search_does_not_report_no_match_when_index_is_stale(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY','fixture-key')
    monkeypatch.setenv('GEMINI_MODEL','fixture-model')
    monkeypatch.setenv('BEDROCK_EMBEDDING_MODEL','amazon.titan-embed-text-v2:0')
    monkeypatch.setenv('AWS_REGION','us-west-2')
    repo=StateRepository()
    records=SimpleNamespace(find=lambda *args:[])
    repo.db=SimpleNamespace(search_items=records)
    state={'users':{'alice':{'id':'alice','community':'Tempe','interests':['monitor']}},
           'items':{'one':{'id':'one','owner':'alice','revision':1,'status':'available'}}}
    with pytest.raises(AppError) as exc:
        SemanticSearch(repo).candidates(state,'alice')
    assert exc.value.code=='INDEX_PENDING'


def test_temporary_storage_never_pretends_to_be_atlas():
    with pytest.raises(AppError) as exc:
        SemanticSearch(StateRepository(memory=True)).candidates({},'alice')
    assert exc.value.code=='ATLAS_REQUIRED'
