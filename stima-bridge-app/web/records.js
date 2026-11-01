// Records are CSV files in data/records, saved by the local server. A real service needs an encrypted server database.
// The hosted demo has no server, so each visitor's records stay in their own browser.
// The phone's own state, its signed-in user and inbox, stays in this browser.
import { emptyRecords } from '../src/core/records.js';

const URL = '/api/records';
const PHONE_KEY = 'stima-bridge-phone';
const LOCAL_KEY = 'stima-bridge-records';
let queue = Promise.resolve();

function loadLocal() {
  try {
    return { ...emptyRecords(), ...JSON.parse(localStorage.getItem(LOCAL_KEY)) };
  } catch {
    return emptyRecords();
  }
}

function saveLocal(records) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

export async function loadRecords() {
  try {
    const res = await fetch(URL);
    if (!res.ok) throw new Error('unavailable');
    return await res.json();
  } catch {
    return loadLocal();
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

// Resolves to where the records went: csv, browser or null.
export function saveRecords({ users, reports, transactions }) {
  const records = { users, reports, transactions };
  queue = queue.then(async () => {
    if (await post(records)) return 'csv';
    return saveLocal(records) ? 'browser' : null;
  });
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
