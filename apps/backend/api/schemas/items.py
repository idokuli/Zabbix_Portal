"""Pydantic request models for item endpoints — covers ~20 Zabbix item types."""

from pydantic import BaseModel


class TeamTaggableRequest(BaseModel):
    """Base for item requests that get an automatic 'team' tag on creation.
    Set apply_team_tag=False to skip tagging this particular item."""

    apply_team_tag: bool = True


class ItemRequest(TeamTaggableRequest):
    hostname: str
    item_name: str
    item_key: str
    value_type: int | None = 3  # 3 = integer (most common)
    delay: str = "1m"  # update interval; may include custom intervals e.g. "1m;50s/1-7,00:00-24:00"
    units: str = ""  # display units, e.g. "%", "B", "bps"
    history: str = "31d"  # how long to keep raw data
    trends: str = "365d"  # how long to keep aggregated trends
    description: str = ""  # optional item description
    status: int = 0  # 0=enabled 1=disabled
    timeout: str = ""  # per-item timeout override (Zabbix 7.x+); empty = use global
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class ItemUpdateRequest(BaseModel):
    name: str | None = None
    delay: str | None = None
    status: str | None = None
    key_: str | None = None


class HttpQueryField(BaseModel):
    name: str
    value: str = ""


class HttpItemRequest(TeamTaggableRequest):
    hostname: str
    item_name: str
    url: str
    item_key: str = ""
    request_method: int = 0  # 0=GET 1=POST 2=PUT 3=HEAD
    status_codes: str = "200"
    timeout: str = "15s"
    verify_peer: bool = True
    verify_host: bool = True
    follow_redirects: bool = True
    posts: str = ""
    post_type: int = 0  # 0=Raw 2=JSON 3=XML
    retrieve_mode: int = 0  # 0=body 1=headers 2=body+headers
    value_type: int = 4  # 0=float (response time), 4=text (response body)
    team_name: str = ""
    headers: str = ""  # newline-separated "Name: Value" custom request headers
    query_fields: list[HttpQueryField] = []
    http_proxy: str = ""
    # authentication
    authtype: int = 0  # auth type: 0 None, 1 Basic, 2 NTLM
    username: str = ""
    password: str = ""
    # SSL settings
    ssl_cert_file: str = ""
    ssl_key_file: str = ""
    ssl_key_password: str = ""
    # output options
    convert_to_json: bool = False  # sets Zabbix's output_format to 1
    allow_traps: bool = False
    status: int = 0  # 0=enabled 1=disabled
    # regex preprocessing
    regex_preprocessing: bool = False
    regex_pattern: str = ""
    regex_output: str = "\\1"  # first capture group by default
    regex_no_match_value: str = "0"
    # common item settings
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "0d"
    description: str = ""
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class ServiceItemRequest(TeamTaggableRequest):
    hostname: str
    service_type: str  # icmp_ping|icmp_loss|icmp_time|http|https|ssh|smtp|ftp|tcp_port
    port: int | None = None
    item_name: str = ""
    team_name: str = ""
    delay: str = "1m"
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class WindowsServiceItemRequest(TeamTaggableRequest):
    hostname: str
    service_name: str  # Windows service name (not display name), e.g. "wuauserv"
    item_name: str = ""
    team_name: str = ""
    create_trigger: bool = True
    trigger_priority: int = 3
    delay: str = "1m"
    history: str = "31d"
    trends: str = "365d"
    description: str = ""


class ProcessItemRequest(TeamTaggableRequest):
    hostname: str
    process_name: str
    run_as_user: str = ""  # filter by the OS user running the process
    cmdline_regex: str = ""  # regex matched against the full command line
    state: str = "all"  # all | run | sleep | zomb | disk | trace | paging
    item_name: str = ""
    team_name: str = ""
    create_trigger: bool = True
    trigger_priority: int = 3  # severity level: high
    delay: str = "1m"
    history: str = "31d"
    trends: str = "365d"
    description: str = ""


