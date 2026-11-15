"""Atomic MVP aggregate; images and vector projections are separate documents."""
from copy import deepcopy
import os
from threading import RLock

from ..errors import AppError


def empty_state():
    return {'users': {}, 'sessions': {}, 'items': {}, 'trades': {}, 'dismissals': {}, 'commands': {}, 'valuations': {}}


class StateRepository:
    def __init__(self, memory=False):
        self.lock = RLock()
        self.memory = memory
        self.state = empty_state()
        self.images = {}
        self.client = None
        self.db = None

    def database(self):
        if self.db is None:
            from pymongo import MongoClient
            uri = os.getenv('MONGODB_URI')
            if not uri:
                raise AppError('Configure MONGODB_URI, or explicitly select BARTR_STORAGE=memory for a temporary local test.', 'DATABASE_NOT_CONFIGURED', 503)
            self.client = MongoClient(uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
            self.db = self.client[os.getenv('MONGODB_DATABASE', 'bartr')]
            self.db.marketplace.update_one({'_id': 'marketplace'}, {'$setOnInsert': {'revision': 0, 'state': empty_state()}}, upsert=True)
        return self.db

    def read(self):
        with self.lock:
            if self.memory:
                return deepcopy(self.state)
            return self.database().marketplace.find_one({'_id': 'marketplace'})['state']

    def mutate(self, operation):
        with self.lock:
            if self.memory:
                next_state = deepcopy(self.state)
                result = operation(next_state)
                self.state = next_state
                return deepcopy(result)
            from bson import BSON
            db = self.database()
            for _ in range(8):
                current = db.marketplace.find_one({'_id': 'marketplace'})
                state = current['state']
                result = operation(state)
                document = {'_id': 'marketplace', 'revision': current['revision'] + 1, 'state': state}
                if len(BSON.encode(document)) > 14_000_000:
                    raise AppError('This MVP database aggregate reached its capacity. Contact the maintainer; no changes were saved.', 'CAPACITY_LIMIT', 503)
                saved = db.marketplace.replace_one({'_id': 'marketplace', 'revision': current['revision']}, document)
                if saved.modified_count:
                    return result
            raise AppError('Another action changed the marketplace. Reload to check the authoritative result before retrying.', 'RETRY_CONFLICT', 409)

    def put_image(self, image_id, owner, image):
        record = {'_id': image_id, 'owner': owner, 'data': image['data'], 'mime_type': image['mime_type']}
        if self.memory:
            self.images[image_id] = record
        else:
            self.database().images.insert_one(record)

    def image(self, image_id):
        return self.images.get(image_id) if self.memory else self.database().images.find_one({'_id': image_id})

    def delete_image(self, image_id):
        if self.memory:
            self.images.pop(image_id, None)
        else:
            self.database().images.delete_one({'_id': image_id})

    def close(self):
        if self.client:
            self.client.close()
