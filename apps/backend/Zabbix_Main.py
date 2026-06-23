import asyncio
import fcntl
import logging
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from io import BytesIO
from typing import Literal

import pandas as pd
from fastapi import Body, Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from Actions_Manager import Actions_Manager
from Alert_Manager import Alert_Manager
from Auth import (
    can_grant_roles,
    create_token,
    get_current_user,
    hash_password,
    require_admin,
    require_operator,
    require_root,
    verify_password,
)
from Dashboard_Manager import Dashboard_Manager
from DataCollection_Manager import DataCollection_Manager
from Database import get_conn, init_db, install_notify_triggers
from Host_Manager import Host_Manager
from Item_Manager import Item_Manager
from Metrics_Manager import Metrics_Manager
from Report_Manager import Report_Manager
from Services_Manager import Services_Manager
import User_Management as um
from ZabbixAdmin_Manager import ZabbixAdmin_Manager
from ZabbixSync import ZabbixSync

logger = logging.getLogger(__name__)

# ── Logging configuration ─────────────────────────────────────────────
_log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _log_level, logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
# /health is polled every 15 s — suppress its access log to avoid noise
logging.getLogger("uvicorn.access").addFilter(
    type("_HealthFilter", (logging.Filter,), {
        "filter": lambda self, r: "/health" not in r.getMessage()
    })()
)

# ── Managers ─────────────────────────────────────────────────────────
# Instantiated at module level; each manager handles Zabbix connection
# failures internally (sets self.zapi = None on error).
host_bot = Host_Manager()
item_bot = Item_Manager()
metrics_bot = Metrics_Manager()
dashboard_bot = Dashboard_Manager()
alert_bot = Alert_Manager()
sync_bot = ZabbixSync()
dc_bot = DataCollection_Manager()
report_bot = Report_Manager()
actions_bot = Actions_Manager()
zadmin_bot = ZabbixAdmin_Manager()
services_bot = Services_Manager()

# ── SSE: real-time push to connected frontend clients ─────────────────
_sync_subscribers: set[asyncio.Queue[str]] = set()
_sync_lock = threading.Lock()
_event_loop: asyncio.AbstractEventLoop | None = None


# How often the background checker evaluates alert rules against the latest
# Zabbix values. Lower = alerts fire sooner after a threshold is breached, at
# the cost of more frequent Zabbix API + DB calls. The true floor on latency is
# the monitored item's own collection interval — the checker can't see a value
# Zabbix hasn't polled yet. Override with ALERT_CHECK_INTERVAL (seconds).
_ALERT_CHECK_INTERVAL = max(5, int(os.getenv("ALERT_CHECK_INTERVAL", "15")))


def _alert_loop() -> None:
    while True:
        try:
            alert_bot.run_checks()
        except Exception as exc:
            logger.error("Alert checker error: %r", exc)
        time.sleep(_ALERT_CHECK_INTERVAL)


def _notify_sync_clients() -> None:
    """Thread-safe: push a sync event to all SSE clients."""
    if not _event_loop:
        return
    with _sync_lock:
        queues = list(_sync_subscribers)
    for q in queues:
        _event_loop.call_soon_threadsafe(q.put_nowait, "sync")


def _sync_tags() -> None:
    try:
        for team in um.get_overview():
            team_name = team["name"]
            for hostname in team["hosts"]:
                host_bot.tag_host(hostname, team_name)
    except Exception as exc:
        logger.warning("Tag sync failed (non-fatal): %r", exc)


_BG_LOCK_PATH = "/tmp/zabbix_portal_bg.lock"
_bg_lock_fd: "int | None" = None


def _acquire_bg_lock() -> bool:
    """Try to exclusively lock a file. Returns True for the one worker that wins.
    Uses a non-blocking flock so other workers skip background threads instead of hanging."""
    global _bg_lock_fd
    try:
        fd = os.open(_BG_LOCK_PATH, os.O_CREAT | os.O_WRONLY, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _bg_lock_fd = fd  # keep open for the lifetime of this process
        return True
    except (IOError, OSError):
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _event_loop
    # Database — must come first (all workers run schema init; it is idempotent)
    init_db()
    install_notify_triggers()
    um.seed_root()
    # Zabbix user/team bootstrap
    sync_bot.pull_users()
    sync_bot.bootstrap_teams()
    # SSE event-loop reference
    _event_loop = asyncio.get_running_loop()
    # Background threads run in exactly one worker (whichever acquires the lock first).
    # Other workers handle HTTP requests only.
    if _acquire_bg_lock():
        threading.Thread(target=_alert_loop, daemon=True, name="alert-checker").start()
        logger.info("Alert checker started (%s s interval) [bg worker].", _ALERT_CHECK_INTERVAL)
        sync_bot._on_sync = _notify_sync_clients
        sync_bot.start_realtime_sync()
        sync_bot.start_background_sync()
    else:
        logger.info("Background threads already running in another worker — skipping.")
    # Backfill host tags for assignments made before tagging was introduced
    _sync_tags()

    yield

    # Shutdown: close Zabbix sessions
    for bot in (host_bot, item_bot, metrics_bot, dashboard_bot, alert_bot, sync_bot):
        bot.close()


# ── App ───────────────────────────────────────────────────────────────
_limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Zabbix DevOps API",
    description="Manage Zabbix hosts and items via REST",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = _limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
        request.method, request.url.path, response.status_code, ms,
    )
    return response


# ── Request Schemas ───────────────────────────────────────────────────


class HostRequest(BaseModel):
    hostname: str
    ip: str
    template: str | None = "Linux by Zabbix agent"
    proxyid: str | None = None   # optional — "0" or "" means direct (no proxy)
    group_ids: list[str] = []    # Zabbix host group IDs; defaults to group "2" if empty


class ItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    value_type: int | None = 3  # 3 = integer (most common)
    delay: str = "1m"           # update interval; may include custom intervals e.g. "1m;50s/1-7,00:00-24:00"
    units: str = ""             # display units, e.g. "%", "B", "bps"
    history: str = "31d"        # how long to keep raw data
    trends: str = "365d"        # how long to keep aggregated trends
    description: str = ""       # optional item description
    status: int = 0             # 0=enabled 1=disabled
    timeout: str = ""           # per-item timeout override (Zabbix 7.x+); empty = use global


class TriggerRequest(BaseModel):
    hostname: str
    item_key: str
    trigger_name: str
    threshold: float | None = None                          # required for numeric items
    operator: Literal[">", ">=", "<", "<=", "=", "<>"] | None = ">"
    severity: int | None = 3
    string_pattern: str | None = None                      # set for string/text items
    match_type: Literal["like", "notlike", "regexp", "notregexp"] | None = "like"
    event_name: str = ""            # optional — shown in Problems view when trigger fires
    comments: str = ""              # optional — internal notes stored on the trigger


class TriggerUpdateRequest(BaseModel):
    description: str | None = None
    priority: int | None = None
    status: int | None = None       # 0=enabled 1=disabled
    expression: str | None = None
    event_name: str | None = None
    comments: str | None = None


class HttpQueryField(BaseModel):
    name: str
    value: str = ""

class HttpItemRequest(BaseModel):
    hostname: str
    item_name: str
    url: str
    item_key: str = ""
    request_method: int = 0       # 0=GET 1=POST 2=PUT 3=HEAD
    status_codes: str = "200"
    timeout: str = "15s"
    verify_peer: bool = True
    verify_host: bool = True
    follow_redirects: bool = True
    posts: str = ""
    post_type: int = 0            # 0=Raw 2=JSON 3=XML
    retrieve_mode: int = 0        # 0=body 1=headers 2=body+headers
    value_type: int = 3           # 3=integer (code), 0=float (time), 4=text (body)
    team_name: str = ""
    headers: str = ""             # newline-separated "Name: Value" custom request headers
    query_fields: list[HttpQueryField] = []
    http_proxy: str = ""
    # authentication
    authtype: int = 0             # 0=None, 1=Basic, 2=NTLM
    username: str = ""
    password: str = ""
    # SSL settings
    ssl_cert_file: str = ""
    ssl_key_file: str = ""
    ssl_key_password: str = ""
    # output options
    convert_to_json: bool = False   # output_format=1 in Zabbix
    allow_traps: bool = False
    status: int = 0                 # 0=enabled 1=disabled
    # regex preprocessing
    regex_preprocessing: bool = False
    regex_pattern: str = ""
    regex_output: str = "\\1"     # first capture group by default
    regex_no_match_value: str = "0"
    # common item settings
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""


class ServiceItemRequest(BaseModel):
    hostname: str
    service_type: str             # icmp_ping|icmp_loss|icmp_time|http|https|ssh|smtp|ftp|tcp_port
    port: int | None = None
    item_name: str = ""
    team_name: str = ""
    delay: str = "1m"
    history: str = "31d"
    trends: str = "365d"
    description: str = ""


class FileWatchRequest(BaseModel):
    hostname: str
    file_path: str
    check_type: str = "checksum"  # checksum | mtime | size | exists | folder_latest
    item_name: str = ""
    team_name: str = ""
    folder_os: str = "linux"      # linux | windows  (folder_latest only)
    create_trigger: bool = True
    trigger_name: str = ""
    trigger_priority: int = 2
    trigger_type: str = "change"  # change | age
    max_age_minutes: int = 60     # used when trigger_type = "age"
    delay: str = "1m"
    history: str = "31d"
    trends: str = "365d"
    description: str = ""


class ScriptItemRequest(BaseModel):
    hostname: str
    script_type: str = "bash"     # bash | powershell
    script_mode: str = "command"  # command | file
    script: str                   # inline command or absolute script path on host
    file_arg: str = ""            # optional file argument passed to the script
    item_name: str = ""
    value_type: int = 1           # 1=string default for script output
    team_name: str = ""
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0               # 0=enabled 1=disabled
    timeout: str = ""             # per-item timeout override (Zabbix 7.x+)


class BulkItemRequest(BaseModel):
    hostnames: list[str]
    item_type: str = "agent"      # agent | http | service | script
    item_name: str = ""
    item_key: str = ""
    value_type: int = 3
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    url: str = ""
    request_method: int = 0
    status_codes: str = "200"
    timeout: str = "15s"
    verify_peer: bool = True
    follow_redirects: bool = True
    posts: str = ""
    service_type: str = ""
    port: int | None = None
    # http auth fields
    authtype: int = 0
    username: str = ""
    password: str = ""
    regex_preprocessing: bool = False
    regex_pattern: str = ""
    regex_output: str = "\\1"
    regex_no_match_value: str = "0"
    # script fields
    script_type: str = "bash"
    script_mode: str = "command"
    script: str = ""
    file_arg: str = ""
    team_name: str = ""


class BulkTriggerRequest(BaseModel):
    hostnames: list[str]
    item_key: str
    trigger_name: str
    threshold: float
    operator: Literal[">", ">=", "<", "<="] | None = ">"
    priority: int = 3


class AcknowledgeRequest(BaseModel):
    problem_name: str = ""
    hostname: str = ""
    severity: int = 0
    note: str = ""


class HostTagItem(BaseModel):
    tag: str
    value: str = ""


class TagsUpdateRequest(BaseModel):
    tags: list[HostTagItem]


class DbOdbcRequest(BaseModel):
    hostname: str
    dsn: str
    sql_query: str
    description: str
    item_name: str = ""
    value_type: int = 3
    username: str = ""
    password: str = ""
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    status: int = 0
    timeout: str = ""


