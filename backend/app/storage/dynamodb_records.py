"""Pure normalized schema mapping; the existing domain/API shape stays unchanged."""
from copy import deepcopy
from hashlib import sha256
import json

from ..errors import AppError
from .state import empty_state

IMMUTABLE = {'OFFER', 'CONSENT', 'EVENT', 'LOGIN', 'COMMAND'}
ALIASES = {'id': 'user_id', 'community': 'community_id'}
PREFERENCES = {'interests', 'exclusions', 'gap_limit'}


def canonical(value):
    def normalize(item):
        if isinstance(item, float) and item.is_integer():
            return int(item)
        if isinstance(item, list):
            return [normalize(x) for x in item]
        if isinstance(item, dict):
            return {k: normalize(v) for k, v in item.items()}
        return item
    return json.dumps(normalize(value), sort_keys=True, separators=(',', ':'), allow_nan=False)


def rename(value, mapping):
    return {mapping.get(k, k): deepcopy(v) for k, v in value.items()}


def records(state):
    rows = {}

    def add(pk, sk, kind, value):
        if (pk, sk) in rows:
            raise AppError('Duplicate persistent entity identity.', 'INVALID_STATE', 503)
        rows[pk, sk] = {'entity_type': kind, **deepcopy(value)}

    for id, user in state['users'].items():
        if 'embedding' in user:
            raise AppError('Export embeddings separately before importing trading state.', 'SEPARATE_EMBEDDINGS_REQUIRED', 503)
        pk = f'USER#{id}'
        add(pk, 'PROFILE', 'PROFILE', rename({k: v for k, v in user.items() if k not in PREFERENCES}, ALIASES))
        prefs = {k: user[k] for k in PREFERENCES if k in user}
        gap = prefs.pop('gap_limit', 20)
        prefs.update(user_id=id, max_value_gap_bps=gap * 100, max_bundle_items=3, revision=user['revision'])
        add(pk, 'PREFERENCES', 'PREFERENCES', prefs)
        normalized = user['username'].strip().casefold()
        add(f'LOGIN#{sha256(normalized.encode()).hexdigest()}', 'DETAILS', 'LOGIN', {'user_id': id})
    for id, item in state['items'].items():
        if 'embedding' in item:
            raise AppError('Keep vector projections outside trading state.', 'SEPARATE_EMBEDDINGS_REQUIRED', 503)
        add(f'USER#{item["owner"]}', f'ITEM#{id}', 'ITEM', rename(item, {
            'id': 'item_id', 'owner': 'owner_id', 'value_minor': 'value_cents',
            'value_source': 'valuation_source', 'reservation': 'reserved_trade_id'}))
        if item['status'] == 'reserved':
            trade = state['trades'].get(item.get('reservation'))
            if not trade or trade['status'] not in {'agreed', 'awaiting_handoff'}:
                raise AppError('Reservation requires an active agreement.', 'INVALID_RESERVATION', 503)
            offer = trade['offers'][-1]
            ids = {x['id'] for x in offer['terms']['left'] + offer['terms']['right']}
            if id not in ids or set(offer['consents']) != set(trade['participants']):
                raise AppError('Reservation requires mutual consent to current terms.', 'INVALID_RESERVATION', 503)
        elif item.get('reservation'):
            raise AppError('Unreserved item cannot retain a reservation.', 'INVALID_RESERVATION', 503)
    for id, trade in state['trades'].items():
        pk = f'TRADE#{id}'
        head = rename({k: v for k, v in trade.items() if k not in {'offers', 'notes'}}, {'id': 'trade_id', 'participants': 'participant_ids'})
        head['current_offer_version'] = trade['offers'][-1]['version']
        add(pk, 'DETAILS', 'TRADE', head)
        for actor in trade['participants']:
            add(f'USER#{actor}', f'TRADE#{id}', 'USER_TRADE', {'trade_id': id, 'status': trade['status'], 'updated_at': trade['updated_at']})
        for offer in trade['offers']:
            terms = deepcopy(offer['terms'])
            payload = {k: deepcopy(v) for k, v in offer.items() if k not in {'consents', 'terms'}}
            payload.update(give_items=terms.pop('left'), receive_items=terms.pop('right'),
                           value_totals={k: terms[k] for k in ('left_total_minor', 'right_total_minor') if k in terms},
                           terms_hash=sha256(canonical(offer['terms']).encode()).hexdigest(), terms_context=terms)
            add(pk, f'OFFER#{offer["version"]:04d}', 'OFFER', payload)
            for actor in offer['consents']:
                add(pk, f'CONSENT#{offer["version"]:04d}#{actor}', 'CONSENT', {'version': offer['version'], 'actor_id': actor})
        for index, note in enumerate(trade['notes']):
            add(pk, f'EVENT#{note["created_at"]}#NOTE{index:010d}', 'EVENT', {
                'actor_id': note['sender'], 'action': 'note', 'timestamp': note['created_at'], 'sequence': index, 'text': note['text']})
        if trade['status'] in {'agreed', 'awaiting_handoff'}:
            for item in trade['offers'][-1]['terms']['left'] + trade['offers'][-1]['terms']['right']:
                actual = state['items'].get(item['id'], {})
                if actual.get('status') != 'reserved' or actual.get('reservation') != id:
                    raise AppError('Agreement must reserve all included items.', 'INVALID_RESERVATION', 503)
    for key, value in state['sessions'].items():
        add(f'SESSION#{key}', 'DETAILS', 'SESSION', {'session_key': key, 'user_id': value['actor'], 'expires_at': value['expires']})
    for key, value in state['commands'].items():
        add(f'COMMAND#{key}', 'DETAILS', 'COMMAND', {'command_key': key, **value})
    for key, value in state.get('valuations', {}).items():
        add(f'ANALYSIS#{key}', 'DETAILS', 'ANALYSIS', {'analysis_key': key, 'result': value})
    for actor, keys in state['dismissals'].items():
        add(f'USER#{actor}', 'DISMISSALS', 'DISMISSALS', {'user_id': actor, 'keys': keys})
    return rows


