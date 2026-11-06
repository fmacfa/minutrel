#!/usr/bin/env python3
"""Recette destructive réservée à une instance CI jetable : API, SQLite, SSE, MCP et exports."""
import json
import sys
import uuid
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from zoneinfo import ZoneInfo

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8080').rstrip('/')
reuse = '--reuse' in sys.argv
credential = ''

def call(path, data=None, method=None, accept='application/json'):
    headers = {'Accept': accept, 'Idempotency-Key': str(uuid.uuid4())}
    if credential:
        headers['Authorization'] = 'Bearer ' + credential
    payload = None if data is None else json.dumps(data).encode()
    if payload is not None:
        headers['Content-Type'] = 'application/json'
    return urlopen(Request(base + path, data=payload, headers=headers, method=method), timeout=20)

def api(path, data=None, method=None):
    with call('/api/v1' + path, data, method) as response:
        return json.load(response)

assert api('/instance') == {'name': 'Minutrel', 'api_version': 'v1', 'version': '0.1.0'}
assert api('/health/live') == {'status': 'ok'}
assert api('/health/ready') == {'status': 'ok'}
with call('/') as response:
    assert 'Minutrel' in response.read().decode('utf-8')
    assert response.headers.get('Content-Security-Policy'), 'CSP absente de la page web.'

password = 'Validation-CI-instance-jetable-2026'
if reuse:
    assert not api('/setup')['required']
    login = api('/auth/login', {'email': 'ci@minutrel.test', 'password': password, 'native': True})
else:
    assert api('/setup')['required'], 'La recette exige une base CI vierge.'
    login = api('/setup', {'setupToken': 'installation-ci-sans-donnees-reelles', 'workspaceName': 'Recette CI', 'name': 'Compte de test', 'email': 'ci@minutrel.test', 'password': password, 'timezone': 'Europe/Paris', 'native': True})
credential = login['token']
month = datetime.now(timezone.utc).astimezone(ZoneInfo('Europe/Paris')).strftime('%Y-%m')
work_date = datetime.now(timezone.utc).astimezone(ZoneInfo('Europe/Paris')).strftime('%Y-%m-%d')
if reuse:
    assert api('/reports/monthly?month=' + month)['totalSeconds'] >= 5400
    assert len(api('/projects')) == 1
    print('OK — données et comptes retrouvés après redémarrage du conteneur.')
    sys.exit(0)

project = api('/projects', {'name': 'Projet de recette', 'memberIds': [login['member']['id']]})
manual = api('/time-entries', {'projectId': project['id'], 'kind': 'duration', 'description': 'Saisie de recette', 'duration': '1h30', 'workDate': work_date})
assert manual['seconds'] == 5400
started = api('/timer/start', {'projectId': project['id']})
assert api('/timer')['timer']['id'] == started['id']
paused = api('/timer/pause', {'version': 1})
stopped = api('/timer/stop', {'version': paused['version']})
report = api('/reports/monthly?month=' + month)
assert report['totalSeconds'] == 5400 + stopped['seconds']
for format_name, mime in [('csv', 'text/csv'), ('pdf', 'application/pdf'), ('zip', 'application/zip')]:
    export = api('/exports', {'month': month, 'format': format_name})
    with call(export['url']) as response:
        content = response.read()
        assert response.headers['Content-Type'].startswith(mime)
        assert content
        if format_name == 'pdf':
            assert content.startswith(b'%PDF-')
assert api('/workspace/export')['schema_version'] == 2
with call('/api/v1/events', accept='text/event-stream') as response:
    assert response.headers['Content-Type'].startswith('text/event-stream')
    assert b'event: connected' in response.readline()

mcp_token = api('/mcp-tokens', {'name': 'Agent CI', 'scopes': ['time.read_own']})['token']
credential = mcp_token
accept = 'application/json, text/event-stream'
with call('/mcp', {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-11-25', 'capabilities': {}, 'clientInfo': {'name': 'minutrel-ci', 'version': '1'}}}, accept=accept) as response:
    assert json.load(response)['result']['serverInfo']['name'] == 'minutrel'
with call('/mcp', {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}}, accept=accept) as response:
    names = {tool['name'] for tool in json.load(response)['result']['tools']}
    assert names == {'minutrel_get_my_timer', 'minutrel_list_my_times'}
try:
    api('/members')
except HTTPError as error:
    assert error.code == 401
else:
    raise AssertionError('Un jeton MCP ne doit pas ouvrir les routes REST.')
print('OK — web, comptes, temps partagés, rapports, exports, SSE et MCP vérifiés.')
