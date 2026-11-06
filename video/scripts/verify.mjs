import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, stat } from 'node:fs/promises';
const exec = promisify(execFile);
const timing = JSON.parse(await readFile('src/timing.json', 'utf8'));
const outputs = [];
for (const [file, expected] of [
  ['minutrel-presentation.mp4', 40],
  ['minutrel-fonctionnement.mp4', timing.duration + 17],
]) {
  const path = `out/${file}`;
  const { stdout } = await exec(
    'npx',
    [
      'remotion',
      'ffprobe',
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,nb_frames',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      path,
    ],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  const meta = JSON.parse(stdout);
  const videos = meta.streams.filter((s) => s.codec_type === 'video');
  if (videos.length !== 1 || meta.streams.some((s) => s.codec_type === 'audio'))
    throw new Error(`${file}: unexpected streams`);
  const v = videos[0];
  if (
    v.codec_name !== 'h264' ||
    v.width !== 1920 ||
    v.height !== 1080 ||
    v.r_frame_rate !== '30/1' ||
    v.pix_fmt !== 'yuv420p' ||
    Math.abs(Number(meta.format.duration) - expected) > 0.05
  )
    throw new Error(`${file}: unexpected metadata`);
  await exec('npx', ['remotion', 'ffmpeg', '-v', 'error', '-i', path, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '40', '-an', '-f', 'null', '-'], {
    maxBuffer: 2 * 1024 * 1024,
  });
  outputs.push({
    file,
    bytes: (await stat(path)).size,
    expectedSeconds: expected,
    ...meta,
    fullDecode: 'passed',
    audio: 'absent',
  });
  console.log(
    `Verified: ${file} (${meta.format.duration} s, ${v.width}x${v.height}, ${v.r_frame_rate}, H.264, no audio)`,
  );
}
await writeFile(
  'out/verification.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), outputs }, null, 2) + '\n',
);