def assemble(rows):
    state = empty_state()
    prefs, offers, consents, notes = {}, {}, {}, {}
    for (pk, sk), raw in sorted(rows.items()):
        value = deepcopy(raw)
        kind = value.pop('entity_type')
        if kind == 'PROFILE':
            user = rename(value, {v: k for k, v in ALIASES.items()})
            state['users'][user['id']] = user
        elif kind == 'PREFERENCES':
            prefs[value['user_id']] = {k: value[k] for k in ('interests', 'exclusions') if k in value}
            gap = value['max_value_gap_bps'] / 100
            prefs[value['user_id']]['gap_limit'] = int(gap) if gap.is_integer() else gap
        elif kind == 'ITEM':
            item = rename(value, {'item_id': 'id', 'owner_id': 'owner', 'value_cents': 'value_minor',
                                 'valuation_source': 'value_source', 'reserved_trade_id': 'reservation'})
            state['items'][item['id']] = item
        elif kind == 'TRADE':
            trade = rename(value, {'trade_id': 'id', 'participant_ids': 'participants'})
            trade.pop('current_offer_version')
            trade.update(offers=[], notes=[])
            state['trades'][trade['id']] = trade
        elif kind == 'OFFER':
            context = value.pop('terms_context')
            context.update(left=value.pop('give_items'), right=value.pop('receive_items'))
            value.pop('value_totals'); value.pop('terms_hash')
            value['terms'] = context
            offers.setdefault(pk, []).append(value)
        elif kind == 'CONSENT':
            consents.setdefault((pk, value['version']), set()).add(value['actor_id'])
        elif kind == 'EVENT' and value['action'] == 'note':
            notes.setdefault(pk, []).append(value)
        elif kind == 'SESSION':
            state['sessions'][value['session_key']] = {'actor': value['user_id'], 'expires': value['expires_at']}
        elif kind == 'COMMAND':
            key = value.pop('command_key'); state['commands'][key] = value
        elif kind == 'ANALYSIS':
            state['valuations'][value['analysis_key']] = value['result']
        elif kind == 'DISMISSALS':
            state['dismissals'][value['user_id']] = value['keys']
    for id, user in state['users'].items():
        user.update(prefs[id])
    for id, trade in state['trades'].items():
        pk = f'TRADE#{id}'
        trade['offers'] = sorted(offers.get(pk, []), key=lambda x: x['version'])
        trade['notes'] = [{'sender': n['actor_id'], 'text': n['text'], 'created_at': n['timestamp']}
                          for n in sorted(notes.get(pk, []), key=lambda x: x['sequence'])]
        for offer in trade['offers']:
            approved = consents.get((pk, offer['version']), set())
            offer['consents'] = [actor for actor in trade['participants'] if actor in approved]
    return state
