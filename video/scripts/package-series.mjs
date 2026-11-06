import { readFile, writeFile, mkdir, copyFile, stat, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile),
  root = 'out/series-en';
const films = JSON.parse(await readFile('src/series/catalog.json', 'utf8'));
const verification = JSON.parse(await readFile(`${root}/verification.json`, 'utf8'));
if (verification.count !== 10 || verification.outputs.length !== 10)
  throw new Error('All ten exports must pass verification before packaging');
await mkdir(`${root}/posters`, { recursive: true });
await copyFile('public/brand/minutrel-primary.svg', `${root}/minutrel.svg`);
const files = ['index.html', 'README.txt', 'collection.json', 'SHA256SUMS.txt', 'minutrel.svg'];
const collection = [];
for (const film of films) {
  const n = String(film.id).padStart(2, '0'),
    stem = `minutrel-${n}-${film.slug}`,
    file = stem + '.mp4',
    meta = await stat(`${root}/${file}`);
  const check = verification.outputs.find((o) => o.file === `${root}/${file}`);
  if (
    !check ||
    check.bytes !== meta.size ||
    new Date(verification.checkedAt).getTime() < meta.mtimeMs
  )
    throw new Error('Export changed after verification: ' + file);
  await copyFile(`${root}/qa/${n}-intro.png`, `${root}/posters/${n}.png`);
  const srt = await readFile(`${root}/${stem}.srt`, 'utf8');
  const cues = srt.trim().split(/\n\s*\n/);
  if (cues.length !== film.voice.length) throw new Error('Subtitle cue count changed: ' + stem);
  const seconds = (s) => {
    const [h, m, rest] = s.split(':');
    return Number(h) * 3600 + Number(m) * 60 + Number(rest.replace(',', '.'));
  };
  for (const [i, cue] of cues.entries()) {
    const lines = cue.split('\n'),
      [start, end] = lines[1].split(' --> '),
      voice = film.voice[i];
    if (
      Math.abs(seconds(start) - voice.at) > 0.002 ||
      Math.abs(seconds(end) - voice.at - voice.duration) > 0.002 ||
      seconds(end) > film.total ||
      lines.slice(2).join('\n').trim() !== voice.text
    ) {
      throw new Error('Subtitle content or timing changed: ' + stem);
    }
  }
  await writeFile(
    `${root}/${stem}.vtt`,
    'WEBVTT\n\n' + srt.replace(/(\d\d:\d\d:\d\d),(\d{3})/g, '$1.$2'),
  );
  collection.push({
    id: film.id,
    title: film.shortTitle,
    description: film.intro,
    duration: film.total,
    durationLabel: `${Math.floor(Math.round(film.total) / 60)}:${String(Math.round(film.total) % 60).padStart(2, '0')}`,
    file,
    srt: stem + '.srt',
    vtt: stem + '.vtt',
    poster: `posters/${n}.png`,
    bytes: meta.size,
  });
  files.push(file, stem + '.srt', stem + '.vtt', `posters/${n}.png`);
}
await writeFile(
  `${root}/collection.json`,
  JSON.stringify(
    {
      title: 'Minutrel — English video guides',
      language: 'en',
      video: 'H.264, 1920×1080, 16:9, 30 fps',
      audio: 'AAC stereo, English narration and original music',
      captions: 'English captions in the picture; separate SRT and WebVTT files',
      videos: collection,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  `${root}/README.txt`,
  [
    'MINUTREL — ENGLISH VIDEO GUIDES',
    '',
    'Open index.html to choose a video, or open any MP4 directly.',
    'All videos: Full HD 1920×1080, 16:9, 30 fps, H.264 + AAC stereo.',
    'English synthetic narration, original background music and English captions.',
    'SRT and WebVTT subtitle files are supplied for editing and reuse.',
    '',
    ...collection.map((v) => `${String(v.id).padStart(2, '0')}  ${v.title}  (${v.durationLabel})`),
    '',
    'The application recordings use fictional demonstration data.',
    'Desktop chapters use real desktop screenshots arranged as narrated steps.',
    'The installation guide includes example HTTPS configuration.',
    'The optional AI provider form is demonstrated without generating AI output.',
    '',
    'The editable Remotion project and reproduction notes are in the video/ workspace.',
    'SHA256SUMS.txt contains checksums for the MP4 and subtitle files.',
    '',
  ].join('\n'),
);
const data = JSON.stringify(collection).replaceAll('<', '\\u003c');
await writeFile(
  `${root}/index.html`,
  `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Minutrel — English video guides</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f7f2;color:#142c38;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header{max-width:1520px;margin:auto;padding:36px 38px 25px;display:flex;justify-content:space-between;align-items:center}header img{width:215px}header span{font-size:13px;font-weight:700;letter-spacing:.13em;color:#087f75}main{max-width:1520px;margin:auto;padding:0 38px 45px}h1{font-size:38px;letter-spacing:-1.2px;line-height:1.15;margin:13px 0 12px}.intro{max-width:850px;color:#546772;margin-bottom:30px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:25px;align-items:start}video{display:block;width:100%;aspect-ratio:16/9;background:#142c38;border-radius:15px;box-shadow:0 18px 45px #142c3815}.details{display:flex;gap:20px;align-items:start;justify-content:space-between;margin-top:25px}h2{font-size:24px;line-height:1.2;letter-spacing:-.5px;margin:0 0 8px}#description{margin:0;max-width:640px;color:#546772}.downloads{display:flex;gap:9px;white-space:nowrap}a{color:#087f75}a.download{padding:8px 13px;border:1px solid #bacdc1;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}a.download:first-child{background:#087f75;color:white;border-color:#087f75}nav{background:white;border:1px solid #dce5dd;border-radius:14px;overflow:hidden}nav button{border:0;border-bottom:1px solid #e5ece5;background:white;color:#142c38;display:flex;gap:15px;align-items:center;padding:15px 16px;width:100%;text-align:left;font:inherit;cursor:pointer}nav button:last-child{border-bottom:0}nav button:hover{background:#f0f6ef}nav button[aria-current=true]{background:#e2f1e8;box-shadow:inset 4px 0 #087f75}nav .number{color:#087f75;font-size:13px;font-weight:800}nav .title{display:block;font-size:14px;font-weight:700}nav .time{display:block;font-size:12px;color:#65796f;margin-top:2px}button:focus-visible,a:focus-visible{outline:3px solid #99b52b;outline-offset:-3px}footer{margin-top:36px;color:#65796f;font-size:12px}footer a{margin-left:15px}
@media(max-width:1000px){.layout{grid-template-columns:1fr}nav{display:grid;grid-template-columns:1fr 1fr}.details{flex-direction:column}header,main{padding-left:22px;padding-right:22px}h1{font-size:31px}}
@media(max-width:560px){nav{grid-template-columns:1fr}header span{display:none}.downloads{flex-wrap:wrap}}
</style>
<header><img src="minutrel.svg" alt="Minutrel"><span>ENGLISH VIDEO GUIDES / 03–12</span></header>
<main><h1>Make every project minute count.</h1><p class="intro">Ten practical Minutrel guides. English narration, original music and clear, step-by-step examples.</p>
<div class="layout"><section><video id="player" controls preload="auto" playsinline aria-label="Minutrel video player"></video><div class="details"><div><h2 id="title"></h2><p id="description"></p></div><div class="downloads"><a id="mp4" class="download" download>MP4</a><a id="srt" class="download" download>Subtitles</a></div></div></section><nav id="chapters" aria-label="Video guides"></nav></div><footer>Full HD · 30 fps · English captions · Fictional demonstration data<a href="README.txt">Delivery notes</a></footer></main>
<script>const videos=${data};const player=document.getElementById('player'),nav=document.getElementById('chapters');let current=0;
function choose(i){current=i;const v=videos[i];player.pause();player.src=v.file;player.poster=v.poster;player.load();document.getElementById('title').textContent=v.title;document.getElementById('description').textContent=v.description;document.getElementById('mp4').href=v.file;document.getElementById('srt').href=v.srt;[...nav.children].forEach((b,j)=>b.setAttribute('aria-current',String(i===j)));}
videos.forEach((v,i)=>{const button=document.createElement('button');button.type='button';const n=document.createElement('span');n.className='number';n.textContent=String(v.id).padStart(2,'0');const label=document.createElement('span'),title=document.createElement('span'),time=document.createElement('span');title.className='title';time.className='time';title.textContent=v.title;time.textContent=v.durationLabel;label.append(title,time);button.append(n,label);button.addEventListener('click',()=>choose(i));nav.append(button);});choose(0);</script></html>`,
);
const checksums = [];
for (const file of files.filter((f) => /\.(mp4|srt|vtt)$/.test(f))) {
  const hash = createHash('sha256')
    .update(await readFile(`${root}/${file}`))
    .digest('hex');
  checksums.push(`${hash}  ${file}`);
}
await writeFile(`${root}/SHA256SUMS.txt`, checksums.join('\n') + '\n');
const temp = resolve(`out/minutrel-guides-en-${randomUUID()}.zip`),
  archive = resolve('out/minutrel-guides-en.zip');
await exec('zip', ['-q', temp, ...files], { cwd: resolve(root), maxBuffer: 1024 * 1024 });
await rename(temp, archive);
const total = collection.reduce((s, v) => s + v.duration, 0);
console.log(
  `Packaged ${collection.length} videos, ${total.toFixed(2)} seconds. Archive: ${archive}`,
);
