# ── Managers ─────────────────────────────────────────────────────────
# Instantiated at module level; each manager handles Zabbix connection
# failures internally (sets self.zapi = None on error).
from Actions_Manager import ActionsManager
from Alert_Manager import AlertManager
from Dashboard_Manager import DashboardManager
from DataCollection_Manager import DataCollectionManager
from Host_Manager import HostManager
from Item_Manager import ItemManager
from Metrics_Manager import MetricsManager
from Report_Manager import ReportManager
from Services_Manager import ServicesManager
from ZabbixAdmin_Manager import ZabbixAdminManager
from ZabbixSync import ZabbixSync

host_bot = HostManager()
item_bot = ItemManager()
metrics_bot = MetricsManager()
dashboard_bot = DashboardManager()
alert_bot = AlertManager()
sync_bot = ZabbixSync()
dc_bot = DataCollectionManager()
report_bot = ReportManager()
actions_bot = ActionsManager()
zadmin_bot = ZabbixAdminManager()
services_bot = ServicesManager()
