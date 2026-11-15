from backend.tests.legacy_fixtures import seed_legacy_available
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

from backend.app.domain import Marketplace
from backend.app.errors import AppError
from backend.app.storage.state import StateRepository


@pytest.fixture(params=['memory','json'])
def market(request,tmp_path):
    repository=(StateRepository(memory=True) if request.param=='memory'
                else StateRepository(json_path=tmp_path/'bartr.json'))
    app=Marketplace(repository)
    a=app.register('alice','safe-password-one','Alice','Tempe')['id']
    b=app.register('brian','safe-password-two','Brian','Tempe')['id']
    c=app.register('carol','safe-password-three','Carol','Tempe')['id']
    for actor,interests in [(a,['monitor']),(b,['chair','calculator']),(c,['chair'])]:
        app.update_profile(actor,1,{'interests':interests})
    def add(actor,title,value):
        return seed_legacy_available(app,actor,{'title':title,'description':title,'category':title,'condition':'Good','image_id':'test-image','value_minor':value})['id']
    chair=add(a,'chair',4000); calculator=add(a,'calculator',2000); monitor=add(b,'monitor',6500)
    return app,a,b,c,chair,calculator,monitor,add


def proposal(f):
    app,a,b,c,chair,calc,monitor,_=f
    return app.create_trade(a,b,[chair,calc],[monitor],False,uuid4().hex)


def test_canonical_recommendation_percent_and_private_profile(market):
    app,a,b,_,chair,calc,monitor,_=market
    result=app.recommend(a)['recommendations']
    assert len(result)==1
    assert result[0]['terms']['gap_percent']==pytest.approx(100*5/65)
    view=app.view(a)
    assert all(set(x)=={'id','name','community'} for x in view['members'])
    key=result[0]['id']; app.dismiss(a,key)
    assert app.recommend(a)['recommendations']==[]
    item=app.repo.read()['items'][chair]
    app.save_item(a,chair,item['revision'],{'description':'Reviewed chair'})
    assert app.recommend(a)['recommendations']


def test_counter_resets_consent_and_current_sender_roles(market):
    app,a,b,_,chair,calc,monitor,_=market
    trade=proposal(market)
    revised=app.action(b,trade['id'],1,'counter',uuid4().hex,left=[monitor],right=[chair,calc])
    assert revised['offers'][-1]['consents']==[b]
    with pytest.raises(AppError): app.action(a,trade['id'],1,'accept',uuid4().hex)
    with pytest.raises(AppError): app.action(a,trade['id'],2,'withdraw',uuid4().hex)
    assert app.action(a,trade['id'],2,'decline',uuid4().hex)['status']=='declined'


def test_agreement_reserves_all_and_two_handoffs_complete(market):
    app,a,b,_,chair,calc,monitor,_=market
    trade=proposal(market)
    agreed=app.action(b,trade['id'],1,'accept',uuid4().hex)
    assert agreed['status']=='agreed'
    assert all(app.repo.read()['items'][x]['status']=='reserved' for x in [chair,calc,monitor])
    with pytest.raises(AppError): app.save_item(a,chair,1,{'title':'Changed'})
    waiting=app.action(a,trade['id'],2,'handoff',uuid4().hex)
    assert waiting['status']=='awaiting_handoff'
    done=app.action(b,trade['id'],3,'handoff',uuid4().hex)
    assert done['status']=='completed'
    assert all(app.repo.read()['items'][x]['status']=='exchanged' for x in [chair,calc,monitor])


def test_overlapping_acceptance_is_atomic_and_retry_safe(market):
    app,a,b,c,chair,calc,monitor,add=market
    extra=add(c,'monitor',6000)
    first=proposal(market)
    second=app.create_trade(a,c,[chair,calc],[extra],True,uuid4().hex)
    def accept(actor,id):
        try: return app.action(actor,id,1,'accept',uuid4().hex,acknowledged=True)['status']
        except AppError: return 'rejected'
    with ThreadPoolExecutor(max_workers=2) as pool:
        values=list(pool.map(lambda p:accept(*p),[(b,first['id']),(c,second['id'])]))
    assert values.count('agreed')==1
    trades=app.repo.read()['trades']
    assert {x['status'] for x in trades.values()}=={'agreed','invalidated'}


def test_idempotency_and_changed_item_invalidation(market):
    app,a,b,c,chair,calc,monitor,_=market
    key=uuid4().hex
    first=app.create_trade(a,b,[chair,calc],[monitor],False,key)
    assert app.create_trade(a,b,[chair,calc],[monitor],False,key)['id']==first['id']
    with pytest.raises(AppError): app.create_trade(a,b,[chair],[monitor],True,key)
    app.save_item(a,chair,1,{'condition':'Some scratches'})
    assert app.repo.read()['trades'][first['id']]['status']=='invalidated'
    with pytest.raises(AppError): app.action(b,first['id'],2,'accept',uuid4().hex)
    with pytest.raises(AppError): app.action(c,first['id'],2,'note',uuid4().hex,note='private')


def test_cancel_before_and_after_handoff_requires_correct_consents(market):
    app,a,b,_,chair,calc,monitor,_=market
    t=proposal(market); app.action(b,t['id'],1,'accept',uuid4().hex)
    app.action(a,t['id'],2,'handoff',uuid4().hex)
    pending=app.action(a,t['id'],3,'cancel',uuid4().hex)
    assert pending['status']=='awaiting_handoff'
    assert app.repo.read()['items'][chair]['status']=='reserved'
    cancelled=app.action(b,t['id'],4,'cancel',uuid4().hex)
    assert cancelled['status']=='cancelled'
    assert all(app.repo.read()['items'][x]['status']=='available' for x in [chair,calc,monitor])
    with pytest.raises(AppError): app.action(a,t['id'],5,'note',uuid4().hex,note='closed')


