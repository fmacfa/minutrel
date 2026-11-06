import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { presentation } from './story-en-v2.mjs';
const voice = JSON.parse(await readFile('src/voice-en-v2.json', 'utf8'));
voice.presentation = voice.presentation.map((v, i) => ({ ...v, ...presentation[i] }));
await writeFile('src/voice-en-v2.json', JSON.stringify(voice, null, 2) + '\n');
const durations = Object.fromEntries(voice.tutorial.map((v) => [v.id, v.duration * 1000]));
const hold = (id, extra = 450) => Math.ceil(durations[id] + extra);
const role = (role, name) => ({ role, name, exact: true });
const button = (name) => role('button', name);
const click = (name, label, afterMs) => ({ type: 'click', target: button(name), label, afterMs });
const screen = (name) => ({ type: 'screenshot', path: `public/stills/en-v2/${name}.png` });
const config = {
  url: 'http://127.0.0.1:8086',
  output: 'public/captures/minutrel-tutorial-en-v2.webm',
  viewport: { width: 1440, height: 900 },
  locale: 'en-GB',
  timezoneId: 'Europe/Paris',
  storageState: '.cache/session-en-v2.json',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  readyTarget: button('Start'),
  initialWaitMs: 1000,
  finalWaitMs: 850,
  cursor: true,
  actions: [
    click('Projects', 'Projects', hold('projects')),
    screen('projects'),
    click('Overview', 'Choose', 900),
    {
      type: 'select',
      target: role('combobox', 'Project to track'),
      optionLabel: 'Atlas',
      afterMs: 650,
    },
    {
      type: 'select',
      target: role('combobox', 'Optional task'),
      optionLabel: 'Design & art direction',
      afterMs: Math.max(1600, hold('choose') - 2400),
    },
    {
      type: 'type',
      target: role('textbox', 'Work description'),
      value: 'Prepare mockups for Atlas',
      typeDelayMs: 42,
      label: 'Describe',
      afterMs: Math.max(2200, hold('describe') - 1300),
    },
    screen('ready'),
    click('Start', 'Start', hold('start', 1800)),
    screen('timer'),
    click('Pause', 'Pause', hold('pause', 800)),
    click('Resume', 'Resume', hold('resume', 800)),
    click('Finish', 'Finish', hold('finish', 650)),
    click('Time entries', 'History', hold('history', 700)),
    screen('history'),
    click('Add time', 'Manual', 1100),
    {
      type: 'fill',
      target: { selector: "dialog input[name='duration']" },
      value: '45 min',
      afterMs: 1400,
      label: 'Duration',
    },
    {
      type: 'type',
      target: { selector: "dialog textarea[name='description']" },
      value: 'Prepare the Atlas team meeting',
      typeDelayMs: 35,
      afterMs: Math.max(2600, hold('manual') - 4400),
    },
    screen('manual'),
    click('Add this time entry', 'SaveTime', hold('save-time', 600)),
    click('Work journal', 'Journal', hold('journal', 650)),
    click('Add a note', 'Note', 850),
    {
      type: 'type',
      target: role('textbox', 'Work completed'),
      value:
        'Atlas mockups are ready. Navigation is clearer. Next: review the proposals with the team.',
      typeDelayMs: 26,
      afterMs: Math.max(2200, hold('note') - 3400),
      label: 'NoteText',
    },
    { type: 'wait', ms: 2200, label: 'Share' },
    { type: 'click', target: role('checkbox', 'Share this note in team reports'), afterMs: 1500 },
    screen('note'),
    click('Save', 'SaveNote', Math.max(1400, hold('share') - 3500)),
    click('Reports', 'Reports', hold('reports', 650)),
    screen('report'),
    {
      type: 'hover',
      target: { selector: "main input[type='month']" },
      afterMs: 1500,
      label: 'Period',
    },
    { type: 'click', target: { selector: 'main .member-filter > summary' }, afterMs: 2400 },
    {
      type: 'click',
      target: { selector: 'main .member-filter > summary' },
      afterMs: Math.max(1400, hold('period') - 4500),
    },
    click('PDF', 'Export', hold('export', 700)),
    { type: 'move', x: 1180, y: 650, durationMs: 500, afterMs: 600, label: 'End' },
  ],
};
await mkdir('public/stills/en-v2', { recursive: true });
await writeFile('capture.en-v2.config.json', JSON.stringify(config, null, 2) + '\n');
console.log('English capture configured from narration durations');
