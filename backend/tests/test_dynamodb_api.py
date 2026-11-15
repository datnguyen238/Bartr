"""Authenticated landing/discovery contract against Moto's DynamoDB emulator."""
import asyncio
from io import BytesIO

import boto3
import httpx
from moto import mock_aws
from PIL import Image
import pytest

from backend.app.main import create_app
from backend.app.storage.dynamodb import DynamoRepository
from backend.tests.test_dynamodb import setup_market, propose, seed_historical_record


@pytest.fixture
def repository(monkeypatch):
    # Explicit synthetic credentials prevent accidental credential-chain lookups.
    monkeypatch.delenv('AWS_PROFILE', raising=False)
    monkeypatch.delenv('AWS_DEFAULT_PROFILE', raising=False)
    monkeypatch.setenv('AWS_ACCESS_KEY_ID', 'testing')
    monkeypatch.setenv('AWS_SECRET_ACCESS_KEY', 'testing')
    monkeypatch.setenv('AWS_SESSION_TOKEN', 'testing')
    monkeypatch.setenv('AWS_DEFAULT_REGION', 'us-east-1')
    monkeypatch.setenv('AWS_REGION', 'us-east-1')
    monkeypatch.setenv('BARTR_STORAGE', 'dynamodb')
    monkeypatch.setenv('DYNAMODB_TABLE', 'test-bartr-api')
    monkeypatch.setenv('DYNAMODB_PARTITION_KEY', 'PK')
    monkeypatch.setenv('DYNAMODB_SORT_KEY', 'SK')
    monkeypatch.setenv('COOKIE_SECURE', 'false')
    with mock_aws():
        client = boto3.client('dynamodb', region_name='us-east-1',
                              aws_access_key_id='testing', aws_secret_access_key='testing')
        client.create_table(
            TableName='test-bartr-api',
            KeySchema=[{'AttributeName': 'PK', 'KeyType': 'HASH'},
                       {'AttributeName': 'SK', 'KeyType': 'RANGE'}],
            AttributeDefinitions=[{'AttributeName': key, 'AttributeType': 'S'}
                                  for key in ('PK', 'SK')],
            BillingMode='PAY_PER_REQUEST',
        )
        yield DynamoRepository(client=client)


def api_client(app, **kwargs):
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                             base_url='http://test', headers={'X-Bartr-Request': '1'},
                             **kwargs)


async def register(client, username, community='Test campus'):
    response = await client.post('/api/auth/register', json={
        'username': username, 'password': 'synthetic-passphrase',
        'name': username.title(), 'community': community,
    })
    assert response.status_code == 200
    assert 'password_hash' not in response.json()
    return response.json()


@pytest.mark.parametrize('historical_kind', ['offer_hash', 'consent_metadata', 'login_metadata'])
def test_logout_with_historical_offer_revokes_only_current_session(repository, historical_kind):
    service, actors, ids = setup_market(repository)
    app = create_app(repository)

    async def check():
        async with api_client(app) as owner, api_client(app) as other_session:
            credentials = {'username': 'alice', 'password': 'synthetic-password'}
            assert (await owner.post('/api/auth/login', json=credentials)).status_code == 200
            assert (await other_session.post('/api/auth/login', json=credentials)).status_code == 200
            old_token = owner.cookies.get('bartr_session')
            trade = propose(service, actors, ids)
            original_record = seed_historical_record(repository, trade, historical_kind)
            before = repository._scan()

            response = await owner.post('/api/auth/logout', json={})
            assert response.status_code == 200, response.text
            assert response.json() == {'signed_out': True}
            assert 'max-age=0' in response.headers['set-cookie'].lower()
            assert owner.cookies.get('bartr_session') is None
            assert (await owner.get('/api/me')).status_code == 401
            async with api_client(app, cookies={'bartr_session': old_token}) as replay:
                assert (await replay.get('/api/me')).status_code == 401
            assert (await other_session.get('/api/me')).status_code == 200

            after = repository._scan()
            # Only one session and the serialization epoch changed.
            assert len(before) == len(after) + 1
            for key, row in before.items():
                if row['entity_type'] != 'SESSION':
                    assert after[key] == row
            stored = repository.client.get_item(TableName=repository.table,
                Key={key: original_record[key] for key in ('PK', 'SK')})['Item']
            assert stored == original_record

    asyncio.run(check())


