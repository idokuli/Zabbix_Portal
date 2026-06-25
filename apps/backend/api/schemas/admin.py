"""Pydantic request models for Zabbix server administration endpoints."""

from pydantic import BaseModel


class UserGroupCreateRequest(BaseModel):
    name: str
    gui_access: int = 0
    users_status: int = 0
    debug_mode: int = 0
    userids: list[str] = []
    hostgroup_rights: list[dict] = []
    templategroup_rights: list[dict] = []
    tag_filters: list[dict] = []


class RoleCreateRequest(BaseModel):
    name: str
    type: int = 1
    ui_access: dict[str, bool] | None = None
    ui_default_access: int = 1
    services_read_mode: int = 0
    services_write_mode: int = 0
    modules_default_access: int = 1
    api_access: int = 1


class RoleUpdateRequest(BaseModel):
    name: str


class TokenCreateRequest(BaseModel):
    name: str
    userid: str
    expires_at: int = 0


class ProxyConfig(BaseModel):
    name: str
    operating_mode: int = 0  # 0 - active (proxy connects to server), 1 - passive (server connects to proxy)
    description: str = ""
    proxy_groupid: str = ""  # empty - not a member of a proxy group
    local_address: str = ""  # required when proxy_groupid is set
    local_port: str = "10051"
    address: str = "127.0.0.1"  # passive mode: where the server connects
    port: str = "10051"
    allowed_addresses: str = ""  # active mode: optional allow-list of source addresses
    tls_connect: int = 1  # passive mode: 1 no encryption, 2 PSK, 4 certificate
    tls_accept: int = 1  # active mode: bitmask of 1 no encryption, 2 PSK, 4 certificate
    tls_issuer: str = ""
    tls_subject: str = ""
    tls_psk_identity: str = ""
    tls_psk: str = ""  # write-only; blank on update keeps the existing key
    custom_timeouts: int = 0  # 0 - inherit global item timeouts, 1 - override below
    timeout_zabbix_agent: str = ""
    timeout_simple_check: str = ""
    timeout_snmp_agent: str = ""
    timeout_external_check: str = ""
    timeout_db_monitor: str = ""
    timeout_http_agent: str = ""
    timeout_ssh_agent: str = ""
    timeout_telnet_agent: str = ""
    timeout_script: str = ""
    timeout_browser: str = ""

    def to_manager_kwargs(self) -> dict:
        data = self.model_dump()
        timeout_keys = [
            "timeout_zabbix_agent",
            "timeout_simple_check",
            "timeout_snmp_agent",
            "timeout_external_check",
            "timeout_db_monitor",
            "timeout_http_agent",
            "timeout_ssh_agent",
            "timeout_telnet_agent",
            "timeout_script",
            "timeout_browser",
        ]
        data["timeouts"] = {k: data.pop(k) for k in timeout_keys}
        return data


class ProxyCreateRequest(ProxyConfig):
    pass


class ProxyUpdateRequest(ProxyConfig):
    pass


class ProxyGroupCreateRequest(BaseModel):
    name: str
    failover_delay: str = "1m"
    min_online: int = 1
    description: str = ""


class MacroCreateRequest(BaseModel):
    macro: str
    value: str
    description: str = ""
    type: int = 0


class MacroUpdateRequest(BaseModel):
    value: str
    description: str = ""


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


class AuthSettingsUpdateRequest(BaseModel):
    authentication_type: int | None = None
    http_auth_enabled: int | None = None
    http_login_form: int | None = None
    http_strip_domains: str | None = None
    http_case_sensitive: int | None = None
    ldap_configured: int | None = None
    ldap_case_sensitive: int | None = None
    ldap_jit_status: int | None = None
    jit_provision_interval: str | None = None
    disabled_usrgrpid: str | None = None
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


class LdapTestRequest(BaseModel):
    host: str
    port: int = 389
    base_dn: str
    search_attribute: str
    bind_dn: str = ""
    bind_password: str = ""
    start_tls: int = 0
    search_filter: str = ""
    userdirectoryid: str | None = (
        None  # reuse the saved bind_password when testing an existing server
    )
    test_username: str
    test_password: str


class LdapProvisionGroupRequest(BaseModel):
    name: str
    roleid: str
    user_groups: list[str] = []  # usrgrpids


class LdapProvisionMediaRequest(BaseModel):
    name: str
    mediatypeid: str
    attribute: str
    period: str = "1-7,00:00-24:00"
    severity: int = 63
    active: int = 0  # 0 = enabled (Zabbix convention), 1 = disabled


class LdapServerRequest(BaseModel):
    name: str
    host: str
    port: int = 389
    base_dn: str
    search_attribute: str
    bind_dn: str = ""
    bind_password: str = ""
    description: str = ""
    start_tls: int = 0
    search_filter: str = ""
    provision_status: int = 0
    group_basedn: str = ""
    group_name: str = ""
    group_member: str = ""
    group_filter: str = ""
    group_membership: str = ""
    user_username: str = ""
    user_lastname: str = ""
    user_ref_attr: str = ""
    provision_groups: list[LdapProvisionGroupRequest] = []
    provision_media: list[LdapProvisionMediaRequest] = []
