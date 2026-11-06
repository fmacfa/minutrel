#!/usr/bin/env python3
"""Crée une archive source locale en respectant les exclusions Git, sans publication."""
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
version = json.loads((ROOT / "package.json").read_text())["version"]
output = ROOT / "output/ci"
output.mkdir(parents=True, exist_ok=True)
archive_path = output / f"minutrel-source-{version}.zip"
files = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=ROOT).decode().split("\0")
with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(set(filter(None, files))):
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            raise ValueError(f"Fichier absent ou hors dépôt : {name}")
        info = zipfile.ZipInfo(f"minutrel/{name}", date_time=(2026, 11, 5, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, path.read_bytes())
checksum = hashlib.sha256(archive_path.read_bytes()).hexdigest()
(output / "SHA256SUMS").write_text(f"{checksum}  {archive_path.name}\n")
print(f"Archive source créée : {archive_path.name}")
