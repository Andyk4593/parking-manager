import {RULES,difficulty} from './lane-model.mjs';
import {Tutorial} from './tutorial.mjs';
import {ShiftGame,flowDifficulty} from './shift-model.mjs';
import {background,car as carArt,lanes,rect,text} from './art.mjs';
import {gateArt} from './gate-art.mjs';
import {ProfileStore,normalizeNickname} from './profile.mjs';
import {IdleTimer,advanceDemo} from './attract.mjs';
import {GameAudio} from './audio.mjs';
const $=s=>document.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const stage=$('#stage'),vehicles=$('#vehicles'),barriers=$('#barriers'),effects=$('#effects'),plates=$('#plates');
$('#road').innerHTML=background();
const gateButtons=lanes.map((y,i)=>{const b=document.createElement('button');b.id=i===1?'gate':`gate-${i}`;b.className='gate-zone';b.type='button';b.dataset.lane=i;b.style.top=`${y+7}px`;b.innerHTML=`<span class="gate-key">${i+1}</span>`;$('#gate-zones').append(b);return b;});
let game=new ShiftGame(),tutorial=null,mode='idle',resumeMode='playing',manualClock=false,last=0,fx=[],lastHud='',lastBarrier='',lastDim='',lastTip='',revision=0,feedbackUntil=0,feedbackPriority=0;
const profile=new ProfileStore(),soundtrack=new GameAudio(profile.data.settings),idle=new IdleTimer();
let seenInSession=false,recorded=false;
const nodes=new Map(),trainingKey='parking-manager:tutorial-v1';
function hasLearned(){try{return seenInSession||Boolean(localStorage.getItem(trainingKey));}catch{return seenInSession;}}
function rememberTraining(value){seenInSession=true;try{localStorage.setItem(trainingKey,value);}catch{/* Keep the preference in memory if storage is unavailable. */}}
const unlockAudio=()=>soundtrack.unlock(),beep=type=>soundtrack.beep(type);
function personal(){
  const nickname=mode==='idle'?normalizeNickname($('#nickname').value):profile.data.nickname,p=profile.result(nickname);
  $('#personal-result').textContent=p?`${nickname} · Лучший: ${p.best} · Последний: ${p.last}`:'Твой первый личный рекорд впереди.';
  $('#storage-note').textContent=profile.persistent?'Результаты сохраняются только в этом браузере.':'Хранилище недоступно. Результат останется до закрытия страницы.';
}
function selectPlayer(){if(!profile.select($('#nickname').value)){$('#nickname-error').textContent='Введи ник, чтобы начать.';$('#nickname').setAttribute('aria-invalid','true');$('#nickname').focus();return false;}$('#nickname').value=profile.data.nickname;$('#nickname-error').textContent='';$('#nickname').removeAttribute('aria-invalid');return true;}
const sessions=()=>tutorial?tutorial.games:game.lanes,clock=()=>tutorial?tutorial.time:game.time;
const allCars=()=>tutorial?tutorial.games.flatMap(g=>g.car?[g.car]:[]):game.cars;
function clearPresentation(){nodes.clear();vehicles.innerHTML='';plates.innerHTML='';effects.innerHTML='';fx=[];feedbackUntil=0;feedbackPriority=0;$('#feedback').innerHTML='';lastHud='';lastBarrier='';lastDim='';lastTip='';}
function modal(show){$('#overlay').classList.toggle('hidden',!show);$('#attract-screen').hidden=mode!=='demo';for(const el of stage.children)el.inert=mode==='demo'?el.id!=='attract-screen':show&&el.id!=='overlay';if(show)(mode==='idle'&&!$('#nickname').value?$('#nickname'):$('#start')).focus({preventScroll:true});}
function setDialog(label,title,message,button){
  $('#dialog-label').textContent=label;$('#dialog-title').textContent=title;$('#dialog-text').textContent=message;$('#start').textContent=button;
  $('#join-fields').hidden=mode!=='idle';$('#personal-panel').hidden=mode==='paused';$('#entry-hint').textContent=hasLearned()?'Пять минут, четыре полосы, три жизни.':'Начнём с короткого обучения. Оно не отнимает жизни.';personal();
  $('#restart').hidden=mode!=='paused'||resumeMode==='tutorial';$('#dialog-training').hidden=mode==='paused'||mode==='idle'&&!hasLearned();$('#dialog-menu').hidden=mode==='idle';$('#dialog-skip').hidden=!(mode==='idle'&&!hasLearned()||mode==='paused'&&resumeMode==='tutorial');$('#dialog-skip').textContent=mode==='paused'?'Пропустить обучение':'Играть без обучения';modal(true);
}
function start(options={}){tutorial=null;game=new ShiftGame(options);mode='playing';recorded=false;idle.reset();clearPresentation();modal(false);$('#pause').disabled=false;$('#restart').disabled=false;last=performance.now();render();gateButtons[1].focus({preventScroll:true});}
function beginTutorial(){tutorial=new Tutorial();revision=tutorial.revision;mode='tutorial';clearPresentation();modal(false);last=performance.now();render();}
function menu(){tutorial=null;game=new ShiftGame();mode='idle';idle.reset();clearPresentation();render();setDialog('PARKING MANAGER','Всё под контролем?','Пропускай машины с белыми номерами. Три столкновения — конец смены.','Участвовать');}
function beginDemo(){tutorial=null;game=new ShiftGame({difficultyAt:75});mode='demo';clearPresentation();modal(false);render();$('#attract-screen').focus({preventScroll:true});}
function pause(){if(!['playing','tutorial'].includes(mode)||mode==='playing'&&game.status!=='running')return;resumeMode=mode;mode='paused';setDialog('ПАУЗА','Поток подождёт.','Машины остановлены. Продолжи, когда будешь готов.','Продолжить');render();}
function resume(){if(mode!=='paused')return;mode=resumeMode;modal(false);lastTip='';last=performance.now();render();if(mode==='playing')gateButtons[1].focus({preventScroll:true});}
function tap(lane=1){let accepted=false;if(mode==='tutorial')accepted=tutorial.tap(lane);else if(mode==='playing')accepted=game.tap(lane);if(accepted)unlockAudio();consume();render();return accepted;}
function consume(){
  const outcomes=[];
  for(const event of tutorial?tutorial.drainEvents():game.drainEvents()){
    const lane=event.car?.lane??event.lane??1;beep(event.type);
    if(['pass','penalty','crash','explode'].includes(event.type)){
      fx.push({...event,lane});outcomes.push(event.type);
    }
    if(event.type==='end'&&!tutorial&&mode!=='demo'){if(!recorded){profile.record(game.score);recorded=true;}mode='result';idle.reset();$('#pause').disabled=true;setDialog('СМЕНА ЗАВЕРШЕНА',event.reason==='time'?'Пять минут позади!':'Попробуем ещё?',`Твой счёт: ${game.score}. Пропущено машин: ${game.passed}.`,'Ещё раз');}
  }
  if(outcomes.length){
    const penalties=outcomes.filter(t=>t==='penalty').length,crashes=outcomes.filter(t=>t==='crash').length,passes=outcomes.filter(t=>t==='pass').length,bad=penalties+crashes>0;
    // Simultaneous outcomes share the notice. A successful car cannot immediately
    // erase a penalty or collision notification from another lane.
    if(bad||feedbackPriority===0||clock()>feedbackUntil){
      const messages=[];
      if(penalties)messages.push(`Черный список! Штраф ${15*penalties} очков.`);
      if(crashes)messages.push(`${crashes>1?'Столкновения':'Столкновение'}: −${crashes} ${crashes===1?'жизнь':'жизни'}.`);
      const span=document.createElement('span');span.textContent=tutorial&&bad?'Учебная попытка. Жизни сохранены.':bad?messages.join(' '):passes?`Проезд разрешён! +${5*passes} очков.`:'Чёрный список. Проезд запрещён!';
      if(bad)span.className='bad';$('#feedback').replaceChildren(span);feedbackUntil=clock()+1.7;feedbackPriority=bad?1:0;
    }
  }
}

