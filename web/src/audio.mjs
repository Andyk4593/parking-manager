// Original 16-bar miniature: soft triangle bass, arpeggio and sparse chip bells.
// Generated locally, without recordings, downloads or an external audio runtime.
export const MUSIC={bpm:92,bars:16,sampleRate:22050};
const hz=midi=>440*2**((midi-69)/12);
export function makeMusic(sampleRate=MUSIC.sampleRate){
  const beat=60/MUSIC.bpm,length=MUSIC.bars*4*beat,pcm=new Float32Array(Math.round(length*sampleRate));
  function note(midi,start,duration,volume,tone){
    const from=Math.round(start*sampleRate),count=Math.floor(duration*sampleRate),frequency=hz(midi);
    for(let i=0;i<count&&from+i<pcm.length;i++){
      const t=i/sampleRate,phase=t*frequency,attack=Math.min(1,t/.012),release=Math.min(1,(duration-t)/.08);
      const triangle=2/Math.PI*Math.asin(Math.sin(2*Math.PI*phase));
      const wave=tone==='bass'?triangle:Math.sin(2*Math.PI*phase)*.8+triangle*.2;
      pcm[from+i]+=wave*volume*attack*release*Math.exp(-t/(tone==='bass'?1.2:.35));
    }
  }
  const chords=[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,55,59]];
  const melodies=[[76,null,79,null,74,null,72,null],[72,null,null,76,null,74,null,null],[69,null,72,null,76,null,null,72],[71,null,74,null,79,null,74,null]];
  for(let bar=0;bar<MUSIC.bars;bar++){
    const chord=chords[Math.floor(bar/2)%4],at=bar*4*beat;
    note(chord[0]-12,at,1.7*beat,.08,'bass');note(chord[0]-12,at+2*beat,1.65*beat,.065,'bass');
    for(let step=0;step<8;step++)note(chord[1+step%3]+12,at+step*beat/2,.45*beat,.028,'bell');
    const melody=melodies[Math.floor(bar/2)%4];
    for(let step=0;step<8;step++)if(melody[step]!==null&&(bar%2===1||step<4))note(melody[step]+(bar>=8&&step===2?12:0),at+step*beat/2,.8*beat,.04,'bell');
  }
  return {pcm,sampleRate,duration:pcm.length/sampleRate};
}
export class GameAudio{
  constructor(settings={}){this.sound=settings.sound!==false;this.music=settings.music!==false;this.active=false;this.context=null;this.source=null;this.offset=0;this.voices=new Set();this.starts=0;}
  unlock(){
    if(!this.sound)return;
    try{
      this.context??=new (globalThis.AudioContext||globalThis.webkitAudioContext)();
      if(this.context.state==='suspended')this.context.resume().then(()=>this.sync()).catch(()=>{});
      this.sync();
    }catch{/* Browsers without audio support still run the complete game. */}
  }
  setActive(value){this.active=Boolean(value);this.sync();if(!this.active)this.stopEffects();}
  configure(name,value){this[name]=Boolean(value);this.sync();if(!this.sound)this.stopEffects();}
  sync(){
    const shouldPlay=this.active&&this.sound&&this.music&&this.context?.state==='running';
    if(!shouldPlay){if(this.source){this.offset=(this.offset+this.context.currentTime-this.startedAt)%this.buffer.duration;this.source.stop();this.source.disconnect();this.gain.disconnect();this.source=null;}return;}
    if(this.source)return;
    if(!this.buffer){const {pcm,sampleRate}=makeMusic();this.buffer=this.context.createBuffer(1,pcm.length,sampleRate);this.buffer.copyToChannel(pcm,0);}
    this.source=this.context.createBufferSource();this.source.buffer=this.buffer;this.source.loop=true;
    this.gain=this.context.createGain();this.gain.gain.setValueAtTime(0,this.context.currentTime);this.gain.gain.linearRampToValueAtTime(.5,this.context.currentTime+.12);
    this.source.connect(this.gain);this.gain.connect(this.context.destination);this.startedAt=this.context.currentTime;this.source.start(0,this.offset);this.starts++;
  }
  stopEffects(){for(const voice of this.voices){try{voice.osc.stop();}catch{}voice.osc.disconnect();voice.gain.disconnect();}this.voices.clear();}
  beep(type){
    if(!this.active||!this.sound||this.context?.state!=='running')return;
    const seq={open:[320,540],pass:[660,880],penalty:[200,100],crash:[120,65],explode:[70,35]}[type];if(!seq)return;
    seq.forEach((f,i)=>{const osc=this.context.createOscillator(),gain=this.context.createGain(),at=this.context.currentTime+i*.07,voice={osc,gain};this.voices.add(voice);osc.type=type==='explode'?'sawtooth':'square';osc.frequency.setValueAtTime(f,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.035,at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+.09);osc.connect(gain);gain.connect(this.context.destination);osc.start(at);osc.stop(at+.1);osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices.delete(voice);};});
  }
  snapshot(){return {state:this.context?.state??'none',playing:Boolean(this.source),starts:this.starts,sound:this.sound,music:this.music,voices:this.voices.size,offset:this.offset};}
}
