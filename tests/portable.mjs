import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const executable=path.resolve(process.argv[2]||'release/ParkingManager.exe');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'parking-portable-test-'));
const a=path.join(root,'Первая папка'),b=path.join(root,'Второй компьютер');
fs.mkdirSync(a);fs.mkdirSync(b);for(const folder of [a,b])fs.copyFileSync(executable,path.join(folder,'ParkingManager.exe'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.PORTABLE_EXECUTABLE_DIR;delete env.PARKING_TEST_DATA;
const port=9337;let child,browser,page;const result={};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function open(folder){
 child=spawn(path.join(folder,'ParkingManager.exe'),[`--remote-debugging-port=${port}`],{env,stdio:'ignore',windowsHide:true});
 for(let i=0;i<180;i++){try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok)break;}catch{}await sleep(500);
 }
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);page=browser.contexts()[0].pages()[0];await page.waitForSelector('#world canvas');
 console.log('Opened portable EXE from '+path.basename(folder));
}
async function close(){if(page)await page.evaluate(()=>window.parking.quit()).catch(()=>{});if(browser)await browser.close();if(child&&child.exitCode===null)await Promise.race([new Promise(r=>child.once('exit',r)),sleep(5000)]);page=null;browser=null;child=null;}
try{
 await open(a);
 const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,screenWidth:screen.width,screenHeight:screen.height}));assert.equal(dimensions.width,dimensions.screenWidth);assert.equal(dimensions.height,dimensions.screenHeight);result.fullscreenDimensions=dimensions;
 assert.equal(await page.evaluate(()=>typeof window.__parkingTest),'undefined');result.productionMode='PASS';
 assert.equal(JSON.parse(fs.readFileSync(path.join(a,'leaderboard.json'))).entries[0].name,'Вася');result.defaultFileNextToExe='PASS';
 if(await page.locator('#wake').isVisible())await page.locator('#wake').click();
 await page.locator('#nickname').fill('ПОРТАТИВНЫЙ');await page.locator('#join-form button').click();
 await page.waitForSelector('#result:not(.hidden)',{timeout:25000});await page.waitForFunction(()=>!document.querySelector('#again').disabled);
 assert.ok(JSON.parse(fs.readFileSync(path.join(a,'leaderboard.json'))).entries.some(e=>e.name==='ПОРТАТИВНЫЙ'));result.realRoundAndSave='PASS';await page.screenshot({path:'test-output/portable-result.png'});
 await close();fs.copyFileSync(path.join(a,'leaderboard.json'),path.join(b,'leaderboard.json'));
 await open(b);assert.match(await page.locator('#leader-list').innerText(),/ПОРТАТИВНЫЙ/);result.transferAndRelaunch='PASS';await close();
 fs.writeFileSync(path.join(b,'leaderboard.json'),'not valid JSON');
 await open(b);assert.equal(JSON.parse(fs.readFileSync(path.join(b,'leaderboard.json'))).entries[0].name,'Вася');assert.ok(fs.readdirSync(b).some(f=>f.includes('.corrupt-')));result.recovery='PASS';
 console.log(JSON.stringify(result,null,2));fs.writeFileSync('test-output/portable.json',JSON.stringify(result,null,2));
}finally{await close();fs.rmSync(root,{recursive:true,force:true});}
