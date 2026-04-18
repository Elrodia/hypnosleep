# Brand assets

The HypnoSleep logo files under `public/` (`logo.png`, `logo-mark.png`,
`logo-wordmark.png`, `favicon.png`, `favicon.ico`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png`, `og.png`) are consumed by the single
`<Logo />` component in `src/components/Logo.tsx` and by the `<link>` /
Open Graph tags in `index.html`.

To replace the artwork with a new version, **just drop the new files at the
same paths** — no code changes are required. Keep the same aspect ratios
if possible (`logo-mark.png` 1:1, `logo-wordmark.png` 2:1, `logo.png` 8:5)
or update the `INTRINSIC` map in `src/components/Logo.tsx` to match.

`scripts/gen-logo.py` regenerates the current placeholder set from an
in-memory SVG. Run it with:

```bash
pip install cairosvg Pillow
python3 scripts/gen-logo.py
```
