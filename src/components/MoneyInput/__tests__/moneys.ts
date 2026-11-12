// The moneys the tests of `MoneyInput` and its reader type amounts in: two decimals (the euro, the złoty), none (the
// yen) and three (the Kuwaiti dinar), with the decimals the server counts them in.
import type { Money } from '../../format';

export const EUR: Money = { currency: 'EUR', decimals: 2 };
export const PLN: Money = { currency: 'PLN', decimals: 2 };
export const JPY: Money = { currency: 'JPY', decimals: 0 };
export const KWD: Money = { currency: 'KWD', decimals: 3 };
