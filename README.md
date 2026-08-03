# Overwatch

A full-stack DevOps UI for managing Zabbix hosts, items, triggers, teams, and users — with role-based access control, Portal LDAP authentication, live metrics, custom alert rules, and a PostgreSQL-backed user database.

- **Backend** — Python 3.12 / FastAPI (`apps/backend/`)
- **Frontend** — React 18 / Next.js 15 App Router / TypeScript / MUI (`apps/frontend/`)
- **Database** — PostgreSQL (shared / external — not deployed by this repo)
- **Deployment** — GitOps: CI pushes image tags to the `zabbix-portal-gitops` repo; ArgoCD syncs each cluster from there (Helm charts live in the GitOps repo).

> See [`CLAUDE.md`](./CLAUDE.md) for an architectural reference, [`WORKFLOW.md`](./WORKFLOW.md) for the CI/CD flow, [`RELEASING.md`](./RELEASING.md) for the release process, and [`PRIVATE_NETWORK.md`](./PRIVATE_NETWORK.md) for the air-gapped configuration checklist.

---

## Features

- JWT-based login with role-based access control
- **Portal LDAP authentication** — users sign in with LDAP/AD credentials; accounts are created automatically on first login (JIT provisioning) with the `operator` role
- Multi-role users — a user can hold multiple roles simultaneously
- Teams — group users and host assignments together; a user can belong to multiple teams simultaneously and sees the union of all their teams' hosts
- Expandable user rows in TeamCard — click any member to see their login name, display name (LDAP full name), email, and source (Local / LDAP / Zabbix)
- Role cascade (Windows-style) — selecting a higher role auto-selects lower ones
- Users page — root sees all users platform-wide; team leads see their team
- List, create, and delete Zabbix hosts; tag hosts to teams
- Bulk-create hosts from `.csv` / `.xlsx`; export inventory to `.xlsx`
- Add and delete monitoring items (~20 item types — agent, HTTP, SNMP, SNMP trap, internal, trapper, external, IPMI, SSH, telnet, JMX, calculated, dependent, Zabbix script, browser, ODBC/Agent2 DB monitors, file watch, service check) and triggers on hosts
- **Dashboard** — native Zabbix graphs, per-host last-value metrics, recent items; saveable per-user / per-team widget layouts with multiple named pages
- **Metrics** — live active-problems table with acknowledgement audit, item-history charts (Item Graphs), historical problem windows, and custom alert rules (threshold conditions with severities and per-rule sounds)
- Problems can be sorted by severity (default), newest, or oldest, and acknowledged problems can be auto-hidden after a chosen delay (1 min – 4 h, or never) with a live countdown on each row — a portal-side view filter only, nothing is closed in Zabbix
- **Data collection** — template groups, host groups, templates, maintenance windows, event correlation, discovery rules
- **Services** — business services, SLAs with SLA reports, simple URL/host "health monitor" checks
- **Reports** — top-100 triggers, audit log, action log, availability report, alert history
- **Actions & alerting** — trigger/service/discovery/autoregistration/internal actions, media types, scripts, plus per-user threshold alert rules
- **Administration** — Zabbix user groups & roles, API tokens, proxies & proxy groups (Zabbix 7.x), global macros, the item processing queue, authentication and housekeeping settings
- Desktop notifications + audible alerts, plus a notification center in the top bar, when new problems fire — with an optional "keep notifications on screen" mode (on by default) that pins the OS toast until it's dismissed instead of letting it auto-fade
- Standalone notes on a problem, independent of acknowledging it — leave a comment without changing ack status, or after it's already been acknowledged
- Consistent date/time display everywhere — dates as `DD/MM/YYYY`, times as `HH:MM:SS` on a 24-hour clock, identical for every user regardless of browser locale
- Real-time updates via Server-Sent Events — the UI refreshes when the backend syncs with Zabbix
- Health check for API / Zabbix connectivity with live status dots in the top bar; LDAP users see their display name (full AD name) in the user menu
- Toast-style notifications for all user actions

---

## Repository layout

