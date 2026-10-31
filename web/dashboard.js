import { parsePurchases, groupByMeter } from '../src/core/csv.js';
import { analyzeMeter, periodOf, dayLabel, DEFAULT_PARAMS } from '../src/core/detector.js';
import { scoreHevs, TIERS } from '../src/core/hevs.js';
import { loadRecords, clearRecords, maskId, maskPhone } from './records.js';

const $ = (id) => document.getElementById(id);
const TIER_ORDER = ['Priority', 'Watch', 'Stable', 'Review'];
const TABLE_LIMIT = 100;
const MATCH_WINDOW_DAYS = 3;
let params = { ...DEFAULT_PARAMS };
let cutoff = TIERS.priority;
let dataset = null;
let results = [];
let revealed = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function load(text, label) {
  const { rows, errors } = parsePurchases(text);
  if (!rows.length) {
    $('status').textContent = errors.join(' ') || 'No purchases found.';
    return;
  }
  dataset = { meters: groupByMeter(rows), period: periodOf(rows), rows: rows.length };
  $('status').textContent = `${label}: ${rows.length.toLocaleString()} purchases from ${dataset.meters.size.toLocaleString()} meters. ${errors.join(' ')}`;
  analyse();
}

function analyse() {
  if (!dataset) return;
  params = { ...params, minDarkDays: Number($('minDark').value) || params.minDarkDays, maxGapDays: Number($('maxGap').value) || params.maxGapDays };
  cutoff = Number($('priority').value) || TIERS.priority;
  results = [...dataset.meters].map(([id, list]) => {
    const r = analyzeMeter(id, list, dataset.period, params);
    const h = scoreHevs(r, list, dataset.period);
    if (h.score !== null) h.tier = h.score >= cutoff ? 'Priority' : h.score >= TIERS.watch ? 'Watch' : 'Stable';
    return { ...r, hevs: h, list };
  }).sort((a, b) => (b.hevs.score ?? -1) - (a.hevs.score ?? -1));
  render();
}

