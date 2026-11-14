import asyncio

import httpx

from backend.app.main import create_app


def test_health_contract(monkeypatch):
    monkeypatch.setenv('APP_NAME', 'Bartr')

    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url='http://test') as client:
            response = await client.get('/api/health')
            assert response.status_code == 200
            assert response.json() == {'status': 'ok', 'service': 'Bartr'}
            assert '/api/health' in (await client.get('/openapi.json')).json()['paths']

    asyncio.run(check())


def test_unknown_api_endpoint_is_not_a_success():
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_app()), base_url='http://test') as client:
            assert (await client.get('/api/missing')).status_code == 404

    asyncio.run(check())
