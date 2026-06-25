# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code conventions

- **Variables in code:** whenever you write a variable that the user needs to fill in (CI variables, image names, URLs, tokens, credentials, runner tags, etc.), always use a descriptive dummy name (e.g. `<your-oc-image>`, `staging-runner`, `STAGING_TOKEN`) and add an inline comment explaining exactly what it is and where it needs to be changed. Never leave a variable placeholder without a comment.

## Formatting — mandatory after every edit

After editing any file, always run the formatter for that side before finishing:

| Side | Formatter | Command (run from repo root) |
|------|-----------|------------------------------|
| **Backend** (`apps/backend/**/*.py`) | `ruff format` | `cd apps/backend && ruff format .` |
| **Frontend** (`apps/frontend/**/*.ts`, `*.tsx`) | `biome format` | `cd apps/frontend && npx biome format --write .` |

Never leave backend Python files un-ruff-formatted or frontend TypeScript files un-biome-formatted. A `PostToolUse` hook in `.claude/settings.json` runs both formatters automatically after every Edit/Write, but always verify with `ruff check .` (backend) and `npx biome check .` (frontend) before finishing a task.

---

## What this project is

A full-stack DevOps UI for managing a Zabbix monitoring server with role-based access control, team management, and a PostgreSQL user database. The backend exposes a REST API that wraps the Zabbix JSON-RPC API and manages users/teams; the frontend is a Next.js app that calls it. Primary operations: login/auth, manage teams and users, list/create/delete hosts, add many monitoring item types and triggers, bulk-import hosts from CSV/XLSX, export inventory to Excel, view live metrics & problems, build dashboards, define custom alert rules, manage data collection (template/host groups, templates, maintenance windows, event correlation, discovery rules), business services + SLAs, trigger/service/discovery actions with media types and scripts, reports (top triggers, audit log, action log, availability, notifications), and Zabbix server administration (user groups, roles, API tokens, proxies, proxy groups, global macros, the item queue, and housekeeping/authentication settings).

The repo is set up for **air-gapped / private-registry** deployment on **OpenShift** (or vanilla Kubernetes), with Helm charts deployed directly via GitLab CI (`helm upgrade --install`) across staging / production / DR. ArgoCD manifests exist in `argocd/` as a planned future GitOps path but are **not yet wired into the pipeline**.

---

## Monorepo layout

```
apps/
  backend/          Python 3.12 / FastAPI — Zabbix wrapper + PostgreSQL user/team DB
  frontend/         React 18 / Next.js 15 App Router / TypeScript / MUI
helm/
  charts/
    backend/        standalone Helm chart
    frontend/       standalone Helm chart
    zabbix-portal/  umbrella chart depending on backend + frontend
argocd/             AppProject, ApplicationSet, per-env values (planned — not yet active)
.gitlab/ci/         modular GitLab CI pipeline
docker-compose.yml  local orchestration (backend + frontend)
```

PostgreSQL is a **shared/external** database — it is not in `apps/` and not deployed by Helm. The backend connects to it via `DATABASE_URL`.

---

## Development commands

### Backend (from `apps/backend/`)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Dev server (port 6769)
uvicorn Zabbix_Main:app --host 0.0.0.0 --port 6769 --reload

# Lint / format
ruff check . && ruff format --check .

# Type-check
mypy . --ignore-missing-imports
```

### Frontend (from `apps/frontend/`)

```bash
npm install

# Dev server (Next.js on :42069, proxies /api → :6769 via route handler)
npm run dev

# Build / lint / typecheck
npm run build       # next build
npm run lint        # Biome
npm run typecheck   # tsc

# Format whole repo (from repo root)
npm run format
```

### Docker (each app built independently)

```bash
# Backend — build context is apps/backend/
docker build -t zabbix-portal-backend apps/backend/

# Frontend — build context is apps/frontend/ (Dockerfile lives there)
docker build -t zabbix-portal-frontend apps/frontend/
```

The easiest way to run both app services together is docker compose from the repo root:

```bash
# Build and start backend + frontend (PostgreSQL is external — set DATABASE_URL)
docker compose up -d --build

