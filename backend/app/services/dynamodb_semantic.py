"""Bounded DynamoDB semantic candidate generation; domain checks remain authoritative."""
from concurrent.futures import ThreadPoolExecutor
from math import isfinite, sqrt

from ..errors import AppError
from ..domain import INTEREST_CATEGORIES
from .embeddings import BedrockEmbeddings

MAX_ITEMS = 30
MAX_TERMS = 40
# Provisional Titan V2 256-dimensional thresholds; validate against labeled data.
MATCH_THRESHOLD = 0.23
EXCLUSION_THRESHOLD = 0.30


def similarity(left, right):
    if len(left) != len(right) or not left or not all(isfinite(x) for x in left + right):
        raise AppError('A semantic projection is incompatible. Retry indexing.', 'INVALID_EMBEDDING', 503)
    norm = sqrt(sum(x*x for x in left) * sum(x*x for x in right))
    if norm == 0:
        raise AppError('A semantic projection is empty. Retry indexing.', 'INVALID_EMBEDDING', 503)
    return sum(x*y for x, y in zip(left, right)) / norm


class DynamoSemanticSearch:
    def __init__(self, repository):
        self.repo = repository
        self.embeddings = BedrockEmbeddings()

    def _valid(self, projection, revision, count):
        return bool(projection and projection.get('revision') == revision and
                    projection.get('model') == self.embeddings.model and
                    projection.get('dimensions') == self.embeddings.dimensions and
                    len(projection.get('vectors', [])) == count and
                    all(len(vector) == self.embeddings.dimensions for vector in projection['vectors']))

    def _projection(self, kind, entity_id, revision, texts):
        cached = self.repo.semantic_projection(kind, entity_id)
        if self._valid(cached, revision, len(texts)):
            return cached['vectors']
        vectors = [self.embeddings.embed(text)['vector'] for text in texts]
        projection = {'revision': revision, 'model': self.embeddings.model,
                      'dimensions': self.embeddings.dimensions, 'vectors': vectors}
        self.repo.save_semantic_projection(kind, entity_id, projection)
        return vectors

    def index_item(self, item, community):
        if item['status'] != 'available':
            raise AppError('Only available listings can be indexed.', 'INVALID_ITEM_STATUS', 422)
        text = ' '.join(str(item.get(k, '')) for k in ('title', 'description', 'category', 'condition'))
        self._projection('ITEM', item['id'], item['revision'], [text])
        current = self.repo.read()['items'].get(item['id'])
        if not current or current['revision'] != item['revision'] or current['status'] != 'available':
            raise AppError('Listing changed during indexing. Retry its current revision.', 'STALE_EMBEDDING', 409)
        return {'indexed': True, 'revision': item['revision']}

    def candidates(self, state, actor):
        if not self.embeddings.configured:
            raise AppError('Configure Bedrock embeddings before using semantic matching.', 'EMBEDDINGS_NOT_CONFIGURED', 503)
        users, items = state['users'], state['items']
        me = users[actor]
        available = [item for item in items.values() if item['status'] == 'available']
        owners = {item['owner'] for item in available} | {actor}
        participants = [users[owner] for owner in sorted(owners) if users[owner]['interests']]
        if len(available) > MAX_ITEMS or sum(len(u['interests']) + len(u['exclusions']) for u in participants) > MAX_TERMS:
            raise AppError('Too many listings or preferences for semantic matching. Use exact matching for now.', 'SEMANTIC_CAPACITY', 503)

        jobs = [('ITEM', item['id'], item['revision'], [' '.join(str(item.get(k, '')) for k in ('title', 'description', 'category', 'condition'))]) for item in available]
        jobs += [('PREFERENCES', user['id'], user['revision'], user['interests'] + user['exclusions']) for user in participants]
        with ThreadPoolExecutor(max_workers=4) as pool:
            vectors = list(pool.map(lambda job: self._projection(*job), jobs))
        item_vectors = {item['id']: vector[0] for item, vector in zip(available, vectors[:len(available)])}
        prefs = {user['id']: vector for user, vector in zip(participants, vectors[len(available):])}

        latest = self.repo.read()
        current_items = {item['id']: item['revision'] for item in latest['items'].values() if item['status'] == 'available'}
        if current_items != {item['id']: item['revision'] for item in available} or any(
            user['id'] not in latest['users'] or latest['users'][user['id']]['revision'] != user['revision'] for user in participants
        ):
            raise AppError('Listings or preferences changed during matching. Retry.', 'STALE_EMBEDDING', 409)

        relevant, excluded = {}, {}
        for user in participants:
            interest_count = len(user['interests'])
            interest_vectors = prefs[user['id']][:interest_count]
            exclusion_vectors = prefs[user['id']][interest_count:]
            candidates = [item for item in available if item['owner'] != user['id']]
            excluded[user['id']] = {item['id'] for item in candidates if any(similarity(item_vectors[item['id']], vector) >= EXCLUSION_THRESHOLD for vector in exclusion_vectors)}
            relevant[user['id']] = {item['id'] for item in candidates if item['id'] not in excluded[user['id']] and any(
                str(item.get('category', '')).strip().casefold() == term.strip().casefold()
                if term.strip().casefold() in INTEREST_CATEGORIES
                else similarity(item_vectors[item['id']], vector) >= MATCH_THRESHOLD
                for term, vector in zip(user['interests'], interest_vectors))}
        return latest, relevant, excluded
