"""Route tests for api/routes/users.py."""

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

FAKE_USER_ROW = {"id": 5, "username": "bob", "roles": ["member"], "team_id": 1}


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
    from api.routes.users import router

    return TestClient(make_app(router), raise_server_exceptions=True)


# ── GET /users ────────────────────────────────────────────────────────────────


def test_list_users_root_sees_all():
    with patch("api.routes.users.um") as um:
        um.list_users.return_value = [FAKE_USER_ROW]
        r = _client().get("/users")
    assert r.status_code == 200
    assert "users" in r.json()


def test_list_users_returns_list():
    with patch("api.routes.users.um") as um:
        um.list_users.return_value = []
        r = _client().get("/users")
    assert isinstance(r.json()["users"], list)


# ── POST /users ───────────────────────────────────────────────────────────────


def test_create_user_success():
    with (
        patch("api.routes.users.um") as um,
        patch("api.routes.users.sync_bot"),
    ):
        um.create_user.return_value = {"id": 10, "username": "alice"}
        um.get_team_name.return_value = "ops"
        r = _client().post(
            "/users",
            json={
                "username": "alice",
                "password": "secret123",
                "email": "alice@example.com",
                "roles": ["member"],
                "team_id": 1,
            },
        )
    assert r.status_code == 201


def test_create_user_short_password_400():
    r = _client().post(
        "/users",
        json={"username": "alice", "password": "short", "roles": ["member"]},
    )
    assert r.status_code == 400


def test_create_user_duplicate_400():
    with (
        patch("api.routes.users.um") as um,
        patch("api.routes.users.sync_bot"),
    ):
        um.create_user.return_value = None
        r = _client().post(
            "/users",
            json={"username": "dup", "password": "password1", "roles": ["member"]},
        )
    assert r.status_code == 400


# ── PUT /users/{user_id} ──────────────────────────────────────────────────────


def test_update_user_success():
    with (
        patch("api.routes.users.um") as um,
        patch("api.routes.users.sync_bot"),
    ):
        um.get_user_by_id.return_value = FAKE_USER_ROW
        um.update_user_profile.return_value = True
        um.get_team_name.return_value = "ops"
        r = _client().put("/users/5", json={"roles": ["member"], "team_id": 1})
    assert r.status_code == 200


def test_update_user_not_found_404():
    with patch("api.routes.users.um") as um:
        um.get_user_by_id.return_value = None
        r = _client().put("/users/999", json={"roles": ["member"], "team_id": 1})
    assert r.status_code == 404


def test_update_user_db_failure_400():
    with (
        patch("api.routes.users.um") as um,
        patch("api.routes.users.sync_bot"),
    ):
        um.get_user_by_id.return_value = FAKE_USER_ROW
        um.update_user_profile.return_value = False
        r = _client().put("/users/5", json={"roles": ["member"], "team_id": 1})
    assert r.status_code == 400


# ── PUT /users/{user_id}/password ─────────────────────────────────────────────


def test_change_password_success():
    with (
        patch("api.routes.users.um") as um,
        patch("api.routes.users.sync_bot"),
    ):
        um.get_user_by_id.return_value = FAKE_USER_ROW
        um.update_password.return_value = True
        r = _client().put("/users/5/password", json={"new_password": "newpass123"})
    assert r.status_code == 200


def test_change_password_too_short_400():
    r = _client().put("/users/5/password", json={"new_password": "short"})
    assert r.status_code == 400


def test_change_password_user_not_found_404():
    with patch("api.routes.users.um") as um:
        um.get_user_by_id.return_value = None
        r = _client().put("/users/999/password", json={"new_password": "newpass123"})
    assert r.status_code == 404


# ── DELETE /users/{user_id} ───────────────────────────────────────────────────


def test_delete_user_success():
    with (
        patch("api.routes.users.um") as um,
        patch("api.routes.users.sync_bot"),
    ):
        um.get_user_by_id.return_value = FAKE_USER_ROW
        um.delete_user.return_value = True
        r = _client().delete("/users/5")
    assert r.status_code == 200


def test_delete_user_not_found_404():
    with patch("api.routes.users.um") as um:
        um.get_user_by_id.return_value = None
        r = _client().delete("/users/999")
    assert r.status_code == 404


def test_delete_user_db_failure_404():
    with (
        patch("api.routes.users.um") as um,
        patch("api.routes.users.sync_bot"),
    ):
        um.get_user_by_id.return_value = FAKE_USER_ROW
        um.delete_user.return_value = False
        r = _client().delete("/users/5")
    assert r.status_code == 404
