// USSD flow logic. Screens stay within the 182-character USSD limit.
import { RATES } from './tariff.js';

export const USSD_LIMIT = 182;
export const FEE_RATE = 0.05;
export const REPAY_SHARE = 0.2;
export const POLICY_VERSION = 'draft-1';
export const REPORT_BANDS = {
  1: { label: 'Under 6 hours', days: 0.125 },
  2: { label: '6-12 hours', days: 0.375 },
  3: { label: '12-24 hours', days: 0.75 },
  4: { label: 'Over 1 day', days: 1.5 },
};
const LIMITS = [1, 2, 3]; // kWh limit rises with each advance repaid. Team decision still needed.
export const SMS_FROM = { info: 'StimaBridge', token: 'KPLC (demo)' };
const MIN_TOKEN_KSH = 20;
const MAX_TOKEN_KSH = 10000;

const T = {
  en: {
    home: 'Kenya Power (demo)\n1 Buy tokens\n2 My account\n00 Stima Bridge\n0 Exit',
    buyMeter: 'Buy tokens\nEnter your 11-digit meter number\n0 Back',
    buyAmount: `Buy tokens\nEnter amount in KSh (${MIN_TOKEN_KSH} to ${MAX_TOKEN_KSH})\n0 Back`,
    buyConfirm: (ksh, meter, repaid) => `Pay KSh ${ksh} for meter ${meter}.${repaid ? ` KSh ${repaid} repays your advance.` : ''}\n1 Pay with M-Pesa (demo)\n0 Back`,
    paid: 'Payment received. Your token is coming by SMS.',
    accountInfo: (meter, owed, kwh) => `Meter ${meter}\nYou owe KSh ${owed}\nBorrow limit ${kwh} kWh\n0 Back`,
    noAccount: 'No account on this phone. Reply 00 on the main menu to set up.\n0 Back',
    lang: 'Stima Bridge\nChoose language\n1 English\n2 Kiswahili',
    id: 'Welcome to Stima Bridge. Set up once to borrow units when tokens run low.\nEnter your ID number',
    phone: 'Link your phone number\ne.g. 0712345678',
    meter: 'Enter your 11-digit meter number',
    bad: 'That did not look right. Try again.',
    terms: (kwh) => `Borrow up to ${kwh} kWh. Fee 5%. Up to 20% of each token repays it.\n1 Accept terms and privacy policy\n2 Decline\n3 Read policies`,
    termsDoc: 'Terms 1/2\nOne advance at a time. Fee 5%, no interest. You must repay even if you leave.\n1 Next\n0 Back',
    privacyDoc: 'Privacy 2/2\nWe use your ID, phone, meter and no-power reports only to run this service. We never sell your data.\n0 Back',
    declined: 'You have not joined. Nothing was saved.',
    joined: 'You have joined Stima Bridge.',
    menu: 'Stima Bridge\n1 Borrow\n2 See what I owe\n3 Report no power\n4 Leave\n0 Exit',
    owing: (ksh) => `You still owe KSh ${ksh}. Repay it before borrowing again.\n0 Back`,
    left: 'You have left Stima Bridge. Dial 00 to rejoin.',
    borrow: (opts) => `Choose units\n${opts}\n0 Back`,
    opt: (i, kwh, ksh) => `${i} ${kwh} kWh (KSh ${ksh})`,
    confirm: (kwh, value, fee) => `Borrow ${kwh} kWh worth KSh ${value}. Fee KSh ${fee}. You repay KSh ${value + fee}.\n1 Confirm\n0 Back`,
    sent: 'Your token is coming by SMS. Enter it on your meter.',
    owe: (ksh) => `You owe KSh ${ksh}. Up to 20% of each token repays it.\n0 Back`,
    clear: 'You owe nothing.\n0 Back',
    report: 'How long without power?\n1 Under 6 hours\n2 6-12 hours\n3 12-24 hours\n4 Over 1 day\n0 Back',
    thanks: 'Thank you. Your report does not affect borrowing.',
    leave: 'Leave Stima Bridge?\n1 Yes\n0 Back',
    leaveOwing: (ksh) => `You still repay KSh ${ksh} from tokens, but cannot borrow.\n1 Leave\n0 Back`,
    smsTerms: 'Stima Bridge terms: fee 5%, one advance at a time, up to 20% of each token repays it, no interest. Reply HELP for support.',
    smsAdvance: { advance: 'Bridge advance', fee: 'Fee', owed: 'Total owed', repay: 'Repaid at up to 20% of each token', demo: 'DEMO: not valid on a real meter' },
    smsRepaid: { repaid: 'Advance repaid', owed: 'Advance left', demo: 'DEMO: not valid on a real meter' },
    bye: 'Goodbye.',
  },
  sw: {
    home: 'Kenya Power (demo)\n1 Nunua tokeni\n2 Akaunti yangu\n00 Stima Bridge\n0 Toka',
    buyMeter: 'Nunua tokeni\nWeka nambari ya mita yenye tarakimu 11\n0 Rudi',
    buyAmount: `Nunua tokeni\nWeka kiasi cha KSh (${MIN_TOKEN_KSH} hadi ${MAX_TOKEN_KSH})\n0 Rudi`,
    buyConfirm: (ksh, meter, repaid) => `Lipa KSh ${ksh} kwa mita ${meter}.${repaid ? ` KSh ${repaid} zitalipa mkopo wako.` : ''}\n1 Lipa kwa M-Pesa (demo)\n0 Rudi`,
    paid: 'Malipo yamepokelewa. Tokeni yako itakuja kwa SMS.',
    accountInfo: (meter, owed, kwh) => `Mita ${meter}\nUnadaiwa KSh ${owed}\nKikomo cha mkopo kWh ${kwh}\n0 Rudi`,
    noAccount: 'Hakuna akaunti kwenye simu hii. Bonyeza 00 kwenye menyu kuu kujisajili.\n0 Rudi',
    lang: 'Stima Bridge\nChagua lugha\n1 English\n2 Kiswahili',
    id: 'Karibu Stima Bridge. Jisajili mara moja ili ukope uniti tokeni zinapokaribia kuisha.\nWeka nambari ya kitambulisho',
    phone: 'Unganisha nambari yako ya simu\nmfano 0712345678',
    meter: 'Weka nambari ya mita yenye tarakimu 11',
    bad: 'Hiyo si sahihi. Jaribu tena.',
    terms: (kwh) => `Kopa hadi kWh ${kwh}. Ada 5%. Hadi 20% ya kila tokeni hulipa deni.\n1 Kubali masharti na sera ya faragha\n2 Kataa\n3 Soma sera`,
    termsDoc: 'Masharti 1/2\nMkopo mmoja kwa wakati. Ada 5%, hakuna riba. Lazima ulipe hata ukiondoka.\n1 Endelea\n0 Rudi',
    privacyDoc: 'Faragha 2/2\nTunatumia kitambulisho, simu, mita na ripoti zako kuendesha huduma hii tu. Hatuuzi data yako.\n0 Rudi',
    declined: 'Hujajiunga. Hakuna kilichohifadhiwa.',
    joined: 'Umejiunga na Stima Bridge.',
    menu: 'Stima Bridge\n1 Kopa\n2 Angalia deni\n3 Ripoti kukosa umeme\n4 Ondoka\n0 Toka',
    owing: (ksh) => `Bado unadaiwa KSh ${ksh}. Lipa kwanza kabla ya kukopa tena.\n0 Rudi`,
    left: 'Umeondoka Stima Bridge. Bonyeza 00 kujiunga tena.',
    borrow: (opts) => `Chagua uniti\n${opts}\n0 Rudi`,
    opt: (i, kwh, ksh) => `${i} kWh ${kwh} (KSh ${ksh})`,
    confirm: (kwh, value, fee) => `Kopa kWh ${kwh} za KSh ${value}. Ada KSh ${fee}. Utalipa KSh ${value + fee}.\n1 Thibitisha\n0 Rudi`,
    sent: 'Tokeni yako itakuja kwa SMS. Iweke kwenye mita yako.',
    owe: (ksh) => `Unadaiwa KSh ${ksh}. Hadi 20% ya kila tokeni hulipa deni.\n0 Rudi`,
    clear: 'Huna deni.\n0 Rudi',
    report: 'Umekosa umeme kwa muda gani?\n1 Chini ya saa 6\n2 Saa 6-12\n3 Saa 12-24\n4 Zaidi ya siku 1\n0 Rudi',
    thanks: 'Asante. Ripoti yako haiathiri ukopaji.',
    leave: 'Ondoka Stima Bridge?\n1 Ndiyo\n0 Rudi',
    leaveOwing: (ksh) => `Utaendelea kulipa KSh ${ksh} kupitia tokeni, lakini hutaweza kukopa.\n1 Ondoka\n0 Rudi`,
    smsTerms: 'Masharti ya Stima Bridge: ada 5%, mkopo mmoja kwa wakati, hadi 20% ya kila tokeni hulipa deni, hakuna riba. Tuma HELP kwa msaada.',
    smsAdvance: { advance: 'Mkopo wa Bridge', fee: 'Ada', owed: 'Jumla ya deni', repay: 'Hulipwa hadi 20% ya kila tokeni', demo: 'DEMO: haifanyi kazi kwenye mita halisi' },
    smsRepaid: { repaid: 'Mkopo uliolipwa', owed: 'Deni lililobaki', demo: 'DEMO: haifanyi kazi kwenye mita halisi' },
    bye: 'Kwaheri.',
  },
};

