import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'output/playwright/composition');
fs.mkdirSync(out,{recursive:true});
const host=path.join(out,'preview-host.cjs');
const file=path.join(root,'design/composition/index.html');
fs.writeFileSync(host,`const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({show:false,width:1920,height:1080,webPreferences:{contextIsolation:true,nodeIntegration:false}});w.loadFile(${JSON.stringify(file)},{query:{capture:'1'}});});app.on('window-all-closed',()=>app.quit());`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const report={date:new Date().toISOString(),engine:'Electron Chromium (hidden window, static web files)',checks:[],screenshots:[]};
let app;
try{
  app=await electron.launch({args:[host],env,timeout:45000});
  const page=await app.firstWindow();const errors=[];const remote=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
  await page.waitForSelector('.plate');await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.fonts.check('40px Pixel')),true);report.checks.push('Local pixel font loaded');
  for(const [width,height] of [[1920,1080],[1366,768]]){
    // Emulate CSS viewport directly: native Windows window sizes round at 125% DPI.
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const metrics=await page.evaluate(()=>{
      const stage=document.querySelector('#stage').getBoundingClientRect(),scale=stage.width/1920;
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
      return {viewport:[innerWidth,innerHeight],stage:box(document.querySelector('#stage')),scale,plates:[...document.querySelectorAll('.plate')].map(e=>({...box(e),lane:Number(e.dataset.lane),visible:getComputedStyle(e).visibility!=='hidden',font:parseFloat(getComputedStyle(e).fontSize)*scale})),gates:[...document.querySelectorAll('.gate-zone')].map(box),cars:document.querySelectorAll('.car').length,types:[...new Set([...document.querySelectorAll('.car')].map(e=>e.dataset.type))]};
    });
    assert.deepEqual(metrics.viewport,[width,height]);assert.equal(metrics.cars,8);assert.equal(metrics.types.length,5);
    assert.ok(metrics.stage.x>=-.01&&metrics.stage.y>=-.01&&metrics.stage.right<=width+.01&&metrics.stage.bottom<=height+.01);
    const overlaps=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
    for(const [i,p] of metrics.plates.entries()){
      const top=metrics.stage.y+(210+p.lane*190)*metrics.scale,bottom=top+190*metrics.scale;
      assert.ok(p.y>=top&&p.bottom<=bottom,`plate ${i} in its lane`);assert.ok(p.font>=28,`plate ${i} readable text size`);
      for(const other of metrics.plates.slice(i+1))assert.ok(!overlaps(p,other),'plate collision');
      for(const gate of metrics.gates)assert.ok(!overlaps(p,gate),'plate covers a gate hit area');
    }
    for(const g of metrics.gates)assert.ok(g.w>=149&&g.h>=126,'target size');
    assert.equal(metrics.plates.filter(p=>p.visible).length,6);
    const image=`composition-${width}x${height}.png`;await page.screenshot({path:path.join(out,image),scale:'css'});report.screenshots.push(image);
    report.checks.push(`${width}x${height}: 8 cars, 5 types, 4 gate targets; all 8 plate bounds within own lane, no plate/target overlap, >=28px rendered number text; stage fits`);
  }
  await page.setViewportSize({width:1920,height:1080});
  // The review controls are deliberately outside the game UI, hidden in captures.
  await page.evaluate(()=>document.body.classList.remove('capture'));
  await page.locator('#density').click();assert.equal(await page.locator('.plate:not(.hidden)').count(),8);
  await page.evaluate(()=>document.body.classList.add('capture'));
  await page.screenshot({path:path.join(out,'composition-all-plates.png'),scale:'css'});report.screenshots.push('composition-all-plates.png');
  report.checks.push('Review toggle reveals all 8 plates for the density check');
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);report.checks.push('No renderer exceptions or external HTTP requests observed');
  report.status='PASS';console.log(JSON.stringify(report,null,2));
}catch(error){report.status='FAIL';report.error=error.stack;console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(app)await app.close();}
