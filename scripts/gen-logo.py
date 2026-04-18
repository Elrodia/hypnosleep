"""Generate HypnoSleep brand PNG assets by rasterizing an in-memory SVG.

Recreates the design shown in the reference artwork:
  - Dark navy background (#0a0a1a -> #13132a subtle radial)
  - Purple gradient crescent mark (two overlapping circles, light->deep purple)
  - Faint star specks around the mark
  - Italic serif wordmark: "Hypno" (light) + "Sleep" (purple)
  - Small letter-spaced tagline: REWIRE · RELAX · RESTORE

These are drop-in placeholders; swap the resulting PNGs under public/ with
the original artwork files without any further code changes.
"""

from __future__ import annotations

import io
import os
import subprocess
import sys


OUT_DIR = os.environ.get(
    "HYPNOSLEEP_PUBLIC_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public")),
)

# Design tokens
BG = "#0a0a1a"
BG2 = "#13132a"
PURPLE_LIGHT = "#b29bff"
PURPLE_MID = "#8a6fff"
PURPLE_DEEP = "#6a50e0"
BLUE_EDGE = "#7a8cff"
WORDMARK_LIGHT = "#f1ecff"
WORDMARK_PURPLE = "#8a6fff"
TAGLINE = "#6e6a8f"

STARS = [
    # (cx, cy, r, opacity) in 1024-unit canvas
    (210, 380, 3, 0.55),
    (330, 760, 2, 0.45),
    (420, 290, 2, 0.7),
    (780, 230, 3, 0.6),
    (880, 520, 2, 0.5),
    (190, 640, 2, 0.35),
    (720, 840, 2, 0.55),
    (860, 760, 3, 0.5),
    (150, 470, 2, 0.3),
    (970, 400, 2, 0.5),
]


def mark_svg(size: int, with_bg: bool = True, pad: float = 0.12) -> str:
    """Return SVG string for the crescent mark.

    Coordinate system is 0..1024. `pad` pushes the mark inward.
    """
    W = H = 1024
    inset = int(W * pad)
    inner = W - 2 * inset
    cx = W / 2
    cy = H / 2
    r = inner / 2
    # Second circle offset up-right to carve the crescent
    off_x = r * 0.28
    off_y = -r * 0.18
    mask_r = r * 0.92

    bg = ""
    if with_bg:
        bg = f"""
        <defs>
          <radialGradient id=\"bg\" cx=\"50%\" cy=\"45%\" r=\"70%\">
            <stop offset=\"0%\" stop-color=\"{BG2}\"/>
            <stop offset=\"100%\" stop-color=\"{BG}\"/>
          </radialGradient>
        </defs>
        <rect width=\"{W}\" height=\"{H}\" fill=\"url(#bg)\"/>
        """

    stars = ""
    if with_bg:
        for (sx, sy, sr, so) in STARS:
            stars += f'<circle cx="{sx}" cy="{sy}" r="{sr}" fill="#ffffff" opacity="{so}"/>'

    svg = f"""<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {W} {H}\" width=\"{size}\" height=\"{size}\">
      {bg}
      <defs>
        <linearGradient id=\"moonGrad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">
          <stop offset=\"0%\" stop-color=\"{PURPLE_LIGHT}\"/>
          <stop offset=\"55%\" stop-color=\"{PURPLE_MID}\"/>
          <stop offset=\"100%\" stop-color=\"{BLUE_EDGE}\"/>
        </linearGradient>
        <radialGradient id=\"innerShadow\" cx=\"55%\" cy=\"45%\" r=\"55%\">
          <stop offset=\"60%\" stop-color=\"#1a1940\" stop-opacity=\"0\"/>
          <stop offset=\"100%\" stop-color=\"#05051a\" stop-opacity=\"0.9\"/>
        </radialGradient>
        <mask id=\"crescent\">
          <rect width=\"{W}\" height=\"{H}\" fill=\"black\"/>
          <circle cx=\"{cx}\" cy=\"{cy}\" r=\"{r}\" fill=\"white\"/>
          <circle cx=\"{cx + off_x}\" cy=\"{cy + off_y}\" r=\"{mask_r}\" fill=\"black\"/>
        </mask>
      </defs>
      {stars}
      <!-- Full faint ring to echo the reference artwork -->
      <circle cx=\"{cx}\" cy=\"{cy}\" r=\"{r}\" fill=\"none\" stroke=\"url(#moonGrad)\" stroke-width=\"{max(6, r*0.055)}\" opacity=\"0.55\"/>
      <!-- Crescent fill -->
      <g mask=\"url(#crescent)\">
        <rect width=\"{W}\" height=\"{H}\" fill=\"url(#moonGrad)\"/>
      </g>
      <!-- Inner shadow gives the moon depth -->
      <circle cx=\"{cx}\" cy=\"{cy}\" r=\"{r*0.98}\" fill=\"url(#innerShadow)\" opacity=\"0.9\"/>
    </svg>"""
    return svg


