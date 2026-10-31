export const REQUIRED_COLUMNS = ['meter_id', 'datetime', 'amount_ksh', 'kwh'];

export function parsePurchases(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], errors: ['The file has no purchase rows.'] };
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], errors: [`Missing columns: ${missing.join(', ')}.`] };
  const at = Object.fromEntries(REQUIRED_COLUMNS.map((c) => [c, header.indexOf(c)]));
  const rows = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const row = {
      meter_id: (cells[at.meter_id] || '').trim(),
      t: Date.parse(`${(cells[at.datetime] || '').trim()}Z`) / 86400000,
      amount_ksh: Number(cells[at.amount_ksh]),
      kwh: Number(cells[at.kwh]),
    };
    if (row.meter_id && Number.isFinite(row.t) && row.kwh > 0 && row.amount_ksh > 0) rows.push(row);
    else skipped++;
  }
  const errors = skipped ? [`Skipped ${skipped} invalid rows.`] : [];
  return { rows, errors };
}

export function groupByMeter(rows) {
  const meters = new Map();
  for (const row of rows) {
    if (!meters.has(row.meter_id)) meters.set(row.meter_id, []);
    meters.get(row.meter_id).push(row);
  }
  for (const list of meters.values()) list.sort((a, b) => a.t - b.t);
  return meters;
}

export function toCsv(columns, rows) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => r[c]).join(','))].join('\n') + '\n';
}