```
apps/
  backend/    FastAPI app (Python 3.12) — Zabbix API wrapper + PostgreSQL user DB
  frontend/   Next.js 15 App Router (TypeScript / MUI)
.gitlab/ci/         modular GitLab CI pipeline
biome.json          Biome (linter + formatter)
.npmrc              Exact-version / private-registry config
docker-compose.yml  local orchestration (backend + frontend)
```

> Helm charts and ArgoCD manifests live in the **`zabbix-portal-gitops`** repo. The CI pipeline here only builds images and pushes updated tags to that repo.

> PostgreSQL is a **shared/external** database. It is not in `apps/` and not deployed by Helm — the backend connects to it via `DATABASE_URL`.

---

## Requirements

- **Python** 3.12+
- **Node.js** 22+
- **PostgreSQL** 14+ (shared user/team database)
- **Docker** for local containers
- **Helm** 3.17+ and **kubectl** for cluster work
- Access to a Zabbix server with API credentials

---

## Environment files

The project uses two `.env` files — one per app. Neither is committed to git.

### `apps/backend/.env`

Required for the backend to start. Create this file before running the server.

```env
# ── Zabbix connection ────────────────────────────────────────
ZABBIX_URL=http://your-zabbix-server          # plain hostname works — /api_jsonrpc.php is added automatically
ZABBIX_USER=Admin
ZABBIX_PASS=zabbix
# Set to false ONLY on a trusted private network with a self-signed cert.
ZABBIX_SSL_VERIFY=true

# ── PostgreSQL (shared/external) ──────────────────────────────
# Format: postgresql://user:password@host:port/dbname
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zabbix_portal

# ── JWT signing key ───────────────────────────────────────────
# Change this to a long random string before any real deployment.
# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=change-me-in-production

# ── Seed root account (first boot only) ──────────────────────
# If ADMIN_PASSWORD is unset, the backend seeds 'admin' with a logged warning.
ADMIN_USERNAME=Admin
ADMIN_PASSWORD=change-me

# ── Frontend proxy hint (not used by the backend itself) ─────
# Tells the Next.js route handler where to forward /api/* requests.
BACKEND_URL=http://localhost:6769

# ── CORS ───────────────────────────────────────────────────
# Comma-separated list of origins allowed to call the API. Defaults to "*".
ALLOWED_ORIGINS=http://localhost:42069

# ── Alert checker ─────────────────────────────────────────────
# How often (seconds) Alert_Manager evaluates threshold rules. Default 15, min 5.
ALERT_CHECK_INTERVAL=15
```

| Variable               | Required | Description |
| ----------------------- | -------- | ----------- |
| `ZABBIX_URL`            | Yes | Full URL of your Zabbix server |
| `ZABBIX_USER`           | Yes | Zabbix API user (must have API access) |
| `ZABBIX_PASS`           | Yes | Zabbix API password |
| `ZABBIX_SSL_VERIFY`     | No  | TLS verification for the Zabbix API probe; `true` by default |
| `DATABASE_URL`          | Yes | PostgreSQL connection string for the shared user/team database |
| `SECRET_KEY`            | Yes | Secret used to sign JWT tokens — **change before production** |
| `ADMIN_USERNAME`        | No  | Seed root username (default `Admin`) |
| `ADMIN_PASSWORD`        | No  | Seed root password (default `admin`, with a startup warning) |
| `BACKEND_URL`           | No  | Read by the frontend proxy; defaults to `http://localhost:6769` |
| `ALLOWED_ORIGINS`       | No  | CORS allow-list, comma-separated; defaults to `*` |
| `ALERT_CHECK_INTERVAL`  | No  | Alert-rule evaluation interval in seconds; defaults to `15` (min `5`) |

On first startup the backend creates the schema and seeds a root user (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). **Change this password immediately after the first login.**

### `apps/frontend/.env`

This file is **baked into the Docker image** at build time. Update it before building the image when the backend address changes. `REFRESH_INTERVAL` is the exception — it is read at runtime via `/api/config` and can be changed without rebuilding.

```env
# Where the Next.js route handler forwards /api/* requests.
# Local dev:            http://localhost:6769
# Docker shared net:    http://backend:6769
# Mac/Windows Desktop:  http://host.docker.internal:6769
BACKEND_URL=http://host.docker.internal:6769

# Page auto-refresh interval in seconds. Read at runtime — no rebuild needed.
# Override via Kubernetes Secret (key: REFRESH_INTERVAL) or docker run -e.
REFRESH_INTERVAL=10
```

