# Background ambient loop licenses

Each file in `apps/api/assets/backgrounds/` is bundled or generated under
the licence noted here. Only **CC0 / public-domain** assets, or assets
generated locally with FFmpeg's `lavfi` synthetic sources (which are
themselves not copyrightable), are permitted. **Do not commit files
sourced under any other licence.**

Update this file every time a new asset is added or replaced. The entry
must include:

- the **exact source URL** (a deep link to the asset page, not just the
  site root),
- the **licence** ("CC0", "Pixabay Content License", "FFmpeg lavfi
  synthesis", etc.),
- the **author / uploader** when the source identifies one,
- the **date** the file was downloaded so the licence wording can be
  audited against what the source displayed at the time.

| File              | Description                       | Source                        | Licence                              | Author / uploader | Date added |
| ----------------- | --------------------------------- | ----------------------------- | ------------------------------------ | ----------------- | ---------- |
| `rain.mp3`        | Gentle steady rainfall, no thunder | <!-- e.g. https://pixabay.com/sound-effects/rain-ambient-loop-12345/ --> _TBD — set when sourced_ | Pixabay Content License (royalty-free) | _TBD_             | _TBD_      |
| `ocean.mp3`       | Slow waves, no seagulls           | <!-- e.g. https://freesound.org/people/.../sounds/12345/ --> _TBD — set when sourced_ | CC0 1.0 Universal                   | _TBD_             | _TBD_      |
| `forest.mp3`      | Distant birds + breeze            | _TBD — set when sourced_      | _TBD_                                | _TBD_             | _TBD_      |
| `wind.mp3`        | Soft sustained wind               | _TBD — set when sourced_      | _TBD_                                | _TBD_             | _TBD_      |
| `white_noise.mp3` | Pink noise (warmer than white)    | Generated locally — `apps/api/scripts/generate-backgrounds.sh` (FFmpeg `anoisesrc=color=pink`) | Public domain (FFmpeg lavfi output) | n/a               | n/a        |
| `silence.mp3`     | Pure digital silence              | Generated locally — `apps/api/scripts/generate-backgrounds.sh` (FFmpeg `anullsrc`)              | Public domain (FFmpeg lavfi output) | n/a               | n/a        |

## Sourcing rules

1. **CC0 / public domain only** for hand-sourced files. Pixabay's
   "Content License" (their default) is treated as royalty-free for our
   commercial use; do **not** ship "All Rights Reserved" or "CC-BY"
   material from there. Freesound: filter by **License → Creative
   Commons 0**.
2. Verify the licence on the source page **at download time** and copy
   the canonical URL (the one that resolves to the licence statement)
   into the table above. Screenshots of the licence panel are nice to
   have but not required.
3. The two synthetic files (`white_noise.mp3`, `silence.mp3`) must be
   reproducible from `generate-backgrounds.sh`. Re-run the script
   instead of editing them by hand so anyone can verify their origin.
4. After adding a file, normalise it to the spec in
   `apps/api/assets/backgrounds/README.md` (5 minutes, MP3 128 kbps
   stereo 44.1 kHz, −20 LUFS, loopable at zero crossings).

## Why this file matters

This is **legal compliance**, not bookkeeping. Any DMCA / takedown
request needs to be answerable from the table above; if a row says
"_TBD_" for a file that ships in the runtime image, that's a
production blocker.
