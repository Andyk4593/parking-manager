import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'output/playwright/release');fs.mkdirSync(out,{recursive:true});
const host=path.join(out,'host.cjs'),file=path.join(root,'web-test/index.html');
fs.writeFileSync(host,`const {app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(out,'profile'))});app.whenReady().then(()=>{const w=new BrowserWindow({show:false,width:1920,height:1080,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:true}});w.loadFile(${JSON.stringify(file)},{query:{test:'1'}});});app.on('window-all-closed',()=>app.quit());`);
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
let app,server;const errors=[],report={date:new Date().toISOString(),engine:'Chromium; file:// and static HTTP subdirectory',checks:[]};
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
try{
  app=await electron.launch({args:[host],env,timeout:45000});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>window.__parkingReleaseTest),call=(method,value)=>page.evaluate(({method,value})=>window.__parkingReleaseTest[method](value),{method,value}),state=()=>call('snapshot');
  const shift=(method,value)=>page.evaluate(({method,value})=>window.__parkingShiftTest[method](value),{method,value});
  const shot=name=>page.screenshot({path:path.join(out,name+'.png'),scale:'css'});
  const size=async(width,height)=>{await page.setViewportSize({width,height});await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h&&Math.abs(document.querySelector('#stage').getBoundingClientRect().height-1080*Math.min(w/1920,h/1080))<.1,[width,height]);};
  await ready();await page.evaluate(()=>localStorage.clear());await page.reload();await ready();await page.evaluate(()=>document.fonts.ready);await size(1920,1080);await call('menu');
  await check('first load is silent; nickname required, digits editable, Enter starts tutorial',async()=>{
    assert.equal((await state()).audio.state,'none');await shot('01-welcome');await page.locator('#start').click();assert.equal((await state()).mode,'idle');assert.match(await page.locator('#nickname-error').innerText(),/Введи/);
    await page.locator('#nickname').fill('Андрей ');await page.keyboard.type('1234');assert.equal(await page.locator('#nickname').inputValue(),'Андрей 1234');await page.keyboard.press('Enter');assert.equal((await state()).mode,'tutorial');await page.waitForFunction(()=>window.__parkingReleaseTest.snapshot().audio.playing);await page.locator('#tutorial-skip').click();assert.equal((await state()).profile.nickname,'Андрей 1234');
  });
  await check('music has samples and one source; separate music toggle leaves effects enabled',async()=>{
    const stats=await page.evaluate(()=>{const pcm=window.__parkingReleaseTest.music();let sum=0,peak=0;for(const v of pcm){sum+=v*v;peak=Math.max(peak,Math.abs(v));}return {samples:pcm.length,rms:Math.sqrt(sum/pcm.length),peak};});assert.ok(stats.samples>900000&&stats.rms>.01&&stats.peak<.25);report.music=stats;
    const starts=(await state()).audio.starts;for(let i=0;i<8;i++)await shift('reset');assert.equal((await state()).audio.starts,starts);
    await page.locator('#music').click();assert.equal((await state()).audio.playing,false);assert.equal((await state()).audio.sound,true);await page.keyboard.press('Digit1');assert.ok((await state()).audio.voices>0);await page.locator('#music').click();assert.equal((await state()).audio.playing,true);
  });
  await check('pause and background stop all audio; resume uses one source and settings persist',async()=>{
    await page.waitForTimeout(250);await page.locator('#pause').click();assert.equal((await state()).audio.playing,false);assert.ok((await state()).audio.offset>0);const starts=(await state()).audio.starts;await page.locator('#start').click();assert.equal((await state()).audio.starts,starts+1);
    await page.locator('#sound').click();assert.equal((await state()).audio.playing,false);assert.equal((await state()).audio.voices,0);await page.locator('#sound').click();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});assert.equal((await state()).mode,'paused');assert.equal((await state()).audio.playing,false);
    await page.locator('#overlay [data-audio="music"]').click();await page.reload();await ready();assert.equal((await state()).profile.settings.music,false);assert.equal((await state()).audio.state,'none');assert.equal(await page.locator('#nickname').inputValue(),'Андрей 1234');await page.locator('#overlay [data-audio="music"]').click();await call('menu');
  });
  await check('third loss saves one personal result; restart preserves best and resets the shift',async()=>{
    await page.locator('#start').click();await shift('reset',{difficultyAt:300});for(let lane=0;lane<4;lane++)await shift('spawn',{lane,black:false});await call('advance',1.3);await page.keyboard.press('Digit1');await call('advance',2.5);
    const s=await state();assert.equal(s.mode,'result');assert.deepEqual(s.profile.players,[{nickname:'Андрей 1234',best:5,last:5}]);assert.equal(s.audio.playing,false);assert.match(await page.locator('#personal-result').innerText(),/Лучший: 5/);await shot('02-personal-result');await call('advance',3);assert.equal((await state()).profile.players.length,1);
    await page.locator('#start').click();const g=await shift('snapshot');assert.equal(g.score,0);assert.equal(g.lives,3);assert.equal(g.cars.length,0);assert.equal((await state()).profile.players[0].best,5);
  });
  await check('records survive reload and another nickname has an independent personal record',async()=>{
    await page.reload();await ready();await call('menu');assert.match(await page.locator('#personal-result').innerText(),/Лучший: 5/);await page.locator('#nickname').fill('Второй');assert.match(await page.locator('#personal-result').innerText(),/первый/);await page.locator('#start').click();await shift('reset',{difficultyAt:300});for(let lane=0;lane<3;lane++)await shift('spawn',{lane,black:false});await call('advance',3);assert.equal((await state()).profile.players.length,2);assert.equal((await state()).profile.players[0].best,0);
  });
  await check('30 seconds idle starts actual autoplay; scores excluded and first tap only wakes',async()=>{
    await call('menu');const before=(await state()).profile.players;await call('advance',29.9);assert.equal((await state()).mode,'idle');await page.locator('#nickname').fill('Второй 2');await call('advance',.2);assert.equal((await state()).mode,'idle');await call('advance',29.9);assert.equal((await state()).mode,'demo');
    for(let i=0;i<200;i++)await call('advance',.1);assert.ok((await shift('snapshot')).score>0);assert.equal((await shift('snapshot')).lives,3);assert.deepEqual((await state()).profile.players,before);assert.equal((await state()).audio.playing,false);await shot('03-attract');await page.locator('#attract-screen').click();assert.equal((await state()).mode,'idle');assert.equal(await page.locator('#nickname').inputValue(),'Второй 2');
    await call('advance',30);await page.keyboard.press('Enter');assert.equal((await state()).mode,'idle');assert.deepEqual((await state()).profile.players,before);
  });
  await check('idle does not interrupt paused shifts or tutorials; hidden idle never catches up',async()=>{
    await page.locator('#start').click();await shift('reset');await shift('pause');await call('advance',40);assert.equal((await state()).mode,'paused');await call('menu');await page.locator('#dialog-training').click();await call('advance',40);assert.equal((await state()).mode,'tutorial');await call('menu');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});window.__parkingReleaseTest.advance(40);delete document.hidden;});assert.equal((await state()).mode,'idle');
  });
  await check('keyboard focus stays in the dialog and all menu controls fit target sizes',async()=>{
    for(const [width,height] of [[1920,1080],[1366,768]]){await size(width,height);await call('menu');await page.locator('#nickname').fill('ОченьДлинныйНик123456');await page.locator('#nickname').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-fullscreen')),true);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'nickname');
      const dialog=await page.locator('.dialog').boundingBox(),overlay=await page.locator('#overlay').boundingBox();assert.ok(dialog.y>=overlay.y&&dialog.y+dialog.height<=overlay.y+overlay.height);assert.equal(await page.locator('.dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);await shot('04-menu-'+width);
    }
  });
  await check('blocked local storage does not block a complete game and reports session-only saving',async()=>{
    await page.evaluate(()=>{window.__savedStorage={get:Storage.prototype.getItem,set:Storage.prototype.setItem};Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw Error('denied');};});await page.locator('#start').click();await shift('reset',{difficultyAt:300});for(let lane=0;lane<3;lane++)await shift('spawn',{lane,black:false});await call('advance',3);assert.equal((await state()).mode,'result');assert.equal((await state()).persistent,false);assert.match(await page.locator('#storage-note').innerText(),/до закрытия/);await page.evaluate(()=>{Storage.prototype.getItem=window.__savedStorage.get;Storage.prototype.setItem=window.__savedStorage.set;});
  });
  await check('production file starts offline, with no debug hooks or remote dependencies',async()=>{
    await page.goto(pathToFileURL(path.join(root,'web-dist/index.html')).href+'?test=1');await page.locator('#nickname').waitFor();assert.equal(await page.evaluate(()=>typeof window.__parkingShiftTest),'undefined');assert.equal(await page.evaluate(()=>typeof window.__parkingReleaseTest),'undefined');assert.equal(await page.locator('.practice-panel,[data-tempo]').count(),0);await page.locator('#nickname').fill('Офлайн');if(await page.locator('#dialog-skip').isVisible())await page.locator('#dialog-skip').click();else await page.locator('#start').click();await page.waitForTimeout(800);assert.ok(await page.locator('#vehicles>.car').count()>0);assert.deepEqual(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/^https?:/.test(r.name)).map(r=>r.name)),[]);
  });
  await check('GitHub Pages style subdirectory serves production game with relative assets',async()=>{
    const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf'};server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\/parking-manager\//,'');const full=path.resolve(root,'web-dist',rel||'index.html');if(!full.startsWith(path.join(root,'web-dist')+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(full)]||'application/octet-stream');fs.createReadStream(full).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/parking-manager/`;const failed=[];page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});await page.goto(url);await page.evaluate(()=>document.fonts.ready);await page.locator('#nickname').fill('Pages');await page.locator('#dialog-skip').click();await page.waitForTimeout(700);assert.ok(await page.locator('#vehicles>.car').count()>0);assert.equal(await page.evaluate(()=>document.fonts.check('40px Pixel')),true);assert.deepEqual(failed,[]);await shot('05-http-production');report.subdirectory=url;
  });
  await check('real thirty-second inactivity activates demo in production; keyboard wakes menu',async()=>{
    await page.keyboard.press('Escape');await page.locator('#dialog-menu').click();const began=Date.now();await page.locator('#attract-screen').waitFor({state:'visible',timeout:37000});report.realIdleMs=Date.now()-began;assert.ok(report.realIdleMs>=29500&&report.realIdleMs<37000);await page.keyboard.press('Space');assert.equal(await page.locator('#nickname').isVisible(),true);assert.equal(await page.locator('#start').innerText(),'Участвовать');assert.deepEqual(errors,[]);
  });
  report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(app)await app.close();if(server)await new Promise(r=>server.close(r));}
