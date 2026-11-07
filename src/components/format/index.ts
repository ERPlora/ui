// Shared formatters: how every page shows dates, money and quantities, and the decimal mark a person types a number
// with. Pages call them; they never format by hand.
export { formatDateTime } from './dateTime';
export { decimalMark } from './decimalMark';
export type { FormatDateTimeOptions } from './dateTime';
export { formatMoney } from './money';
export type { Money } from './money';
export { formatQuantity } from './quantity';
