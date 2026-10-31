import { createStore, session, buyToken, limitFor } from '../src/core/ussd.js';
import { loadRecords, saveRecords, maskId } from './records.js';

const $ = (id) => document.getElementById(id);
const SERVICE_CODE = '*977#';
const SENDER = 'StimaBridge';
const SESSION_TIMEOUT_MS = 180000;
const INVALID_MMI = 'Connection problem or invalid MMI code.';
const NETWORK = { firstMin: 1300, firstMax: 2100, replyMin: 650, replyMax: 1500, smsMin: 1500, smsMax: 2800 };
const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
const MAX_INPUT = 16;

let store = createStore(loadRecords());
let current = null;
let view = 'home';
let dialed = '';
let value = '';
let mode = 'idle'; // idle, running, prompt or message
let seenSms = 0;
let unread = 0;
let timeout = null;
let timers = [];
let huTimer = null;
let inbox = [];

const later = (fn, ms) => {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
};
const delay = (min, max) => min + Math.random() * (max - min);

function tick() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  $('clock').textContent = time;
  $('homeClock').textContent = time;
  $('homeDate').textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function show(next) {
  view = next;
  $('homeApp').hidden = next !== 'home';
  $('dialerApp').hidden = next !== 'dialer';
  $('messagesApp').hidden = next !== 'messages';
  if (next === 'messages') {
    unread = 0;
    paintThread();
    paintBadge();
  }
}

function paintBadge() {
  $('badge').hidden = !unread;
  $('badge').textContent = unread;
  $('statusIcons').innerHTML = unread ? '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>' : '';
}

function paintThread() {
  const box = $('thread');
  box.textContent = '';
  if (!inbox.length) {
    const none = document.createElement('em');
    none.textContent = 'No messages';
    box.append(none);
    return;
  }
  for (const m of inbox) {
    const p = document.createElement('p');
    p.textContent = m.text;
    const when = document.createElement('small');
    when.textContent = `${SENDER} · ${m.time}`;
    p.append(when);
    box.append(p);
  }
  box.scrollTop = box.scrollHeight;
}

function paintAccount() {
  const a = store.account;
  const rows = a
    ? [['ID', maskId(a.id)], ['Phone', a.phone], ['Meter', a.meter], ['Status', a.left ? 'Left' : 'Active'], ['Owed', `KSh ${a.owed}`], ['Advances repaid', a.repaid], ['Current limit', `${limitFor(a)} kWh`], ['No-power reports', store.records.reports.filter((r) => r.id === a.id).length]]
    : [['Status', 'Not set up']];
  $('account').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

function notify(text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  inbox.push({ text, time });
  if (view === 'messages') paintThread();
  else unread++;
  paintBadge();
  $('huFrom').textContent = SENDER;
  $('huText').textContent = text;
  const hu = $('headsup');
  hu.classList.remove('out');
  hu.hidden = false;
  clearTimeout(huTimer);
  huTimer = setTimeout(() => {
    hu.classList.add('out');
    huTimer = setTimeout(() => { hu.hidden = true; }, 220);
  }, 4200);
  const phone = $('handset');
  phone.classList.remove('buzz');
  void phone.offsetWidth;
  phone.classList.add('buzz');
}

function deliverSms() {
  while (seenSms < store.sms.length) {
    const text = store.sms[seenSms++];
    later(() => notify(text), delay(NETWORK.smsMin, NETWORK.smsMax));
  }
}

function paintValue() {
  $('promptValue').textContent = value;
}

function closeDialog() {
  mode = 'idle';
  $('scrim').hidden = true;
  $('scrim').classList.remove('typing');
  $('ime').hidden = true;
  $('running').hidden = true;
  $('prompt').hidden = true;
  clearTimeout(timeout);
}

function running() {
  mode = 'running';
  $('ime').hidden = true;
  $('scrim').classList.remove('typing');
  $('prompt').hidden = true;
  $('running').hidden = false;
  $('scrim').hidden = false;
}

function presentMessage(text) {
  mode = 'message';
  current = null;
  clearTimeout(timeout);
  $('running').hidden = true;
  $('promptText').textContent = text;
  $('field').classList.add('none');
  $('cancelBtn').hidden = true;
  $('sendBtn').textContent = 'OK';
  $('prompt').hidden = false;
}

function present(screen) {
  saveRecords(store.records);
  paintAccount();
  deliverSms();
  if (screen.end) return presentMessage(screen.text);
  mode = 'prompt';
  value = '';
  paintValue();
  $('running').hidden = true;
  $('promptText').textContent = screen.text;
  $('field').classList.remove('none');
  $('cancelBtn').hidden = false;
  $('sendBtn').textContent = 'SEND';
  $('prompt').hidden = false;
  $('scrim').classList.add('typing');
  $('ime').hidden = false;
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    $('ime').hidden = true;
    $('scrim').classList.remove('typing');
    presentMessage(INVALID_MMI);
  }, SESSION_TIMEOUT_MS);
}

