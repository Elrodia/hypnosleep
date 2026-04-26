#!/usr/bin/env bash
#
# Generate the two background loops we DON'T source manually:
#
#   white_noise.mp3 — pink noise (warmer than pure white)
#   silence.mp3     — pure digital silence
#
# Both are produced from FFmpeg's `lavfi` synthetic sources, so the
# output is deterministic and reproducible — anyone can re-run this
# script and verify the file's origin against the source command.
#
# The remaining 4 loops (rain, ocean, forest, wind) are sourced
# manually from CC0 / royalty-free libraries and tracked in
# apps/api/assets/backgrounds/LICENSES.md. This script does NOT
# attempt to fetch them.
#
# Output spec (matches assets/backgrounds/README.md):
#   - exactly 300 s
#   - MP3 128 kbps CBR, 44.1 kHz stereo
#   - normalised to -20 LUFS via two-pass loudnorm
#
# Re-run any time the spec changes. Existing files are overwritten.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HERE}/../assets/backgrounds"
mkdir -p "${DEST}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "error: ffmpeg not found on PATH" >&2
  exit 1
fi

DURATION=300
SR=44100
BR=128k

# Renders a `lavfi` source filter to MP3 at the loop spec, then
# loudness-normalises in place to -20 LUFS / -1 dBTP / 11 LU range.
render_loop() {
  local name="$1"
  local lavfi_input="$2"
  local raw="${DEST}/${name}.raw.mp3"
  local out="${DEST}/${name}.mp3"

  echo "==> rendering ${name}.mp3 from lavfi: ${lavfi_input}"
  ffmpeg -y -hide_banner -loglevel warning \
    -f lavfi -i "${lavfi_input}" \
    -t "${DURATION}" \
    -ac 2 -ar "${SR}" \
    -c:a libmp3lame -b:a "${BR}" \
    "${raw}"

  echo "==> loudnorm ${name}.mp3 to -20 LUFS"
  ffmpeg -y -hide_banner -loglevel warning \
    -i "${raw}" \
    -af "loudnorm=I=-20:TP=-1:LRA=11" \
    -ac 2 -ar "${SR}" \
    -c:a libmp3lame -b:a "${BR}" \
    "${out}"

  rm -f "${raw}"
  echo "    -> ${out}"
}

# Pink noise — warmer than white, easier on the ears for sleep.
render_loop "white_noise" \
  "anoisesrc=color=pink:sample_rate=${SR}:duration=${DURATION}"

# True digital silence at the same channel layout / sample rate as
# the other loops so the mixer's filter graph treats it uniformly.
render_loop "silence" \
  "anullsrc=channel_layout=stereo:sample_rate=${SR}"

echo
echo "done — generated:"
ls -la "${DEST}/white_noise.mp3" "${DEST}/silence.mp3"
echo
echo "Note: rain/ocean/forest/wind must be sourced manually (CC0)."
echo "      See apps/api/assets/backgrounds/LICENSES.md."
