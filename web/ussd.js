import { createStore, session, buyToken, limitFor } from '../src/core/ussd.js';

const $ = (id) => document.getElementById(id);
let store = createStore();
let current = null;

function paint(screen) {
  $('screen').textContent = screen.text;
  if (screen.end) current = null;
  const a = store.account;
  const rows = a
    ? [['Meter', a.meter], ['Status', a.left ? 'Left' : 'Active'], ['Owed', `KSh ${a.owed}`], ['Advances repaid', a.repaid], ['Current limit', `${limitFor(a)} kWh`], ['No-power reports', store.reports.length]]
    : [['Status', 'Not joined']];
  $('account').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('sms').innerHTML = store.sms.length ? '' : '<p>No messages yet.</p>';
  for (const text of [...store.sms].reverse()) {
    const p = document.createElement('p');
    p.textContent = text;
    $('sms').append(p);
  }
  $('reply').value = '';
}

function dial() {
  current = session(store);
  $('buyNote').textContent = '';
  paint(current.start());
  $('reply').focus();
}

$('dial').addEventListener('click', dial);
$('reset').addEventListener('click', () => {
  store = createStore();
  dial();
});
$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!current) return dial();
  const value = $('reply').value;
  if (value.trim()) paint(current.input(value));
});
$('buy').addEventListener('click', () => {
  const r = buyToken(store, 100);
  $('buyNote').textContent = `KSh ${r.repaid} repaid the advance. KSh ${r.toUnits} bought ${r.kwh.toFixed(1)} kWh.`;
  paint({ text: $('screen').textContent, end: !current });
});
dial();
