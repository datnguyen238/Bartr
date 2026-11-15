import asyncio
from io import BytesIO

import httpx
import pytest
from PIL import Image

from backend.app.main import create_app
from backend.app.storage.state import StateRepository


def test_marketplace_wide_listing_visibility_without_exposing_drafts_or_private_trades():
    from backend.tests.legacy_fixtures import seed_legacy_available

    async def check():
        app = create_app(StateRepository(memory=True))
        headers = {'X-Bartr-Request': '1'}
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url='http://test', headers=headers) as first, httpx.AsyncClient(transport=transport, base_url='http://test', headers=headers) as second, httpx.AsyncClient(transport=transport, base_url='http://test', headers=headers) as observer:
            for client, name, community in [(first, 'alpha', 'North'), (second, 'bravo', 'South'), (observer, 'charlie', None)]:
                body = {'username': name, 'password': 'synthetic-password', 'name': name.title()}
                if community is not None:
                    body['community'] = community
                assert (await client.post('/api/auth/register', json=body)).status_code == 200
            service = app.state.marketplace
            state = service.repo.read()
            users = {user['username']: user['id'] for user in state['users'].values()}
            service.repo.put_image('public-image', users['bravo'], {'data': b'public', 'mime_type': 'image/jpeg'})
            public = seed_legacy_available(service, users['bravo'], {'title': 'Monitor', 'description': 'Display', 'category': 'Electronics', 'condition': 'Good', 'image_id': 'public-image', 'value_minor': 1000})
            draft = (await second.post('/api/items', json={'title': 'Private draft'})).json()
            view = (await first.get('/api/me')).json()
            assert users['bravo'] in {member['id'] for member in view['members']}
            assert all(member['community'] == '' for member in view['members'])
            assert public['id'] in {item['id'] for item in view['items']}
            assert draft['id'] not in {item['id'] for item in view['items']}
            assert (await first.get(f"/api/images/{public['image_id']}")).status_code == 200
            assert (await first.get(f"/api/items/{draft['id']}")).status_code == 404
            own = seed_legacy_available(service, users['alpha'], {'title': 'Chair', 'description': 'Chair', 'category': 'Furniture', 'condition': 'Good', 'image_id': 'chair', 'value_minor': 1000})
            proposal = await first.post('/api/trades', json={'other': users['bravo'], 'left': [own['id']], 'right': [public['id']], 'acknowledged': True, 'command_id': 'global-trade'})
            assert proposal.status_code == 200
            trade_id = proposal.json()['id']
            assert (await observer.get(f'/api/trades/{trade_id}')).status_code == 404
    asyncio.run(check())


def test_photo_identification_is_owner_only_revision_bound_and_not_persisted(monkeypatch):
    from backend.app.services.image_analysis import GeminiImageAnalysis
    calls = []
    async def identify(self, facts, image):
        calls.append((facts, image))
        return {'title': 'Synthetic chair', 'category': 'Furniture', 'description': 'A chair'}
    monkeypatch.setattr(GeminiImageAnalysis, 'identify', identify)
    async def check():
        app = create_app(StateRepository(memory=True))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test', headers={'X-Bartr-Request': '1'}) as owner, httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test', headers={'X-Bartr-Request': '1'}) as other:
            for client, name in [(owner, 'photo_owner'), (other, 'photo_other')]:
                await client.post('/api/auth/register', json={'username': name, 'password': 'synthetic-password', 'name': name, 'community': 'Test'})
            item = (await owner.post('/api/items', json={})).json()
            image = BytesIO(); Image.new('RGB', (80, 80), 'tan').save(image, 'JPEG')
            item = (await owner.post(f"/api/items/{item['id']}/image?expected_revision=1", files={'file': ('test.jpg', image.getvalue(), 'image/jpeg')})).json()
            path = f"/api/items/{item['id']}/identify"
            assert (await other.post(path, json={'expected_revision': item['revision']})).status_code == 404
            assert (await owner.post(path, json={'expected_revision': item['revision'] - 1})).json()['code'] == 'STALE_ITEM'
            response = await owner.post(path, json={'expected_revision': item['revision']})
            assert response.json()['title'] == 'Synthetic chair' and len(calls) == 1
            saved = (await owner.get(f"/api/items/{item['id']}")).json()
            assert saved['title'] == '' and saved['revision'] == item['revision'] and saved['analysis'] is None
            async def stale(self, facts, image):
                app.state.marketplace.save_item(item['owner'], item['id'], item['revision'], {'title': 'Updated'})
                return {'title': 'Old', 'category': None, 'description': ''}
            monkeypatch.setattr(GeminiImageAnalysis, 'identify', stale)
            assert (await owner.post(path, json={'expected_revision': item['revision']})).json()['code'] == 'STALE_ITEM'
    asyncio.run(check())