function render() {
  const months = dataset.period.days / 30;
  const counted = results.filter((r) => !r.excluded);
  const n = Math.max(1, counted.length);
  const mean = counted.reduce((s, r) => s + r.perMonth, 0) / n;
  const low = counted.reduce((s, r) => s + r.low, 0) / n / months;
  const high = counted.reduce((s, r) => s + r.high, 0) / n / months;
  const tiers = Object.fromEntries(TIER_ORDER.map((t) => [t, results.filter((r) => r.hevs.tier === t).length]));

  $('summary').innerHTML = [
    [results.length.toLocaleString(), 'meters analysed'],
    [mean.toFixed(1), `dark days a month per meter (range ${Math.min(low, high).toFixed(1)}–${Math.max(low, high).toFixed(1)})`],
    [tiers.Priority.toLocaleString(), 'Priority households'],
    [tiers.Review.toLocaleString(), 'need a manual check'],
  ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');

  $('tiers').innerHTML = TIER_ORDER.map((t) => {
    const pct = (tiers[t] / results.length) * 100;
    return `<div class="tierrow"><span>${t}</span><div class="track"><div class="fill ${t}" style="width:${pct.toFixed(1)}%"></div></div><span>${tiers[t]}</span></div>`;
  }).join('');

  $('rows').innerHTML = results.slice(0, TABLE_LIMIT).map((r) => `
    <tr tabindex="0" data-id="${esc(r.meterId)}">
      <td class="num">${esc(r.meterId)}</td>
      <td class="num">${r.hevs.score ?? '–'}</td>
      <td><span class="pill ${r.hevs.tier}">${r.hevs.tier}</span></td>
      <td class="num">${r.excluded ? '–' : r.perMonth.toFixed(1)}</td>
      <td class="num">${r.excluded ? '–' : `${(Math.min(r.low, r.high) / months).toFixed(1)}–${(Math.max(r.low, r.high) / months).toFixed(1)}`}</td>
      <td>${esc(r.hevs.reasons.join('; ') || 'No strong signal')}</td>
    </tr>`).join('');
  $('tableNote').textContent = results.length > TABLE_LIMIT ? `Showing the top ${TABLE_LIMIT} of ${results.length.toLocaleString()} meters.` : '';
  if (results.length) showDetail(results[0].meterId);
  renderRecords();
}

function detectorCheck(report) {
  if (!dataset) return 'No purchase data loaded';
  const r = results.find((x) => x.meterId === report.meter);
  if (!r) return 'Meter not in purchase data';
  const t = Date.parse(report.at) / 86400000;
  const { start, days } = dataset.period;
  if (t < start || t > start + days + MATCH_WINDOW_DAYS) return 'Outside purchase data dates';
  const near = r.episodes.some((e) => t >= e.start - MATCH_WINDOW_DAYS && t <= e.end + MATCH_WINDOW_DAYS);
  return near ? 'Matches an estimated dark period' : 'No estimated dark period nearby';
}

function renderRecords() {
  const { users, reports } = loadRecords();
  const showId = (id) => esc(revealed ? id : maskId(id));
  const showPhone = (p) => esc(revealed ? p : maskPhone(p));
  $('revealRecords').textContent = revealed ? 'Hide full details' : 'Show full details';
  $('users').innerHTML = users.length ? users.map((u) => {
    const own = reports.filter((r) => r.id === u.id);
    const total = own.reduce((s, r) => s + r.days, 0);
    return `<tr><td class="num">${showId(u.id)}</td><td class="num">${showPhone(u.phone)}</td><td class="num">${esc(u.meter)}</td>
      <td>${esc(u.consentAt.slice(0, 10))}, ${esc(u.policyVersion)}</td><td class="num">${own.length}</td><td class="num">${total.toFixed(1)}</td></tr>`;
  }).join('') : '<tr><td colspan="6">No one has set up yet. Use the USSD prototype to add a record.</td></tr>';
  $('reports').innerHTML = reports.length ? [...reports].reverse().map((r) => `
    <tr><td class="num">${esc(r.at.slice(0, 16).replace('T', ' '))}</td><td class="num">${showId(r.id)}</td><td class="num">${showPhone(r.phone)}</td>
      <td class="num">${esc(r.meter)}</td><td>${esc(r.band)}</td><td>${esc(detectorCheck(r))}</td></tr>`).join('') : '<tr><td colspan="6">No reports yet.</td></tr>';
}

function showDetail(id) {
  const r = results.find((x) => x.meterId === id);
  if (!r) return false;
  const { start, days } = dataset.period;
  const x = (t) => ((t - start) / days) * 100;
  $('detailPanel').hidden = false;
  $('detailTitle').textContent = `Meter ${r.meterId}`;
  const flags = { very_low_use: 'very low use', possible_mixed_use: 'possible home business', long_gap: 'long gap treated as away', too_few_purchases: 'too few purchases' };
  const note = r.flags.map((f) => flags[f]).join(', ');
  $('detailText').textContent = `${dayLabel(start)} to ${dayLabel(start + days)}. ${r.purchases} tokens, about ${r.burn.toFixed(2)} kWh a day, ${r.episodes.length} dark periods.${note ? ` Flags: ${note}.` : ''}`;
  $('timeline').innerHTML = [
    ...r.episodes.map((e) => `<i class="dark" style="left:${x(e.start).toFixed(2)}%;width:${(x(e.end) - x(e.start)).toFixed(2)}%"></i>`),
    ...r.list.map((p) => `<i class="buy" style="left:${x(p.t).toFixed(2)}%"></i>`),
  ].join('');
  return true;
}

async function loadAccuracy() {
  try {
    const res = await fetch('../results/test.json');
    if (!res.ok) throw new Error('missing');
    const t = await res.json();
    const pct = (v) => `${Math.round(v * 100)}%`;
    const d = t.detector;
    $('accuracy').innerHTML = `
      <p class="hint">Held-out synthetic test, scored after settings were fixed.</p>
      <div class="scores">
        <div><b>${pct(d.day.precision)}</b>Dark days flagged correctly</div>
        <div><b>${pct(d.day.recall)}</b>Actual dark days found</div>
        <div><b>${d.darkDaysPerMeterMonth.estimated.toFixed(1)}</b>Estimated a month</div>
        <div><b>${d.darkDaysPerMeterMonth.actual.toFixed(1)}</b>Actual a month</div>
      </div>`;
  } catch {
    $('accuracy').innerHTML = '<p class="hint">Run the evaluation to show test results here.</p>';
  }
}

async function start() {
  try {
    const res = await fetch('../src/core/params.json');
    if (res.ok) params = { ...params, ...(await res.json()) };
  } catch { /* Defaults apply. */ }
  $('minDark').value = params.minDarkDays;
  $('maxGap').value = params.maxGapDays;
  $('priority').value = cutoff;

  $('sample').addEventListener('click', async () => {
    $('status').textContent = 'Loading sample data.';
    try {
      const res = await fetch('../data/demo/purchases.csv');
      if (!res.ok) throw new Error('missing');
      load(await res.text(), 'Sample data');
    } catch {
      $('status').textContent = 'Sample data could not load. Upload a CSV instead.';
    }
  });
  $('file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) load(await file.text(), file.name);
  });
  ['minDark', 'maxGap', 'priority'].forEach((id) => $(id).addEventListener('change', analyse));
  $('search').addEventListener('input', (e) => {
    const id = e.target.value.trim();
    if (!id || !dataset) return void ($('searchNote').textContent = '');
    $('searchNote').textContent = showDetail(id) ? 'Showing this meter above the table.' : 'No exact match yet.';
  });
  $('rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (tr) showDetail(tr.dataset.id);
  });
  $('rows').addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr');
    if (tr && e.key === 'Enter') showDetail(tr.dataset.id);
  });
  $('revealRecords').addEventListener('click', () => {
    revealed = !revealed;
    renderRecords();
  });
  $('clearRecords').addEventListener('click', () => {
    clearRecords();
    renderRecords();
  });
  window.addEventListener('storage', renderRecords);
  renderRecords();
  loadAccuracy();
  $('sample').click();
}
start();
