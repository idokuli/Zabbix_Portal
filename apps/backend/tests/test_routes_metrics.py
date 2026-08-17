import os
from datetime import UTC, datetime

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


def _fake_conn(fetchall_results):
    """Mock DB connection whose cursor().fetchall() returns each given list
    in turn — one per cur.execute()/fetchall() pair issued by the route."""
    fake_conn = MagicMock()
    fake_cur = MagicMock()
    fake_cur.fetchall.side_effect = fetchall_results
    fake_conn.cursor.return_value.__enter__ = MagicMock(return_value=fake_cur)
    fake_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return fake_conn


def make_app():
    from api.routes.metrics import router

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_ROOT
    return app


# ── problems ──────────────────────────────────────────────────────────────────


def test_get_problems_empty():
    mock_bot = MagicMock()
    mock_bot.get_problems.return_value = []
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.team_hostname_filter", return_value=None):
            with TestClient(make_app()) as c:
                r = c.get("/metrics/problems")
    assert r.status_code == 200
    assert r.json()["problems"] == []


def test_get_problems_root_sees_all():
    mock_bot = MagicMock()
    mock_bot.get_problems.return_value = [
        {"hostname": "web01", "eventid": "1", "acknowledged": False}
    ]
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        # root → team_hostname_filter returns None (no filter)
        with patch("api.routes.metrics.team_hostname_filter", return_value=None):
            with patch("api.routes.metrics.get_conn", return_value=_fake_conn([[], []])):
                with TestClient(make_app()) as c:
                    r = c.get("/metrics/problems")
    assert r.status_code == 200
    problems = r.json()["problems"]
    assert len(problems) == 1
    assert problems[0]["notes"] == []


def test_get_problems_team_filter():
    mock_bot = MagicMock()
    mock_bot.get_problems.return_value = [
        {"hostname": "web01", "eventid": "1", "acknowledged": False},
        {"hostname": "db01", "eventid": "2", "acknowledged": False},
    ]
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.team_hostname_filter", return_value={"web01"}):
            with patch("api.routes.metrics.get_conn", return_value=_fake_conn([[], []])):
                with TestClient(make_app()) as c:
                    r = c.get("/metrics/problems")
    assert r.status_code == 200
    assert len(r.json()["problems"]) == 1
    assert r.json()["problems"][0]["hostname"] == "web01"


# ── problem history ───────────────────────────────────────────────────────────


def test_get_problem_history():
    mock_bot = MagicMock()
    mock_bot.get_problem_history.return_value = [{"clock": 1000}]
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.team_hostname_filter", return_value=None):
            with TestClient(make_app()) as c:
                r = c.get("/metrics/problems/history?hours=12")
    assert r.status_code == 200
    assert len(r.json()["problems"]) == 1


# ── item history ──────────────────────────────────────────────────────────────


def test_get_item_history():
    mock_bot = MagicMock()
    mock_bot.get_item_history.return_value = {"series": []}
    with patch("api.routes.metrics.metrics_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/metrics/history/42?minutes=60")
    assert r.status_code == 200


