export class Chiptune {
  constructor() { this.enabled = true; this.ctx = null; }
  unlock() { this.ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); }
  tone(frequency, duration, delay = 0, wave = 'square', volume = 0.035, end = frequency) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx, osc = c.createOscillator(), gain = c.createGain(), t = c.currentTime + delay;
    osc.type = wave; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(Math.max(30,end), t + duration);
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.001, t + duration); osc.connect(gain); gain.connect(c.destination); osc.start(t); osc.stop(t + duration + 0.01);
  }
  noise(duration, volume = 0.08) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx, buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate), data = buffer.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*(1-i/data.length);
    const source = c.createBufferSource(), gain = c.createGain(); gain.gain.value = volume; source.buffer = buffer; source.connect(gain); gain.connect(c.destination); source.start();
  }
  play(type) {
    if (type === 'open') this.tone(210, .09, 0, 'square', .022, 510);
    if (type === 'pass') { this.tone(784,.1); this.tone(1175,.17,.08); }
    if (type === 'crash') { this.noise(.23,.07); this.tone(150,.36,0,'sawtooth',.04,48); }
    if (type === 'penalty') { this.tone(185,.12); this.tone(138,.3,.13,'square',.03,65); this.noise(.22,.03); }
    if (type === 'explode') { this.noise(.42); this.tone(85,.28,0,'triangle',.06,30); }
    if (type === 'tick') this.tone(660,.08);
    if (type === 'start') { [523,659,784,1047].forEach((f,i)=>this.tone(f,.18,i*.08)); }
    if (type === 'end') [392,330,262,196].forEach((f,i)=>this.tone(f,.3,i*.16));
  }
}
