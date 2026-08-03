# =============================================================================
# PRIVATE NETWORK — IMAGE CHANGES REQUIRED
# =============================================================================
# Replace the public image with your internal mirror before building.
#
#  Stage    | Public image      | Replace with
#  -------- | ----------------- | ---------------------------------------
#  builder  | node:24-alpine    | <registry>/docker-virtual/node:24-alpine
#  runner   | node:24-alpine    | <registry>/docker-virtual/node:24-alpine
#
# Build context: apps/frontend/
#   docker build -t zabbix-portal-frontend apps/frontend/
# =============================================================================

# ── Build ─────────────────────────────────────────────────────────────────────
# PRIVATE NETWORK: change to <your-registry>/docker-virtual/node:24-alpine
FROM node:24-alpine AS builder

WORKDIR /app

# PRIVATE NETWORK: uncomment to point at your internal npm registry:
# RUN npm config set registry https://<your-registry>/api/npm/npm/ \
#     && npm config set strict-ssl false

# .npmrc must be copied in explicitly — it is not picked up automatically, and
# without it `save-exact`/`update-notifier=false` never apply inside the image,
# even though they're set for local installs.
COPY package.json package-lock.json .npmrc ./
# npm ci installs exactly what package-lock.json specifies — reproducible and
# faster than npm install, and fails if the lock file is out of sync.
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
# PRIVATE NETWORK: change to <your-registry>/docker-virtual/node:24-alpine
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=42069
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=1001:0 /app/public ./public
COPY --from=builder --chown=1001:0 /app/.next/standalone ./
COPY --from=builder --chown=1001:0 /app/.next/static ./.next/static

USER 1001

EXPOSE 42069

CMD ["node", "server.js"]