# Tear down
docker compose down
```

The two services share the default compose network and reach each other by container name. PostgreSQL is not part of compose — point `DATABASE_URL` at the shared database.

To run containers individually without docker compose:

```bash
docker network create zabbix-net

docker run -d --name backend --network zabbix-net \
  --env-file apps/backend/.env \
  -p 6769:6769 \
  zabbix-portal-backend

docker run -d --name frontend --network zabbix-net \
  -p 42069:42069 \
  zabbix-portal-frontend
```

Set `BACKEND_URL=http://backend:6769` in `apps/frontend/.env` when both containers are on the same network, and point `DATABASE_URL` in `apps/backend/.env` at your shared PostgreSQL (use its reachable host/IP, not `localhost`).

---

## Backend architecture

```mermaid
flowchart LR
    ZabbixBase --> Host_Manager
    ZabbixBase --> Item_Manager
    ZabbixBase --> Metrics_Manager
    ZabbixBase --> Dashboard_Manager
    ZabbixBase --> Alert_Manager
    ZabbixBase --> ZabbixSync
    ZabbixBase --> DataCollection_Manager
    ZabbixBase --> Report_Manager
    ZabbixBase --> Actions_Manager
    ZabbixBase --> ZabbixAdmin_Manager
    ZabbixBase --> Services_Manager
    Database.py --> main["Zabbix_Main.py"]
    Auth.py --> main
    User_Management.py --> main
    Host_Manager --> main
    Item_Manager --> main
    Metrics_Manager --> main
    Dashboard_Manager --> main
    Alert_Manager --> main
    ZabbixSync --> main
    DataCollection_Manager --> main
    Report_Manager --> main
    Actions_Manager --> main
    ZabbixAdmin_Manager --> main
    Services_Manager --> main
```

- **`ZabbixBase`** (in `Zabbix_Base.py`) loads `apps/backend/.env` and creates a `zabbix_utils.ZabbixAPI` session. All Zabbix managers inherit from it. `self.zapi` is `None` when Zabbix is unreachable — callers must guard against this. Exposes `close()`; honours `ZABBIX_SSL_VERIFY`. **Not every manager's `close()` is called on shutdown** — see "Things to know before editing".
- **`Host_Manager`** wraps host CRUD and Excel export (`openpyxl` / `pandas`).
- **`Item_Manager`** wraps item and trigger creation across ~20 item types (agent, HTTP, SNMP, SNMP trap, internal, trapper, external, IPMI, SSH, telnet, JMX, calculated, dependent, Zabbix script, browser, ODBC/Agent2 DB monitors, file watch, service check). Trigger expressions follow Zabbix 5.x classic format: `{hostname:item_key.last()} operator threshold`.
- **`Metrics_Manager`** reads active problems (with acknowledgement audit), item history time-series, and historical problem windows from Zabbix.
- **`Dashboard_Manager`** lists native Zabbix graphs, proxies graph images, returns Chart.js series, and aggregates per-host last-value metrics.
- **`Alert_Manager`** owns user-defined alert rules and events. Its `run_checks()` runs on a background thread on an interval controlled by `ALERT_CHECK_INTERVAL` (default 15s, minimum 5s), evaluating thresholds and recording ok→firing transitions.
- **`ZabbixSync`** performs bidirectional user/group/host-group sync between the portal DB and Zabbix, including real-time sync via a PostgreSQL `LISTEN/NOTIFY` channel and a periodic background sync.
- **`DataCollection_Manager`** wraps template groups, host groups, templates, maintenance windows, event correlation rules, and discovery rules (list/create/update/delete).
- **`Report_Manager`** is read-only: top-100 triggers by problem count, the Zabbix audit log, the action log, notification history, and per-host-group availability.
- **`Actions_Manager`** wraps trigger/service/discovery/autoregistration/internal actions, media types, and scripts (list/create/delete/toggle).
- **`ZabbixAdmin_Manager`** wraps Zabbix server administration: user groups, a read-only Zabbix user list, user roles, API tokens, proxies, proxy groups (Zabbix 7.x), global macros, authentication settings, the item processing queue, and housekeeping settings.
- **`Services_Manager`** wraps business services, SLAs (with SLA reports), and "health monitor" items (simple URL/host checks surfaced as services).
- **`Database.py`** owns a `psycopg2.pool.ThreadedConnectionPool`, creates the schema on `init_db()`, and runs idempotent migrations. `get_conn()` returns a pooled connection whose `close()` returns it to the pool. Tables: `teams`, `team_users` (with `roles TEXT[]`), `host_assignments`, `dashboard_layouts`, `alert_rules`, `alert_events`, `problem_acknowledgements`.
- **`Auth.py`** handles password hashing (`bcrypt`), JWT creation/validation (`python-jose`), and FastAPI dependency functions: `get_current_user`, `require_root`, `require_admin`, `require_operator`. Also exports `can_grant_roles()` — the guard that prevents users from granting roles higher than their own.
- **`User_Management.py`** contains all SQL queries for users, teams, host assignments, dashboard layouts, and the overview aggregation. `seed_root()` seeds a root user on first startup from `ADMIN_USERNAME` / `ADMIN_PASSWORD` (default `Admin` / `admin`, with a logged warning if no password is set).
- **`Zabbix_Main.py`** instantiates all 11 managers at module load (`host_bot`, `item_bot`, `metrics_bot`, `dashboard_bot`, `alert_bot`, `sync_bot`, `dc_bot`, `report_bot`, `actions_bot`, `zadmin_bot`, `services_bot`) and runs startup work (`init_db()`, `install_notify_triggers()`, `seed_root()`, sync bootstrap, alert-checker thread) inside a FastAPI **`lifespan`** context manager. All ~150 route handlers live here. There is no dependency injection.
- FastAPI runs on **port 6769** locally and in Docker/Kubernetes (`--workers 4` in the container image). Background threads (alert checker, realtime/periodic sync) acquire a cross-worker lock so they run in exactly one worker even with multiple uvicorn workers. A Server-Sent Events stream at `/events` pushes sync notifications to connected clients.

