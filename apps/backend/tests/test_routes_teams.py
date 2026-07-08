"""Route tests for api/routes/teams.py."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from Auth import get_current_user, require_admin, require_operator, require_root
from api.limiter import limiter

FAKE_ROOT = {
    "id": 1,
    "username": "admin",
    "roles": ["root"],
    "team_id": 1,
    "display_name": "Admin",
}


def make_app(router):
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_ROOT
    app.dependency_overrides[require_admin] = lambda: FAKE_ROOT
    app.dependency_overrides[require_operator] = lambda: FAKE_ROOT
    app.dependency_overrides[require_root] = lambda: FAKE_ROOT
    return app


def _client():
    from api.routes.teams import router

    return TestClient(make_app(router), raise_server_exceptions=True)


# ── GET /teams ────────────────────────────────────────────────────────────────


def test_list_teams_200():
    with patch("api.routes.teams.um") as um:
        um.list_teams.return_value = [{"id": 1, "name": "ops"}]
        r = _client().get("/teams")
    assert r.status_code == 200
    assert "teams" in r.json()


def test_teams_overview_200():
    with patch("api.routes.teams.um") as um:
        um.get_overview.return_value = []
        r = _client().get("/teams/overview")
    assert r.status_code == 200


# ── POST /teams ───────────────────────────────────────────────────────────────


def test_create_team_success():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.sync_bot"),
    ):
        um.create_team.return_value = {"id": 2, "name": "dev"}
        r = _client().post("/teams", json={"name": "dev"})
    assert r.status_code == 201


def test_create_team_duplicate_returns_400():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.sync_bot"),
    ):
        um.create_team.return_value = None
        r = _client().post("/teams", json={"name": "existing"})
    assert r.status_code == 400


# ── DELETE /teams/{team_id} ───────────────────────────────────────────────────


def test_delete_team_success():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.sync_bot"),
    ):
        um.get_team_name.return_value = "ops"
        um.delete_team.return_value = True
        r = _client().delete("/teams/1")
    assert r.status_code == 200


def test_delete_team_not_found_404():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.sync_bot"),
    ):
        um.get_team_name.return_value = None
        um.delete_team.return_value = False
        r = _client().delete("/teams/999")
    assert r.status_code == 404


# ── POST /teams/{team_id}/hosts ───────────────────────────────────────────────


def test_assign_host_success():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.host_bot"),
        patch("api.routes.teams.sync_bot"),
        patch("api.routes.teams.live_team_id", return_value=1),
    ):
        um.assign_host.return_value = True
        um.get_team_name.return_value = "ops"
        r = _client().post("/teams/1/hosts", json={"hostname": "server1"})
    assert r.status_code == 201


def test_assign_host_failure_400():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.host_bot"),
        patch("api.routes.teams.sync_bot"),
        patch("api.routes.teams.live_team_id", return_value=1),
    ):
        um.assign_host.return_value = False
        r = _client().post("/teams/1/hosts", json={"hostname": "ghost"})
    assert r.status_code == 400


# ── DELETE /teams/{team_id}/hosts/{hostname} ──────────────────────────────────


def test_unassign_host_success():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.host_bot"),
        patch("api.routes.teams.sync_bot"),
        patch("api.routes.teams.live_team_id", return_value=1),
    ):
        um.get_team_name.return_value = "ops"
        um.unassign_host.return_value = True
        r = _client().delete("/teams/1/hosts/server1")
    assert r.status_code == 200


def test_unassign_host_not_found_404():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.host_bot"),
        patch("api.routes.teams.sync_bot"),
        patch("api.routes.teams.live_team_id", return_value=1),
    ):
        um.get_team_name.return_value = "ops"
        um.unassign_host.return_value = False
        r = _client().delete("/teams/1/hosts/ghost")
    assert r.status_code == 404


# ── POST /teams/{team_id}/members ─────────────────────────────────────────────


def test_add_team_member_success():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.live_team_id", return_value=1),
        patch("api.routes.teams.sync_bot") as sync_bot,
    ):
        um.add_team_membership.return_value = True
        um.get_user_by_id.return_value = {"username": "alice", "roles": ["member"]}
        um.get_team_name.return_value = "ops"
        r = _client().post("/teams/1/members", json={"user_id": 5})
    assert r.status_code == 201
    sync_bot.push_user.assert_called_once_with("alice", "", ["member"], "ops")


def test_add_team_member_failure_400():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.live_team_id", return_value=1),
    ):
        um.add_team_membership.return_value = False
        r = _client().post("/teams/1/members", json={"user_id": 5})
    assert r.status_code == 400


# ── DELETE /teams/{team_id}/members/{user_id} ─────────────────────────────────


def test_remove_team_member_success():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.live_team_id", return_value=1),
    ):
        um.remove_team_membership.return_value = True
        r = _client().delete("/teams/1/members/5")
    assert r.status_code == 200


def test_remove_team_member_not_found_404():
    with (
        patch("api.routes.teams.um") as um,
        patch("api.routes.teams.live_team_id", return_value=1),
    ):
        um.remove_team_membership.return_value = False
        r = _client().delete("/teams/1/members/99")
    assert r.status_code == 404


# ── GET /teams/{team_id}/roles ────────────────────────────────────────────────


def test_get_team_roles_200():
    with patch("api.routes.teams.um") as um:
        um.get_team_roles.return_value = ["operator"]
        r = _client().get("/teams/1/roles")
    assert r.status_code == 200


# ── PUT /teams/{team_id}/roles ────────────────────────────────────────────────


def test_set_team_roles_success():
    with patch("api.routes.teams.um") as um:
        um.set_team_roles.return_value = True
        r = _client().put("/teams/1/roles", json={"roles": ["member"]})
    assert r.status_code == 200


def test_set_team_roles_not_found_404():
    with patch("api.routes.teams.um") as um:
        um.set_team_roles.return_value = False
        r = _client().put("/teams/1/roles", json={"roles": ["member"]})
    assert r.status_code == 404
