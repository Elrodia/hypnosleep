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
## Encoding

All loops should be:

- MP3 container, **128 kbps** CBR
- Normalised to **-20 LUFS** integrated loudness
- Exactly **5 minutes** long (the FFmpeg pipeline loops them via
  `-stream_loop -1` and trims to the voice duration)

## Sourcing

Use only royalty-free assets (e.g. Pixabay, Freesound CC0). Do **not**
commit copyrighted material. Each file's source/licence should be noted
in commit messages when it is added.