@pytest.mark.parametrize('historical_kind', ['offer_hash', 'consent_metadata', 'login_metadata'])
def test_historical_offer_does_not_block_account_listing_profile_or_trade_writes(repository, historical_kind):
    service, actors, ids = setup_market(repository)
    trade = propose(service, actors, ids)
    original_record = seed_historical_record(repository, trade, historical_kind)
    app = create_app(repository)

    async def check():
        async with api_client(app) as alice, api_client(app) as brian, api_client(app) as newcomer:
            for client, username in [(alice, 'alice'), (brian, 'brian')]:
                response = await client.post('/api/auth/login', json={
                    'username': username, 'password': 'synthetic-password',
                })
                assert response.status_code == 200, response.text
            await register(newcomer, 'new-member')
            profile = (await alice.get('/api/me')).json()['profile']
            response = await alice.patch('/api/profile', json={
                'expected_revision': profile['revision'], 'name': 'Updated name',
                'community': profile['community'], 'interests': [],
                'exclusions': [], 'gap_limit': 20,
            })
            assert response.status_code == 200, response.text
            response = await alice.post('/api/items', json={'title': 'New private draft'})
            assert response.status_code == 200, response.text
            path = f'/api/trades/{trade["id"]}/actions'
            response = await alice.post(path, json={
                'expected_revision': 1, 'kind': 'note',
                'command_id': 'historical-note', 'note': 'Synthetic coordination',
            })
            assert response.status_code == 200, response.text
            response = await brian.post(path, json={
                'expected_revision': 2, 'kind': 'accept', 'command_id': 'historical-accept',
            })
            assert response.status_code == 200, response.text
            assert response.json()['status'] == 'agreed'
            assert all(repository.read()['items'][item_id]['status'] == 'reserved' for item_id in ids[:3])
            assert (await alice.post('/api/auth/logout', json={})).status_code == 200
            stored = repository.client.get_item(TableName=repository.table,
                Key={key: original_record[key] for key in ('PK', 'SK')})['Item']
            assert stored == original_record

    asyncio.run(check())


async def upload_draft(client, title, category, value):
    facts = {'title': title, 'description': f'Synthetic {title} listing',
             'category': category, 'condition': 'Good',
             'value_minor': value, 'status': 'draft'}
    response = await client.post('/api/items', json=facts)
    assert response.status_code == 200
    item = response.json()
    image = BytesIO()
    Image.new('RGB', (48, 48), 'tan').save(image, format='JPEG')
    uploaded = await client.post(
        f'/api/items/{item["id"]}/image?expected_revision={item["revision"]}',
        files={'file': ('synthetic.jpeg', image.getvalue(), 'image/jpeg')},
    )
    assert uploaded.status_code == 200
    return facts, uploaded.json()


async def publish(client, facts, item):
    actor = (await client.get('/api/me')).json()['profile']['id']
    app = client._transport.app
    reviewed = app.state.marketplace.review_analysis(actor, item['id'], item['revision'], {
        'status': 'estimated', 'price_basis': 'market_comparables', 'estimate_minor': facts['value_minor'], 'uncertainty': 'high',
    })
    response = await client.patch(f'/api/items/{item["id"]}', json={
        **facts, 'status': 'available', 'expected_revision': item['revision'], 'analysis_id': reviewed['analysis']['analysis_id'],
    })
    assert response.status_code == 200
    return response.json()


def test_dynamodb_rejects_manual_publication_and_accepts_reviewed_estimate(repository, monkeypatch):
    from backend.app.services.market_analysis import MarketAnalysis

    async def assess(self, facts, image):
        return {'status': 'estimated', 'price_basis': 'market_comparables', 'estimate_minor': 4500, 'uncertainty': 'high', 'attributes': {'description': 'Synthetic'}}

    monkeypatch.setattr(MarketAnalysis, 'analyze', assess)

    async def check():
        app = create_app(repository)
        async with api_client(app) as owner:
            await register(owner, 'required-value')
            facts, item = await upload_draft(owner, 'Desk chair', 'Furniture', None)
            path = f'/api/items/{item["id"]}'
            bad = await owner.patch(path, json={**facts, 'status': 'available', 'value_minor': 99999, 'expected_revision': item['revision']})
            assert bad.status_code == 422 and bad.json()['code'] == 'EVALUATION_REQUIRED'
            assert (await owner.get(path)).json()['status'] == 'draft'
            result = await owner.post(path + '/analysis', json={'expected_revision': item['revision']})
            assert result.status_code == 200
            published = await owner.patch(path, json={**facts, 'status': 'available', 'value_minor': 4500, 'analysis_id': result.json()['analysis_id'], 'expected_revision': item['revision']})
            assert published.status_code == 200 and published.json()['value_source'] == 'assisted'
    asyncio.run(check())


