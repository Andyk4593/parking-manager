import test from 'node:test';
import assert from 'node:assert/strict';
import { ParkingGame, RULES, difficulty, seededRandom } from '../src/model.mjs';
function finalCar(game, black = false, lane = 0) {
  const car = { id: ++game.total, stage: 6, clock: 0, step: 0.5, black, type: 'sedan', color: '#ffffff', plate: '123' };
  game.lanes[lane].cars.push(car); game.spawnIn = 100; return car;
}
test('white pass awards five exactly once', () => { const g = new ParkingGame(); const c = finalCar(g); g.tap(0); g.resolve(0, c, true); assert.equal(g.score, 5); assert.equal(g.lives, 3); });
test('white closed loses one life and emits driver crash', () => { const g = new ParkingGame(); finalCar(g); g.update(0.6); assert.equal(g.lives, 2); assert.ok(g.drainEvents().some(e => e.type === 'crash')); });
test('three white crashes end the game; no further input or scoring', () => { const g = new ParkingGame(); for (let i = 0; i < 3; i++) finalCar(g, false, i); g.update(0.6); assert.equal(g.lives, 0); assert.equal(g.status, 'ended'); assert.equal(g.tap(3), false); });
test('black passed costs 15, supports negative scores, no lost life', () => { const g = new ParkingGame(); finalCar(g, true); g.tap(0); assert.equal(g.score, -15); assert.equal(g.lives, 3); });
test('black blocked explodes with no points or life loss', () => { const g = new ParkingGame(); finalCar(g, true); g.update(0.6); assert.equal(g.score, 0); assert.equal(g.lives, 3); assert.ok(g.drainEvents().some(e => e.type === 'explode')); });
test('tap is a 650ms pulse; spam does not extend it', () => { const g = new ParkingGame(); g.spawnIn = 100; assert.ok(g.tap(0)); g.update(0.3); assert.equal(g.tap(0), false); assert.equal(g.lanes[0].gateUntil, 0.65); g.update(0.4); assert.ok(g.time >= g.lanes[0].gateUntil); assert.equal(g.tap(0), false); g.update(0.12); assert.ok(g.tap(0)); });
test('an open barrier admits a following vehicle while still open', () => { const g = new ParkingGame(); finalCar(g); g.tap(0); finalCar(g); g.update(0.1); assert.equal(g.score, 10); });
test('early pulse expires before white arrival', () => { const g = new ParkingGame(); g.spawnIn = 100; g.tap(0); g.update(0.9); finalCar(g); g.update(0.6); assert.equal(g.score, 0); assert.equal(g.lives, 2); });
test('only final position can be served', () => { const g = new ParkingGame(); const c = finalCar(g); c.stage = 3; g.tap(0); assert.equal(g.score, 0); assert.equal(c.resolved, undefined); });
test('difficulty rises monotonically with quick first minute and late surge', () => { let prev = difficulty(0); for (let t = 1; t <= 600; t++) { const d = difficulty(t); assert.ok(d.step <= prev.step); assert.ok(d.spawn <= prev.spawn); assert.ok(d.step > 0); prev = d; } assert.ok(difficulty(60).spawn < difficulty(0).spawn * 0.6); assert.ok(difficulty(590).spawn < 0.2); });
test('hard ten-minute finish even for a surviving player', () => { const g = new ParkingGame(); g.time = 599.9; g.spawnIn = 100; g.update(2); assert.equal(g.time, 600); assert.equal(g.reason, 'time'); });
test('black prefix quota <=10% over 100000 generated vehicles', () => { const g = new ParkingGame({ random: seededRandom(773) }); const kinds = new Set(); let monochrome = 0; for (let i = 1; i <= 100000; i++) { g.lanes.forEach(l => l.cars = []); g.spawn(); assert.ok(g.blackCount <= Math.floor(g.total / 10)); const c = g.lanes.flatMap(l => l.cars)[0]; kinds.add(c.type); if (['#e8e5d9','#262c32'].includes(c.color)) monochrome++; if (i < 10) assert.equal(c.black, false); } assert.equal(kinds.size, 5); assert.ok(monochrome / g.total > 0.58); assert.ok(g.blackCount / g.total > 0.09); });
test('invalid input and invalid dt do nothing', () => { const g = new ParkingGame(); for (const i of [-1,4,NaN,0.1]) assert.equal(g.tap(i), false); for (const dt of [0,-1,NaN,Infinity]) g.update(dt); assert.equal(g.time, 0); });
test('deterministic seeded replay', () => { const a = new ParkingGame({ random: seededRandom(22) }), b = new ParkingGame({ random: seededRandom(22) }); for (let i = 0; i < 500; i++) { a.update(0.016); b.update(0.016); if (i % 25 === 0) { a.tap(i % 4); b.tap(i % 4); } } assert.equal(JSON.stringify(a), JSON.stringify(b)); });
