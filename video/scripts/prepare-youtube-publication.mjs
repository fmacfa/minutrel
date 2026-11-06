import {readFile,writeFile,mkdir,link,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {films} from './story-series.mjs';
const root=resolve('..'),directory=resolve('.cache/youtube-upload');
await mkdir(directory,{recursive:true});await mkdir('publication',{recursive:true});
let prior={};try{prior=JSON.parse(await readFile('publication/youtube.json','utf8'));}catch{}
const repositoryUrl=prior.repositoryUrl??'https://github.com/fmacfa/minutrel';
const playlistUrl=prior.playlistUrl;
const titles=[
 ['Open-source time tracking, by project','Comprendre Minutrel','A clear introduction to Minutrel: open-source time tracking by project, useful work notes and reports, on your own computer or your own team server.'],
 ['Getting started: track, pause, finish and report','Premiers pas avec Minutrel','Follow a project from selecting it and recording a session to adding time, sharing a note and exporting a report.'],
 ['Mini timer: keep your session within reach','Le mini chrono'],
 ['Work on your computer without a server','Démarrer seul sur son ordinateur'],
 ['Set up your team, roles and project assignments','Créer son équipe et affecter les projets'],
 ['Add time manually and correct time entries','Ajouter et corriger des temps'],
 ['Monthly reports and PDF, CSV and ZIP exports','Rapports mensuels et exports'],
 ['Work notes, sharing and monthly summaries','Notes de travail et comptes rendus'],
 ['Track time offline and synchronise later','Travailler hors connexion'],
 ['Transfer personal time to a team workspace','Transférer ses temps personnels vers une équipe'],
 ['Connect coding assistants with limited MCP access','Connecter des assistants avec des droits limités'],
 ['Install and self-host your team workspace','Installer et autohéberger Minutrel'],
];
const timing=JSON.parse(await readFile('src/timing-en-v2.json','utf8'));
const series=JSON.parse(await readFile('src/series/catalog.json','utf8'));
const videos=[];
for(let id=1;id<=12;id++){
 const film=films.find(f=>f.id===id),data=series.find(f=>f.id===id),title='Minutrel — '+titles[id-1][0];
 const file=id===1?'video/out/minutrel-presentation-en-v2.mp4':id===2?'video/out/minutrel-tutorial-en-v2.mp4':`video/out/series-en/minutrel-${String(id).padStart(2,'0')}-${film.slug}.mp4`;
 const subtitle=file.replace('.mp4','.srt'),name=String(id).padStart(2,'0')+' - '+title.replace(' — ',' - ').replaceAll(':',' -')+'.mp4',upload=resolve(directory,name);
 try{await access(upload);}catch{await link(resolve(root,file),upload);}
 const summary=film?.intro??titles[id-1][2];
 const points=film?film.steps.map(s=>s.title):id===1?['Project-based time tracking','Work context and monthly reports','Personal and self-hosted team workspaces']:['Choose a project and describe your work','Start, pause, resume and finish a session','Review and add time entries','Share a work note and export a report'];
 const description=[summary,'','Minutrel is open-source time tracking by project. Work on your own computer, or connect the browser and desktop app to a team server you control.','','In this video:',...points.map(s=>'• '+s),'','English guide · Minutrel V0.1 preview.','Fictional demonstration data. Synthetic English narration and original background music.',...(film?.mode==='native'?['This desktop guide uses real application screenshots arranged as narrated steps.']:[]),...(id===12?['The HTTPS address and reverse proxy configuration shown are examples.']:[]),'','More Minutrel videos: https://www.youtube.com/@minutrel'].join('\n');
 videos.push({id,title,titleFr:titles[id-1][1],summary,description,duration:id===1?26:id===2?timing.total:data.total,file,subtitle,uploadFile:upload.replace(root+'/',''),youtube:prior.videos?.find(v=>v.id===id)?.youtube??{status:'prepared'}});
}
for(const video of videos) video.description+='\nSource code and documentation: '+repositoryUrl+(playlistUrl?'\nEnglish video playlist: '+playlistUrl:'');
await writeFile('publication/youtube.json',JSON.stringify({channelId:'UCcJhCgd_1O0jeWqGJZGfjSw',channelUrl:'https://www.youtube.com/@minutrel',repositoryUrl,...(playlistUrl?{playlistUrl}:{}),language:'en',preparedAt:new Date().toISOString(),videos},null,2)+'\n');
console.log('Prepared twelve verified English MP4s and their publication metadata.');
