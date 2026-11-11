import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';
import { films, clipsFor } from './story.mjs';

const directory = 'public/audio/updates-en';
const manifest = '.cache/updates-voices.json';
const voice = 'af_heart';
const speed = 0.98;
env.cacheDir = resolve('.cache/kokoro-models');
await mkdir(directory, { recursive: true });
let cache = {};
try {
  cache = JSON.parse(await readFile(manifest, 'utf8'));
} catch {}
let tts;

function wave(samples) {
  const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(24000, 24);
  buffer.writeUInt32LE(48000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round((32767 * samples[i] * 0.83) / Math.max(0.1, peak)), 44 + 2 * i);
  }
  return buffer;
}

for (const film of films) {
  for (const step of clipsFor(film)) {
    for (const [index, text] of step.cues.entries()) {
      const id = `${film.id}-${step.key}-${index + 1}`;
      const file = `${directory}/${id}.wav`;
      const hash = createHash('sha256').update(`${voice}:${speed}:${text}`).digest('hex');
      if (
        cache[id]?.hash === hash &&
        (await access(file).then(
          () => true,
          () => false,
        ))
      )
        continue;
      tts ??= await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'cpu',
      });
      const spoken = text
        .replace(/\bCSV\b/g, 'C S V')
        .replace(/\bPDF\b/g, 'P D F')
        .replace(/\bZIP\b/g, 'zip');
      const { audio } = await tts.generate(spoken, { voice, speed });
      let start = 0,
        end = audio.length - 1;
      while (start < end && Math.abs(audio[start]) < 0.001) start++;
      while (end > start && Math.abs(audio[end]) < 0.001) end--;
      const samples = audio.slice(Math.max(0, start - 1440), Math.min(audio.length, end + 2880));
      await writeFile(file, wave(samples));
      cache[id] = {
        hash,
        text,
        file: file.slice('public/'.length),
        duration: samples.length / 24000,
      };
      await writeFile(manifest, JSON.stringify(cache, null, 2) + '\n');
      console.log(`${id}: ${cache[id].duration.toFixed(2)} s`);
    }
  }
}
