"""DynamoDB emulator tests. No application server or external providers."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from threading import Barrier
from uuid import uuid4

import boto3
from botocore.exceptions import ClientError, ReadTimeoutError
from moto import mock_aws
import pytest

from backend.app.domain import Marketplace
from backend.app.errors import AppError
from backend.app.storage.dynamodb import DynamoRepository, decode
from backend.app.storage.dynamodb_records import canonical


def test_offer_hash_serialization_survives_dynamodb_numeric_normalization():
    assert canonical({'gap_percent': 0.0, 'values': [20.0, 1.5]}) == canonical(
        {'gap_percent': 0, 'values': [20, 1.5]})


@pytest.fixture
def repo(monkeypatch):
    monkeypatch.setenv('DYNAMODB_TABLE', 'test-bartr')
    monkeypatch.setenv('DYNAMODB_PARTITION_KEY', 'PK')
    monkeypatch.setenv('DYNAMODB_SORT_KEY', 'SK')
    with mock_aws():
        client = boto3.client('dynamodb', region_name='us-east-1', aws_access_key_id='testing', aws_secret_access_key='testing')
        client.create_table(TableName='test-bartr', KeySchema=[{'AttributeName': 'PK', 'KeyType': 'HASH'}, {'AttributeName': 'SK', 'KeyType': 'RANGE'}],
            AttributeDefinitions=[{'AttributeName': k, 'AttributeType': 'S'} for k in ('PK', 'SK')], BillingMode='PAY_PER_REQUEST')
        yield DynamoRepository(client=client)


def setup_market(repo):
    app = Marketplace(repo)
    actors = [app.register(name, 'synthetic-password', name, 'Test campus')['id'] for name in ('alice', 'brian', 'carol')]
    ids = []
    for actor, title, value in [(actors[0], 'chair', 4000), (actors[0], 'calculator', 2000), (actors[1], 'monitor', 6000), (actors[2], 'screen', 6000)]:
        ids.append(app.save_item(actor, None, None, dict(title=title, description=title, category=title,
            condition='Good', image_id='synthetic', value_minor=value, status='available'))['id'])
    return app, actors, ids


def propose(app, actors, ids):
    return app.create_trade(actors[0], actors[1], ids[:2], [ids[2]], False, uuid4().hex)


def test_normalized_restart_multiple_products_queries_and_session(repo):
    app, actors, ids = setup_market(repo)
    t = propose(app, actors, ids)
    before = repo.read()
    restarted = DynamoRepository(client=repo.client)
    assert restarted.read() == before
    assert {x['id'] for x in restarted.user_items(actors[0])} == set(ids[:2])
    assert restarted.user_trades(actors[0]) == [t['id']]
    assert restarted.user_trades(actors[2]) == []
    assert restarted.item(actors[0], ids[0])['value_minor'] == 4000
    raw = repo.client.get_item(TableName=repo.table, Key=repo.entity_key(f'USER#{actors[0]}', f'ITEM#{ids[0]}'))['Item']
    assert raw['value_cents'] == {'N': '4000'} and 'payload' not in raw
    token, _ = app.login('ALICE', 'synthetic-password')
    assert Marketplace(restarted).authenticate(token) == actors[0]
    app.logout(token)
    with pytest.raises(AppError): app.authenticate(token)


def test_version_consent_immutable_terms_and_stale_approval(repo):
    app, actors, ids = setup_market(repo)
    t = propose(app, actors, ids)
    old = deepcopy(repo._get(f'TRADE#{t["id"]}', 'OFFER#0001'))
    counter = app.action(actors[1], t['id'], 1, 'counter', uuid4().hex, left=[ids[2]], right=ids[:2])
    assert counter['offers'][-1]['consents'] == [actors[1]]
    with pytest.raises(AppError): app.action(actors[0], t['id'], 1, 'accept', uuid4().hex)
    assert repo._get(f'TRADE#{t["id"]}', 'OFFER#0001') == old
    agreed = app.action(actors[0], t['id'], 2, 'accept', uuid4().hex)
    assert agreed['status'] == 'agreed'
    assert repo.read()['trades'][t['id']]['offers'][-1]['consents'] == actors[:2]
    assert repo._get(f'TRADE#{t["id"]}', 'OFFER#0001') == old
    with pytest.raises(AppError, match='immutable'):
        repo.mutate(lambda s: s['trades'][t['id']]['offers'][0]['terms'].update(gap_percent=99))


def test_reserve_replay_cancel_and_complete(repo):
    app, actors, ids = setup_market(repo)
    t = propose(app, actors, ids); key = uuid4().hex
    agreed = app.action(actors[1], t['id'], 1, 'accept', key)
    assert app.action(actors[1], t['id'], 1, 'accept', key) == agreed
    assert all(repo.item(owner, id)['reservation'] == t['id'] for owner, id in [(actors[0], ids[0]), (actors[0], ids[1]), (actors[1], ids[2])])
    app.action(actors[0], t['id'], 2, 'handoff', uuid4().hex)
    app.action(actors[0], t['id'], 3, 'cancel', uuid4().hex)
    assert repo.read()['items'][ids[0]]['status'] == 'reserved'
    app.action(actors[1], t['id'], 4, 'cancel', uuid4().hex)
    assert all(repo.read()['items'][id]['status'] == 'available' for id in ids)
    second = propose(app, actors, ids)
    app.action(actors[1], second['id'], 1, 'accept', uuid4().hex)
    app.action(actors[0], second['id'], 2, 'handoff', uuid4().hex)
    app.action(actors[1], second['id'], 3, 'handoff', uuid4().hex)
    assert all(repo.read()['items'][id]['status'] == 'exchanged' for id in ids[:3])


def overlapping(repo, *, simultaneous=False):
    app, actors, ids = setup_market(repo)
    first = propose(app, actors, ids)
    second = app.create_trade(actors[0], actors[2], ids[:2], [ids[3]], False, uuid4().hex)
    barrier = Barrier(2)
    def accept(pair):
        actor, id = pair
        independent = DynamoRepository(client=repo.client, scope=repo.scope)
        if simultaneous:
            original = independent._snapshot
            first_read = True
            def synced():
                nonlocal first_read
                result = original()
                if first_read:
                    first_read = False; barrier.wait(timeout=10)
                return result
            independent._snapshot = synced
        try:
            return Marketplace(independent).action(actor, id, 1, 'accept', uuid4().hex)['status']
        except AppError:
            return 'rejected'
    pairs = [(actors[1], first['id']), (actors[2], second['id'])]
    if simultaneous:
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(accept, pairs))
    else:
        outcomes = [accept(pair) for pair in pairs]
    assert sorted(outcomes) == ['agreed', 'rejected']
    state = repo.read()
    assert sorted(t['status'] for t in state['trades'].values()) == ['agreed', 'invalidated']
    winner = next(t for t in state['trades'].values() if t['status'] == 'agreed')
    reserved = {i['id'] for i in winner['offers'][-1]['terms']['left'] + winner['offers'][-1]['terms']['right']}
    assert {i['id'] for i in state['items'].values() if i['status'] == 'reserved'} == reserved


def test_overlapping_acceptance_independent_instances(repo):
    # Moto is not an actual concurrent transaction engine. AWS test below forces simultaneous snapshots.
    overlapping(repo)


def test_failed_item_condition_aborts_all_reservations(repo, monkeypatch):
    app, actors, ids = setup_market(repo); t = propose(app, actors, ids)
    before = repo.read(); original = repo.client.transact_write_items
    def inject(**params):
        for action in params['TransactItems']:
            put = action.get('Put', {})
            if put.get('Item', {}).get('entity_type') == {'S': 'ITEM'}:
                put['ExpressionAttributeValues'] = {':v': {'N': '999999'}}
                break
        return original(**params)
    monkeypatch.setattr(repo.client, 'transact_write_items', inject)
    with pytest.raises(AppError): app.action(actors[1], t['id'], 1, 'accept', uuid4().hex)
    assert repo.read() == before


def test_commit_unknown_replay_reconciles_without_duplicate(repo, monkeypatch):
    app, actors, ids = setup_market(repo); t = propose(app, actors, ids)
    original = repo.client.transact_write_items; key = uuid4().hex
    def lose_reply(**params):
        original(**params)
        raise ReadTimeoutError(endpoint_url='https://synthetic.invalid')
    monkeypatch.setattr(repo.client, 'transact_write_items', lose_reply)
    with pytest.raises(AppError) as error: app.action(actors[1], t['id'], 1, 'accept', key)
    assert error.value.code == 'COMMIT_UNRESOLVED'
    monkeypatch.setattr(repo.client, 'transact_write_items', original)
    assert app.action(actors[1], t['id'], 1, 'accept', key)['status'] == 'agreed'
    assert len(repo.read()['commands']) == 2


def test_capacity_and_vectors_reject_without_writes(repo):
    app, actors, ids = setup_market(repo); before = repo.read()
    with pytest.raises(AppError) as error:
        repo.mutate(lambda s: s['sessions'].update({str(n): {'actor': actors[0], 'expires': 1234} for n in range(101)}))
    assert error.value.code == 'CAPACITY_LIMIT' and repo.read() == before
    with pytest.raises(AppError) as error:
        repo.mutate(lambda s: s['users'][actors[0]].update(embedding={'vector': [1.0]}))
    assert error.value.code == 'SEPARATE_EMBEDDINGS_REQUIRED' and repo.read() == before


def test_scan_and_query_all_pages_even_empty_filtered_page(repo, monkeypatch):
    _, actors, ids = setup_market(repo)
    scan, query = repo.client.scan, repo.client.query
    monkeypatch.setattr(repo.client, 'scan', lambda **p: scan(**{**p, 'Limit': 1}))
    monkeypatch.setattr(repo.client, 'query', lambda **p: query(**{**p, 'Limit': 1}))
    assert len(repo.read()['items']) == 4
    assert len(repo.user_items(actors[0])) == 2


def test_legacy_state_is_not_silently_lost(repo):
    repo.client.put_item(TableName=repo.table, Item={**repo.key('STATE'), 'kind': {'S': 'bartr-state-v1'}})
    with pytest.raises(AppError) as error: repo.read()
    assert error.value.code == 'MIGRATION_REQUIRED'


def test_username_claim_is_unique_and_history_retained(repo):
    app, actors, ids = setup_market(repo)
    with pytest.raises(AppError): app.register(' ALICE ', 'synthetic-password', 'Other', 'Test campus')
    t = propose(app, actors, ids)
    app.action(actors[1], t['id'], 1, 'note', uuid4().hex, note='Synthetic private note')
    rows = repo._query(f'TRADE#{t["id"]}', 'EVENT#')
    assert len(rows) == 3 and sum(r['action'] == 'note' for r in rows.values()) == 1
    assert repo.read()['trades'][t['id']]['notes'][0]['text'] == 'Synthetic private note'


def test_chunked_image_roundtrip_and_delete(repo):
    raw = b'x' * (700 * 1024)
    repo.put_image('synthetic-photo', 'synthetic-owner', {'data': raw, 'mime_type': 'image/jpeg'})
    assert repo.image('synthetic-photo')['data'] == raw
    repo.delete_image('synthetic-photo')
    assert repo.image('synthetic-photo') is None
