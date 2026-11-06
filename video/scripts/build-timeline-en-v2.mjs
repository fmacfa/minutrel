import { readFile, writeFile } from 'node:fs/promises';
import { presentationSeconds } from './story-en-v2.mjs';
const capture = JSON.parse(await readFile('public/captures/minutrel-tutorial-en-v2.json', 'utf8'));
const voice = JSON.parse(await readFile('src/voice-en-v2.json', 'utf8'));
const markers = Object.fromEntries(capture.markers.map((m) => [m.label, m.ms / 1000]));
const intro = Math.ceil((voice.tutorial.find((v) => v.id === 'intro').duration + 0.65) * 30) / 30;
const outro = Math.ceil((voice.tutorial.find((v) => v.id === 'outro').duration + 0.85) * 30) / 30;
const duration = Math.floor((capture.usableDurationMs / 1000) * 30) / 30;
const tutorialVoice = voice.tutorial.map((v) => ({
  ...v,
  at:
    v.id === 'intro'
      ? 0.2
      : v.id === 'outro'
        ? intro + duration + 0.2
        : intro + markers[v.marker] + 0.07,
}));
for (let i = 0; i < tutorialVoice.length - 1; i++) {
  const a = tutorialVoice[i],
    b = tutorialVoice[i + 1];
  if (a.at + a.duration > b.at - 0.08)
    throw new Error(
      `Voice overlaps: ${a.id} -> ${b.id} (${(a.at + a.duration - b.at).toFixed(3)}s)`,
    );
}
const data = {
  trim: capture.trimStartMs / 1000,
  duration,
  intro,
  outro,
  total: intro + duration + outro,
  presentationSeconds,
  markers,
  voice: tutorialVoice,
};
await writeFile('src/timing-en-v2.json', JSON.stringify(data, null, 2) + '\n');
const stamp = (s) => {
  const ms = Math.round(s * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
for (const [name, clips] of [
  ['presentation', voice.presentation],
  ['tutorial', tutorialVoice],
]) {
  const srt = clips
    .map((v, i) => `${i + 1}\n${stamp(v.at)} --> ${stamp(v.at + v.duration)}\n${v.text}\n`)
    .join('\n');
  await writeFile(`out/minutrel-${name}-en-v2.srt`, srt);
}
console.log({
  presentation: presentationSeconds,
  tutorial: data.total,
  capture: duration,
  voiceClips: tutorialVoice.length,
});