In local development (`npm run dev`) Next.js loads this file automatically. In the Docker image it is loaded once at server startup via `src/instrumentation.ts`. When running with `docker compose`, `BACKEND_URL` is injected at runtime via the `environment:` block in `docker-compose.yml`. In-cluster the Route handles `/api/*`, so `BACKEND_URL` is unused there; `REFRESH_INTERVAL` however is always read at runtime via the `/api/config` endpoint and can be set in the OpenShift Secret.

---

## Quick start (local development)

```bash
# 1. Create apps/backend/.env (see above), pointing DATABASE_URL at your shared
#    PostgreSQL — or start a throwaway local one:
docker run -d --name pg -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=zabbix_portal \
  postgres:16

# 2. Install backend Python deps and start the backend (port 6769)
cd apps/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn Zabbix_Main:app --host 0.0.0.0 --port 6769 --reload

# 3. In another terminal, install frontend deps and start the frontend (port 42069)
cd apps/frontend
npm install
npm run dev
```

Open <http://localhost:42069>. Log in with your seeded root account and change the password.

The frontend proxies `/api/*` to `http://localhost:6769` via the Next.js catch-all route handler at `src/app/api/[...path]/route.ts`.

---

## Roles

| Role        | Level | Description |
| ----------- | ----- | ----------- |
| `root`      | 4     | Full platform access — create/delete teams, manage all users and hosts |
| `team_lead` | 3     | Full access within their team — users, hosts, assignments, passwords |
| `operator`  | 2     | Host and monitoring CRUD within the team — no user management |
| `member`    | 1     | Read-only access to the team's hosts |
| `auditor`   | —     | Read-only cross-team visibility (standalone — only root can grant this) |

A user can hold multiple roles. When a higher role is selected in the UI, lower roles in the hierarchy are automatically selected (Windows-style cascade). A user can only grant roles at or below their own level; only root can grant `auditor`.

---

## Authentication

Overwatch supports two authentication methods:

- **Local** — username/password stored in PostgreSQL with bcrypt hashing. The root account always uses local authentication.
- **Portal LDAP** — users sign in with their LDAP/Active Directory credentials. Accounts are created automatically on first login (JIT provisioning) with the `operator` role. Configured in **Users Management → Authentication → Portal Login**.

Users imported from Zabbix via the background sync are tagged `source='zabbix'` and can be distinguished from local (`source='local'`) and LDAP JIT-provisioned (`source='ldap'`) accounts. The sync never deletes local or LDAP users.

Portal usernames are **case-insensitive at login** — the lookup matches on `LOWER(username)`, so `IdOkUlI`, `idokuli`, and `IDOKULI` all resolve to the same account (including the seeded `Admin` root user), matching how LDAP/AD itself treats usernames. Accounts the portal creates are stored lowercase so one directory user can never accumulate duplicate portal accounts; accounts from other sources keep their original casing.

---

## Running with Docker Compose

A `docker-compose.yml` at the repo root wires the two app services together. PostgreSQL is external — set `DATABASE_URL` in `apps/backend/.env` to point at your shared instance.

```bash
# Build and start backend + frontend
docker compose up -d --build

# View logs
docker compose logs -f

# Tear down
docker compose down
```

Open <http://localhost:42069>.

The backend includes a health check (`GET /health`). The frontend waits for the backend to be healthy before starting (`depends_on: condition: service_healthy`), so there is no startup race condition.

### Running containers individually

```bash
# Build images
docker build -t overwatch-backend  apps/backend/
docker build -t overwatch-frontend apps/frontend/

# Shared network (enables container DNS)
docker network create overwatch-net

# Backend (DATABASE_URL in .env points at your shared PostgreSQL)
docker run -d --name backend --network overwatch-net \
  --env-file apps/backend/.env \
  -p 6769:6769 \
  overwatch-backend

# Frontend
docker run -d --name frontend --network overwatch-net \
  -e BACKEND_URL=http://backend:6769 \
  -p 42069:42069 \
  overwatch-frontend
```

---

