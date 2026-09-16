import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'output/playwright/browsers');fs.mkdirSync(out,{recursive:true});
const report={date:new Date().toISOString(),mode:'headless installed desktop browsers, isolated contexts',checks:[],browsers:[]};
for(const channel of ['chrome','msedge']){
 let browser;
 try{
  browser=await chromium.launch({channel,headless:true});const context=await browser.newContext({viewport:{width:1366,height:768}});await context.setOffline(true);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'web-dist/index.html')).href+'?test=1');await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>typeof window.__parkingShiftTest),'undefined');assert.equal(await page.evaluate(()=>document.fonts.check('40px Pixel')),true);
  await page.locator('#nickname').fill('Браузер 123');await page.locator('#overlay [data-fullscreen]').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.locator('#overlay [data-fullscreen]').click();await page.waitForFunction(()=>!document.fullscreenElement);
  await page.locator('#start').click();assert.equal(await page.locator('#tutorial-title').innerText(),'Белый номер — можно пропустить');await page.locator('#tutorial-next').click();await page.locator('#tutorial-finger').waitFor({state:'visible',timeout:8000});await page.keyboard.press('Digit2');await page.waitForFunction(()=>document.querySelector('#score').textContent==='00005');await page.screenshot({path:path.join(out,channel+'-tutorial.png'),scale:'css'});
  await page.locator('#tutorial-skip').click();await page.locator('#music').click();assert.equal(await page.locator('#music').getAttribute('aria-pressed'),'false');await page.keyboard.press('Escape');assert.equal(await page.locator('#dialog-label').innerText(),'ПАУЗА');await page.locator('#start').click();
  await page.locator('#start').waitFor({state:'visible',timeout:23000});assert.equal(await page.locator('#dialog-label').innerText(),'СМЕНА ЗАВЕРШЕНА');assert.match(await page.locator('#personal-result').innerText(),/Лучший: 0/);await page.screenshot({path:path.join(out,channel+'-result.png'),scale:'css'});
  await page.reload();assert.equal(await page.locator('#nickname').inputValue(),'Браузер 123');assert.match(await page.locator('#personal-result').innerText(),/Лучший: 0/);assert.equal(await page.locator('#overlay [data-audio="music"]').getAttribute('aria-pressed'),'false');assert.deepEqual(errors,[]);
  report.browsers.push({channel,version:browser.version(),status:'PASS'});report.checks.push(channel+': offline font, no debug hooks, fullscreen API, real tutorial input and score, skip, pause, three losses, record reload, audio settings, no runtime errors');console.log('PASS '+report.checks.at(-1));
 }catch(error){report.status='FAIL';report.error=error.stack;console.error(error);process.exitCode=1;break;}
 finally{if(browser)await browser.close();}
}
report.status??='PASS';fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
