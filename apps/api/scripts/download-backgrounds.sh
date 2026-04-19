#!/usr/bin/env bash
#
# Fetch the royalty-free ambient loops used by the FFmpeg mixer.
# Invoked once at deploy time (before `docker build`) so the assets
# are present for the runtime stage — they are NOT committed to the
# repo to avoid bloating history with binary blobs.
#
# Override `BG_SOURCE_BASE` if you are mirroring the loops from your
# own CDN / bucket. Defaults assume each file is reachable at
# `${BG_SOURCE_BASE}/<name>.mp3`.
#
# Exits non-zero on the first failed download so CI fails loudly.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HERE}/../assets/backgrounds"
BG_SOURCE_BASE="${BG_SOURCE_BASE:-}"

mkdir -p "${DEST}"

FILES=(rain ocean forest wind white_noise)

if [[ -z "${BG_SOURCE_BASE}" ]]; then
  cat >&2 <<EOF
BG_SOURCE_BASE is not set. This script does not bundle any audio —
configure it to point at a location that serves:

$(for f in "${FILES[@]}"; do echo "  ${f}.mp3"; done)

Example:
  BG_SOURCE_BASE=https://cdn.example.com/hypnosleep/bg ./download-backgrounds.sh

Each file must be an MP3 at 128 kbps CBR, -20 LUFS, exactly 5 minutes.
See apps/api/assets/backgrounds/README.md for the full spec.
EOF
  exit 1
fi

for name in "${FILES[@]}"; do
  out="${DEST}/${name}.mp3"
  if [[ -s "${out}" ]]; then
    echo "skip ${name}.mp3 (already present)"
    continue
  fi
  url="${BG_SOURCE_BASE%/}/${name}.mp3"
  echo "fetch ${url}"
  curl --fail --location --silent --show-error --output "${out}" "${url}"
done

echo "done — assets at ${DEST}"
