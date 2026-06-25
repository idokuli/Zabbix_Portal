import logging

from Zabbix_Base import Zabbix_Base

from ZabbixSync.background import SyncBackgroundMixin
from ZabbixSync.helpers import SyncHelpersMixin
from ZabbixSync.pull import SyncPullMixin
from ZabbixSync.push import SyncPushMixin

logger = logging.getLogger(__name__)


class ZabbixSync(
    SyncPushMixin,
    SyncPullMixin,
    SyncBackgroundMixin,
    SyncHelpersMixin,
    Zabbix_Base,
):
    """Bidirectional sync: portal users/teams/hosts ↔ Zabbix users/groups/host-groups."""

    def __init__(self):
        super().__init__()
        # Detect API version once to pick correct field names.
        # Zabbix <6 : username field = 'alias', user type set via 'type'
        # Zabbix 6+ : username field = 'username', user type set via 'roleid'
        self._ufield = "username"
        self._zabbix_major = 6
        self._zabbix_minor = 0
        # roleid cache: maps user type int (1/2/3) → Zabbix roleid string
        self._roleids: dict[int, str] = {}

        # API field names that changed in Zabbix 6.2+:
        #   usergroup.update: 'rights'         → 'hostgroup_rights'
        #   host.get select:  'selectGroups'   → 'selectHostGroups'
        #   host object key:  'groups'         → 'hostgroups'
        self._rights_field = "hostgroup_rights"
        self._select_hg_param = "selectHostGroups"
        self._host_hg_key = "hostgroups"
        self._on_sync = None  # optional callback fired after every full_sync()

        if self.zapi:
            try:
                parts = str(self.zapi.api_version()).split(".")
                self._zabbix_major = int(parts[0])
                self._zabbix_minor = int(parts[1]) if len(parts) > 1 else 0
                self._ufield = "username" if self._zabbix_major >= 6 else "alias"
                old_api = self._zabbix_major < 6 or (
                    self._zabbix_major == 6 and self._zabbix_minor < 2
                )
                if old_api:
                    self._rights_field = "rights"
                    self._select_hg_param = "selectGroups"
                    self._host_hg_key = "groups"
            except Exception:
                pass
            if self._zabbix_major >= 6:
                self._roleids = self._fetch_roleids()
        logger.info(
            "ZabbixSync: Zabbix %d.%d — rights_field=%r, host_groups_param=%r.",
            self._zabbix_major,
            self._zabbix_minor,
            self._rights_field,
            self._select_hg_param,
        )
