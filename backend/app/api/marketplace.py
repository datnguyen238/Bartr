"""Account-backed routes. All ownership and actor identity are server-derived."""
import os
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, File, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from ..domain import now
from ..errors import AppError
from ..services.images import MAX_UPLOAD_BYTES, normalize_image
from ..services.preferences import interpret_preferences
from ..services.search import SemanticSearch
from ..services.image_analysis import GeminiImageAnalysis

Text=Annotated[str,Field(min_length=1,max_length=200)]
Revision=Annotated[int,Field(ge=1,strict=True)]


class Closed(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)


class Login(Closed):
    username:Text
    password:Annotated[str,Field(min_length=1,max_length=200)]


class Register(Login):
    name:Text
    community:Text


class ProfileUpdate(Closed):
    expected_revision:Revision
    name:Text
    community:Text
    interests:list[Text]=Field(max_length=20)
    exclusions:list[Text]=Field(max_length=20)
    gap_limit:Annotated[int,Field(ge=0,le=100)]


class ItemInput(Closed):
    title:Annotated[str,Field(max_length=150)]=''
    description:Annotated[str,Field(max_length=3000)]=''
    category:Annotated[str,Field(max_length=100)]=''
    condition:Annotated[str,Field(max_length=300)]=''
    value_minor:Annotated[int,Field(gt=0,le=1_000_000_000_000)]|None=None
    status:Literal['draft','available','removed']='draft'


class ItemUpdate(ItemInput):
    expected_revision:Revision
    analysis_id:Text|None=None


class Expected(Closed):
    expected_revision:Revision


class PreferenceText(Closed):
    text:Annotated[str,Field(min_length=1,max_length=3000)]


class Proposal(Closed):
    other:Text
    left:list[Text]=Field(min_length=1,max_length=3)
    right:list[Text]=Field(min_length=1,max_length=3)
    acknowledged:bool=False
    command_id:Text


class Action(Closed):
    expected_revision:Revision
    kind:Literal['note','counter','accept','decline','withdraw','cancel','handoff']
    command_id:Text
    left:list[Text]|None=None
    right:list[Text]|None=None
    note:Annotated[str,Field(max_length=3000)]=''
    acknowledged:bool=False


class Dismiss(Closed):
    id:Text


router=APIRouter()


def market(request:Request): return request.app.state.marketplace


def actor(request:Request,bartr_session:Annotated[str|None,Cookie()]=None):
    return market(request).authenticate(bartr_session)


@router.post('/auth/register')
def register(body:Register,request:Request,response:Response):
    service=market(request)
    service.register(body.username,body.password,body.name,body.community)
    token,profile=service.login(body.username,body.password)
    response.set_cookie('bartr_session',token,httponly=True,samesite='lax',secure=os.getenv('COOKIE_SECURE','false')=='true',max_age=7*86400,path='/')
    return profile


@router.post('/auth/login')
def login(body:Login,request:Request,response:Response):
    token,profile=market(request).login(body.username,body.password)
    response.set_cookie('bartr_session',token,httponly=True,samesite='lax',secure=os.getenv('COOKIE_SECURE','false')=='true',max_age=7*86400,path='/')
    return profile


@router.post('/auth/logout')
def logout(request:Request,response:Response,who=Depends(actor)):
    market(request).logout(request.cookies['bartr_session']); response.delete_cookie('bartr_session',path='/')
    return {'signed_out':True}


@router.get('/me')
def me(request:Request,who=Depends(actor)):
    service=market(request)
    return {**service.view(who), 'storage':'temporary-memory' if service.repo.memory else getattr(service.repo,'backend','mongodb'),
            'integrations':{'gemini_configured':bool(os.getenv('GEMINI_API_KEY') and (os.getenv('GEMINI_MODEL') or os.getenv('GEMINI_VALUATION_MODEL'))),
                            'bedrock_configured':bool(os.getenv('AWS_REGION') and os.getenv('BEDROCK_EMBEDDING_MODEL'))}}


@router.patch('/profile')
def profile(body:ProfileUpdate,request:Request,who=Depends(actor)):
    return market(request).update_profile(who,body.expected_revision,body.model_dump(exclude={'expected_revision'}))


@router.post('/items')
def create_item(body:ItemInput,request:Request,who=Depends(actor)):
    return market(request).save_item(who,None,None,body.model_dump())


@router.patch('/items/{item_id}')
def update_item(item_id:str,body:ItemUpdate,request:Request,who=Depends(actor)):
    return market(request).save_item(who,item_id,body.expected_revision,body.model_dump(exclude={'expected_revision'}))


@router.post('/items/{item_id}/image')
async def upload_image(item_id:str,request:Request,expected_revision:int,file:UploadFile=File(...),who=Depends(actor)):
    service=market(request)
    item=service.repo.read()['items'].get(item_id)
    if not item or item['owner']!=who: raise AppError('Item not found.','NOT_FOUND',404)
    if item['revision']!=expected_revision: raise AppError('Item changed. Reload first.','STALE_ITEM')
    data=await file.read(MAX_UPLOAD_BYTES+1)
    from starlette.concurrency import run_in_threadpool
    normalized,width,height=await run_in_threadpool(normalize_image,data,file.content_type)
    image={'data':normalized,'mime_type':'image/jpeg','width':width,'height':height}
    image_id=uuid4().hex
    service.repo.put_image(image_id,who,image)
    try: return service.save_item(who,item_id,expected_revision,{'image_id':image_id})
    except Exception:
        service.repo.delete_image(image_id); raise


