#!/usr/bin/env python3
"""Installe actionlint depuis sa version officielle après vérification SHA-256."""
import hashlib
import io
import platform
import tarfile
from pathlib import Path
from urllib.request import urlopen

VERSION = "1.7.12"
ROOT = Path(__file__).resolve().parent.parent
system = {"Darwin": "darwin", "Linux": "linux", "Windows": "windows"}[platform.system()]
arch = "arm64" if platform.machine().lower() in {"arm64", "aarch64"} else "amd64"
name = f"actionlint_{VERSION}_{system}_{arch}.tar.gz"
base = f"https://github.com/rhysd/actionlint/releases/download/v{VERSION}"
with urlopen(f"{base}/{name}", timeout=60) as response:
    content = response.read()
with urlopen(f"{base}/actionlint_{VERSION}_checksums.txt", timeout=30) as response:
    checksums = {line.split()[1].lstrip("*"): line.split()[0] for line in response.read().decode().splitlines() if line.strip()}
if hashlib.sha256(content).hexdigest() != checksums[name]:
    raise SystemExit("Somme de contrôle actionlint incorrecte.")
executable = "actionlint.exe" if system == "windows" else "actionlint"
with tarfile.open(fileobj=io.BytesIO(content), mode="r:gz") as archive:
    stream = archive.extractfile(executable)
    if stream is None:
        raise SystemExit("Binaire actionlint absent de l’archive.")
    folder = ROOT / ".cache/tools"
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / executable
    target.write_bytes(stream.read())
target.chmod(0o755)
print(f"actionlint {VERSION} installé et vérifié.")
