import {createGate,openGate,gateAmount,canPass,protectRear} from './gate-model.mjs';
export const RULES=Object.freeze({duration:300,lives:3,pulse:.65,rise:.12,fall:.12,recovery:.16,spawnFront:320,gateX:1580,exitFront:2240,points:5,penalty:15});
export const TYPES=['sedan','crossover','minivan','truck','convertible'];
export const WIDTHS=Object.freeze({sedan:218,crossover:238,minivan:256,truck:254,convertible:218});
export const COLORS=['white','white','white','black','black','black','blue','red','yellow'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>v*v*(3-2*v);
const nodes=[[0,4.8,0],[30,4.5,0],[75,3.5,.15],[150,2.8,.3],[240,2,.42],[300,1.55,.5]];
export function difficulty(seconds){
  const time=clamp(seconds,0,300);let i=1;while(i<nodes.length-1&&time>nodes[i][0])i++;
  const a=nodes[i-1],b=nodes[i],k=smooth((time-a[0])/(b[0]-a[0]));
  const travel=a[1]+(b[1]-a[1])*k;
  return {travel,speed:(RULES.gateX-RULES.spawnFront)/travel,reveal:a[2]+(b[2]-a[2])*k};
}
export class LaneGame{
  constructor({random=Math.random,difficultyAt=null,autoSpawn=true,lane=1}={}){
    this.random=random;this.difficultyAt=difficultyAt;this.autoSpawn=autoSpawn;this.lane=lane;
    this.time=0;this.score=0;this.lives=3;this.status='running';this.reason='';
    this.car=null;this.total=0;this.blackCount=0;this.passed=0;this.blocked=0;this.penalties=0;
    this.nextSpawnAt=.4;this.events=[];this.finishAt=Infinity;
    this.gate=createGate();
  }
  emit(type,extra={}){this.events.push({type,time:this.time,...extra});}
  drainEvents(){return this.events.splice(0);}
  tap(){
    if(this.status!=='running'||!openGate(this.gate,this.time,RULES))return false;
    this.emit('open');return true;
  }
  gateAmount(at=this.time){return gateAmount(this.gate,at,RULES);}
  canPass(at=this.time){return canPass(this.gate,at,RULES);}
  spawn(overrides={}){
    if(this.car||this.status!=='running')return false;
    const total=++this.total,tempo=difficulty(this.difficultyAt??this.time);
    const black=overrides.black??(this.blackCount<Math.floor(total/10)&&this.random()<.1);
    if(black)this.blackCount++;
    const type=overrides.type??TYPES[Math.floor(this.random()*TYPES.length)];
    const c={id:total,lane:this.lane,type,width:WIDTHS[type],black,color:overrides.color??COLORS[Math.floor(this.random()*COLORS.length)],plate:String(100+Math.floor(this.random()*900)),spawnAt:this.time,front:RULES.spawnFront,speed:tempo.speed,revealAt:tempo.reveal,revealed:tempo.reveal===0,state:'approaching',resolvedAt:null};
    this.car=c;this.emit('spawn',{car:{...c}});return true;
  }
  resolve(c,at){
    if(c.state!=='approaching')return;
    c.resolvedAt=at;
    if(this.canPass(at)){
      c.state='passing';
      protectRear(this.gate,at,c,RULES);
      if(c.black){this.score-=15;this.penalties++;this.emit('penalty',{car:{...c},at});}
      else{this.score+=5;this.passed++;this.emit('pass',{car:{...c},at});}
    }else if(c.black){c.state='exploded';this.blocked++;this.emit('explode',{car:{...c},at});}
    else{c.state='crashed';this.lives--;this.emit('crash',{car:{...c},at});if(this.lives===0)this.finish('lives',at);}
  }
  finish(reason,at=this.time){
    if(this.status!=='running')return;
    this.status='finishing';this.reason=reason;this.finishedTime=Math.min(at,300);this.finishAt=this.time+.9;
    this.emit('finish',{reason});
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0||this.status==='ended')return;
    let remaining=dt;
    while(remaining>1e-9&&this.status!=='ended'){
      const tick=Math.min(remaining,1/120);remaining-=tick;
      this.time+=tick;
      if(this.status==='finishing'){
        // An already admitted car must keep clearing the arm during the end transition.
        if(this.car?.state==='passing'){
          this.car.front+=this.car.speed*tick;
          if(this.car.front>RULES.exitFront)this.car=null;
        }
        if(this.time+1e-9>=this.finishAt){this.status='ended';this.emit('end',{reason:this.reason});}
        continue;
      }
      if(this.time>=300-1e-9){this.time=300;this.finish('time');continue;}
      if(!this.car&&this.autoSpawn&&this.time>=this.nextSpawnAt)this.spawn();
      const c=this.car;if(!c)continue;
      if(c.state==='approaching'||c.state==='passing'){
        c.front=RULES.spawnFront+c.speed*(this.time-c.spawnAt);
        const progress=(c.front-RULES.spawnFront)/(RULES.gateX-RULES.spawnFront);
        if(!c.revealed&&progress+1e-9>=c.revealAt){c.revealed=true;this.emit('reveal');}
        if(c.state==='approaching'&&c.front>=RULES.gateX){
          const at=c.spawnAt+(RULES.gateX-RULES.spawnFront)/c.speed;
          this.resolve(c,at);
          if(c.state!=='passing')c.front=RULES.gateX;
        }
      }
      const removed=(c.state==='passing'&&c.front>RULES.exitFront)||(['crashed','exploded'].includes(c.state)&&this.time-c.resolvedAt>.95);
      if(removed){this.car=null;this.nextSpawnAt=this.time+.5;}
    }
  }
}
