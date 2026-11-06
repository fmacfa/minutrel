import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
const exec = promisify(execFile);
const films = JSON.parse(await readFile('src/series/catalog.json', 'utf8'));
const ids = process.argv.slice(2).map(Number);
await mkdir('out/series-en/qa-final', { recursive: true });
function wav(b) {
  let fmt, data;
  for (let i = 12; i + 8 <= b.length;) {
    const id = b.toString('ascii', i, i + 4),
      n = b.readUInt32LE(i + 4);
    if (id === 'fmt ')
      fmt = {
        type: b.readUInt16LE(i + 8),
        channels: b.readUInt16LE(i + 10),
        rate: b.readUInt32LE(i + 12),
        bits: b.readUInt16LE(i + 22),
      };
    if (id === 'data') {
      data = b.subarray(i + 8, i + 8 + n);
      break;
    }
    i += 8 + n + (n % 2);
  }
  if (!fmt || !data || fmt.type !== 1 || fmt.bits !== 16) throw new Error('Unsupported QA WAV');
  const stride = fmt.channels * 2,
    frameCount = Math.floor(data.length / stride),
    down = fmt.rate / 12000;
  if (!Number.isInteger(down)) throw new Error('Unexpected sample rate');
  const mono = new Float32Array(Math.floor(frameCount / down));
  let energy = 0,
    peak = 0,
    clipped = 0;
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const x = data.readInt16LE(i * stride + c * 2) / 32768;
      sum += x;
      peak = Math.max(peak, Math.abs(x));
      energy += x * x;
      if (Math.abs(x) > 0.999) clipped++;
    }
    if (i % down === 0 && i / down < mono.length) mono[i / down] = sum / fmt.channels;
  }
  return {
    ...fmt,
    mono,
    peak,
    rms: Math.sqrt(energy / (frameCount * fmt.channels)),
    clipFraction: clipped / (frameCount * fmt.channels),
  };
}
const dot = (a, b) => {
  let ab = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return ab / Math.sqrt(Math.max(1e-12, aa * bb));
};
async function checkAudio(name, clips) {
  const path = `out/series-en/qa-final/${name}-decoded-audio.wav`;
  await exec(
    'npx',
    [
      'remotion',
      'ffmpeg',
      '-y',
      '-v',
      'error',
      '-i',
      `out/series-en/${name}.mp4`,
      '-vn',
      '-c:a',
      'pcm_s16le',
      '-ar',
      '48000',
      '-ac',
      '2',
      path,
    ],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  const mixed = wav(await readFile(path));
  if (mixed.peak < 0.1 || mixed.rms < 0.015 || mixed.clipFraction > 0.00001)
    throw new Error(`${name}: invalid audio level or clipping`);
  const alignment = [];
  for (const clip of clips) {
    const original = wav(await readFile(`public/${clip.file}`));
    const begin = 2400,
      end = Math.min(original.mono.length - 1200, 26400);
    const ref = original.mono.subarray(begin, end);
    const at = Math.round((Math.round(clip.at * 30) / 30) * 12000) + begin;
    let correlation = -1,
      offset = 0;
    for (let delta = -480; delta <= 480; delta += 60) {
      const from = at + delta;
      if (from < 0 || from + ref.length > mixed.mono.length) continue;
      const r = dot(ref, mixed.mono.subarray(from, from + ref.length));
      if (r > correlation) {
        correlation = r;
        offset = delta / 12000;
      }
    }
    if (correlation < 0.72)
      throw new Error(
        `${name}: narration ${clip.id} missing or out of sync (${correlation.toFixed(3)})`,
      );
    alignment.push({
      id: clip.id,
      correlation: Number(correlation.toFixed(4)),
      offsetSeconds: offset,
    });
  }
  let musicRms = 0;
  for (let i = 0; i < clips.length - 1; i++) {
    const a = clips[i].at + clips[i].duration + 0.38,
      b = clips[i + 1].at - 0.2;
    if (b - a < 0.35) continue;
    const samples = mixed.mono.subarray(Math.round(a * 12000), Math.round(b * 12000));
    let power = 0;
    for (const x of samples) power += x * x;
    musicRms = Math.max(musicRms, Math.sqrt(power / samples.length));
  }
  if (musicRms < 0.002) throw new Error(`${name}: background music missing`);
  return {
    peak: mixed.peak,
    rms: mixed.rms,
    clippingFraction: mixed.clipFraction,
    musicGapRms: musicRms,
    narrationAlignment: alignment,
  };
}
const outputs = [];
for (const film of films.filter((f) => !ids.length || ids.includes(f.id))) {
  const name = `minutrel-${String(film.id).padStart(2, '0')}-${film.slug}`,
    duration = film.total,
    clips = film.voice;
  const file = `out/series-en/${name}.mp4`;
  const { stdout } = await exec('npx', [
    'remotion',
    'ffprobe',
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels,nb_frames',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    file,
  ]);
  const meta = JSON.parse(stdout),
    video = meta.streams.filter((s) => s.codec_type === 'video'),
    audio = meta.streams.filter((s) => s.codec_type === 'audio');
  if (
    video.length !== 1 ||
    audio.length !== 1 ||
    video[0].codec_name !== 'h264' ||
    video[0].width !== 1920 ||
    video[0].height !== 1080 ||
    video[0].r_frame_rate !== '30/1' ||
    audio[0].codec_name !== 'aac' ||
    audio[0].channels !== 2 ||
    Math.abs(Number(meta.format.duration) - duration) > 0.06
  )
    throw new Error(`Invalid ${name} metadata`);
  await exec(
    'npx',
    [
      'remotion',
      'ffmpeg',
      '-v',
      'error',
      '-i',
      file,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '40',
      '-an',
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  const audioCheck = await checkAudio(name, clips);
  outputs.push({ file, bytes: (await stat(file)).size, ...meta, decode: 'passed', audioCheck });
  console.log(
    `Verified ${name}: ${duration.toFixed(2)}s, Full HD 30fps, AAC stereo, ${clips.length} voice clips aligned, background music present, no clipping`,
  );
}
await writeFile(
  `out/series-en/verification${ids.length ? '-' + ids.join('-') : ''}.json`,
  JSON.stringify({ checkedAt: new Date().toISOString(), outputs }, null, 2) + '\n',
);
