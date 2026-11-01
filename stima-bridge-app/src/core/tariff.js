// Estimated all-in prepaid rates, KSh/kWh, using September 2026 pass-through charges.
// These change monthly, so replace them from the EPRA schedule before quoting them.
export const RATES = { lifeline: 19.65, ordinary: 24.76 };
export const LIFELINE_LIMIT_KWH = 30;

export function rateForAverage(monthlyKwh) {
  return monthlyKwh < LIFELINE_LIMIT_KWH ? RATES.lifeline : RATES.ordinary;
}
