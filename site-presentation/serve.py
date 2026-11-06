#!/usr/bin/env python3
"""Serve the local FR/EN website on loopback only; no account required."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
import threading
import webbrowser

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--language', choices=['fr','en'], default='fr')
parser.add_argument('--port', type=int, default=4175)
parser.add_argument('--no-open', action='store_true')
args = parser.parse_args()
if not 0 <= args.port <= 65535:
    parser.error('Port must be between 0 and 65535.')
if not (root/'dist'/'index.html').is_file():
    subprocess.run([sys.executable, str(root/'build.py')], cwd=root, check=True)
handler = partial(SimpleHTTPRequestHandler, directory=str(root/'dist'))
try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
except OSError as error:
    raise SystemExit(f'Impossible de lancer le site / Cannot start the site: {error}. Try --port 4176.')
origin = f'http://127.0.0.1:{server.server_port}'
url = origin + ('/en/' if args.language == 'en' else '/')
print(f'Français : {origin}/\nEnglish  : {origin}/en/\nLocal uniquement / Local only. Ctrl+C pour arrêter / to stop.', flush=True)
if not args.no_open:
    threading.Timer(0.25, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
