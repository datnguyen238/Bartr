from copy import deepcopy
from types import SimpleNamespace

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
