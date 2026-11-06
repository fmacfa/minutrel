import { readFile, writeFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile),
  films = JSON.parse(await readFile('src/series/catalog.json', 'utf8'));
const checked = new Map(),
  end = Date.now() + 3 * 60 * 60 * 1000;
while (checked.size < films.length) {
  for (const film of films) {
    if (checked.has(film.id)) continue;
    const prefix = String(film.id).padStart(2, '0'),
      file = `out/series-en/minutrel-${prefix}-${film.slug}.mp4`;
    let renderInfo, media;
    try {
      renderInfo = JSON.parse(await readFile(`out/series-en/${prefix}-render.json`, 'utf8'));
      media = await stat(file);
    } catch {
      continue;
    }
    if (Math.abs(renderInfo.seconds - film.total) > 0.02) continue;
    let verification;
    try {
      verification = JSON.parse(
        await readFile(`out/series-en/verification-${film.id}.json`, 'utf8'),
      );
    } catch {}
    if (!verification || new Date(verification.checkedAt).getTime() < media.mtimeMs) {
      const { stdout } = await exec(
        process.execPath,
        ['scripts/verify-series.mjs', String(film.id)],
        { maxBuffer: 1024 * 1024 },
      );
      console.log(stdout.trim());
      verification = JSON.parse(
        await readFile(`out/series-en/verification-${film.id}.json`, 'utf8'),
      );
    }
    const { stdout } = await exec(
      process.execPath,
      ['scripts/sample-series.mjs', String(film.id)],
      { maxBuffer: 1024 * 1024 },
    );
    console.log(stdout.trim());
    checked.set(film.id, verification.outputs[0]);
    await writeFile(
      'out/series-en/verification.json',
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          count: checked.size,
          outputs: [...checked.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]),
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`VERIFIED ${checked.size}/${films.length}`);
  }
  if (Date.now() > end) throw new Error('Series exports did not all finish within three hours');
  if (checked.size < films.length) await new Promise((r) => setTimeout(r, 5000));
}
console.log(
  'All ten exports passed media and audio checks. Final frame samples are ready for visual review.',
);
