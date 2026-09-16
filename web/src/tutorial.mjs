import {LaneGame,RULES} from './lane-model.mjs';
const plans=[
  [{lane:1,at:0,type:'sedan',color:'white',black:false}],
  [{lane:0,at:0,type:'convertible',color:'blue',black:false}],
  [{lane:2,at:0,type:'minivan',color:'white',black:true}],
  [{lane:0,at:0,type:'truck',color:'black',black:false},{lane:1,at:1.25,type:'crossover',color:'white',black:false}],
];
export class Tutorial{
  constructor(){this.time=0;this.step=0;this.revision=0;this.events=[];this.assisted=false;this.setup();}
  setup(){
    this.revision++;this.localTime=0;this.successes=0;this.failAt=Infinity;this.target=null;this.handled=new Set();
    this.games=Array.from({length:4},(_,lane)=>new LaneGame({lane,autoSpawn:false,difficultyAt:0,random:()=>.21+.11*lane+.07*this.step}));
    this.pending=plans[this.step].map(p=>({...p}));this.allowed=plans[this.step].map(p=>p.lane);
    this.phase=this.step===0?'read':this.step===2?'black_read':'running';this.spawnDue();
    this.events=[];
  }
  spawnDue(){while(this.pending.length&&this.pending[0].at<=this.localTime+1e-9){const p=this.pending.shift();this.games[p.lane].spawn(p);}}
  drainEvents(){return this.events.splice(0);}
  next(){
    if(this.phase==='read'||this.phase==='black_read'){this.phase='running';return 'continue';}
    if(this.phase==='retry'){this.assisted=true;this.setup();return 'retry';}
    if(this.phase==='success'){this.step++;this.assisted=false;this.setup();return 'next';}
    if(this.phase==='complete')return 'complete';
    return false;
  }
  canTap(lane){return this.allowed.includes(lane)&&((this.phase==='tap'&&this.target===lane)||(this.phase==='running'&&this.step!==0));}
  tap(lane){
    if(!this.canTap(lane))return false;
    if(!this.games[lane].tap())return false;
    if(this.phase==='tap'){this.handled.add(lane);this.target=null;this.phase='running';}
    this.collect();return true;
  }
  collect(){
    for(const g of this.games)for(const event of g.drainEvents()){
      this.events.push({...event,time:this.time,lane:g.lane,training:true});
      if(event.type==='pass'||event.type==='explode')this.successes++;
      if(event.type==='crash'||event.type==='penalty'){
        this.phase='retry_wait';this.failAt=this.time+.95;
        this.failure=event.type==='penalty'?'Этот номер в чёрном списке. Шлагбаум нужно оставить закрытым.':'Открой шлагбаум, когда машина приблизится. Слишком раннее открытие успеет закончиться.';
        // A training failure never consumes the displayed lives or creates a game result.
        g.lives=3;g.score=0;
      }
    }
  }
  update(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    let left=dt;
    while(left>1e-9&&['running','retry_wait'].includes(this.phase)){
      let tick=Math.min(left,1/120);
      if(this.phase==='running'&&(this.step===0||this.assisted)&&this.step!==2){
        for(const g of this.games){
          const c=g.car;if(!c||c.state!=='approaching'||this.handled.has(g.lane))continue;
          const until=(RULES.gateX-c.front)/c.speed-.32;
          if(until<=1e-8){this.phase='tap';this.target=g.lane;return;}
          tick=Math.min(tick,until);
        }
      }
      left-=tick;this.time+=tick;this.localTime+=tick;
      for(const g of this.games)g.update(tick);
      if(this.phase==='running')this.spawnDue();
      this.collect();
      if(this.phase==='retry_wait'&&this.time+1e-9>=this.failAt){this.phase='retry';return;}
      if(this.phase==='running'&&!this.pending.length&&this.games.every(g=>!g.car)&&this.successes===plans[this.step].length){this.phase=this.step===3?'complete':'success';return;}
    }
  }
  get score(){return this.games.reduce((sum,g)=>sum+g.passed*5,0);}
  get fingerLane(){return this.phase==='tap'?this.target:null;}
  view(){
    const base={step:this.step+1,total:4,phase:this.phase,fingerLane:this.fingerLane,plateLane:this.phase==='read'?1:this.phase==='black_read'?2:null,button:'',title:'',copy:''};
    if(this.phase==='read')return {...base,title:'Белый номер — можно пропустить',copy:'Номер принадлежит этой машине. Сначала проверь его, затем дождись подъезда к шлагбауму.',button:'Понятно'};
    if(this.phase==='black_read')return {...base,title:'Чёрный номер — не открывай',copy:'За пропуск такой машины снимается 15 очков. Сейчас просто дождись её подъезда.',button:'Понял, жду'};
    if(this.phase==='tap')return {...base,title:`Открой шлагбаум № ${this.target+1}`,copy:`Нажми на подсвеченный шлагбаум или клавишу ${this.target+1}. Машина подождёт твоего действия.`};
    if(this.phase==='retry'||this.phase==='retry_wait')return {...base,title:'Ничего страшного. Попробуем ещё.',copy:this.failure+' Учебные ошибки не отнимают жизни.',button:this.phase==='retry'?'Повторить':''};
    if(this.phase==='complete')return {...base,title:'Можно начинать смену!',copy:'У тебя будет 5 минут и 3 жизни. Скорость вырастет, а номера начнут появляться позже.',button:'Начать смену'};
    if(this.phase==='success')return {...base,title:this.step===2?'Верно! Чёрный список не проехал.':'Получилось! Машина на парковке.',copy:this.step===2?'Иногда правильное действие — не нажимать.':'Шлагбаум закроется сам. Следующей машине понадобится новое нажатие.',button:'Дальше'};
    if(this.step===0&&this.handled.has(1))return {...base,title:'Машина проезжает',copy:'Шлагбаум откроется и закроется сам. Подождём, пока машина проедет.'};
    const titles=['Дождись подъезда машины','Теперь попробуй самостоятельно','Оставь шлагбаум закрытым','Две машины — два момента'];
    const copies=['Покажем точный момент открытия. Пока нажимать не нужно.','Белый номер. Открой первый шлагбаум при подъезде машины.','Время идёт. Не нажимай: машина из чёрного списка остановится сама.','Используй шлагбаумы 1 и 2. Машины прибудут в разное время.'];
    return {...base,title:titles[this.step],copy:copies[this.step]};
  }
}