Required environment variables (in `apps/backend/.env`):

```
ZABBIX_URL=http://your-zabbix-server
ZABBIX_USER=Admin
ZABBIX_PASS=zabbix
ZABBIX_SSL_VERIFY=true        # set false only on a trusted net with a self-signed cert

DATABASE_URL=postgresql://postgres:postgres@<db-host>:5432/zabbix_portal

# Long random string — generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=change-me-in-production

ADMIN_USERNAME=Admin          # seed root username (first boot only)
ADMIN_PASSWORD=change-me      # seed root password; defaults to 'admin' with a warning if unset

BACKEND_URL=http://localhost:6769

# Comma-separated list of origins allowed to call the API (CORS). "*" (default) allows any.
ALLOWED_ORIGINS=http://localhost:42069

# Alert-rule evaluation interval in seconds. Default 15, minimum enforced 5.
ALERT_CHECK_INTERVAL=15
```

- `DATABASE_URL` — PostgreSQL connection string for the shared/external database. The backend creates the schema and runs migrations on every startup (idempotent).
- `ZABBIX_SSL_VERIFY` — TLS verification for the Zabbix API connection probe; `true` by default.
- `SECRET_KEY` — signs JWT tokens. **Must be changed before any real deployment.** If rotated, all existing tokens are immediately invalidated.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — seed the root account on first boot only.
- `BACKEND_URL` — consumed by the frontend, not the backend itself — it lives here so there is one `.env` file to maintain.
- `ALLOWED_ORIGINS` — CORS allow-list, read once at import time. Local Docker needs the port (`http://localhost:42069`); in OpenShift use the Route hostname with no port (Routes serve on 443).
- `ALERT_CHECK_INTERVAL` — how often `Alert_Manager.run_checks()` evaluates rules on its background thread. Not currently exposed as a Helm value — set it via `config:`/`env:` in the umbrella chart if you need it in-cluster.

These can be supplied in two ways:
- **Local development** — place them in `apps/backend/.env` (loaded by `python-dotenv`).
- **Kubernetes / OpenShift** — inject them via a ConfigMap (non-sensitive values) or Secret (`ZABBIX_PASS`, `SECRET_KEY`, DB password). Mount via `envFrom`. Do not bake `.env` files into container images.

The Zabbix URL is normalised — either `http://host` or `http://host/api_jsonrpc.php` works.

---

