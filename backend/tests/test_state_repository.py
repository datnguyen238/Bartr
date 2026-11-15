from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
import json
from types import SimpleNamespace

import pytest

from backend.app.errors import AppError
from backend.app.storage.state import StateRepository, empty_state


def test_mongo_compare_and_swap_retries_without_losing_other_write():
    class Collection:
        def __init__(self):
            self.doc={'_id':'marketplace','revision':0,'state':empty_state()}
            self.first=True
        def find_one(self, query): return deepcopy(self.doc)
        def replace_one(self, query, replacement):
            if self.first:
                self.first=False
                self.doc['revision']+=1
                self.doc['state']['users']['other']={'id':'other'}
                return SimpleNamespace(modified_count=0)
            assert query['revision']==self.doc['revision']
            self.doc=deepcopy(replacement)
            return SimpleNamespace(modified_count=1)
    collection=Collection()
    repository=StateRepository()
    repository.db=SimpleNamespace(marketplace=collection)
    def operation(state):
        state['users']['mine']={'id':'mine'}
        return state['users']['mine']
    assert repository.mutate(operation)=={'id':'mine'}
    assert set(repository.read()['users'])=={'other','mine'}
    assert collection.doc['revision']==2


def test_json_repository_persists_across_restart_and_reports_mode(tmp_path):
    path=tmp_path/'bartr.json'
    first=StateRepository(json_path=path)
    assert first.storage_label=='temporary-json'
    assert first.supports_atlas is False
    first.mutate(lambda state: state['users'].update({'alice':{'id':'alice'}}))
    second=StateRepository(json_path=path)
    assert second.read()['users']=={'alice':{'id':'alice'}}
    document=json.loads(path.read_text())
    assert document['schema_version']==1
    assert document['revision']==1


def test_json_repository_rejected_mutation_leaves_last_document(tmp_path):
    path=tmp_path/'bartr.json'
    repository=StateRepository(json_path=path)
    before=path.read_bytes()
    def reject(state):
        state['users']['partial']={'id':'partial'}
        raise AppError('Rejected.','REJECTED',422)
    with pytest.raises(AppError) as exc:
        repository.mutate(reject)
    assert exc.value.code=='REJECTED'
    assert path.read_bytes()==before
    assert repository.read()['users']=={}


def test_json_repository_image_round_trip_and_delete(tmp_path):
    path=tmp_path/'bartr.json'
    repository=StateRepository(json_path=path)
    repository.put_image('image-1','alice',{'data':b'not-a-real-photo','mime_type':'image/jpeg'})
    assert repository.image('image-1')=={
        '_id':'image-1','owner':'alice','data':b'not-a-real-photo','mime_type':'image/jpeg'
    }
    StateRepository(json_path=path).delete_image('image-1')
    assert repository.image('image-1') is None


def test_json_repository_corrupt_and_unknown_schema_fail_closed(tmp_path):
    corrupt=tmp_path/'corrupt.json'
    corrupt.write_text('{not-json')
    with pytest.raises(AppError) as invalid:
        StateRepository(json_path=corrupt)
    assert invalid.value.code=='JSON_STORAGE_CORRUPT'
    mismatch=tmp_path/'future.json'
    mismatch.write_text(json.dumps({'schema_version':2,'revision':0,'state':empty_state(),'images':{}}))
    with pytest.raises(AppError) as unknown:
        StateRepository(json_path=mismatch)
    assert unknown.value.code=='JSON_STORAGE_SCHEMA_MISMATCH'


def test_json_repository_unwritable_location_fails_without_fallback(tmp_path):
    blocked=tmp_path/'not-a-directory'
    blocked.write_text('occupied')
    with pytest.raises(AppError) as unavailable:
        StateRepository(json_path=blocked/'bartr.json')
    assert unavailable.value.code=='JSON_STORAGE_UNAVAILABLE'


def test_json_repository_serializes_threads_without_lost_updates(tmp_path):
    path=tmp_path/'bartr.json'
    repository=StateRepository(json_path=path)
    def increment(_):
        def operation(state):
            value=state['commands'].get('count',0)+1
            state['commands']['count']=value
            return value
        return repository.mutate(operation)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(increment,range(40)))
    assert sorted(results)==list(range(1,41))
    assert repository.read()['commands']['count']==40
    assert json.loads(path.read_text())['revision']==40
