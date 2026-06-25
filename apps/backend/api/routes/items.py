import logging
from fastapi import APIRouter, Depends, HTTPException, Query
import User_Management as um
from Auth import get_current_user, require_operator
from api.deps import live_team_id, team_hostname_filter
from api.managers import item_bot
from api.schemas import (
    BrowserItemRequest,
    BulkItemRequest,
    CalculatedItemRequest,
    DbAgent2Request,
    DbOdbcRequest,
    DependentItemRequest,
    ExternalItemRequest,
    FileWatchRequest,
    HttpItemRequest,
    InternalItemRequest,
    IpmiItemRequest,
    ItemRequest,
    ItemUpdateRequest,
    JmxItemRequest,
    ScriptItemRequest,
    ServiceItemRequest,
    SnmpItemRequest,
    SnmpTrapRequest,
    SshItemRequest,
    TelnetItemRequest,
    TrapperItemRequest,
    ZabbixScriptItemRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Items"])


@router.get("/items", tags=["Items"], summary="List all items across all hosts")
def list_all_items(
    search: str = Query(
        default="", description="Filter by name or key (substring match)"
    ),
    hostname: str = Query(default="", description="Filter by exact hostname"),
    limit: int = Query(default=2000, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
):
    allowed = team_hostname_filter(current_user)
    try:
        items = item_bot.list_all_items(search=search, hostname=hostname, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Zabbix API error: {e}")
    if allowed is not None:
        items = [i for i in items if i["hostname"] in allowed]
    return {"items": items, "total": len(items)}


@router.get(
    "/items/keys", tags=["Items"], summary="List all item keys from Zabbix templates"
)
def list_item_keys(current_user: dict = Depends(get_current_user)):
    return {"items": item_bot.get_all_item_keys()}


@router.get("/items/{hostname}", tags=["Items"], summary="List items for a host")
def list_items(
    hostname: str,
    include_inherited: bool = False,
    current_user: dict = Depends(get_current_user),
):
    allowed = team_hostname_filter(current_user)
    if allowed is not None and hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not assigned to your team.")
    return {"items": item_bot.list_items(hostname, include_inherited=include_inherited)}


@router.put("/items/{itemid}", tags=["Items"], summary="Update item")
def update_item(itemid: str, body: ItemUpdateRequest, _user=Depends(require_operator)):
    try:
        item_bot.update_item(
            itemid, name=body.name, delay=body.delay, status=body.status, key_=body.key_
        )
        return {"ok": True}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/items/{itemid}", tags=["Items"], summary="Delete item by ID")
def delete_item(itemid: str, current_user: dict = Depends(require_operator)):
    allowed = team_hostname_filter(current_user)
    if allowed is not None:
        hostname = item_bot.get_item_hostname(itemid)
        if not hostname or hostname not in allowed:
            raise HTTPException(
                status_code=403, detail="Item not assigned to your team."
            )
    if not item_bot.delete_item(itemid):
        raise HTTPException(
            status_code=404, detail="Item not found or could not be deleted."
        )
    return {"message": "Item deleted."}


@router.post("/items", tags=["Items"], summary="Add Monitoring Item", status_code=201)
def add_item(data: ItemRequest, current_user: dict = Depends(require_operator)):
    """Adds a monitoring item (metric) to an existing host."""
    team_id = live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_item(
        data.hostname,
        data.item_name,
        data.item_key,
        data.value_type,
        team_name or "",
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
        timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add item.")
    return {"message": "Item added successfully.", "itemid": item_id}


@router.post(
    "/items/http", tags=["Items"], summary="Add HTTP Agent Item", status_code=201
)
def add_http_item(
    data: HttpItemRequest, current_user: dict = Depends(require_operator)
):
    """Adds an HTTP agent item (type 19). Zabbix server fetches the URL and stores the result."""
    team_id = live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_http_item(
        hostname=data.hostname,
        item_name=data.item_name,
        url=data.url,
        item_key=data.item_key,
        request_method=data.request_method,
        status_codes=data.status_codes,
        timeout=data.timeout,
        verify_peer=data.verify_peer,
        verify_host=data.verify_host,
        follow_redirects=data.follow_redirects,
        posts=data.posts,
        post_type=data.post_type,
        retrieve_mode=data.retrieve_mode,
        value_type=data.value_type,
        team_name=team_name or data.team_name,
        headers=data.headers,
        query_fields=[qf.model_dump() for qf in data.query_fields],
        http_proxy=data.http_proxy,
        authtype=data.authtype,
        username=data.username,
        password=data.password,
        ssl_cert_file=data.ssl_cert_file,
        ssl_key_file=data.ssl_key_file,
        ssl_key_password=data.ssl_key_password,
        convert_to_json=data.convert_to_json,
        allow_traps=data.allow_traps,
        status=data.status,
        regex_preprocessing=data.regex_preprocessing,
        regex_pattern=data.regex_pattern,
        regex_output=data.regex_output,
        regex_no_match_value=data.regex_no_match_value,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add HTTP item.")
    return {"message": "HTTP item added successfully.", "itemid": item_id}


@router.post(
    "/items/service", tags=["Items"], summary="Add Service Check Item", status_code=201
)
def add_service_item(
    data: ServiceItemRequest, current_user: dict = Depends(require_operator)
):
    """Adds a simple-check service item (type 3): ICMP ping, TCP port, HTTP/HTTPS/SSH/SMTP/FTP."""
    team_id = live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_service_item(
        hostname=data.hostname,
        service_type=data.service_type,
        port=data.port,
        item_name=data.item_name,
        team_name=team_name or data.team_name,
        delay=data.delay,
        history=data.history,
        trends=data.trends,
        description=data.description,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add service item."
        )
    return {"message": "Service item added successfully.", "itemid": item_id}


@router.post(
    "/items/filewatch", tags=["Items"], summary="Add File Watch Item", status_code=201
)
def add_file_watch_item(
    data: FileWatchRequest, current_user: dict = Depends(require_operator)
):
    """Creates an agent item that monitors a file property.
    Optionally auto-creates a change-detection trigger on the same item.
    """
    team_id = live_team_id(current_user)
    team_name = um.get_team_name(team_id) if team_id else None
    item_id, err = item_bot.add_file_watch_item(
        hostname=data.hostname,
        file_path=data.file_path,
        check_type=data.check_type,
        item_name=data.item_name,
        team_name=team_name or data.team_name,
        folder_os=data.folder_os,
        delay=data.delay,
        history=data.history,
        trends=data.trends,
        description=data.description,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add file watch item."
        )

    trigger_id = None
    trigger_err = None
    # folder_latest returns a string filename — only change triggers make sense for it
    supports_age_trigger = data.check_type == "mtime"
    if data.create_trigger and data.check_type != "folder_latest":
        if data.trigger_type == "age" and supports_age_trigger:
            trigger_name = (
                data.trigger_name
                or f"File not updated in {data.max_age_minutes}m: {data.file_path} on {{HOST.NAME}}"
            )
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
                "mtime": f"vfs.file.time[{data.file_path},modify]",
                "size": f"vfs.file.size[{data.file_path}]",
                "exists": f"vfs.file.exists[{data.file_path}]",
            }
            item_key = key_map.get(data.check_type, "")
            trigger_name = (
                data.trigger_name or f"File changed: {data.file_path} on {{HOST.NAME}}"
            )
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


@router.post(
    "/items/script", tags=["Items"], summary="Add Script Check Item", status_code=201
)
def add_script_item(
    data: ScriptItemRequest, current_user: dict = Depends(require_operator)
):
    """Adds an agent item that runs a bash or PowerShell script via system.run[].
    Requires EnableRemoteCommands=1 in the Zabbix agent config on the target host.
    """
    team_id = live_team_id(current_user)
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
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
        timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add script item.")
    return {"message": "Script item added successfully.", "itemid": item_id}


@router.post(
    "/items/db/odbc",
    tags=["Items"],
    summary="Add ODBC database monitor item",
    status_code=201,
)
def add_db_odbc_item(
    data: DbOdbcRequest, current_user: dict = Depends(require_operator)
):
    """Adds a Zabbix ODBC database monitor item (type 4). Requires an ODBC DSN configured on the Zabbix server."""
    allowed = team_hostname_filter(current_user)
    if allowed is not None and data.hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not in your team.")
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
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
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        status=data.status,
        timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add ODBC item.")
    return {"message": "ODBC item added.", "itemid": item_id}


@router.post(
    "/items/db/agent2",
    tags=["Items"],
    summary="Add Agent2 database plugin item",
    status_code=201,
)
def add_db_agent2_item(
    data: DbAgent2Request, current_user: dict = Depends(require_operator)
):
    """Adds a Zabbix Agent2 database plugin item. Requires Zabbix Agent2 with the relevant DB plugin on the host."""
    allowed = team_hostname_filter(current_user)
    if allowed is not None and data.hostname not in allowed:
        raise HTTPException(status_code=403, detail="Host not in your team.")
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
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
        raise HTTPException(
            status_code=400, detail=err or "Failed to add Agent2 DB item."
        )
    return {"message": "Agent2 DB item added.", "itemid": item_id}


@router.post(
    "/items/bulk",
    tags=["Items"],
    summary="Bulk Add Item to Multiple Hosts",
    status_code=201,
)
def bulk_add_items(
    data: BulkItemRequest, current_user: dict = Depends(require_operator)
):
    """Adds the same item (agent, HTTP agent, or service check) to multiple hosts in one call."""
    if not data.hostnames:
        raise HTTPException(status_code=400, detail="hostnames list is empty.")
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    config = data.model_dump(exclude={"hostnames"})
    config["team_name"] = team_name or config.get("team_name", "")
    results = item_bot.bulk_add_items(data.hostnames, config)
    ok = sum(1 for r in results if not r["error"])
    return {
        "message": f"{ok}/{len(results)} items added successfully.",
        "results": results,
    }


@router.post(
    "/items/snmp", tags=["Items"], summary="Add SNMP Agent Item", status_code=201
)
def add_snmp_item(
    data: SnmpItemRequest, current_user: dict = Depends(require_operator)
):
    """Add an SNMP agent item (type 20). Supports SNMPv1, v2c, and v3."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_snmp_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        snmp_oid=data.snmp_oid,
        value_type=data.value_type,
        snmp_version=data.snmp_version,
        snmp_community=data.snmp_community,
        snmpv3_securityname=data.snmpv3_securityname,
        snmpv3_securitylevel=data.snmpv3_securitylevel,
        snmpv3_authprotocol=data.snmpv3_authprotocol,
        snmpv3_authpassphrase=data.snmpv3_authpassphrase,
        snmpv3_privprotocol=data.snmpv3_privprotocol,
        snmpv3_privpassphrase=data.snmpv3_privpassphrase,
        snmpv3_contextname=data.snmpv3_contextname,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add SNMP item.")
    return {"message": "SNMP item added successfully.", "itemid": item_id}


@router.post(
    "/items/snmptrap", tags=["Items"], summary="Add SNMP Trap Item", status_code=201
)
def add_snmp_trap_item(
    data: SnmpTrapRequest, current_user: dict = Depends(require_operator)
):
    """Add an SNMP trap item (type 17). Receives traps pushed by external devices."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_snmp_trap_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        value_type=data.value_type,
        team_name=team_name,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add SNMP trap item."
        )
    return {"message": "SNMP trap item added successfully.", "itemid": item_id}


@router.post(
    "/items/internal",
    tags=["Items"],
    summary="Add Zabbix Internal Item",
    status_code=201,
)
def add_internal_item(
    data: InternalItemRequest, current_user: dict = Depends(require_operator)
):
    """Add a Zabbix internal item (type 5) using built-in zabbix[...] keys."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_internal_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add internal item."
        )
    return {"message": "Internal item added successfully.", "itemid": item_id}


@router.post(
    "/items/trapper", tags=["Items"], summary="Add Zabbix Trapper Item", status_code=201
)
def add_trapper_item(
    data: TrapperItemRequest, current_user: dict = Depends(require_operator)
):
    """Add a Zabbix trapper item (type 2). Accepts data pushed via zabbix_sender."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_trapper_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        value_type=data.value_type,
        allow_traps=data.allow_traps,
        team_name=team_name,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add trapper item."
        )
    return {"message": "Trapper item added successfully.", "itemid": item_id}


@router.post(
    "/items/external",
    tags=["Items"],
    summary="Add External Check Item",
    status_code=201,
)
def add_external_item(
    data: ExternalItemRequest, current_user: dict = Depends(require_operator)
):
    """Add an external check item (type 10). Script must exist in ExternalScripts dir on Zabbix server."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_external_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add external check item."
        )
    return {"message": "External check item added successfully.", "itemid": item_id}


@router.post(
    "/items/ipmi", tags=["Items"], summary="Add IPMI Agent Item", status_code=201
)
def add_ipmi_item(
    data: IpmiItemRequest, current_user: dict = Depends(require_operator)
):
    """Add an IPMI agent item (type 12). Requires an IPMI interface on the host."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_ipmi_item(
        hostname=data.hostname,
        item_name=data.item_name,
        ipmi_sensor=data.ipmi_sensor,
        item_key=data.item_key,
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add IPMI item.")
    return {"message": "IPMI item added successfully.", "itemid": item_id}


@router.post(
    "/items/ssh", tags=["Items"], summary="Add SSH Agent Item", status_code=201
)
def add_ssh_item(data: SshItemRequest, current_user: dict = Depends(require_operator)):
    """Add an SSH agent item (type 13). Zabbix server SSHes into the host and runs the script."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_ssh_item(
        hostname=data.hostname,
        item_name=data.item_name,
        params=data.params,
        item_key=data.item_key,
        authtype=data.authtype,
        username=data.username,
        password=data.password,
        publickey=data.publickey,
        privatekey=data.privatekey,
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
        timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add SSH item.")
    return {"message": "SSH item added successfully.", "itemid": item_id}


@router.post(
    "/items/telnet", tags=["Items"], summary="Add Telnet Agent Item", status_code=201
)
def add_telnet_item(
    data: TelnetItemRequest, current_user: dict = Depends(require_operator)
):
    """Add a Telnet agent item (type 14). Zabbix server connects via Telnet and runs the script."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_telnet_item(
        hostname=data.hostname,
        item_name=data.item_name,
        params=data.params,
        item_key=data.item_key,
        username=data.username,
        password=data.password,
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add Telnet item.")
    return {"message": "Telnet item added successfully.", "itemid": item_id}


@router.post(
    "/items/jmx", tags=["Items"], summary="Add JMX Agent Item", status_code=201
)
def add_jmx_item(data: JmxItemRequest, current_user: dict = Depends(require_operator)):
    """Add a JMX agent item (type 16). Requires Zabbix Java Gateway and a JMX interface."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_jmx_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        jmx_endpoint=data.jmx_endpoint,
        username=data.username,
        password=data.password,
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(status_code=400, detail=err or "Failed to add JMX item.")
    return {"message": "JMX item added successfully.", "itemid": item_id}


@router.post(
    "/items/calculated", tags=["Items"], summary="Add Calculated Item", status_code=201
)
def add_calculated_item(
    data: CalculatedItemRequest, current_user: dict = Depends(require_operator)
):
    """Add a calculated item (type 15). Derives its value from a formula on other items."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_calculated_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        formula=data.formula,
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add calculated item."
        )
    return {"message": "Calculated item added successfully.", "itemid": item_id}


@router.post(
    "/items/dependent", tags=["Items"], summary="Add Dependent Item", status_code=201
)
def add_dependent_item(
    data: DependentItemRequest, current_user: dict = Depends(require_operator)
):
    """Add a dependent item (type 18). Preprocesses output from a master item."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_dependent_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        master_itemid=data.master_itemid,
        value_type=data.value_type,
        team_name=team_name,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add dependent item."
        )
    return {"message": "Dependent item added successfully.", "itemid": item_id}


@router.post(
    "/items/zabbix-script",
    tags=["Items"],
    summary="Add Zabbix Script Item (JS)",
    status_code=201,
)
def add_zabbix_script_item(
    data: ZabbixScriptItemRequest, current_user: dict = Depends(require_operator)
):
    """Add a Zabbix Script item (type 21). JavaScript code runs on the Zabbix server/proxy."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_zabbix_script_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        params=data.params,
        parameters=[p.model_dump() for p in data.parameters],
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
        timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add Zabbix script item."
        )
    return {"message": "Zabbix script item added successfully.", "itemid": item_id}


@router.post(
    "/items/browser", tags=["Items"], summary="Add Browser Item", status_code=201
)
def add_browser_item(
    data: BrowserItemRequest, current_user: dict = Depends(require_operator)
):
    """Add a Browser item (type 26). JavaScript browser automation on Zabbix 7.x+ server."""
    team_id = live_team_id(current_user)
    team_name = (um.get_team_name(team_id) if team_id else "") or ""
    item_id, err = item_bot.add_browser_item(
        hostname=data.hostname,
        item_name=data.item_name,
        item_key=data.item_key,
        params=data.params,
        parameters=[p.model_dump() for p in data.parameters],
        value_type=data.value_type,
        team_name=team_name,
        delay=data.delay,
        units=data.units,
        history=data.history,
        trends=data.trends,
        description=data.description,
        status=data.status,
        timeout=data.timeout,
    )
    if not item_id:
        raise HTTPException(
            status_code=400, detail=err or "Failed to add browser item."
        )
    return {"message": "Browser item added successfully.", "itemid": item_id}
