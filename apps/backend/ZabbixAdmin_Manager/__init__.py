import logging

from Zabbix_Base import Zabbix_Base

from ZabbixAdmin_Manager.auth import AuthMixin
from ZabbixAdmin_Manager.macros import MacrosMixin
from ZabbixAdmin_Manager.proxies import ProxiesMixin
from ZabbixAdmin_Manager.roles import RolesMixin
from ZabbixAdmin_Manager.system import SystemMixin
from ZabbixAdmin_Manager.tokens import TokensMixin
from ZabbixAdmin_Manager.user_groups import UserGroupsMixin

logger = logging.getLogger(__name__)


class ZabbixAdmin_Manager(
    UserGroupsMixin,
    ProxiesMixin,
    RolesMixin,
    TokensMixin,
    MacrosMixin,
    AuthMixin,
    SystemMixin,
    Zabbix_Base,
):
    def __init__(self):
        super().__init__()
        logger.info("ZabbixAdmin Manager ready.")
