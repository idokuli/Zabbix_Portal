"""Zabbix DevOps API entry point."""

import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.concurrency import run_in_threadpool

import Audit_Log
from Auth import try_decode_token
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
_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_MUTATING_ACTIONS = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}


def _record_portal_audit(request: Request, status_code: int, action: str) -> None:
    """Best-effort write to the portal's own audit log — see Audit_Log.py for why
    Zabbix's own auditlog.get can't be used for this."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return
    payload = try_decode_token(auth_header[7:])
    if not payload:
        return
    Audit_Log.record_action(
        user_id=int(payload["sub"]) if payload.get("sub") else None,
        username=payload.get("username", "unknown"),
        method=request.method,
        path=request.url.path,
        action=action,
        status_code=status_code,
        ip=request.client.host if request.client else "",
    )


@app.middleware("http")
async def _log_requests(request: Request, call_next):
    """Log every request with method, path, status code, and duration. Skip /health.
    Also records mutating requests (POST/PUT/PATCH/DELETE) into the portal's own audit
    log, keyed to the real logged-in user."""
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
    action = _MUTATING_ACTIONS.get(request.method)
    # /auth/login is a POST but the caller isn't authenticated yet — nothing to attribute.
    if action and request.url.path != "/auth/login":
        # record_action() is a blocking psycopg2 call — offload it so it doesn't stall
        # this worker's event loop on every mutating request.
        await run_in_threadpool(_record_portal_audit, request, response.status_code, action)
    return response


register_routes(app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=6769)  # noqa: S104 — must accept connections from outside the container/host network in dev and prod alike
