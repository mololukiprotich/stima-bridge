// Scores the fixed detector on the held-out test set. Run after tuning is final.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadSet } from '../src/core/load.js';
import { score } from '../src/core/metrics.js';
import { analyzeMeter } from '../src/core/detector.js';
import { scoreHevs } from '../src/core/hevs.js';

const params = JSON.parse(readFileSync('src/core/params.json', 'utf8'));
const { meters, truth, period } = loadSet('test');
const detector = score(meters, truth, period, params);

const HIGH_NEED_DARK_PER_MONTH = 2;
const tiers = {};
for (const t of truth) {
  const list = meters.get(t.meter_id) || [];
  const hevs = scoreHevs(analyzeMeter(t.meter_id, list, period, params), list, period);
  const highNeed = t.darkDays.length / (period.days / 30) >= HIGH_NEED_DARK_PER_MONTH;
  const row = (tiers[hevs.tier] ||= { meters: 0, highNeed: 0, vulnerable: 0 });
  row.meters++;
  if (highNeed) row.highNeed++;
  if (t.vulnerable) row.vulnerable++;
}
const allHigh = Object.values(tiers).reduce((s, r) => s + r.highNeed, 0);
const out = {
  note: 'Synthetic held-out test set. A test of method only, not an estimate of real Kenyan dark days.',
  params,
  detector,
  hevs: { tiers, highNeedFoundInPriority: (tiers.Priority?.highNeed || 0) / Math.max(1, allHigh) },
};
writeFileSync('results/test.json', JSON.stringify(out, null, 2) + '\n');
console.log('test day', detector.day, 'episode', detector.episode);
console.log(detector.darkDaysPerMeterMonth);
console.table(detector.byKind);
console.table(tiers);
console.log('high-need share in Priority', out.hevs.highNeedFoundInPriority);
