"""Canonical marketplace rules. All mutations run atomically through the repository."""
from copy import deepcopy
from datetime import datetime, timezone
from hashlib import pbkdf2_hmac, sha256
from hmac import compare_digest
from itertools import combinations
import json
import re
import secrets
from time import time
from uuid import uuid4

from .errors import AppError

CLOSED = {'completed', 'declined', 'withdrawn', 'invalidated', 'cancelled'}
REVIEW_FIELDS = {'title', 'description', 'category', 'condition', 'image_id', 'value_minor'}


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def public_user(user):
    return {'id': user['id'], 'name': user['name'], 'community': ''}


def own_user(user):
    return {k: v for k, v in user.items() if k not in {'salt', 'password_hash', 'embedding'}}


def require(condition, message, code='CONFLICT', status=409):
    if not condition:
        raise AppError(message, code, status)


def user(state, actor):
    require(actor in state['users'], 'Sign in to continue.', 'UNAUTHORIZED', 401)
    return state['users'][actor]


def term_matches(item, terms):
    text = ' '.join(str(item.get(k, '')) for k in ('title', 'description', 'category', 'condition')).casefold()
    return any(term.strip().casefold() in text for term in terms if term.strip())


INTEREST_CATEGORIES = frozenset(x.casefold() for x in (
    'Books', 'Clothing', 'Electronics', 'Furniture', 'Home goods',
    'Household essentials', 'Kitchenware', 'Sports equipment', 'Study supplies', 'Other',
))


def interest_matches(item, terms):
    category = str(item.get('category', '')).strip().casefold()
    return any((category == term.strip().casefold() if term.strip().casefold() in INTEREST_CATEGORIES
                else term_matches(item, [term])) for term in terms if term.strip())


def gap(items):
    values = [x['value_minor'] for x in items]
    return sum(values) if all(type(x) is int and x > 0 for x in values) else None


def gap_percent(left, right):
    return abs(left-right) / max(left, right) * 100 if left is not None and right is not None else None


def snapshot(state, actor, other, left_ids, right_ids):
    require(actor != other, 'A trade needs two different members.', 'SELF_TRADE', 422)
    a, b = user(state, actor), user(state, other)
    require(1 <= len(left_ids) <= 3 and 1 <= len(right_ids) <= 3, 'Select one to three items on each side.', 'BUNDLE_LIMIT', 422)
    require(len(set(left_ids + right_ids)) == len(left_ids + right_ids), 'Each item can appear only once.', 'DUPLICATE_ITEM', 422)
    sides = []
    for owner, recipient, ids in [(actor, b, left_ids), (other, a, right_ids)]:
        side = []
        for item_id in ids:
            item = state['items'].get(item_id)
            require(item is not None and item['owner'] == owner, 'An item is missing or belongs to another member.', 'INVALID_OWNER')
            require(item['status'] == 'available', f"{item['title'] or 'Item'} is no longer available.", 'ITEM_UNAVAILABLE')
            require(not term_matches(item, recipient['exclusions']), f"{item['title']} conflicts with a participant exclusion.", 'EXCLUDED_ITEM')
            reviewed=deepcopy(item)
            reviewed['analysis']=None
            side.append(reviewed)
        sides.append(side)
    left, right = sides
    total_left, total_right = gap(left), gap(right)
    difference = gap_percent(total_left, total_right)
    warning = difference is None or difference > min(a['gap_limit'], b['gap_limit'])
    return {'left_owner': actor, 'right_owner': other, 'left': left, 'right': right,
            'left_total_minor': total_left, 'right_total_minor': total_right,
            'gap_percent': difference, 'value_warning': warning}


def trade_for(state, actor, trade_id):
    trade = state['trades'].get(trade_id)
    require(trade is not None and actor in trade['participants'], 'Trade not found.', 'NOT_FOUND', 404)
    return trade


