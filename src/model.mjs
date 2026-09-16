export const RULES = Object.freeze({ duration: 600, lives: 3, openTime: 0.65, recovery: 0.16, points: 5, penalty: 15, finalStage: 6 });
export const COLORS = ['#e8e5d9', '#e8e5d9', '#e8e5d9', '#262c32', '#262c32', '#262c32', '#d55b4b', '#d8ae4a', '#5e96b5', '#7ca078'];
export const TYPES = ['sedan', 'crossover', 'minivan', 'truck', 'convertible'];
export function seededRandom(seed = 1) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function difficulty(seconds) {
  const t = Math.max(0, Math.min(RULES.duration, seconds));
  const quick = 1 - Math.exp(-t / 28);
  const slow = Math.pow(t / 600, 1.55);
  const surge = Math.pow(Math.max(0, (t - 360) / 240), 2.4);
  return { step: Math.max(0.085, 0.86 - 0.39 * quick - 0.23 * slow - 0.155 * surge),
    spawn: Math.max(0.11, 1.65 - 0.84 * quick - 0.43 * slow - 0.27 * surge),
    level: Math.min(10, 1 + Math.floor(2.7 * quick + 3.3 * slow + 3.1 * surge)) };
}
export class ParkingGame {
  constructor({ random = Math.random, demo = false } = {}) {
    this.random = random; this.demo = demo; this.time = 0; this.score = 0; this.lives = 3;
    this.status = 'running'; this.reason = ''; this.spawnIn = 0.3; this.total = 0; this.blackCount = 0;
    this.passed = 0; this.blocked = 0; this.penalties = 0; this.events = [];
    this.lanes = Array.from({ length: 4 }, () => ({ cars: [], gateUntil: 0, readyAt: 0, lastOpen: -10 }));
  }
  emit(type, lane, car, extra = {}) { this.events.push({ type, lane, car: car ? { ...car } : null, time: this.time, ...extra }); }
  drainEvents() { return this.events.splice(0); }
  tap(index) {
    if (this.status !== 'running' || !Number.isInteger(index) || index < 0 || index > 3) return false;
    const lane = this.lanes[index];
    if (this.time < lane.readyAt) return false;
    lane.lastOpen = this.time; lane.gateUntil = this.time + RULES.openTime;
    lane.readyAt = lane.gateUntil + RULES.recovery;
    this.emit('open', index);
    const car = lane.cars.find(c => c.stage === RULES.finalStage && !c.resolved);
    if (car) this.resolve(index, car, true);
    return true;
  }
  spawn() {
    const eligible = this.lanes.map((l, i) => l.cars.some(c => c.stage < 2) ? -1 : i).filter(i => i >= 0);
    if (!eligible.length) return false;
    const lane = eligible[Math.floor(this.random() * eligible.length)];
    const total = this.total + 1;
    const black = this.blackCount < Math.floor(total / 10) && this.random() < 0.1;
    if (black) this.blackCount++;
    this.total = total;
    const tempo = difficulty(this.time);
    this.lanes[lane].cars.push({ id: total, stage: 0, clock: 0, step: tempo.step, black,
      color: COLORS[Math.floor(this.random() * COLORS.length)], type: TYPES[Math.floor(this.random() * TYPES.length)],
      plate: String(100 + Math.floor(this.random() * 900)), resolved: false });
    return true;
  }
  resolve(index, car, opened) {
    if (car.resolved || this.status !== 'running') return;
    car.resolved = true;
    const lane = this.lanes[index];
    if (opened) {
      if (car.black) { this.score -= RULES.penalty; this.penalties++; this.emit('penalty', index, car); }
      else { this.score += RULES.points; this.passed++; this.emit('pass', index, car); }
    } else if (car.black) { this.blocked++; this.emit('explode', index, car); }
    else { this.lives--; this.emit('crash', index, car); if (this.lives <= 0) this.end('lives'); }
  }
  end(reason) {
    if (this.status !== 'running') return;
    this.status = 'ended'; this.reason = reason; this.emit('end', -1, null, { reason });
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.status !== 'running') return;
    while (dt > 0.000001 && this.status === 'running') {
      const tick = Math.min(dt, 0.01, RULES.duration - this.time); dt -= tick; this.time += tick;
      if (this.time >= RULES.duration - 0.000001) { this.time = RULES.duration; this.end('time'); break; }
      this.spawnIn -= tick;
      if (this.spawnIn <= 0) this.spawnIn += this.spawn() ? difficulty(this.time).spawn * (0.83 + this.random() * 0.34) : 0.06;
      for (let i = 0; i < 4 && this.status === 'running'; i++) {
        const lane = this.lanes[i];
        for (const car of lane.cars) {
          if (car.resolved) continue;
          car.clock += tick;
          if (car.stage === RULES.finalStage) {
            if (this.demo && !car.black && car.clock > car.step * 0.28) this.tap(i);
            if (!car.resolved && this.time < lane.gateUntil) this.resolve(i, car, true);
          }
          if (!car.resolved && car.clock >= car.step) {
            car.clock -= car.step;
            if (car.stage === RULES.finalStage) this.resolve(i, car, false);
            else { car.stage++; if (car.stage === RULES.finalStage) this.emit('reveal', i, car); }
          }
        }
        lane.cars = lane.cars.filter(c => !c.resolved);
      }
    }
  }
}
