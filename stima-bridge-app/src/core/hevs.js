// HEVS is a rule-based need score from 0 to 100.
// Its one job: decide who is offered Stima Bridge first. It never decides who may borrow.
export const WEIGHTS = { dark: 40, small: 20, frequent: 15, monthEnd: 10, irregular: 15 };
export const TIERS = { priority: 50, watch: 25 };
export const SMALL_TOKEN_KSH = 100;

const clamp = (x) => Math.min(1, Math.max(0, x));

function parts(result, purchases, period) {
  const months = Math.max(1, period.days / 30);
  const gaps = purchases.slice(1).map((p, i) => p.t - purchases[i].t);
  const mean = gaps.reduce((s, g) => s + g, 0) / Math.max(1, gaps.length);
  const spread = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / Math.max(1, gaps.length));
  const lateMonth = result.darkDayIndex.filter((d) => new Date((period.start + d) * 86400000).getUTCDate() >= 23).length;
  return {
    dark: clamp(result.perMonth / 4),
    small: purchases.filter((p) => p.amount_ksh <= SMALL_TOKEN_KSH).length / Math.max(1, purchases.length),
    frequent: clamp(purchases.length / months / 10),
    monthEnd: result.darkDayIndex.length ? lateMonth / result.darkDayIndex.length : 0,
    irregular: clamp(mean ? spread / mean / 1.5 : 0),
  };
}

const REASONS = {
  dark: 'Often without power',
  small: 'Mostly small tokens',
  frequent: 'Buys very often',
  monthEnd: 'Runs out near month end',
  irregular: 'Irregular buying',
};

export function scoreHevs(result, purchases, period) {
  if (result.excluded) return { score: null, tier: 'Review', reasons: ['Check by hand: too little evidence or very low use'], parts: null };
  const p = parts(result, purchases, period);
  const score = Math.round(Object.keys(WEIGHTS).reduce((s, k) => s + WEIGHTS[k] * p[k], 0));
  const tier = score >= TIERS.priority ? 'Priority' : score >= TIERS.watch ? 'Watch' : 'Stable';
  const reasons = Object.keys(WEIGHTS)
    .sort((a, b) => WEIGHTS[b] * p[b] - WEIGHTS[a] * p[a])
    .filter((k) => p[k] >= 0.4)
    .slice(0, 2)
    .map((k) => REASONS[k]);
  return { score, tier, reasons, parts: p };
}
