// Mock mobile money: behaves like the real flow (pending -> customer approves on phone -> paid),
// so the full checkout can be demoed and tested without provider keys.
// Phone numbers ending in 0000 are declined, to demo the failure path.
import { randomUUID } from 'node:crypto';

const pending = new Map();
const APPROVE_AFTER_MS = Number(process.env.MOCK_APPROVE_MS || 4000);

export async function requestPayment({ phone }) {
  const providerRef = `mock-${randomUUID()}`;
  pending.set(providerRef, { at: Date.now(), decline: phone.endsWith('0000') });
  return { providerRef, status: 'pending', message: 'Approve the payment prompt on your phone (simulated).' };
}

export async function checkStatus(providerRef) {
  const p = pending.get(providerRef);
  if (!p) return { status: 'failed', reason: 'Unknown payment' };
  if (Date.now() - p.at < APPROVE_AFTER_MS) return { status: 'pending' };
  return p.decline ? { status: 'failed', reason: 'Declined on phone (simulated)' } : { status: 'paid' };
}

export function parseCallback() { return null; }