export const advanceValue = (kwh) => Math.round(kwh * RATES.lifeline);
export const advanceFee = (kwh) => Math.round(advanceValue(kwh) * FEE_RATE);
export const limitFor = (account) => LIMITS[Math.min(account.repaid, LIMITS.length - 1)];

export function createStore(saved) {
  const records = { users: [], reports: [], transactions: [], currentId: null, ...saved };
  const account = records.users.find((u) => u.id === records.currentId) || null;
  return { account, lang: account?.lang || null, sms: [], records };
}

function demoToken() {
  let digits = '';
  while (digits.length < 20) digits += Math.floor(Math.random() * 10);
  return digits.replace(/(\d{4})(?=\d)/g, '$1-').slice(0, 24);
}

const pad = (n) => String(n).padStart(2, '0');
const tokenDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const money = (ksh) => ksh.toFixed(2);

// Follows the layout of a Kenya Power token SMS. Check it against a real message.
function tokenSms({ meter, token, date, kwh, amount }, extra = []) {
  return [`Mtr:${meter}`, `Token:${token}`, `Date:${tokenDate(date)}`, `Units:${kwh.toFixed(1)}`, `Amt Ksh:${money(amount)}`, ...extra].join('\n');
}

// A token can be paid for by anyone, so debt follows the meter's account, not the phone.
function accountFor(store, meter) {
  const users = store.records.users.filter((u) => u.meter === meter);
  return users.find((u) => u.owed > 0) || users[0] || null;
}

