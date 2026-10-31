import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePurchases } from '../src/core/csv.js';
import { analyzeMeter, DEFAULT_PARAMS } from '../src/core/detector.js';
import { scoreHevs } from '../src/core/hevs.js';
import { createStore, session, buyToken, allScreens, USSD_LIMIT, POLICY_VERSION, advanceValue, advanceFee } from '../src/core/ussd.js';
import { generate } from '../generator/simulate.js';
import { readFileSync } from 'node:fs';

const period = { start: 20000, days: 60 };
const steady = Array.from({ length: 12 }, (_, i) => ({ t: 20000 + i * 5, kwh: 5, amount_ksh: 100 }));

test('CSV parser reports missing columns and bad rows', () => {
  assert.match(parsePurchases('a,b\n1,2').errors[0], /Missing columns/);
  const { rows, errors } = parsePurchases('meter_id,datetime,amount_ksh,kwh\nm1,2026-01-01T10:00,100,5\nm2,bad,100,5');
  assert.equal(rows.length, 1);
  assert.match(errors[0], /1 invalid/);
});

test('steady buyer has no dark periods', () => {
  const r = analyzeMeter('m', steady, period);
  assert.equal(r.episodes.length, 0);
});

test('a late token creates a dark period', () => {
  const late = steady.map((p, i) => (i < 6 ? p : { ...p, t: p.t + 6 }));
  const r = analyzeMeter('m', late, { ...period, days: 66 });
  assert.equal(r.episodes.length, 1);
  assert.ok(Math.abs(r.episodes[0].days - 6) < 1);
});

test('very long gaps are not counted as dark', () => {
  const gap = [...steady.slice(0, 5), ...steady.slice(5).map((p) => ({ ...p, t: p.t + 60 }))];
  const r = analyzeMeter('m', gap, { ...period, days: 120 }, DEFAULT_PARAMS);
  assert.ok(r.flags.includes('long_gap'));
  assert.equal(r.episodes.length, 0);
});

test('too little evidence goes to manual review', () => {
  const r = analyzeMeter('m', steady.slice(0, 2), period);
  assert.equal(scoreHevs(r, steady.slice(0, 2), period).tier, 'Review');
});

test('the detector does not import the generator', () => {
  for (const f of ['detector.js', 'hevs.js']) assert.doesNotMatch(readFileSync(`src/core/${f}`, 'utf8'), /generator|simulate/);
});

test('generator is reproducible', () => {
  const cfg = JSON.parse(readFileSync('generator/config.train.json', 'utf8'));
  const small = { ...cfg, meters: 20 };
  assert.deepEqual(generate(small).purchases, generate(small).purchases);
});

test('every USSD screen fits the limit', () => {
  for (const s of allScreens()) assert.ok(s.length <= USSD_LIMIT, `${s.length}: ${s}`);
});

function join(store) {
  const s = session(store);
  s.start();
  for (const x of ['00', '1', '12345678', '0712345678', '37194820016']) s.input(x);
  return { s, screen: s.input('1') };
}

test('joining shows the member menu', () => {
  const store = createStore();
  const { screen } = join(store);
  assert.match(screen.text, /See what I owe/);
  assert.equal(store.account.meter, '37194820016');
  assert.equal(store.sms.length, 1);
});

test('first use starts setup with the ID number', () => {
  const s = session(createStore());
  s.start();
  s.input('00');
  assert.match(s.input('1').text, /Enter your ID number/);
});

test('policies can be read before accepting', () => {
  const s = session(createStore());
  s.start();
  for (const x of ['00', '1', '12345678', '0712345678', '37194820016']) s.input(x);
  assert.match(s.input('3').text, /Terms 1\/2/);
  assert.match(s.input('1').text, /Privacy 2\/2/);
  assert.match(s.input('0').text, /Accept terms/);
});

test('declining saves nothing', () => {
  const store = createStore();
  const s = session(store);
  s.start();
  for (const x of ['00', '2', '12345678', '0712345678', '37194820016']) s.input(x);
  assert.equal(s.input('2').end, true);
  assert.equal(store.account, null);
  assert.equal(store.records.users.length, 0);
});

test('invalid details are asked for again', () => {
  const s = session(createStore());
  s.start();
  for (const x of ['00', '1']) s.input(x);
  assert.match(s.input('123').text, /did not look right/);
});

test('borrowing is limited to one advance and repaid at 20%', () => {
  const store = createStore();
  const { s } = join(store);
  s.input('1');
  s.input('1');
  assert.equal(s.input('1').end, true);
  const owed = advanceValue(1) + advanceFee(1);
  assert.equal(store.account.owed, owed);
  const again = session(store);
  again.start();
  again.input('00');
  assert.match(again.input('1').text, /still owe/);
  assert.equal(buyToken(store, 100).repaid, 20);
  assert.equal(store.account.owed, owed - 20);
  buyToken(store, 100);
  assert.equal(store.account.owed, 0);
  assert.equal(store.account.repaid, 1);
});

test('leaving with a balance keeps the debt and stops borrowing', () => {
  const store = createStore();
  const { s } = join(store);
  s.input('1');
  s.input('1');
  s.input('1');
  const again = session(store);
  again.start();
  again.input('00');
  again.input('4');
  assert.equal(again.input('1').end, true);
  assert.equal(store.account.left, true);
  assert.ok(store.account.owed > 0);
});

test('a report is saved and does not change the limit', () => {
  const store = createStore();
  const { s } = join(store);
  s.input('3');
  assert.equal(s.input('2').end, true);
  const [report] = store.records.reports;
  assert.equal(report.id, '12345678');
  assert.equal(report.phone, '0712345678');
  assert.equal(report.meter, '37194820016');
  assert.equal(report.band, '6-12 hours');
  assert.equal(store.account.repaid, 0);
});

test('setup records the user with consent', () => {
  const store = createStore();
  join(store);
  const [user] = store.records.users;
  assert.equal(user.id, '12345678');
  assert.equal(user.phone, '0712345678');
  assert.equal(user.policyVersion, POLICY_VERSION);
  assert.ok(user.consentAt);
});

test('saved records restore the user and their balance', () => {
  const store = createStore();
  join(store);
  store.account.owed = 21;
  const restored = createStore(JSON.parse(JSON.stringify(store.records)));
  assert.equal(restored.account.owed, 21);
  assert.equal(restored.lang, 'en');
});

test('setting up with a known ID updates the same user', () => {
  const store = createStore();
  join(store);
  store.records.currentId = null;
  store.account = null;
  const s = session(store);
  s.start();
  for (const x of ['00', '12345678', '0798765432', '37194820016', '1']) s.input(x);
  assert.equal(store.records.users.length, 1);
  assert.equal(store.records.users[0].phone, '0798765432');
});
