import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.limiter import limiter
from Auth import get_current_user

FAKE_ROOT = {
    "id": 1,
    "sub": "1",
    "username": "admin",
    "roles": ["root"],
    "team_id": 1,
    "display_name": "Admin",
}


def make_app():
    from api.routes.dashboard import router

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_ROOT
    return app


# ── graphs ────────────────────────────────────────────────────────────────────


def test_list_graphs_no_filter():
    mock_bot = MagicMock()
    mock_bot.get_graphs.return_value = [{"graphid": "1", "hosts": [{"host": "web01"}]}]
    with patch("api.routes.dashboard.dashboard_bot", mock_bot):
        with patch("api.routes.dashboard.team_hostname_filter", return_value=None):
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/graphs")
    assert r.status_code == 200
    assert len(r.json()["graphs"]) == 1


def test_list_graphs_team_filter():
    mock_bot = MagicMock()
    mock_bot.get_graphs.return_value = [
        {"graphid": "1", "hosts": [{"host": "web01"}]},
        {"graphid": "2", "hosts": [{"host": "db01"}]},
    ]
    with patch("api.routes.dashboard.dashboard_bot", mock_bot):
        with patch("api.routes.dashboard.team_hostname_filter", return_value={"web01"}):
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/graphs")
    assert r.status_code == 200
    assert len(r.json()["graphs"]) == 1


def test_get_graph_image_success():
    mock_bot = MagicMock()
    mock_bot.get_graph_image.return_value = b"\x89PNG"
    with patch("api.routes.dashboard.dashboard_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/dashboard/graphs/1/image")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"


def test_get_graph_image_unavailable():
    mock_bot = MagicMock()
    mock_bot.get_graph_image.return_value = None
    with patch("api.routes.dashboard.dashboard_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/dashboard/graphs/1/image")
    assert r.status_code == 503


def test_get_graph_data_success():
    mock_bot = MagicMock()
    mock_bot.get_graph_data.return_value = {"labels": [], "datasets": []}
    with patch("api.routes.dashboard.dashboard_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/dashboard/graphs/1/data?minutes=60")
    assert r.status_code == 200


def test_get_graph_data_bad_minutes():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.get("/dashboard/graphs/1/data?minutes=9999999")
    assert r.status_code == 400


def test_get_graph_data_six_months_ok():
    mock_bot = MagicMock()
    mock_bot.get_graph_data.return_value = {"labels": [], "datasets": []}
    with patch("api.routes.dashboard.dashboard_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/dashboard/graphs/1/data?minutes=273600")
    assert r.status_code == 200


def test_get_graph_data_beyond_six_months_rejected():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.get("/dashboard/graphs/1/data?minutes=273601")
    assert r.status_code == 400


# ── host metrics ──────────────────────────────────────────────────────────────


def test_get_hosts_metrics_no_filter():
    mock_bot = MagicMock()
    mock_bot.get_hosts_metrics.return_value = [{"hostname": "web01", "cpu": 12.0}]
    with patch("api.routes.dashboard.dashboard_bot", mock_bot):
        with patch("api.routes.dashboard.team_hostname_filter", return_value=None):
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/hosts/metrics")
    assert r.status_code == 200
    assert len(r.json()["hosts"]) == 1


def test_get_hosts_metrics_team_filter():
    mock_bot = MagicMock()
    mock_bot.get_hosts_metrics.return_value = [
        {"hostname": "web01"},
        {"hostname": "db01"},
    ]
    with patch("api.routes.dashboard.dashboard_bot", mock_bot):
        with patch("api.routes.dashboard.team_hostname_filter", return_value={"web01"}):
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/hosts/metrics")
    assert r.status_code == 200
    assert len(r.json()["hosts"]) == 1


# ── recent items ──────────────────────────────────────────────────────────────


def test_get_recent_items():
    mock_bot = MagicMock()
    mock_bot.get_recent_items.return_value = [{"hostname": "web01", "name": "cpu"}]
    with patch("api.routes.dashboard.dashboard_bot", mock_bot):
        with patch("api.routes.dashboard.team_hostname_filter", return_value=None):
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/items/recent")
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1


# ── layout ────────────────────────────────────────────────────────────────────


def test_get_dashboard_layout_user():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.get_dashboard_layout.return_value = []
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/layout?scope=user")
    assert r.status_code == 200
    assert r.json()["scope"] == "user"


def test_save_dashboard_layout_bad_scope():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.put("/dashboard/layout", json={"scope": "bad", "widgets": []})
    assert r.status_code == 400


def test_save_dashboard_layout_user_success():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.save_dashboard_layout.return_value = True
            with TestClient(make_app()) as c:
                r = c.put("/dashboard/layout", json={"scope": "user", "widgets": []})
    assert r.status_code == 200


# ── pages ─────────────────────────────────────────────────────────────────────


def test_list_dashboard_pages_user():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.list_dashboard_pages.return_value = []
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/pages?scope=user&kind=dashboard")
    assert r.status_code == 200


def test_list_dashboard_pages_bad_kind():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.get("/dashboard/pages?kind=bad")
    assert r.status_code == 400


