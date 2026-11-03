// MTN MoMo Collection API (sandbox). Docs: https://momodeveloper.mtn.com
// Note: the sandbox only accepts currency EUR; production uses the local currency (e.g. GHS).
import { randomUUID } from 'node:crypto';

const env = (k) => process.env[k] || '';
let token = { value: '', exp: 0 };

async function getToken() {
  if (token.value && Date.now() < token.exp) return token.value;
  const res = await fetch(`${env('MOMO_BASE_URL')}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${env('MOMO_API_USER')}:${env('MOMO_API_KEY')}`).toString('base64'),
      'Ocp-Apim-Subscription-Key': env('MOMO_SUBSCRIPTION_KEY'),
    },
  });
  if (!res.ok) throw new Error(`MoMo token ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return token.value;
}

const headers = async (extra = {}) => ({
  Authorization: `Bearer ${await getToken()}`,
  'X-Target-Environment': env('MOMO_TARGET_ENV') || 'sandbox',
  'Ocp-Apim-Subscription-Key': env('MOMO_SUBSCRIPTION_KEY'),
  ...extra,
});

export async function requestPayment({ orderId, amount, currency, phone, callbackUrl }) {
  const providerRef = randomUUID();
  const res = await fetch(`${env('MOMO_BASE_URL')}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: await headers({ 'X-Reference-Id': providerRef, 'Content-Type': 'application/json', ...(callbackUrl?.startsWith('https') ? { 'X-Callback-Url': callbackUrl } : {}) }),
    body: JSON.stringify({
      amount: String(amount), currency, externalId: orderId,
      payer: { partyIdType: 'MSISDN', partyId: phone },
      payerMessage: `Order ${orderId}`, payeeNote: `Order ${orderId}`,
    }),
  });
  if (res.status !== 202) throw new Error(`MoMo requesttopay ${res.status}: ${await res.text()}`);
  return { providerRef, status: 'pending', message: 'Check your phone to approve the MoMo payment.' };
}

export async function checkStatus(providerRef) {
  const res = await fetch(`${env('MOMO_BASE_URL')}/collection/v1_0/requesttopay/${providerRef}`, { headers: await headers() });
  if (!res.ok) return { status: 'pending' };
  const j = await res.json();
  if (j.status === 'SUCCESSFUL') return { status: 'paid' };
  if (j.status === 'FAILED' || j.status === 'REJECTED') return { status: 'failed', reason: j.reason || j.status };
  return { status: 'pending' };
}

export function parseCallback(body) {
  if (!body?.referenceId && !body?.externalId) return null;
  return { providerRef: body.referenceId, status: body.status === 'SUCCESSFUL' ? 'paid' : body.status === 'FAILED' ? 'failed' : 'pending' };
}
