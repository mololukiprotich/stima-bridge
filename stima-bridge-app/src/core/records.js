// CSV storage for USSD records. Values are digits, dates or fixed labels, so they never need quoting.
import { toCsv } from './csv.js';

export const TABLES = {
  users: { columns: ['id', 'phone', 'meter', 'lang', 'joinedAt', 'consentAt', 'policyVersion', 'left', 'owed', 'repaid'], numbers: ['owed', 'repaid'], flags: ['left'] },
  reports: { columns: ['at', 'id', 'phone', 'meter', 'band', 'days'], numbers: ['days'], flags: [] },
  transactions: { columns: ['at', 'type', 'id', 'phone', 'meter', 'amount_ksh', 'fee_ksh', 'repaid_ksh', 'kwh', 'owed_after', 'token'], numbers: ['amount_ksh', 'fee_ksh', 'repaid_ksh', 'kwh', 'owed_after'], flags: [] },
};

export const emptyRecords = () => ({ users: [], reports: [], transactions: [] });

export function recordsToCsv(records) {
  return Object.fromEntries(Object.entries(TABLES).map(([name, t]) => [name, toCsv(t.columns, records[name] || [])]));
}

function parseTable(text, { columns, numbers, flags }) {
  const [, ...lines] = (text || '').trim().split(/\r?\n/);
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(',');
    const row = Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']));
    for (const c of numbers) row[c] = Number(row[c]);
    for (const c of flags) row[c] = row[c] === 'true';
    return row;
  });
}

export function recordsFromCsv(texts) {
  return Object.fromEntries(Object.entries(TABLES).map(([name, t]) => [name, parseTable(texts[name], t)]));
}