## Frontend architecture

- All API calls go through the thin client in `src/app/api.ts`. Every call is prefixed with `/api` — all environments route through the same Next.js route handler. The client holds the JWT in `localStorage` and attaches it as a `Bearer` token on every request. On a 401 it clears the token and redirects to `/login` (except during the login call itself, which passes `{ skipRedirect: true }`).
- **API proxying** — `src/app/api/[...path]/route.ts` is a catch-all route handler that proxies every `/api/*` request to `BACKEND_URL` at request time. `BACKEND_URL` defaults to `http://localhost:6769` if not set.
- **`BACKEND_URL` loading** — `src/instrumentation.ts` runs `dotenv.config()` once at server startup, loading `apps/frontend/.env` (baked into the image at build time). In dev, Next.js loads `.env` automatically.
- **Auth context** — `src/app/context/AuthContext.tsx` holds the decoded JWT payload (`AuthUser`: `id`, `username`, `roles: string[]`, `team_id`). Consumed throughout the app via `useAuth()`.
- Routing: Next.js App Router (`src/app/`). Routes: `page.tsx` (/ → Overview), `dashboard/`, `hosts/`, `items/`, `triggers/`, `teams/`, `metrics/`, `users/`, `users-management/`, `data-collection/`, `services/`, `reports/`, `alerts-management/`, `administration/`, `login/`. Each thin page file re-exports the real view component from `src/views/` (`Overview`, `Dashboard`, `Hosts`, `Items`, `Triggers`, `Teams`, `Metrics`, `Users`, `UsersManagement`, `DataCollection`, `Services`, `Reports`, `AlertsManagement`, `Administration`, `Login`). Several routes are tab-driven via a `?tab=` query param read with `useSearchParams` (e.g. `/administration?tab=proxies`, `/data-collection?tab=templates`, `/metrics?tab=problems`) rather than separate pages per tab. There is also `src/middleware.ts` and `src/lib/auth.ts` for edge auth handling, and `SyncContext` (SSE) / `ThemeContext` providers.
- Root layout: `src/app/layout.tsx` (server component — html/body/AppRouterCacheProvider). Providers: `src/app/providers.tsx` (client boundary — ThemeProvider + AppShell). The login page bypasses AppShell.
- Theme: `src/app/theme.ts` (MUI v5, dark/light toggle persisted in `localStorage`).
- Shell: `src/app/layout/AppShell.tsx` — polls `/api/health` every **15 s** and shows live status dots (green/red) for Backend API and Zabbix in the sidebar. The nav is grouped (Overview, Hosts, Dashboard, Monitoring, Services, Reports, Data collection, Alerts, Users, Administration); the **Administration** group is hidden in the sidebar for roles other than `root` / `team_lead` (the corresponding API endpoints are still independently gated server-side via `require_admin` / `require_root`, regardless of nav visibility).
- No global state manager — components call `api.*` directly.
- All page components are client components (`'use client'`) because they use React hooks and browser APIs.

### Frontend code style

- **Always use arrow-function syntax** for all functions — components, hooks, helpers, callbacks. Never use the `function` keyword.

```tsx
// correct
const MyComponent = () => { ... };
const useMyHook = () => { ... };
const handleClick = () => { ... };

// wrong — never do this
function MyComponent() { ... }
function useMyHook() { ... }
function handleClick() { ... }
```

---

## Private network / OpenShift conventions

- **Every `FROM` line** in Dockerfiles has a `# PRIVATE NETWORK:` comment with the exact image and the format for an Artifactory replacement. Do not change images without preserving these comments.
- **npm packages are pinned to exact versions** (no `^` or `~`) in `package.json` files. `.npmrc` enforces `frozen-lockfile=true` and disables peer auto-install. The commented-out `registry=` line is where to point at a private npm proxy.
- **pip packages** must be fetched from an internal PyPI proxy. The `pip install` line in `apps/backend/Dockerfile` has a commented `--index-url` variant ready to uncomment. The backend image is a **single-stage** build (installs deps, copies the app, `chown` for GID 0, `USER 1001`) — there is no separate `builder` stage to keep in sync.
- The frontend runs on **port 42069** as a Next.js standalone server (`node server.js`). This is required for OpenShift's `restricted` SCC: non-root, unprivileged port, random UID with GID 0. Files are `chown 1001:0` so any UID in group 0 can read them.
- Don't add an nginx config in the frontend container — the standalone nginx image runs as root and binds port 80, both of which fail under the `restricted` SCC.

