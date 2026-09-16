import {RULES,TYPES,WIDTHS,COLORS,difficulty} from './lane-model.mjs';
import {createGate,openGate,gateAmount,canPass,protectRear} from './gate-model.mjs';
export const FLOW=Object.freeze({maxCars:8,maxPerLane:2,bodyGap:96,crashDuration:.95,guideLead:.32,safety:.04});
const smooth=v=>v*v*(3-2*v),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const nodes=[[0,4.8],[30,2.4],[75,1.6],[150,1],[240,.6],[300,.4]];
export function flowDifficulty(seconds){
  const t=clamp(seconds,0,300);let i=1;while(i<nodes.length-1&&t>nodes[i][0])i++;
  const a=nodes[i-1],b=nodes[i],k=smooth((t-a[0])/(b[0]-a[0]));
  return {...difficulty(t),interval:a[1]+(b[1]-a[1])*k,maxCars:t<30?1:t<75?2:t<150?4:t<240?6:8,phase:t<30?'СПОКОЙНЫЙ ПОТОК':t<75?'НАБИРАЕМ ТЕМП':t<150?'ЧАС ПИК':t<240?'ПЛОТНЫЙ ПОТОК':'ФИНАЛЬНЫЙ РЫВОК'};
}
export function arrivalGap(previous,speed){
  // Worst permitted opening, full rear clearance, recovery and enough time to
  // lift for the next car. A crash must also disappear before a follower reaches it.
  const gateClear=Math.max(RULES.pulse-RULES.rise,(previous.width+48)/previous.speed)+RULES.fall+RULES.recovery+FLOW.guideLead;
  const crashClear=FLOW.crashDuration+(previous.width+FLOW.bodyGap)/speed;
  return Math.max(gateClear,crashClear)+FLOW.safety;
}
class ShiftLane{
  constructor(owner,lane){this.owner=owner;this.lane=lane;this.gate=createGate();}
  get time(){return this.owner.time;}
  gateAmount(at=this.time){return gateAmount(this.gate,at,RULES);}
  canPass(at=this.time){return canPass(this.gate,at,RULES);}
}
export class ShiftGame{
  constructor({random=Math.random,difficultyAt=null,autoSpawn=true}={}){
    this.random=random;this.difficultyAt=difficultyAt;this.autoSpawn=autoSpawn;
    this.time=0;this.score=0;this.lives=3;this.status='running';this.reason='';
    this.cars=[];this.lanes=Array.from({length:4},(_,i)=>new ShiftLane(this,i));
    this.total=0;this.blackCount=0;this.passed=0;this.blocked=0;this.penalties=0;
    this.events=[];this.nextSpawnAt=.4;this.finishAt=Infinity;this.lastLane=-1;
  }
  emit(type,extra={}){this.events.push({type,time:this.time,...extra});}
  drainEvents(){return this.events.splice(0);}
  tap(lane){
    if(this.status!=='running'||!Number.isInteger(lane)||lane<0||lane>3)return false;
    if(!openGate(this.lanes[lane].gate,this.time,RULES))return false;
    this.emit('open',{lane});return true;
  }
  spawnPlan(lane,tempo){
    const existing=this.cars.filter(c=>c.lane===lane);
    if(existing.length>=FLOW.maxPerLane)return null;
    const previous=existing.at(-1),speed=previous?Math.min(tempo.speed,previous.speed):tempo.speed;
    const arrivalAt=this.time+(RULES.gateX-RULES.spawnFront)/speed;
    if(arrivalAt>=RULES.duration)return null;
    if(previous){
      if(previous.front-previous.width-RULES.spawnFront<FLOW.bodyGap)return null;
      if(arrivalAt-previous.arrivalAt<arrivalGap(previous,speed))return null;
    }
    return {speed,arrivalAt};
  }
  spawn(overrides={}){
    if(this.status!=='running')return false;
    const tempo=flowDifficulty(this.difficultyAt??this.time);
    if(this.cars.length>=tempo.maxCars)return false;
    let lane=overrides.lane;
    if(lane!==undefined&&(!Number.isInteger(lane)||lane<0||lane>3))return false;
    let eligible=[0,1,2,3].filter(i=>this.spawnPlan(i,tempo));
    if(lane===undefined){
      if(this.time<75&&eligible.length>1)eligible=eligible.filter(i=>i!==this.lastLane);
      if(!eligible.length)return false;
      lane=eligible[Math.floor(this.random()*eligible.length)];
    }
    const plan=this.spawnPlan(lane,tempo);if(!plan)return false;
    const total=++this.total,black=overrides.black??(this.blackCount<Math.floor(total/10)&&this.random()<.1);
    if(black)this.blackCount++;
    const type=overrides.type??TYPES[Math.floor(this.random()*TYPES.length)];
    const c={id:total,lane,type,width:WIDTHS[type],black,color:overrides.color??COLORS[Math.floor(this.random()*COLORS.length)],plate:String(100+Math.floor(this.random()*900)),spawnAt:this.time,front:RULES.spawnFront,speed:plan.speed,arrivalAt:plan.arrivalAt,revealAt:tempo.reveal,revealed:tempo.reveal===0,state:'approaching',resolvedAt:null};
    this.cars.push(c);this.lastLane=lane;this.emit('spawn',{car:{...c}});return true;
  }
  resolve(c){
    const at=c.arrivalAt,g=this.lanes[c.lane];c.resolvedAt=at;
    if(g.canPass(at)){
      c.state='passing';protectRear(g.gate,at,c,RULES);
      if(c.black){this.score-=15;this.penalties++;this.emit('penalty',{car:{...c},at});}
      else{this.score+=5;this.passed++;this.emit('pass',{car:{...c},at});}
    }else if(c.black){c.state='exploded';c.front=RULES.gateX;this.blocked++;this.emit('explode',{car:{...c},at});}
    else{c.state='crashed';c.front=RULES.gateX;this.lives--;this.emit('crash',{car:{...c},at});if(this.lives===0)this.finish('lives',at);}
  }
  finish(reason,at=this.time){
    if(this.status!=='running')return;
    this.status='finishing';this.reason=reason;this.finishedTime=Math.min(at,300);this.finishAt=this.time+.9;this.emit('finish',{reason});
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0||this.status==='ended')return;
    let remaining=dt;
    while(remaining>1e-9&&this.status!=='ended'){
      const tick=Math.min(remaining,1/120);remaining-=tick;this.time+=tick;
      if(this.status==='finishing'){
        for(const c of this.cars)if(c.state==='passing')c.front+=c.speed*tick;
        this.cars=this.cars.filter(c=>c.state!=='passing'||c.front<=RULES.exitFront);
        if(this.time+1e-9>=this.finishAt){this.status='ended';this.emit('end',{reason:this.reason});}
        continue;
      }
      if(this.time>=RULES.duration-1e-9){this.time=RULES.duration;this.finish('time');continue;}
      if(this.autoSpawn&&this.time+1e-9>=this.nextSpawnAt){
        const spawned=this.spawn(),d=flowDifficulty(this.difficultyAt??this.time);
        this.nextSpawnAt=this.time+(spawned?d.interval*(.85+this.random()*.3):.08);
      }
      for(const c of this.cars){
        if(c.state==='approaching'||c.state==='passing')c.front=RULES.spawnFront+c.speed*(this.time-c.spawnAt);
        if(c.state==='approaching'&&!c.revealed&&(c.front-RULES.spawnFront)/(RULES.gateX-RULES.spawnFront)+1e-9>=c.revealAt){c.revealed=true;this.emit('reveal',{lane:c.lane,id:c.id});}
      }
      // One shared life counter. Resolve ties consistently and stop at the third loss.
      const crossing=this.cars.filter(c=>c.state==='approaching'&&c.arrivalAt<=this.time+1e-9).sort((a,b)=>a.arrivalAt-b.arrivalAt||a.lane-b.lane||a.id-b.id);
      for(const c of crossing){if(this.status!=='running')break;this.resolve(c);}
      this.cars=this.cars.filter(c=>!(c.state==='passing'&&c.front>RULES.exitFront)&&!(['crashed','exploded'].includes(c.state)&&this.time-c.resolvedAt>FLOW.crashDuration));
    }
  }
}