## API endpoints

All paths require a `Bearer` JWT unless noted. "Operator+" = root / team_lead / operator; "Team Lead+" = root / team_lead; "Root" = root only.

### Auth

| Method | Path            | Auth | Description |
| ------ | --------------- | ---- | ----------- |
| POST   | `/auth/login`   | No   | Login — returns a JWT |
| GET    | `/auth/me`      | Yes  | Decoded current user |

### Status & sync

| Method | Path                      | Auth | Description |
| ------ | ------------------------- | ---- | ----------- |
| GET    | `/health`                 | No   | API + Zabbix connectivity check |
| POST   | `/sync`                   | Root | Trigger a full bidirectional Zabbix sync now |
| GET    | `/sync/debug/{team_name}` | Root | Inspect Zabbix groups/permissions for a team |
| GET    | `/events`                 | Yes  | Server-Sent Events stream for real-time sync |

### Hosts

| Method | Path                     | Auth       | Description |
| ------ | ------------------------ | ---------- | ----------- |
| GET    | `/hosts`                 | Yes        | List hosts (filtered by team for non-root/auditor) |
| GET    | `/hosts/download`        | Yes        | Export host inventory to `.xlsx` |
| GET    | `/templates`             | Yes        | List available Zabbix templates |
| POST   | `/hosts`                 | Operator+  | Create a single host |
| POST   | `/hosts/bulk`            | Operator+  | Bulk create from CSV / XLSX upload |
| PUT    | `/hosts/{hostname}`      | Team Lead+ | Update display name, IP, proxy, or status |
| PUT    | `/hosts/{hostname}/tags` | Operator+  | Update custom tags on a host |
| DELETE | `/hosts/{hostname}`      | Operator+  | Delete a host |

### Items & Triggers

| Method | Path                     | Auth      | Description |
| ------ | ------------------------ | --------- | ----------- |
| GET    | `/items`                 | Yes       | List all items across all hosts (`?search=`) |
| GET    | `/items/keys`            | Yes       | List agent item keys from templates linked to a host (`?hostname=`, team-restricted) |
| GET    | `/items/{hostname}`      | Yes       | List items for a host |
| POST   | `/items`                 | Operator+ | Add a Zabbix agent item to a host |
| POST   | `/items/bulk`            | Operator+ | Add the same item to multiple hosts |
| PUT    | `/items/{itemid}`        | Operator+ | Update an item (name, delay, status, key) |
| DELETE | `/items/{itemid}`        | Operator+ | Delete an item |
| GET    | `/triggers`              | Yes       | List all triggers across all hosts (`?search=&hostname=`) |
| GET    | `/triggers/{hostname}`   | Yes       | List triggers for a host |
| POST   | `/triggers`              | Operator+ | Add a trigger to an item |
| POST   | `/triggers/bulk`         | Operator+ | Add the same trigger to multiple hosts |
| PUT    | `/triggers/{triggerid}`  | Operator+ | Update name, severity, status, or expression |
| DELETE | `/triggers/{triggerid}`  | Operator+ | Delete a trigger |

`POST /items` and its specialized siblings each add a different Zabbix item type — `/items/http`, `/items/service`, `/items/filewatch`, `/items/script`, `/items/db/odbc`, `/items/db/agent2`, `/items/snmp`, `/items/snmptrap`, `/items/internal`, `/items/trapper`, `/items/external`, `/items/ipmi`, `/items/ssh`, `/items/telnet`, `/items/jmx`, `/items/calculated`, `/items/dependent`, `/items/zabbix-script`, `/items/browser` — all `POST`, all Operator+, each with its own request body shape (see `Zabbix_Main.py` for the per-type Pydantic models).

### Metrics

| Method | Path                          | Auth | Description |
| ------ | ----------------------------- | ---- | ----------- |
| GET    | `/metrics/problems`           | Yes  | Active Zabbix problems |
| POST   | `/metrics/problems/{eventid}/acknowledge` | Yes | Acknowledge a Zabbix problem |
| POST   | `/metrics/problems/{eventid}/note` | Yes | Add a note to a problem without acknowledging it |
| GET    | `/metrics/acknowledgements`   | Yes  | Acknowledgement audit log |
| GET    | `/metrics/problems/history`   | Yes  | Historical problems in a time window |
| GET    | `/metrics/history/{itemid}`   | Yes  | Item history time-series (`?minutes=`) |