def test_publication_requires_current_owned_ai_estimate(monkeypatch):
    from backend.app.services.market_analysis import MarketAnalysis

    async def assess(self, facts, image):
        return {'status': 'estimated', 'price_basis': 'market_comparables', 'estimate_minor': 4200, 'uncertainty': 'high', 'attributes': {'description': 'Synthetic', 'clarification_questions': []}}

    monkeypatch.setattr(MarketAnalysis, 'analyze', assess)

    async def check():
        app = create_app(StateRepository(memory=True))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test', headers={'X-Bartr-Request': '1'}) as client:
            assert (await client.post('/api/auth/register', json={'username': 'owner', 'password': 'synthetic-password', 'name': 'Owner', 'community': 'Test'})).status_code == 200
            facts = {'title': 'Chair', 'description': 'Wooden chair', 'category': 'Furniture', 'condition': 'Good', 'value_minor': None, 'status': 'draft'}
            created = (await client.post('/api/items', json=facts)).json()
            image = BytesIO(); Image.new('RGB', (80, 80), 'tan').save(image, 'JPEG')
            uploaded = await client.post(f"/api/items/{created['id']}/image?expected_revision=1", files={'file': ('test.jpg', image.getvalue(), 'image/jpeg')})
            item = uploaded.json(); path = f"/api/items/{item['id']}"
            rejected = await client.patch(path, json={**facts, 'status': 'available', 'value_minor': 99999, 'expected_revision': item['revision']})
            assert rejected.status_code == 422 and rejected.json()['code'] == 'EVALUATION_REQUIRED'
            analysis = (await client.post(path + '/analysis', json={'expected_revision': item['revision']})).json()
            tampered = await client.patch(path, json={**facts, 'status': 'available', 'value_minor': 99999, 'expected_revision': item['revision'], 'analysis_id': analysis['analysis_id']})
            assert tampered.status_code == 422 and tampered.json()['code'] == 'EVALUATION_REQUIRED'
            changed = await client.patch(path, json={**facts, 'title': 'Different item', 'status': 'available', 'value_minor': 4200, 'expected_revision': item['revision'], 'analysis_id': analysis['analysis_id']})
            assert changed.status_code == 409 and changed.json()['code'] == 'STALE_ANALYSIS'
            assert (await client.get(path)).json()['status'] == 'draft'
            # Historical photo-only estimates cannot be reused as search evidence.
            legacy = app.state.marketplace.review_analysis(created['owner'], item['id'], item['revision'], {'status': 'estimated', 'price_basis': 'image_assisted_estimate', 'estimate_minor': 4200})
            legacy_id = legacy['analysis']['analysis_id']
            denied = await client.patch(path, json={**facts, 'status': 'available', 'value_minor': 4200, 'expected_revision': item['revision'], 'analysis_id': legacy_id})
            assert denied.status_code == 422 and denied.json()['code'] == 'EVALUATION_REQUIRED'
            # Restore a current grounded result after replacing the saved record.
            analysis = (await client.post(path + '/analysis', json={'expected_revision': item['revision']})).json()
            published = await client.patch(path, json={**facts, 'status': 'available', 'value_minor': 4200, 'expected_revision': item['revision'], 'analysis_id': analysis['analysis_id']})
            assert published.status_code == 200 and published.json()['value_source'] == 'assisted'
            replay = await client.patch(path, json={**facts, 'status': 'available', 'value_minor': 4200, 'expected_revision': item['revision'], 'analysis_id': analysis['analysis_id']})
            assert replay.status_code == 409
    asyncio.run(check())


