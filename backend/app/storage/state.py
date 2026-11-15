"""Atomic MVP aggregate with explicit Mongo, memory, and local JSON modes."""
from base64 import b64decode, b64encode
from copy import deepcopy
import json
import os
from pathlib import Path
from threading import RLock
from tempfile import mkstemp

from ..errors import AppError


JSON_SCHEMA_VERSION = 1
DEFAULT_JSON_MAX_BYTES = 64 * 1024 * 1024


def empty_state():
    return {'users': {}, 'sessions': {}, 'items': {}, 'trades': {}, 'dismissals': {}, 'commands': {}, 'valuations': {}}


class StateRepository:
    def __init__(self, memory=False, json_path=None):
        if memory and json_path is not None:
            raise ValueError('Choose memory or JSON storage, not both.')
        self.lock = RLock()
        self.memory = memory
        self.json_path = Path(json_path).expanduser().resolve() if json_path is not None else None
        self.mode = 'memory' if memory else 'json' if self.json_path is not None else 'mongo'
        self.state = empty_state()
        self.images = {}
        self.client = None
        self.db = None
        if self.mode == 'json':
            self._ensure_json_document()

    @property
    def storage_label(self):
        return {'memory': 'temporary-memory', 'json': 'temporary-json', 'mongo': 'mongodb'}[self.mode]

    @property
    def supports_atlas(self):
        return self.mode == 'mongo'

    def _empty_json_document(self):
        return {'schema_version': JSON_SCHEMA_VERSION, 'revision': 0, 'state': empty_state(), 'images': {}}

    def _validate_json_document(self, document):
        if not isinstance(document, dict) or document.get('schema_version') != JSON_SCHEMA_VERSION:
            raise AppError('The temporary JSON database has an unsupported schema version. Restore a compatible file or choose another path.', 'JSON_STORAGE_SCHEMA_MISMATCH', 503)
        if type(document.get('revision')) is not int or document['revision'] < 0:
            raise AppError('The temporary JSON database revision is invalid. Restore the last complete file.', 'JSON_STORAGE_CORRUPT', 503)
        state = document.get('state')
        images = document.get('images')
        required = set(empty_state())
        if not isinstance(state, dict) or not required <= set(state) or any(not isinstance(state[key], dict) for key in required) or not isinstance(images, dict):
            raise AppError('The temporary JSON database structure is invalid. Restore the last complete file.', 'JSON_STORAGE_CORRUPT', 503)
        return document

    def _read_json_document(self):
        try:
            with self.json_path.open('r', encoding='utf-8') as handle:
                document = json.load(handle)
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise AppError('The temporary JSON database is unreadable or corrupt. Restore it or choose another BARTR_JSON_PATH; it was not reset.', 'JSON_STORAGE_CORRUPT', 503) from exc
        return self._validate_json_document(document)

    def _write_json_document(self, document):
        self._validate_json_document(document)
        try:
            payload = json.dumps(document, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False).encode('utf-8') + b'\n'
        except (TypeError, ValueError) as exc:
            raise AppError('A value could not be represented in the temporary JSON database. No changes were saved.', 'JSON_STORAGE_INVALID_VALUE', 503) from exc
        try:
            maximum = int(os.getenv('BARTR_JSON_MAX_BYTES', str(DEFAULT_JSON_MAX_BYTES)))
        except ValueError as exc:
            raise AppError('BARTR_JSON_MAX_BYTES must be a positive integer.', 'JSON_STORAGE_CONFIG_INVALID', 503) from exc
        if maximum <= 0:
            raise AppError('BARTR_JSON_MAX_BYTES must be a positive integer.', 'JSON_STORAGE_CONFIG_INVALID', 503)
        if len(payload) > maximum:
            raise AppError('The temporary JSON database reached its configured capacity. No changes were saved.', 'CAPACITY_LIMIT', 503)
        parent = self.json_path.parent
        descriptor = None
        temporary = None
        try:
            parent.mkdir(parents=True, exist_ok=True)
            descriptor, temporary = mkstemp(prefix=f'.{self.json_path.name}.', suffix='.tmp', dir=parent)
            os.chmod(temporary, 0o600)
            with os.fdopen(descriptor, 'wb') as handle:
                descriptor = None
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self.json_path)
            temporary = None
        except OSError as exc:
            raise AppError('The temporary JSON database could not be saved. Its last complete file remains authoritative.', 'JSON_STORAGE_UNAVAILABLE', 503) from exc
        finally:
            if descriptor is not None:
                try:
                    os.close(descriptor)
                except OSError:
                    pass
            if temporary is not None:
                try:
                    os.unlink(temporary)
                except OSError:
                    pass

    def _ensure_json_document(self):
        with self.lock:
            if self.json_path.exists():
                self._read_json_document()
            else:
                self._write_json_document(self._empty_json_document())

    def _mutate_json_document(self, operation):
        document = self._read_json_document()
        next_document = deepcopy(document)
        result = operation(next_document)
        next_document['revision'] = document['revision'] + 1
        self._write_json_document(next_document)
        return deepcopy(result)

    def database(self):
        if not self.supports_atlas:
            raise AppError('MongoDB Atlas is unavailable in temporary storage mode.', 'ATLAS_REQUIRED', 503)
        if self.db is None:
            from pymongo import MongoClient
            uri = os.getenv('MONGODB_URI')
            if not uri:
                raise AppError('Configure MONGODB_URI, or explicitly select BARTR_STORAGE=json or memory for a temporary local test.', 'DATABASE_NOT_CONFIGURED', 503)
            self.client = MongoClient(uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
            self.db = self.client[os.getenv('MONGODB_DATABASE', 'bartr')]
            self.db.marketplace.update_one({'_id': 'marketplace'}, {'$setOnInsert': {'revision': 0, 'state': empty_state()}}, upsert=True)
        return self.db

    def read(self):
        with self.lock:
            if self.memory:
                return deepcopy(self.state)
            if self.mode == 'json':
                return deepcopy(self._read_json_document()['state'])
            return self.database().marketplace.find_one({'_id': 'marketplace'})['state']

    def mutate(self, operation):
        with self.lock:
            if self.memory:
                next_state = deepcopy(self.state)
                result = operation(next_state)
                self.state = next_state
                return deepcopy(result)
            if self.mode == 'json':
                return self._mutate_json_document(lambda document: operation(document['state']))
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
        elif self.mode == 'json':
            encoded = {**record, 'data': b64encode(record['data']).decode('ascii')}
            with self.lock:
                self._mutate_json_document(lambda document: document['images'].__setitem__(image_id, encoded))
        else:
            self.database().images.insert_one(record)

    def image(self, image_id):
        if self.memory:
            return self.images.get(image_id)
        if self.mode == 'json':
            with self.lock:
                record = self._read_json_document()['images'].get(image_id)
            if record is None:
                return None
            try:
                return {**record, 'data': b64decode(record['data'], validate=True)}
            except (ValueError, TypeError) as exc:
                raise AppError('An image record in the temporary JSON database is corrupt.', 'JSON_STORAGE_CORRUPT', 503) from exc
        return self.database().images.find_one({'_id': image_id})

    def delete_image(self, image_id):
        if self.memory:
            self.images.pop(image_id, None)
        elif self.mode == 'json':
            with self.lock:
                self._mutate_json_document(lambda document: document['images'].pop(image_id, None))
        else:
            self.database().images.delete_one({'_id': image_id})

    def close(self):
        if self.client:
            self.client.close()
