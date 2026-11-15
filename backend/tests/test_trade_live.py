from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from backend.app.main import create_app
from backend.app.storage.state import StateRepository


def test_trade_live_authorization_updates_and_reconnect():
    app = create_app(StateRepository(memory=True))
    service = app.state.marketplace
    users = [service.register(n, 'synthetic-password', n, 'Tempe')['id'] for n in ('alice', 'brian', 'carol')]
    def item(owner, title):
        return service.save_item(owner, None, None, {'title': title, 'description': title, 'category': title,
            'condition': 'Good', 'image_id': 'synthetic', 'value_minor': 1000, 'status': 'available'})['id']
    trade = service.create_trade(users[0], users[1], [item(users[0], 'chair')], [item(users[1], 'desk')], False, uuid4().hex)
    tokens = [service.login(name, 'synthetic-password')[0] for name in ('alice', 'brian', 'carol')]
    path = f'/api/trades/{trade["id"]}/live'
    def headers(token, origin='http://localhost:3000'):
        return {'origin': origin, 'cookie': f'bartr_session={token}'}
    with TestClient(app) as client:
        for hdr in (headers(tokens[2]), headers(tokens[0], 'https://untrusted.example'), headers('invalid')):
            with pytest.raises(WebSocketDisconnect):
                with client.websocket_connect(path, headers=hdr):
                    pass
        with client.websocket_connect(path, headers=headers(tokens[1])) as ws:
            assert ws.receive_json()['revision'] == 1
            service.action(users[0], trade['id'], 1, 'note', uuid4().hex, note='Synthetic message')
            updated = ws.receive_json()
            assert updated['revision'] == 2 and updated['notes'][0]['text'] == 'Synthetic message'
        with client.websocket_connect(path, headers=headers(tokens[1])) as ws:
            assert ws.receive_json()['notes'][0]['text'] == 'Synthetic message'
            service.logout(tokens[1])
            with pytest.raises(WebSocketDisconnect):
                ws.receive_json()
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(path, headers=headers(tokens[1])):
                pass