class FileWatchRequest(TeamTaggableRequest):
    hostname: str
    file_path: str
    check_type: str = "checksum"  # checksum | mtime | size | exists | folder_latest
    item_name: str = ""
    team_name: str = ""
    folder_os: str = "linux"  # linux | windows  (folder_latest only)
    create_trigger: bool = True
    trigger_name: str = ""
    trigger_priority: int = 2
    trigger_type: str = "change"  # change | age
    max_age_minutes: int = 60  # used when trigger_type = "age"
    delay: str = "1m"
    history: str = "31d"
    trends: str = "365d"
    description: str = ""


class ScriptItemRequest(TeamTaggableRequest):
    hostname: str
    script_type: str = "bash"  # bash | powershell
    script_mode: str = "command"  # command | file
    script: str  # inline command or absolute script path on host
    file_arg: str = ""  # optional file argument passed to the script
    item_name: str = ""
    value_type: int = 1  # 1=string default for script output
    team_name: str = ""
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0  # 0=enabled 1=disabled
    timeout: str = ""  # per-item timeout override (Zabbix 7.x+)
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class BulkItemRequest(TeamTaggableRequest):
    hostnames: list[str]
    item_type: str = "agent"  # agent | http | service | script
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


class DbOdbcRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class DbAgent2Request(TeamTaggableRequest):
    hostname: str
    engine: str
    conn_string: str
    metric: str
    extra_param: str = ""
    item_name: str = ""
    value_type: int | None = None
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class SnmpItemRequest(TeamTaggableRequest):
    hostname: str
    item_name: str
    item_key: str = ""
    snmp_oid: str
    value_type: int = 3
    snmp_version: int = 2  # SNMP version: 1 v1, 2 v2c, 3 v3
    snmp_community: str = "public"
    snmpv3_securityname: str = ""
    snmpv3_securitylevel: int = 0  # security level: 0 noAuthNoPriv, 1 authNoPriv, 2 authPriv
    snmpv3_authprotocol: int = (
        0  # auth protocol: 0 MD5, 1 SHA, 2 SHA224, 3 SHA256, 4 SHA384, 5 SHA512
    )
    snmpv3_authpassphrase: str = ""
    snmpv3_privprotocol: int = 0  # priv protocol: 0 DES, 1 AES128, 2 AES192, 3 AES256
    snmpv3_privpassphrase: str = ""
    snmpv3_contextname: str = ""
    delay: str = "1m"
    units: str = ""
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class SnmpTrapRequest(TeamTaggableRequest):
    hostname: str
    item_name: str
    item_key: str = "snmptrap.fallback"
    value_type: int = 1
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class InternalItemRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class TrapperItemRequest(TeamTaggableRequest):
    hostname: str
    item_name: str
    item_key: str
    value_type: int = 4
    allow_traps: bool = True
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class ExternalItemRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class IpmiItemRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class SshItemRequest(TeamTaggableRequest):
    hostname: str
    item_name: str
    params: str
    item_key: str = ""
    authtype: int = 0  # 0=password, 1=public key
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class TelnetItemRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class JmxItemRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class CalculatedItemRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class DependentItemRequest(TeamTaggableRequest):
    hostname: str
    item_name: str
    item_key: str
    master_itemid: str
    value_type: int = 4
    history: str = "31d"
    trends: str = "365d"
    description: str = ""
    status: int = 0
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class ScriptParamEntry(BaseModel):
    name: str
    value: str = ""


class ZabbixScriptItemRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class BrowserItemRequest(TeamTaggableRequest):
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
    # Optionally auto-create a trigger for this item via the maybe_create_trigger
    # helper in triggers.py. Numeric value types get a threshold trigger if
    # trigger_threshold is set; string/log/text types get a pattern-match trigger if
    # trigger_pattern is set; otherwise falls back to a "no data" trigger.
    create_trigger: bool = False
    trigger_operator: str = ">"
    trigger_threshold: float | None = None
    trigger_pattern: str = ""
    trigger_match_type: str = "like"
    trigger_priority: int = 3


class TemplateItemRequest(BaseModel):
    name: str
    key_: str
    type_: int = 0  # item type: 0 agent, 2 trapper, 3 simple, 5 internal, etc.
    value_type: int = 3  # value type: 0 float, 1 char, 2 log, 3 uint, 4 text
    delay: str = "1m"
    history: str = "31d"
    trends: str = "365d"
    units: str = ""
    description: str = ""