def test_get_item_history_bad_minutes():
    with patch("api.routes.metrics.metrics_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.get("/metrics/history/42?minutes=9999999")
    assert r.status_code == 400


def test_get_item_history_six_months_ok():
    mock_bot = MagicMock()
    mock_bot.get_item_history.return_value = {"series": []}
    with patch("api.routes.metrics.metrics_bot", mock_bot), TestClient(make_app()) as c:
        r = c.get("/metrics/history/42?minutes=273600")
    assert r.status_code == 200


def test_get_item_history_beyond_six_months_rejected():
    with patch("api.routes.metrics.metrics_bot", MagicMock()), TestClient(make_app()) as c:
        r = c.get("/metrics/history/42?minutes=273601")
    assert r.status_code == 400


# ── acknowledge ───────────────────────────────────────────────────────────────


def test_acknowledge_problem_root():
    mock_bot = MagicMock()
    mock_bot.acknowledge_problem.return_value = True
    fake_conn = MagicMock()
    fake_conn.cursor.return_value.__enter__ = MagicMock(return_value=MagicMock())
    fake_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.get_conn", return_value=fake_conn):
            with TestClient(make_app()) as c:
                r = c.post(
                    "/metrics/problems/evt1/acknowledge",
                    json={"hostname": "web01", "problem_name": "cpu", "severity": 3},
                )
    assert r.status_code == 200
    assert r.json()["acknowledged_by"] == "admin"


def test_acknowledge_problem_zabbix_fail():
    mock_bot = MagicMock()
    mock_bot.acknowledge_problem.return_value = False
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.get_conn", return_value=MagicMock()):
            with TestClient(make_app()) as c:
                r = c.post("/metrics/problems/evt1/acknowledge", json={})
    assert r.status_code == 503


# ── unacknowledge ─────────────────────────────────────────────────────────────


def test_unacknowledge_problem_root():
    """Root (Team Lead+) can unacknowledge."""
    mock_bot = MagicMock()
    mock_bot.unacknowledge_problem.return_value = True
    fake_conn = MagicMock()
    fake_cur = MagicMock()
    fake_cur.fetchone.return_value = {"created_at": datetime.now(UTC)}
    fake_conn.cursor.return_value.__enter__ = MagicMock(return_value=fake_cur)
    fake_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.get_conn", return_value=fake_conn):
            with TestClient(make_app()) as c:
                r = c.post(
                    "/metrics/problems/evt1/unacknowledge",
                    json={"hostname": "web01"},
                )
    assert r.status_code == 200
    assert r.json()["unacknowledged_by"] == "admin"


def test_unacknowledge_problem_zabbix_fail():
    mock_bot = MagicMock()
    mock_bot.unacknowledge_problem.return_value = False
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.get_conn", return_value=MagicMock()):
            with TestClient(make_app()) as c:
                r = c.post("/metrics/problems/evt1/unacknowledge", json={})
    assert r.status_code == 503


# ── acknowledgements list ─────────────────────────────────────────────────────


def test_list_acknowledgements_root():
    fake_conn = MagicMock()
    fake_cur = MagicMock()
    fake_cur.fetchall.return_value = []
    fake_conn.cursor.return_value.__enter__ = MagicMock(return_value=fake_cur)
    fake_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    with patch("api.routes.metrics.metrics_bot", MagicMock()):
        with patch("api.routes.metrics.team_hostname_filter", return_value=None):
            with patch("api.routes.metrics.get_conn", return_value=fake_conn):
                with TestClient(make_app()) as c:
                    r = c.get("/metrics/acknowledgements")
    assert r.status_code == 200
    assert r.json()["acknowledgements"] == []


def test_get_problems_with_acked_db_enrichment():
    """Tests the DB enrichment path when there are acknowledged problems."""
    mock_bot = MagicMock()
    mock_bot.get_problems.return_value = [
        {"hostname": "web01", "eventid": "evt1", "acknowledged": True},
    ]
    ack_rows = [
        {
            "eventid": "evt1",
            "acknowledged_by": "admin",
            "acked_at": __import__("datetime").datetime(2025, 1, 1),
            "note": "ok",
        },
    ]
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.team_hostname_filter", return_value=None):
            with patch("api.routes.metrics.get_conn", return_value=_fake_conn([ack_rows, []])):
                with TestClient(make_app()) as c:
                    r = c.get("/metrics/problems")
    assert r.status_code == 200
    problems = r.json()["problems"]
    assert len(problems) == 1
    assert problems[0]["ack_user"] == "admin"
    assert problems[0]["notes"] == []


def test_get_problems_with_notes():
    """Standalone notes are attached even for unacknowledged problems."""
    mock_bot = MagicMock()
    mock_bot.get_problems.return_value = [
        {"hostname": "web01", "eventid": "evt1", "acknowledged": False},
    ]
    note_rows = [
        {
            "eventid": "evt1",
            "username": "operator",
            "note": "Investigating",
            "created_at": __import__("datetime").datetime(2025, 1, 1),
        },
    ]
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.team_hostname_filter", return_value=None):
            with patch("api.routes.metrics.get_conn", return_value=_fake_conn([[], note_rows])):
                with TestClient(make_app()) as c:
                    r = c.get("/metrics/problems")
    assert r.status_code == 200
    problems = r.json()["problems"]
    assert len(problems) == 1
    assert problems[0]["notes"] == [
        {"username": "operator", "note": "Investigating", "created_at": "2025-01-01T00:00:00"}
    ]


FAKE_NON_ROOT = {
    "id": 2,
    "sub": "2",
    "username": "operator",
    "roles": ["operator"],
    "team_id": 5,
    "display_name": "Op",
}


def make_app_non_root():
    from api.routes.metrics import router

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_NON_ROOT
    return app


def test_acknowledge_problem_non_root_no_hostname():
    """Non-root user without hostname gets 400."""
    mock_bot = MagicMock()
    mock_bot.acknowledge_problem.return_value = True
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with TestClient(make_app_non_root()) as c:
            r = c.post("/metrics/problems/evt1/acknowledge", json={})
    assert r.status_code == 400


def test_acknowledge_problem_non_root_wrong_team():
    """Non-root user for a host not on their team gets 403."""
    mock_bot = MagicMock()
    mock_bot.acknowledge_problem.return_value = True
    fake_conn = MagicMock()
    fake_cur = MagicMock()
    fake_cur.fetchall.return_value = [{"team_id": 99}]  # different team
    fake_conn.cursor.return_value.__enter__ = MagicMock(return_value=fake_cur)
    fake_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.get_conn", return_value=fake_conn):
            with patch("api.routes.metrics.live_team_id", return_value=5):
                with TestClient(make_app_non_root()) as c:
                    r = c.post(
                        "/metrics/problems/evt1/acknowledge",
                        json={
                            "hostname": "web01",
                            "problem_name": "cpu",
                            "severity": 3,
                        },
                    )
    assert r.status_code == 403


def test_unacknowledge_problem_operator_forbidden():
    """Operator (below Team Lead) cannot unacknowledge."""
    mock_bot = MagicMock()
    mock_bot.unacknowledge_problem.return_value = True
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with TestClient(make_app_non_root()) as c:
            r = c.post(
                "/metrics/problems/evt1/unacknowledge",
                json={"hostname": "web01"},
            )
    assert r.status_code == 403


def test_acknowledge_problem_non_root_ok():
    """Non-root user for their own team's host succeeds."""
    mock_bot = MagicMock()
    mock_bot.acknowledge_problem.return_value = True
    fake_conn = MagicMock()
    fake_cur = MagicMock()
    fake_cur.fetchall.return_value = [{"team_id": 5}]  # same team
    fake_conn.cursor.return_value.__enter__ = MagicMock(return_value=fake_cur)
    fake_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.get_conn", return_value=fake_conn):
            with patch("api.routes.metrics.live_team_id", return_value=5):
                with TestClient(make_app_non_root()) as c:
                    r = c.post(
                        "/metrics/problems/evt1/acknowledge",
                        json={
                            "hostname": "web01",
                            "problem_name": "cpu",
                            "severity": 3,
                        },
                    )
    assert r.status_code == 200


# ── add note ──────────────────────────────────────────────────────────────────


def test_add_note_empty_rejected():
    with TestClient(make_app()) as c:
        r = c.post("/metrics/problems/evt1/note", json={"hostname": "web01", "note": "   "})
    assert r.status_code == 400


def test_add_note_root_ok():
    mock_bot = MagicMock()
    mock_bot.add_problem_note.return_value = True
    fake_conn = MagicMock()
    fake_cur = MagicMock()
    fake_cur.fetchone.return_value = {"created_at": __import__("datetime").datetime(2025, 1, 1)}
    fake_conn.cursor.return_value.__enter__ = MagicMock(return_value=fake_cur)
    fake_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.get_conn", return_value=fake_conn):
            with TestClient(make_app()) as c:
                r = c.post(
                    "/metrics/problems/evt1/note",
                    json={"hostname": "web01", "note": "Escalated"},
                )
    assert r.status_code == 200
    assert r.json()["username"] == "admin"
    assert r.json()["note"] == "Escalated"
    mock_bot.add_problem_note.assert_called_once_with("evt1", username="admin", note="Escalated")


def test_add_note_zabbix_fail():
    mock_bot = MagicMock()
    mock_bot.add_problem_note.return_value = False
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with TestClient(make_app()) as c:
            r = c.post(
                "/metrics/problems/evt1/note",
                json={"hostname": "web01", "note": "Escalated"},
            )
    assert r.status_code == 503


def test_add_note_non_root_wrong_team():
    """Non-root user for a host not on their team gets 403."""
    mock_bot = MagicMock()
    mock_bot.add_problem_note.return_value = True
    fake_conn = MagicMock()
    fake_cur = MagicMock()
    fake_cur.fetchall.return_value = [{"team_id": 99}]  # different team
    fake_conn.cursor.return_value.__enter__ = MagicMock(return_value=fake_cur)
    fake_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    with patch("api.routes.metrics.metrics_bot", mock_bot):
        with patch("api.routes.metrics.get_conn", return_value=fake_conn):
            with patch("api.routes.metrics.live_team_id", return_value=5):
                with TestClient(make_app_non_root()) as c:
                    r = c.post(
                        "/metrics/problems/evt1/note",
                        json={"hostname": "web01", "note": "Escalated"},
                    )
    assert r.status_code == 403