class DbAgent2Request(BaseModel):
    hostname: str
    engine: str
    conn_string: str
    metric: str
    extra_param: str = ""
    item_name: str = ""
    value_type: int | None = None


class SnmpItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str = ""
    snmp_oid: str
    value_type: int = 3
    snmp_version: int = 2               # 1=v1, 2=v2c, 3=v3
    snmp_community: str = "public"
    snmpv3_securityname: str = ""
    snmpv3_securitylevel: int = 0       # 0=noAuthNoPriv, 1=authNoPriv, 2=authPriv
    snmpv3_authprotocol: int = 0        # 0=MD5,1=SHA,2=SHA224,3=SHA256,4=SHA384,5=SHA512
    snmpv3_authpassphrase: str = ""
    snmpv3_privprotocol: int = 0        # 0=DES,1=AES128,2=AES192,3=AES256
    snmpv3_privpassphrase: str = ""
    snmpv3_contextname: str = ""
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class SnmpTrapRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str = "snmptrap.fallback"
    value_type: int = 1
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class InternalItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    value_type: int = 3
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class TrapperItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    value_type: int = 4
    allow_traps: bool = True
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class ExternalItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    value_type: int = 4
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class IpmiItemRequest(BaseModel):
    hostname: str
    item_name: str = ""
    ipmi_sensor: str
    item_key: str = ""
    value_type: int = 0
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class SshItemRequest(BaseModel):
    hostname: str
    item_name: str
    params: str
    item_key: str = ""
    authtype: int = 0               # 0=password, 1=public key
    username: str = ""
    password: str = ""
    publickey: str = ""
    privatekey: str = ""
    value_type: int = 1
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0
    timeout: str = ""


class TelnetItemRequest(BaseModel):
    hostname: str
    item_name: str
    params: str
    item_key: str = ""
    username: str = ""
    password: str = ""
    value_type: int = 1
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class JmxItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    jmx_endpoint: str = ""
    username: str = ""
    password: str = ""
    value_type: int = 3
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class CalculatedItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    formula: str
    value_type: int = 0
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class DependentItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    master_itemid: str
    value_type: int = 4
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0


class ScriptParamEntry(BaseModel):
    name: str
    value: str = ""


class ZabbixScriptItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    params: str
    parameters: list[ScriptParamEntry] = []
    value_type: int = 4
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0
    timeout: str = ""


class BrowserItemRequest(BaseModel):
    hostname: str
    item_name: str
    item_key: str
    params: str
    parameters: list[ScriptParamEntry] = []
    value_type: int = 4
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0
    timeout: str = ""


# ── Routes ────────────────────────────────────────────────────────────


def _live_team_id(current_user: dict) -> int | None:
    """Re-fetch team_id from the DB so stale JWTs (minted before a team change) still work."""
    try:
        user_id = int(current_user.get("sub", 0))
        live = um.get_user_by_id(user_id) if user_id else None
        return (live.get("team_id") if live else None) or current_user.get("team_id")
    except Exception:
        return current_user.get("team_id")


def _team_hostname_filter(current_user: dict) -> set[str] | None:
    """Return the set of hostnames visible to this user.
    Returns None for root/auditor (no restriction).
    Returns an empty set when the user has no team assignment.
    """
    roles = current_user.get("roles", [])
    if any(r in roles for r in ("root", "auditor")):
        return None
    team_id = _live_team_id(current_user)
    if not team_id:
        return set()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT hostname FROM host_assignments WHERE team_id = %s",
                (team_id,),
            )
            return {row["hostname"] for row in cur.fetchall()}
    finally:
        conn.close()


@app.get("/health", tags=["Status"], summary="API Health Check")
def health():
    """Returns whether the API is up and connected to Zabbix."""
    return {"status": "online", "zabbix_connected": host_bot.zapi is not None}


@app.post("/sync", tags=["Status"], summary="Trigger full Zabbix sync now")
def trigger_sync(current_user: dict = Depends(require_root)):
    """Immediately runs a full bidirectional sync (users, groups, hosts).
    Normally runs automatically every ZABBIX_SYNC_INTERVAL seconds."""
    sync_bot.full_sync()
    return {"message": "Sync complete."}


@app.get(
    "/sync/debug/{team_name}", tags=["Status"], summary="Show Zabbix state for a team"
)
def debug_team_sync(team_name: str, current_user: dict = Depends(require_root)):
    """Returns the Zabbix user group, host group, permissions, and hosts for a team."""
    if not sync_bot.zapi:
        raise HTTPException(status_code=503, detail="Zabbix not connected.")
    result: dict = {"team": team_name}
    try:
        rights_param = (
            "selectHostGroupRights"
            if sync_bot._rights_field == "hostgroup_rights"
            else "selectRights"
        )
        ug = sync_bot.zapi.usergroup.get(
            filter={"name": team_name},
            output=["usrgrpid", "name"],
            **{rights_param: ["id", "permission"]},
        )
        result["user_group"] = ug[0] if ug else None
    except Exception as e:
        result["user_group_error"] = repr(e)
    try:
        hg = sync_bot.zapi.hostgroup.get(
            filter={"name": team_name},
            output=["groupid", "name"],
        )
        result["host_group"] = hg[0] if hg else None
        if hg:
            hosts_in_group = sync_bot.zapi.host.get(
                groupids=[hg[0]["groupid"]],
                output=["hostid", "host"],
            )
            result["hosts_in_group"] = hosts_in_group
    except Exception as e:
        result["host_group_error"] = repr(e)
    return result


@app.get("/events", tags=["Status"], summary="SSE stream for real-time sync events")
async def sse_events(request: Request, current_user: dict = Depends(get_current_user)):
    """Server-Sent Events stream. Sends 'data: sync' whenever a full_sync completes."""
    queue: asyncio.Queue[str] = asyncio.Queue()
    with _sync_lock:
        _sync_subscribers.add(queue)

    async def _stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {event}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            with _sync_lock:
                _sync_subscribers.discard(queue)

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/hosts", tags=["Hosts"], summary="List All Hosts")
def get_all_hosts(current_user: dict = Depends(get_current_user)):
    """Returns hosts from Zabbix. root and auditor see all; others see only their team's hosts."""
    all_hosts = host_bot.get_hosts()
    roles = current_user.get("roles", [])
    if "root" in roles or "auditor" in roles:
        return {"count": len(all_hosts), "hosts": all_hosts}
    team_id = _live_team_id(current_user)
    if not team_id:
        return {"count": 0, "hosts": []}
    team_name = um.get_team_name(team_id)
    assigned = um.get_team_hostnames(team_id)
    # A host is visible if the DB assignment OR the Zabbix team tag matches
    def _in_team(h: dict) -> bool:
        if h["host"] in assigned:
            return True
        if team_name:
            return any(t.get("tag") == "team" and t.get("value") == team_name for t in h.get("tags", []))
        return False
    hosts = [h for h in all_hosts if _in_team(h)]
    return {"count": len(hosts), "hosts": hosts}