def test_dynamodb_api_landing_inventory_session_restart_and_visibility(repository):
    async def check():
        app = create_app(repository)
        async with api_client(app) as alice, api_client(app) as brian, api_client(app) as outsider, api_client(app) as anonymous:
            assert (await anonymous.get('/api/me')).status_code == 401
            profile = await register(alice, 'api-alice')
            await register(brian, 'api-brian')
            await register(outsider, 'api-outsider', 'Other campus')

            facts, item = await upload_draft(alice, 'Study chair', 'Furniture', 4000)
            private_image = f'/api/images/{item["image_id"]}'
            assert (await anonymous.get(private_image)).status_code == 401
            assert (await brian.get(private_image)).status_code == 404
            assert (await brian.get('/api/me')).json()['items'] == []

            item = await publish(alice, facts, item)
            # Unreviewed provider results remain private, including on a published item.
            app.state.marketplace.review_analysis(profile['id'], item['id'], item['revision'], {
                'estimate_minor': 4100, 'uncertainty': 'high',
                'attributes': {'description': 'Synthetic owner-only suggestion'},
            })
            _, draft = await upload_draft(alice, 'Private draft', 'Furniture', None)

            owner_view = (await alice.get('/api/me')).json()
            assert owner_view['storage'] == 'dynamodb'
            assert {entry['id'] for entry in owner_view['items']} == {item['id'], draft['id']}
            assert next(entry for entry in owner_view['items'] if entry['id'] == item['id'])['analysis']
            public_view = (await brian.get('/api/me')).json()
            assert public_view['storage'] == 'dynamodb'
            assert {entry['id'] for entry in public_view['items']} == {item['id']}
            assert public_view['items'][0]['analysis'] is None
            assert public_view['items'][0]['status'] == 'available'
            assert all(set(member) == {'id', 'name', 'community'} for member in public_view['members'])
            assert len(public_view['members']) == 3
            assert (await brian.get(f'/api/items/{item["id"]}')).json()['analysis'] is None
            assert [entry['id'] for entry in (await outsider.get('/api/me')).json()['items']] == [item['id']]
            assert (await outsider.get(f'/api/items/{item["id"]}')).status_code == 200
            assert (await outsider.get(private_image)).status_code == 200
            assert (await outsider.get(f'/api/images/{draft["image_id"]}')).status_code == 404
            photo = await brian.get(private_image)
            assert photo.status_code == 200 and photo.headers['content-type'] == 'image/jpeg'
            assert photo.content.startswith(b'\xff\xd8')

            restarted = create_app(DynamoRepository(client=repository.client))
            async with api_client(restarted, cookies={'bartr_session': alice.cookies.get('bartr_session')}) as returning:
                response = await returning.get('/api/me')
                assert response.status_code == 200
                assert response.json()['profile']['id'] == profile['id']
                assert len(response.json()['items']) == 2
                assert (await returning.get(private_image)).content == photo.content
                assert (await returning.post('/api/auth/logout', json={})).status_code == 200
                assert (await returning.get('/api/me')).status_code == 401
            assert (await alice.get('/api/me')).status_code == 401
            invalid = await alice.post('/api/auth/login', json={
                'username': 'api-alice', 'password': 'incorrect-password',
            })
            assert invalid.status_code == 401
            login = await alice.post('/api/auth/login', json={
                'username': 'api-alice', 'password': 'synthetic-passphrase',
            })
            assert login.status_code == 200
            assert (await alice.get('/api/me')).json()['storage'] == 'dynamodb'

    asyncio.run(check())


