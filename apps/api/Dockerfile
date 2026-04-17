# --- Build stage ---------------------------------------------------------
FROM node:20-slim AS builder

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
FROM node:20-slim AS runtime

# Install Python 3.11 and FFmpeg for the TTS pipeline.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install edge-tts Python package
RUN pip3 install --break-system-packages edge-tts

WORKDIR /app

# Copy production artefacts from the build stage.
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Create directories for assets
RUN mkdir -p assets/backgrounds

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
