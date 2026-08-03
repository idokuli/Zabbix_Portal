"""Auth route tests — login paths, LDAP JIT provisioning, root bypass."""

from unittest.mock import MagicMock, patch

FAKE_TOKEN = "fake.jwt.token"

LOCAL_USER = {
    "id": 1,
    "username": "alice",
    "password_hash": "hashed",
    "roles": ["operator"],
    "source": "local",
    "team_id": None,
    "display_name": "Alice",
}

ROOT_USER = {
    "id": 2,
    "username": "Admin",
    "password_hash": "hashed",
    "roles": ["root"],
    "source": "local",
    "team_id": None,
    "display_name": "Admin",
}

LDAP_USER = {
    "id": 3,
    "username": "bob",
    "password_hash": "unusable",
    "roles": ["operator"],
    "source": "ldap",
    "team_id": None,
    "display_name": "Bob",
}


def _post(client, username, password):
    return client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )


# ── Local auth ────────────────────────────────────────────────────────────────


def test_local_login_success(auth_client):
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=LOCAL_USER),
        patch("api.routes.auth.is_ldap_enabled", return_value=False),
        patch("api.routes.auth.verify_password", return_value=True),
        patch("api.routes.auth.create_token", return_value=FAKE_TOKEN),
    ):
        res = _post(auth_client, "alice", "correct")
    assert res.status_code == 200
    assert res.json()["access_token"] == FAKE_TOKEN


def test_local_login_wrong_password(auth_client):
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=LOCAL_USER),
        patch("api.routes.auth.is_ldap_enabled", return_value=False),
        patch("api.routes.auth.verify_password", return_value=False),
    ):
        res = _post(auth_client, "alice", "wrong")
    assert res.status_code == 401


def test_login_passes_username_through_uncased(auth_client):
    """The login route must NOT lowercase the input — case-insensitivity is the DB
    lookup's job. Lowercasing here locked out every row stored with other casing,
    including the seeded root account, which is created as 'Admin'."""
    get_user_by_username = MagicMock(return_value=LOCAL_USER)
    with (
        patch("api.routes.auth.um.get_user_by_username", get_user_by_username),
        patch("api.routes.auth.is_ldap_enabled", return_value=False),
        patch("api.routes.auth.verify_password", return_value=True),
        patch("api.routes.auth.create_token", return_value=FAKE_TOKEN),
    ):
        res = _post(auth_client, "  AlIcE  ", "correct")
    assert res.status_code == 200
    # Whitespace trimmed, casing preserved and handed to the case-insensitive lookup.
    get_user_by_username.assert_called_once_with("AlIcE")


def test_seeded_root_with_capitalised_username_can_log_in(auth_client):
    """Regression: seed_root() stores 'Admin'. Logging in as 'Admin' (or any casing)
    must reach that row rather than 401."""
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=ROOT_USER),
        patch("api.routes.auth.is_ldap_enabled", return_value=False),
        patch("api.routes.auth.verify_password", return_value=True),
        patch("api.routes.auth.create_token", return_value=FAKE_TOKEN),
    ):
        res = _post(auth_client, "Admin", "change-me")
    assert res.status_code == 200


def test_unknown_user_returns_401(auth_client):
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=None),
        patch("api.routes.auth.is_ldap_enabled", return_value=False),
    ):
        res = _post(auth_client, "nobody", "x")
    assert res.status_code == 401


# ── LDAP JIT provisioning ─────────────────────────────────────────────────────


def test_ldap_jit_provisioning(auth_client):
    """Unknown user + LDAP enabled + valid LDAP credentials → auto-create + 200."""
    provisioned = {**LOCAL_USER, "id": 99, "username": "newbie", "source": "ldap"}
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=None),
        patch("api.routes.auth.is_ldap_enabled", return_value=True),
        patch("api.routes.auth.authenticate_ldap", return_value=(True, "New User")),
        patch("api.routes.auth.um.create_user", return_value=provisioned),
        patch("api.routes.auth.hash_password", return_value="unusable"),
        patch("api.routes.auth.create_token", return_value=FAKE_TOKEN),
    ):
        res = _post(auth_client, "newbie", "ldappass")
    assert res.status_code == 200
    assert res.json()["access_token"] == FAKE_TOKEN


def test_ldap_jit_provisioning_stores_lowercase(auth_client):
    """LDAP-provisioned accounts are stored lowercase, so a directory user who types a
    new capitalisation each time never accumulates duplicate portal accounts."""
    provisioned = {**LOCAL_USER, "id": 99, "username": "idokuli", "source": "ldap"}
    create_user = MagicMock(return_value=provisioned)
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=None),
        patch("api.routes.auth.is_ldap_enabled", return_value=True),
        patch("api.routes.auth.authenticate_ldap", return_value=(True, "Ido Kulishevski")),
        patch("api.routes.auth.um.create_user", create_user),
        patch("api.routes.auth.hash_password", return_value="unusable"),
        patch("api.routes.auth.create_token", return_value=FAKE_TOKEN),
    ):
        res = _post(auth_client, "IdOkUlI", "ldappass")
    assert res.status_code == 200
    assert create_user.call_args.kwargs["username"] == "idokuli"


def test_ldap_jit_wrong_credentials(auth_client):
    """Unknown user + LDAP enabled + bad LDAP credentials → 401."""
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=None),
        patch("api.routes.auth.is_ldap_enabled", return_value=True),
        patch("api.routes.auth.authenticate_ldap", return_value=(False, "")),
    ):
        res = _post(auth_client, "newbie", "wrong")
    assert res.status_code == 401


# ── Root bypasses LDAP ────────────────────────────────────────────────────────


def test_root_local_source_bypasses_ldap(auth_client):
    """root + source=local always uses internal auth, even when LDAP is on."""
    authenticate_ldap = MagicMock()
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=ROOT_USER),
        patch("api.routes.auth.is_ldap_enabled", return_value=True),
        patch("api.routes.auth.verify_password", return_value=True),
        patch("api.routes.auth.create_token", return_value=FAKE_TOKEN),
        patch("api.routes.auth.authenticate_ldap", authenticate_ldap),
    ):
        res = _post(auth_client, "Admin", "correct")
    assert res.status_code == 200
    authenticate_ldap.assert_not_called()


# ── LDAP-sourced user always authenticates via LDAP ──────────────────────────


def test_ldap_sourced_user_uses_ldap_not_local(auth_client):
    """A user with source=ldap (even if they have root role) must go through LDAP."""
    ldap_root = {**LDAP_USER, "roles": ["root"]}
    with (
        patch("api.routes.auth.um.get_user_by_username", return_value=ldap_root),
        patch("api.routes.auth.is_ldap_enabled", return_value=True),
        patch("api.routes.auth.authenticate_ldap", return_value=(True, "Bob")),
        patch("api.routes.auth.create_token", return_value=FAKE_TOKEN),
    ):
        verify_password = MagicMock()
        with patch("api.routes.auth.verify_password", verify_password):
            res = _post(auth_client, "bob", "ldappass")
    assert res.status_code == 200
    verify_password.assert_not_called()
