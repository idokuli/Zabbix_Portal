"""Zabbix DevOps API entry point."""

import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.lifespan import lifespan
from api.limiter import limiter
from api.routes import register_routes

# ── Logging configuration ─────────────────────────────────────────────
_log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _log_level, logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
# /health is polled every 15 s — suppress its access log to avoid noise
logging.getLogger("uvicorn.access").addFilter(
    type(
        "_HealthFilter",
        (logging.Filter,),
        {"filter": lambda self, r: "/health" not in r.getMessage()},
    )()
)

logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Zabbix DevOps API",
    description="Manage Zabbix hosts and items via REST",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
# slowapi's handler is typed for RateLimitExceeded specifically, which mypy can't
# reconcile with Starlette's generic Exception-handler signature — known stub gap.
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# CORS — reads ALLOWED_ORIGINS from env (ConfigMap in OC, .env locally).
# Local Docker:   ALLOWED_ORIGINS=http://localhost:42069   (port required — non-standard)
# OpenShift:      ALLOWED_ORIGINS=https://your-frontend-route.apps.cluster.example.com  (no port — Route uses 443)
# Multiple:       comma-separated, e.g. "https://staging.example.com,https://prod.example.com"
# Defaults to "*" when the variable is not set (local dev without strict CORS).
_allowed_origins = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _log_requests(request: Request, call_next):
    """Log every request with method, path, status code, and duration. Skip /health."""
    if request.url.path == "/health":
        return await call_next(request)
    t0 = time.monotonic()
    response = await call_next(request)
    ms = (time.monotonic() - t0) * 1000
    logger.info(
        "%s %s → %d (%.0f ms)",
        request.method,
        request.url.path,
        response.status_code,
        ms,
    )
    return response


register_routes(app)

# Re-export manager instances for any code that imported them from Zabbix_Main
from api.managers import (  # noqa: E402, F401
    actions_bot,
    alert_bot,
    dashboard_bot,
    dc_bot,
    host_bot,
    item_bot,
    metrics_bot,
    report_bot,
    services_bot,
    sync_bot,
    zadmin_bot,
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=6769)
