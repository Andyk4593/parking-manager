import test from 'node:test';
import assert from 'node:assert/strict';
import {LaneGame,RULES,difficulty,TYPES} from '../web/src/lane-model.mjs';
const fixture=(black=false,options={})=>{const g=new LaneGame({autoSpawn:false,...options});g.spawn({black,type:'sedan'});return g;};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('five minute curve increases speed and reveal position continuously',()=>{
  near(difficulty(0).reveal,0);near(difficulty(300).reveal,.5);let previous=difficulty(0);
  for(let t=.1;t<=300;t+=.1){const d=difficulty(t);assert.ok(d.speed>=previous.speed-1e-9);assert.ok(d.reveal>=previous.reveal-1e-9&&d.reveal<=.5);assert.ok(d.speed-previous.speed<2);previous=d;}
});
for(const black of [false,true])test(`plate reveal timing is identical for ${black?'black':'white'}`,()=>{
  const early=fixture(black,{difficultyAt:0});assert.equal(early.car.revealed,true);
  const late=fixture(black,{difficultyAt:300});late.update(difficulty(300).travel*.49);assert.equal(late.car.revealed,false);late.update(difficulty(300).travel*.02);assert.equal(late.car.revealed,true);
});
test('changing next-car tempo does not change current speed or re-hide plate',()=>{const g=fixture();const speed=g.car.speed;g.difficultyAt=300;g.update(.1);assert.equal(g.car.speed,speed);assert.equal(g.car.revealAt,0);assert.equal(g.car.revealed,true);});
test('tap itself awards nothing; white scores only at physical crossing',()=>{const g=fixture();g.update(4.55);assert.equal(g.tap(),true);assert.equal(g.score,0);g.update(.13);assert.equal(g.score,0);assert.equal(g.gateAmount(),1);g.update(.13);assert.equal(g.score,5);assert.equal(g.car.state,'passing');});
test('early tap closes before arrival and white loses one life',()=>{const g=fixture();g.tap();g.update(4.81);assert.equal(g.score,0);assert.equal(g.lives,2);assert.equal(g.car.state,'crashed');});
test('late tap during final rise cannot admit a car',()=>{const g=fixture();g.update(4.74);g.tap();g.update(.07);assert.equal(g.lives,2);assert.equal(g.car.state,'crashed');});
test('opening after collision never retroactively scores',()=>{const g=fixture();g.update(4.81);g.tap();g.update(.2);assert.equal(g.score,0);assert.equal(g.lives,2);});
test('white crossing at exact end of .65s pulse is rejected',()=>{const g=fixture();g.update(4.15);g.tap();g.update(.66);assert.equal(g.lives,2);assert.equal(g.score,0);});
test('black admitted loses 15 points, no life; black blocked explodes without score',()=>{
  const pass=fixture(true);pass.update(4.55);pass.tap();pass.update(.26);assert.equal(pass.score,-15);assert.equal(pass.lives,3);assert.equal(pass.penalties,1);
  const block=fixture(true);block.update(4.81);assert.equal(block.car.state,'exploded');assert.equal(block.score,0);assert.equal(block.lives,3);assert.equal(block.blocked,1);
});
test('repeated input cannot extend pulse or bypass recovery',()=>{const g=new LaneGame({autoSpawn:false});g.tap();const until=g.gate.pulseUntil;for(let i=0;i<90;i++){g.update(.01);assert.equal(g.tap(),false);near(g.gate.pulseUntil,until);}g.update(.04);assert.equal(g.tap(),true);});
test('arm waits for rear bumper clearance but admission interval stays .65s',()=>{const g=fixture();g.update(4.6);g.tap();const pulse=g.gate.pulseUntil;g.update(.8);assert.equal(g.car.state,'passing');assert.equal(g.gateAmount(),1);assert.equal(g.canPass(),false);assert.equal(g.tap(),false);near(g.gate.pulseUntil,pulse);assert.ok(g.gate.closeAt>pulse);const until=g.gate.readyAt;g.update(until-g.time+.001);assert.equal(g.gateAmount(),0);assert.equal(g.tap(),true);});
for(const type of TYPES)test(`rear clearance protects ${type}`,()=>{const g=new LaneGame({autoSpawn:false,difficultyAt:0});g.spawn({type,black:false});g.update(4.6);g.tap();g.update(.201);const clear=4.8+(g.car.width+48)/g.car.speed;near(g.gate.closeAt,clear);g.update(clear-g.time-.001);assert.equal(g.gateAmount(),1);});
test('large update and small updates produce identical crossing outcome',()=>{const a=fixture(true),b=fixture(true);a.update(4.55);b.update(4.55);a.tap();b.tap();a.update(.5);for(let i=0;i<50;i++)b.update(.01);assert.equal(a.score,b.score);assert.equal(a.car.state,b.car.state);near(a.car.front,b.car.front);near(a.gate.closeAt,b.gate.closeAt);});
test('three white crashes finish once, block input and end after feedback',()=>{const g=new LaneGame({autoSpawn:false,difficultyAt:300});for(let i=0;i<3;i++){g.spawn({black:false});g.update(1.56);assert.equal(g.lives,2-i);if(i<2)g.update(1);}assert.equal(g.status,'finishing');assert.equal(g.tap(),false);assert.equal(g.spawn(),false);g.update(1);assert.equal(g.status,'ended');assert.equal(g.reason,'lives');assert.equal(g.drainEvents().filter(e=>e.type==='end').length,1);g.update(100);assert.equal(g.drainEvents().length,0);});
test('five-minute time cap and fresh restart state',()=>{const g=new LaneGame({autoSpawn:false});g.update(301);assert.equal(g.status,'ended');assert.equal(g.reason,'time');near(g.finishedTime,300);const restarted=new LaneGame();assert.equal(restarted.time,0);assert.equal(restarted.score,0);assert.equal(restarted.lives,3);assert.equal(restarted.car,null);assert.equal(restarted.gateAmount(),0);});
test('random flow enforces prefix black quota and independent car colors',()=>{let seed=7;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);const g=new LaneGame({random,autoSpawn:false});let blackWhiteBody=0,whiteBlackBody=0;for(let i=0;i<10000;i++){g.spawn();if(i<9)assert.equal(g.car.black,false);assert.ok(g.blackCount<=Math.floor(g.total/10));if(g.car.black&&g.car.color==='white')blackWhiteBody++;if(!g.car.black&&g.car.color==='black')whiteBlackBody++;g.car=null;}assert.ok(blackWhiteBody>100);assert.ok(whiteBlackBody>1000);});
test('single-lane prototype never creates a second simultaneous car',()=>{const g=new LaneGame();g.update(.5);const first=g.car.id;assert.equal(g.spawn(),false);g.update(1);assert.equal(g.car.id,first);});
test('time-limit transition lets an already admitted car clear before arm falls',()=>{const g=new LaneGame({autoSpawn:false,difficultyAt:0});g.update(294.7);g.spawn({black:false,type:'minivan'});g.update(4.6);g.tap();g.update(.71);assert.equal(g.status,'finishing');const front=g.car.front;g.update(.4);assert.ok(g.car.front>front+90);const clear=g.gate.closeAt;g.update(clear-g.time+.01);assert.ok(g.car.front-g.car.width-48>=RULES.gateX-1);});