---

## Helm

- Sub-charts (`backend/`, `frontend/`) are deployable independently.
- The umbrella chart (`zabbix-portal/`) depends on both via `file://` references. Always run `helm dependency build helm/charts/zabbix-portal/` before templating or installing it.
- The frontend chart exposes the app via an OpenShift `Route` (`route.yaml`). In-cluster the Route/Ingress handles `/api/*` routing to the backend service, so the Next.js route handler's `BACKEND_URL` is not used there. The backend service name is derived from the release name.
- Sensitive Zabbix credentials are expected in an existing Secret (set via `existingSecret`). The chart only renders its own `secret.yaml` when `existingSecret` is empty — same pattern for `existingConfigMap` / `configmap.yaml` (non-sensitive values: `ALLOWED_ORIGINS`, `BACKEND_URL`). **The umbrella chart's default values pre-set both** (`existingSecret: "backend-secret"`, `existingConfigMap: "overwatch-config-map"`), so by default Helm will *not* create either resource — you must create them yourself before deploying (see the `kubectl create secret/configmap` examples in `.cienv-example`), or blank out the value in your env's values file to let Helm render its own.
- Probes target port `42069` on the frontend and `/health` on port `6769` on the backend.
- PostgreSQL is **not** deployed by this chart — it is shared/external and reached via `DATABASE_URL` from the backend's ConfigMap/Secret.

---

## GitLab CI pipeline

`.gitlab-ci.yml` declares stages `[.pre, lint, build, staging, production, dr]`, defines every non-sensitive CI variable as an editable placeholder in its own top-level `variables:` block (`RUNNER_TAG`, `KANIKO_IMAGE`, `PYTHON_IMAGE`, `NODE_IMAGE`, `HELM_IMAGE`, `GIT_IMAGE`, `ARTIFACTORY_REGISTRY`, `FORCE_BUILD`, `PROJECT_NAME`, `K8S_NAMESPACE`, `STAGING_SERVER`, `PROD_SERVER`, `DR_SERVER`), and includes five files from `.gitlab/ci/`:

- **`common.yml`** — two reusable job templates: `.base` (sets `tags: [$RUNNER_TAG]`) and `.docker_base` (extends `.base`, sets `image.name: $KANIKO_IMAGE`).
- **`detect.yml`** — `detect` diffs current tag vs. previous tag and emits `BACKEND_CHANGED` / `FRONTEND_CHANGED` / `HELM_CHANGED` dotenv vars (downstream jobs skip when their app is untouched). `validate:variables` hard-fails if any required CI variable is missing — including all three cluster tokens.
- **`python.yml`** — ruff lint, mypy, Kaniko build + push of the backend image to `$ARTIFACTORY_REGISTRY/backend:<tag>`.
- **`node.yml`** — Biome lint, tsc typecheck, Kaniko build + push of the frontend image to `$ARTIFACTORY_REGISTRY/frontend:<tag>`.
- **`gitops.yml`** — `helm lint` + `helm template`, then a **`plan:<env>` / `deploy:<env>` pair per environment** (staging, production, dr). `plan:<env>` resolves image tags (reading `helm history`, falling back to the previous environment's resolved tag on a first deploy) and previews the values that will be applied; `deploy:<env>` runs the actual `helm upgrade --install`. Staging's pair is fully automatic; production's and dr's `deploy:` jobs are manual gates (`when: manual`). **DR has its own cluster** — `DR_SERVER` / `DR_TOKEN`, not a fallback to production's.

The pipeline fires **only on tag pushes** (or `FORCE_BUILD=1` from a branch — but note `FORCE_BUILD` only reaches `detect`, the lint jobs, the build jobs, and staging's plan/deploy; production and dr only run on a real tag). Branch pushes and MR merges do nothing. Required CI variables (all hard-checked by `validate:variables`): `RUNNER_TAG`, `KANIKO_IMAGE`, `PYTHON_IMAGE`, `NODE_IMAGE`, `HELM_IMAGE`, `ARTIFACTORY_REGISTRY`, `PROJECT_NAME`, `K8S_NAMESPACE`, `STAGING_SERVER`/`STAGING_TOKEN`, `PROD_SERVER`/`PROD_TOKEN`, `DR_SERVER`/`DR_TOKEN`. The first 9 are pre-filled placeholders in `.gitlab-ci.yml` itself; the three `*_TOKEN`s must be real masked/protected GitLab CI/CD Variables.

---

## Image strategy

- **`:vX.Y.Z`** — the only tag pushed, for apps that changed since the previous tag (short SHA on a `FORCE_BUILD`). There is no `:latest` tag.
- Production and DR are pinned to a specific tag via `helm --set image.tag=` and never auto-update.

---

## Things to know before editing

- The frontend Docker build context is `apps/frontend/` — the Dockerfile lives there and uses plain `npm ci`.
- `apps/frontend/.env` is baked into the frontend image at build time (not excluded by `.dockerignore`). Update it before building the image when the backend address changes.
- `SECRET_KEY` in `apps/backend/.env` must be a long random string in any real deployment. Rotating it invalidates all existing JWT sessions immediately.
- The database schema is created and migrated automatically on every backend startup (`init_db()` in `Database.py`). Migrations are idempotent — safe to run against existing data. No manual migration step is needed.
- On first startup the backend seeds a root user from `ADMIN_USERNAME` / `ADMIN_PASSWORD` (default `Admin` / `admin`, with a logged warning if no password is set). This account must have its password changed before the system is used in any real environment.
- Roles are stored as a PostgreSQL `TEXT[]` array in `team_users.roles`. A user can hold multiple roles simultaneously. The JWT `roles` claim is a JSON array.
- `can_grant_roles()` in `Auth.py` is enforced on both `POST /users` and `PUT /users/{id}`. It prevents any user from granting a role higher than their own. Only `root` can grant `auditor`.
- When you change Helm values that drive in-cluster behaviour, also bump the chart's `version:` in `Chart.yaml` (a new chart revision; also keeps the future ArgoCD migration clean).
- Don't reintroduce nginx in the frontend container without thinking through OpenShift compatibility — the standard nginx image runs as root and binds port 80, both of which fail under the `restricted` SCC.
- Don't change `package.json` versions to `^x.y.z` ranges — exact pinning matters in this air-gapped environment.
- **The shutdown handler in `Zabbix_Main.py`'s `lifespan` only closes 6 of the 11 manager instances** (`host_bot`, `item_bot`, `metrics_bot`, `dashboard_bot`, `alert_bot`, `sync_bot`) — `dc_bot`, `report_bot`, `actions_bot`, `zadmin_bot`, and `services_bot` are not in that loop. Keep this in mind if you add cleanup logic to a manager's `close()` — it currently won't run for the five managers added after the original five.
- CORS is controlled by `ALLOWED_ORIGINS` (comma-separated, read once at import time in `Zabbix_Main.py`). Defaults to `*` if unset. The umbrella Helm chart does not set a default — it must come from the existing ConfigMap (see Helm section above) or `--set config.ALLOWED_ORIGINS=...`.
- When adding a new app to the pipeline: (1) add its build job CI file; (2) add its `_CHANGED` detection line to `detect.yml`; (3) add it to the umbrella chart dependencies; (4) add its tag-resolution logic to `.plan_script` and its `--set image.*` lines to `.deploy_apply_script` in `gitops.yml` (both shared YAML anchors, reused by every `plan:<env>` / `deploy:<env>` job pair).
- The deploy logic resolves each app's tag independently — changed apps get the new tag, unchanged apps keep the tag read back from `helm history`. Don't assume both apps move together on a release.

---

## Related docs

- [`README.md`](./README.md) — project overview and quick start
- [`WORKFLOW.md`](./WORKFLOW.md) — end-to-end development and CI/CD pipeline
- [`RELEASING.md`](./RELEASING.md) — release / rollback runbook
- [`PRIVATE_NETWORK.md`](./PRIVATE_NETWORK.md) — air-gapped configuration checklist
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — running the stack with Docker
