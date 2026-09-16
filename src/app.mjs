import { ParkingGame, difficulty, seededRandom } from './model.mjs';
import { RoadRenderer, LANE_Y } from './renderer.mjs';
import { Chiptune } from './audio.mjs';
const $ = id => document.getElementById(id);
const audio = new Chiptune();
const ui = { mode:'lobby', name:'', lastActivity:performance.now(), count:3, countdown:0, endDelay:0, epoch:0, rows:[], locale:'ru', toastUntil:0, previous:'playing' };
let game = new ParkingGame({ demo:true, random:seededRandom(39) }), road;
game.time=25;game.update(8);game.drainEvents();
const defaults=[{name:'Вася',score:90},{name:'Петя',score:60},{name:'Толик',score:30}];
const localBridge={
  async ranking(){try{return {entries:JSON.parse(localStorage.getItem('parking-leaderboard'))||defaults,warning:''};}catch{return {entries:defaults,warning:''};}},
  async save(name,score){const {entries}=await this.ranking();const same=entries.find(e=>e.name.toLowerCase()===name.toLowerCase());if(same)same.score=Math.max(same.score,score);else entries.push({name,score});entries.sort((a,b)=>b.score-a.score);try{localStorage.setItem('parking-leaderboard',JSON.stringify(entries.slice(0,10)));return {entries:entries.slice(0,10),warning:''};}catch{return {entries:entries.slice(0,10),warning:'Рейтинг не сохранён. Хранилище браузера недоступно.'};}},
  fullscreen(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();},
  quit(){showLobby();}
};
const bridge=window.parking||localBridge;
function resize(){const scale=Math.min(innerWidth/1920,innerHeight/1080);$('stage').style.transform=`scale(${scale})`;$('stage').style.left=`${(innerWidth-1920*scale)/2}px`;$('stage').style.top=`${(innerHeight-1080*scale)/2}px`;}
window.addEventListener('resize',resize);resize();
function show(id,visible){$(id).classList.toggle('hidden',!visible);}
function mode(next){ui.mode=next;for(const name of ['lobby','attract','countdown','result','paused'])show(name,next===name);$('gate-controls').style.pointerEvents=next==='playing'?'auto':'none';$('pause').disabled=!['playing','paused'].includes(next);}
function storage(snapshot){ui.rows=snapshot.entries;show('storage-warning',!!snapshot.warning);$('storage-warning').textContent=snapshot.warning||'';renderLeaders();}
function renderLeaders(){const list=$('leader-list');list.replaceChildren();for(let i=0;i<10;i++){const e=ui.rows[i],li=document.createElement('li');if(!e)li.className='rank-empty';for(const [cl,value]of[['rank',String(i+1).padStart(2,'0')],['rank-name',e?.name||'—'],['rank-score',e?String(e.score):'—']]){const span=document.createElement('span');span.className=cl;span.textContent=value;li.append(span);}list.append(li);}}
function previewGame(){game=new ParkingGame({demo:true});game.time=25;game.update(8);game.drainEvents();road?.reset();}
function showLobby(){ui.epoch++;ui.lastActivity=performance.now();ui.name='';previewGame();mode('lobby');$('nickname').value='';$('name-error').textContent='';$('player-label').textContent='';$('mode-label').textContent='ГОРОДСКАЯ ПАРКОВКА';hideToast();refreshHUD();}
function start(name){const clean=name.normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,16);if(!clean){$('name-error').textContent='Введи ник — хотя бы одну букву или цифру.';$('nickname').focus();return false;}
  ui.name=clean;ui.epoch++;game=new ParkingGame();road?.reset();ui.count=3;ui.countdown=0;mode('countdown');$('countdown-number').textContent='3';$('player-label').textContent=' / '+clean;$('mode-label').textContent='СМЕНА ОТКРЫТА';hideToast();audio.play('tick');refreshHUD();return true;
}
function beginAttract(){game=new ParkingGame({demo:true});game.time=30;game.update(8);game.drainEvents();road?.reset();mode('attract');$('mode-label').textContent='ДЕМОНСТРАЦИЯ';$('player-label').textContent='';hideToast();}
function togglePause(){if(ui.mode==='playing'){mode('paused');hideToast();}else if(ui.mode==='paused')mode('playing');}
function hideToast(){ui.toastUntil=0;$('toast').classList.remove('visible');}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');ui.toastUntil=performance.now()+2200;}
function tap(lane){if(ui.mode==='playing'){game.tap(lane);processEvents();}}
function processEvents(){for(const e of game.drainEvents()){
  road?.event(e);
  if(ui.mode==='playing'){
    if(e.type==='penalty')toast('Черный список! Штраф 15 очков.');
    if(e.type==='crash')toast('Столкновение! Потеряна 1 жизнь.');
    if(e.type!=='reveal'&&e.type!=='end')audio.play(e.type);
    if(e.type==='end'){ui.endDelay=1.15;mode('ending');audio.play('end');}
  }
}}
function clock(seconds){const s=Math.floor(seconds+1e-6);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function refreshHUD(){const idle=ui.mode==='lobby',d=difficulty(game.time);$('score').textContent=idle?'00000':(game.score<0?'−'+String(-game.score).padStart(4,'0'):String(game.score).padStart(5,'0'));$('timer').textContent=idle?'00:00':clock(game.time);
  const life=idle?3:game.lives;$('lives').replaceChildren();for(let i=0;i<3;i++){const s=document.createElement('span');s.textContent='♥'+(i<2?' ':'');s.className=i<life?'':'heart-off';$('lives').append(s);}$('lives').setAttribute('aria-label',`${life} жизни`);
  $('level-label').textContent='УРОВЕНЬ '+String(idle?1:d.level).padStart(2,'0');$('difficulty-fill').style.width=(idle?10:d.level*10)+'%';
  for(let i=0;i<4;i++){const b=$('gate-'+i),l=game.lanes[i],open=game.time<l.gateUntil;b.classList.toggle('open',open);b.classList.toggle('cooldown',!open&&game.time<l.readyAt);b.querySelector('.gate-word').textContent=open?'ОТКРЫТО':game.time<l.readyAt?'ПОДОЖДИ':'НАЖМИ';}
}
async function finish(){const epoch=ui.epoch;mode('result');hideToast();$('result-title').textContent=game.reason==='time'?'ОТЛИЧНАЯ СМЕНА!':'ПАРКОВКА ЗАКРЫТА';$('result-player').textContent=ui.name;$('result-score').textContent=String(game.score);$('result-stats').replaceChildren();
  for(const [label,value]of[['ВРЕМЯ',clock(game.time)],['ПРОПУЩЕНО',game.passed],['ОСТАНОВЛЕНО',game.blocked]]){const s=document.createElement('span'),b=document.createElement('b');b.textContent=value;s.append(b,document.createTextNode(label));$('result-stats').append(s);}
  $('result-rank').textContent='Сохраняем результат…';$('again').disabled=true;$('to-lobby').disabled=true;
  try{const data=await bridge.save(ui.name,game.score);if(epoch!==ui.epoch)return;storage(data);const rank=data.entries.findIndex(e=>e.name.toLowerCase()===ui.name.toLowerCase());$('result-rank').textContent=data.warning?'Результат есть в этой игре. Запись на диск не удалась.':rank>=0?`ТВОЁ ЛУЧШЕЕ МЕСТО: ${rank+1} / 10`:'Ещё немного — и ты в десятке!';}
  catch{if(epoch!==ui.epoch)return;$('result-rank').textContent='Не удалось сохранить результат';show('storage-warning',true);$('storage-warning').textContent='Рейтинг не сохранён. Проверьте права записи в папку игры.';}
  finally{if(epoch===ui.epoch){$('again').disabled=false;$('to-lobby').disabled=false;ui.lastActivity=performance.now();}}
}
const keyboardLayouts={ru:['ЙЦУКЕНГШЩЗХЪ','ФЫВАПРОЛДЖЭ','ЯЧСМИТЬБЮ'],en:['QWERTYUIOP','ASDFGHJKL','ZXCVBNM']};
function buildKeyboard(){const root=$('keyboard');root.replaceChildren();for(const chars of keyboardLayouts[ui.locale]){const row=document.createElement('div');row.className='key-row';for(const char of chars){const b=document.createElement('button');b.type='button';b.className='key';b.textContent=char;b.addEventListener('click',()=>{if($('nickname').value.length<16)$('nickname').value+=char;});row.append(b);}root.append(row);}
  const row=document.createElement('div');row.className='key-row';for(const [title,cl,fn]of[[ui.locale==='ru'?'RU → EN':'EN → RU','wide',()=>{ui.locale=ui.locale==='ru'?'en':'ru';buildKeyboard();}],[ui.locale==='num'?'АБВ':'123','wide',()=>{ui.locale=ui.locale==='num'?'ru':'num';buildKeyboard();}],['ПРОБЕЛ','space',()=>{if($('nickname').value.length<16)$('nickname').value+=' ';}],['⌫','wide',()=>{$('nickname').value=$('nickname').value.slice(0,-1);} ]]){const b=document.createElement('button');b.type='button';b.className='key '+cl;b.textContent=title;b.addEventListener('click',fn);row.append(b);}root.append(row);
}
// Numeric row is a real keyboard mode, not a dependency on the Windows touch keyboard.
keyboardLayouts.num=['1234567890','_-'];
buildKeyboard();
function activity(event){ui.lastActivity=performance.now();if(event.type==='pointerdown'||event.type==='keydown'){audio.unlock();if(ui.mode==='attract'){showLobby();event.preventDefault();event.stopImmediatePropagation();}}}
document.addEventListener('pointerdown',activity,true);document.addEventListener('keydown',activity,true);
document.addEventListener('pointermove',()=>{if(ui.mode!=='attract')ui.lastActivity=performance.now();},{passive:true});
document.addEventListener('contextmenu',e=>e.preventDefault());
$('join-form').addEventListener('submit',e=>{e.preventDefault();start($('nickname').value);});
$('nickname').addEventListener('input',()=>{$('name-error').textContent='';});
for(let i=0;i<4;i++){const b=document.createElement('button');b.id='gate-'+i;b.className='gate-hit';b.style.top=(LANE_Y[i]*2-77)+'px';b.setAttribute('aria-label',`Открыть шлагбаум ${i+1}`);b.innerHTML=`<span class="number">${i+1}</span><span class="gate-word">НАЖМИ</span>`;b.addEventListener('pointerdown',e=>{e.preventDefault();tap(i);});b.addEventListener('click',e=>{if(e.detail===0)tap(i);});$('gate-controls').append(b);}
document.addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.key==='Escape'){e.preventDefault();togglePause();return;}
  if(ui.mode==='playing'&&/^(Digit|Numpad)[1-4]$/.test(e.code)){e.preventDefault();tap(Number(e.code.slice(-1))-1);}
});
$('sound').addEventListener('click',()=>{audio.enabled=!audio.enabled;$('sound').setAttribute('aria-pressed',String(!audio.enabled));$('sound').setAttribute('aria-label',audio.enabled?'Выключить звук':'Включить звук');$('sound').firstChild.textContent=audio.enabled?'♪':'×';});
$('pause').addEventListener('click',togglePause);$('resume').addEventListener('click',togglePause);$('abandon').addEventListener('click',showLobby);
$('fullscreen').addEventListener('click',()=>bridge.fullscreen());$('wake').addEventListener('click',showLobby);$('exit').addEventListener('click',()=>bridge.quit());
$('again').addEventListener('click',()=>start(ui.name));$('to-lobby').addEventListener('click',showLobby);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ui.mode==='playing')mode('paused');});
let hudAccumulator=0;
function frame(dt){
  if(ui.mode==='lobby'||ui.mode==='result'){if(performance.now()-ui.lastActivity>=30000)beginAttract();}
  if(ui.mode==='playing'||ui.mode==='attract'){game.update(Math.min(dt,.2));processEvents();if(ui.mode==='attract'&&game.status==='ended')beginAttract();}
  if(ui.mode==='countdown'){ui.countdown+=dt;if(ui.countdown>=1){ui.countdown-=1;ui.count--;if(ui.count===0){mode('playing');audio.play('start');}else{$('countdown-number').textContent=String(ui.count);audio.play('tick');}}}
  if(ui.mode==='ending'){ui.endDelay-=dt;if(ui.endDelay<=0)finish();}
  if(ui.toastUntil&&performance.now()>ui.toastUntil)hideToast();
  road.render(game,ui.mode==='paused'?0:dt);hudAccumulator+=dt;if(hudAccumulator>.05){hudAccumulator=0;refreshHUD();}
}
class MainScene extends Phaser.Scene{create(){road=new RoadRenderer(this);refreshHUD();}update(_time,delta){frame(Math.min(delta/1000,.2));}}
async function boot(){await document.fonts.ready;try{storage(await bridge.ranking());}catch{storage({entries:defaults,warning:'Не удалось открыть файл рейтинга.'});}
  mode('lobby');new Phaser.Game({type:Phaser.CANVAS,width:1920,height:1080,parent:'world',transparent:true,pixelArt:true,antialias:false,roundPixels:true,banner:false,audio:{noAudio:true},fps:{target:60,smoothStep:false},scene:MainScene});
}
if(new URLSearchParams(location.search).get('test')==='1')window.__parkingTest={
  snapshot:()=>({mode:ui.mode,time:game.time,score:game.score,lives:game.lives,status:game.status,rows:ui.rows,name:ui.name,lanes:game.lanes,fx:road?.fx, audioState:audio.ctx?.state}),
  skipCountdown:()=>{if(ui.mode==='countdown')mode('playing');},
  fixture:({lane=0,black=false,stage=6,clear=true}={})=>{if(clear)game.lanes.forEach(l=>{l.cars=[];l.gateUntil=0;l.readyAt=0;});game.spawnIn=100;game.lanes[lane].cars.push({id:++game.total,black,stage,clock:0,step:.8,type:['sedan','crossover','minivan','truck','convertible'][game.total%5],color:game.total%2?'#e8e5d9':'#262c32',plate:'123'});refreshHUD();},
  idle:()=>{ui.lastActivity=performance.now()-30001;},
  advance:seconds=>{game.update(seconds);processEvents();refreshHUD();},
  time:seconds=>{game.time=seconds;},
  freeze:()=>{mode('paused');show('paused',false);},
  setScene:()=>{road?.reset();game.lanes.forEach((l,i)=>{l.cars=[];l.gateUntil=0;l.readyAt=0;for(let j=0;j<2;j++)l.cars.push({id:i*2+j+1,stage:[[1,6],[0,4],[2,6],[1,5]][i][j],clock:0,step:1,black:i===2,color:['#e8e5d9','#d8ae4a','#262c32','#5e96b5'][i],type:i===1&&j===0?'convertible':['sedan','crossover','minivan','truck'][i],plate:String(214+i*132)});});game.spawnIn=100;game.score=185;game.time=74;},
};
boot();
