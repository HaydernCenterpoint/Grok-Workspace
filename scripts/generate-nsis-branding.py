#!/usr/bin/env python3
"""Paint NSIS welcome/header bitmaps in Grok's black-and-silver mark."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
OUT = ROOT / "src-tauri" / "icons" / "nsis"
LOGO_FLAT = ROOT / "docs" / "assets" / "grok-logo.png"
LOGO_METAL = ROOT / "src-tauri" / "icons" / "icon-source.png"

INK = (10, 10, 10)
INK_SOFT = (18, 18, 18)
SILVER = (236, 236, 236)
MUTED = (138, 138, 138)
HAIR = (48, 48, 48)

# The MUI header strip is white, so the header art blends instead of blocking.
PAPER = (255, 255, 255)
PAPER_INK = (17, 17, 17)
PAPER_MUTED = (122, 122, 122)

SIDEBAR = (164, 314)
HEADER = (150, 57)


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    path = Path(r"C:\Windows\Fonts") / name
    if not path.is_file():
        path = Path(r"C:\Windows\Fonts\arial.ttf")
    return ImageFont.truetype(str(path), size)


def draw_tracking(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    width: int,
    tracking: int,
) -> None:
    widths = [draw.textlength(ch, font=face) for ch in text]
    total = sum(widths) + tracking * max(len(text) - 1, 0)
    x = (width - total) / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=face, fill=fill)
        x += w + tracking


def glyph_alpha(src: Path) -> Image.Image:
    """Cut the mark off its page, whichever polarity the source uses."""
    gray = Image.open(src).convert("L")
    w, h = gray.size
    corners = [gray.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    if sum(corners) / len(corners) > 128:
        # Black mark on a white page (docs/assets/grok-logo.png).
        return ImageEnhance.Contrast(gray).enhance(2.4).point(lambda p: 255 - p if p < 210 else 0)
    # Silver mark on black (src-tauri/icons/icon-source.png).
    return gray.point(lambda p: min(255, int((p - 12) * 1.15)) if p > 18 else 0)


def fit(mark: Image.Image, size: int) -> Image.Image:
    mark = mark.crop(mark.getbbox() or (0, 0, mark.width, mark.height))
    mark.thumbnail((size, size), Image.Resampling.LANCZOS)
    return mark


def solid_mark(src: Path, size: int, color: tuple[int, int, int]) -> Image.Image:
    alpha = glyph_alpha(src)
    mark = Image.new("RGBA", alpha.size, (*color, 0))
    mark.putalpha(alpha)
    return fit(mark, size)


def metal_mark(src: Path, size: int) -> Image.Image:
    """Keep icon-source's brushed-metal shading, drop the black field."""
    im = Image.open(src).convert("RGBA")
    im.putalpha(glyph_alpha(src))
    return fit(im, size)


def paint_sidebar() -> Image.Image:
    w, h = SIDEBAR
    img = Image.new("RGB", (w, h), INK)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        r = int(INK[0] + (INK_SOFT[0] - INK[0]) * t)
        g = int(INK[1] + (INK_SOFT[1] - INK[1]) * t)
        b = int(INK[2] + (INK_SOFT[2] - INK[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)

    # Corner ticks echo the mark's slash without cutting across the wordmark.
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.line((0, 30, 26, 4), fill=(255, 255, 255, 26), width=1)
    od.line((w - 26, h - 4, w, h - 30), fill=(255, 255, 255, 26), width=1)
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    mark = (
        metal_mark(LOGO_METAL, 92)
        if LOGO_METAL.is_file()
        else solid_mark(LOGO_FLAT, 92, SILVER)
    )
    mx = (w - mark.width) // 2
    my = 46
    img.paste(mark, (mx, my), mark)

    draw_tracking(draw, "GROK", 168, font(15, bold=True), SILVER, w, 4)
    draw_tracking(draw, "WORKSPACE", 192, font(9), MUTED, w, 3)
    draw.line((36, 222, w - 36, 222), fill=HAIR, width=1)
    draw_tracking(draw, "BUILD  ·  OFFICE  ·  STUDIO", 236, font(7), MUTED, w, 1)
    draw_tracking(draw, f"v{VERSION}", h - 28, font(8), MUTED, w, 1)
    return img


def paint_header() -> Image.Image:
    w, h = HEADER
    img = Image.new("RGB", (w, h), PAPER)
    mark = solid_mark(LOGO_FLAT if LOGO_FLAT.is_file() else LOGO_METAL, 30, PAPER_INK)
    my = (h - mark.height) // 2
    img.paste(mark, (18, my), mark)
    draw = ImageDraw.Draw(img)
    draw.text((58, 15), "GROK", font=font(13, bold=True), fill=PAPER_INK)
    draw.text((58, 32), "WORKSPACE", font=font(8), fill=PAPER_MUTED)
    return img


def save_bmp(img: Image.Image, path: Path, *, sharpen: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img.convert("RGB")
    if sharpen:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=70, threshold=3))
    # NSIS MUI wants an uncompressed 24-bit BMP.
    out.save(path, "BMP")
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def main() -> None:
    if not LOGO_FLAT.is_file() and not LOGO_METAL.is_file():
        raise SystemExit("missing Grok logo sources")
    save_bmp(paint_sidebar(), OUT / "sidebar.bmp", sharpen=True)
    save_bmp(paint_header(), OUT / "header.bmp")


if __name__ == "__main__":
    main()
