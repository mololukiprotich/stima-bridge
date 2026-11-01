import { readFileSync } from 'node:fs';
import { parsePurchases, groupByMeter } from './csv.js';

export function loadSet(name) {
  const { rows } = parsePurchases(readFileSync(`data/${name}/purchases.csv`, 'utf8'));
  const truth = JSON.parse(readFileSync(`data/${name}/truth.json`, 'utf8'));
  const cfg = JSON.parse(readFileSync(`generator/config.${name}.json`, 'utf8'));
  return {
    meters: groupByMeter(rows),
    truth,
    period: { start: Date.parse(`${cfg.startDate}T00:00:00Z`) / 86400000, days: cfg.days },
  };
}