def wordmark_svg(width: int, height: int, with_bg: bool, include_tagline: bool, include_mark: bool) -> str:
    """Return an SVG for wordmark / full logo."""
    W, H = 2048, 1024 if not include_tagline else 1280
    # If only wordmark (no mark, no tagline), use a wider flatter canvas.
    if not include_mark and not include_tagline:
        W, H = 2048, 720

    cx = W / 2
    mark_size = 0
    mark_y = 0
    wm_y = H * 0.58
    tagline_y = H * 0.82
    mark_block = ""
    if include_mark:
        mark_size = int(H * 0.48)
        mark_y = int(H * 0.08)
        wm_y = H * 0.72
        tagline_y = H * 0.92
        mark_block = f'<g transform="translate({cx - mark_size/2},{mark_y})">{mark_svg(mark_size, with_bg=False)}</g>'

    bg = ""
    if with_bg:
        stars = ""
        for (sx, sy, sr, so) in STARS:
            # spread stars across the wider canvas
            tx = int(sx / 1024 * W)
            ty = int(sy / 1024 * H)
            stars += f'<circle cx="{tx}" cy="{ty}" r="{sr}" fill="#ffffff" opacity="{so*0.9}"/>'
        bg = f"""
        <defs>
          <radialGradient id=\"pagebg\" cx=\"50%\" cy=\"45%\" r=\"70%\">
            <stop offset=\"0%\" stop-color=\"{BG2}\"/>
            <stop offset=\"100%\" stop-color=\"{BG}\"/>
          </radialGradient>
        </defs>
        <rect width=\"{W}\" height=\"{H}\" fill=\"url(#pagebg)\"/>
        {stars}
        """

    wm_size = int(H * 0.28)
    tagline_block = ""
    if include_tagline:
        ts = int(H * 0.065)
        tagline_block = (
            f'<text x="{cx}" y="{tagline_y}" text-anchor="middle" '
            f'font-family="Inter, ui-sans-serif, system-ui, sans-serif" '
            f'font-size="{ts}" letter-spacing="{ts*0.45}" fill="{TAGLINE}" '
            f'font-weight="500">REWIRE · RELAX · RESTORE</text>'
        )

    wordmark = (
        f'<text x="{cx}" y="{wm_y}" text-anchor="middle" '
        f'font-family="Fraunces, &quot;Crimson Pro&quot;, Georgia, serif" '
        f'font-style="italic" font-weight="500" font-size="{wm_size}">'
        f'<tspan fill="{WORDMARK_LIGHT}">Hypno </tspan>'
        f'<tspan fill="{WORDMARK_PURPLE}">Sleep</tspan>'
        f'</text>'
    )

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'width="{width}" height="{height}">'
        f'{bg}{mark_block}{wordmark}{tagline_block}</svg>'
    )
    return svg


