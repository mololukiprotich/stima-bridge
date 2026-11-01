// Synthetic prepaid household simulator. The detector must never import this file or its configs.
import { rateForAverage } from '../src/core/tariff.js';

const TOKEN_SIZES = [1000, 500, 300, 200, 150, 100, 50];
const DARK_DAY_FRACTION = 0.25; // A day counts as dark after 6 or more hours without power.
const WARM_UP_DAYS = 60;

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const normal = (rand) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const logNormal = (rand, median, sigma) => median * Math.exp(sigma * normal(rand));

function pick(rand, weights) {
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (const [key, weight] of Object.entries(weights)) {
    r -= weight;
    if (r <= 0) return key;
  }
  return Object.keys(weights)[0];
}

function absenceDays(rand, kind, days) {
  const away = new Set();
  const block = (start, length) => {
    for (let d = start; d < Math.min(days, start + length); d++) away.add(d);
  };
  if (kind === 'vacant' || kind === 'tenant') block(Math.floor(30 + rand() * (days - 90)), Math.floor(30 + rand() * 30));
  if (kind === 'traveller') {
    const trips = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < trips; i++) block(Math.floor(rand() * (days - 15)), Math.floor(4 + rand() * 12));
  }
  return away;
}

function income(rand, type, day, cfg, startWeekday) {
  const monthDay = (day + 300) % 30;
  const squeeze = monthDay >= 23 ? 1 - cfg.monthEndSqueeze : 1;
  if (type.pay === 'daily') return rand() < type.workProb ? logNormal(rand, type.income, 0.6) * squeeze : 0;
  if (type.pay === 'weekly') return (day + 700 + startWeekday) % 7 === 5 ? logNormal(rand, type.income, 0.4) * squeeze : 0;
  return monthDay === 28 ? logNormal(rand, type.income, 0.2) : 0;
}

function simulateMeter(id, cfg, rand) {
  const kind = pick(rand, cfg.mix);
  const type = cfg.types[kind];
  let demand = logNormal(rand, type.useKwh, 0.35);
  const days = cfg.days;
  const away = absenceDays(rand, kind, days);
  const bypassFrom = kind === 'bypass' ? Math.floor(40 + rand() * 90) : Infinity;
  const tenantChange = kind === 'tenant' ? Math.max(...(away.size ? away : [days])) : Infinity;
  const hasArrears = rand() < cfg.arrearsShare;
  const startWeekday = Math.floor(rand() * 7);
  const trigger = 0.5 + rand() * 1.5;
  const budgetShare = type.share * (0.75 + rand() * 0.5);
  let balance = rand() * 5 * demand;
  let pot = rand() * 150;
  const purchases = [];
  const darkDays = [];
  const usedByDay = [];
  const start = Date.parse(`${cfg.startDate}T00:00:00Z`) / 86400000;

  // A warm-up period lets balances and budgets settle before anything is recorded.
  for (let day = -WARM_UP_DAYS; day < days; day++) {
    if (day === tenantChange) demand = logNormal(rand, type.useKwh, 0.35);
    const isAway = away.has(day);
    const onBypass = day >= bypassFrom;
    if (!isAway) pot += income(rand, type, day, cfg, startWeekday) * budgetShare;
    if (rand() < cfg.shockProb) pot *= 0.4;

    const need = isAway ? 0 : demand * (0.8 + rand() * 0.4);
    const rationing = balance < need * 2 ? type.ration : 1;
    const use = need * rationing;

    let buyAt = -1;
    let bought = 0;
    if (!isAway && !onBypass && balance < use * trigger) {
      const size = TOKEN_SIZES.find((s) => s <= pot);
      if (size) {
        const recent = usedByDay.slice(-90);
        const monthly = recent.length ? (recent.reduce((s, x) => s + x, 0) / recent.length) * 30 : demand * 30;
        const paid = hasArrears ? size * (1 - cfg.arrearsCut) : size;
        bought = paid / rateForAverage(monthly);
        pot -= size;
        buyAt = 0.25 + rand() * 0.6;
        if (day >= 0) purchases.push({ meter_id: id, t: start + day + buyAt, amount_ksh: size, kwh: Number(bought.toFixed(2)) });
      }
    }

    let dark = 0;
    let used = 0;
    const burn = (portion) => {
      const wanted = use * portion;
      if (onBypass) return void (used += wanted);
      const taken = Math.min(balance, wanted);
      balance -= taken;
      used += taken;
      if (use > 0) dark += ((wanted - taken) / use);
    };
    burn(buyAt >= 0 ? buyAt : 1);
    if (buyAt >= 0) {
      balance += bought;
      burn(1 - buyAt);
    }
    usedByDay.push(used);
    if (dark >= DARK_DAY_FRACTION && !isAway && day >= 0) darkDays.push(day);
  }
  return { truth: { meter_id: id, kind, vulnerable: type.vulnerable, darkDays }, purchases };
}

export function generate(cfg) {
  const rand = prng(cfg.seed);
  const truth = [];
  const purchases = [];
  for (let i = 0; i < cfg.meters; i++) {
    const id = String(37000000000 + cfg.seed * 1000 + i);
    const meter = simulateMeter(id, cfg, rand);
    truth.push(meter.truth);
    purchases.push(...meter.purchases);
  }
  return { truth, purchases };
}
