import { analyzeMeter } from './detector.js';

function runs(days) {
  const out = [];
  for (const d of [...days].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && d === last[1] + 1) last[1] = d;
    else out.push([d, d]);
  }
  return out;
}

const overlaps = (a, b) => a[0] <= b[1] && b[0] <= a[1];

export function ratio(hit, total) {
  return total ? hit / total : 0;
}

export function score(meters, truth, period, params) {
  const totals = { tpDays: 0, fpDays: 0, fnDays: 0, predEp: 0, predHit: 0, trueEp: 0, trueHit: 0, trueDark: 0, foundDark: 0 };
  const byKind = {};
  for (const t of truth) {
    const list = meters.get(t.meter_id) || [];
    const r = analyzeMeter(t.meter_id, list, period, params);
    // Purchase data cannot show anything before a meter's first purchase, so those days are not scored.
    const firstDay = list.length ? Math.floor(list[0].t - period.start) : Infinity;
    const scoredDark = t.darkDays.filter((d) => d >= firstDay);
    const truthDays = new Set(scoredDark);
    const found = new Set(r.darkDayIndex);
    const tp = [...found].filter((d) => truthDays.has(d)).length;
    const fp = found.size - tp;
    const fn = truthDays.size - tp;
    totals.tpDays += tp;
    totals.fpDays += fp;
    totals.fnDays += fn;
    const trueRuns = runs(scoredDark);
    const predRuns = runs(r.darkDayIndex);
    totals.predEp += predRuns.length;
    totals.predHit += predRuns.filter((p) => trueRuns.some((x) => overlaps(p, x))).length;
    totals.trueEp += trueRuns.length;
    totals.trueHit += trueRuns.filter((x) => predRuns.some((p) => overlaps(p, x))).length;
    totals.trueDark += truthDays.size;
    totals.foundDark += found.size;
    const k = (byKind[t.kind] ||= { meters: 0, trueDays: 0, predictedDays: 0, truePositiveDays: 0 });
    k.meters++;
    k.trueDays += truthDays.size;
    k.predictedDays += found.size;
    k.truePositiveDays += tp;
  }
  const precision = ratio(totals.tpDays, totals.tpDays + totals.fpDays);
  const recall = ratio(totals.tpDays, totals.tpDays + totals.fnDays);
  const episodePrecision = ratio(totals.predHit, totals.predEp);
  const episodeRecall = ratio(totals.trueHit, totals.trueEp);
  return {
    day: { precision, recall, f1: ratio(2 * precision * recall, precision + recall) },
    episode: {
      precision: episodePrecision,
      recall: episodeRecall,
      f1: ratio(2 * episodePrecision * episodeRecall, episodePrecision + episodeRecall),
    },
    darkDaysPerMeterMonth: {
      actual: totals.trueDark / truth.length / (period.days / 30),
      estimated: totals.foundDark / truth.length / (period.days / 30),
    },
    byKind,
  };
}
