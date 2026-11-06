import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:960,height:540}});
try {
  for(const [name,times] of [
    ['presentation',[0,2,5.5,9,14,20,25,30,36,39.9]],
    ['fonctionnement',[0,4,11,15,30,35,44.5,49,53,58.5,64,72,78,83,92,99,105,110,118,123,128,134,138.05]],
  ]) {
    await page.goto(pathToFileURL(resolve(`out/minutrel-${name}.mp4`)).href);
    await page.locator('video').waitFor();
    await page.evaluate(async()=>{
      const v=document.querySelector('video');
      v.controls=false;v.muted=true;v.pause();
      Object.assign(v.style,{position:'fixed',left:'0',top:'0',width:'100vw',height:'100vh',objectFit:'fill',margin:'0'});
      if(v.readyState<2) await new Promise((resolve,reject)=>{v.addEventListener('loadeddata',resolve,{once:true});v.addEventListener('error',reject,{once:true});});
    });
    const dir=`out/qa/final-${name}`;await mkdir(dir,{recursive:true});
    for(const seconds of times){
      await page.evaluate(async(seconds)=>{
        const v=document.querySelector('video');
        if(Math.abs(v.currentTime-seconds)>0.001){const seeked=new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));v.currentTime=seconds;await seeked;}
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      },seconds);
      await page.screenshot({path:`${dir}/frame-${String(Math.round(seconds*30)).padStart(5,'0')}.png`});
    }
    console.log(`Decoded and sampled ${name}: ${times.length} frames`);
  }
} finally {await browser.close();}
