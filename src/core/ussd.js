// USSD flow logic. Screens stay within the 182-character USSD limit.
import { RATES } from './tariff.js';

export const USSD_LIMIT = 182;
export const FEE_RATE = 0.05;
export const REPAY_SHARE = 0.2;
const LIMITS = [1, 2, 3]; // kWh limit rises with each advance repaid. Team decision still needed.

const T = {
  en: {
    home: 'Kenya Power (demo)\n1 Buy tokens\n2 My account\n00 Stima Bridge\n0 Exit',
    other: 'This option is not part of the demo.',
    lang: 'Stima Bridge\nChoose language\n1 English\n2 Kiswahili',
    intro: 'Stima Bridge lets you borrow units when tokens run low.\n1 Join\n0 Back',
    phone: 'Enter your phone number\ne.g. 0712345678',
    meter: 'Enter your 11-digit meter number',
    id: 'Enter your national ID number',
    bad: 'That did not look right. Try again.',
    terms: (kwh) => `Borrow up to ${kwh} kWh. Fee 5%. Up to 20% of each token repays it. Terms sent by SMS.\n1 Accept\n2 Decline`,
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
    smsToken: (t, kwh) => `DEMO TOKEN ${t} for ${kwh} kWh. Not valid on a real meter.`,
    bye: 'Goodbye.',
  },
  sw: {
    home: 'Kenya Power (demo)\n1 Nunua tokeni\n2 Akaunti yangu\n00 Stima Bridge\n0 Toka',
    other: 'Chaguo hili halipo kwenye demo.',
    lang: 'Stima Bridge\nChagua lugha\n1 English\n2 Kiswahili',
    intro: 'Stima Bridge hukuwezesha kukopa uniti tokeni zinapokaribia kuisha.\n1 Jiunge\n0 Rudi',
    phone: 'Weka nambari yako ya simu\nmfano 0712345678',
    meter: 'Weka nambari ya mita yenye tarakimu 11',
    id: 'Weka nambari ya kitambulisho',
    bad: 'Hiyo si sahihi. Jaribu tena.',
    terms: (kwh) => `Kopa hadi kWh ${kwh}. Ada 5%. Hadi 20% ya kila tokeni hulipa deni. Masharti yatatumwa kwa SMS.\n1 Kubali\n2 Kataa`,
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
    smsToken: (t, kwh) => `TOKENI YA DEMO ${t} ya kWh ${kwh}. Haifanyi kazi kwenye mita halisi.`,
    bye: 'Kwaheri.',
  },
};

export const advanceValue = (kwh) => Math.round(kwh * RATES.lifeline);
export const advanceFee = (kwh) => Math.round(advanceValue(kwh) * FEE_RATE);
export const limitFor = (account) => LIMITS[Math.min(account.repaid, LIMITS.length - 1)];

export function createStore() {
  return { account: null, lang: null, sms: [], reports: [] };
}

function demoToken() {
  let digits = '';
  while (digits.length < 20) digits += Math.floor(Math.random() * 10);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

// Repayment on a normal token purchase. The balance sits on the account, not on the meter.
export function buyToken(store, amountKsh) {
  const a = store.account;
  const repaid = a ? Math.min(a.owed, Math.floor(amountKsh * REPAY_SHARE)) : 0;
  if (a && repaid) {
    a.owed -= repaid;
    if (a.owed === 0) a.repaid += 1;
  }
  return { repaid, toUnits: amountKsh - repaid, kwh: (amountKsh - repaid) / RATES.lifeline };
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
        return store.lang ? show('intro', t().intro) : show('lang', T.en.lang);
      }
      return x === '0' ? end(T[store.lang || 'en'].bye) : end(t().other);
    },
    lang(x) {
      if (x !== '1' && x !== '2') return show('lang', T.en.lang);
      store.lang = x === '1' ? 'en' : 'sw';
      return show('intro', t().intro);
    },
    intro(x) {
      if (x === '1') return show('phone', t().phone);
      return show('home', t().home);
    },
    phone(x) {
      if (!/^0[17]\d{8}$/.test(x)) return show('phone', `${t().bad}\n${t().phone}`);
      draft.phone = x;
      return show('meter', t().meter);
    },
    meter(x) {
      if (!/^\d{11}$/.test(x)) return show('meter', `${t().bad}\n${t().meter}`);
      draft.meter = x;
      return show('id', t().id);
    },
    id(x) {
      if (!/^\d{7,8}$/.test(x)) return show('id', `${t().bad}\n${t().id}`);
      draft.id = x;
      store.sms.push(t().smsTerms);
      return show('terms', t().terms(LIMITS[LIMITS.length - 1]));
    },
    terms(x) {
      if (x === '1') {
        const earlier = store.account;
        store.account = { phone: draft.phone, meter: draft.meter, id: draft.id, owed: earlier?.owed || 0, repaid: earlier?.repaid || 0, left: false };
        draft = {};
        state = 'menu';
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
      store.account.owed = advanceValue(draft.kwh) + advanceFee(draft.kwh);
      store.sms.push(t().smsToken(demoToken(), draft.kwh));
      return end(t().sent);
    },
    report(x) {
      if (!['1', '2', '3', '4'].includes(x)) return menu();
      store.reports.push(Number(x));
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