const repayment = (account, amountKsh) => (account ? Math.min(account.owed, Math.floor(amountKsh * REPAY_SHARE)) : 0);

// Repayment on a normal token purchase. The balance sits on the account, not on the meter.
export function buyToken(store, amountKsh, meter = store.account?.meter) {
  const a = accountFor(store, meter);
  const repaid = repayment(a, amountKsh);
  if (repaid) {
    a.owed -= repaid;
    if (a.owed === 0) a.repaid += 1;
  }
  const kwh = (amountKsh - repaid) / RATES.lifeline;
  const date = new Date();
  const token = demoToken();
  const label = T[a?.lang || store.lang || 'en'].smsRepaid;
  const extra = repaid ? [`${label.repaid}:${money(repaid)}`, `${label.owed}:${money(a.owed)}`, label.demo] : [label.demo];
  store.sms.push({ from: SMS_FROM.token, text: tokenSms({ meter, token, date, kwh, amount: amountKsh }, extra) });
  store.records.transactions.push({ at: date.toISOString(), type: 'purchase', id: a?.id || '', phone: a?.phone || '', meter, amount_ksh: amountKsh, fee_ksh: 0, repaid_ksh: repaid, kwh: Number(kwh.toFixed(2)), owed_after: a?.owed ?? 0, token });
  return { repaid, toUnits: amountKsh - repaid, kwh };
}

