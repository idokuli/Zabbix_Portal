# ── Managers ─────────────────────────────────────────────────────────
# Instantiated at module level; each manager handles Zabbix connection
# failures internally (sets self.zapi = None on error).
from Actions_Manager import Actions_Manager
from Alert_Manager import Alert_Manager
from Dashboard_Manager import Dashboard_Manager
from DataCollection_Manager import DataCollection_Manager
from Host_Manager import Host_Manager
from Item_Manager import Item_Manager
from Metrics_Manager import Metrics_Manager
from Report_Manager import Report_Manager
from Services_Manager import Services_Manager
from ZabbixAdmin_Manager import ZabbixAdmin_Manager
from ZabbixSync import ZabbixSync

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
