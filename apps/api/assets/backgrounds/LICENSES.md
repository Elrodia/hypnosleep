# Background ambient loop licenses

Each file in `apps/api/assets/backgrounds/` is generated under the
licence noted here. All currently bundled loops are produced locally
from FFmpeg's `lavfi` synthetic sources, whose output is not
copyrightable. **Do not commit files sourced under any other licence.**
If a future change introduces a hand-curated recording, it must be
**CC0 / public-domain** and the entry below must record:

- the **exact source URL** (a deep link to the asset page, not just the
  site root),
- the **licence** ("CC0", "Pixabay Content License", "FFmpeg lavfi
  synthesis", etc.),
- the **author / uploader** when the source identifies one,
- the **date** the file was downloaded so the licence wording can be
  audited against what the source displayed at the time.

| File              | Description                       | Source                                                                                                                                  | Licence                              | Author / uploader | Date added |
| ----------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------- | ---------- |
| `rain.mp3`        | Steady high-frequency rainfall    | Generated locally — `apps/api/scripts/generate-backgrounds.sh` (FFmpeg `anoisesrc=color=white,highpass=f=1000,lowpass=f=8000,tremolo=f=0.3:d=0.15`)  | Public domain (FFmpeg lavfi output)  | n/a               | n/a        |
| `ocean.mp3`       | Slow wave swell                   | Generated locally — `apps/api/scripts/generate-backgrounds.sh` (FFmpeg `anoisesrc=color=brown,lowpass=f=2000,tremolo=f=0.12:d=0.7`)                 | Public domain (FFmpeg lavfi output)  | n/a               | n/a        |
| `forest.mp3`      | Soft outdoor breeze bed           | Generated locally — `apps/api/scripts/generate-backgrounds.sh` (FFmpeg `anoisesrc=color=pink,lowpass=f=1500,tremolo=f=0.1:d=0.25`)                  | Public domain (FFmpeg lavfi output)  | n/a               | n/a        |
| `wind.mp3`        | Sustained gusts                   | Generated locally — `apps/api/scripts/generate-backgrounds.sh` (FFmpeg `anoisesrc=color=brown,lowpass=f=400,tremolo=f=0.1:d=0.5`)                   | Public domain (FFmpeg lavfi output)  | n/a               | n/a        |
| `white_noise.mp3` | Pink noise (warmer than white)    | Generated locally — `apps/api/scripts/generate-backgrounds.sh` (FFmpeg `anoisesrc=color=pink`)                                          | Public domain (FFmpeg lavfi output)  | n/a               | n/a        |
| `silence.mp3`     | Pure digital silence              | Generated locally — `apps/api/scripts/generate-backgrounds.sh` (FFmpeg `anullsrc`)                                                      | Public domain (FFmpeg lavfi output)  | n/a               | n/a        |

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
3. The synthetic files must be reproducible from
   `generate-backgrounds.sh`. Re-run the script instead of editing them
   by hand so anyone can verify their origin.
4. After adding a file, normalise it to the spec in
   `apps/api/assets/backgrounds/README.md` (5 minutes, MP3 128 kbps
   stereo 44.1 kHz, −20 LUFS, loopable at zero crossings).

## Why this file matters

This is **legal compliance**, not bookkeeping. Any DMCA / takedown
request needs to be answerable from the table above; if a row says
"_TBD_" for a file that ships in the runtime image, that's a
production blocker.