### Dashboard

| Method | Path                                   | Auth | Description |
| ------ | -------------------------------------- | ---- | ----------- |
| GET    | `/dashboard/graphs`                    | Yes  | List Zabbix graphs (`?hostid=`) |
| GET    | `/dashboard/graphs/{graphid}/image`    | Yes  | Proxy native Zabbix graph PNG |
| GET    | `/dashboard/graphs/{graphid}/data`     | Yes  | Chart.js series for a graph |
| GET    | `/dashboard/hosts/metrics`             | Yes  | Last metric values for all hosts |
| GET    | `/dashboard/items/recent`              | Yes  | Recently created items |
| GET    | `/dashboard/layout`                    | Yes  | Saved widget layout (`?scope=user\|team`) |
| PUT    | `/dashboard/layout`                    | Yes  | Save widget layout |

### Teams

| Method | Path                                | Auth       | Description |
| ------ | ----------------------------------- | ---------- | ----------- |
| GET    | `/teams/overview`                   | Yes        | Teams with members and assigned hosts |
| GET    | `/teams`                            | Yes        | List teams |
| POST   | `/teams`                            | Root       | Create a team |
| DELETE | `/teams/{team_id}`                  | Root       | Delete a team |
| POST   | `/teams/{team_id}/hosts`            | Team Lead+ | Assign a host to a team |
| DELETE | `/teams/{team_id}/hosts/{hostname}` | Team Lead+ | Remove a host from a team |

### Users

| Method | Path                       | Auth       | Description |
| ------ | -------------------------- | ---------- | ----------- |
| GET    | `/users`                   | Team Lead+ | List users (root sees all; team lead sees their team) |
| POST   | `/users`                   | Team Lead+ | Create a new user |
| PUT    | `/users/{user_id}`         | Team Lead+ | Update roles and/or team |
| PUT    | `/users/{user_id}/password`| Team Lead+ | Change a user's password |
| DELETE | `/users/{user_id}`         | Team Lead+ | Delete a user |

### Alerts (per-user threshold rules)

| Method | Path                            | Auth | Description |
| ------ | ------------------------------- | ---- | ----------- |
| GET    | `/alerts/rules`                 | Yes  | List the current user's alert rules |
| POST   | `/alerts/rules`                 | Yes  | Create an alert rule (threshold condition) |
| PUT    | `/alerts/rules/{rule_id}`       | Yes  | Update an alert rule |
| DELETE | `/alerts/rules/{rule_id}`       | Yes  | Delete an alert rule |
| PATCH  | `/alerts/rules/{rule_id}/toggle`| Yes  | Enable/disable an alert rule |
| GET    | `/alerts/events`                | Yes  | Recent alert events for the current user |

### Data Collection (`/dc/*`)

Template groups, host groups, templates, maintenance windows, event correlation, and discovery rules — each follows the same `GET` (list, any role) / `POST` (create, Team Lead+) / `DELETE` (Team Lead+) shape, plus `PUT` to rename groups and a `GET .../{groupid}/members` to list contents:

| Resource | List | Create | Rename | Delete | Members |
| -------- | ---- | ------ | ------ | ------ | ------- |
| Template groups | `GET /dc/template-groups` | `POST /dc/template-groups` | `PUT /dc/template-groups/{groupid}` | `DELETE /dc/template-groups/{groupid}` | `GET /dc/template-groups/{groupid}/members` |
| Host groups | `GET /dc/host-groups` | `POST /dc/host-groups` | `PUT /dc/host-groups/{groupid}` | `DELETE /dc/host-groups/{groupid}` | `GET /dc/host-groups/{groupid}/members` |
| Templates | `GET /dc/templates` | `POST /dc/templates` | — | `DELETE /dc/templates/{templateid}` | — |
| Maintenance windows | `GET /dc/maintenances` | `POST /dc/maintenances` | — | `DELETE /dc/maintenances/{maintenanceid}` | — |
| Event correlations | `GET /dc/correlations` | `POST /dc/correlations` | — | `DELETE /dc/correlations/{correlationid}` | — |
| Discovery rules | `GET /dc/discovery-rules` | `POST /dc/discovery-rules` | — | `DELETE /dc/discovery-rules/{druleid}` | — |

