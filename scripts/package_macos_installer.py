"""Package a signed Minutrel.app with first-open help visible in Finder.

Usage: python3 scripts/package_macos_installer.py /path/to/Minutrel.app /path/to/output.dmg
Build dependencies: dmgbuild 1.6.7 and Pillow.
"""
import argparse
import subprocess
import tempfile
from pathlib import Path

import dmgbuild
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SIZE = (760, 524)
FONTS = ROOT / "brand/fonts"
GUIDE = ROOT / "apps/desktop/installer/Installation.html"


def background(path, scale):
    image = Image.new("RGB", tuple(n * scale for n in SIZE), "#f8f7f2")
    draw = ImageDraw.Draw(image)
    ink = "#143e39"
    teal = "#086d64"

    def label(x, y, value, size, weight="Regular", color=ink):
        font = ImageFont.truetype(str(FONTS / f"Manrope-{weight}.ttf"), size * scale)
        draw.text((x * scale, y * scale), value, font=font, fill=color, anchor="lt")

    label(28, 22, "Glissez Minutrel dans Applications", 25, "ExtraBold")
    # The three Finder icons sit in the empty area beneath the title.
    draw.line([(214 * scale, 112 * scale), (278 * scale, 112 * scale)], fill=teal, width=3 * scale)
    draw.line([(270 * scale, 104 * scale), (278 * scale, 112 * scale), (270 * scale, 120 * scale)],
              fill=teal, width=3 * scale)
    draw.line([(28 * scale, 205 * scale), (732 * scale, 205 * scale)], fill="#abc6bf", width=scale)
    label(28, 231, "Si macOS ne peut pas vérifier l’éditeur", 22, "ExtraBold")
    label(28, 279, "1. Depuis Applications, essayez d’ouvrir Minutrel une première fois.", 17)
    label(28, 316, "2. Ouvrez Réglages Système, puis Confidentialité et sécurité.", 17)
    label(28, 353, "3. Faites défiler jusqu’à la section Sécurité. À côté de Minutrel,", 17)
    label(48, 379, "cliquez sur « Ouvrir quand même », puis confirmez.", 17, "SemiBold")
    label(28, 441, "For English instructions and team sign-in, open Installation.html.", 14, color=teal)
    image.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    app = args.app.resolve()
    if app.name != "Minutrel.app" or not (app / "Contents/Info.plist").is_file():
        parser.error("Expected a built Minutrel.app bundle")
    output = args.output.resolve()
    if output.exists():
        parser.error("Choose a new output path")
    subprocess.run(["codesign", "--verify", "--deep", "--strict", "--all-architectures", str(app)], check=True)
    with tempfile.TemporaryDirectory() as stage:
        artwork = Path(stage) / "installation.png"
        background(artwork, 1)
        background(artwork.with_name("installation@2x.png"), 2)
        settings = {
            "format": "UDZO", "filesystem": "HFS+",
            "files": [str(app), str(GUIDE)],
            "symlinks": {"Applications": "/Applications"},
            "icon": str(app / "Contents/Resources/icon.icns"),
            "background": str(artwork), "window_rect": ((100, 80), SIZE),
            "icon_locations": {
                "Minutrel.app": (133, 108), "Applications": (357, 108),
                "Installation.html": (620, 108),
                # Finder can display hidden files. Keep its artwork below the instructions.
                ".background.tiff": (133, 660), ".VolumeIcon.icns": (357, 660),
            },
            "default_view": "icon-view", "include_icon_view_settings": True,
            "icon_size": 78, "text_size": 13, "show_icon_preview": False,
            "show_status_bar": False, "show_toolbar": False, "show_pathbar": False,
            "show_sidebar": False,
        }
        dmgbuild.build_dmg(str(output), "Minutrel", settings=settings)
    subprocess.run(["hdiutil", "verify", str(output)], check=True)


if __name__ == "__main__":
    main()