def test_fallback_estimate_can_publish_without_losing_provenance(monkeypatch):
    from backend.app.services.market_analysis import MarketAnalysis
    async def assess(self, facts, image):
        return {'status': 'estimated', 'price_basis': 'image_assisted_estimate', 'fallback_reason': 'comparables_unavailable', 'estimate_minor': 4200, 'uncertainty': 'high', 'attributes': {'description': 'Synthetic', 'clarification_questions': []}}
    monkeypatch.setattr(MarketAnalysis, 'analyze', assess)
    async def check():
        app = create_app(StateRepository(memory=True))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test', headers={'X-Bartr-Request': '1'}) as client:
            await client.post('/api/auth/register', json={'username': 'owner', 'password': 'synthetic-password', 'name': 'Owner', 'community': 'Test'})
            facts = {'title': 'Chair', 'description': 'Wooden chair', 'category': 'Furniture', 'condition': 'Good', 'value_minor': None, 'status': 'draft'}
            created = (await client.post('/api/items', json=facts)).json()
            image = BytesIO(); Image.new('RGB', (80, 80), 'tan').save(image, 'JPEG')
            item = (await client.post(f"/api/items/{created['id']}/image?expected_revision=1", files={'file': ('test.jpg', image.getvalue(), 'image/jpeg')})).json()
            path = f"/api/items/{item['id']}"
            analysis = (await client.post(path + '/analysis', json={'expected_revision': item['revision']})).json()
            rejected = await client.patch(path, json={**facts, 'status': 'available', 'value_minor': 4201, 'expected_revision': item['revision'], 'analysis_id': analysis['analysis_id']})
            assert rejected.status_code == 422
            published = await client.patch(path, json={**facts, 'status': 'available', 'value_minor': 4200, 'expected_revision': item['revision'], 'analysis_id': analysis['analysis_id']})
            assert published.status_code == 200
            assert published.json()['value_basis'] == 'image_assisted_estimate'
            assert (await client.get(path)).json()['value_basis'] == 'image_assisted_estimate'
    asyncio.run(check())


@pytest.mark.parametrize('status', ['insufficient_evidence', 'clarification_required'])
def test_incomplete_analysis_keeps_draft_private_and_allows_retry(monkeypatch, status):
    from backend.app.services.market_analysis import MarketAnalysis
    calls = []
    async def assess(self, facts, image):
        calls.append(1)
        return {'status': status, 'price_basis': 'market_comparables', 'estimate_minor': None,
                'attributes': {'description': 'Synthetic', 'clarification_questions': []}, 'evidence': []}
    monkeypatch.setattr(MarketAnalysis, 'analyze', assess)

    async def check():
        app = create_app(StateRepository(memory=True))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test', headers={'X-Bartr-Request': '1'}) as client:
            await client.post('/api/auth/register', json={'username': 'retryuser', 'password': 'synthetic-password', 'name': 'User', 'community': 'Test'})
            facts = {'title': 'Lamp', 'description': 'Used lamp', 'category': 'Furniture', 'condition': 'Good', 'value_minor': None, 'status': 'draft'}
            item = (await client.post('/api/items', json=facts)).json()
            image = BytesIO(); Image.new('RGB', (80, 80), 'tan').save(image, 'JPEG')
            item = (await client.post(f"/api/items/{item['id']}/image?expected_revision=1", files={'file': ('test.jpg', image.getvalue(), 'image/jpeg')})).json()
            path = f"/api/items/{item['id']}"
            first = (await client.post(path + '/analysis', json={'expected_revision': item['revision']})).json()
            assert first['status'] == status and first['estimate_minor'] is None
            rejected = await client.patch(path, json={**facts, 'status': 'available', 'value_minor': 4000, 'expected_revision': item['revision'], 'analysis_id': first['analysis_id']})
            assert rejected.status_code == 422 and rejected.json()['code'] == 'EVALUATION_REQUIRED'
            assert (await client.get(path)).json()['status'] == 'draft'
            await client.post(path + '/analysis', json={'expected_revision': item['revision']})
            assert len(calls) == 2
    asyncio.run(check())