All `GET`s require any authenticated user; all `POST`/`PUT`/`DELETE`s require Team Lead+.

### Reports (read-only)

| Method | Path                     | Auth | Description |
| ------ | ------------------------ | ---- | ----------- |
| GET    | `/reports/top-triggers`  | Yes  | Top triggers by problem count (`?limit=&severity_min=&hours=`) |
| GET    | `/reports/audit-log`     | Yes  | Zabbix audit log (`?limit=&time_from=&userid=`) |
| GET    | `/reports/action-log`    | Yes  | Action execution log (`?limit=&time_from=`) |
| GET    | `/reports/availability`  | Yes  | Per-host-group availability (`?hours=&groupid=`) |
| GET    | `/reports/notifications` | Yes  | Notification history (`?hours=&limit=`) |

### Actions, Media Types & Scripts

| Method | Path                           | Auth      | Description |
| ------ | ------------------------------ | --------- | ----------- |
| GET    | `/actions`                     | Yes       | List actions (`?eventsource=` — trigger/discovery/autoregistration/internal/service) |
| POST   | `/actions`                     | Team Lead+| Create an action |
| PUT    | `/actions/{actionid}/toggle`   | Team Lead+| Enable/disable an action |
| DELETE | `/actions/{actionid}`          | Team Lead+| Delete an action |
| GET    | `/media-types`                 | Yes       | List media types |
| POST   | `/media-types`                 | Team Lead+| Create a media type |
| PUT    | `/media-types/{mediatypeid}/toggle` | Team Lead+ | Enable/disable a media type |
| DELETE | `/media-types/{mediatypeid}`   | Team Lead+| Delete a media type |
| GET    | `/scripts`                     | Yes       | List scripts |
| POST   | `/scripts`                     | Team Lead+| Create a script |
| DELETE | `/scripts/{scriptid}`          | Team Lead+| Delete a script |

### Services, SLA & Health Monitors

| Method | Path                          | Auth       | Description |
| ------ | ------------------------------ | ---------- | ----------- |
| GET    | `/services`                    | Yes        | List business services (`?parentid=`) |
| POST   | `/services`                    | Team Lead+ | Create a service |
| PUT    | `/services/{serviceid}`        | Team Lead+ | Update a service |
| DELETE | `/services/{serviceid}`        | Team Lead+ | Delete a service |
| GET    | `/sla`                         | Yes        | List SLAs |
| POST   | `/sla`                         | Team Lead+ | Create an SLA |
| DELETE | `/sla/{slaid}`                 | Team Lead+ | Delete an SLA |
| GET    | `/sla/{slaid}/report`          | Yes        | SLA report (`?periods=`, 1–12) |
| GET    | `/health-monitors`             | Yes        | List health-monitor items (`?hostid=`) |
| POST   | `/health-monitors`             | Operator+  | Add a URL/host health-monitor item |
| DELETE | `/health-monitors/{itemid}`    | Operator+  | Delete a health-monitor item |

### Administration

Zabbix server administration — most reads are open to any authenticated user, writes are Team Lead+ unless noted. `/api-tokens` and the housekeeping/auth-settings writes are **Root only**.

