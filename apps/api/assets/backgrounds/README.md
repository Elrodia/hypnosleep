# Background ambient loops

This directory contains the royalty-free ambient loops used by
`apps/api/src/modules/audio/audio.mixer.ts` when mixing a background
track into a generated session.

## Required files

| File              | Description                    |
| ----------------- | ------------------------------ |
| `rain.mp3`        | Gentle rainfall — 5 minute loop|
| `ocean.mp3`       | Waves — 5 minute loop          |
| `forest.mp3`      | Birds + breeze — 5 minute loop |
| `wind.mp3`        | Soft wind — 5 minute loop      |
| `white_noise.mp3` | Static — 5 minute loop         |

The normal `generateAudio()` `"silence"` option skips the FFmpeg
background-mix step, so it does not require a `silence.mp3` asset.
If another code path calls the background-mixing logic directly with a
silent track, document that requirement separately.

## Missing-file fallback

`audio.service.ts` checks each asset with `fs.access` before invoking
FFmpeg. When a specific file is missing (e.g. a fresh deploy hasn't run
the download script yet), the pipeline **degrades gracefully to a
voice-only mix** and logs a `warn` entry rather than failing the whole
generation job. The UX is strictly worse than a mixed session but it
prevents day-0 assets gaps from bricking the generate flow.

## Encoding

All loops should be:

- MP3 container, **128 kbps** CBR
- Normalised to **-20 LUFS** integrated loudness
- Exactly **5 minutes** long (the FFmpeg pipeline loops them via
  `-stream_loop -1` and trims to the voice duration)

## Sourcing

Use only royalty-free assets (e.g. Pixabay, Freesound CC0). Do **not**
commit copyrighted material. The source URL and licence for every
shipped file MUST be recorded in
[`LICENSES.md`](./LICENSES.md) — that file is the authoritative legal
record and is required for compliance.

The two synthetic loops (`white_noise.mp3`, `silence.mp3`) can be
generated deterministically from FFmpeg's `lavfi` synthetic sources:

```bash
apps/api/scripts/generate-backgrounds.sh
```

The remaining four (`rain`, `ocean`, `forest`, `wind`) must be sourced
manually from a CC0 / royalty-free library and added to `LICENSES.md`.

To populate this directory at deploy time without committing the MP3s
to git, host them on a CDN/bucket you control and run:

```bash
BG_SOURCE_BASE=https://cdn.example.com/hypnosleep/bg \
  apps/api/scripts/download-backgrounds.sh
```

See `apps/api/scripts/download-backgrounds.sh` for the exact file list
and behaviour. The `Dockerfile` already copies everything under
`apps/api/assets/` into the runtime image, so any files placed here
before `docker build` are picked up automatically.

