import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';
import { presentation, tutorial } from './story-en-v2.mjs';

env.cacheDir = resolve('.cache/kokoro-models');
const audioDir = 'public/audio/en-v2';
await mkdir(audioDir, { recursive: true });
const cachePath = resolve('.cache/voice-en-v2.json');
let cached = {};
try {
  cached = JSON.parse(await readFile(cachePath, 'utf8'));
} catch {}
console.log('Loading local Kokoro speech model (English voice Heart)');
let last = -1;
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
  progress_callback: (p) => {
    if (p.status === 'progress' && p.file?.includes('.onnx')) {
      const percent = Math.floor((p.progress ?? 0) / 20);
      if (percent > last) {
        last = percent;
        console.log(`Speech model download: ${percent * 20}%`);
      }
    }
  },
});
const wav = (samples, sr) => {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  const gain = 0.86 / Math.max(0.1, peak);
  for (let i = 0; i < samples.length; i++)
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * 32767), 44 + i * 2);
  return b;
};
const results = {
  presentation: [],
  tutorial: [],
  model: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  voice: 'af_heart',
  sampleRate: 24000,
};
for (const [kind, lines] of [
  ['presentation', presentation],
  ['tutorial', tutorial],
])
  for (const line of lines) {
    const speed = line.speed ?? 0.92;
    const hash = createHash('sha256')
      .update(JSON.stringify({ text: line.text, speed, voice: 'af_heart' }))
      .digest('hex');
    const file = `${audioDir}/${line.id}.wav`;
    let item = cached[line.id];
    let exists = false;
    try {
      await access(file);
      exists = true;
    } catch {}
    if (!exists || item?.hash !== hash) {
      const audio = await tts.generate(line.text, { voice: 'af_heart', speed });
      const samples = audio.audio;
      let first = 0,
        lastSample = samples.length - 1;
      while (first < samples.length && Math.abs(samples[first]) < 0.001) first++;
      while (lastSample > first && Math.abs(samples[lastSample]) < 0.001) lastSample--;
      first = Math.max(0, first - 1920);
      lastSample = Math.min(samples.length, lastSample + 3600);
      const clean = samples.slice(first, lastSample);
      await writeFile(file, wav(clean, 24000));
      item = { hash, duration: clean.length / 24000 };
      cached[line.id] = item;
      await writeFile(cachePath, JSON.stringify(cached, null, 2));
    }
    results[kind].push({
      ...line,
      file: file.replace('public/', ''),
      duration: item.duration,
      speed,
    });
    console.log(`Voice ${line.id}: ${item.duration.toFixed(2)} s`);
    if (kind === 'presentation' && line.at + item.duration > line.until - 0.08)
      throw new Error(`Presentation narration ${line.id} exceeds its scene`);
  }
await writeFile('src/voice-en-v2.json', JSON.stringify(results, null, 2) + '\n');
console.log('English narration ready');
