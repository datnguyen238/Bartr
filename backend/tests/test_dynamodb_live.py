"""Explicit opt-in integration check against existing table; only synthetic scoped keys.

BARTR_LIVE_DYNAMODB=1 AWS_PROFILE=bartr-dev AWS_REGION=us-east-1 \
  python -m pytest backend/tests/test_dynamodb_live.py -q
"""
import os
from uuid import uuid4

import boto3
from botocore.config import Config
import pytest
from fastapi.testclient import TestClient

from backend.app.domain import Marketplace
from backend.app.main import create_app
from backend.app.errors import AppError
from backend.app.storage.dynamodb import DynamoRepository
from backend.tests.test_dynamodb import overlapping, propose, setup_market

pytestmark = pytest.mark.skipif(os.getenv('BARTR_LIVE_DYNAMODB') != '1', reason='Explicit live DynamoDB opt-in required')


def test_real_existing_table_writes_contention_restart_and_cleanup(monkeypatch):
    monkeypatch.setenv('DYNAMODB_TABLE', 'bartr-dev')
    monkeypatch.setenv('DYNAMODB_PARTITION_KEY', 'PK')
    monkeypatch.setenv('DYNAMODB_SORT_KEY', 'SK')
    client = boto3.Session(profile_name='bartr-dev', region_name='us-east-1').client('dynamodb',
        config=Config(retries={'max_attempts': 0}, connect_timeout=5, read_timeout=15))
    scope = f'TEST#{uuid4().hex}#'
    repo = DynamoRepository(client=client, scope=scope)
    try:
        http = TestClient(create_app(repo), headers={'X-Bartr-Request': '1'})
        credentials = {'username': 'http-test', 'password': 'synthetic-password'}
        created = http.post('/api/auth/register', json={**credentials, 'name': 'Synthetic User', 'community': 'Test campus'})
        assert created.status_code == 200 and 'httponly' in created.headers['set-cookie'].lower()
        assert http.get('/api/me').status_code == 200
        assert http.post('/api/auth/logout', json={}).status_code == 200
        assert http.get('/api/me').status_code == 401
        assert http.post('/api/auth/login', json={**credentials, 'password': 'incorrect-password'}).status_code == 401
        assert http.post('/api/auth/login', json=credentials).status_code == 200
        assert http.get('/api/me').json()['profile']['username'] == credentials['username']
        assert http.post('/api/auth/logout', json={}).status_code == 200
        # Force both acceptors to decide from the same snapshot in separate instances.
        overlapping(repo, simultaneous=True)
        restarted = DynamoRepository(client=client, scope=scope)
        assert restarted.read() == repo.read()
        token, profile = Marketplace(restarted).login('alice', 'synthetic-password')
        assert Marketplace(restarted).authenticate(token) == profile['id']
        Marketplace(restarted).logout(token)
        with pytest.raises(AppError):
            Marketplace(restarted).authenticate(token)
        users = list(repo.read()['users'])
        assert sum(len(restarted.user_items(actor)) for actor in users) == 4
        # Verify release and completion against the live authoritative records.
        state = repo.read()
        winner = next(t for t in state['trades'].values() if t['status'] == 'agreed')
        app = Marketplace(repo)
        a, b = winner['participants']
        app.action(a, winner['id'], winner['revision'], 'cancel', uuid4().hex)
        assert all(i['status'] == 'available' for i in repo.read()['items'].values())
        terms = winner['offers'][-1]['terms']
        next_trade = app.create_trade(a, b, [x['id'] for x in terms['left']], [x['id'] for x in terms['right']], False, uuid4().hex)
        key = uuid4().hex
        agreed = app.action(b, next_trade['id'], 1, 'accept', key)
        assert app.action(b, next_trade['id'], 1, 'accept', key) == agreed
        app.action(a, next_trade['id'], 2, 'handoff', uuid4().hex)
        app.action(b, next_trade['id'], 3, 'handoff', uuid4().hex)
        assert repo.read()['trades'][next_trade['id']]['status'] == 'completed'
    finally:
        # No full-table deletes: fetch only this random test scope, then condition each delete.
        params = dict(TableName=repo.table, ConsistentRead=True,
            FilterExpression='begins_with(#pk, :scope)', ProjectionExpression='PK, SK',
            ExpressionAttributeNames={'#pk': 'PK'}, ExpressionAttributeValues={':scope': {'S': scope}})
        keys = []
        while True:
            page = client.scan(**params); keys.extend(page.get('Items', []))
            if not page.get('LastEvaluatedKey'): break
            params['ExclusiveStartKey'] = page['LastEvaluatedKey']
        for key in keys:
            assert key['PK']['S'].startswith(scope)
            client.delete_item(TableName=repo.table, Key=key,
                ConditionExpression='#scope = :scope', ExpressionAttributeNames={'#scope': '_scope'},
                ExpressionAttributeValues={':scope': {'S': scope}})
        # A strong scan verifies cleanup without printing private rows.
        params.pop('ExclusiveStartKey', None)
        while True:
            page = client.scan(**params)
            assert not page.get('Items'), 'Synthetic test cleanup left records; do not run application against test scope.'
            if not page.get('LastEvaluatedKey'): break
            params['ExclusiveStartKey'] = page['LastEvaluatedKey']
        client.close()
