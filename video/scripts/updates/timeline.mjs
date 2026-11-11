import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { films, clipsFor, release } from './story.mjs';

const fps = 30;
const output = 'out/updates-en';
const voices = JSON.parse(await readFile('.cache/updates-voices.json', 'utf8'));
await mkdir(output, { recursive: true });
await mkdir('src/updates', { recursive: true });
const stamp = (seconds) => {
  const n = Math.round(seconds * 1000);
  const time = [Math.floor(n / 3600000), Math.floor(n / 60000) % 60, Math.floor(n / 1000) % 60];
  return (
    time.map((x) => String(x).padStart(2, '0')).join(':') + ',' + String(n % 1000).padStart(3, '0')
  );
};
const wrap = (text) => {
  const lines = [''];
  for (const word of text.split(' ')) {
    if (lines.at(-1).length + word.length + 1 > 44) lines.push(word);
    else lines[lines.length - 1] = (lines.at(-1) + ' ' + word).trim();
  }
  return lines.join('\n');
};

const result = [];
for (const film of films) {
  const capture = JSON.parse(await readFile(`public/captures/updates-en/${film.id}.json`, 'utf8'));
  if (capture.release !== release || capture.viewport.join('x') !== '1440x900')
    throw new Error(`Capture mismatch for ${film.id}`);
  let atFrame = 0;
  const voice = [],
    scenes = [];
  for (const [index, step] of clipsFor(film).entries()) {
    let localFrame = 6;
    for (const [cueIndex, text] of step.cues.entries()) {
      const id = `${film.id}-${step.key}-${cueIndex + 1}`;
      const { file, duration, text: voiceText } = voices[id];
      if (voiceText !== text) throw new Error(`Regenerate voice ${id}`);
      await access(`public/${file}`);
      voice.push({ id, file, at: (atFrame + localFrame) / fps, duration, text });
      localFrame += Math.ceil(duration * fps) + 7;
    }
    const marker = capture.markers.find((item) => item.key === step.key);
    const cover = step.key === 'intro' || step.key === 'outro';
    if (!cover && !marker) throw new Error(`Missing recorded scene ${film.id}/${step.key}`);
    const length = marker
      ? Math.floor(marker.length * fps)
      : Math.max(step.key === 'intro' ? 114 : 125, localFrame + 16);
    if (length < localFrame + 7)
      throw new Error(`Capture too short for narration in ${film.id}/${step.key}`);
    if (marker) await access(`public/${marker.file}`);
    scenes.push({
      key: step.key,
      title: step.title ?? '',
      role: step.role ?? '',
      atFrame,
      length,
      step: index,
      layout: step.key === 'approve' ? 'fit' : (marker?.layout ?? 'cover'),
      source: marker?.file ?? '',
      trim: marker?.trim ?? 0,
    });
    atFrame += length;
  }
  result.push({
    id: film.id,
    slug: film.slug,
    composition: film.composition,
    title: film.title,
    shortTitle: film.shortTitle,
    summary: film.summary,
    icon: film.icon,
    total: atFrame / fps,
    durationInFrames: atFrame,
    scenes,
    voice,
  });
  const srt = voice
    .map(
      (cue, i) =>
        `${i + 1}\n${stamp(cue.at)} --> ${stamp(cue.at + cue.duration)}\n${wrap(cue.text)}\n`,
    )
    .join('\n');
  await writeFile(`${output}/minutrel-${film.id}-${film.slug}.srt`, srt);
  console.log(`${film.id}: ${(atFrame / fps).toFixed(2)} seconds; ${voice.length} caption cues`);
}
await writeFile('src/updates/catalog.json', JSON.stringify(result, null, 2) + '\n');