def test_exclusions_community_unknown_values_and_bundle_cap(market):
    app,a,b,c,chair,calc,monitor,add=market
    app.update_profile(b,2,{'exclusions':['chair']})
    assert app.recommend(a)['recommendations']==[]
    with pytest.raises(AppError): proposal(market)
    app.update_profile(b,3,{'exclusions':[],'community':'Phoenix'})
    assert proposal(market)['status'] == 'open'
    app.update_profile(b,4,{'community':'Tempe'})
    fourth=add(a,'calculator',100); third=add(a,'calculator',100)
    with pytest.raises(AppError): app.create_trade(a,b,[chair,calc,third,fourth],[monitor],True,uuid4().hex)
    unknown=add(a,'unknown',None)
    with pytest.raises(AppError): app.create_trade(a,b,[unknown],[monitor],False,uuid4().hex)
    assert app.create_trade(a,b,[unknown],[monitor],True,uuid4().hex)['status']=='open'


def test_real_sessions_and_passwords(market):
    app,a,*_=market
    token,profile=app.login('alice','safe-password-one')
    assert app.authenticate(token)==a and 'password_hash' not in profile
    with pytest.raises(AppError): app.login('alice','wrong-password')
    app.logout(token)
    with pytest.raises(AppError): app.authenticate(token)


@pytest.mark.parametrize('left_count,right_count',[(a,b) for a in (1,2,3) for b in (1,2,3)])
def test_all_nine_supported_bundle_shapes(left_count,right_count):
    app=Marketplace(StateRepository(memory=True))
    a=app.register('person-a','long-password-a','A','Tempe')['id']
    b=app.register('person-b','long-password-b','B','Tempe')['id']
    app.update_profile(a,1,{'interests':['monitor'],'gap_limit':0})
    app.update_profile(b,1,{'interests':['chair'],'gap_limit':0})
    for actor,title,count,value in [(a,'chair',left_count,600//left_count),(b,'monitor',right_count,600//right_count)]:
        for i in range(count):
            seed_legacy_available(app,actor,{'title':f'{title} {i}','description':title,'category':title,'condition':'Good','image_id':'test','value_minor':value})
    matches=app.recommend(a)['recommendations']
    assert any(len(x['terms']['left'])==left_count and len(x['terms']['right'])==right_count for x in matches)


def test_no_handoff_cancellation_and_retry_ledger(market):
    app,a,b,_,chair,calc,monitor,_=market
    trade=proposal(market)
    key=uuid4().hex
    agreed=app.action(b,trade['id'],1,'accept',key)
    assert app.action(b,trade['id'],1,'accept',key)==agreed
    cancelled=app.action(a,trade['id'],2,'cancel',uuid4().hex)
    assert cancelled['status']=='cancelled'
    assert app.repo.read()['items'][chair]['status']=='available'


def test_saved_analysis_is_revision_bound_and_retained_without_expiry(market):
    app,a,b,c,chair,*_=market
    app.review_analysis(a,chair,1,{'attributes':{'description':'A chair'},'range':None})
    assert app.repo.read()['items'][chair]['analysis']['item_revision']==1
    app.save_item(a,chair,1,{'description':'New reviewed description'})
    state=app.repo.read()
    assert state['items'][chair]['analysis'] is None
    assert len(state['valuations'])==1
    saved=next(iter(state['valuations'].values()))
    assert saved['item_revision']==1 and 'expires_at' not in saved


def test_both_percentage_limits_apply_and_semantic_ids_support_equivalent_wording(market):
    app,a,b,c,chair,calc,monitor,_=market
    app.update_profile(b,2,{'gap_limit':7})
    assert app.recommend(a)['recommendations']==[]
    app.update_profile(b,3,{'gap_limit':8})
    app.update_profile(a,2,{'interests':['desk screen'],'gap_limit':8})
    assert app.recommend(a)['recommendations']==[]
    matched=app.recommend(a,semantic={a:{monitor},b:{chair,calc}})['recommendations']
    assert len(matched)==1
    assert app.recommend(a,semantic={a:{monitor},b:{chair,calc}},semantic_excluded={a:{monitor}})['recommendations']==[]


def test_accepting_saved_comparable_estimate_sets_assisted_provenance(market):
    app,a,b,c,chair,*_=market
    reviewed=app.review_analysis(a,chair,1,{'status':'estimated','price_basis':'market_comparables','estimate_minor':4100,'uncertainty':'high'})
    analysis=reviewed['analysis']
    item=app.save_item(a,chair,1,{'value_minor':4100,'analysis_id':analysis['analysis_id']})
    assert item['value_source']=='assisted' and item['uncertainty']=='high'
    assert item['value_set_at'] and item['analysis'] is None
    assert next(x for x in app.view(b)['items'] if x['id']==chair)['analysis'] is None
    with pytest.raises(AppError):
        app.save_item(a,chair,2,{'value_minor':4100,'analysis_id':analysis['analysis_id']})


def test_altered_estimate_and_foreign_analysis_are_rejected(market):
    app,a,b,c,chair,calc,monitor,_=market
    result=app.review_analysis(a,chair,1,{'status':'estimated','price_basis':'market_comparables','estimate_minor':4100,'uncertainty':'high'})
    id=result['analysis']['analysis_id']
    with pytest.raises(AppError):
        app.save_item(b,monitor,1,{'value_minor':4100,'analysis_id':id})
    with pytest.raises(AppError):
        app.save_item(a,chair,1,{'value_minor':3900,'analysis_id':id})
    assert app.repo.read()['items'][chair]['value_minor'] == 4000
