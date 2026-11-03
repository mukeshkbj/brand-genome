// Mobile money: every provider follows the same pattern -
// 1) request payment -> customer gets a prompt on their phone
// 2) provider calls our webhook (or we poll status) -> order paid / failed.
import * as mock from './mock.js';
import * as momo from './mtn-momo.js';
import * as mpesa from './mpesa.js';

export function adapterFor(methodId) {
  if ((process.env.PAYMENTS_MODE || 'mock') === 'mock') return mock;
  if (methodId === 'mtn-momo') return momo;
  if (methodId === 'mpesa') return mpesa;
  // Telecel Cash has no public self-serve sandbox we know of: mock until the organisers confirm an API.
  return mock;
}

export const paymentsMode = () => process.env.PAYMENTS_MODE || 'mock';

// Normalise phone numbers to international format without '+', e.g. 0244123456 -> 233244123456
export function normalisePhone(raw, methodId) {
  let d = String(raw || '').replace(/\D/g, '');
  const cc = methodId === 'mpesa' ? '254' : '233';
  if (d.startsWith('0')) d = cc + d.slice(1);
  return /^\d{11,13}$/.test(d) ? d : null;
}
