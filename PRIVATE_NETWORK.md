# Private Network Configuration Checklist

Every line in the codebase that must be changed before this project
runs in a private / air-gapped environment.
Grouped by concern — replace each placeholder with your real value.

---

## 1. Docker base images

Replace public Docker Hub images with your internal mirror in these FROM lines.

| File | Line | Current value | Replace with |
|------|------|---------------|---------------|
| `apps/backend/Dockerfile` | 15 | `FROM python:3.12-slim` | `FROM <your-registry>/docker-virtual/python:3.12-slim` |
| `apps/frontend/Dockerfile` | 17 | `FROM node:22.2-alpine AS builder` | `FROM <your-registry>/docker-virtual/node:22.2-alpine AS builder` |
| `apps/frontend/Dockerfile` | 39 | `FROM node:22.2-alpine AS runner` | `FROM <your-registry>/docker-virtual/node:22.2-alpine AS runner` |

> The backend image is a **single-stage** build (no separate `builder` stage). The frontend image is multi-stage (`builder` → `runner`), so it has two `FROM` lines to replace.

---

## 2. Package registries

### pip (Python)
`apps/backend/Dockerfile` — lines 24–25 are commented out. Uncomment and set your PyPI proxy:
```dockerfile
# lines 24-25 — change to:
RUN pip install --no-cache-dir -r requirements.txt \
      --index-url https://<your-registry>/api/pypi/pypi/simple
```

### npm (Node)
`apps/frontend/Dockerfile` — lines 22–23 are commented out. Uncomment and set your npm proxy:
```dockerfile
# lines 22-23 — change to:
RUN npm config set registry https://<your-registry>/api/npm/npm/ \
    && npm config set strict-ssl false
```

`.npmrc` (root) — line 3 is commented out. Uncomment and set:
```
# line 3 — change to:
registry=https://<your-registry>/api/npm/npm/
```

---

## 3. CI/CD pipeline configuration

Every CI image, runner tag, and registry path is a **GitLab CI/CD variable** declared in one place — the top-level `variables:` block in `.gitlab-ci.yml` (root of the repo). There is nothing to edit inside `.gitlab/ci/*.yml` — those files only ever reference `$VARIABLE_NAME`.

| File | Line | Variable | Current value | Replace with |
|------|------|----------|----------------|---------------|
| `.gitlab-ci.yml` | 17 | `RUNNER_TAG` | `<your-runner-tag>` | The tag of your registered GitLab runner, e.g. `docker`, `staging-runner` |
| `.gitlab-ci.yml` | 20 | `KANIKO_IMAGE` | `<your-kaniko-image>` | Internal Kaniko image, e.g. `<your-registry>/kaniko:latest` |
| `.gitlab-ci.yml` | 21 | `PYTHON_IMAGE` | `<your-python-image>` | Internal Python image, e.g. `<your-registry>/python:3.12-slim` |
| `.gitlab-ci.yml` | 22 | `NODE_IMAGE` | `<your-node-image>` | Internal Node image, e.g. `<your-registry>/node:22-alpine` |
| `.gitlab-ci.yml` | 23 | `HELM_IMAGE` | `<your-helm-image>` | Internal Helm image, e.g. `<your-registry>/helm:latest` |
| `.gitlab-ci.yml` | 24 | `GIT_IMAGE` | `<your-git-image>` | Internal Alpine/git image used by `detect` + `validate:variables`, e.g. `<your-registry>/alpine:3.20` |

You can either edit these values directly in `.gitlab-ci.yml` (they're committed, non-sensitive defaults), or override them per-environment as GitLab CI/CD Variables (Settings → CI/CD → Variables) — a project-level variable of the same name takes precedence over the file default.

---

## 4. Image push destination (Kaniko)

Where built images are pushed after a successful build, and where the Helm deploy jobs pull them back from.

| File | Line | Variable | Current value |
|------|------|----------|----------------|
| `.gitlab-ci.yml` | 27 | `ARTIFACTORY_REGISTRY` | `<your-artifactory-registry>` |

Replace with your actual registry path (e.g. `artifactory.company.com/docker-local`). `python.yml`, `node.yml`, and `gitops.yml` all consume this single variable as `$ARTIFACTORY_REGISTRY/backend:<tag>` / `$ARTIFACTORY_REGISTRY/frontend:<tag>` — there is no other place to change it.

---

## 5. Helm image repositories (GitOps repo)

Helm charts now live in the **`zabbix-portal-gitops`** repo under `helm-charts/`. Replace `your-registry` in the values files there.

> PostgreSQL is NOT deployed by Helm — it is a shared/external database reached via `DATABASE_URL`. There is no postgres image to mirror.

### `helm-charts/zabbix-portal/values.yaml` (in the GitOps repo)
| Key | Current value | Replace with |
|-----|---------------|--------------|
| `backend.image.repository` | `your-registry/backend` | `<your-artifactory-registry>/backend` |
| `frontend.image.repository` | `your-registry/frontend` | `<your-artifactory-registry>/frontend` |
| `frontend.backendUrl` | `http://<your-backend-service-name>:6769` | The backend Service name in-cluster, e.g. `http://<release-name>-backend:6769` |

Per-environment overrides (image tags, replica counts, resource limits) are in `environments/{staging,production,dr}/values.yaml` in the GitOps repo. Image tags in those files are updated automatically by the CI pipeline — do not edit them manually.

---

## 6. GitLab CI/CD variables & secrets

Everything in section 3 and 4 above lives in `.gitlab-ci.yml` and can be edited in-repo. The variable below is a **secret** and must be set as a real GitLab CI/CD Variable (Settings → CI/CD → Variables) — never commit it to the repo.

| Variable | Description | Sensitive |
|----------|-------------|-----------|
| `GITOPS_DEPLOY_KEY` | Private SSH key matching a Deploy Key with **write** access on the `zabbix-portal-gitops` repo. Used by `push-image-tags` to clone and push back. | **Yes — mask + protect** |

`GITOPS_REPO_URL` (the SSH URL of the GitOps repo) is non-sensitive and is declared as an editable placeholder in `.gitlab-ci.yml`'s top-level `variables:` block — change it there.

`validate:variables` (in `.gitlab/ci/detect.yml`) hard-fails the pipeline at the very first stage if any of `RUNNER_TAG`, `KANIKO_IMAGE`, `PYTHON_IMAGE`, `NODE_IMAGE`, `GIT_IMAGE`, `ARTIFACTORY_REGISTRY`, `PROJECT_NAME`, `GITOPS_REPO_URL`, or `GITOPS_DEPLOY_KEY` is unset — so a misconfiguration is caught before any build runs.

---

## 7. Quick find command

To verify nothing was missed after you make your changes:
```bash
grep -rn "your-registry\|your-kaniko\|your-python\|your-node\|your-helm\|your-artifactory\|<your-" \
  --include="*.yml" --include="*.yaml" --include="Dockerfile" --include=".npmrc" .
```
Should return zero results when everything is filled in. (This also catches `.gitlab-ci.yml`, since it ends in `.yml`.)
