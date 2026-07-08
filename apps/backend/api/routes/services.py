from api.deps import zabbix_call
from fastapi import APIRouter, Depends, Query
from Auth import get_current_user, require_admin, require_operator
from api.managers import services_bot
from api.schemas import (
    HealthMonitorCreateRequest,
    ServiceCreateRequest,
    ServiceUpdateRequest,
    SlaCreateRequest,
)

router = APIRouter(tags=["Services"])


@router.get("/services")
def list_services(parentid: str | None = Query(None), _user=Depends(get_current_user)):
    return {"services": services_bot.list_services(parentid=parentid)}


@router.post("/services")
def create_service(body: ServiceCreateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        sid = services_bot.create_service(
            body.name, body.algorithm, body.sortorder, body.weight, body.description
        )
        return {"serviceid": sid}


@router.put("/services/{serviceid}")
def update_service(
    serviceid: str, body: ServiceUpdateRequest, _user=Depends(require_admin)
):
    with zabbix_call():
        services_bot.update_service(
            serviceid, body.name, body.algorithm, body.description
        )
        return {"ok": True}


@router.delete("/services/{serviceid}")
def delete_service(serviceid: str, _user=Depends(require_admin)):
    with zabbix_call():
        services_bot.delete_service(serviceid)
        return {"ok": True}


@router.get("/sla")
def list_slas(_user=Depends(get_current_user)):
    return {"slas": services_bot.list_slas()}


@router.post("/sla")
def create_sla(body: SlaCreateRequest, _user=Depends(require_admin)):
    with zabbix_call():
        sid = services_bot.create_sla(
            body.name,
            body.slo,
            body.period,
            body.timezone,
            body.description,
            body.service_tags,
        )
        return {"slaid": sid}


@router.delete("/sla/{slaid}")
def delete_sla(slaid: str, _user=Depends(require_admin)):
    with zabbix_call():
        services_bot.delete_sla(slaid)
        return {"ok": True}


@router.get("/sla/{slaid}/report")
def get_sla_report(
    slaid: str, periods: int = Query(3, ge=1, le=12), _user=Depends(get_current_user)
):
    return {"report": services_bot.get_sla_report(slaid, periods)}


@router.get("/health-monitors")
def list_health_monitors(
    hostid: str | None = Query(None), _user=Depends(get_current_user)
):
    return {"monitors": services_bot.list_health_monitors(hostid=hostid)}


@router.post("/health-monitors")
def create_health_monitor(
    body: HealthMonitorCreateRequest, _user=Depends(require_operator)
):
    with zabbix_call():
        return services_bot.add_health_monitor(
            body.hostid, body.name, body.url, body.expected_contains, body.process_name
        )


@router.delete("/health-monitors/{itemid}")
def delete_health_monitor(itemid: str, _user=Depends(require_operator)):
    with zabbix_call():
        services_bot.delete_health_monitor(itemid)
        return {"ok": True}