def test_dynamodb_api_exact_text_discovery_and_explicit_semantic_unavailable(repository, monkeypatch):
    monkeypatch.setenv('BEDROCK_EMBEDDING_MODEL', '')
    async def check():
        app = create_app(repository)
        async with api_client(app) as alice, api_client(app) as brian:
            for client, username, interests in [
                (alice, 'match-alice', ['Electronics']),
                (brian, 'match-brian', ['Furniture']),
            ]:
                profile = await register(client, username)
                response = await client.patch('/api/profile', json={
                    'expected_revision': profile['revision'],
                    'name': profile['name'], 'community': profile['community'],
                    'interests': interests, 'exclusions': [], 'gap_limit': 20,
                })
                assert response.status_code == 200

            chair_facts, chair = await upload_draft(alice, 'Chair', 'Furniture', 4000)
            chair = await publish(alice, chair_facts, chair)
            monitor_facts, monitor = await upload_draft(brian, 'Monitor', 'Electronics', 4200)
            monitor = await publish(brian, monitor_facts, monitor)

            matches = await alice.get('/api/recommendations?semantic=false')
            assert matches.status_code == 200
            assert matches.json()['retrieval'] == 'exact-text (local testing)'
            recommendations = matches.json()['recommendations']
            assert len(recommendations) == 1
            assert recommendations[0]['terms']['left'][0]['id'] == chair['id']
            assert recommendations[0]['terms']['right'][0]['id'] == monitor['id']

            semantic = await alice.get('/api/recommendations?semantic=true')
            assert semantic.status_code == 503
            assert semantic.json()['code'] == 'EMBEDDINGS_NOT_CONFIGURED'
            index = await alice.post(f'/api/items/{chair["id"]}/embedding', json={
                'expected_revision': chair['revision'],
            })
            assert index.status_code == 503
            assert index.json()['code'] == 'EMBEDDINGS_NOT_CONFIGURED'
            # Provider unavailability does not clear published records or create a trade.
            view = (await alice.get('/api/me')).json()
            assert len(view['items']) == 2 and view['trades'] == []

    asyncio.run(check())


def test_dynamodb_api_reviewed_image_estimate_is_revision_bound(repository, monkeypatch):
    from backend.app.services.market_analysis import MarketAnalysis

    async def synthetic_assessment(self, facts, image):
        assert facts['title'] == 'Desk chair'
        assert image['data'].startswith(b'\xff\xd8')
        return {
            'status': 'estimated', 'price_basis': 'market_comparables', 'estimate_minor': 4500, 'uncertainty': 'high',
            'attributes': {'description': 'Synthetic chair description', 'brand': None,
                           'model': None, 'clarification_needed': False,
                           'clarification_questions': []},
            'uncertainty_reasons': ['Synthetic image assessment fixture'],
        }

    monkeypatch.setattr(MarketAnalysis, 'analyze', synthetic_assessment)

    async def check():
        app = create_app(repository)
        async with api_client(app) as alice, api_client(app) as brian:
            await register(alice, 'review-alice')
            await register(brian, 'review-brian')
            facts, item = await upload_draft(alice, 'Desk chair', 'Furniture', 4000)
            path = f'/api/items/{item["id"]}'
            response = await alice.post(path + '/analysis', json={
                'expected_revision': item['revision'],
            })
            assert response.status_code == 200
            assessment = response.json()
            assert assessment['analysis_id']
            assert assessment['item_revision'] == item['revision']
            unchanged = (await alice.get(path)).json()
            assert unchanged['value_minor'] == 4000 and unchanged['status'] == 'draft'
            assert (await brian.post(path + '/analysis', json={
                'expected_revision': item['revision'],
            })).status_code == 404

            response = await alice.patch(path, json={
                **facts, 'status': 'available', 'value_minor': 4500,
                'expected_revision': item['revision'],
                'analysis_id': assessment['analysis_id'],
            })
            assert response.status_code == 200
            accepted = response.json()
            assert accepted['value_minor'] == 4500
            assert accepted['value_source'] == 'assisted'
            assert accepted['uncertainty'] == 'high' and accepted['value_set_at']
            assert (await brian.get(path)).json()['analysis'] is None

            stale = await alice.patch(path, json={
                **facts, 'status': 'available', 'value_minor': 4500,
                'expected_revision': accepted['revision'],
                'analysis_id': assessment['analysis_id'],
            })
            assert stale.status_code == 409 and stale.json()['code'] == 'STALE_ANALYSIS'
            assert (await alice.get(path)).json()['revision'] == accepted['revision']

            corrected = await alice.patch(path, json={
                **facts, 'status': 'available', 'value_minor': 4700,
                'expected_revision': accepted['revision'],
            })
            assert corrected.status_code == 422 and corrected.json()['code'] == 'EVALUATION_REQUIRED'
            assert (await alice.get(path)).json()['value_minor'] == 4500

    asyncio.run(check())