function call() {
  if (mode !== 'idle' || !dialed) return;
  const code = dialed;
  running();
  later(() => {
    if (code !== SERVICE_CODE) return presentMessage(INVALID_MMI);
    current = session(store);
    present(current.start());
  }, delay(NETWORK.firstMin, NETWORK.firstMax));
}

function send() {
  if (mode === 'message') return closeDialog();
  if (mode !== 'prompt' || !current) return;
  const reply = value.trim();
  if (!reply) return;
  running();
  later(() => present(current.input(reply)), delay(NETWORK.replyMin, NETWORK.replyMax));
}

function cancel() {
  current = null;
  closeDialog();
}

function typeDial(ch) {
  if (dialed.length < MAX_INPUT) dialed += ch;
  $('dialed').value = dialed;
}

function dialDelete() {
  dialed = dialed.slice(0, -1);
  $('dialed').value = dialed;
}

function typeInput(ch) {
  if (value.length < MAX_INPUT) value += ch;
  paintValue();
}

function tapRipple(key) {
  key.classList.remove('tap');
  void key.offsetWidth;
  key.classList.add('tap');
}

function buildPads() {
  $('dialpad').innerHTML = KEYS.map(([d, l]) => `<button class="key" type="button" data-key="${d}"><b>${d}</b><small>${l}</small></button>`).join('');
  $('ime').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => `<button type="button" data-ime="${d}">${d}</button>`).join('')
    + '<button class="act" type="button" data-ime="del" aria-label="Delete">⌫</button><button type="button" data-ime="0">0</button><button class="act" type="button" data-ime="go">Go</button>';
}

function goBack() {
  if (mode === 'prompt' || mode === 'message') return cancel();
  if (mode === 'running') return;
  show('home');
}

function reset() {
  timers.forEach(clearTimeout);
  timers = [];
  store.records.currentId = null;
  saveRecords(store.records);
  store = createStore(store.records);
  current = null;
  dialed = '';
  value = '';
  seenSms = 0;
  unread = 0;
  inbox = [];
  $('dialed').value = '';
  $('headsup').hidden = true;
  closeDialog();
  paintBadge();
  paintAccount();
  show('home');
}

function autoDial() {
  if (mode !== 'idle') cancel();
  show('dialer');
  dialed = '';
  $('dialed').value = '';
  [...SERVICE_CODE].forEach((ch, i) => later(() => {
    typeDial(ch);
    const key = document.querySelector(`[data-key="${ch}"]`);
    if (key) tapRipple(key);
  }, 350 + i * 230));
  later(call, 350 + SERVICE_CODE.length * 230 + 350);
}

function start() {
  buildPads();
  tick();
  setInterval(tick, 10000);
  paintAccount();
  paintBadge();
  paintThread();

  $('openPhone').addEventListener('click', () => show('dialer'));
  $('openMessages').addEventListener('click', () => show('messages'));
  $('headsup').addEventListener('click', () => {
    if (mode === 'idle') show('messages');
    $('headsup').hidden = true;
  });
  $('callBtn').addEventListener('click', call);
  $('dialBack').addEventListener('click', dialDelete);
  $('dialpad').addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]');
    if (!key) return;
    tapRipple(key);
    typeDial(key.dataset.key);
  });
  $('ime').addEventListener('click', (e) => {
    const key = e.target.closest('[data-ime]')?.dataset.ime;
    if (key === 'del') {
      value = value.slice(0, -1);
      paintValue();
    } else if (key === 'go') send();
    else if (key) typeInput(key);
  });
  $('sendBtn').addEventListener('click', send);
  $('cancelBtn').addEventListener('click', cancel);
  $('navBack').addEventListener('click', goBack);
  $('navHome').addEventListener('click', () => {
    if (mode !== 'idle') cancel();
    show('home');
  });
  $('autoDial').addEventListener('click', autoDial);
  $('reset').addEventListener('click', reset);
  $('buy').addEventListener('click', () => {
    if (!store.account) return;
    buyToken(store, 100);
    saveRecords(store.records);
    paintAccount();
    deliverSms();
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (mode === 'prompt') {
      if (/^[0-9*#]$/.test(e.key)) typeInput(e.key);
      else if (e.key === 'Backspace') { value = value.slice(0, -1); paintValue(); }
      else if (e.key === 'Enter') send();
      else if (e.key === 'Escape') cancel();
      else return;
      e.preventDefault();
    } else if (mode === 'message' && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      closeDialog();
    } else if (mode === 'idle' && view === 'dialer') {
      if (/^[0-9*#]$/.test(e.key)) typeDial(e.key);
      else if (e.key === 'Backspace') dialDelete();
      else if (e.key === 'Enter') call();
      else return;
      e.preventDefault();
    }
  });
}
start();