| Method | Path                          | Auth       | Description |
| ------ | ------------------------------ | ---------- | ----------- |
| GET    | `/user-groups`                 | Team Lead+ | List Zabbix user groups |
| POST   | `/user-groups`                 | Team Lead+ | Create a user group |
| DELETE | `/user-groups/{usrgrpid}`      | Team Lead+ | Delete a user group |
| GET    | `/zabbix-users`                 | Team Lead+ | List native Zabbix users (read-only) |
| GET    | `/roles`                       | Team Lead+ | List Zabbix user roles |
| POST   | `/roles`                       | Team Lead+ | Create a role |
| PUT    | `/roles/{roleid}`              | Team Lead+ | Rename a role |
| DELETE | `/roles/{roleid}`              | Team Lead+ | Delete a role |
| GET    | `/api-tokens`                  | Root       | List Zabbix API tokens |
| POST   | `/api-tokens`                  | Root       | Create an API token |
| DELETE | `/api-tokens/{tokenid}`        | Root       | Delete an API token |
| GET    | `/proxies`                     | Yes        | List proxies |
| POST   | `/proxies`                     | Team Lead+ | Create a proxy |
| PUT    | `/proxies/{proxyid}`           | Team Lead+ | Update a proxy |
| DELETE | `/proxies/{proxyid}`           | Team Lead+ | Delete a proxy |
| GET    | `/proxy_groups`                | Yes        | List proxy groups (Zabbix 7.x) |
| POST   | `/proxy_groups`                | Team Lead+ | Create a proxy group |
| DELETE | `/proxy_groups/{proxygroupid}` | Team Lead+ | Delete a proxy group |
| GET    | `/macros`                      | Yes        | List global macros |
| POST   | `/macros`                      | Team Lead+ | Create a global macro |
| PUT    | `/macros/{globalmacroid}`      | Team Lead+ | Update a global macro |
| DELETE | `/macros/{globalmacroid}`      | Team Lead+ | Delete a global macro |
| GET    | `/admin/queue`                 | Team Lead+ | Item processing queue overview |
| GET    | `/admin/settings`              | Team Lead+ | Read Zabbix server settings (incl. housekeeping) |
| PUT    | `/admin/housekeeping`          | Root       | Update housekeeping settings |
| GET    | `/admin/auth`                  | Root       | Read authentication settings |
| PUT    | `/admin/auth`                  | Root       | Update authentication settings |
| GET    | `/admin/auth/portal-ldap`      | Root       | Read Portal LDAP config |
| PUT    | `/admin/auth/portal-ldap`      | Root       | Save Portal LDAP config |
| POST   | `/admin/auth/portal-ldap/test` | Root       | Test a Portal LDAP connection |

### Bulk import file format

CSV or XLSX with columns:

- `hostname` (or `host`) — required
- `ip` (or `ip_address`) — required
- `template` — optional, defaults to `Linux by Zabbix agent`

### Trigger expression format

```
{hostname:item_key.last()} operator threshold

# Example:
{web-01:system.cpu.load.last()}>5
```

---

## Production deployment

### GitOps via ArgoCD

Deployments are managed by ArgoCD using Helm charts from the `zabbix-portal-gitops` repo. The CI pipeline here builds images and updates image tags in that repo; ArgoCD syncs each environment automatically (staging) or on manual approval (production, DR).

Sensitive credentials (`ZABBIX_PASS`, `SECRET_KEY`, the DB connection string) belong in a Kubernetes Secret referenced via `existingSecret` in Helm values — never baked into images or stored in plain ConfigMaps. See [`RELEASING.md`](./RELEASING.md) for the full release runbook.

---

## Private network / OpenShift

This project is designed to run in air-gapped or private-registry environments:

- All `FROM` lines in Dockerfiles have `# PRIVATE NETWORK:` comments showing the exact image and Artifactory replacement format.
- npm packages are pinned to **exact versions** (no `^` or `~`) and `.npmrc` is set up for a private registry.
- Both containers run as **non-root** (`USER 1001`, GID 0) — the frontend as a Next.js standalone server (`node server.js`) on port 42069, with no nginx, so they work under OpenShift's `restricted` SCC.
- The frontend Route has TLS enabled by default (edge termination); OpenShift's router provides the wildcard certificate automatically when using the auto-generated hostname.

See [`PRIVATE_NETWORK.md`](./PRIVATE_NETWORK.md) for the complete line-by-line checklist of every value to change, and [`CLAUDE.md`](./CLAUDE.md) for the architectural rationale.

---

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — architectural reference and conventions
- [`WORKFLOW.md`](./WORKFLOW.md) — development + CI/CD pipeline flow
- [`RELEASING.md`](./RELEASING.md) — release / deployment runbook
- [`PRIVATE_NETWORK.md`](./PRIVATE_NETWORK.md) — air-gapped configuration checklist
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — running the stack with Docker
- [`OVERWATCH_USER_GUIDE.html`](./OVERWATCH_USER_GUIDE.html) — end-user guide
