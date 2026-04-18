# syntax=docker/dockerfile:1.6
#
# Unified Railway image: builds the Vite SPA and the Express API, then
# serves both from a single Node process behind one domain
# (e.g. https://app.hypnosleep.app).
#
# Layout inside the runtime image:
#   /app/apps/api/dist              -> compiled API (entrypoint: server.js)
#   /app/apps/api/node_modules      -> production deps for the API
#   /app/public                     -> built Vite SPA (index.html + assets)
#
# The API reads STATIC_DIR and serves everything under it, with an
# SPA fallback for non-/api routes.

# ---------------------------------------------------------------------------
# Stage 1: build the Vite frontend
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app

# Install all frontend deps (includes Vite, Tailwind, TS, etc.).
# A BuildKit cache mount on npm's cache dir keeps re-installs fast
# across Railway rebuilds when `package-lock.json` hasn't changed
# layer-by-layer.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,id=npm-frontend,target=/root/.npm npm ci

# Copy just what Vite needs to build.
COPY index.html ./
COPY vite.config.ts tsconfig.json tailwind.config.js components.json theme.json ./
COPY public ./public
COPY src ./src

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: build the Express API (TypeScript -> dist)
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS api-builder

WORKDIR /app/apps/api

COPY apps/api/package.json apps/api/package-lock.json* ./
RUN --mount=type=cache,id=npm-api,target=/root/.npm npm ci

COPY apps/api/tsconfig.json ./
COPY apps/api/drizzle.config.mysql.ts apps/api/drizzle.config.postgres.ts ./
COPY apps/api/src ./src
COPY apps/api/scripts ./scripts

RUN npm run build

# Drop dev dependencies so we can copy node_modules straight into the
# runtime image.
RUN --mount=type=cache,id=npm-api-prune,target=/root/.npm npm prune --omit=dev

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

# Python + FFmpeg + edge-tts for the TTS pipeline (kept consistent with
# apps/api/Dockerfile). BuildKit cache mounts on apt's list + archives
# dirs avoid re-downloading packages on every Railway rebuild.
RUN --mount=type=cache,id=apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=apt-lib,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        ffmpeg \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Install edge-tts in an isolated venv so it's on PATH for the runtime
# user without needing --break-system-packages.
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir edge-tts==6.1.10

WORKDIR /app

# API runtime artefacts.
COPY --from=api-builder /app/apps/api/package.json /app/apps/api/package-lock.json* ./apps/api/
COPY --from=api-builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=api-builder /app/apps/api/scripts ./apps/api/scripts

# Built SPA — served by Express via STATIC_DIR.
COPY --from=frontend-builder /app/dist ./public

# Writable asset dir used by the TTS pipeline.
RUN mkdir -p apps/api/assets/backgrounds

ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public

# Run as a non-root user to limit blast radius of any runtime
# compromise. Chown after all COPYs so the app user owns the full tree.
RUN groupadd -r app && useradd -r -g app app && chown -R app:app /app
USER app

EXPOSE 3000

WORKDIR /app/apps/api

# Container-level liveness probe. Railway additionally polls
# `/api/health` over HTTP (see `railway.toml`).
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
