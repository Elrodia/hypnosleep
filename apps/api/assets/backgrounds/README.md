# Background ambient loops

This directory contains the royalty-free ambient loops used by
`apps/api/src/modules/audio/audio.mixer.ts` when mixing a background
track into a generated session.

## Required files

| File              | Description                       |
| ----------------- | --------------------------------- |
| `rain.mp3`        | Steady rainfall — 5 minute loop   |
| `ocean.mp3`       | Slow wave swell — 5 minute loop   |
| `forest.mp3`      | Soft breeze bed — 5 minute loop   |
| `wind.mp3`        | Sustained gusts — 5 minute loop   |
| `white_noise.mp3` | Pink noise — 5 minute loop        |

The normal `generateAudio()` `"silence"` option skips the FFmpeg
background-mix step, so it does not require a `silence.mp3` asset.
If another code path calls the background-mixing logic directly with a
silent track, document that requirement separately.

## Missing-file fallback

`audio.service.ts` checks each asset with `fs.access` before invoking
FFmpeg. When a specific file is missing (e.g. a fresh deploy hasn't run
the generation script yet), the pipeline **degrades gracefully to a
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

All bundled loops are **synthesised deterministically** from FFmpeg's
`lavfi` synthetic sources by
[`apps/api/scripts/generate-backgrounds.sh`](../../scripts/generate-backgrounds.sh).
The output of `lavfi` filters has no copyrightable input so the
resulting MP3s are public-domain — see [`LICENSES.md`](./LICENSES.md)
for the per-file source filter and licence record.

The MP3s are **not committed** to the repo (they are reproducible from
the script and would only bloat history). Run the script locally if
you need them for development:

```bash
apps/api/scripts/generate-backgrounds.sh
```

The `Dockerfile` runs the script automatically during the runtime
stage, so production images ship with all loops baked in. If you want
to swap the synthesised loops for hand-curated CC0 / royalty-free
recordings, drop the MP3s into this directory before `docker build`
(the Dockerfile's generation step is idempotent: existing files are
overwritten, so prefer hosting your curated set on a CDN and fetching
it instead — see the legacy
[`download-backgrounds.sh`](../../scripts/download-backgrounds.sh) for
a reference implementation).

