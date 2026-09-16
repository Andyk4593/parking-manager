import { ParkingGame, seededRandom, difficulty } from '../src/model.mjs';
import fs from 'node:fs';
const rows=[];
for(const reaction of [0,.2,.3,.4]){
 const times=[],scores=[];
 for(let seed=1;seed<=30;seed++){
  const g=new ParkingGame({random:seededRandom(seed)});
  while(g.status==='running'){
   g.update(.01);
   for(let i=0;i<4;i++){const car=g.lanes[i].cars.find(c=>c.stage===6&&!c.black);if(car&&car.clock>=reaction)g.tap(i);}
   g.drainEvents();
  }
  times.push(g.time);scores.push(g.score);
 }
 times.sort((a,b)=>a-b);
 rows.push({reactionMs:reaction*1000,minSeconds:Math.round(times[0]),medianSeconds:Math.round(times[15]),maxSeconds:Math.round(times[29]),meanScore:Math.round(scores.reduce((a,b)=>a+b)/scores.length)});
}
const report={description:'Synthetic agents, not human playtests. Reaction delay is per vehicle; no movement cost or decision mistakes.',runs:120,rows,curve:[0,30,60,180,360,480,540,600].map(t=>({seconds:t,...difficulty(t)}))};
fs.mkdirSync('test-output',{recursive:true});fs.writeFileSync('test-output/balance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
