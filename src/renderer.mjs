export const LANE_Y = [179, 259, 339, 419];
const CAR_X = [49, 149, 249, 349, 449, 549, 649];
const GREEN = '#006f3d';
const rect = (c,x,y,w,h,color) => { c.fillStyle=color; c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
const poly = (c,points,color) => { c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill(); };
function text(c,value,x,y,size=9,color='#f0e9ce',align='left') { c.font=`${size}px Pixel, monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(value,Math.round(x),Math.round(y)); }
function shade(hex,amount) { const n=parseInt(hex.slice(1),16); return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,v+amount)).toString(16).padStart(2,'0')).join(''); }
const carCache = new Map();
function carSprite(type,color) {
  const key=type+color;if(carCache.has(key)) return carCache.get(key);
  const cv=document.createElement('canvas');cv.width=106;cv.height=58;const c=cv.getContext('2d');
  const long=['minivan','truck'].includes(type), tall=['crossover','minivan'].includes(type);
  const x=long?4:10,w=long?94:82,y=tall?9:12,h=tall?39:33;
  rect(c,x+3,y+5,w,h,'#1d2524');
  for(const xx of [x+13,x+w-22]) {rect(c,xx,y-4,14,8,'#121b1e');rect(c,xx,y+h-3,14,8,'#121b1e');rect(c,xx+2,y-4,10,2,'#50544e');}
  rect(c,x,y+5,w,h-10,'#172d28');rect(c,x+4,y,w-10,h,'#172d28');
  rect(c,x+3,y+6,w-6,h-12,shade(color,-20));rect(c,x+7,y+2,w-16,h-4,color);
  rect(c,x+8,y+3,w-19,3,shade(color,30));rect(c,x+8,y+h-6,w-18,3,shade(color,-36));
  if(type==='truck') {
    rect(c,x+8,y+7,45,h-14,shade(color,-65));rect(c,x+11,y+9,40,h-18,'#625f52');
    for(let j=0;j<4;j++)rect(c,x+14+j*9,y+10,2,h-20,'#807868');
    rect(c,x+53,y+4,25,h-8,color);rect(c,x+66,y+7,9,h-14,'#233e43');rect(c,x+67,y+8,2,h-17,'#81a9a3');
    rect(c,x+52,y+6,3,h-12,shade(color,40));
  } else {
    const roofX=x+(long?21:24),roofW=type==='minivan'?46:type==='crossover'?34:28;
    poly(c,[[roofX-12,y+7],[roofX-3,y+5],[roofX-3,y+h-5],[roofX-12,y+h-7]],'#294649');
    poly(c,[[roofX+roofW-3,y+5],[roofX+roofW+9,y+8],[roofX+roofW+9,y+h-8],[roofX+roofW-3,y+h-5]],'#294649');
    rect(c,roofX+roofW,y+9,3,h-18,'#8cadad');rect(c,roofX-10,y+9,2,h-18,'#608780');
    if(type==='convertible') {
      rect(c,roofX-1,y+6,roofW,h-12,'#252d29');rect(c,roofX+12,y+8,10,8,'#bb8d60');rect(c,roofX+12,y+h-16,10,8,'#bb8d60');rect(c,roofX+5,y+7,4,h-14,'#493e31');
    } else {rect(c,roofX,y+5,roofW-4,h-10,shade(color,13));rect(c,roofX+3,y+7,roofW-10,2,shade(color,40));}
    rect(c,roofX+3,y+1,17,2,'#476762');rect(c,roofX+3,y+h-3,17,2,'#304c48');
    if(type==='crossover') {rect(c,roofX,y+5,roofW-4,2,'#858a7c');rect(c,roofX,y+h-7,roofW-4,2,'#555e56');}
  }
  rect(c,x+w-6,y+6,5,7,'#fff5bd');rect(c,x+w-6,y+h-13,5,7,'#fff5bd');
  rect(c,x+1,y+6,4,7,'#c45c49');rect(c,x+1,y+h-13,4,7,'#c45c49');
  rect(c,x+w-2,y+15,2,h-30,'#b0b8a3');rect(c,x+3,y+12,2,h-24,'#6c776b');
  carCache.set(key,cv);return cv;
}
function tree(c,x,y,size=1) {
  c.save();c.translate(x,y);c.scale(size,size);rect(c,-16,-9,36,33,'#1e3b28');rect(c,-3,11,7,18,'#6c6750');
  rect(c,-15,-15,29,34,'#2b5635');rect(c,-20,-6,38,19,'#386c40');rect(c,-12,-20,21,30,'#427847');rect(c,-8,-15,14,10,'#5c8950');rect(c,9,-4,7,14,'#244b2c');c.restore();
}
function makeBackground() {
  const cv=document.createElement('canvas');cv.width=960;cv.height=540;const c=cv.getContext('2d');
  rect(c,0,0,960,540,'#35573c');
  for(let i=0;i<160;i++) { const x=(i*83+29)%960,y=95+(i*71)%394;rect(c,x,y,3,2,i%2?'#496545':'#2e4c32'); }
  rect(c,0,119,960,16,'#acb399');rect(c,0,119,960,3,'#d0cdb2');
  rect(c,0,466,960,17,'#a4ae96');rect(c,0,466,960,4,'#d0cdb2');
  for(let x=0;x<960;x+=32){rect(c,x,120,2,14,'#798d73');rect(c,x,469,2,12,'#78876f');}
  rect(c,0,135,812,332,'#646b69');rect(c,0,137,812,4,'#393f3f');rect(c,0,461,812,5,'#3d4541');
  for(let i=0;i<850;i++){const x=(i*113+71)%810,y=142+(i*67)%316;rect(c,x,y,i%3?2:3,1,i%2?'#707572':'#5a6460');}
  rect(c,811,136,149,330,'#374d40');rect(c,808,136,4,331,'#98aa8a');
  for(let y=139;y<=459;y+=80){if(y!==139)for(let x=0;x<702;x+=43)rect(c,x,y-2,26,3,'#ecebd5');}
  rect(c,0,143,706,2,'#ebe9d1');rect(c,0,456,706,2,'#ebe9d1');
  rect(c,704,143,4,313,'#eeead6');rect(c,697,143,2,313,'#c4c9b7');
  for(let i=0;i<4;i++){
    const y=LANE_Y[i];
    text(c,'0'+(i+1),17,y-23,9,'#bcc0b0');
    for(const x of [213,413]){rect(c,x,y-3,18,6,'#9aaba0');poly(c,[[x+15,y-10],[x+28,y],[x+15,y+10]],'#9aaba0');}
    rect(c,709,y-35,94,73,'#425f49');rect(c,712,y-32,86,67,'#516d50');
    rect(c,801,y-34,6,68,'#213e29');
    for(let j=0;j<4;j++) { rect(c,716+j*22,y+35,13,3,'#c1c49f'); }
    rect(c,816,y-2,25,4,'#7d9a7b');poly(c,[[837,y-7],[846,y],[837,y+7]],'#7d9a7b');
  }
  // Service strip, bollards and quiet greenery frame the road without obscuring it.
  for(const x of [30,75,620,665]){rect(c,x,111,7,8,'#b6b998');rect(c,x,109,7,3,'#273e2b');}
  tree(c,874,110,.68);tree(c,928,111,.8);tree(c,878,447,.7);tree(c,930,447,.7);
  for(const x of [100,160,680]) {rect(c,x,486,44,3,'#1f3b29');rect(c,x+4,481,34,6,'#6a8554');rect(c,x+8,479,24,3,'#90a86d');}
  return cv;
}
export class RoadRenderer {
  constructor(scene) {
    this.texture=scene.textures.createCanvas('road',960,540);this.ctx=this.texture.context;this.bg=makeBackground();
    scene.add.image(0,0,'road').setOrigin(0).setScale(2);this.fx=[];
  }
  event(event) { if(['pass','penalty','crash','explode'].includes(event.type))this.fx.push({...event,age:0}); }
  reset() {this.fx=[];}
  drawCar(car,x,y,final=false,age=0) {
    const c=this.ctx; c.drawImage(carSprite(car.type,car.color),Math.round(x-53),Math.round(y-29));
    if(final){
      const blink=Math.floor(age*4)%2;const px=x-6,py=y-35;
      rect(c,px-3,py-3,58,22,blink?'#e9dca4':'#809284');
      rect(c,px,py,52,16,car.black?'#0e1515':'#faf5dc');
      text(c,(car.black?'×':'✓')+car.plate,px+4,py+12,8,car.black?'#fff2cc':'#17372b');
      rect(c,x+40,y-5,7,10,car.black?'#121717':'#fff4d4');
    }
  }
  render(game,dt) {
    const c=this.ctx;c.imageSmoothingEnabled=false;c.clearRect(0,0,960,540);c.drawImage(this.bg,0,0);
    const t=game.time;
    for(let i=0;i<4;i++){
      const lane=game.lanes[i],y=LANE_Y[i];
      for(const car of lane.cars)if(!car.resolved)this.drawCar(car,CAR_X[car.stage],y,car.stage===6,t);
    }
    this.fx=this.fx.filter(f=>f.age < (f.type==='crash'?1.05:1.25));
    for(const f of this.fx){
      f.age+=dt;const y=LANE_Y[f.lane],a=f.age;
      if(f.type==='pass'||f.type==='penalty'){
        const x=649+Math.min(350,a*435),slip=f.type==='penalty';
        if(slip)for(let j=0;j<9;j++){const k=(a*2+j*.1)%1;rect(c,x-50-k*66,y-20+(j%3)*18,4+k*13,4+k*9,k<.45?'#bec2b4':'#8a978b');}
        this.drawCar(f.car,x,y+(slip?Math.sin(a*44)*3:0));
        if(a<.95)text(c,slip?'−15':'+5',681,y-20-a*13,15,slip?'#ffd295':'#d4ffb4','center');
      }
      if(f.type==='crash'){
        const shake=a<.16?Math.sin(a*150)*3:0;this.drawCar(f.car,686+shake,y);
        // Driver emerges through the upper window, then raises a square fist.
        const arm=Math.floor(a*9)%2?0:-7;
        rect(c,678,y-28,15,10,'#295b83');rect(c,680,y-37,11,11,'#e7b782');rect(c,681,y-39,9,4,'#6a4935');
        rect(c,692,y-30+arm,11,5,'#d9a779');rect(c,699,y-34+arm,7,8,'#edc28f');
        text(c,'!',672,y-32,12,'#ffda94');text(c,'−1 ♥',711,y-22-a*10,11,'#ffd8a1','center');
      }
      if(f.type==='explode'){
        const spread=Math.min(1,a*4);for(let j=0;j<17;j++){const angle=j*2.399,r=spread*(12+j%5*6),s=Math.max(2,12-a*8);rect(c,680+Math.cos(angle)*r, y+Math.sin(angle)*r,s,s,a>.45?'#859180':['#f3d474','#e79143','#d76538','#ffe9a4'][j%4]);}
        if(a<.32){rect(c,668,y-14,26,27,'#ffe4a0');rect(c,661,y-6,39,12,'#fff3bc');}
        if(a<.95)text(c,'СТОП!',662,y-25-a*12,8,'#f1e3b2','center');
      }
    }
    for(let i=0;i<4;i++){
      const lane=game.lanes[i],y=LANE_Y[i],open=t<lane.gateUntil;
      rect(c,726,y-31,14,65,'#304936');
      c.save();c.translate(734,y-31);const amount=open?Math.min(1,(t-lane.lastOpen)/.12):0;c.rotate(-amount*Math.PI/2);
      rect(c,-1,0,9,61,'#243d2b');rect(c,-4,0,8,61,GREEN);rect(c,-4,1,3,59,'#43945b');
      for(let z=8;z<57;z+=17){rect(c,-4,z,8,7,'#e6e8cd');rect(c,-4,z,2,7,'#faf8df');}c.restore();
      rect(c,724,y-36,20,14,'#143c29');rect(c,725,y-37,18,11,GREEN);rect(c,726,y-38,16,3,'#589663');
      rect(c,730,y-35,6,5,open?'#b5f5a3':t<lane.readyAt?'#debd6a':'#f5de9b');
    }
    this.texture.refresh();
  }
}