function advanceToken(store, kwh) {
  const a = store.account;
  const value = advanceValue(kwh);
  const fee = advanceFee(kwh);
  a.owed = value + fee;
  const date = new Date();
  const token = demoToken();
  const label = T[store.lang || 'en'].smsAdvance;
  const extra = [`${label.advance}:${money(value)}`, `${label.fee}:${money(fee)}`, `${label.owed}:${money(a.owed)}`, label.repay, label.demo];
  store.sms.push({ from: SMS_FROM.token, text: tokenSms({ meter: a.meter, token, date, kwh, amount: value }, extra) });
  store.records.transactions.push({ at: date.toISOString(), type: 'advance', id: a.id, phone: a.phone, meter: a.meter, amount_ksh: value, fee_ksh: fee, repaid_ksh: 0, kwh, owed_after: a.owed, token });
}

export function session(store) {
  let state = 'home';
  let draft = {};
  const t = () => T[store.lang || 'en'];
  const end = (text) => ({ text, end: true });
  const show = (name, text) => {
    state = name;
    return { text, end: false };
  };
  const menu = () => show('menu', t().menu);
  const hasActive = () => store.account && !store.account.left;

  const termsScreen = () => show('terms', t().terms(LIMITS[LIMITS.length - 1]));

  const borrowScreen = () => {
    const a = store.account;
    if (a.owed > 0) return show('back', t().owing(a.owed));
    const sizes = LIMITS.filter((k) => k <= limitFor(a));
    draft.sizes = sizes;
    return show('borrow', t().borrow(sizes.map((k, i) => t().opt(i + 1, k, advanceValue(k))).join('\n')));
  };

  const handlers = {
    home(x) {
      if (x === '00') {
        if (hasActive()) return menu();
        return store.lang ? show('id', t().id) : show('lang', T.en.lang);
      }
      if (x === '1') {
        if (!store.account) return show('buyMeter', t().buyMeter);
        draft.meter = store.account.meter;
        return show('buyAmount', t().buyAmount);
      }
      if (x === '2') {
        const a = store.account;
        return show('homeBack', a ? t().accountInfo(a.meter, a.owed, limitFor(a)) : t().noAccount);
      }
      return x === '0' ? end(t().bye) : show('home', t().home);
    },
    homeBack() {
      return show('home', t().home);
    },
    buyMeter(x) {
      if (x === '0') return show('home', t().home);
      if (!/^\d{11}$/.test(x)) return show('buyMeter', `${t().bad}\n${t().buyMeter}`);
      draft.meter = x;
      return show('buyAmount', t().buyAmount);
    },
    buyAmount(x) {
      if (x === '0') return show('home', t().home);
      const ksh = Number(x);
      if (!Number.isInteger(ksh) || ksh < MIN_TOKEN_KSH || ksh > MAX_TOKEN_KSH) return show('buyAmount', `${t().bad}\n${t().buyAmount}`);
      draft.ksh = ksh;
      return show('buyConfirm', t().buyConfirm(ksh, draft.meter, repayment(accountFor(store, draft.meter), ksh)));
    },
    buyConfirm(x) {
      if (x !== '1') return show('home', t().home);
      buyToken(store, draft.ksh, draft.meter);
      return end(t().paid);
    },
    lang(x) {
      if (x !== '1' && x !== '2') return show('lang', T.en.lang);
      store.lang = x === '1' ? 'en' : 'sw';
      return show('id', t().id);
    },
    id(x) {
      if (!/^\d{7,8}$/.test(x)) return show('id', `${t().bad}\n${t().id}`);
      draft.id = x;
      return show('phone', t().phone);
    },
    phone(x) {
      if (!/^0[17]\d{8}$/.test(x)) return show('phone', `${t().bad}\n${t().phone}`);
      draft.phone = x;
      return show('meter', t().meter);
    },
    meter(x) {
      if (!/^\d{11}$/.test(x)) return show('meter', `${t().bad}\n${t().meter}`);
      draft.meter = x;
      return termsScreen();
    },
    doc1(x) {
      return x === '1' ? show('doc2', t().privacyDoc) : termsScreen();
    },
    doc2() {
      return termsScreen();
    },
    terms(x) {
      if (x === '3') return show('doc1', t().termsDoc);
      if (x === '1') {
        const now = new Date().toISOString();
        const known = store.records.users.find((u) => u.id === draft.id);
        const user = known || { id: draft.id, joinedAt: now, owed: 0, repaid: 0 };
        Object.assign(user, { phone: draft.phone, meter: draft.meter, lang: store.lang, left: false, consentAt: now, policyVersion: POLICY_VERSION });
        if (!known) store.records.users.push(user);
        store.account = user;
        store.records.currentId = user.id;
        draft = {};
        state = 'menu';
        store.sms.push({ from: SMS_FROM.info, text: t().smsTerms });
        return { text: `${t().joined}\n\n${t().menu}`, end: false };
      }
      draft = {};
      return end(t().declined);
    },
    menu(x) {
      if (x === '1') return borrowScreen();
      if (x === '2') {
        const owed = store.account.owed;
        return show('back', owed ? t().owe(owed) : t().clear);
      }
      if (x === '3') return show('report', t().report);
      if (x === '4') {
        const owed = store.account.owed;
        return show('leave', owed ? t().leaveOwing(owed) : t().leave);
      }
      return end(t().bye);
    },
    back() {
      return menu();
    },
    borrow(x) {
      const kwh = draft.sizes[Number(x) - 1];
      if (!kwh) return menu();
      draft.kwh = kwh;
      return show('confirm', t().confirm(kwh, advanceValue(kwh), advanceFee(kwh)));
    },
    confirm(x) {
      if (x !== '1') return menu();
      advanceToken(store, draft.kwh);
      return end(t().sent);
    },
    report(x) {
      if (!['1', '2', '3', '4'].includes(x)) return menu();
      const a = store.account;
      const band = REPORT_BANDS[x];
      store.records.reports.push({ at: new Date().toISOString(), id: a.id, phone: a.phone, meter: a.meter, band: band.label, days: band.days });
      return end(t().thanks);
    },
    leave(x) {
      if (x !== '1') return menu();
      store.account.left = true;
      return end(t().left);
    },
  };

  return {
    start: () => show('home', t().home),
    input: (raw) => handlers[state](String(raw).trim()),
  };
}

// Used by tests to check every screen against the USSD limit.
export function allScreens() {
  const out = [];
  for (const lang of Object.values(T)) {
    for (const [key, v] of Object.entries(lang)) {
      if (key.startsWith('sms')) continue;
      out.push(typeof v === 'function' ? v(LIMITS[2], 1000, 1000) : v);
    }
    out.push(lang.borrow(LIMITS.map((k, i) => lang.opt(i + 1, k, advanceValue(k))).join('\n')));
  }
  return out;
}
