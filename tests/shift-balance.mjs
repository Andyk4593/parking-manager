import fs from 'node:fs';
import {ShiftGame,flowDifficulty,FLOW} from '../web/src/shift-model.mjs';
const seeded=n=>()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/2**32);
const modes=['precise','limited_attention','spam_all','hold_once','none'];
const runs=[];
for(const mode of modes)for(let seed=1;seed<=60;seed++){
 const g=new ShiftGame({random:seeded(seed)}),pending=new Map();let nextAction=0,peak=0,actions=0,minGap=Infinity,previousT=0;
 const segments=[0,0,0,0,0];
 while(g.status!=='ended'){
  if(mode==='hold_once'&&g.time===0)for(let i=0;i<4;i++)g.tap(i);
  if(mode==='spam_all'&&g.time>=nextAction){for(let i=0;i<4;i++)if(g.tap(i))actions++;nextAction=g.time+.08;}
  if(mode==='precise'||mode==='limited_attention'){
   const candidates=g.cars.filter(c=>c.state==='approaching'&&c.revealed&&!c.black).sort((a,b)=>a.arrivalAt-b.arrivalAt);
   for(const c of candidates){
    if(!pending.has(c.id))pending.set(c.id,g.time+(mode==='precise'?0:.3));
    if(c.arrivalAt-g.time<=.32&&g.time>=pending.get(c.id)&&(mode==='precise'||g.time>=nextAction)){
     if(g.tap(c.lane)){actions++;nextAction=g.time+.45;}
    }
   }
  }
  g.update(1/60);peak=Math.max(peak,g.cars.length);
  for(const e of g.drainEvents())if(e.type==='spawn'){segments[Math.min(4,Math.floor(g.time/60))]++;if(previousT)minGap=Math.min(minGap,g.time-previousT);previousT=g.time;}
 }
 runs.push({mode,seed,time:g.finishedTime,score:g.score,lives:g.lives,reason:g.reason,total:g.total,passed:g.passed,black:g.blackCount,penalties:g.penalties,peak,actions,segments,minSpawnGap:minGap});
}
const median=v=>{v.sort((a,b)=>a-b);return(v[29]+v[30])/2;};
const summary=modes.map(mode=>{const r=runs.filter(r=>r.mode===mode);return {mode,runs:r.length,completed:r.filter(r=>r.reason==='time').length,medianSeconds:+median(r.map(r=>r.time)).toFixed(2),medianScore:median(r.map(r=>r.score)),meanCars:+(r.reduce((s,r)=>s+r.total,0)/r.length).toFixed(1),peak:Math.max(...r.map(r=>r.peak)),meanCarsPerMinute:[0,1,2,3,4].map(i=>+(r.reduce((s,r)=>s+r.segments[i],0)/r.length).toFixed(1))};});
const perfect=runs.filter(r=>r.mode==='precise');
if(perfect.some(r=>r.reason!=='time'||r.lives!==3||r.penalties>0))throw new Error('Generated flow cannot be served perfectly');
if(summary.find(s=>s.mode==='spam_all').medianScore>=summary[0].medianScore*.4)throw new Error('Spam is too competitive');
const report={date:new Date().toISOString(),status:'PASS',note:'Synthetic policies, not evidence of human difficulty or enjoyment. Limited attention: 300ms recognition + 450ms between actions.',curve:[0,30,75,150,240,300].map(t=>({seconds:t,...flowDifficulty(t)})),limits:FLOW,summary,runs};
fs.mkdirSync('output/balance',{recursive:true});fs.writeFileSync('output/balance/shift-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(summary,null,2));
