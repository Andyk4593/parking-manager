import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'parking-extended-')),env={...process.env,PARKING_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
let app;const result={};
try{
 app=await electron.launch({args:['.','--test-mode'],env});const page=await app.firstWindow();await page.waitForFunction(()=>window.__parkingTest&&document.querySelector('#world canvas'));
 await page.locator('#nickname').fill('ПРОВЕРКА');await page.locator('#join-form button').click();await page.evaluate(()=>window.__parkingTest.skipCountdown());
 await page.evaluate(()=>window.__parkingTest.fixture({lane:0}));await page.keyboard.down('Digit1');await page.waitForTimeout(920);await page.keyboard.down('Digit1');assert.equal(await page.evaluate(()=>window.__parkingTest.snapshot().score),5);await page.keyboard.up('Digit1');result.heldKey='PASS';
 await page.evaluate(()=>{window.__parkingTest.fixture({lane:0});window.__parkingTest.fixture({lane:1,clear:false});});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:10});
 const boxes=await Promise.all([page.locator('#gate-0').boundingBox(),page.locator('#gate-1').boundingBox()]);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:boxes.map((b,i)=>({id:i,x:b.x+b.width/2,y:b.y+b.height/2}))});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>window.__parkingTest.snapshot().score),15);result.twoFingerEmulation='PASS';
 await page.evaluate(()=>window.__parkingTest.fixture({lane:3}));await page.keyboard.press('Numpad4');assert.equal(await page.evaluate(()=>window.__parkingTest.snapshot().score),20);result.numpad='PASS';
 await page.evaluate(()=>{window.__parkingTest.setScene();window.__parkingTest.time(500);});
 const timing=await page.evaluate(()=>new Promise(resolve=>{const times=[],start=performance.now();let last=start;function step(t){times.push(t-last);last=t;if(t-start<10000)requestAnimationFrame(step);else{times.sort((a,b)=>a-b);resolve({frames:times.length,seconds:(t-start)/1000,meanFrameMs:times.reduce((a,b)=>a+b,0)/times.length,p95FrameMs:times[Math.floor(times.length*.95)]});}}requestAnimationFrame(step);}));result.performance=timing;
 await page.keyboard.press('Escape');if(await page.locator('#abandon').isVisible())await page.locator('#abandon').click();else{await page.waitForFunction(()=>!document.querySelector('#to-lobby').disabled&&window.__parkingTest.snapshot().mode==='result');await page.locator('#to-lobby').click();}
 // This check waits the real 30 seconds; no virtual idle clock injection.
 await page.waitForFunction(()=>window.__parkingTest.snapshot().mode==='attract',{},{timeout:35000});result.realThirtySecondIdle='PASS';
 await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>window.__parkingTest.snapshot().mode),'lobby');result.keyboardWake='PASS';
 console.log(JSON.stringify(result,null,2));fs.writeFileSync('test-output/extended.json',JSON.stringify(result,null,2));
}finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
