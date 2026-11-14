"""FastAPI entry point. Run from the root or backend directory."""
from fastapi import FastAPI

from .api.routes import create_router
from .core.config import application_name


def create_app() -> FastAPI:
    name = application_name()
    application = FastAPI(title=f'{name} API', version='0.1.0')
    application.include_router(create_router(name), prefix='/api')
    return application


app = create_app()
