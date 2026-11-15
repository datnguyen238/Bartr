"""Synthetic vector coverage; this does not establish live model quality."""
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from backend.app.domain import Marketplace
from backend.app.errors import AppError
from backend.app.main import create_app
from backend.app.services.dynamodb_semantic import DynamoSemanticSearch
from backend.tests.legacy_fixtures import seed_legacy_available
from backend.tests.test_dynamodb_api import repository  # noqa: F401


@pytest.fixture
def semantic_setup(repository, monkeypatch):
    monkeypatch.setenv('BEDROCK_EMBEDDING_MODEL', 'amazon.titan-embed-text-v2:0')
    monkeypatch.setenv('BEDROCK_EMBEDDING_DIMENSIONS', '256')
    calls = []
    def embed(self, text):
        calls.append(text)
        normalized = text.lower()
        is_display = any(term in normalized for term in ('monitor', 'display', 'broken electronics'))
        vector = ([1.0, 0.0] if is_display else [0.0, 1.0]) + [0.0] * 254
        return {'vector': vector, 'model': self.model, 'dimensions': self.dimensions}
    monkeypatch.setattr('backend.app.services.embeddings.BedrockEmbeddings.embed', embed)
    app = Marketplace(repository)
    alice = app.register('alice', 'synthetic-password', 'Alice', 'Campus')['id']
    bob = app.register('bob', 'synthetic-password', 'Bob', 'Campus')['id']
    outsider = app.register('outside', 'synthetic-password', 'Outside', 'Elsewhere')['id']
    app.update_profile(alice, 1, {'interests': ['computer display']})
    app.update_profile(bob, 1, {'interests': ['chair']})
    def item(owner, title):
        return seed_legacy_available(app, owner, {'title': title, 'description': title, 'category': title,
            'condition': 'Good', 'image_id': 'fixture-image', 'value_minor': 4000})
    chair = item(alice, 'Chair')
    monitor = item(bob, 'Monitor')
    private = item(outsider, 'Monitor')
    return app, alice, bob, chair, monitor, private, calls


def test_dynamodb_semantic_matches_equivalent_words_and_caches_private_projections(semantic_setup):
    app, alice, bob, chair, monitor, private, calls = semantic_setup
    search = DynamoSemanticSearch(app.repo)
    state, relevant, excluded = search.candidates(app.repo.read(), alice)
    assert monitor['id'] in relevant[alice] and chair['id'] in relevant[bob]
    assert private['id'] in relevant[alice] and not excluded[alice]
    assert app.recommend(alice, relevant, excluded, state=state)['recommendations']
    count = len(calls)
    search.candidates(app.repo.read(), alice)
    assert len(calls) == count
    public = app.view(alice)
    assert 'embedding' not in str(public) and 'vectors' not in str(public)
    assert app.repo.read()['items'][chair['id']]['revision'] == chair['revision']


def test_category_interests_exclude_unrelated_categories_even_with_similar_vectors(semantic_setup):
    app, alice, bob, _, monitor, _, _ = semantic_setup
    monitor = app.save_item(bob, monitor['id'], monitor['revision'], {'category': 'Electronics'})
    tape = seed_legacy_available(app, bob, {'title': 'Tape dispenser', 'description': 'Tape for electronics',
        'category': 'Study supplies', 'condition': 'Good', 'image_id': 'fixture-image', 'value_minor': 400})
    app.update_profile(alice, 2, {'interests': ['Electronics']})
    _, relevant, _ = DynamoSemanticSearch(app.repo).candidates(app.repo.read(), alice)
    assert monitor['id'] in relevant[alice]
    assert tape['id'] not in relevant[alice]
    with TestClient(create_app(app.repo), headers={'X-Bartr-Request': '1'}) as client:
        assert client.post('/api/auth/login', json={'username': 'alice', 'password': 'synthetic-password'}).status_code == 200
        result = client.get('/api/recommendations?semantic=true')
        assert result.status_code == 200
        assert monitor['id'] in result.json()['matching_item_ids']
        assert tape['id'] not in result.json()['matching_item_ids']


def test_specific_interest_still_uses_semantic_similarity_with_category_interests(semantic_setup):
    app, alice, _, _, monitor, private, _ = semantic_setup
    app.update_profile(alice, 2, {'interests': ['Electronics', 'computer display']})
    _, relevant, _ = DynamoSemanticSearch(app.repo).candidates(app.repo.read(), alice)
    assert monitor['id'] in relevant[alice] and private['id'] in relevant[alice]


