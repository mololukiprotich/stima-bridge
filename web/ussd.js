import { createStore, session, buyToken, limitFor } from '../src/core/ussd.js';
import { loadRecords, saveRecords, loadPhone, savePhone, maskId } from './records.js';

const $ = (id) => document.getElementById(id);
const SERVICE_CODE = '*977#';
const DEMO_METER = '37000555000'; // In the sample purchase data, so the dashboard can check its reports.
const SESSION_TIMEOUT_MS = 180000;
const INVALID_MMI = 'Connection problem or invalid MMI code.';
const NETWORK = { firstMin: 1300, firstMax: 2100, replyMin: 650, replyMax: 1500, smsMin: 1500, smsMax: 2800 };
const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
const MAX_INPUT = 16;

const phone = loadPhone();
const saved = await loadRecords();
let store = createStore({ ...saved, currentId: phone.currentId });
let current = null;
let view = 'home';
let dialed = '';
let value = '';
let mode = 'idle'; // idle, running, prompt or message
let seenSms = 0;
let timeout = null;
let timers = [];
let huTimer = null;
let inbox = phone.inbox;
let openSender = null;
let huSender = null;

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

function show(next, sender = null) {
  view = next;
  $('homeApp').hidden = next !== 'home';
  $('dialerApp').hidden = next !== 'dialer';
  $('messagesApp').hidden = next !== 'messages';
  if (next === 'messages') openConversation(sender);
}

function savePhoneState() {
  savePhone({ currentId: store.records.currentId, inbox });
}

function paintBadge() {
  const unread = inbox.filter((m) => m.unread).length;
  $('badge').hidden = !unread;
  $('badge').textContent = unread;
  $('statusIcons').innerHTML = unread ? '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>' : '';
}

function openConversation(sender) {
  openSender = sender;
  if (sender) inbox.filter((m) => m.from === sender).forEach((m) => { m.unread = false; });
  savePhoneState();
  paintThread();
  paintBadge();
}

function paintConversations(box) {
  $('msgTitle').textContent = 'Messages';
  if (!inbox.length) {
    const none = document.createElement('em');
    none.textContent = 'No messages';
    box.append(none);
    return;
  }
  const senders = [...new Set([...inbox].reverse().map((m) => m.from))];
  for (const from of senders) {
    const own = inbox.filter((m) => m.from === from);
    const last = own[own.length - 1];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = own.some((m) => m.unread) ? 'convo unread' : 'convo';
    row.dataset.sender = from;
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = from[0];
    const body = document.createElement('span');
    body.className = 'convobody';
    const name = document.createElement('b');
    name.textContent = from;
    const preview = document.createElement('span');
    preview.textContent = last.text.replace(/\n/g, ' ');
    body.append(name, preview);
    const when = document.createElement('small');
    when.textContent = last.time;
    row.append(avatar, body, when);
    box.append(row);
  }
}

function paintThread() {
  const box = $('thread');
  box.textContent = '';
  if (!openSender) return paintConversations(box);
  $('msgTitle').textContent = openSender;
  for (const m of inbox.filter((x) => x.from === openSender)) {
    const p = document.createElement('p');
    p.textContent = m.text;
    const when = document.createElement('small');
    when.textContent = m.time;
    p.append(when);
    box.append(p);
  }
  box.scrollTop = box.scrollHeight;
}

function paintAccount() {
  const a = store.account;
  const rows = a
    ? [['ID', maskId(a.id)], ['Phone', a.phone], ['Meter', a.meter], ['Status', a.left ? 'Left' : 'Active'], ['Owed', `KSh ${a.owed}`], ['Advances repaid', a.repaid], ['Current limit', `${limitFor(a)} kWh`], ['No-power reports', store.records.reports.filter((r) => r.id === a.id).length], ['Tokens', store.records.transactions.filter((t) => t.id === a.id).length]]
    : [['Status', 'Not set up']];
  $('account').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

function persist() {
  savePhoneState();
  saveRecords(store.records).then((where) => {
    $('saveStatus').textContent = { csv: 'Saved to data/records.', browser: 'Saved in this browser only.' }[where] || 'Could not save.';
  });
}

function notify({ from, text }) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const reading = view === 'messages' && openSender === from;
  inbox.push({ from, text, time, unread: !reading });
  savePhoneState();
  if (view === 'messages') paintThread();
  paintBadge();
  huSender = from;
  $('huFrom').textContent = from;
  $('huText').textContent = text.replace(/\n/g, ' ');
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
    const sms = store.sms[seenSms++];
    later(() => notify(sms), delay(NETWORK.smsMin, NETWORK.smsMax));
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
  persist();
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
    if (mode !== 'running') return;
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
  later(() => {
    if (mode === 'running' && current) present(current.input(reply));
  }, delay(NETWORK.replyMin, NETWORK.replyMax));
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
  if (view === 'messages' && openSender) return openConversation(null);
  show('home');
}

// Starts a new phone. Saved records stay, so a returning ID finds its balance.
function reset() {
  timers.forEach(clearTimeout);
  timers = [];
  store.records.currentId = null;
  store = createStore(store.records);
  current = null;
  dialed = '';
  value = '';
  seenSms = 0;
  inbox = [];
  openSender = null;
  savePhoneState();
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

// Picks up changes made on the dashboard, such as clearing records.
async function refresh() {
  if (mode !== 'idle') return;
  const records = await loadRecords();
  if (mode !== 'idle') return;
  store = createStore({ ...records, currentId: store.records.currentId });
  seenSms = 0;
  paintAccount();
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
  $('thread').addEventListener('click', (e) => {
    const row = e.target.closest('[data-sender]');
    if (row) openConversation(row.dataset.sender);
  });
  $('headsup').addEventListener('click', () => {
    if (mode !== 'idle') cancel();
    show('messages', huSender);
    $('headsup').hidden = true;
  });
  window.addEventListener('focus', refresh);
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
    buyToken(store, 100, store.account?.meter || DEMO_METER);
    persist();
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
