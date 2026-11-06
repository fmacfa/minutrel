#!/usr/bin/env python3
"""Contrôle les livrables graphiques sans bibliothèque externe ni accès réseau."""
import hashlib
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check():
    tokens = json.loads((ROOT / "brand/tokens.json").read_text(encoding="utf-8"))
    manifest = json.loads((ROOT / "brand/manifest.json").read_text(encoding="utf-8"))
    for name, expected in manifest.items():
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            raise ValueError(f"Ressource absente ou hors dépôt : {name}")
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f"Ressource modifiée sans régénération du manifeste : {name}")
        if path.suffix == ".svg":
            tree = ET.parse(path)
            for element in tree.iter():
                if element.tag.rsplit("}", 1)[-1] in {"script", "foreignObject", "text"}:
                    raise ValueError(f"Logo non autonome ou contenu actif : {name}")
                if any(key.lower().startswith("on") or "href" in key for key in element.attrib):
                    raise ValueError(f"Référence ou événement interdit dans le SVG : {name}")
        if path.suffix == ".png":
            data = path.read_bytes()
            if data[:8] != b"\x89PNG\r\n\x1a\n" or not all(struct.unpack(">II", data[16:24])):
                raise ValueError(f"PNG invalide : {name}")
    css = (ROOT / "brand/tokens.css").read_text(encoding="utf-8").lower()
    for key, value in tokens["colors"].items():
        css_key = re.sub(r"([A-Z])", lambda match: "-" + match[1].lower(), key)
        if f"--color-{css_key}: {value.lower()}" not in css:
            raise ValueError(f"Couleur CSS et JSON différente : {key}")
    if "SIL OPEN FONT LICENSE" not in (ROOT / "brand/fonts/OFL.txt").read_text():
        raise ValueError("Licence de police absente.")
    if not (ROOT / "output/pdf/minutrel-charte-graphique.pdf").read_bytes().startswith(b"%PDF-"):
        raise ValueError("Charte PDF absente ou invalide.")
    print(f"OK — {len(manifest)} ressources graphiques et leurs empreintes vérifiées.")


if __name__ == "__main__":
    try:
        check()
    except (ValueError, OSError, KeyError, ET.ParseError) as error:
        print(f"ÉCHEC — {error}", file=sys.stderr)
        sys.exit(1)
