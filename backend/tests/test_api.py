import asyncio

import httpx
import pytest

from backend.app import main as app_module
from backend.app.main import create_app
from backend.app.storage import dynamodb


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


def test_json_storage_mode_is_selected_from_environment(monkeypatch,tmp_path):
    monkeypatch.setenv('BARTR_STORAGE','json')
    monkeypatch.setenv('BARTR_JSON_PATH',str(tmp_path/'bartr.json'))
    app=create_app()
    assert app.state.marketplace.repo.storage_label=='temporary-json'
    assert (tmp_path/'bartr.json').is_file()


@pytest.mark.parametrize('configured_path', [None, '.bartr/custom.json'])
def test_json_storage_paths_resolve_from_repository_root(monkeypatch,tmp_path,configured_path):
    monkeypatch.setattr(app_module,'application_name',lambda: 'Bartr')
    monkeypatch.setenv('BARTR_STORAGE','json')
    monkeypatch.setattr(app_module,'ROOT',tmp_path)
    unrelated=tmp_path/'unrelated-working-directory'
    unrelated.mkdir()
    monkeypatch.chdir(unrelated)
    if configured_path is None:
        monkeypatch.delenv('BARTR_JSON_PATH',raising=False)
    else:
        monkeypatch.setenv('BARTR_JSON_PATH',configured_path)

    app=create_app()
    expected=tmp_path/(configured_path or '.bartr/bartr.local.json')
    assert app.state.marketplace.repo.json_path==expected
    assert expected.is_file()
    assert not (unrelated/'.bartr').exists()


@pytest.mark.parametrize('mode,storage', [('memory','temporary-memory'),('mongo','mongodb')])
def test_explicit_repository_modes_remain_available_without_database_access(monkeypatch,mode,storage):
    monkeypatch.setenv('BARTR_STORAGE',mode)
    app=create_app()
    repository=app.state.marketplace.repo
    assert repository.storage_label==storage
    assert repository.db is None
    assert repository.client is None


@pytest.mark.parametrize('mode', [None,'dynamodb'])
def test_dynamodb_is_default_and_explicitly_selectable_without_network(monkeypatch,mode):
    monkeypatch.setattr(app_module,'application_name',lambda: 'Bartr')
    if mode is None:
        monkeypatch.delenv('BARTR_STORAGE',raising=False)
    else:
        monkeypatch.setenv('BARTR_STORAGE',mode)
    repository=object()
    monkeypatch.setattr(dynamodb,'DynamoRepository',lambda: repository)
    assert create_app().state.marketplace.repo is repository


@pytest.mark.parametrize('mode', ['memory','mongo','json','dynamodb'])
def test_injected_repository_takes_precedence_over_valid_storage_selection(monkeypatch,mode):
    monkeypatch.setenv('BARTR_STORAGE',mode)
    def unexpected_construction(*args,**kwargs):
        pytest.fail('Injected repositories must not initialize configured storage.')
    monkeypatch.setattr(app_module,'StateRepository',unexpected_construction)
    monkeypatch.setattr(dynamodb,'DynamoRepository',unexpected_construction)
    repository=object()
    assert create_app(repository).state.marketplace.repo is repository


def test_invalid_storage_mode_is_rejected_without_fallback(monkeypatch):
    monkeypatch.setenv('BARTR_STORAGE','unknown')
    with pytest.raises(ValueError,match='dynamodb, mongo, json or memory'):
        create_app()
