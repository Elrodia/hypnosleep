FROM node:20-slim

# Install Python 3.11 and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install edge-tts Python package
RUN pip3 install --break-system-packages edge-tts

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Create directories for assets
RUN mkdir -p assets/backgrounds

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