function tutorialNext(){if(mode!=='tutorial')return;const action=tutorial.next();if(action==='complete'){rememberTraining('completed');start();return;}if(revision!==tutorial.revision){revision=tutorial.revision;clearPresentation();}consume();render();}
function skipTutorial(){rememberTraining('skipped');start();}
function advance(dt){if(mode==='playing')game.update(dt);else if(mode==='tutorial')tutorial.update(dt);else if(mode==='demo'&&!document.hidden){advanceDemo(game,dt);if(game.status==='ended'){beginDemo();}}else if(idle.update(dt,mode,document.hidden))beginDemo();consume();render();}
function render(){
  soundtrack.setActive(['playing','tutorial'].includes(mode)&&!document.hidden);
  const training=Boolean(tutorial),games=sessions(),active=training?tutorial.allowed:[0,1,2,3],now=clock();document.body.classList.toggle('tutorial-mode',training);
  $('.road-label>span:first-child').textContent=mode==='demo'?'ДЕМОНСТРАЦИЯ · АВТОИГРА':training?'УЧЕБНАЯ ПАРКОВКА · БЕЗ ПОТЕРИ ЖИЗНЕЙ':flowDifficulty(game.time).phase;
  const dim=active.join(',');if(dim!==lastDim){lastDim=dim;$('#lane-dim').innerHTML=lanes.map((y,i)=>active.includes(i)?'':rect(0,y+5,1920,184,'#153b2b','opacity=".24"')).join('');}
  const cars=allCars(),visibleKeys=new Set(cars.map(c=>`${c.lane}:${c.id}`));
  for(const [key,n] of nodes)if(!visibleKeys.has(key)){n.car.remove();n.plate.remove();nodes.delete(key);}
  for(const c of cars){
    const i=c.lane,key=`${i}:${c.id}`,g=games[i];
    if(!nodes.has(key)){
      const temp=document.createElementNS('http://www.w3.org/2000/svg','svg');temp.innerHTML=carArt({...c,x:0});const sprite=temp.firstElementChild;vehicles.append(sprite);
      const plate=document.createElement('div');plate.className=`plate ${c.black?'black':''}`;plate.dataset.lane=i;plate.dataset.car=c.id;plate.innerHTML=`<span class="symbol" aria-hidden="true">${c.black?'×':'✓'}</span><span>${c.plate}</span>`;plate.setAttribute('aria-label',`Номер ${c.plate}, ${c.black?'чёрный список':'можно пропустить'}`);plates.append(plate);nodes.set(key,{id:c.id,lane:i,car:sprite,plate});
    }
    const n=nodes.get(key),x=c.front-c.width+20,age=c.resolvedAt===null?0:g.time-c.resolvedAt;
    const shake=c.state==='crashed'&&age<.15?Math.sin(age*110)*4:0,skid=c.black&&c.state==='passing'&&age<.45?Math.sin(age*65)*2.5:0;
    n.car.setAttribute('transform',`translate(${x+shake} ${lanes[i]+84+skid})`);n.car.style.visibility=c.state==='exploded'?'hidden':'visible';
    const plateX=clamp(x+4,48,1206);n.plate.style.transform=`translate(${plateX}px, ${lanes[i]+132}px)`;n.plate.style.setProperty('--tail',`${clamp(x+85-plateX,12,184)}px`);n.plate.classList.toggle('hidden',!c.revealed);n.plate.classList.toggle('resolved',c.state!=='approaching');
  }
  const barrierKey=games.map(g=>`${g.lane}:${g.gateAmount().toFixed(4)}:${g.canPass()}`).join('/')+dim;
  if(barrierKey!==lastBarrier){lastBarrier=barrierKey;barriers.innerHTML=lanes.map((_,i)=>{const g=games.find(g=>g.lane===i);return gateArt(i,g?.gateAmount()??0,g?.canPass()??false,active.includes(i));}).join('');}
  for(let i=0;i<4;i++){const g=games.find(g=>g.lane===i),b=gateButtons[i],amount=g?.gateAmount()??0;b.hidden=training&&!active.includes(i);b.classList.toggle('open',amount>.98);b.classList.toggle('busy',Boolean(g&&g.time<g.gate.readyAt));b.disabled=mode==='tutorial'?!tutorial.canTap(i):!(mode==='playing'&&game.status==='running');b.setAttribute('aria-label',`Шлагбаум ${i+1}: ${amount>.98?'поднят':amount>0?'движется':'закрыт'}. Нажать, чтобы открыть`);}
  let marks='';fx=fx.filter(f=>now-f.time<1.5);
  for(const f of fx){
    const age=now-f.time,y=lanes[f.lane],c=cars.find(c=>c.lane===f.lane&&c.id===f.car.id);
    if(f.type==='pass'&&age<1)marks+=text('+5',1450,y+44-age*12,28,'#e5f9bc','font-family="Pixel,monospace"');
    if(f.type==='penalty'&&c?.id===f.car.id&&age<1.1){const x=c.front-c.width-12;marks+=rect(x-50,y+118,95,5,'#33413c',`opacity="${1-age/1.1}"`)+rect(x-45,y+74,85,4,'#33413c',`opacity="${1-age/1.1}"`);for(let i=0;i<9;i++){const spread=(age+i*.085)%1;marks+=rect(x-spread*84,y+86+(i%3)*11,8+spread*17,8+spread*12,spread<.4?'#d6d8c6':'#94a398',`opacity="${1-spread}"`);}marks+=text('−15',1440,y+44-age*12,28,'#ffe0a8','font-family="Pixel,monospace"');}
    if(f.type==='crash'&&c?.id===f.car.id&&c.state==='crashed'&&age<.95){const x=RULES.gateX-f.car.width+105,h=Math.floor(age*9)%2?0:-9;marks+=rect(x,y+53,18,19,'#39708b')+rect(x+2,y+38,14,16,'#e4b887')+rect(x+3,y+35,13,5,'#684b35')+rect(x+16,y+52+h,16,7,'#d5a775')+rect(x+28,y+46+h,9,12,'#f1c79b');}
    if(f.type==='explode'&&age<.95){const spread=Math.min(1,age*4);for(let i=0;i<21;i++){const a=i*2.399,r=spread*(15+i%5*9),s=Math.max(3,18-age*14);marks+=rect(1480+Math.cos(a)*r,y+84+Math.sin(a)*r,s,s,age>.5?'#adb29d':['#fbe2a3','#ecaa55','#d37840'][i%3]);}}
  }
  effects.innerHTML=marks;if(now>feedbackUntil)$('#feedback').innerHTML='';
  const score=training?tutorial.score:game.score,lives=training?3:game.lives,seconds=Math.max(0,Math.ceil(300-(game.finishedTime??game.time))),hud=`${training}/${score}/${lives}/${seconds}`;
  if(hud!==lastHud){lastHud=hud;$('#score-label').textContent=training?'УЧЕБНЫЙ СЧЁТ':'СЧЁТ';$('#time-label').textContent=training?'БЕЗ ТАЙМЕРА':'ДО КОНЦА СМЕНЫ';$('#lives-label').textContent=training?'БЕЗ ПОТЕРЬ':'ЖИЗНИ';$('#score').textContent=score<0?`−${String(-score).padStart(4,'0')}`:String(score).padStart(5,'0');$('#time').textContent=training?'УЧЁБА':`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;$('#time-fill').style.width=`${training?100:seconds/3}%`;$('#lives').setAttribute('aria-label',`Жизней: ${lives}`);$('#lives').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 46 40" aria-hidden="true"><path d="M0 6H6V0H18V6H24V0H36V6H42V18H36V24H30V30H24V36H18V30H12V24H6V18H0Z" fill="${i<lives?'#f3d09a':'#378460'}"/></svg>`).join('');}
  renderTutorial();
}
function renderTutorial(){
  const visible=mode==='tutorial';$('#training-panel').hidden=!visible;$('#training-controls').hidden=!visible;const v=tutorial?.view();
  for(const n of nodes.values())n.plate.classList.toggle('tutorial-focus',visible&&v?.plateLane===n.lane);
  for(let i=0;i<4;i++)gateButtons[i].classList.toggle('tutorial-focus',visible&&v?.fingerLane===i);
  const finger=$('#tutorial-finger');finger.hidden=!visible||v?.fingerLane===null||!v;if(!finger.hidden)finger.style.top=`${lanes[v.fingerLane]+62}px`;
  $('#game-controls').hidden=Boolean(tutorial);
  if(!visible)return;const key=JSON.stringify(v);if(key===lastTip)return;lastTip=key;$('#tutorial-step').textContent=`${v.step} / ${v.total}`;$('#tutorial-title').textContent=v.title;$('#tutorial-text').textContent=v.copy;$('#tutorial-next').hidden=!v.button;$('#tutorial-next').textContent=v.button;if(v.phase==='tap')gateButtons[v.fingerLane].focus({preventScroll:true});else if(v.button)$('#tutorial-next').focus({preventScroll:true});
}
function resize(){const s=Math.min(innerWidth/1920,innerHeight/1080);stage.style.transform=`scale(${s})`;stage.style.left=`${(innerWidth-1920*s)/2}px`;stage.style.top=`${(innerHeight-1080*s)/2}px`;}
addEventListener('resize',resize);resize();
for(const event of ['pointerdown','click','keydown','wheel','input'])addEventListener(event,e=>{idle.reset();if(mode==='demo'&&(event==='click'||event==='keydown')&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();menu();}},true);
addEventListener('pointermove',()=>{if(mode!=='demo')idle.reset();},{passive:true});
for(const [i,b] of gateButtons.entries()){b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();b.focus({preventScroll:true});tap(i);});b.addEventListener('click',e=>{if(e.detail===0)tap(i);});}
addEventListener('keydown',e=>{
  if(!$('#overlay').classList.contains('hidden')&&e.key==='Tab'){const buttons=[...$('#overlay').querySelectorAll('button,input')].filter(b=>b.getClientRects().length&&!b.disabled),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  if(e.target instanceof HTMLInputElement){if(e.key==='Enter'){e.preventDefault();$('#start').click();}return;}
  if(e.repeat)return;const key=/^(?:Digit|Numpad)([1-4])$/.exec(e.code);if(key){e.preventDefault();tap(Number(key[1])-1);}if(e.code==='Escape'){if(mode==='paused')resume();else pause();}
});
$('#start').addEventListener('click',()=>{if(mode==='idle'&&!selectPlayer())return;unlockAudio();if(mode==='paused')resume();else if(mode==='idle'&&!hasLearned())beginTutorial();else start();});
$('#dialog-training').addEventListener('click',()=>{if(mode==='idle'&&!selectPlayer())return;unlockAudio();beginTutorial();});$('#dialog-menu').addEventListener('click',menu);$('#dialog-skip').addEventListener('click',()=>{if(mode==='idle'&&!selectPlayer())return;unlockAudio();skipTutorial();});
$('#nickname').value=profile.data.nickname;$('#nickname').addEventListener('input',()=>{$('#nickname-error').textContent='';$('#nickname').removeAttribute('aria-invalid');personal();});
$('#tutorial-next').addEventListener('click',tutorialNext);$('#tutorial-skip').addEventListener('click',skipTutorial);$('#training-pause').addEventListener('click',pause);
$('#pause').addEventListener('click',pause);$('#restart').addEventListener('click',()=>{unlockAudio();start();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('blur',pause);
function audioButtons(){for(const name of ['sound','music'])for(const b of document.querySelectorAll(`[data-audio="${name}"]`)){const enabled=profile.data.settings[name];b.textContent=`${name==='sound'?'Звук':'Музыка'}: ${enabled?'вкл.':'выкл.'}`;b.setAttribute('aria-pressed',String(enabled));}}
for(const b of document.querySelectorAll('[data-audio]'))b.addEventListener('click',()=>{const name=b.dataset.audio,value=!profile.data.settings[name];profile.setting(name,value);soundtrack.configure(name,value);if(value)unlockAudio();audioButtons();personal();});audioButtons();
for(const b of document.querySelectorAll('[data-fullscreen]'))b.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{b.textContent='Используйте F11';}});
function frame(now){if(last===0)last=now;const dt=Math.min((now-last)/1000,.05);last=now;if(!manualClock)advance(dt);requestAnimationFrame(frame);}
menu();requestAnimationFrame(frame);
if(__TEST__&&new URLSearchParams(location.search).has('test')){
  window.__parkingShiftTest={reset:(o={})=>{manualClock=true;start({autoSpawn:false,...o});},spawn:(o={})=>{const ok=game.spawn(o);consume();render();return ok;},advance,open:tap,pause,resume,realtime:()=>{manualClock=false;last=performance.now();},tempo:value=>{game.difficultyAt=value;},snapshot:()=>({mode,time:game.time,status:game.status,reason:game.reason,score:game.score,lives:game.lives,total:game.total,blackCount:game.blackCount,cars:game.cars.map(c=>({...c})),gates:game.lanes.map(g=>({...g.gate,amount:g.gateAmount(),canPass:g.canPass()})),audioState:soundtrack.context?.state??'none'}),difficulty};
  window.__parkingReleaseTest={advance,menu:()=>{manualClock=true;menu();},snapshot:()=>({mode,idle:idle.seconds,profile:structuredClone(profile.data),persistent:profile.persistent,audio:soundtrack.snapshot()}),music:()=>{const a=soundtrack.buffer?.getChannelData(0);return a?Array.from(a):null;}};
  // Legacy single-car regression fixtures now exercise the full shift model.
  window.__parkingLaneTest={...window.__parkingShiftTest,spawn:(o={})=>window.__parkingShiftTest.spawn({lane:1,...o}),snapshot:()=>{const s=window.__parkingShiftTest.snapshot();return {...s,car:s.cars[0]??null,gate:s.gates[1]};}};
  window.__parkingTutorialTest={start:()=>{manualClock=true;beginTutorial();},advance,next:tutorialNext,tap,skip:skipTutorial,menu,clearSeen:()=>{seenInSession=false;localStorage.removeItem(trainingKey);menu();},snapshot:()=>({mode,remembered:hasLearned(),tutorial:tutorial?{...tutorial.view(),time:tutorial.time,revision:tutorial.revision,score:tutorial.score,cars:tutorial.games.map(g=>g.car?{...g.car}:null),lives:tutorial.games.map(g=>g.lives),gates:tutorial.games.map(g=>({...g.gate,amount:g.gateAmount()}))}:null,game:{time:game.time,score:game.score,lives:game.lives,total:game.total}})};
}