def test_api_account_draft_photo_publication_and_private_access():
    async def check():
        app=create_app(StateRepository(memory=True))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers={'X-Bartr-Request':'1'}) as alice, httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers={'X-Bartr-Request':'1'}) as bob:
            assert (await alice.get('/api/me')).status_code==401
            for client,name in [(alice,'alice'),(bob,'brian')]:
                response=await client.post('/api/auth/register',json={'username':name,'password':'secure-passphrase','name':name,'community':'Tempe'})
                assert response.status_code==200 and 'password_hash' not in response.json()
                assert 'httponly' in response.headers['set-cookie'].lower()
            data={'title':'Chair','description':'Wooden chair','category':'Furniture','condition':'Good','value_minor':4000,'status':'draft'}
            created=(await alice.post('/api/items',json=data)).json()
            assert (await bob.get('/api/me')).json()['items']==[]
            forbidden=await bob.patch('/api/items/'+created['id'],json={**data,'expected_revision':1})
            assert forbidden.status_code==404
            missing=await alice.patch('/api/items/'+created['id'],json={**data,'status':'available','expected_revision':1})
            assert missing.status_code==422
            image=BytesIO();Image.new('RGB',(80,80),'tan').save(image,'JPEG')
            uploaded=await alice.post('/api/items/'+created['id']+'/image?expected_revision=1',files={'file':('phone.jpeg',image.getvalue(),'image/jpeg')})
            assert uploaded.status_code==200
            item=uploaded.json();assert item['revision']==2 and item['image_id']
            assert (await bob.get('/api/images/'+item['image_id'])).status_code==404
            actor=(await alice.get('/api/me')).json()['profile']['id']
            reviewed=app.state.marketplace.review_analysis(actor,item['id'],2,{'status':'estimated','price_basis':'market_comparables','estimate_minor':4000,'uncertainty':'high'})
            published=await alice.patch('/api/items/'+item['id'],json={**data,'status':'available','expected_revision':2,'analysis_id':reviewed['analysis']['analysis_id']})
            assert published.status_code==200
            assert len((await bob.get('/api/me')).json()['items'])==1
            assert (await bob.get('/api/images/'+item['image_id'])).status_code==200
            invalid=await alice.post('/api/items',json={**data,'value_minor':0})
            assert invalid.status_code==422
            csrf=await alice.post('/api/auth/login',headers={'X-Bartr-Request':'0'},json={'username':'alice','password':'secure-passphrase'})
            assert csrf.status_code==403
            bad_origin=await alice.post('/api/auth/login',headers={'Origin':'https://elsewhere.example'},json={'username':'alice','password':'secure-passphrase'})
            assert bad_origin.status_code==403
            assert (await alice.post('/api/auth/logout',json={})).status_code==200
            assert (await alice.get('/api/me')).status_code==401
    asyncio.run(check())


def test_json_api_mode_persists_account_and_session_across_restart(tmp_path):
    async def check():
        path=tmp_path/'bartr.json'
        first=create_app(StateRepository(json_path=path))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=first),base_url='http://test',headers={'X-Bartr-Request':'1'}) as client:
            registered=await client.post('/api/auth/register',json={
                'username':'json-user','password':'secure-passphrase','name':'JSON User','community':'Tempe'
            })
            assert registered.status_code==200
            cookie=client.cookies.get('bartr_session')
            assert cookie
        restarted=create_app(StateRepository(json_path=path))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=restarted),base_url='http://test',headers={'X-Bartr-Request':'1'},cookies={'bartr_session':cookie}) as client:
            response=await client.get('/api/me')
            assert response.status_code==200
            assert response.json()['storage']=='temporary-json'
            assert response.json()['profile']['username']=='json-user'
    asyncio.run(check())