def test_semantic_exclusion_takes_precedence_and_profile_change_invalidates_cache(semantic_setup):
    app, alice, _, _, monitor, _, calls = semantic_setup
    search = DynamoSemanticSearch(app.repo)
    search.candidates(app.repo.read(), alice)
    before = len(calls)
    app.update_profile(alice, 2, {'exclusions': ['broken electronics']})
    state, relevant, excluded = search.candidates(app.repo.read(), alice)
    assert monitor['id'] in excluded[alice] and monitor['id'] not in relevant[alice]
    assert not app.recommend(alice, relevant, excluded, state=state)['recommendations']
    assert len(calls) > before


def test_semantic_rejects_stale_snapshot_and_does_not_reuse_old_item_revision(semantic_setup, monkeypatch):
    app, alice, _, chair, _, _, calls = semantic_setup
    search = DynamoSemanticSearch(app.repo)
    search.candidates(app.repo.read(), alice)
    before = len(calls)
    app.save_item(alice, chair['id'], chair['revision'], {'description': 'Updated chair'})
    search.candidates(app.repo.read(), alice)
    assert len(calls) == before + 1
    stale = deepcopy(app.repo.read())
    app.update_profile(alice, 2, {'interests': ['different interest']})
    with pytest.raises(AppError) as error:
        search.candidates(stale, alice)
    assert error.value.code == 'STALE_EMBEDDING'


def test_semantic_api_preserves_private_preferences_and_checks_session(semantic_setup):
    app, alice, _, _, monitor, private, _ = semantic_setup
    web = create_app(app.repo)
    with TestClient(web, headers={'X-Bartr-Request': '1'}) as client:
        assert client.get('/api/recommendations?semantic=true').status_code == 401
        assert client.post('/api/auth/login', json={'username': 'alice', 'password': 'synthetic-password'}).status_code == 200
        response = client.get('/api/recommendations?semantic=true')
        assert response.status_code == 200
        data = response.json()
        assert monitor['id'] in data['matching_item_ids'] and private['id'] in data['matching_item_ids']
        assert data['matching_item_revisions'][monitor['id']] == monitor['revision']
        assert 'vectors' not in str(data) and 'exclusions' not in str(data)
        app.update_profile(alice, 2, {'interests': ['monitor'], 'exclusions': ['broken electronics']})
        blocked = client.get('/api/recommendations?semantic=true')
        assert blocked.status_code == 200
        assert monitor['id'] not in blocked.json()['matching_item_ids']


def test_semantic_api_does_not_silently_fallback_when_bedrock_fails(semantic_setup, monkeypatch):
    app, _, _, _, _, _, _ = semantic_setup
    def unavailable(self, text):
        raise AppError('Embedding provider unavailable.', 'EMBEDDINGS_UNAVAILABLE', 503)
    monkeypatch.setattr('backend.app.services.embeddings.BedrockEmbeddings.embed', unavailable)
    with TestClient(create_app(app.repo), headers={'X-Bartr-Request': '1'}) as client:
        assert client.post('/api/auth/login', json={'username': 'alice', 'password': 'synthetic-password'}).status_code == 200
        result = client.get('/api/recommendations?semantic=true')
        assert result.status_code == 503 and result.json()['code'] == 'EMBEDDINGS_UNAVAILABLE'
        assert client.get('/api/recommendations?semantic=false').status_code == 200


def test_projection_write_cannot_replace_newer_revision(semantic_setup):
    app, _, _, chair, _, _, _ = semantic_setup
    vector = [1.0] + [0.0] * 255
    new = {'revision': 4, 'model': 'fixture-model', 'dimensions': 256, 'vectors': [vector]}
    app.repo.save_semantic_projection('ITEM', chair['id'], new)
    with pytest.raises(AppError) as error:
        app.repo.save_semantic_projection('ITEM', chair['id'], {**new, 'revision': 3})
    assert error.value.code == 'STALE_EMBEDDING'
    assert app.repo.semantic_projection('ITEM', chair['id'])['revision'] == 4


def test_semantic_rejects_broad_search_instead_of_returning_partial_results(semantic_setup):
    from backend.app.services.dynamodb_semantic import MAX_ITEMS
    app, alice, _, chair, _, _, calls = semantic_setup
    state = deepcopy(app.repo.read())
    for index in range(MAX_ITEMS):
        item = {**chair, 'id': f'additional-{index}'}
        state['items'][item['id']] = item
    with pytest.raises(AppError) as error:
        DynamoSemanticSearch(app.repo).candidates(state, alice)
    assert error.value.code == 'SEMANTIC_CAPACITY' and not calls
