// Tunes detector settings on the training set only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadSet } from '../src/core/load.js';
import { score } from '../src/core/metrics.js';
import { DEFAULT_PARAMS } from '../src/core/detector.js';

const { meters, truth, period } = loadSet('train');
const grid = {
  minDarkDays: [0.25, 0.5, 0.75, 1],
  maxGapDays: [21, 30, 45],
  lowUseKwhPerDay: [0.15, 0.2, 0.3],
  burnMargin: [0.8, 0.9, 1, 1.1],
  burnQuantile: [0.4, 0.5, 0.6, 0.7, 0.8],
};
let best = null;
for (const minDarkDays of grid.minDarkDays) {
  for (const maxGapDays of grid.maxGapDays) {
    for (const lowUseKwhPerDay of grid.lowUseKwhPerDay) {
      for (const burnMargin of grid.burnMargin) {
        for (const burnQuantile of grid.burnQuantile) {
          const params = { ...DEFAULT_PARAMS, minDarkDays, maxGapDays, lowUseKwhPerDay, burnMargin, burnQuantile };
          const s = score(meters, truth, period, params);
          if (!best || s.day.f1 > best.s.day.f1) best = { params, s };
        }
      }
    }
  }
}
mkdirSync('results', { recursive: true });
writeFileSync('src/core/params.json', JSON.stringify(best.params, null, 2) + '\n');
writeFileSync('results/train.json', JSON.stringify(best.s, null, 2) + '\n');
console.log(best.params);
console.log('train day', best.s.day, 'episode', best.s.episode);
