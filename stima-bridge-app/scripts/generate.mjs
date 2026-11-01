import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generate } from '../generator/simulate.js';
import { toCsv } from '../src/core/csv.js';

const COLUMNS = ['meter_id', 'datetime', 'amount_ksh', 'kwh'];
const stamp = (t) => new Date(t * 86400000).toISOString().slice(0, 16);

function write(name, cfg, folder) {
  const { truth, purchases } = generate(cfg);
  const rows = purchases.map((p) => ({ ...p, datetime: stamp(p.t) }));
  mkdirSync(folder, { recursive: true });
  writeFileSync(`${folder}/purchases.csv`, toCsv(COLUMNS, rows));
  writeFileSync(`${folder}/truth.json`, JSON.stringify(truth));
  const dark = truth.reduce((s, t) => s + t.darkDays.length, 0) / truth.length / (cfg.days / 30);
  console.log(`${name}: ${truth.length} meters, ${rows.length} purchases, ${dark.toFixed(2)} dark days per meter per month`);
}

const train = JSON.parse(readFileSync('generator/config.train.json', 'utf8'));
const test = JSON.parse(readFileSync('generator/config.test.json', 'utf8'));
write('train', train, 'data/train');
write('test', test, 'data/test');
write('demo', { ...test, seed: 555, meters: 400 }, 'data/demo');
