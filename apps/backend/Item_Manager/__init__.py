import logging

from Zabbix_Base import ZabbixBase

from Item_Manager.bulk import BulkItemsMixin
from Item_Manager.core import CoreItemsMixin
from Item_Manager.database import DatabaseItemsMixin
from Item_Manager.file_script import FileScriptItemsMixin
from Item_Manager.http_service import HttpServiceItemsMixin
from Item_Manager.remote import RemoteItemsMixin
from Item_Manager.snmp import SnmpItemsMixin
from Item_Manager.triggers import TriggersMixin
from Item_Manager.zabbix_native import ZabbixNativeItemsMixin

logger = logging.getLogger(__name__)


class ItemManager(
    BulkItemsMixin,
    CoreItemsMixin,
    TriggersMixin,
    HttpServiceItemsMixin,
    FileScriptItemsMixin,
    DatabaseItemsMixin,
    SnmpItemsMixin,
    RemoteItemsMixin,
    ZabbixNativeItemsMixin,
    ZabbixBase,
):
    def __init__(self):
        super().__init__()
        logger.info("Item Manager ready.")
