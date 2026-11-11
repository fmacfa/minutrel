import { copyFile, mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { release } from './story.mjs';

const exec = promisify(execFile);
const directory = 'out/updates-en';
const films = JSON.parse(await readFile('src/updates/catalog.json', 'utf8'));
const verification = JSON.parse(await readFile(`${directory}/verification.json`, 'utf8'));
const publication = JSON.parse(await readFile('publication/youtube.json', 'utf8'));
const site = publication.siteEnglishUrl;
const titles = {
  13: 'Minutrel — Custom subcategories for your projects',
  14: 'Minutrel — Project budgets, deadlines and actions',
  15: 'Minutrel — Gantt, workload and hourly rates',
  16: 'Minutrel — Weekly timesheets and approved reports',
};
const archiveFiles = ['index.html', 'publication.json', 'READ-ME.txt'];
const entries = [];
const safe = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
await mkdir(`${directory}/posters`, { recursive: true });
await mkdir(`${directory}/brand`, { recursive: true });
for (const name of ['Manrope-Regular.ttf', 'Manrope-ExtraBold.ttf', 'OFL.txt']) {
  await copyFile(`public/fonts/${name}`, `${directory}/brand/${name}`);
  archiveFiles.push(`brand/${name}`);
}
await copyFile('public/brand/minutrel-primary.svg', `${directory}/brand/minutrel-primary.svg`);
archiveFiles.push('brand/minutrel-primary.svg');

for (const film of films) {
  const stem = `minutrel-${film.id}-${film.slug}`;
  const file = `${stem}.mp4`,
    subtitle = `${stem}.srt`,
    poster = `posters/${stem}.png`;
  const verified = verification.outputs.find((item) => item.file === `${directory}/${file}`);
  if (verified?.decode !== 'passed' || verified.bytes !== (await stat(`${directory}/${file}`)).size)
    throw new Error(`Verify the final render of ${film.id} before packaging`);
  await copyFile(`${directory}/qa/${film.id}-intro-cover.png`, `${directory}/${poster}`);
  entries.push({
    id: film.id,
    title: titles[film.id],
    shortTitle: film.shortTitle,
    summary: film.summary,
    composition: film.composition,
    duration: film.total,
    file,
    subtitle,
    poster,
    language: 'en',
    status: 'ready',
    description: `${film.summary}\n\nEnglish guide to the Minutrel development preview. Fictional demo data, synthetic English narration and original music.\n\nWebsite: ${site}\nSource code and guides: ${publication.repositoryUrl}`,
  });
  archiveFiles.push(file, subtitle, poster);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Minutrel · November video guides</title>
<style>
@font-face{font-family:Manrope;src:url(brand/Manrope-Regular.ttf)}@font-face{font-family:Manrope;src:url(brand/Manrope-ExtraBold.ttf);font-weight:800}
:root{font:16px Manrope,system-ui,sans-serif;color:#142c38;background:#f8f7f3}*{box-sizing:border-box}body{margin:0}.wrap{width:min(1160px,calc(100% - 40px));margin:auto}header{border-bottom:1px solid #d7deda}.nav{height:76px;display:flex;align-items:center;justify-content:space-between;gap:16px}.nav img{width:158px;display:block}.nav a,article a{color:#05665e;text-decoration-thickness:1px;text-underline-offset:4px}main{padding:64px 0 50px}.eyebrow,.meta{font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#087f75;font-size:.73rem}h1{font-size:clamp(2.6rem,6vw,5.4rem);max-width:900px;letter-spacing:-.07em;line-height:1.02;margin:15px 0 25px}header+main>.wrap>p:not(.eyebrow){max-width:660px;line-height:1.7;color:#536570}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin-top:35px}article{background:white;border:1px solid #d7deda;border-radius:18px;overflow:hidden}video{width:100%;aspect-ratio:16/9;display:block;background:#142c38}.copy{padding:19px 24px 23px}h2{font-size:1.35rem;letter-spacing:-.035em;margin:.55rem 0}.copy p:not(.meta){line-height:1.6;color:#536570}.links{display:flex;gap:20px;flex-wrap:wrap;font-weight:800;font-size:.83rem}footer{border-top:1px solid #d7deda;color:#536570;padding:22px 0;font-size:.88rem}@media(max-width:700px){.grid{grid-template-columns:1fr}main{padding-top:42px}.nav img{width:128px}}
</style></head><body><header><div class="wrap nav"><a href="${safe(site)}"><img src="brand/minutrel-primary.svg" alt="Minutrel"></a><a href="${safe(publication.repositoryUrl)}">Source code and guides ↗</a></div></header>
<main><div class="wrap"><p class="eyebrow">November 2026 · Development preview</p><h1>Four new Minutrel guides.</h1><p>Recorded in the real application with fictional data. Each video includes English narration, original music and captions.</p><div class="grid">
${entries.map((v) => `<article><video controls playsinline preload="none" poster="${v.poster}" aria-label="${safe(v.shortTitle)}"><source src="${v.file}" type="video/mp4"></video><div class="copy"><p class="meta">Guide ${v.id} · ${Math.round(v.duration)} seconds · English</p><h2>${safe(v.shortTitle)}</h2><p>${safe(v.summary)}</p><div class="links"><a href="${v.file}" download>Download MP4 ↓</a><a href="${v.subtitle}" download>English subtitles ↓</a></div></div></article>`).join('\n')}
</div></div></main><footer><div class="wrap">Minutrel · Open source project time tracking · Preview recorded from ${release}</div></footer></body></html>`;
await writeFile(`${directory}/index.html`, html);
await writeFile(
  `${directory}/publication.json`,
  JSON.stringify(
    {
      sourceCommit: release,
      language: 'en',
      website: site,
      repository: publication.repositoryUrl,
      channel: publication.channelUrl,
      videos: entries,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  `${directory}/READ-ME.txt`,
  `Minutrel · November 2026 guides\n\nOpen index.html in a browser to play the four videos locally.\nMP4: 1920 × 1080, 30 fps, H.264 video and stereo AAC.\nThe SRT files provide English captions for upload or reuse.\n\nCaptured from the development preview ${release}, using fictional demo data.\nNarration: Kokoro af_heart. Background music: original Minutrel tutorial score.\nManrope is distributed under the SIL Open Font License in brand/OFL.txt.\nPublication metadata and English descriptions are in publication.json.\n`,
);
const temporary = `minutrel-november-guides-${process.pid}.zip`;
await exec('zip', ['-q', '-6', temporary, ...archiveFiles], { cwd: resolve(directory) });
await exec('zip', ['-T', temporary], { cwd: resolve(directory) });
await rename(`${directory}/${temporary}`, `${directory}/minutrel-november-2026-guides.zip`);
console.log(
  `Packaged ${entries.length} verified guides, their posters, SRT subtitles and offline player.`,
);
