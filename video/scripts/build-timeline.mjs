import { readFile, writeFile } from 'node:fs/promises';
const sidecar = JSON.parse(await readFile('public/captures/minutrel-parcours.json', 'utf8'));
const markers = Object.fromEntries(sidecar.markers.map((m) => [m.label, m.ms / 1000]));
const timeline = {
  trim: sidecar.trimStartMs / 1000,
  duration: Math.floor((sidecar.usableDurationMs / 1000) * 30) / 30,
  markers,
};
await writeFile('src/timing.json', `${JSON.stringify(timeline, null, 2)}\n`);
console.log(`Usable capture: ${timeline.duration}s; tutorial: ${timeline.duration + 17}s`);
