import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';
import { films } from './story-series.mjs';
env.cacheDir = resolve('.cache/kokoro-models');
await mkdir('public/audio/series-en', { recursive: true });
await mkdir('src/series', { recursive: true });
let cache = {};
try {
  cache = JSON.parse(await readFile('.cache/voice-series.json', 'utf8'));
} catch {}
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
});
function wav(samples) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const g = 0.86 / Math.max(0.1, peak);
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF');
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++)
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * g)) * 32767), 44 + i * 2);
  return b;
}
const result = [];
for (const film of films) {
  const steps = [];
  for (const line of [
    { key: 'intro', text: film.intro },
    ...film.steps,
    { key: 'outro', text: film.outro },
  ]) {
    const id = `${String(film.id).padStart(2, '0')}-${line.key}`,
      file = `public/audio/series-en/${id}.wav`,
      hash = createHash('sha256')
        .update(line.text + '0.92-af_heart')
        .digest('hex');
    let previous = cache[id],
      exists = false;
    try {
      await access(file);
      exists = true;
    } catch {}
    if (!exists || previous?.hash !== hash) {
      const audio = await tts.generate(line.text, { voice: 'af_heart', speed: 0.92 });
      let start = 0,
        end = audio.audio.length - 1;
      while (start < end && Math.abs(audio.audio[start]) < 0.001) start++;
      while (end > start && Math.abs(audio.audio[end]) < 0.001) end--;
      const samples = audio.audio.slice(
        Math.max(0, start - 1920),
        Math.min(audio.audio.length, end + 3600),
      );
      await writeFile(file, wav(samples));
      previous = { hash, duration: samples.length / 24000 };
      cache[id] = previous;
      await writeFile('.cache/voice-series.json', JSON.stringify(cache, null, 2));
    }
    steps.push({ ...line, id, file: file.replace('public/', ''), duration: previous.duration });
    console.log(`Voice ${id}: ${previous.duration.toFixed(2)}s`);
  }
  result.push({ ...film, steps });
  await writeFile('src/series/voices.json', JSON.stringify(result, null, 2) + '\n');
}
console.log(`Narration ready for ${result.length} videos`);