def invalidate_open(state):
    for trade in state['trades'].values():
        if trade['status'] != 'open':
            continue
        offer = trade['offers'][-1]
        terms = offer['terms']
        try:
            current = snapshot(state, terms['left_owner'], terms['right_owner'],
                               [x['id'] for x in terms['left']], [x['id'] for x in terms['right']])
            require(all(state['items'][x['id']]['revision'] == x['revision'] for x in terms['left']+terms['right']), 'Included listing details changed.', 'STALE_ITEM')
        except AppError as exc:
            trade.update(status='invalidated', reason=str(exc), revision=trade['revision']+1, updated_at=now())


class Marketplace:
    def __init__(self, repository):
        self.repo = repository

    def register(self, username, password, name, community):
        username = username.strip().casefold()
        require(bool(name.strip()), 'Display name cannot be blank.', 'INVALID_PROFILE', 422)
        require(bool(re.fullmatch(r'[a-z0-9_.-]{3,40}', username)), 'Username needs 3–40 letters, numbers, dots, underscores or hyphens.', 'INVALID_USERNAME', 422)
        require(10 <= len(password) <= 200, 'Use a password of 10–200 characters.', 'INVALID_PASSWORD', 422)
        salt = secrets.token_hex(16)
        password_hash = pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310_000).hex()
        def op(state):
            require(not any(x['username'] == username for x in state['users'].values()), 'That username is unavailable.', 'USERNAME_TAKEN')
            actor = uuid4().hex
            record = {'id': actor, 'username': username, 'salt': salt, 'password_hash': password_hash,
                      'name': name.strip(), 'community': community.strip() or 'Bartr', 'interests': [], 'exclusions': [],
                      'gap_limit': 20, 'revision': 1}
            state['users'][actor] = record
            return own_user(record)
        return self.repo.mutate(op)

    def login(self, username, password):
        state = self.repo.read()
        record = next((x for x in state['users'].values() if x['username'] == username.strip().casefold()), None)
        salt = record['salt'] if record else 'missing-user-salt'
        hashed = pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310_000).hex()
        require(record is not None and compare_digest(hashed, record['password_hash']), 'Invalid username or password.', 'INVALID_LOGIN', 401)
        token = secrets.token_urlsafe(40)
        self.repo.mutate(lambda state: state['sessions'].update({sha256(token.encode()).hexdigest(): {'actor': record['id'], 'expires': time()+7*86400}}))
        return token, own_user(record)

    def authenticate(self, token):
        session = self.repo.read()['sessions'].get(sha256((token or '').encode()).hexdigest())
        require(session is not None and session['expires'] > time(), 'Sign in to continue.', 'UNAUTHORIZED', 401)
        return session['actor']

    def logout(self, token):
        self.repo.mutate(lambda state: state['sessions'].pop(sha256(token.encode()).hexdigest(), None))

    def view(self, actor):
        state = self.repo.read()
        own = user(state, actor)
        return {'profile': own_user(own), 'members': [public_user(x) for x in state['users'].values()],
                'items': [{**x, 'analysis': x.get('analysis') if x['owner']==actor else None} for x in state['items'].values() if x['owner'] == actor or
                          x['status'] == 'available'],
                'trades': [x for x in state['trades'].values() if actor in x['participants']]}

    def update_profile(self, actor, revision, changes):
        def op(state):
            record = user(state, actor)
            require(record['revision'] == revision, 'Profile changed. Reload before saving.', 'STALE_PROFILE')
            if any(k in changes and not changes[k].strip() for k in ('name','community')):
                raise AppError('Display name and community cannot be blank.','INVALID_PROFILE',422)
            changes_clean={k:([x.strip() for x in v if x.strip()] if k in {'interests','exclusions'} else v.strip() if k in {'name','community'} else v) for k,v in changes.items()}
            record.update(changes_clean, revision=revision+1)
            record.pop('embedding',None)
            invalidate_open(state)
            return own_user(record)
        return self.repo.mutate(op)

    def save_item(self, actor, item_id, revision, changes):
        analysis_id=changes.get('analysis_id')
        changes={key:value for key,value in changes.items() if key!='analysis_id'}
        def op(state):
            user(state, actor)
            if item_id:
                item = state['items'].get(item_id)
                require(item is not None and item['owner'] == actor, 'Item not found.', 'NOT_FOUND', 404)
                require(item['revision'] == revision, 'Item changed. Reload before saving.', 'STALE_ITEM')
                require(item['status'] in {'draft', 'available'}, 'Reserved, exchanged or removed items cannot be edited.', 'ITEM_LOCKED')
                item = deepcopy(item)
            else:
                item = {'id': uuid4().hex, 'owner': actor, 'revision': 0, 'title': '', 'description': '', 'category': '',
                        'condition': '', 'image_id': None, 'value_minor': None, 'value_source': 'unknown',
                        'value_set_at': None, 'uncertainty': None, 'status': 'draft', 'analysis': None}
            if changes.get('status') == 'available':
                require(all(str(changes.get(k, item.get(k)) or '').strip() for k in ('title','description','category','condition','image_id')),
                        'Publication needs a title, description, category, condition and uploaded image. Save a draft first if needed.', 'INCOMPLETE_LISTING', 422)
            accepted=None
            if analysis_id is not None:
                accepted=next((value for value in state.get('valuations',{}).values() if value.get('analysis_id')==analysis_id),None)
                require(accepted is not None and accepted.get('owner')==actor and accepted.get('item_id')==item['id'], 'Analysis does not belong to this listing.', 'INVALID_ANALYSIS', 403)
                require(accepted['item_revision']==item['revision'] and accepted.get('image_id')==item.get('image_id'), 'Analysis is stale. Analyze the current listing revision.', 'STALE_ANALYSIS')
            publishing = changes.get('status', item['status']) == 'available' and item['status'] != 'available'
            changing_value = item['status'] == 'available' and 'value_minor' in changes and changes['value_minor'] != item.get('value_minor')
            if publishing or changing_value:
                amount = changes.get('value_minor', item.get('value_minor'))
                require(accepted is not None and (accepted.get('price_basis') == 'market_comparables' or (accepted.get('price_basis') == 'image_assisted_estimate' and accepted.get('fallback_reason') == 'comparables_unavailable')) and accepted.get('status') == 'estimated' and type(accepted.get('estimate_minor')) is int and accepted['estimate_minor'] > 0 and amount == accepted['estimate_minor'],
                        'Evaluate this item and use its current AI estimate before publishing or changing its value.', 'EVALUATION_REQUIRED', 422)
                require(all(changes.get(k, item.get(k)) == item.get(k) for k in ('title', 'description', 'category', 'condition', 'image_id')),
                        'Item details changed after evaluation. Save and evaluate the current item again.', 'STALE_ANALYSIS', 409)
            if 'value_minor' in changes:
                amount=changes['value_minor']
                require(amount is None or (type(amount) is int and 0<amount<=1_000_000_000_000), 'Comparison value must be positive integer USD cents or unknown.', 'INVALID_VALUE', 422)
                assisted=bool(accepted and amount is not None and amount==accepted.get('estimate_minor'))
                if assisted or amount!=item.get('value_minor'):
                    item.update(value_source='assisted' if assisted else 'owner' if amount else 'unknown',
                                value_basis=accepted.get('price_basis') if assisted else None,
                                value_set_at=now() if amount else None,
                                uncertainty=accepted.get('uncertainty') if assisted else None,
                                valuation_analysis_id=analysis_id if assisted else None)
            item.update(changes, revision=item['revision']+1, updated_at=now(), analysis=None)
            state['items'][item['id']] = item
            invalidate_open(state)
            return item
        return self.repo.mutate(op)

    def review_analysis(self, actor, item_id, revision, analysis):
        def op(state):
            item = state['items'].get(item_id)
            require(item is not None and item['owner'] == actor, 'Item not found.', 'NOT_FOUND', 404)
            require(item['revision'] == revision, 'Item changed during analysis. Retry the new revision.', 'STALE_ITEM')
            item['analysis'] = {**analysis, 'analysis_id':uuid4().hex, 'item_id':item_id, 'owner':actor, 'image_id':item.get('image_id'), 'item_revision': revision, 'generated_at': now()}
            state.setdefault('valuations', {})[digest([item_id, revision])] = deepcopy(item['analysis'])
            return item
        return self.repo.mutate(op)

    def recommendation_key(self, state, actor, terms):
        return digest({'actor': actor, 'preferences': state['users'][actor]['revision'],
                       'left': [(x['id'],x['revision']) for x in terms['left']],
                       'right': [(x['id'],x['revision']) for x in terms['right']]})

    def recommend(self, actor, semantic=None, semantic_excluded=None, *, state=None):
        state = state if state is not None else self.repo.read()
        me = user(state, actor)
        mine = [x for x in state['items'].values() if x['owner'] == actor and x['status'] == 'available']
        require(mine, 'Publish an available item to discover exchanges.', 'MISSING_INVENTORY', 422)
        require(me['interests'], 'Add at least one interest to discover exchanges.', 'MISSING_INTERESTS', 422)
        results, missing = [], False
        comparisons = 0
        for other in sorted(state['users'].values(), key=lambda x:x['id']):
            if other['id'] == actor or not other['interests']:
                continue
            theirs = [x for x in state['items'].values() if x['owner'] == other['id'] and x['status'] == 'available']
            def fits(item, recipient):
                return item['id'] not in (semantic_excluded or {}).get(recipient['id'], set()) and not term_matches(item, recipient['exclusions']) and (interest_matches(item, recipient['interests']) or
                       (semantic is not None and item['id'] in semantic.get(recipient['id'], set())))
            left = sorted([x for x in mine if fits(x, other)], key=lambda x:x['id'])
            right = sorted([x for x in theirs if fits(x, me)], key=lambda x:x['id'])
            missing |= any(not x['value_minor'] for x in left+right)
            left = [x for x in left if x['value_minor']]
            right = [x for x in right if x['value_minor']]
            for size_a in range(1,min(3,len(left))+1):
                for a in combinations(left,size_a):
                    for size_b in range(1,min(3,len(right))+1):
                        for b in combinations(right,size_b):
                            comparisons += 1
                            require(comparisons <= 100_000, 'Search is too broad. Narrow your interests and try again.', 'SEARCH_CAPACITY', 503)
                            total_a, total_b = gap(a), gap(b)
                            if gap_percent(total_a,total_b) > min(me['gap_limit'],other['gap_limit']):
                                continue
                            terms = snapshot(state, actor,other['id'],[x['id'] for x in a],[x['id'] for x in b])
                            key = self.recommendation_key(state, actor, terms)
                            if key in state['dismissals'].get(actor, []):
                                continue
                            results.append({'id':key, 'terms':terms, 'member':public_user(other),
                                'explanation':f"Your {', '.join(x['title'] for x in a)} matches {other['name']}’s relevant interests, and {', '.join(x['title'] for x in b)} matches yours. The estimated gap is {terms['gap_percent']:.1f}%; these are comparison estimates, not guaranteed market values."})
        return {'recommendations':results,'reason':'MISSING_VALUATION' if not results and missing else 'NO_MATCH' if not results else None}

    def dismiss(self, actor, key):
        def op(state):
            user(state, actor)
            values = state['dismissals'].setdefault(actor, [])
            if key not in values: values.append(key)
            return {'dismissed':True}
        return self.repo.mutate(op)

    def create_trade(self, actor, other, left, right, acknowledged, command_id):
        return self.command(actor, command_id, {'type':'create','other':other,'left':left,'right':right,'acknowledged':acknowledged},
                            lambda state:self._create_trade(state,actor,other,left,right,acknowledged))

    def _create_trade(self,state,actor,other,left,right,acknowledged):
        terms = snapshot(state,actor,other,left,right)
        require(not terms['value_warning'] or acknowledged, 'Confirm the unknown values or value imbalance before proposing this exchange.', 'CONFIRM_VALUE_WARNING', 422)
        offer = {'version':1,'sender':actor,'terms':terms,'consents':[actor],'created_at':now()}
        trade = {'id':uuid4().hex,'participants':[actor,other],'revision':1,'status':'open','offers':[offer],
                 'notes':[],'handoffs':[],'cancellations':[],'created_at':now(),'updated_at':now(),'reason':None}
        state['trades'][trade['id']] = trade
        return trade

    def command(self,actor,command_id,payload,operation):
        def op(state):
            user(state,actor)
            key=digest([actor,command_id]); fingerprint=digest(payload)
            prior=state['commands'].get(key)
            if prior:
                require(prior['fingerprint']==fingerprint,'This command ID was already used for different terms.','COMMAND_MISMATCH')
                return trade_for(state,actor,prior['trade'])
            result=operation(state)
            state['commands'][key]={'fingerprint':fingerprint,'trade':result['id']}
            return result
        return self.repo.mutate(op)

    def action(self,actor,trade_id,revision,kind,command_id,*,left=None,right=None,note='',acknowledged=False):
        payload={'trade':trade_id,'revision':revision,'kind':kind,'left':left,'right':right,'note':note,'acknowledged':acknowledged}
        def op(state):
            trade=trade_for(state,actor,trade_id)
            require(trade['revision']==revision,'Trade changed. Reload the current terms before acting.','STALE_TRADE')
            require(trade['status'] not in CLOSED,'This trade is closed and read-only.','TRADE_CLOSED')
            offer=trade['offers'][-1]; terms=offer['terms']
            ids=[x['id'] for x in terms['left']+terms['right']]
            if kind=='note':
                require(bool(note.strip()),'Write a note before sending.','EMPTY_NOTE',422)
                trade['notes'].append({'sender':actor,'text':note.strip(),'created_at':now()})
            elif kind in {'counter','accept','decline','withdraw'}:
                require(trade['status']=='open','Only open proposals support this action.','INVALID_STATE')
                if kind=='counter':
                    other=next(x for x in trade['participants'] if x!=actor)
                    changed=snapshot(state,actor,other,left or [],right or [])
                    require(not changed['value_warning'] or acknowledged,'Confirm the unknown value or imbalance before countering.','CONFIRM_VALUE_WARNING',422)
                    trade['offers'].append({'version':offer['version']+1,'sender':actor,'terms':changed,'consents':[actor],'created_at':now()})
                elif kind in {'decline','withdraw'}:
                    require((actor==offer['sender'])==(kind=='withdraw'),'Only the current sender can withdraw; only the current recipient can decline.','INVALID_ROLE',403)
                    trade.update(status='withdrawn' if kind=='withdraw' else 'declined',reason=kind)
                else:
                    require(actor!=offer['sender'],'The sender already consented. The other member must accept.','INVALID_ROLE')
                    current=snapshot(state,terms['left_owner'],terms['right_owner'],[x['id'] for x in terms['left']],[x['id'] for x in terms['right']])
                    require(all(state['items'][x['id']]['revision']==x['revision'] for x in terms['left']+terms['right']),'Listing details changed. Submit a fresh offer.','STALE_ITEM')
                    require(not current['value_warning'] or acknowledged,'Confirm this offer’s unknown values or imbalance before accepting.','CONFIRM_VALUE_WARNING',422)
                    offer['consents']=list(trade['participants']); trade['status']='agreed'
                    for item_id in ids:
                        state['items'][item_id].update(status='reserved',reservation=trade_id)
                    invalidate_open(state)
            elif kind in {'handoff','cancel'}:
                require(trade['status'] in {'agreed','awaiting_handoff'},'Agreement is required before this action.','INVALID_STATE')
                if kind=='handoff':
                    if actor not in trade['handoffs']: trade['handoffs'].append(actor)
                    trade['status']='completed' if len(trade['handoffs'])==2 else 'awaiting_handoff'
                    if trade['status']=='completed':
                        for item_id in ids: state['items'][item_id].update(status='exchanged',reservation=None)
                else:
                    if actor not in trade['cancellations']: trade['cancellations'].append(actor)
                    if not trade['handoffs'] or len(trade['cancellations'])==2:
                        trade.update(status='cancelled',reason='Participant cancellation')
                        for item_id in ids: state['items'][item_id].update(status='available',reservation=None)
                    else:
                        trade['reason']='Cancellation needs both participants because handoff was reported. Items remain reserved.'
            else:
                raise AppError('Unknown trade action.','INVALID_ACTION',422)
            trade.update(revision=trade['revision']+1,updated_at=now())
            return trade
        return self.command(actor,command_id,payload,op)