@app.get("/hosts/download", tags=["Hosts"], summary="Download Host Inventory (.xlsx or .csv)")
def download_inventory(format: str = "xlsx", current_user: dict = Depends(get_current_user)):
    """Generates a host inventory file. ?format=xlsx (default) or ?format=csv."""
    allowed = _team_hostname_filter(current_user)
    if format == "csv":
        data = host_bot.export_hosts_to_csv_bytes(hostname_filter=allowed)
        if not data:
            raise HTTPException(status_code=500, detail="Failed to generate CSV file.")
        return StreamingResponse(
            content=iter([data]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="Zabbix_Inventory.csv"'},
        )
    data = host_bot.export_hosts_to_excel_bytes(hostname_filter=allowed)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to generate Excel file.")
    return StreamingResponse(
        content=iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Zabbix_Inventory.xlsx"'},
    )


@app.get("/templates", tags=["Hosts"], summary="List available Zabbix templates")
def list_templates(current_user: dict = Depends(get_current_user)):
    """Returns all templates from Zabbix sorted by name."""
    return {"templates": host_bot.list_templates()}


@app.post("/hosts", tags=["Hosts"], summary="Create New Host", status_code=201)
def create_host(data: HostRequest, current_user: dict = Depends(require_operator)):
    """Creates a new Zabbix host. Auto-assigns to the creator's team if they have one."""
    result = host_bot.create_server(
        data.hostname, data.ip,
        group_ids=data.group_ids or None,
        template_name=data.template,
        proxyid=data.proxyid or None,
    )
    if not result:
        raise HTTPException(
            status_code=400, detail="Failed to create host. Check logs."
        )
    team_id = _live_team_id(current_user)
    if team_id:
        team_name = um.get_team_name(team_id)
        if not um.assign_host(team_id, data.hostname):
            logger.warning("assign_host failed for %r team_id=%s", data.hostname, team_id)
        if team_name:
            host_bot.tag_host(data.hostname, team_name)
            # Add to the team's Zabbix host group so the team user can see it in Zabbix
            host_bot.add_host_to_hostgroup(data.hostname, team_name)
    return {"message": "Host created successfully.", "hostid": result}


@app.post(
    "/hosts/bulk",
    tags=["Hosts"],
    summary="Bulk Create Hosts from CSV/XLSX",
    status_code=201,
)
async def bulk_create_hosts(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_operator),
):
    """Creates multiple hosts from a CSV/XLSX file with columns: hostname, ip, template(optional)."""
    filename = (file.filename or "").lower()
    if not filename.endswith((".csv", ".xlsx")):
        raise HTTPException(
            status_code=400, detail="Unsupported file type. Use .csv or .xlsx"
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > 10 * 1024 * 1024:  # 10 MB hard limit
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
    except Exception as exc:
        logger.error("Bulk upload: failed to parse file %r: %r", file.filename, exc)
        raise HTTPException(
            status_code=400, detail="Failed to parse file. Ensure it is a valid CSV or XLSX."
        ) from exc

    normalized = {str(c).strip().lower(): c for c in df.columns}
    hostname_col = normalized.get("hostname") or normalized.get("host")
    ip_col = normalized.get("ip") or normalized.get("ip_address")
    template_col = normalized.get("template")

    if not hostname_col or not ip_col:
        raise HTTPException(
            status_code=400,
            detail="File must contain hostname (or host) and ip (or ip_address) columns.",
        )

    created: list[dict] = []
    failed: list[dict] = []
    default_template = "Linux by Zabbix agent"
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None

    for idx, row in df.iterrows():
        hostname = str(row.get(hostname_col, "")).strip()
        ip = str(row.get(ip_col, "")).strip()
        template = str(row.get(template_col, "")).strip() if template_col else ""
        if not hostname or hostname.lower() == "nan" or not ip or ip.lower() == "nan":
            failed.append({"row": int(idx) + 2, "reason": "Missing hostname/ip"})
            continue

        hostid = host_bot.create_server(
            hostname, ip, template_name=template or default_template
        )
        if hostid:
            if team_id:
                um.assign_host(team_id, hostname)
            if team_name:
                host_bot.tag_host(hostname, team_name)
                host_bot.add_host_to_hostgroup(hostname, team_name)
            created.append(
                {"row": int(idx) + 2, "hostname": hostname, "hostid": hostid}
            )
        else:
            failed.append(
                {
                    "row": int(idx) + 2,
                    "hostname": hostname,
                    "reason": "Zabbix create failed",
                }
            )

    return {
        "message": "Bulk host import completed.",
        "total_rows": int(len(df)),
        "created_count": len(created),
        "failed_count": len(failed),
        "created": created,
        "failed": failed,
    }


@app.delete("/hosts/{hostname}", tags=["Hosts"], summary="Delete Host")
def delete_host(hostname: str, current_user: dict = Depends(require_operator)):
    """Deletes a host from Zabbix. team_lead and operator can only delete hosts in their own team."""
    if "root" not in current_user.get("roles", []):
        team_id = _live_team_id(current_user)
        if not team_id:
            raise HTTPException(
                status_code=403,
                detail="You can only delete hosts assigned to your own team.",
            )
        # Check ownership via DB assignment OR Zabbix team tag
        in_db = hostname in um.get_team_hostnames(team_id)
        if not in_db:
            team_name = um.get_team_name(team_id)
            in_zabbix = team_name and host_bot.get_host_team(hostname) == team_name
            if not in_zabbix:
                raise HTTPException(
                    status_code=403,
                    detail="You can only delete hosts assigned to your own team.",
                )
    um.unassign_host(hostname)
    success = host_bot.delete_server(hostname)
    if not success:
        raise HTTPException(
            status_code=404, detail=f"Host '{hostname}' not found or deletion failed."
        )
    return {"message": f"Host '{hostname}' deleted successfully."}


@app.put("/hosts/{hostname}/tags", tags=["Hosts"], summary="Update custom tags on a host")
def update_host_tags(
    hostname: str,
    body: TagsUpdateRequest,
    current_user: dict = Depends(require_operator),
):
    """Replace all non-team tags on a host. The 'team' tag is preserved automatically."""
    allowed = _team_hostname_filter(current_user)
    if allowed is not None and hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not in your team.")
    payload = [{"tag": t.tag, "value": t.value} for t in body.tags]
    ok, err = host_bot.update_host_tags(hostname, payload)
    if not ok:
        raise HTTPException(status_code=400, detail=err or "Failed to update tags.")
    return {"message": "Tags updated."}


@app.get("/items", tags=["Items"], summary="List all items across all hosts")
def list_all_items(
    search: str = Query(default="", description="Filter by name or key (substring match)"),
    hostname: str = Query(default="", description="Filter by exact hostname"),
    limit: int = Query(default=2000, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
):
    allowed = _team_hostname_filter(current_user)
    try:
        items = item_bot.list_all_items(search=search, hostname=hostname, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Zabbix API error: {e}")
    if allowed is not None:
        items = [i for i in items if i["hostname"] in allowed]
    return {"items": items, "total": len(items)}


@app.get("/items/keys", tags=["Items"], summary="List all item keys from Zabbix templates")
def list_item_keys(current_user: dict = Depends(get_current_user)):
    return {"items": item_bot.get_all_item_keys()}


@app.get("/items/{hostname}", tags=["Items"], summary="List items for a host")
def list_items(
    hostname: str,
    include_inherited: bool = False,
    current_user: dict = Depends(get_current_user),
):
    allowed = _team_hostname_filter(current_user)
    if allowed is not None and hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not assigned to your team.")
    return {"items": item_bot.list_items(hostname, include_inherited=include_inherited)}


class ItemUpdateRequest(BaseModel):
    name: str | None = None
    delay: str | None = None
    status: str | None = None
    key_: str | None = None


@app.put("/items/{itemid}", tags=["Items"], summary="Update item")
def update_item(itemid: str, body: ItemUpdateRequest, _user=Depends(require_operator)):
    try:
        item_bot.update_item(itemid, name=body.name, delay=body.delay, status=body.status, key_=body.key_)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/items/{itemid}", tags=["Items"], summary="Delete item by ID")
def delete_item(itemid: str, current_user: dict = Depends(require_operator)):
    allowed = _team_hostname_filter(current_user)
    if allowed is not None:
        hostname = item_bot.get_item_hostname(itemid)
        if not hostname or hostname not in allowed:
            raise HTTPException(status_code=403, detail="Item not assigned to your team.")
    if not item_bot.delete_item(itemid):
        raise HTTPException(
            status_code=404, detail="Item not found or could not be deleted."
        )
    return {"message": "Item deleted."}


@app.get("/triggers", tags=["Triggers"], summary="List all triggers across all hosts")
def list_all_triggers(
    search: str = Query(default=""),
    hostname: str = Query(default=""),
    limit: int = Query(default=2000, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
):
    allowed = _team_hostname_filter(current_user)
    try:
        triggers = item_bot.list_all_triggers(search=search, hostname=hostname, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Zabbix API error: {e}")
    if allowed is not None:
        triggers = [t for t in triggers if t["hostname"] in allowed]
    return {"triggers": triggers, "total": len(triggers)}


@app.get("/triggers/{hostname}", tags=["Triggers"], summary="List triggers for a host")
def list_triggers(hostname: str, current_user: dict = Depends(get_current_user)):
    allowed = _team_hostname_filter(current_user)
    if allowed is not None and hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not assigned to your team.")
    triggers, host_available = item_bot.list_triggers(hostname)
    return {"triggers": triggers, "host_available": host_available}


@app.delete("/triggers/{triggerid}", tags=["Triggers"], summary="Delete trigger by ID")
def delete_trigger(triggerid: str, current_user: dict = Depends(require_operator)):
    allowed = _team_hostname_filter(current_user)
    if allowed is not None:
        hostname = item_bot.get_trigger_hostname(triggerid)
        if not hostname or hostname not in allowed:
            raise HTTPException(status_code=403, detail="Trigger not assigned to your team.")
    if not item_bot.delete_trigger(triggerid):
        raise HTTPException(
            status_code=404, detail="Trigger not found or could not be deleted."
        )
    return {"message": "Trigger deleted."}


@app.put("/triggers/{triggerid}", tags=["Triggers"], summary="Update trigger name, severity, status or expression")
def update_trigger(triggerid: str, data: TriggerUpdateRequest, current_user: dict = Depends(require_operator)):
    allowed = _team_hostname_filter(current_user)
    if allowed is not None:
        hostname = item_bot.get_trigger_hostname(triggerid)
        if not hostname or hostname not in allowed:
            raise HTTPException(status_code=403, detail="Trigger not assigned to your team.")
    try:
        item_bot.update_trigger(
            triggerid,
            description=data.description,
            priority=data.priority,
            status=data.status,
            expression=data.expression,
            event_name=data.event_name,
            comments=data.comments,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Trigger updated."}


@app.get("/metrics/problems", tags=["Metrics"], summary="Active Zabbix problems")
def get_problems(current_user: dict = Depends(get_current_user)):
    problems = metrics_bot.get_problems()
    if not problems:
        return {"problems": problems}

    # root and auditor see all problems; everyone else sees only their team's hosts.
    allowed = _team_hostname_filter(current_user)
    if allowed is not None:
        problems = [p for p in problems if p["hostname"] in allowed]

    if not problems:
        return {"problems": problems}

    # Enrich acknowledged problems with who/when/note from our DB.
    acked_ids = [p["eventid"] for p in problems if p["acknowledged"]]
    if acked_ids:
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT DISTINCT ON (eventid) eventid, acknowledged_by, acked_at, note
                       FROM problem_acknowledgements
                       WHERE eventid = ANY(%s)
                       ORDER BY eventid, acked_at DESC""",
                    (acked_ids,),
                )
                ack_map = {
                    row["eventid"]: {
                        "ack_user": row["acknowledged_by"],
                        "ack_time": row["acked_at"].isoformat(),
                        "ack_note": row["note"],
                    }
                    for row in cur.fetchall()
                }
        finally:
            conn.close()
        for p in problems:
            if p["eventid"] in ack_map:
                p.update(ack_map[p["eventid"]])
    return {"problems": problems}


@app.post(
    "/metrics/problems/{eventid}/acknowledge",
    tags=["Metrics"],
    summary="Acknowledge a Zabbix problem",
)
def acknowledge_problem(
    eventid: str,
    body: AcknowledgeRequest = Body(default_factory=AcknowledgeRequest),
    current_user: dict = Depends(get_current_user),
):
    roles = current_user.get("roles", [])
    if "root" not in roles:
        if not body.hostname:
            raise HTTPException(
                status_code=400,
                detail="hostname is required to acknowledge a problem.",
            )
        user_team_id = _live_team_id(current_user)
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT team_id FROM host_assignments WHERE hostname = %s LIMIT 1",
                    (body.hostname,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
        if row is not None and row["team_id"] != user_team_id:
            raise HTTPException(
                status_code=403,
                detail="You can only acknowledge problems for hosts assigned to your team.",
            )

    username = current_user.get("username", "unknown")
    if not metrics_bot.acknowledge_problem(eventid, username=username, note=body.note):
        raise HTTPException(status_code=503, detail="Zabbix not connected or acknowledge failed.")
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO problem_acknowledgements
                       (eventid, problem_name, hostname, severity, acknowledged_by, note)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (eventid, body.problem_name, body.hostname, body.severity, username, body.note),
            )
            conn.commit()
    finally:
        conn.close()
    logger.info("Problem %s acknowledged by %s.", eventid, username)
    return {"message": "Problem acknowledged.", "acknowledged_by": username}


@app.get("/metrics/acknowledgements", tags=["Metrics"], summary="Acknowledgement audit log")
def list_acknowledgements(
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    allowed = _team_hostname_filter(current_user)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if allowed is None:
                cur.execute(
                    """SELECT id, eventid, problem_name, hostname, severity,
                              acknowledged_by, note, acked_at
                       FROM problem_acknowledgements
                       ORDER BY acked_at DESC LIMIT %s""",
                    (limit,),
                )
            else:
                team_id = _live_team_id(current_user)
                team_usernames: list[str] = []
                if team_id:
                    cur.execute(
                        "SELECT username FROM team_users WHERE team_id = %s",
                        (team_id,),
                    )
                    team_usernames = [row["username"] for row in cur.fetchall()]
                cur.execute(
                    """SELECT id, eventid, problem_name, hostname, severity,
                              acknowledged_by, note, acked_at
                       FROM problem_acknowledgements
                       WHERE hostname = ANY(%s) OR acknowledged_by = ANY(%s)
                       ORDER BY acked_at DESC LIMIT %s""",
                    (list(allowed), team_usernames, limit),
                )
            rows = cur.fetchall()
    finally:
        conn.close()
    return {
        "acknowledgements": [
            {
                "id": r["id"], "eventid": r["eventid"], "problem_name": r["problem_name"],
                "hostname": r["hostname"], "severity": r["severity"], "acknowledged_by": r["acknowledged_by"],
                "note": r["note"], "acked_at": r["acked_at"].isoformat(),
            }
            for r in rows
        ]
    }


@app.get("/metrics/problems/history", tags=["Metrics"], summary="Historical problems in a time window")
def get_problem_history(
    hours: int = Query(24, ge=1, le=720),
    severity_min: int = Query(0, ge=0, le=5),
    limit: int = Query(500, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
):
    """Return historical Zabbix problems (active + resolved) for the given window.
    Team-isolated — root/auditor see all hosts, others see only their team.
    """
    allowed = _team_hostname_filter(current_user)
    return {
        "problems": metrics_bot.get_problem_history(
            hours=hours,
            hostname_filter=allowed,
            severity_min=severity_min,
            limit=limit,
        )
    }


@app.get(
    "/metrics/history/{itemid}", tags=["Metrics"], summary="Item history time-series"
)
def get_item_history(
    itemid: str,
    minutes: int = 360,
    current_user: dict = Depends(get_current_user),
):
    if minutes < 1 or minutes > 10080:
        raise HTTPException(
            status_code=400, detail="minutes must be between 1 and 10080"
        )
    logger.debug("history request: item=%s minutes=%d", itemid, minutes)
    return metrics_bot.get_item_history(itemid, minutes)


@app.post("/items", tags=["Items"], summary="Add Monitoring Item", status_code=201)
def add_item(data: ItemRequest, current_user: dict = Depends(require_operator)):
    """Adds a monitoring item (metric) to an existing host."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_item(
        data.hostname, data.item_name, data.item_key, data.value_type, team_name or "",
        delay=data.delay, units=data.units,
        history=data.history, trends=data.trends,
        description=data.description,
        status=data.status, timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add item.")
    return {"message": "Item added successfully.", "itemid": item_id}


@app.post(
    "/triggers", tags=["Triggers"], summary="Add Trigger to Item", status_code=201
)
def add_trigger(data: TriggerRequest, current_user: dict = Depends(require_operator)):
    """Adds a trigger to an existing host item."""
    if data.string_pattern is not None:
        trigger_id, err = item_bot.add_string_trigger(
            hostname=data.hostname,
            item_key=data.item_key,
            trigger_name=data.trigger_name,
            pattern=data.string_pattern,
            match_type=data.match_type or "like",
            priority=data.severity or 3,
            event_name=data.event_name,
            comments=data.comments,
        )
    else:
        if data.threshold is None:
            raise HTTPException(status_code=422, detail="threshold is required for numeric triggers.")
        trigger_id, err = item_bot.add_trigger(
            hostname=data.hostname,
            item_key=data.item_key,
            trigger_name=data.trigger_name,
            threshold=data.threshold,
            operator=data.operator or ">",
            priority=data.severity or 3,
            event_name=data.event_name,
            comments=data.comments,
        )
    if not trigger_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add trigger.")
    return {"message": "Trigger added successfully.", "triggerid": trigger_id}


@app.post("/items/http", tags=["Items"], summary="Add HTTP Agent Item", status_code=201)
def add_http_item(data: HttpItemRequest, current_user: dict = Depends(require_operator)):
    """Adds an HTTP agent item (type 19). Zabbix server fetches the URL and stores the result."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_http_item(
        hostname=data.hostname, item_name=data.item_name, url=data.url,
        item_key=data.item_key, request_method=data.request_method,
        status_codes=data.status_codes, timeout=data.timeout,
        verify_peer=data.verify_peer, verify_host=data.verify_host,
        follow_redirects=data.follow_redirects,
        posts=data.posts, post_type=data.post_type,
        retrieve_mode=data.retrieve_mode,
        value_type=data.value_type,
        team_name=team_name or data.team_name,
        headers=data.headers,
        query_fields=[qf.model_dump() for qf in data.query_fields],
        http_proxy=data.http_proxy,
        authtype=data.authtype, username=data.username, password=data.password,
        ssl_cert_file=data.ssl_cert_file, ssl_key_file=data.ssl_key_file,
        ssl_key_password=data.ssl_key_password,
        convert_to_json=data.convert_to_json, allow_traps=data.allow_traps, status=data.status,
        regex_preprocessing=data.regex_preprocessing, regex_pattern=data.regex_pattern,
        regex_output=data.regex_output, regex_no_match_value=data.regex_no_match_value,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add HTTP item.")
    return {"message": "HTTP item added successfully.", "itemid": item_id}


@app.post("/items/service", tags=["Items"], summary="Add Service Check Item", status_code=201)
def add_service_item(data: ServiceItemRequest, current_user: dict = Depends(require_operator)):
    """Adds a simple-check service item (type 3): ICMP ping, TCP port, HTTP/HTTPS/SSH/SMTP/FTP."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_service_item(
        hostname=data.hostname, service_type=data.service_type,
        port=data.port, item_name=data.item_name,
        team_name=team_name or data.team_name,
        delay=data.delay, history=data.history,
        trends=data.trends, description=data.description,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add service item.")
    return {"message": "Service item added successfully.", "itemid": item_id}


@app.post("/items/filewatch", tags=["Items"], summary="Add File Watch Item", status_code=201)
def add_file_watch_item(data: FileWatchRequest, current_user: dict = Depends(require_operator)):
    """Creates an agent item that monitors a file property.
    Optionally auto-creates a change-detection trigger on the same item.
    """
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_file_watch_item(
        hostname=data.hostname,
        file_path=data.file_path,
        check_type=data.check_type,
        item_name=data.item_name,
        team_name=team_name or data.team_name,
        folder_os=data.folder_os,
        delay=data.delay, history=data.history,
        trends=data.trends, description=data.description,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add file watch item.")

    trigger_id = None
    trigger_err = None
    # folder_latest returns a string filename — only change triggers make sense for it
    supports_age_trigger = data.check_type == "mtime"
    if data.create_trigger and data.check_type != "folder_latest":
        if data.trigger_type == "age" and supports_age_trigger:
            trigger_name = data.trigger_name or f"File not updated in {data.max_age_minutes}m: {data.file_path} on {{HOST.NAME}}"
            trigger_id, trigger_err = item_bot.add_file_age_trigger(
                hostname=data.hostname,
                file_path=data.file_path,
                trigger_name=trigger_name,
                max_age_minutes=data.max_age_minutes,
                priority=data.trigger_priority,
            )
        else:
            key_map = {
                "checksum": f"vfs.file.md5sum[{data.file_path}]",
                "mtime":    f"vfs.file.time[{data.file_path},modify]",
                "size":     f"vfs.file.size[{data.file_path}]",
                "exists":   f"vfs.file.exists[{data.file_path}]",
            }
            item_key = key_map.get(data.check_type, "")
            trigger_name = data.trigger_name or f"File changed: {data.file_path} on {{HOST.NAME}}"
            trigger_id, trigger_err = item_bot.add_change_trigger(
                hostname=data.hostname,
                item_key=item_key,
                trigger_name=trigger_name,
                priority=data.trigger_priority,
            )

    return {
        "message": "File watch item added successfully.",
        "itemid": item_id,
        "triggerid": trigger_id,
        "trigger_error": trigger_err,
    }


@app.post("/items/script", tags=["Items"], summary="Add Script Check Item", status_code=201)
def add_script_item(data: ScriptItemRequest, current_user: dict = Depends(require_operator)):
    """Adds an agent item that runs a bash or PowerShell script via system.run[].
    Requires EnableRemoteCommands=1 in the Zabbix agent config on the target host.
    """
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_script_item(
        hostname=data.hostname,
        script_type=data.script_type,
        script_mode=data.script_mode,
        script=data.script,
        file_arg=data.file_arg,
        item_name=data.item_name,
        value_type=data.value_type,
        team_name=team_name or data.team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description,
        status=data.status, timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add script item.")
    return {"message": "Script item added successfully.", "itemid": item_id}


@app.post("/items/db/odbc", tags=["Items"], summary="Add ODBC database monitor item", status_code=201)
def add_db_odbc_item(data: DbOdbcRequest, current_user: dict = Depends(require_operator)):
    """Adds a Zabbix ODBC database monitor item (type 4). Requires an ODBC DSN configured on the Zabbix server."""
    allowed = _team_hostname_filter(current_user)
    if allowed is not None and data.hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not in your team.")
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_db_odbc_item(
        hostname=data.hostname,
        dsn=data.dsn,
        sql_query=data.sql_query,
        description=data.description,
        item_name=data.item_name,
        value_type=data.value_type,
        username=data.username,
        password=data.password,
        team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, status=data.status, timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add ODBC item.")
    return {"message": "ODBC item added.", "itemid": item_id}


@app.post("/items/db/agent2", tags=["Items"], summary="Add Agent2 database plugin item", status_code=201)
def add_db_agent2_item(data: DbAgent2Request, current_user: dict = Depends(require_operator)):
    """Adds a Zabbix Agent2 database plugin item. Requires Zabbix Agent2 with the relevant DB plugin on the host."""
    allowed = _team_hostname_filter(current_user)
    if allowed is not None and data.hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not in your team.")
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_db_agent2_item(
        hostname=data.hostname,
        engine=data.engine,
        conn_string=data.conn_string,
        metric=data.metric,
        item_name=data.item_name,
        extra_param=data.extra_param,
        value_type=data.value_type,
        team_name=team_name,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add Agent2 DB item.")
    return {"message": "Agent2 DB item added.", "itemid": item_id}


@app.post("/items/bulk", tags=["Items"], summary="Bulk Add Item to Multiple Hosts", status_code=201)
def bulk_add_items(data: BulkItemRequest, current_user: dict = Depends(require_operator)):
    """Adds the same item (agent, HTTP agent, or service check) to multiple hosts in one call."""
    if not data.hostnames:
        raise HTTPException(status_code=400, detail="hostnames list is empty.")
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    config = data.model_dump(exclude={"hostnames"})
    config["team_name"] = team_name or config.get("team_name", "")
    results = item_bot.bulk_add_items(data.hostnames, config)
    ok = sum(1 for r in results if not r["error"])
    return {"message": f"{ok}/{len(results)} items added successfully.", "results": results}


@app.post("/items/snmp", tags=["Items"], summary="Add SNMP Agent Item", status_code=201)
def add_snmp_item(data: SnmpItemRequest, current_user: dict = Depends(require_operator)):
    """Add an SNMP agent item (type 20). Supports SNMPv1, v2c, and v3."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_snmp_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        snmp_oid=data.snmp_oid, value_type=data.value_type,
        snmp_version=data.snmp_version, snmp_community=data.snmp_community,
        snmpv3_securityname=data.snmpv3_securityname, snmpv3_securitylevel=data.snmpv3_securitylevel,
        snmpv3_authprotocol=data.snmpv3_authprotocol, snmpv3_authpassphrase=data.snmpv3_authpassphrase,
        snmpv3_privprotocol=data.snmpv3_privprotocol, snmpv3_privpassphrase=data.snmpv3_privpassphrase,
        snmpv3_contextname=data.snmpv3_contextname,
        team_name=team_name, delay=data.delay, units=data.units,
        history=data.history, trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add SNMP item.")
    return {"message": "SNMP item added successfully.", "itemid": item_id}


@app.post("/items/snmptrap", tags=["Items"], summary="Add SNMP Trap Item", status_code=201)
def add_snmp_trap_item(data: SnmpTrapRequest, current_user: dict = Depends(require_operator)):
    """Add an SNMP trap item (type 17). Receives traps pushed by external devices."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_snmp_trap_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        value_type=data.value_type, team_name=team_name,
        history=data.history, trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add SNMP trap item.")
    return {"message": "SNMP trap item added successfully.", "itemid": item_id}


@app.post("/items/internal", tags=["Items"], summary="Add Zabbix Internal Item", status_code=201)
def add_internal_item(data: InternalItemRequest, current_user: dict = Depends(require_operator)):
    """Add a Zabbix internal item (type 5) using built-in zabbix[...] keys."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_internal_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add internal item.")
    return {"message": "Internal item added successfully.", "itemid": item_id}


@app.post("/items/trapper", tags=["Items"], summary="Add Zabbix Trapper Item", status_code=201)
def add_trapper_item(data: TrapperItemRequest, current_user: dict = Depends(require_operator)):
    """Add a Zabbix trapper item (type 2). Accepts data pushed via zabbix_sender."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_trapper_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        value_type=data.value_type, allow_traps=data.allow_traps, team_name=team_name,
        history=data.history, trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add trapper item.")
    return {"message": "Trapper item added successfully.", "itemid": item_id}


@app.post("/items/external", tags=["Items"], summary="Add External Check Item", status_code=201)
def add_external_item(data: ExternalItemRequest, current_user: dict = Depends(require_operator)):
    """Add an external check item (type 10). Script must exist in ExternalScripts dir on Zabbix server."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_external_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add external check item.")
    return {"message": "External check item added successfully.", "itemid": item_id}


@app.post("/items/ipmi", tags=["Items"], summary="Add IPMI Agent Item", status_code=201)
def add_ipmi_item(data: IpmiItemRequest, current_user: dict = Depends(require_operator)):
    """Add an IPMI agent item (type 12). Requires an IPMI interface on the host."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_ipmi_item(
        hostname=data.hostname, item_name=data.item_name, ipmi_sensor=data.ipmi_sensor,
        item_key=data.item_key, value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add IPMI item.")
    return {"message": "IPMI item added successfully.", "itemid": item_id}


@app.post("/items/ssh", tags=["Items"], summary="Add SSH Agent Item", status_code=201)
def add_ssh_item(data: SshItemRequest, current_user: dict = Depends(require_operator)):
    """Add an SSH agent item (type 13). Zabbix server SSHes into the host and runs the script."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_ssh_item(
        hostname=data.hostname, item_name=data.item_name, params=data.params,
        item_key=data.item_key, authtype=data.authtype,
        username=data.username, password=data.password,
        publickey=data.publickey, privatekey=data.privatekey,
        value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status, timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add SSH item.")
    return {"message": "SSH item added successfully.", "itemid": item_id}


@app.post("/items/telnet", tags=["Items"], summary="Add Telnet Agent Item", status_code=201)
def add_telnet_item(data: TelnetItemRequest, current_user: dict = Depends(require_operator)):
    """Add a Telnet agent item (type 14). Zabbix server connects via Telnet and runs the script."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_telnet_item(
        hostname=data.hostname, item_name=data.item_name, params=data.params,
        item_key=data.item_key, username=data.username, password=data.password,
        value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add Telnet item.")
    return {"message": "Telnet item added successfully.", "itemid": item_id}


@app.post("/items/jmx", tags=["Items"], summary="Add JMX Agent Item", status_code=201)
def add_jmx_item(data: JmxItemRequest, current_user: dict = Depends(require_operator)):
    """Add a JMX agent item (type 16). Requires Zabbix Java Gateway and a JMX interface."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_jmx_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        jmx_endpoint=data.jmx_endpoint, username=data.username, password=data.password,
        value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add JMX item.")
    return {"message": "JMX item added successfully.", "itemid": item_id}


@app.post("/items/calculated", tags=["Items"], summary="Add Calculated Item", status_code=201)
def add_calculated_item(data: CalculatedItemRequest, current_user: dict = Depends(require_operator)):
    """Add a calculated item (type 15). Derives its value from a formula on other items."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_calculated_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        formula=data.formula, value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add calculated item.")
    return {"message": "Calculated item added successfully.", "itemid": item_id}


@app.post("/items/dependent", tags=["Items"], summary="Add Dependent Item", status_code=201)
def add_dependent_item(data: DependentItemRequest, current_user: dict = Depends(require_operator)):
    """Add a dependent item (type 18). Preprocesses output from a master item."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_dependent_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        master_itemid=data.master_itemid, value_type=data.value_type, team_name=team_name,
        history=data.history, trends=data.trends, description=data.description, status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add dependent item.")
    return {"message": "Dependent item added successfully.", "itemid": item_id}


@app.post("/items/zabbix-script", tags=["Items"], summary="Add Zabbix Script Item (JS)", status_code=201)
def add_zabbix_script_item(data: ZabbixScriptItemRequest, current_user: dict = Depends(require_operator)):
    """Add a Zabbix Script item (type 21). JavaScript code runs on the Zabbix server/proxy."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_zabbix_script_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        params=data.params,
        parameters=[p.model_dump() for p in data.parameters],
        value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status, timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add Zabbix script item.")
    return {"message": "Zabbix script item added successfully.", "itemid": item_id}


@app.post("/items/browser", tags=["Items"], summary="Add Browser Item", status_code=201)
def add_browser_item(data: BrowserItemRequest, current_user: dict = Depends(require_operator)):
    """Add a Browser item (type 26). JavaScript browser automation on Zabbix 7.x+ server."""
    team_id = _live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else ""
    item_id, err = item_bot.add_browser_item(
        hostname=data.hostname, item_name=data.item_name, item_key=data.item_key,
        params=data.params,
        parameters=[p.model_dump() for p in data.parameters],
        value_type=data.value_type, team_name=team_name,
        delay=data.delay, units=data.units, history=data.history,
        trends=data.trends, description=data.description, status=data.status, timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add browser item.")
    return {"message": "Browser item added successfully.", "itemid": item_id}


@app.post("/triggers/bulk", tags=["Triggers"], summary="Bulk Add Trigger to Multiple Hosts", status_code=201)
def bulk_add_triggers(data: BulkTriggerRequest, current_user: dict = Depends(require_operator)):
    """Adds the same trigger to multiple hosts in one call."""
    if not data.hostnames:
        raise HTTPException(status_code=400, detail="hostnames list is empty.")
    config = data.model_dump(exclude={"hostnames"})
    results = item_bot.bulk_add_triggers(data.hostnames, config)
    ok = sum(1 for r in results if not r["error"])
    return {"message": f"{ok}/{len(results)} triggers added successfully.", "results": results}


# ── Dashboard routes ──────────────────────────────────────────────────


@app.get("/dashboard/graphs", tags=["Dashboard"], summary="List Zabbix graphs")
def list_graphs(
    hostid: str | None = None, current_user: dict = Depends(get_current_user)
):
    allowed = _team_hostname_filter(current_user)
    graphs = dashboard_bot.get_graphs(hostid)
    if allowed is not None:
        graphs = [
            g for g in graphs
            if any(h.get("host") in allowed for h in g.get("hosts", []))
        ]
    return {"graphs": graphs}


@app.get(
    "/dashboard/graphs/{graphid}/image",
    tags=["Dashboard"],
    summary="Proxy native Zabbix graph image",
)
def get_graph_image(
    graphid: str,
    period: int = 3600,
    width: int = 900,
    height: int = 200,
    current_user: dict = Depends(get_current_user),
):
    img = dashboard_bot.get_graph_image(graphid, period, width, height)
    if not img:
        raise HTTPException(
            status_code=503, detail="Graph image unavailable — check Zabbix web session"
        )
    return Response(content=img, media_type="image/png")


@app.get(
    "/dashboard/graphs/{graphid}/data",
    tags=["Dashboard"],
    summary="Chart.js data for a graph",
)
def get_graph_data(
    graphid: str,
    minutes: int = 360,
    current_user: dict = Depends(get_current_user),
):
    if minutes < 1 or minutes > 10080:
        raise HTTPException(
            status_code=400, detail="minutes must be between 1 and 10080"
        )
    return dashboard_bot.get_graph_data(graphid, minutes)


@app.get(
    "/dashboard/hosts/metrics",
    tags=["Dashboard"],
    summary="Last metric values for all hosts",
)
def get_hosts_metrics(current_user: dict = Depends(get_current_user)):
    allowed = _team_hostname_filter(current_user)
    hosts = dashboard_bot.get_hosts_metrics()
    if allowed is not None:
        hosts = [h for h in hosts if h.get("hostname") in allowed]
    return {"hosts": hosts}


@app.get(
    "/dashboard/items/recent", tags=["Dashboard"], summary="Recently created items"
)
def get_recent_items(limit: int = 30, current_user: dict = Depends(get_current_user)):
    allowed = _team_hostname_filter(current_user)
    items = dashboard_bot.get_recent_items(min(limit, 100))
    if allowed is not None:
        items = [i for i in items if i.get("hostname") in allowed]
    return {"items": items}


class DashboardLayoutRequest(BaseModel):
    scope: str
    widgets: list[dict]


class DashboardCreateRequest(BaseModel):
    scope: str
    name: str


class DashboardRenameRequest(BaseModel):
    scope: str
    name: str


def _dashboard_owner(scope: str, current_user: dict) -> tuple[str, int]:
    if scope not in ("user", "team"):
        raise HTTPException(status_code=400, detail="scope must be 'user' or 'team'")
    if scope == "team":
        team_id = _live_team_id(current_user)
        if not team_id:
            raise HTTPException(status_code=400, detail="You are not in a team.")
        return "team", int(team_id)
    return "user", int(current_user.get("sub", 0))


@app.get("/dashboard/list", tags=["Dashboard"], summary="List dashboards for a scope")
def list_dashboards(scope: str = "user", current_user: dict = Depends(get_current_user)):
    if scope == "team" and not _live_team_id(current_user):
        return {"dashboards": []}
    owner_type, owner_id = _dashboard_owner(scope, current_user)
    dashboards = um.list_dashboards(owner_type, owner_id)
    if not dashboards:
        # Every scope always has at least one dashboard to select; the default
        # "dashboard" page is created lazily on first save.
        dashboards = [{"page": "dashboard", "name": "Dashboard", "updated_at": None}]
    return {"dashboards": dashboards}


@app.post("/dashboard", tags=["Dashboard"], summary="Create a new dashboard")
def create_dashboard(
    data: DashboardCreateRequest, current_user: dict = Depends(get_current_user)
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Dashboard name is required.")
    owner_type, owner_id = _dashboard_owner(data.scope, current_user)
    page = f"dash-{uuid.uuid4().hex[:12]}"
    if not um.create_dashboard(owner_type, owner_id, name, page):
        raise HTTPException(status_code=500, detail="Failed to create dashboard.")
    return {"page": page, "name": name}


@app.put(
    "/dashboard/{page}/rename", tags=["Dashboard"], summary="Rename a dashboard"
)
def rename_dashboard(
    page: str,
    data: DashboardRenameRequest,
    current_user: dict = Depends(get_current_user),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Dashboard name is required.")
    owner_type, owner_id = _dashboard_owner(data.scope, current_user)
    if not um.rename_dashboard(owner_type, owner_id, page, name):
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return {"message": "Dashboard renamed."}


@app.delete("/dashboard/{page}", tags=["Dashboard"], summary="Delete a dashboard")
def delete_dashboard(
    page: str, scope: str = "user", current_user: dict = Depends(get_current_user)
):
    owner_type, owner_id = _dashboard_owner(scope, current_user)
    if not um.delete_dashboard(owner_type, owner_id, page):
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return {"message": "Dashboard deleted."}


@app.get("/dashboard/layout", tags=["Dashboard"], summary="Get saved dashboard layout")
def get_dashboard_layout(
    scope: str = "user",
    page: str = "dashboard",
    current_user: dict = Depends(get_current_user),
):
    if scope == "team" and not _live_team_id(current_user):
        return {"widgets": [], "scope": "team"}
    owner_type, owner_id = _dashboard_owner(scope, current_user)
    return {"widgets": um.get_dashboard_layout(owner_type, owner_id, page), "scope": scope}


@app.put("/dashboard/layout", tags=["Dashboard"], summary="Save dashboard layout")
def save_dashboard_layout(
    data: DashboardLayoutRequest,
    page: str = "dashboard",
    current_user: dict = Depends(get_current_user),
):
    owner_type, owner_id = _dashboard_owner(data.scope, current_user)
    if not um.save_dashboard_layout(owner_type, owner_id, data.widgets, page):
        raise HTTPException(status_code=500, detail="Failed to save layout.")
    return {"message": "Layout saved."}


# ── Auth / Teams / Users schemas ──────────────────────────────────────


class LoginRequest(BaseModel):
    username: str
    password: str


class TeamRequest(BaseModel):
    name: str
    description: str | None = ""


class UserRequest(BaseModel):
    username: str
    password: str
    email: str | None = ""
    roles: list[str] = Field(default_factory=lambda: ["member"])
    team_id: int | None = None


class HostAssignRequest(BaseModel):
    hostname: str


class PasswordChangeRequest(BaseModel):
    new_password: str


class UserUpdateRequest(BaseModel):
    roles: list[str]
    team_id: int | None = None


# ── Auth routes ───────────────────────────────────────────────────────


@app.post("/auth/login", tags=["Auth"], summary="Login")
@_limiter.limit("10/minute")  # brute-force protection — 10 attempts per IP per minute
def login(request: Request, data: LoginRequest):
    user = um.get_user_by_username(data.username)
    if not user or not verify_password(data.password, user["password_hash"]):
        logger.warning("Failed login attempt for username %r from %s.", data.username, request.client.host if request.client else "unknown")
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    logger.info("User %r logged in (roles=%s) from %s.", data.username, user["roles"], request.client.host if request.client else "unknown")
    token = create_token(user["id"], user["username"], user["roles"], user["team_id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "roles": user["roles"],
            "team_id": user["team_id"],
        },
    }


@app.get("/auth/me", tags=["Auth"], summary="Current user")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


# ── Teams routes ──────────────────────────────────────────────────────


@app.get("/teams/overview", tags=["Teams"], summary="Teams with members and hosts")
def teams_overview(current_user: dict = Depends(get_current_user)):
    # root and auditor see all teams; everyone else sees only their own
    roles = current_user.get("roles", [])
    team_filter = (
        None if ("root" in roles or "auditor" in roles) else _live_team_id(current_user)
    )
    return {"teams": um.get_overview(team_id=team_filter)}


@app.get("/teams", tags=["Teams"], summary="List teams")
def list_teams(current_user: dict = Depends(get_current_user)):
    return {"teams": um.list_teams()}


@app.post("/teams", tags=["Teams"], summary="Create team", status_code=201)
def create_team(data: TeamRequest, current_user: dict = Depends(require_root)):
    result = um.create_team(data.name, data.description or "")
    if not result:
        raise HTTPException(
            status_code=400, detail="Failed to create team. Name may already exist."
        )
    sync_bot.push_team(data.name)
    return result


@app.delete("/teams/{team_id}", tags=["Teams"], summary="Delete team")
def delete_team(team_id: int, current_user: dict = Depends(require_root)):
    team_name = um.get_team_name(team_id)
    if not um.delete_team(team_id):
        raise HTTPException(status_code=404, detail="Team not found.")
    if team_name:
        sync_bot.delete_team(team_name)
    return {"message": "Team deleted."}


@app.post(
    "/teams/{team_id}/hosts",
    tags=["Teams"],
    summary="Assign host to team",
    status_code=201,
)
def assign_host(
    team_id: int, data: HostAssignRequest, current_user: dict = Depends(require_admin)
):
    if (
        "root" not in current_user.get("roles", [])
        and _live_team_id(current_user) != team_id
    ):
        raise HTTPException(
            status_code=403, detail="You can only assign hosts to your own team."
        )
    if not um.assign_host(team_id, data.hostname):
        raise HTTPException(status_code=400, detail="Failed to assign host.")
    team_name = um.get_team_name(team_id)
    if team_name:
        host_bot.tag_host(data.hostname, team_name)
        sync_bot.push_host_to_team(data.hostname, team_name)
    return {"message": "Host assigned."}


@app.delete(
    "/teams/{team_id}/hosts/{hostname}", tags=["Teams"], summary="Remove host from team"
)
def unassign_host(
    team_id: int, hostname: str, current_user: dict = Depends(require_admin)
):
    if (
        "root" not in current_user.get("roles", [])
        and _live_team_id(current_user) != team_id
    ):
        raise HTTPException(
            status_code=403, detail="You can only remove hosts from your own team."
        )
    team_name = um.get_team_name(team_id)
    if not um.unassign_host(hostname):
        raise HTTPException(status_code=404, detail="Host assignment not found.")
    host_bot.untag_host(hostname)
    if team_name:
        sync_bot.remove_host_from_team(hostname, team_name)
    return {"message": "Host removed from team."}


# ── Users routes ──────────────────────────────────────────────────────


@app.get("/users", tags=["Users"], summary="List users")
def list_users(current_user: dict = Depends(require_admin)):
    """root sees all users; team_lead sees only users in their own team."""
    if "root" in current_user.get("roles", []):
        return {"users": um.list_users()}
    team_id = _live_team_id(current_user)
    if not team_id:
        return {"users": []}
    return {"users": um.list_users(team_id=team_id)}


@app.put("/users/{user_id}", tags=["Users"], summary="Update user roles and team")
def update_user(
    user_id: int, data: UserUpdateRequest, current_user: dict = Depends(require_admin)
):
    target = um.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if "root" not in current_user.get("roles", []) and target.get(
        "team_id"
    ) != _live_team_id(current_user):
        raise HTTPException(
            status_code=403, detail="You can only edit users in your own team."
        )
    if not can_grant_roles(current_user.get("roles", []), data.roles):
        raise HTTPException(
            status_code=403, detail="You cannot assign roles higher than your own."
        )
    if not um.update_user_profile(user_id, data.roles, data.team_id):
        raise HTTPException(status_code=400, detail="Failed to update user.")
    team_name = um.get_team_name(data.team_id) if data.team_id else None
    sync_bot.push_user(target["username"], "", data.roles, team_name)
    return {"message": "User updated."}


@app.post("/users", tags=["Teams"], summary="Create user", status_code=201)
def create_user(data: UserRequest, current_user: dict = Depends(require_admin)):
    if len(data.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters long."
        )
    if "root" not in current_user.get("roles", []) and data.team_id != _live_team_id(
        current_user
    ):
        raise HTTPException(
            status_code=403, detail="You can only create users in your own team."
        )
    if not can_grant_roles(current_user.get("roles", []), data.roles or ["member"]):
        raise HTTPException(
            status_code=403, detail="You cannot assign roles higher than your own."
        )
    roles = data.roles or ["member"]
    result = um.create_user(
        data.username,
        hash_password(data.password),
        data.email or "",
        roles,
        data.team_id,
    )
    if not result:
        raise HTTPException(
            status_code=400, detail="Failed to create user. Username may already exist."
        )
    team_name = um.get_team_name(data.team_id) if data.team_id else None
    sync_bot.push_user(data.username, data.password, roles, team_name)
    return result


@app.put("/users/{user_id}/password", tags=["Teams"], summary="Change user password")
def change_password(
    user_id: int,
    data: PasswordChangeRequest,
    current_user: dict = Depends(require_admin),
):
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters long."
        )
    target = um.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if "root" not in current_user.get("roles", []) and target.get(
        "team_id"
    ) != _live_team_id(current_user):
        raise HTTPException(
            status_code=403,
            detail="You can only change passwords for users in your own team.",
        )
    if not um.update_password(user_id, hash_password(data.new_password)):
        raise HTTPException(status_code=400, detail="Failed to update password.")
    sync_bot.update_password(target["username"], data.new_password)
    return {"message": "Password updated."}


@app.delete("/users/{user_id}", tags=["Teams"], summary="Delete user")
def delete_user(user_id: int, current_user: dict = Depends(require_admin)):
    target = um.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if "root" not in current_user.get("roles", []) and target.get(
        "team_id"
    ) != _live_team_id(current_user):
        raise HTTPException(
            status_code=403, detail="You can only delete users in your own team."
        )
    if not um.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found.")
    sync_bot.delete_user(target["username"])
    return {"message": "User deleted."}


# ── Alert rules ───────────────────────────────────────────────────────

class AlertRuleCreate(BaseModel):
    item_id: str
    item_name: str
    hostname: str
    operator: str
    threshold: float
    severity: int = 2


class AlertRuleUpdate(BaseModel):
    operator: str
    threshold: float
    severity: int
    item_id: str | None = None
    item_name: str | None = None
    hostname: str | None = None


@app.get("/alerts/rules", tags=["Alerts"], summary="List alert rules for current user")
def list_alert_rules(current_user: dict = Depends(get_current_user)):
    return {"rules": alert_bot.get_rules(int(current_user["sub"]))}


@app.post("/alerts/rules", tags=["Alerts"], summary="Create alert rule", status_code=201)
def create_alert_rule(data: AlertRuleCreate, current_user: dict = Depends(get_current_user)):
    if data.operator not in (">", "<", ">=", "<="):
        raise HTTPException(status_code=400, detail="operator must be >, <, >=, or <=")
    if not (0 <= data.severity <= 5):
        raise HTTPException(status_code=400, detail="severity must be 0–5")
    result = alert_bot.create_rule(
        int(current_user["sub"]), data.item_id, data.item_name,
        data.hostname, data.operator, data.threshold, data.severity,
    )
    return result


@app.put("/alerts/rules/{rule_id}", tags=["Alerts"], summary="Update alert rule")
def update_alert_rule(
    rule_id: int, data: AlertRuleUpdate, current_user: dict = Depends(get_current_user)
):
    if data.operator not in (">", "<", ">=", "<="):
        raise HTTPException(status_code=400, detail="operator must be >, <, >=, or <=")
    if not (0 <= data.severity <= 5):
        raise HTTPException(status_code=400, detail="severity must be 0–5")
    if not alert_bot.update_rule(
        rule_id, int(current_user["sub"]), data.operator, data.threshold, data.severity,
        data.item_id, data.item_name, data.hostname,
    ):
        raise HTTPException(status_code=404, detail="Rule not found.")
    return {"message": "Rule updated."}


@app.delete("/alerts/rules/{rule_id}", tags=["Alerts"], summary="Delete alert rule")
def delete_alert_rule(rule_id: int, current_user: dict = Depends(get_current_user)):
    if not alert_bot.delete_rule(rule_id, int(current_user["sub"])):
        raise HTTPException(status_code=404, detail="Rule not found.")
    return {"message": "Rule deleted."}


@app.patch("/alerts/rules/{rule_id}/toggle", tags=["Alerts"], summary="Enable/disable alert rule")
def toggle_alert_rule(rule_id: int, current_user: dict = Depends(get_current_user)):
    result = alert_bot.toggle_rule(rule_id, int(current_user["sub"]))
    if result is None:
        raise HTTPException(status_code=404, detail="Rule not found.")
    return {"enabled": result}


@app.get("/alerts/events", tags=["Alerts"], summary="Recent alert events for current user")
def get_alert_events(
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    clamped = max(1, min(limit, 500))
    return {"events": alert_bot.get_events(int(current_user["sub"]), limit=clamped)}


# ── Data Collection ───────────────────────────────────────────────────

# Template Groups
@app.get("/dc/template-groups", tags=["DataCollection"], summary="List template groups")
def list_template_groups(current_user: dict = Depends(get_current_user)):
    return {"groups": dc_bot.list_template_groups()}

@app.post("/dc/template-groups", tags=["DataCollection"], summary="Create template group", status_code=201)
def create_template_group(body: dict = Body(...), current_user: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    gid, err = dc_bot.create_template_group(name)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"groupid": gid, "message": f"Template group '{name}' created."}

@app.put("/dc/template-groups/{groupid}", tags=["DataCollection"], summary="Rename template group")
def update_template_group(groupid: str, body: dict = Body(...), current_user: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    if not dc_bot.update_template_group(groupid, name):
        raise HTTPException(status_code=400, detail="Failed to update template group.")
    return {"message": "Template group updated."}

@app.delete("/dc/template-groups/{groupid}", tags=["DataCollection"], summary="Delete template group")
def delete_template_group(groupid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_template_group(groupid):
        raise HTTPException(status_code=404, detail="Template group not found or could not be deleted.")
    return {"message": "Template group deleted."}

@app.get("/dc/template-groups/{groupid}/members", tags=["DataCollection"], summary="Templates in a group")
def get_template_group_members(groupid: str, current_user: dict = Depends(get_current_user)):
    return {"templates": dc_bot.get_template_group_members(groupid)}


# Host Groups
@app.get("/dc/host-groups", tags=["DataCollection"], summary="List host groups")
def list_host_groups(current_user: dict = Depends(get_current_user)):
    return {"groups": dc_bot.list_host_groups()}

@app.post("/dc/host-groups", tags=["DataCollection"], summary="Create host group", status_code=201)
def create_host_group(body: dict = Body(...), current_user: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    gid, err = dc_bot.create_host_group(name)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"groupid": gid, "message": f"Host group '{name}' created."}

@app.put("/dc/host-groups/{groupid}", tags=["DataCollection"], summary="Rename host group")
def update_host_group(groupid: str, body: dict = Body(...), current_user: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    if not dc_bot.update_host_group(groupid, name):
        raise HTTPException(status_code=400, detail="Failed to update host group.")
    return {"message": "Host group updated."}

@app.delete("/dc/host-groups/{groupid}", tags=["DataCollection"], summary="Delete host group")
def delete_host_group(groupid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_host_group(groupid):
        raise HTTPException(status_code=404, detail="Host group not found or could not be deleted.")
    return {"message": "Host group deleted."}

@app.get("/dc/host-groups/{groupid}/members", tags=["DataCollection"], summary="Hosts in a group")
def get_host_group_members(groupid: str, current_user: dict = Depends(get_current_user)):
    return {"hosts": dc_bot.get_host_group_members(groupid)}


# Templates
@app.get("/dc/templates", tags=["DataCollection"], summary="List templates")
def list_dc_templates(
    search: str = Query(default=""),
    current_user: dict = Depends(get_current_user),
):
    return {"templates": dc_bot.list_templates(search=search)}

@app.post("/dc/templates", tags=["DataCollection"], summary="Create template", status_code=201)
def create_dc_template(body: dict = Body(...), current_user: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    group_ids = body.get("group_ids") or []
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    tid, err = dc_bot.create_template(
        name,
        group_ids,
        description=body.get("description", ""),
        visible_name=body.get("visible_name", ""),
        template_ids=body.get("template_ids") or [],
        tags=body.get("tags") or [],
        macros=body.get("macros") or [],
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"templateid": tid, "message": f"Template '{name}' created."}

@app.delete("/dc/templates/{templateid}", tags=["DataCollection"], summary="Delete template")
def delete_dc_template(templateid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_template(templateid):
        raise HTTPException(status_code=404, detail="Template not found or could not be deleted.")
    return {"message": "Template deleted."}


# Maintenance
@app.get("/dc/maintenances", tags=["DataCollection"], summary="List maintenances")
def list_maintenances(current_user: dict = Depends(get_current_user)):
    return {"maintenances": dc_bot.list_maintenances()}

@app.post("/dc/maintenances", tags=["DataCollection"], summary="Create maintenance", status_code=201)
def create_maintenance(body: dict = Body(...), current_user: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    mid, err = dc_bot.create_maintenance(
        name=name,
        maintenance_type=int(body.get("maintenance_type", 0)),
        active_since=int(body.get("active_since", 0)),
        active_till=int(body.get("active_till", 0)),
        hostids=body.get("hostids") or [],
        groupids=body.get("groupids") or [],
        description=body.get("description", ""),
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"maintenanceid": mid, "message": f"Maintenance '{name}' created."}

@app.delete("/dc/maintenances/{maintenanceid}", tags=["DataCollection"], summary="Delete maintenance")
def delete_maintenance(maintenanceid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_maintenance(maintenanceid):
        raise HTTPException(status_code=404, detail="Maintenance not found or could not be deleted.")
    return {"message": "Maintenance deleted."}


# Event Correlation
@app.get("/dc/correlations", tags=["DataCollection"], summary="List correlations")
def list_correlations(current_user: dict = Depends(get_current_user)):
    return {"correlations": dc_bot.list_correlations()}

@app.post("/dc/correlations", tags=["DataCollection"], summary="Create correlation", status_code=201)
def create_correlation(body: dict = Body(...), current_user: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    cid, err = dc_bot.create_correlation(
        name=name,
        description=body.get("description", ""),
        status=int(body.get("status", 0)),
        conditions=body.get("conditions", []),
        evaltype=int(body.get("evaltype", 0)),
        operation_type=int(body.get("operation_type", 0)),
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"correlationid": cid, "message": f"Correlation '{name}' created."}

@app.delete("/dc/correlations/{correlationid}", tags=["DataCollection"], summary="Delete correlation")
def delete_correlation(correlationid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_correlation(correlationid):
        raise HTTPException(status_code=404, detail="Correlation not found or could not be deleted.")
    return {"message": "Correlation deleted."}


# Discovery Rules
@app.get("/dc/discovery-rules", tags=["DataCollection"], summary="List discovery rules")
def list_discovery_rules(current_user: dict = Depends(get_current_user)):
    return {"rules": dc_bot.list_discovery_rules()}

@app.post("/dc/discovery-rules", tags=["DataCollection"], summary="Create discovery rule", status_code=201)
def create_discovery_rule(body: dict = Body(...), current_user: dict = Depends(require_admin)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    rid, err = dc_bot.create_discovery_rule(
        name=name,
        iprange=body.get("iprange", ""),
        delay=body.get("delay", "1h"),
        check_types=body.get("check_types") or ["icmp"],
        ports=body.get("ports", ""),
    )
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"druleid": rid, "message": f"Discovery rule '{name}' created."}

@app.delete("/dc/discovery-rules/{druleid}", tags=["DataCollection"], summary="Delete discovery rule")
def delete_discovery_rule(druleid: str, current_user: dict = Depends(require_admin)):
    if not dc_bot.delete_discovery_rule(druleid):
        raise HTTPException(status_code=404, detail="Discovery rule not found or could not be deleted.")
    return {"message": "Discovery rule deleted."}


# ── Reports ───────────────────────────────────────────────────────────


@app.get("/reports/top-triggers")
def reports_top_triggers(
    limit: int = Query(100, ge=1, le=500),
    severity_min: int = Query(0, ge=0, le=5),
    hours: int = Query(24, ge=1, le=720),
    _user=Depends(get_current_user),
):
    try:
        return {"triggers": report_bot.get_top_triggers(limit=limit, severity_min=severity_min, hours=hours)}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/reports/audit-log")
def reports_audit_log(
    limit: int = Query(200, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=720),
    _user=Depends(require_admin),
):
    import time as _time
    time_from = int(_time.time()) - hours * 3600
    try:
        return {"entries": report_bot.get_audit_log(limit=limit, time_from=time_from)}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/reports/action-log")
def reports_action_log(
    limit: int = Query(200, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=720),
    _user=Depends(get_current_user),
):
    import time as _time
    time_from = int(_time.time()) - hours * 3600
    try:
        return {"entries": report_bot.get_action_log(limit=limit, time_from=time_from)}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/reports/availability")
def reports_availability(
    hours: int = Query(24, ge=1, le=720),
    groupid: str | None = Query(None),
    _user=Depends(get_current_user),
):
    try:
        return {"hosts": report_bot.get_availability(hours=hours, groupid=groupid)}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/reports/notifications")
def reports_notifications(
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(500, ge=1, le=1000),
    _user=Depends(get_current_user),
):
    try:
        return {"notifications": report_bot.get_notification_history(hours=hours, limit=limit)}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Actions ────────────────────────────────────────────────────────────


@app.get("/actions")
def list_actions(
    eventsource: int | None = Query(None, ge=0, le=4),
    _user=Depends(get_current_user),
):
    return {"actions": actions_bot.list_actions(eventsource=eventsource)}


class ActionCreateRequest(BaseModel):
    name: str
    eventsource: int = 0
    esc_period: str = "1h"


@app.post("/actions")
def create_action(body: ActionCreateRequest, _user=Depends(require_admin)):
    try:
        aid = actions_bot.create_action(body.name, body.eventsource, body.esc_period)
        return {"actionid": aid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/actions/{actionid}")
def delete_action(actionid: str, _user=Depends(require_admin)):
    try:
        actions_bot.delete_action(actionid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.put("/actions/{actionid}/toggle")
def toggle_action(actionid: str, status: int = Body(..., embed=True), _user=Depends(require_admin)):
    try:
        actions_bot.toggle_action(actionid, status)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Media Types ────────────────────────────────────────────────────────


@app.get("/media-types")
def list_media_types(_user=Depends(get_current_user)):
    return {"media_types": actions_bot.list_media_types()}


class MediaTypeCreateRequest(BaseModel):
    name: str
    type: int = 0
    description: str = ""
    smtp_server: str = ""
    smtp_helo: str = ""
    smtp_email: str = ""
    script: str = ""
    webhook_script: str = ""


@app.post("/media-types")
def create_media_type(body: MediaTypeCreateRequest, _user=Depends(require_admin)):
    try:
        mid = actions_bot.create_media_type(
            body.name, body.type, body.description,
            body.smtp_server, body.smtp_helo, body.smtp_email,
            body.script, body.webhook_script,
        )
        return {"mediatypeid": mid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/media-types/{mediatypeid}")
def delete_media_type(mediatypeid: str, _user=Depends(require_admin)):
    try:
        actions_bot.delete_media_type(mediatypeid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.put("/media-types/{mediatypeid}/toggle")
def toggle_media_type(mediatypeid: str, status: int = Body(..., embed=True), _user=Depends(require_admin)):
    try:
        actions_bot.toggle_media_type(mediatypeid, status)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Scripts ────────────────────────────────────────────────────────────


@app.get("/scripts")
def list_scripts(_user=Depends(get_current_user)):
    return {"scripts": actions_bot.list_scripts()}


class ScriptCreateRequest(BaseModel):
    name: str
    command: str
    execute_on: int = 1
    scope: int = 2
    description: str = ""


@app.post("/scripts")
def create_script(body: ScriptCreateRequest, _user=Depends(require_admin)):
    try:
        sid = actions_bot.create_script(body.name, body.command, body.execute_on, body.scope, body.description)
        return {"scriptid": sid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/scripts/{scriptid}")
def delete_script(scriptid: str, _user=Depends(require_admin)):
    try:
        actions_bot.delete_script(scriptid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── User Groups ────────────────────────────────────────────────────────


@app.get("/user-groups")
def list_user_groups(_user=Depends(require_admin)):
    return {"groups": zadmin_bot.list_user_groups()}


class UserGroupCreateRequest(BaseModel):
    name: str
    gui_access: int = 0
    users_status: int = 0
    debug_mode: int = 0
    userids: list[str] = []
    hostgroup_rights: list[dict] = []
    templategroup_rights: list[dict] = []
    tag_filters: list[dict] = []


@app.get("/zabbix-users")
def list_zabbix_users(_user=Depends(require_admin)):
    return {"users": zadmin_bot.list_zabbix_users()}


@app.post("/user-groups")
def create_user_group(body: UserGroupCreateRequest, _user=Depends(require_admin)):
    try:
        gid = zadmin_bot.create_user_group(
            body.name,
            body.gui_access,
            body.users_status,
            debug_mode=body.debug_mode,
            userids=body.userids or None,
            hostgroup_rights=body.hostgroup_rights or None,
            templategroup_rights=body.templategroup_rights or None,
            tag_filters=body.tag_filters or None,
        )
        return {"usrgrpid": gid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/user-groups/{usrgrpid}")
def delete_user_group(usrgrpid: str, _user=Depends(require_admin)):
    try:
        zadmin_bot.delete_user_group(usrgrpid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Roles ──────────────────────────────────────────────────────────────


@app.get("/roles")
def list_roles(_user=Depends(require_admin)):
    return {"roles": zadmin_bot.list_roles()}


class RoleCreateRequest(BaseModel):
    name: str
    type: int = 1
    ui_access: dict[str, bool] | None = None
    ui_default_access: int = 1
    services_read_mode: int = 0
    services_write_mode: int = 0
    modules_default_access: int = 1
    api_access: int = 1


@app.post("/roles")
def create_role(body: RoleCreateRequest, _user=Depends(require_admin)):
    try:
        rid = zadmin_bot.create_role(
            body.name,
            body.type,
            ui_access=body.ui_access,
            ui_default_access=body.ui_default_access,
            services_read_mode=body.services_read_mode,
            services_write_mode=body.services_write_mode,
            modules_default_access=body.modules_default_access,
            api_access=body.api_access,
        )
        return {"roleid": rid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


class RoleUpdateRequest(BaseModel):
    name: str


@app.put("/roles/{roleid}")
def update_role(roleid: str, body: RoleUpdateRequest, _user=Depends(require_admin)):
    try:
        zadmin_bot.update_role(roleid, body.name)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/roles/{roleid}")
def delete_role(roleid: str, _user=Depends(require_admin)):
    try:
        zadmin_bot.delete_role(roleid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))




# ── API Tokens ────────────────────────────────────────────────────────


@app.get("/api-tokens")
def list_api_tokens(_user=Depends(require_root)):
    return {"tokens": zadmin_bot.list_api_tokens()}


class TokenCreateRequest(BaseModel):
    name: str
    userid: str
    expires_at: int = 0


@app.post("/api-tokens")
def create_api_token(body: TokenCreateRequest, _user=Depends(require_root)):
    try:
        tokenid, token_value = zadmin_bot.create_api_token(body.name, body.userid, body.expires_at)
        return {"tokenid": tokenid, "token": token_value}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/api-tokens/{tokenid}")
def delete_api_token(tokenid: str, _user=Depends(require_root)):
    try:
        zadmin_bot.delete_api_token(tokenid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Proxies ────────────────────────────────────────────────────────────


@app.get("/proxies")
def list_proxies(_user=Depends(get_current_user)):
    return {"proxies": zadmin_bot.list_proxies()}


class ProxyCreateRequest(BaseModel):
    name: str
    operating_mode: int = 0
    description: str = ""


@app.post("/proxies")
def create_proxy(body: ProxyCreateRequest, _user=Depends(require_admin)):
    try:
        pid = zadmin_bot.create_proxy(body.name, body.operating_mode, body.description)
        return {"proxyid": pid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


class ProxyUpdateRequest(BaseModel):
    name: str
    description: str = ""


@app.put("/proxies/{proxyid}")
def update_proxy(proxyid: str, body: ProxyUpdateRequest, _user=Depends(require_admin)):
    try:
        zadmin_bot.update_proxy(proxyid, body.name, body.description)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/proxies/{proxyid}")
def delete_proxy(proxyid: str, _user=Depends(require_admin)):
    try:
        zadmin_bot.delete_proxy(proxyid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Proxy Groups (Zabbix 7.x) ─────────────────────────────────────────

@app.get("/proxy_groups")
def list_proxy_groups(_user=Depends(get_current_user)):
    return {"proxy_groups": zadmin_bot.list_proxy_groups()}


class ProxyGroupCreateRequest(BaseModel):
    name: str
    failover_delay: str = "1m"
    min_online: int = 1
    description: str = ""


@app.post("/proxy_groups")
def create_proxy_group(body: ProxyGroupCreateRequest, _user=Depends(require_admin)):
    try:
        pgid = zadmin_bot.create_proxy_group(body.name, body.failover_delay, body.min_online, body.description)
        return {"proxygroupid": pgid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/proxy_groups/{proxygroupid}")
def delete_proxy_group(proxygroupid: str, _user=Depends(require_admin)):
    try:
        zadmin_bot.delete_proxy_group(proxygroupid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Macros ────────────────────────────────────────────────────────────


@app.get("/macros")
def list_macros(_user=Depends(get_current_user)):
    return {"macros": zadmin_bot.list_global_macros()}


class MacroCreateRequest(BaseModel):
    macro: str
    value: str
    description: str = ""
    type: int = 0


@app.post("/macros")
def create_macro(body: MacroCreateRequest, _user=Depends(require_admin)):
    try:
        mid = zadmin_bot.create_global_macro(body.macro, body.value, body.description, body.type)
        return {"globalmacroid": mid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


class MacroUpdateRequest(BaseModel):
    value: str
    description: str = ""


@app.put("/macros/{globalmacroid}")
def update_macro(globalmacroid: str, body: MacroUpdateRequest, _user=Depends(require_admin)):
    try:
        zadmin_bot.update_global_macro(globalmacroid, body.value, body.description)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/macros/{globalmacroid}")
def delete_macro(globalmacroid: str, _user=Depends(require_admin)):
    try:
        zadmin_bot.delete_global_macro(globalmacroid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Queue ─────────────────────────────────────────────────────────────


@app.get("/admin/queue")
def get_queue(_user=Depends(require_admin)):
    return zadmin_bot.get_queue_overview()


# ── Housekeeping ───────────────────────────────────────────────────────


@app.get("/admin/settings")
def get_settings(_user=Depends(require_admin)):
    try:
        return zadmin_bot.get_settings()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


class HousekeepingUpdateRequest(BaseModel):
    hk_events_mode: int | None = None
    hk_events_trigger: str | None = None
    hk_events_internal: str | None = None
    hk_events_discovery: str | None = None
    hk_events_autoreg: str | None = None
    hk_services_mode: int | None = None
    hk_services: str | None = None
    hk_audit_mode: int | None = None
    hk_audit: str | None = None
    hk_sessions_mode: int | None = None
    hk_sessions: str | None = None
    hk_history_mode: int | None = None
    hk_history_global: int | None = None
    hk_history: str | None = None
    hk_trends_mode: int | None = None
    hk_trends_global: int | None = None
    hk_trends: str | None = None
    compression_status: int | None = None
    compress_older: str | None = None


@app.put("/admin/housekeeping")
def update_housekeeping(body: HousekeepingUpdateRequest, _user=Depends(require_root)):
    try:
        zadmin_bot.update_housekeeping(body.model_dump(exclude_none=True))
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Authentication settings ────────────────────────────────────────────


class AuthSettingsUpdateRequest(BaseModel):
    authentication_type: int | None = None
    http_auth_enabled: int | None = None
    http_login_form: int | None = None
    http_strip_domains: str | None = None
    http_case_sensitive: int | None = None
    ldap_configured: int | None = None
    ldap_host: str | None = None
    ldap_port: int | None = None
    ldap_base_dn: str | None = None
    ldap_bind_dn: str | None = None
    ldap_bind_password: str | None = None
    ldap_search_attribute: str | None = None
    ldap_case_sensitive: int | None = None
    saml_auth_enabled: int | None = None
    saml_idp_entityid: str | None = None
    saml_sso_url: str | None = None
    saml_slo_url: str | None = None
    saml_username_attribute: str | None = None
    saml_sp_entityid: str | None = None
    saml_sign_messages: int | None = None
    saml_sign_assertions: int | None = None
    saml_sign_authn_requests: int | None = None
    saml_sign_logout_requests: int | None = None
    saml_sign_logout_responses: int | None = None
    saml_encrypt_nameid: int | None = None
    saml_encrypt_assertions: int | None = None
    saml_case_sensitive: int | None = None
    passwd_min_length: int | None = None
    passwd_check_rules: int | None = None
    mfa_status: int | None = None


@app.get("/admin/auth")
def get_auth_settings(_user=Depends(require_root)):
    try:
        return zadmin_bot.get_auth_settings()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.put("/admin/auth")
def update_auth_settings(body: AuthSettingsUpdateRequest, _user=Depends(require_root)):
    try:
        zadmin_bot.update_auth_settings(body.model_dump(exclude_none=True))
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Services ───────────────────────────────────────────────────────────


@app.get("/services")
def list_services(parentid: str | None = Query(None), _user=Depends(get_current_user)):
    return {"services": services_bot.list_services(parentid=parentid)}


class ServiceCreateRequest(BaseModel):
    name: str
    algorithm: int = 0
    sortorder: int = 0
    weight: int = 0
    description: str = ""


@app.post("/services")
def create_service(body: ServiceCreateRequest, _user=Depends(require_admin)):
    try:
        sid = services_bot.create_service(body.name, body.algorithm, body.sortorder, body.weight, body.description)
        return {"serviceid": sid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


class ServiceUpdateRequest(BaseModel):
    name: str | None = None
    algorithm: int | None = None
    description: str | None = None


@app.put("/services/{serviceid}")
def update_service(serviceid: str, body: ServiceUpdateRequest, _user=Depends(require_admin)):
    try:
        services_bot.update_service(serviceid, body.name, body.algorithm, body.description)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/services/{serviceid}")
def delete_service(serviceid: str, _user=Depends(require_admin)):
    try:
        services_bot.delete_service(serviceid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── SLA ────────────────────────────────────────────────────────────────


@app.get("/sla")
def list_slas(_user=Depends(get_current_user)):
    return {"slas": services_bot.list_slas()}


class SlaCreateRequest(BaseModel):
    name: str
    slo: float = 99.9
    period: str = "PERIOD_MONTHLY"
    timezone: str = "UTC"
    description: str = ""
    service_tags: list[dict] = []


@app.post("/sla")
def create_sla(body: SlaCreateRequest, _user=Depends(require_admin)):
    try:
        sid = services_bot.create_sla(body.name, body.slo, body.period, body.timezone, body.description, body.service_tags)
        return {"slaid": sid}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/sla/{slaid}")
def delete_sla(slaid: str, _user=Depends(require_admin)):
    try:
        services_bot.delete_sla(slaid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/sla/{slaid}/report")
def get_sla_report(slaid: str, periods: int = Query(3, ge=1, le=12), _user=Depends(get_current_user)):
    return {"report": services_bot.get_sla_report(slaid, periods)}


# ── Health Monitors ──────────────────────────────────────────────────────


class HealthMonitorCreateRequest(BaseModel):
    hostid: str
    name: str
    url: str
    expected_contains: str = "ok"
    process_name: str | None = None


@app.get("/health-monitors")
def list_health_monitors(hostid: str | None = Query(None), _user=Depends(get_current_user)):
    return {"monitors": services_bot.list_health_monitors(hostid=hostid)}


@app.post("/health-monitors")
def create_health_monitor(body: HealthMonitorCreateRequest, _user=Depends(require_operator)):
    try:
        return services_bot.add_health_monitor(
            body.hostid, body.name, body.url, body.expected_contains, body.process_name
        )
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/health-monitors/{itemid}")
def delete_health_monitor(itemid: str, _user=Depends(require_operator)):
    try:
        services_bot.delete_health_monitor(itemid)
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Runner ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=6769)