def og_svg() -> str:
    """1200x630 social card."""
    W, H = 1200, 630
    cx = W / 2
    stars = ""
    for (sx, sy, sr, so) in STARS + [(60, 120, 2, 0.4), (1140, 90, 2, 0.5), (1100, 540, 3, 0.5), (90, 540, 2, 0.45)]:
        tx = int(sx / 1024 * W)
        ty = int(sy / 1024 * H)
        stars += f'<circle cx="{tx}" cy="{ty}" r="{sr}" fill="#ffffff" opacity="{so*0.9}"/>'
    mark = f'<g transform="translate({cx - 120},{70})">{mark_svg(240, with_bg=False)}</g>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
      <defs>
        <radialGradient id="pbg" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stop-color="{BG2}"/>
          <stop offset="100%" stop-color="{BG}"/>
        </radialGradient>
      </defs>
      <rect width="{W}" height="{H}" fill="url(#pbg)"/>
      {stars}
      {mark}
      <text x="{cx}" y="400" text-anchor="middle" font-family="Fraunces, Georgia, serif"
            font-style="italic" font-weight="500" font-size="96">
        <tspan fill="{WORDMARK_LIGHT}">Hypno </tspan><tspan fill="{WORDMARK_PURPLE}">Sleep</tspan>
      </text>
      <text x="{cx}" y="460" text-anchor="middle" font-family="Inter, sans-serif"
            font-size="26" letter-spacing="10" fill="{TAGLINE}" font-weight="500">
        REWIRE · RELAX · RESTORE
      </text>
      <text x="{cx}" y="540" text-anchor="middle" font-family="Inter, sans-serif"
            font-size="22" fill="#b9b4d6">AI hypnosis for sleep, confidence &amp; habits</text>
    </svg>'''


def rasterize(svg_text: str, out_path: str, width: int, height: int) -> None:
    """Rasterize SVG -> PNG via cairosvg (preferred) or svglib fallback."""
    try:
        import cairosvg  # type: ignore
        cairosvg.svg2png(bytestring=svg_text.encode("utf-8"),
                         output_width=width, output_height=height,
                         write_to=out_path)
        return
    except Exception:
        pass
    # Fallback: use rsvg-convert if available
    try:
        p = subprocess.run(
            ["rsvg-convert", "-w", str(width), "-h", str(height), "-o", out_path],
            input=svg_text.encode("utf-8"),
            check=True, capture_output=True,
        )
        return
    except FileNotFoundError:
        pass
    # Last resort: svglib + reportlab
    from svglib.svglib import svg2rlg
    from reportlab.graphics import renderPM
    drawing = svg2rlg(io.StringIO(svg_text))
    scale_x = width / drawing.width
    scale_y = height / drawing.height
    drawing.width = width
    drawing.height = height
    drawing.scale(scale_x, scale_y)
    renderPM.drawToFile(drawing, out_path, fmt="PNG")


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)

    # Mark (icon only, with background) — used everywhere the mark stands alone
    rasterize(mark_svg(1024, with_bg=True), os.path.join(OUT_DIR, "logo-mark.png"), 1024, 1024)

    # Wordmark: mark + "Hypno Sleep"
    rasterize(wordmark_svg(2048, 1024, with_bg=True, include_tagline=False, include_mark=True),
              os.path.join(OUT_DIR, "logo-wordmark.png"), 2048, 1024)

    # Full: mark + wordmark + tagline (matches the main reference image)
    rasterize(wordmark_svg(2048, 1280, with_bg=True, include_tagline=True, include_mark=True),
              os.path.join(OUT_DIR, "logo.png"), 2048, 1280)

    # Favicon PNGs
    rasterize(mark_svg(512, with_bg=True), os.path.join(OUT_DIR, "favicon.png"), 512, 512)
    rasterize(mark_svg(180, with_bg=True), os.path.join(OUT_DIR, "apple-touch-icon.png"), 180, 180)
    rasterize(mark_svg(192, with_bg=True), os.path.join(OUT_DIR, "icon-192.png"), 192, 192)
    rasterize(mark_svg(512, with_bg=True), os.path.join(OUT_DIR, "icon-512.png"), 512, 512)

    # Social card
    rasterize(og_svg(), os.path.join(OUT_DIR, "og.png"), 1200, 630)

    # favicon.ico (multi-size)
    from PIL import Image
    png = Image.open(os.path.join(OUT_DIR, "favicon.png")).convert("RGBA")
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    png.save(os.path.join(OUT_DIR, "favicon.ico"), format="ICO", sizes=sizes)

    for f in sorted(os.listdir(OUT_DIR)):
        p = os.path.join(OUT_DIR, f)
        if os.path.isfile(p):
            print(f"{f:28s} {os.path.getsize(p):>8d} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
