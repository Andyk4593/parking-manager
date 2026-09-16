import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { Leaderboard, cleanName } = createRequire(import.meta.url)('../electron/leaderboard.cjs');
function temp(t) { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'parking-test-')); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p; }
test('missing file creates seeds and valid portable JSON', t => { const dir = temp(t), board = new Leaderboard(dir); assert.deepEqual(board.entries.map(e => e.score), [90,60,30]); assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'leaderboard.json'))).version, 1); });
test('top ten, sorted, best per normalized nickname, negatives accepted', t => { const board = new Leaderboard(temp(t)); board.add('Анна', -15); for(let i=0;i<14;i++) board.add('Игрок'+i,i*20); board.add('ИГРОК13', 400); board.add('игрок13', 50); assert.equal(board.entries.length, 10); assert.equal(board.entries[0].score, 400); assert.equal(board.entries.filter(e => e.name.toLowerCase() === 'игрок13').length, 1); });
test('copying only leaderboard file transfers all records', t => { const a = temp(t), b = temp(t); new Leaderboard(a).add('Перенос', 999); fs.copyFileSync(path.join(a,'leaderboard.json'),path.join(b,'leaderboard.json')); assert.equal(new Leaderboard(b).entries[0].name, 'Перенос'); });
test('corrupt file is backed up and seeds restored', t => { const dir = temp(t); fs.writeFileSync(path.join(dir,'leaderboard.json'),'broken'); const board = new Leaderboard(dir); assert.equal(board.entries[0].name, 'Вася'); assert.ok(fs.readdirSync(dir).some(f=>f.includes('corrupt-'))); });
test('unavailable destination gives visible failure, retains memory board', t => { const dir = temp(t), file = path.join(dir,'block'); fs.writeFileSync(file,'x'); const board = new Leaderboard(file); board.add('Тест', 100); assert.match(board.warning, /не сохранён/); assert.equal(board.entries[0].score,100); });
test('names, invalid score, malformed schema and BOM are handled', t => { assert.equal(cleanName('<script>Иван</script>'), 'scriptИванscript'); assert.throws(() => new Leaderboard(temp(t)).add('',0)); assert.throws(() => new Leaderboard(temp(t)).add('Иван',Infinity)); const dir=temp(t); fs.writeFileSync(path.join(dir,'leaderboard.json'),'\uFEFF'+JSON.stringify({version:1,entries:[{name:'БОМ',score:10}]})); assert.equal(new Leaderboard(dir).entries[0].name,'БОМ'); });
