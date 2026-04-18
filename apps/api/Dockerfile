# --- Build stage ---------------------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install all dependencies (including devDependencies like TypeScript)
# needed to compile the TS source. We don't need Python / ffmpeg here.
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source and build.
COPY . .
RUN npm run build

# Prune dev dependencies so the pruned node_modules can be copied into
# the runtime image as-is.
RUN npm prune --omit=dev

# --- Runtime stage -------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

# Install Python 3.11 and FFmpeg for the TTS pipeline.
RUN apt-get update && apt-get install -y --no-install-recommends \
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

# Copy production artefacts from the build stage.
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Copy background ambient loops bundled with the repo so the FFmpeg
# mixer (apps/api/src/modules/audio/audio.mixer.ts) can find them at
# `${cwd}/assets/backgrounds/<name>.mp3`.
COPY --from=builder /app/assets ./assets

# Run as a non-root user to limit blast radius of any runtime
# compromise.
RUN groupadd -r app && useradd -r -g app app && chown -R app:app /app
USER app

EXPOSE 3000

ENV NODE_ENV=production

# Container-level health check. Railway's own healthcheck targets
# `/api/health` via HTTP; this is a belt-and-braces liveness probe
# that works in any Docker host.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
