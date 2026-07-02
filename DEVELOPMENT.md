# Running with Docker

This guide covers building and running the backend and frontend as Docker containers — either together with Docker Compose (easiest) or as standalone containers on a shared network.

---

## Prerequisites

- **Docker** 24+ with Docker Desktop (Mac / Windows) or Docker Engine (Linux)

---

## Stack overview

```
Browser
  └── frontend (Next.js :42069)
        └── /api/* → route handler → backend (FastAPI :6769)
                                          ├── Zabbix JSON-RPC
                                          └── PostgreSQL (shared/external)
```

The Next.js route handler at `src/app/api/[...path]/route.ts` proxies all `/api/*` requests to the backend. The backend address is controlled by `BACKEND_URL`, which defaults to whatever is baked into the frontend image at build time, but can be overridden at runtime via an environment variable (which is what `docker compose` does automatically).

PostgreSQL is **not** part of this stack — it is a shared/external database. The backend reaches it via `DATABASE_URL` in `apps/backend/.env`.

---

## One-time setup

### 1. Configure the backend environment file

Create `apps/backend/.env` (required — the backend will not start without it):

```env
ZABBIX_URL=http://your-zabbix-server
ZABBIX_USER=Admin
ZABBIX_PASS=zabbix

# Shared/external PostgreSQL — point this at your DB host
DATABASE_URL=postgresql://postgres:postgres@<db-host>:5432/zabbix_portal

# Long random string — signs JWT tokens
SECRET_KEY=change-me-in-production

# Default seed account (first boot only) — change after first login
ADMIN_USERNAME=Admin
ADMIN_PASSWORD=change-me
```

`DATABASE_URL` must reach your shared PostgreSQL from inside the container — use the DB's reachable host/IP, not `localhost` (which would resolve to the container itself).

### 2. Configure the frontend environment file

The file `apps/frontend/.env` holds the `BACKEND_URL` that the Next.js route handler uses to forward API calls. This value is **baked into the image at build time**, but when using `docker compose` it is overridden at runtime automatically — so you usually don't need to change it when using Compose.

```env
# Value baked into the image at build time.
# docker compose overrides this at runtime via the environment: block.
# On Mac / Windows Desktop (backend running natively, not in Docker):
BACKEND_URL=http://host.docker.internal:6769
```

| Scenario | Value |
|---|---|
| `docker compose` (both containers together) | `http://backend:6769` — set automatically by Compose |
| Both containers on the same Docker network (manual) | `http://backend:6769` |
| Mac / Windows Docker Desktop, backend running natively | `http://host.docker.internal:6769` |
| Linux server, backend on the same host | `http://<host-ip>:6769` |

If you need to change the baked-in default (e.g. for a custom network setup), edit `apps/frontend/.env` and rebuild the frontend image.

---

## Recommended: Docker Compose

`docker-compose.yml` at the repo root wires both services together. The backend health check is polled before the frontend starts — no startup race condition.

```bash
# Build and start both services
docker compose up -d --build

# Stream logs
docker compose logs -f

# Stop and remove
docker compose down
```

Open <http://localhost:42069>.

`docker compose` automatically sets `BACKEND_URL=http://backend:6769` at runtime (via the `environment:` block in `docker-compose.yml`), overriding the value baked into the image. You do not need to change `apps/frontend/.env` for this to work.

---

## Manual: shared Docker network

If you prefer to run containers individually without Compose:

### Build images

```bash
# Backend — build context is apps/backend/
docker build -t overwatch-backend apps/backend/

# Frontend — build context is apps/frontend/
docker build -t overwatch-frontend apps/frontend/
```

### Run the stack

```bash
# Create the network once (enables container DNS — containers reach each other by name)
docker network create overwatch-net

# Backend (DATABASE_URL in .env points at your shared PostgreSQL)
docker run -d \
  --name backend \
  --network overwatch-net \
  --env-file apps/backend/.env \
  -p 6769:6769 \
  overwatch-backend

# Frontend (BACKEND_URL overridden at runtime to reach the backend container)
docker run -d \
  --name frontend \
  --network overwatch-net \
  -e BACKEND_URL=http://backend:6769 \
  -p 42069:42069 \
  overwatch-frontend
```

Open <http://localhost:42069>.

### Stop and remove

```bash
docker stop frontend backend
docker rm frontend backend
```

---

## Common operations

### View logs

```bash
docker compose logs -f           # Compose
docker logs -f frontend          # standalone
docker logs -f backend
```

### Rebuild a single image after a code change

```bash
# With Compose
docker compose up -d --build frontend

# Without Compose
docker build -t overwatch-frontend apps/frontend/
docker stop frontend && docker rm frontend
docker run -d --name frontend --network overwatch-net \
  -e BACKEND_URL=http://backend:6769 \
  -p 42069:42069 overwatch-frontend
```

### Open a shell inside a running container

```bash
docker exec -it backend bash
docker exec -it frontend sh
```

---

## Health checks

The backend exposes a health endpoint that reports API + Zabbix connectivity:

```bash
curl http://localhost:6769/health
```

In the UI, the sidebar shows two live status dots — one for the Backend API and one for Zabbix (green = up, red = down) — updated every 15 seconds. On mobile, the top bar shows a single "Healthy" / "Degraded" chip.

---

## Private network

**Docker base images** — every `FROM` line in the Dockerfiles has a `# PRIVATE NETWORK:` comment with the exact image path. Replace the public image with your internal mirror.

**npm packages** — in `apps/frontend/Dockerfile`, uncomment the `npm config set registry` line and set it to your Artifactory / Nexus npm proxy URL.

**pip packages** — in `apps/backend/Dockerfile`, uncomment the `--index-url` flag on the `pip install` line and set it to your internal PyPI proxy.

See [`PRIVATE_NETWORK.md`](./PRIVATE_NETWORK.md) for the complete checklist.