@router.get('/images/{image_id}')
def image(image_id:str,request:Request,who=Depends(actor)):
    service=market(request); state=service.repo.read()
    visible=any(x.get('image_id')==image_id and (x['owner']==who or x['status']=='available') for x in state['items'].values())
    visible|=any(who in t['participants'] and any(x.get('image_id')==image_id for o in t['offers'] for x in o['terms']['left']+o['terms']['right']) for t in state['trades'].values())
    if not visible: raise AppError('Image not found.','NOT_FOUND',404)
    record=service.repo.image(image_id)
    if not record: raise AppError('Image not found.','NOT_FOUND',404)
    return Response(record['data'],media_type=record['mime_type'],headers={'Cache-Control':'private, no-store'})


@router.post('/items/{item_id}/analysis')
async def analysis(item_id:str,body:Expected,request:Request,who=Depends(actor)):
    service=market(request)
    from starlette.concurrency import run_in_threadpool
    state=await run_in_threadpool(service.repo.read)
    item=state['items'].get(item_id)
    if not item or item['owner']!=who:
        raise AppError('Item not found.','NOT_FOUND',404)
    if item['revision']!=body.expected_revision:
        raise AppError('Item changed. Reload first.','STALE_ITEM')
    prior=item.get('analysis')
    if prior and prior['item_revision']==item['revision']:
        return prior
    image=await run_in_threadpool(service.repo.image,item['image_id']) if item.get('image_id') else None
    value=await GeminiImageAnalysis().analyze(
        {k:item[k] for k in ('title','description','category','condition')},image)
    updated=await run_in_threadpool(service.review_analysis,who,item_id,body.expected_revision,value)
    return updated['analysis']


@router.post('/preferences/interpret')
def interpret(body:PreferenceText,who=Depends(actor)):
    return interpret_preferences(body.text)


@router.post('/items/{item_id}/embedding')
def embed(item_id:str,body:Expected,request:Request,who=Depends(actor)):
    service=market(request); state=service.repo.read(); item=state['items'].get(item_id)
    if not item or item['owner']!=who: raise AppError('Item not found.','NOT_FOUND',404)
    if item['revision']!=body.expected_revision: raise AppError('Item changed. Reload first.','STALE_ITEM')
    return SemanticSearch(service.repo).index_item(item,state['users'][who]['community'])


@router.get('/recommendations')
def recommendations(request:Request,semantic:bool=True,who=Depends(actor)):
    service=market(request)
    state=service.repo.read()
    member=state['users'][who]
    if not any(x['owner']==who and x['status']=='available' for x in state['items'].values()):
        raise AppError('Publish an available item to discover exchanges.','MISSING_INVENTORY',422)
    if not member['interests']:
        raise AppError('Add an interest before requesting recommendations.','MISSING_INTERESTS',422)
    if semantic:
        try:
            relevant,excluded=SemanticSearch(service.repo).candidates(service.repo.read(),who)
        except AppError: raise
        except Exception as exc: raise AppError('Semantic discovery failed. Check Bedrock, Gemini and the Atlas vector index; this does not mean no trades exist.','SEARCH_UNAVAILABLE',503) from exc
        result=service.recommend(who,relevant,excluded)
    else: result=service.recommend(who)
    return {**result,'retrieval':'semantic' if semantic else 'exact-text (local testing)'}


@router.post('/recommendations/dismiss')
def dismiss(body:Dismiss,request:Request,who=Depends(actor)):
    return market(request).dismiss(who,body.id)


@router.post('/trades')
def propose(body:Proposal,request:Request,who=Depends(actor)):
    return market(request).create_trade(who,body.other,body.left,body.right,body.acknowledged,body.command_id)


@router.get('/trades/{trade_id}')
def get_trade(trade_id:str,request:Request,who=Depends(actor)):
    from ..domain import trade_for
    return trade_for(market(request).repo.read(),who,trade_id)


@router.post('/trades/{trade_id}/actions')
def action(trade_id:str,body:Action,request:Request,who=Depends(actor)):
    return market(request).action(who,trade_id,body.expected_revision,body.kind,body.command_id,left=body.left,right=body.right,note=body.note,acknowledged=body.acknowledged)


@router.get('/profile')
def own_profile(request:Request,who=Depends(actor)):
    from ..domain import own_user
    return own_user(market(request).repo.read()['users'][who])


@router.get('/items')
def list_items(request:Request,who=Depends(actor)):
    return market(request).view(who)['items']


@router.get('/trades')
def list_trades(request:Request,who=Depends(actor)):
    return market(request).view(who)['trades']


@router.get('/items/{item_id}')
def get_item(item_id:str,request:Request,who=Depends(actor)):
    visible=market(request).view(who)['items']
    record=next((item for item in visible if item['id']==item_id),None)
    if record is None:
        raise AppError('Item not found.','NOT_FOUND',404)
    return record
