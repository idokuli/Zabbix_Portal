"""Register all API route modules."""

from fastapi import FastAPI

from . import (
    actions,
    admin,
    alerts,
    auth,
    dashboard,
    data_collection,
    hosts,
    items,
    metrics,
    reports,
    services,
    status,
    teams,
    triggers,
    users,
)


def register_routes(app: FastAPI) -> None:
    for module in (
        status,
        hosts,
        items,
        triggers,
        metrics,
        dashboard,
        auth,
        teams,
        users,
        alerts,
        data_collection,
        reports,
        actions,
        admin,
        services,
    ):
        app.include_router(module.router)
