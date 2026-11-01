// Dark Days detector. Works only from token purchases: meter, time, amount and kWh.
export const DEFAULT_PARAMS = {
  minDarkDays: 0.5,
  maxGapDays: 30,
  lowUseKwhPerDay: 0.2,
  burnMargin: 1,
  burnQuantile: 0.6,
  mixedUseKwhPerDay: 2.2,
};
const RANGE = 0.2;
const DAY_MS = 86400000;

// Walks the purchases forward, predicting when each token runs out at a given burn rate.
function walk(purchases, burn, end, params) {
  const gaps = [];
  let balance = 0;
  for (let i = 0; i < purchases.length; i++) {
    const from = purchases[i].t;
    const to = i + 1 < purchases.length ? purchases[i + 1].t : end;
    const gap = to - from;
    const available = balance + purchases[i].kwh;
    const lasts = available / burn;
    if (gap > params.maxGapDays) {
      gaps.push({ from, to, gap, lasts, absent: true, dark: 0 });
      balance = 0;
      continue;
    }
    gaps.push({ from, to, gap, lasts, absent: false, dark: Math.max(0, gap - lasts) });
    balance = Math.max(0, available - gap * burn);
  }
  return gaps;
}

// True use is at least the overall average. Short token-to-token intervals reveal it more closely,
// because dark time only ever stretches an interval. Feeding dark time back into this estimate
// runs away, so burn comes from the interval rates alone.
function estimateBurn(purchases, end, params) {
  const totalKwh = purchases.reduce((s, p) => s + p.kwh, 0);
  const overall = totalKwh / Math.max(1, end - purchases[0].t);
  const rates = [];
  for (let i = 0; i + 1 < purchases.length; i++) {
    const gap = purchases[i + 1].t - purchases[i].t;
    if (gap >= 0.5 && gap <= params.maxGapDays) rates.push(purchases[i].kwh / gap);
  }
  if (!rates.length) return overall;
  rates.sort((a, b) => a - b);
  return Math.max(overall, rates[Math.floor(params.burnQuantile * (rates.length - 1))]);
}

export function analyzeMeter(meterId, purchases, period, params = DEFAULT_PARAMS) {
  const months = Math.max(1, period.days / 30);
  const base = { meterId, purchases: purchases.length, burn: 0, flags: [], episodes: [], darkDays: 0, low: 0, high: 0, perMonth: 0, darkDayIndex: [] };
  if (purchases.length < 3) return { ...base, flags: ['too_few_purchases'], excluded: true };

  const end = period.start + period.days;
  const burn = estimateBurn(purchases, end, params);
  const flags = [];
  if (burn < params.lowUseKwhPerDay) flags.push('very_low_use');
  if (burn > params.mixedUseKwhPerDay) flags.push('possible_mixed_use');
  const gaps = walk(purchases, burn * params.burnMargin, end, params);
  if (gaps.some((g) => g.absent)) flags.push('long_gap');
  const excluded = flags.includes('very_low_use');

  const episodes = [];
  const countAt = (rate) => walk(purchases, rate, end, params)
    .filter((g) => g.dark >= params.minDarkDays).reduce((s, g) => s + g.dark, 0);
  if (!excluded) {
    for (const g of gaps) {
      if (g.dark >= params.minDarkDays) episodes.push({ start: g.from + g.lasts, end: g.to, days: g.dark, open: g.to === end });
    }
  }
  const darkDayIndex = [];
  for (const e of episodes) {
    for (let d = Math.floor(e.start); d < e.end; d++) {
      const overlap = Math.min(d + 1, e.end) - Math.max(d, e.start);
      if (overlap >= 0.25) darkDayIndex.push(d - Math.floor(period.start));
    }
  }
  const darkDays = episodes.reduce((s, e) => s + e.days, 0);
  const rate = burn * params.burnMargin;
  return {
    ...base,
    burn,
    flags,
    excluded,
    episodes,
    darkDayIndex,
    darkDays,
    low: excluded ? 0 : countAt(rate * (1 - RANGE)),
    high: excluded ? 0 : countAt(rate * (1 + RANGE)),
    perMonth: darkDays / months,
  };
}

export function periodOf(rows) {
  const start = Math.floor(Math.min(...rows.map((r) => r.t)));
  const end = Math.ceil(Math.max(...rows.map((r) => r.t)));
  return { start, days: end - start };
}

export const dayLabel = (t) => new Date(t * DAY_MS).toISOString().slice(0, 10);
