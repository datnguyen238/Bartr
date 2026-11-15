import asyncio
from io import BytesIO

import httpx
from PIL import Image

from backend.app.main import create_app
from backend.app.storage.state import StateRepository


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
            published=await alice.patch('/api/items/'+item['id'],json={**data,'status':'available','expected_revision':2})
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
