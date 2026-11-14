"""Account-backed Bartr API assembled from the canonical marketplace specification."""
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from .api.marketplace import router
from .api.routes import create_router
from .core.config import application_name
from .domain import Marketplace
from .errors import AppError
from .storage.state import StateRepository


def create_app(repository=None) -> FastAPI:
    name=application_name()
    mode=os.getenv('BARTR_STORAGE','mongo')
    if mode not in {'mongo','memory'}: raise ValueError('BARTR_STORAGE must be mongo or memory.')
    repo=repository or StateRepository(memory=mode=='memory')

    @asynccontextmanager
    async def lifespan(app):
        yield
        repo.close()

    app=FastAPI(title=f'{name} API',version='0.2.0',lifespan=lifespan)
    app.state.marketplace=Marketplace(repo)
    app.include_router(create_router(name),prefix='/api')
    app.include_router(router,prefix='/api')

    @app.middleware('http')
    async def protect_mutation(request:Request,call_next):
        if request.method in {'POST','PATCH','PUT','DELETE'}:
            if request.headers.get('x-bartr-request')!='1':
                return JSONResponse(status_code=403,content={'detail':'A same-origin application request is required.','code':'CSRF_REQUIRED'})
            origin=request.headers.get('origin')
            allowed={x.strip() for x in os.getenv('WEB_ORIGINS','http://localhost:3000,http://127.0.0.1:3000').split(',')}
            if origin and origin not in allowed:
                return JSONResponse(status_code=403,content={'detail':'This origin is not allowed.','code':'ORIGIN_DENIED'})
        response=await call_next(request)
        response.headers['Cache-Control']='no-store'
        return response

    @app.exception_handler(AppError)
    async def domain_error(request,exc):
        return JSONResponse(status_code=exc.status,content={'detail':str(exc),'code':exc.code})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request,exc):
        fields=[{'field':'.'.join(map(str,e['loc'])),'message':e['msg']} for e in exc.errors()]
        return JSONResponse(status_code=422,content={'detail':'Check the highlighted fields.','fields':fields})

    @app.exception_handler(PyMongoError)
    async def database_error(request,exc):
        return JSONResponse(status_code=503,content={'detail':'MongoDB is unavailable. Check configuration and retry; inspect current trade state before repeating an interrupted action.','code':'DATABASE_UNAVAILABLE'})

    return app


app=create_app()
