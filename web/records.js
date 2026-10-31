// Records are CSV files in data/records, saved by the local server. A real service needs an encrypted server database.
// The phone's own state, its signed-in user and inbox, stays in this browser.
import { emptyRecords } from '../src/core/records.js';

const URL = '/api/records';
const PHONE_KEY = 'stima-bridge-phone';
let queue = Promise.resolve();

export async function loadRecords() {
  try {
    const res = await fetch(URL);
    if (!res.ok) throw new Error('unavailable');
    return await res.json();
  } catch {
    return { ...emptyRecords(), offline: true };
  }
}

async function post(records) {
  try {
    const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(records) });
    return res.ok;
  } catch {
    return false;
  }
}

export function saveRecords({ users, reports, transactions }) {
  queue = queue.then(() => post({ users, reports, transactions }));
  return queue;
}

export const clearRecords = () => saveRecords(emptyRecords());

export function loadPhone() {
  try {
    return JSON.parse(localStorage.getItem(PHONE_KEY)) || { currentId: null, inbox: [] };
  } catch {
    return { currentId: null, inbox: [] };
  }
}

export function savePhone(phone) {
  try {
    localStorage.setItem(PHONE_KEY, JSON.stringify(phone));
  } catch { /* The phone still runs for this visit. */ }
}

export const maskId = (id) => `••••${id.slice(-2)}`;
export const maskPhone = (phone) => `${phone.slice(0, 2)}••••${phone.slice(-2)}`;
