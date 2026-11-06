#!/usr/bin/env python3
"""Refresh the public documentation snapshot from an explicit Minutrel checkout."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project-root', required=True, type=Path)
args = parser.parse_args()
root = args.project_root.resolve()
site = Path(__file__).resolve().parent
content = site / 'src' / 'content'
assets = site / 'src' / 'assets'
downloads = site / 'src' / 'downloads'
for folder in (content, assets, downloads):
    folder.mkdir(parents=True, exist_ok=True)
excluded = {'node_modules', 'target', 'dist', '.git', '.cache', '.venv', 'data', 'backups', 'gen', '__pycache__', 'coverage'}
roots = ['docs', 'infra', 'examples', 'apps', 'packages', 'scripts', 'tests', 'brand', '.github']
extensions = {'.md', '.ts', '.tsx', '.mjs', '.js', '.json', '.toml', '.lock', '.rs', '.yml', '.yaml', '.conf', '.html', '.css', '.svg', '.png', '.jpg', '.jpeg', '.ttf', '.txt', '.ico', '.icns', '.py', '.sh', '.sql'}
fixed = ['README.md', 'LICENSE', 'LICENSING.md', 'SECURITY.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'package.json', 'package-lock.json', 'compose.yml', '.env.example', '.dockerignore', '.gitignore', '.gitattributes', '.editorconfig', '.node-version', '.nvmrc', '.prettierignore', '.prettierrc.json', 'eslint.config.mjs', 'tsconfig.json', 'vitest.config.ts', 'requirements-brand.txt', 'rust-toolchain.toml']
files = [root / name for name in fixed if (root / name).is_file()]
for name in roots:
    for file in (root / name).rglob('*'):
        if file.is_symlink() or not file.is_file() or any(part in excluded for part in file.relative_to(root).parts):
            continue
        if file.suffix.lower() in extensions or file.name in {'Dockerfile', 'LICENSE', 'Cargo.lock', 'CODEOWNERS'}:
            files.append(file)
files = sorted(set(files))
with zipfile.ZipFile(downloads / 'minutrel-0.1.0-sources.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, Path('minutrel-0.1.0') / file.relative_to(root))
for file in files:
    rel = file.relative_to(root)
    if file.suffix.lower() == '.md':
        target = content / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, target)
    # Keep exact, non-generated reference files for links in the documentation.
    elif file.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.ttf', '.ico', '.icns'}:
        target = assets / 'reference' / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, target)
for name in ['screenshots']:
    shutil.copytree(root / 'docs' / name, assets / name, dirs_exist_ok=True)
shutil.copytree(root / 'brand' / 'assets' / 'logos', assets / 'logos', dirs_exist_ok=True)
shutil.copytree(root / 'brand' / 'assets' / 'icons', assets / 'icons', dirs_exist_ok=True)
(assets / 'fonts').mkdir(exist_ok=True)
for name in ['Manrope-Variable.ttf', 'OFL.txt']:
    shutil.copy2(root / 'brand' / 'fonts' / name, assets / 'fonts' / name)
shutil.copy2(root / 'brand' / 'assets' / 'social-preview.png', assets / 'social-preview.png')
for name in ['minutrel-charte-graphique.pdf', 'minutrel-rapport-demo-2026-11.pdf']:
    file = root / 'output' / 'pdf' / name
    if file.exists(): shutil.copy2(file, downloads / name)
shutil.copy2(root / 'LICENSE', downloads / 'LICENSE.txt')
shutil.copy2(root / 'compose.yml', downloads / 'compose.yml')
shutil.copy2(root / '.env.example', downloads / 'env.example.txt')
package = root / 'apps' / 'desktop' / 'src-tauri' / 'target' / 'release' / 'bundle' / 'dmg' / 'Minutrel_0.1.0_aarch64.dmg'
manifest = {'version':'0.1.0', 'snapshot':'2026-11-06', 'source_files':len(files)}
if package.is_file():
    shutil.copy2(package, downloads / package.name)
    manifest['macos'] = {'filename':package.name,'bytes':package.stat().st_size,'sha256':hashlib.sha256(package.read_bytes()).hexdigest()}
(content / 'snapshot.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'Documentation synchronisée ; {len(files)} fichiers de sources, aucun dossier de données ou de construction.')