def test_create_dashboard_page_success():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.create_dashboard_page.return_value = {
                "page": "my-dash",
                "name": "My",
            }
            with TestClient(make_app()) as c:
                r = c.post(
                    "/dashboard/pages",
                    json={"scope": "user", "kind": "dashboard", "name": "My"},
                )
    assert r.status_code == 200


def test_rename_default_dashboard_rejected():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.put(
            "/dashboard/pages/dashboard",
            json={"scope": "user", "name": "new name"},
        )
    assert r.status_code == 400


def test_delete_default_dashboard_rejected():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.delete("/dashboard/pages/dashboard")
    assert r.status_code == 400


# ── team-scope layout ─────────────────────────────────────────────────────────


def test_get_dashboard_layout_team_scope():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.live_team_id", return_value=3):
            with patch("api.routes.dashboard.um") as mock_um:
                mock_um.get_dashboard_layout.return_value = []
                with TestClient(make_app()) as c:
                    r = c.get("/dashboard/layout?scope=team")
    assert r.status_code == 200
    assert r.json()["scope"] == "team"


def test_get_dashboard_layout_team_no_team():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.live_team_id", return_value=None):
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/layout?scope=team")
    assert r.status_code == 200
    assert r.json()["widgets"] == []


def test_save_dashboard_layout_team_success():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.live_team_id", return_value=3):
            with patch("api.routes.dashboard.um") as mock_um:
                mock_um.save_dashboard_layout.return_value = True
                with TestClient(make_app()) as c:
                    r = c.put("/dashboard/layout", json={"scope": "team", "widgets": []})
    assert r.status_code == 200


def test_save_dashboard_layout_team_no_team():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.live_team_id", return_value=None):
            with TestClient(make_app()) as c:
                r = c.put("/dashboard/layout", json={"scope": "team", "widgets": []})
    assert r.status_code == 400


def test_save_dashboard_layout_user_save_failure():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.save_dashboard_layout.return_value = False
            with TestClient(make_app()) as c:
                r = c.put("/dashboard/layout", json={"scope": "user", "widgets": []})
    assert r.status_code == 500


def test_list_dashboard_pages_team_scope():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.live_team_id", return_value=3):
            with patch("api.routes.dashboard.um") as mock_um:
                mock_um.list_dashboard_pages.return_value = [
                    {"page": "dashboard", "name": "Default"}
                ]
                with TestClient(make_app()) as c:
                    r = c.get("/dashboard/pages?scope=team&kind=dashboard")
    assert r.status_code == 200


def test_list_dashboard_pages_team_no_team():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.live_team_id", return_value=None):
            with TestClient(make_app()) as c:
                r = c.get("/dashboard/pages?scope=team&kind=dashboard")
    assert r.status_code == 200


def test_create_dashboard_page_bad_kind():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.post(
            "/dashboard/pages",
            json={"scope": "user", "kind": "bad", "name": "X"},
        )
    assert r.status_code == 400


def test_create_dashboard_page_empty_name():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.post(
            "/dashboard/pages",
            json={"scope": "user", "kind": "dashboard", "name": "  "},
        )
    assert r.status_code == 400


def test_create_dashboard_page_team_scope():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.live_team_id", return_value=3):
            with patch("api.routes.dashboard.um") as mock_um:
                mock_um.create_dashboard_page.return_value = {
                    "page": "my-dash",
                    "name": "My",
                }
                with TestClient(make_app()) as c:
                    r = c.post(
                        "/dashboard/pages",
                        json={"scope": "team", "kind": "dashboard", "name": "My"},
                    )
    assert r.status_code == 200


def test_create_dashboard_page_failure():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.create_dashboard_page.return_value = None
            with TestClient(make_app()) as c:
                r = c.post(
                    "/dashboard/pages",
                    json={"scope": "user", "kind": "dashboard", "name": "Fail"},
                )
    assert r.status_code == 500


def test_rename_dashboard_page_success():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.rename_dashboard_page.return_value = True
            with TestClient(make_app()) as c:
                r = c.put(
                    "/dashboard/pages/my-dash",
                    json={"scope": "user", "name": "New Name"},
                )
    assert r.status_code == 200


def test_rename_dashboard_page_not_found():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.rename_dashboard_page.return_value = False
            with TestClient(make_app()) as c:
                r = c.put(
                    "/dashboard/pages/no-such",
                    json={"scope": "user", "name": "New Name"},
                )
    assert r.status_code == 404


def test_delete_dashboard_page_success():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.delete_dashboard_page.return_value = True
            with TestClient(make_app()) as c:
                r = c.delete("/dashboard/pages/my-dash?scope=user")
    assert r.status_code == 200


def test_delete_dashboard_page_not_found():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()):
        with patch("api.routes.dashboard.um") as mock_um:
            mock_um.delete_dashboard_page.return_value = False
            with TestClient(make_app()) as c:
                r = c.delete("/dashboard/pages/no-such?scope=user")
    assert r.status_code == 404


def test_delete_dashboard_page_bad_scope():
    with patch("api.routes.dashboard.dashboard_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.delete("/dashboard/pages/my-dash?scope=bad")
    assert r.status_code == 400
