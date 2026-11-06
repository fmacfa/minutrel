import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
const films = JSON.parse(await readFile('src/series/voices.json', 'utf8'));
await mkdir('out/series-en', { recursive: true });
const native = {
  3: {
    start: ['03-ready', '03-main'],
    open: ['03-widget-running'],
    pause: ['03-widget-paused', '03-widget-resumed'],
    finish: ['03-widget-saved'],
  },
  4: {
    local: ['04-auth', '04-local'],
    project: ['04-project-form', '04-project'],
    track: ['04-tracking', '04-paused'],
    report: ['04-report-final', '04-settings'],
  },
  9: {
    online: ['09-online'],
    disconnect: ['09-disconnected'],
    record: ['09-paused', '09-offline-finished'],
    sync: ['09-sync-settings', '09-synced'],
  },
  10: {
    prepare: ['10-prepare'],
    read: ['10-team-settings', '10-transfer-tool', '10-projects'],
    map: ['10-mapping'],
    send: ['10-sent', '10-history'],
  },
};
const crops = {
  3: { start: 80 },
  4: { local: 20, project: 90, track: 90, report: 80 },
  5: { member: 150, roles: 130, project: 130 },
  6: { add: 125, save: 60, edit: 170, audit: 60 },
  7: { period: 95, people: 95, context: 330, export: 95 },
  8: { note: 120, privacy: 120, draft: 165, approve: 155 },
  9: { online: 80, disconnect: 35, record: 35, sync: 35 },
  10: { prepare: 40, read: 110, map: 120, send: 90 },
  11: { access: 130, scope: 145, configure: 250, revoke: 75, engines: 35 },
  12: { setup: 50, team: 65 },
};
const catalog = [];
for (const film of films) {
  let time = 0,
    ready = true;
  const scenes = [],
    voice = [];
  let capture;
  try {
    capture = JSON.parse(
      await readFile(`public/captures/series-en/${String(film.id).padStart(2, '0')}.json`, 'utf8'),
    );
  } catch {}
  for (const [i, step] of film.steps.entries()) {
    const intro = step.key === 'intro',
      outro = step.key === 'outro';
    let visual = intro ? 'intro' : outro ? 'outro' : (step.visual ?? 'capture'),
      shots = [],
      source,
      trim = 0;
    let duration = Math.ceil((step.duration + (intro || outro ? 0.85 : 1.05)) * 30) / 30;
    if (!intro && !outro && native[film.id]) {
      visual = film.id === 3 && step.key !== 'start' ? 'mini' : 'native';
      shots = (native[film.id][step.key] ?? []).map((s) => `stills/series-en/${s}.png`);
      if (!shots.length) ready = false;
      for (const path of shots) {
        try {
          await access('public/' + path);
        } catch {
          ready = false;
        }
      }
    } else if (visual === 'capture') {
      const marker = capture?.markers.find((m) => m.key === step.key);
      if (!marker) {
        ready = false;
      } else {
        const next = capture.markers[capture.markers.indexOf(marker) + 1];
        const span = ((next?.ms ?? capture.usableDurationMs) - marker.ms) / 1000;
        duration = Math.max(duration, Math.floor(span * 30) / 30);
        source = `captures/series-en/${String(film.id).padStart(2, '0')}.webm`;
        trim = (capture.trimStartMs + marker.ms) / 1000;
      }
    }
    scenes.push({
      ...step,
      visual,
      shots,
      source,
      trim,
      at: time,
      length: duration,
      crop: crops[film.id]?.[step.key] ?? 80,
      index: i,
      count: film.steps.length - 2,
    });
    voice.push({
      id: step.id,
      file: step.file,
      text: step.text,
      duration: step.duration,
      at: time + 0.12,
    });
    time += duration;
  }
  const data = { ...film, scenes, voice, total: Math.round(time * 30) / 30, ready };
  catalog.push(data);
  const stamp = (seconds) => {
    const n = Math.round(seconds * 1000);
    return `${String(Math.floor(n / 3600000)).padStart(2, '0')}:${String(Math.floor(n / 60000) % 60).padStart(2, '0')}:${String(Math.floor(n / 1000) % 60).padStart(2, '0')},${String(n % 1000).padStart(3, '0')}`;
  };
  await writeFile(
    `out/series-en/minutrel-${String(film.id).padStart(2, '0')}-${film.slug}.srt`,
    voice
      .map((v, i) => `${i + 1}\n${stamp(v.at)} --> ${stamp(v.at + v.duration)}\n${v.text}\n`)
      .join('\n'),
  );
  console.log(film.id, ready ? 'READY' : 'PENDING', data.total.toFixed(2), film.shortTitle);
}
await writeFile('src/series/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
