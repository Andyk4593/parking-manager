const fs = require('node:fs');
const path = require('node:path');
const SEEDS = [{ name: 'Вася', score: 90 }, { name: 'Петя', score: 60 }, { name: 'Толик', score: 30 }];
function cleanName(value) { return String(value ?? '').normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16); }
function normalize(entries) {
  if (!Array.isArray(entries)) throw new Error('Invalid entries');
  const best = new Map();
  for (const entry of entries) {
    const name = cleanName(entry.name), score = entry.score;
    if (!name || !Number.isSafeInteger(score) || Math.abs(score) > 1000000) throw new Error('Invalid entry');
    const key = name.toLocaleLowerCase('ru');
    if (!best.has(key) || best.get(key).score < score) best.set(key, { name, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
}
class Leaderboard {
  constructor(folder) { this.file = path.join(folder, 'leaderboard.json'); this.entries = SEEDS.map(x => ({ ...x })); this.warning = ''; this.load(); }
  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^\uFEFF/, ''));
      if (raw.version !== 1) throw new Error('Unknown format');
      this.entries = normalize(raw.entries);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        try { fs.renameSync(this.file, this.file + '.corrupt-' + Date.now()); } catch {}
        this.warning = 'Файл рейтинга недоступен или повреждён. Создан начальный рейтинг.';
      }
      this.write();
    }
  }
  write() {
    const tmp = this.file + '.tmp';
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const fd = fs.openSync(tmp, 'w');
      try { fs.writeFileSync(fd, JSON.stringify({ version: 1, entries: this.entries }, null, 2), 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(tmp, this.file);
      return true;
    } catch {
      this.warning = 'Рейтинг не сохранён на диск. Переместите игру в папку с правом записи.';
      try { fs.unlinkSync(tmp); } catch {}
      return false;
    }
  }
  add(name, score) {
    name = cleanName(name);
    if (!name || !Number.isSafeInteger(score) || Math.abs(score) > 1000000) throw new Error('Invalid score');
    this.entries = normalize([...this.entries, { name, score }]); this.warning = ''; this.write();
    return this.snapshot();
  }
  snapshot() { return { entries: this.entries.map(x => ({ ...x })), warning: this.warning, file: this.file }; }
}
module.exports = { Leaderboard, SEEDS, cleanName, normalize };
