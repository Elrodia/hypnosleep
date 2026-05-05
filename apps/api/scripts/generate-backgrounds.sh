#!/usr/bin/env bash
#
# Generate every background loop the FFmpeg mixer needs:
#
#   rain.mp3        — high-passed white noise (steady rainfall hiss)
#   ocean.mp3       — brown noise modulated by a slow LFO (wave swell)
#   forest.mp3      — low-passed pink noise with gentle tremolo (breeze)
#   wind.mp3        — low-passed brown noise with slower tremolo (gust)
#   white_noise.mp3 — pink noise (warmer than pure white)
#   silence.mp3     — pure digital silence
#
# All six are produced from FFmpeg's `lavfi` synthetic sources, so the
# output is deterministic and reproducible — anyone can re-run this
# script and verify each file's origin against the source command. The
# output of `lavfi` filters is public domain (no copyrightable input),
# so we can ship these loops without any external sourcing or CDN.
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

# Rain — steady high-frequency hiss. White noise high-passed at 1 kHz
# and rolled off above 8 kHz approximates the spectrum of light, even
# rainfall. A very slow tremolo adds barely-perceptible variation so
# the loop doesn't read as flat machine noise.
render_loop "rain" \
  "anoisesrc=color=white:sample_rate=${SR}:duration=${DURATION},highpass=f=1000,lowpass=f=8000,tremolo=f=0.3:d=0.15"

# Ocean — slow wave swell. Brown noise gives the low-frequency rumble
# of surf; a 0.12 Hz tremolo (one cycle ~8 s) modulates amplitude to
# mimic waves rolling in and out. Lowpass keeps the spectrum below
# the splash range for a calm, deep-water feel.
render_loop "ocean" \
  "anoisesrc=color=brown:sample_rate=${SR}:duration=${DURATION},lowpass=f=2000,tremolo=f=0.12:d=0.7"

# Forest — soft outdoor bed. Pink noise low-passed to ~1.5 kHz removes
# the harshness of open white noise; a very slow tremolo evokes a
# distant breeze through leaves. (No bird calls — synthetic chirps
# read as artificial; better to ship a clean breeze than a fake aviary.)
render_loop "forest" \
  "anoisesrc=color=pink:sample_rate=${SR}:duration=${DURATION},lowpass=f=1500,tremolo=f=0.1:d=0.25"

# Wind — sustained gusts. Brown noise heavily low-passed (≤400 Hz)
# carries only the body of a moving air mass; a 0.1 Hz tremolo with
# stronger depth reads as gusts swelling and falling.
render_loop "wind" \
  "anoisesrc=color=brown:sample_rate=${SR}:duration=${DURATION},lowpass=f=400,tremolo=f=0.1:d=0.5"

echo
echo "done — generated:"
ls -la "${DEST}/rain.mp3" "${DEST}/ocean.mp3" "${DEST}/forest.mp3" \
       "${DEST}/wind.mp3" "${DEST}/white_noise.mp3" "${DEST}/silence.mp3"
