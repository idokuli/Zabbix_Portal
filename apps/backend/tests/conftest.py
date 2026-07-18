import sys
from pathlib import Path

# Make backend root importable without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.limiter import limiter


@pytest.fixture()
def auth_client():
    """Minimal FastAPI app with only the auth router — no DB/Zabbix startup."""
    from api.routes.auth import router

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    with TestClient(app, raise_server_exceptions=True) as client:
        yield client
