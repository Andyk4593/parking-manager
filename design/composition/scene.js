/* Iteration 6: deterministic composition study, not a gameplay simulation. */
(() => {
  'use strict';
  const stage = document.querySelector('#stage');
  const world = document.querySelector('#world');
  const lanes = [210, 400, 590, 780];
  const colors = { white:'#e4e6d9', black:'#303a3e', blue:'#599dab', red:'#c46d54', yellow:'#d4aa56' };
  let parts = [];
  const rect = (x,y,w,h,fill,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
  const poly = (points,fill,extra='') => `<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="${fill}" ${extra}/>`;
  const text = (s,x,y,size,fill,extra='') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${s}</text>`;
  const shade = (hex,delta) => '#'+hex.slice(1).match(/../g).map(v=>Math.max(0,Math.min(255,parseInt(v,16)+delta)).toString(16).padStart(2,'0')).join('');
  // All cars use the same projection and scale. The far lanes never shrink.
  const point = (x,y,z=0) => [Math.round(x-y*.55),Math.round(y*.55-z)];
  function face(coords, color, extra='') { return poly(coords.map(p=>point(...p)),color,extra); }
  function box(x,y,z,w,d,h,color) {
    return face([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],shade(color,20))+
      face([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],shade(color,-23))+
      face([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],shade(color,-40));
  }
  function tree(x,y,s=1) {
    return `<g transform="translate(${x} ${y}) scale(${s})">`+
      rect(-24,12,64,13,'#30492f')+rect(-4,-5,12,37,'#796b43')+
      poly([[-35,-12],[-26,-12],[-26,-30],[-12,-30],[-12,-40],[13,-40],[13,-29],[30,-29],[30,-13],[39,-13],[39,12],[26,12],[26,22],[-24,22],[-24,11],[-35,11]],'#345c3b')+
      rect(-26,-12,52,27,'#49794a')+rect(-14,-29,34,37,'#628953')+rect(-8,-27,19,8,'#86a464')+rect(16,7,14,11,'#365f3d')+'</g>';
  }
  function arrow(x,y,c) { return poly([[x,y-5],[x+30,y-5],[x+30,y-15],[x+52,y],[x+30,y+15],[x+30,y+5],[x,y+5]],c); }
  function wheel(x) {
    const [px,py] = point(x,75,10);
    return `<g transform="translate(${px} ${py})">`+
      poly([[-16,-9],[-10,-17],[8,-17],[16,-9],[16,10],[9,18],[-9,18],[-16,10]],'#172624')+
      poly([[-10,-7],[-6,-11],[5,-11],[10,-6],[10,8],[5,12],[-5,12],[-10,6]],'#536362')+
      rect(-4,-6,7,14,'#b7c4ba')+rect(-8,-2,15,5,'#b7c4ba')+'</g>';
  }
  function car(c) {
    const w=c.type==='minivan'?256:c.type==='truck'?254:c.type==='crossover'?238:218;
    const color=colors[c.color], tall=c.type==='minivan'||c.type==='crossover';
    let s=`<g class="car" data-car="${c.id}" data-type="${c.type}" transform="translate(${c.x} ${lanes[c.lane]+84})">`;
    s+=face([[-7,-2,0],[w+10,-2,0],[w+10,88,0],[-7,88,0]],'#354641','opacity=".52"');
    s+=box(0,0,9,w,72,26,color);
    s+=face([[5,72,14],[w-8,72,14],[w-8,72,19],[5,72,19]],shade(color,-55));
    if(c.type==='truck') {
      s+=box(8,5,35,133,61,8,color);
      s+=face([[16,11,44],[129,11,44],[129,60,44],[16,60,44]],'#697569');
      for(let i=0;i<5;i++)s+=face([[23+i*20,12,45],[26+i*20,12,45],[26+i*20,58,45],[23+i*20,58,45]],'#8d9881');
      s+=box(153,8,35,61,55,35,color);
      s+=face([[214,10,67],[229,10,36],[229,63,36],[214,63,67]],'#27464c');
      s+=face([[163,64,43],[203,64,43],[203,64,66],[163,64,66]],'#29484d');
      s+=face([[163,64,64],[203,64,64],[203,64,67],[163,64,67]],'#a6ccc5');
    } else {
      const rear=c.type==='minivan'?33:c.type==='crossover'?44:54;
      const front=c.type==='minivan'?185:c.type==='crossover'?166:150;
      const roof=tall?72:62;
      // Rear and front glass slopes, then the visible near cabin side.
      s+=face([[rear-20,5,35],[rear,10,roof],[front,10,roof],[front+27,5,35]],shade(color,5));
      s+=face([[rear-20,5,35],[rear-20,67,35],[rear,61,roof],[rear,10,roof]],'#355157');
      s+=face([[front,10,roof],[front,61,roof],[front+27,67,35],[front+27,5,35]],'#30505a');
      s+=face([[front+3,13,roof-3],[front+6,13,roof-7],[front+28,61,37],[front+25,61,41]],'#a1c9c6');
      s+=face([[rear-20,67,35],[front+27,67,35],[front,61,roof],[rear,61,roof]],shade(color,-15));
      s+=face([[rear-9,68,40],[front+15,68,40],[front-3,62,roof-5],[rear+3,62,roof-5]],'#243f47');
      s+=face([[rear+42,67,40],[rear+48,67,40],[rear+48,61,roof-2],[rear+42,61,roof-2]],shade(color,-7));
      if(c.type==='convertible') {
        s+=face([[rear,10,53],[front,10,53],[front,61,53],[rear,61,53]],'#253b36');
        for(const sy of [18,43])s+=box(rear+14,sy,53,29,16,5,'#bb9869');
        s+=box(rear+44,15,53,9,44,6,'#866849');
      } else {
        s+=face([[rear,10,roof],[front,10,roof],[front,61,roof],[rear,61,roof]],shade(color,30));
        s+=face([[rear+7,13,roof+1],[front-7,13,roof+1],[front-7,17,roof+1],[rear+7,17,roof+1]],shade(color,55));
        if(tall)for(const sy of [14,55])s+=face([[rear+7,sy,roof+3],[front-7,sy,roof+3],[front-7,sy+3,roof+3],[rear+7,sy+3,roof+3]],'#7d8e86');
      }
      s+=face([[front+34,9,36],[w-14,9,36],[w-14,62,36],[front+34,62,36]],shade(color,15));
      s+=face([[rear+37,73,27],[rear+54,73,27],[rear+54,73,30],[rear+37,73,30]],'#bac4b5');
    }
    s+=wheel(38)+wheel(w-39);
    s+=face([[w+1,7,29],[w+1,22,29],[w+1,22,20],[w+1,7,20]],'#fff1bb');
    s+=face([[w+1,50,29],[w+1,66,29],[w+1,66,20],[w+1,50,20]],'#fff1bb');
    s+=face([[w+2,27,28],[w+2,45,28],[w+2,45,17],[w+2,27,17]],'#283a38');
    s+=face([[w+3,5,11],[w+3,68,11],[w+3,68,15],[w+3,5,15]],'#aab6a9');
    s+=face([[3,73,22],[13,73,22],[13,73,30],[3,73,30]],'#bd5746');
    return s+'</g>';
  }
  function gate(lane,open) {
    const y=lanes[lane];
    let s=`<g class="gate" data-open="${open}" transform="translate(0 ${y})">`;
    s+=poly([[1508,139],[1596,29],[1608,35],[1520,145]],'#263f34','opacity=".55"');
    // The arm runs across the lane when down; when up its tip rises over its own pedestal.
    const a=[1512,135], b=open?[1518,24]:[1580,26];
    s+=poly([[a[0]+7,a[1]+6],[b[0]+7,b[1]+6],[b[0]-6,b[1]+6],[a[0]-6,a[1]+6]],'#004d2c');
    s+=poly([[a[0]-7,a[1]],[b[0]-7,b[1]],[b[0]+7,b[1]],[a[0]+7,a[1]]],'#006f3d');
    for(let i=0;i<5;i++) {
      const t=(i+.2)/5, t2=(i+.65)/5;
      const x1=a[0]+(b[0]-a[0])*t,y1=a[1]+(b[1]-a[1])*t;
      const x2=a[0]+(b[0]-a[0])*t2,y2=a[1]+(b[1]-a[1])*t2;
      s+=poly([[x1-7,y1],[x2-7,y2],[x2+7,y2],[x1+7,y1]],'#f3efd6');
    }
    s+=rect(1494,135,36,33,'#004c2d')+poly([[1494,135],[1506,122],[1541,122],[1530,135]],'#369264')+poly([[1530,135],[1541,122],[1541,155],[1530,168]],'#003d25');
    s+=rect(1499,141,22,7,open?'#bef0a3':'#e8cf80')+rect(1503,156,15,4,'#0e7247');
    return s+'</g>';
  }
  // This fixture stresses geometry: eight cars, five silhouettes, multiple plates per lane.
  const cars=[
    {id:'sedan-white',lane:0,x:1100,type:'sedan',color:'white',plate:'472',reveal:true},
    {id:'crossover-black',lane:0,x:350,type:'crossover',color:'black',plate:'185',reveal:false},
    {id:'minivan-white',lane:1,x:1120,type:'minivan',color:'white',plate:'609',reveal:true},
    {id:'convertible-blue',lane:1,x:720,type:'convertible',color:'blue',plate:'318',reveal:true},
    {id:'truck-yellow',lane:2,x:920,type:'truck',color:'yellow',plate:'826',reveal:true,black:true},
    {id:'sedan-black',lane:2,x:200,type:'sedan',color:'black',plate:'543',reveal:false},
    {id:'crossover-white',lane:3,x:1125,type:'crossover',color:'white',plate:'751',reveal:true},
    {id:'minivan-red',lane:3,x:660,type:'minivan',color:'red',plate:'294',reveal:true}
  ];
  parts.push(rect(0,156,1920,838,'#58744b'));
  for(let i=0;i<125;i++)parts.push(rect((i*193)%1920,160+(i*97)%830,6,3,i%2?'#6d8857':'#486642'));
  parts.push(rect(0,201,1920,17,'#bac3a1'),rect(0,207,1920,9,'#879879'),rect(0,210,1920,760,'#737c7d'));
  parts.push(rect(1686,210,234,760,'#607d68'),rect(1680,210,6,760,'#cad5b5'));
  for(let i=0;i<850;i++)parts.push(rect((i*233)%1667,216+(i*127)%745,i%3?3:5,2,i%2?'#7e8885':'#687574'));
  for(let i=0;i<4;i++) {
    const y=lanes[i];
    parts.push(rect(0,y,1680,4,'#4e605b'));
    if(i>0)for(let x=12;x<1680;x+=84)parts.push(rect(x,y,49,5,'#f1efdb'));
    parts.push(rect(1424,y+15,5,158,'#e9ead7'),rect(1412,y+15,3,158,'#b5c0b3'));
    parts.push(arrow(70,y+88,'#b6c1b6'),arrow(815,y+88,'#94a69e'),arrow(1768,y+90,'#b7cfaf'));
    parts.push(text('0'+(i+1),30,y+41,17,'#c3cdbb','font-family="Pixel,monospace"'));
    for(let j=0;j<4;j++)parts.push(rect(1689+j*63,y+185,36,5,'#9bb390'));
  }
  parts.push(rect(0,213,1920,5,'#e9ead6'),rect(0,963,1920,6,'#e9ead6'),rect(0,970,1920,20,'#b2bc99'),rect(0,986,1920,8,'#80946b'));
  for(let x=0;x<1920;x+=46)parts.push(rect(x,970,3,16,'#7d9173'));
  parts.push(tree(1796,184,.46),tree(1872,186,.55));
  for(const c of cars)parts.push(car(c));
  for(let i=0;i<4;i++)parts.push(gate(i,i===0||i===3));
  // Small roadside parking signs, kept beyond all input zones.
  for(const i of [1,3]) {
    const y=lanes[i]+28;
    parts.push(rect(1822,y+12,7,57,'#354f3b'),rect(1799,y-10,53,49,'#184d33'),rect(1802,y-13,50,47,'#f1ebd1'),text('P',1811,y+22,32,'#006f3d','font-family="Pixel,monospace"'));
  }
  world.innerHTML=parts.join('');
  document.querySelector('#plates').innerHTML=cars.map(c=>`<div class="plate ${c.black?'black':''} ${c.reveal?'':'hidden'}" data-car="${c.id}" data-lane="${c.lane}" style="left:${c.x+4}px;top:${lanes[c.lane]+132}px" aria-label="Номер ${c.plate}, ${c.black?'чёрный список':'можно пропустить'}"><span class="symbol" aria-hidden="true">${c.black?'×':'✓'}</span><span>${c.plate}</span></div>`).join('');
  document.querySelector('#gate-zones').innerHTML=lanes.map((y,i)=>`<div class="gate-zone ${i===0||i===3?'open':''}" style="top:${y+7}px" aria-label="Шлагбаум ${i+1}, ${i===0||i===3?'открыт':'закрыт'}"><span class="gate-key">${i+1}</span></div>`).join('');
  const heart='0,6 6,6 6,0 18,0 18,6 24,6 24,0 36,0 36,6 42,6 42,18 36,18 36,24 30,24 30,30 24,30 24,36 18,36 18,30 12,30 12,24 6,24 6,18 0,18';
  document.querySelector('.hearts').innerHTML=[0,1,2].map(i=>`<svg viewBox="0 0 46 40" aria-hidden="true"><polygon points="${heart}" transform="translate(3 3)" fill="#004e2f"/><polygon points="${heart}" fill="${i<2?'#f3d09a':'#378460'}"/>${i<2?rect(6,6,12,5,'#fff1ce'):''}</svg>`).join('');
  function resize() { const scale=Math.min(innerWidth/1920,innerHeight/1080);stage.style.transform=`scale(${scale})`;stage.style.left=`${(innerWidth-1920*scale)/2}px`;stage.style.top=`${(innerHeight-1080*scale)/2}px`; }
  addEventListener('resize',resize);resize();
  const density=document.querySelector('#density');
  density.addEventListener('click',()=>{const all=density.getAttribute('aria-pressed')!=='true';density.setAttribute('aria-pressed',String(all));density.textContent=all?'Вернуть игровой кадр':'Проверить все номера';for(const c of cars)document.querySelector(`.plate[data-car="${c.id}"]`).classList.toggle('hidden',!all&&!c.reveal);});
  document.querySelector('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.querySelector('#fullscreen').textContent='Используйте F11';}});
  if(new URLSearchParams(location.search).has('capture'))document.body.classList.add('capture');
})();
