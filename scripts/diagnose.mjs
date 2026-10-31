// Training-set error inspection. Never run this against the test set.
import { readFileSync } from 'node:fs';
import { loadSet } from '../src/core/load.js';
import { analyzeMeter } from '../src/core/detector.js';

const r = JSON.parse(readFileSync('results/train.json', 'utf8'));
console.table(r.byKind);
console.log(r.darkDaysPerMeterMonth);
const params = JSON.parse(readFileSync('src/core/params.json', 'utf8'));
const s = loadSet('train');
for (const kind of ['daily', 'weekly', 'salaried']) {
  let shown = 0;
  for (const t of s.truth) {
    if (t.kind !== kind || shown++ >= 2) continue;
    const list = s.meters.get(t.meter_id) || [];
    const a = analyzeMeter(t.meter_id, list, s.period, params);
    console.log(kind, 'burn', a.burn.toFixed(2), 'purchases', list.length);
    console.log(' true', t.darkDays.slice(0, 16).join(' '));
    console.log(' pred', a.darkDayIndex.slice(0, 16).join(' '));
    console.log(' buys', list.slice(0, 10).map((x) => `${(x.t - s.period.start).toFixed(1)}:${x.kwh}`).join(' '));
  }
}
