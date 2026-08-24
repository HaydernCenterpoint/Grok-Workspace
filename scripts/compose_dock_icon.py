#!/usr/bin/env python3
"""Compose the dock/app master from the user mark and emit Tauri icon sizes.

Dock / .exe / .icns only. Tray rasters stay on docs/svg/logo.svg
(see docs/llm-wiki/icons.md and scripts/generate-icons.sh).

macOS generate-icons.sh still prefers `icon (1).png` → icon-source.png.
This script is the Windows-safe path (no sips / iconutil).
"""

from __future__ import annotations

import shutil
import struct
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "src-tauri" / "icons"
DOCS_LOGO = ROOT / "docs" / "assets" / "grok-logo.png"
PUBLIC_LOGO = ROOT / "public" / "logo.png"

# Same sizes as generate-icons.sh (sips / iconutil).
PNG_SIZES = {
    "icon.png": 512,
    "32x32.png": 32,
    "64x64.png": 64,
    "128x128.png": 128,
    "128x128@2x.png": 256,
}
ICNS_SLOTS = (
    ("icp4", 16),
    ("icp5", 32),
    ("icp6", 64),
    ("ic07", 128),
    ("ic08", 256),
    ("ic09", 512),
    ("ic10", 1024),
    ("ic11", 32),
    ("ic12", 64),
    ("ic13", 256),
    ("ic14", 512),
)


def extract_mark(src: Image.Image) -> Image.Image:
    """Keep the white glyph; drop near-black / empty field."""
    im = src.convert("RGBA")
    pix = im.load()
    w, h = im.size
    xs: list[int] = []
    ys: list[int] = []
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a < 12:
                continue
            lum = (r + g + b) / 3
            if lum < 18:
                continue
            alpha = min(255, int(a * min(1.0, (lum - 12) / 200)))
            op[x, y] = (255, 255, 255, alpha)
            if alpha > 20:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit("mark extract empty — check source PNG")
    pad = 2
    return out.crop(
        (
            max(0, min(xs) - pad),
            max(0, min(ys) - pad),
            min(w, max(xs) + 1 + pad),
            min(h, max(ys) + 1 + pad),
        )
    )


def plate_mask(template: Image.Image, size: int) -> Image.Image:
    """Reuse the shipped macOS-grid squircle (alpha only), scaled to `size`."""
    alpha = template.convert("RGBA").getchannel("A")
    return alpha.resize((size, size), Image.Resampling.LANCZOS)


def compose_master(mark: Image.Image, plate: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    plate_rgba = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    plate_rgba.putalpha(plate)
    canvas.alpha_composite(plate_rgba)

    # Match the previous glyph occupancy (~67% of the 512 canvas).
    inner = max(1, int(round(size * 0.67)))
    fitted = mark.copy()
    fitted.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    if max(fitted.size) < inner * 0.92:
        fitted = mark.resize(
            (
                max(1, int(round(mark.width * inner / max(mark.size)))),
                max(1, int(round(mark.height * inner / max(mark.size)))),
            ),
            Image.Resampling.LANCZOS,
        )
    if size >= 256:
        fitted = fitted.filter(ImageFilter.UnsharpMask(radius=0.6, percent=55, threshold=2))
    ox = (size - fitted.width) // 2
    oy = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (ox, oy))
    return canvas


def write_icns(dest: Path, master: Image.Image) -> None:
    chunks: list[bytes] = []
    for ostype, n in ICNS_SLOTS:
        frame = master.resize((n, n), Image.Resampling.LANCZOS)
        buf = BytesIO()
        frame.save(buf, format="PNG")
        data = buf.getvalue()
        chunks.append(ostype.encode("ascii") + struct.pack(">I", 8 + len(data)) + data)
    body = b"".join(chunks)
    dest.write_bytes(b"icns" + struct.pack(">I", 8 + len(body)) + body)


def write_flat_docs_logo(mark: Image.Image, dest: Path) -> None:
    """Black mark on white — README + NSIS header source."""
    size = 512
    page = Image.new("RGB", (size, size), (255, 255, 255))
    glyph = mark.copy()
    glyph.thumbnail((int(size * 0.72), int(size * 0.72)), Image.Resampling.LANCZOS)
    black = Image.new("RGBA", glyph.size, (17, 17, 17, 0))
    black.putalpha(glyph.getchannel("A"))
    ox = (size - black.width) // 2
    oy = (size - black.height) // 2
    page.paste(black, (ox, oy), black)
    dest.parent.mkdir(parents=True, exist_ok=True)
    page.save(dest, "PNG")


def main() -> None:
    src_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else ICONS / "icon-mark-source.png"
    if not src_arg.is_file():
        raise SystemExit(f"missing mark source: {src_arg}")

    raw_dest = ICONS / "icon-mark-source.png"
    if src_arg.resolve() != raw_dest.resolve():
        shutil.copy2(src_arg, raw_dest)

    template = Image.open(ICONS / "icon-source.png")
    plate_1024 = plate_mask(template, 1024)
    mark = extract_mark(Image.open(raw_dest))
    master_1024 = compose_master(mark, plate_1024, 1024)
    master_512 = master_1024.resize((512, 512), Image.Resampling.LANCZOS)

    named = ICONS / "icon (1).png"
    master_512.save(named, "PNG")
    master_512.save(ICONS / "icon-source.png", "PNG")

    for name, n in PNG_SIZES.items():
        master_1024.resize((n, n), Image.Resampling.LANCZOS).save(ICONS / name, "PNG")

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from windows_ico_fill import write_filled_ico

    write_filled_ico(ICONS / "icon-source.png", ICONS / "icon.ico")
    write_icns(ICONS / "icon.icns", master_1024)
    write_flat_docs_logo(mark, DOCS_LOGO)
    PUBLIC_LOGO.parent.mkdir(parents=True, exist_ok=True)
    master_512.save(PUBLIC_LOGO, "PNG")

    print(f"OK — raw mark: {raw_dest}")
    print(f"OK — dock master: {named} / icon-source.png")
    print("OK — tray rasters untouched")


if __name__ == "__main__":
    main()
