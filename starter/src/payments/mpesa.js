// M-Pesa Daraja STK Push (Lipa na M-Pesa Online), sandbox. Docs: https://developer.safaricom.co.ke
// Amounts are whole KES. The callback URL must be public https (use a tunnel during the hackathon).

const env = (k) => process.env[k] || '';
let token = { value: '', exp: 0 };

async function getToken() {
  if (token.value && Date.now() < token.exp) return token.value;
  const basic = Buffer.from(`${env('MPESA_CONSUMER_KEY')}:${env('MPESA_CONSUMER_SECRET')}`).toString('base64');
  const res = await fetch(`${env('MPESA_BASE_URL')}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${basic}` } });
  if (!res.ok) throw new Error(`M-Pesa token ${res.status}`);
  const j = await res.json();
  token = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) - 60) * 1000 };
  return token.value;
}

function stamp() {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return { ts, password: Buffer.from(env('MPESA_SHORTCODE') + env('MPESA_PASSKEY') + ts).toString('base64') };
}

export async function requestPayment({ orderId, amount, phone, callbackUrl }) {
  const { ts, password } = stamp();
  const res = await fetch(`${env('MPESA_BASE_URL')}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: env('MPESA_SHORTCODE'), Password: password, Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline', Amount: amount,
      PartyA: phone, PartyB: env('MPESA_SHORTCODE'), PhoneNumber: phone,
      CallBackURL: callbackUrl, AccountReference: orderId.slice(0, 12), TransactionDesc: 'Order',
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ResponseCode !== '0') throw new Error(`M-Pesa STK ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return { providerRef: j.CheckoutRequestID, status: 'pending', message: j.CustomerMessage || 'Check your phone for the M-Pesa prompt.' };
}

export async function checkStatus(providerRef) {
  const { ts, password } = stamp();
  const res = await fetch(`${env('MPESA_BASE_URL')}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ BusinessShortCode: env('MPESA_SHORTCODE'), Password: password, Timestamp: ts, CheckoutRequestID: providerRef }),
  });
  const j = await res.json().catch(() => ({}));
  if (j.ResultCode === '0' || j.ResultCode === 0) return { status: 'paid' };
  if (j.ResultCode !== undefined) return { status: 'failed', reason: j.ResultDesc };
  return { status: 'pending' };
}

export function parseCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb) return null;
  return { providerRef: cb.CheckoutRequestID, status: cb.ResultCode === 0 ? 'paid' : 'failed', reason: cb.ResultDesc };
}
