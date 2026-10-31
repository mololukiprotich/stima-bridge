// Prototype storage. Records stay in this browser only. A real service needs an encrypted server database.
const KEY = 'stima-bridge-records';
const EMPTY = () => ({ users: [], reports: [], currentId: null });

export function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || EMPTY();
  } catch {
    return EMPTY();
  }
}

export function saveRecords(records) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch { /* The prototype still runs for this visit. */ }
}

export function clearRecords() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* Nothing was stored. */ }
}

export const maskId = (id) => `••••${id.slice(-2)}`;
export const maskPhone = (phone) => `${phone.slice(0, 2)}••••${phone.slice(-2)}`;
