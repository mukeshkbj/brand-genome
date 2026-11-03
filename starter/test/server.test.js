// End-to-end: browse, add to basket, switch currency, checkout with mock mobile money, edit the theme.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PAYMENTS_MODE = 'mock';
process.env.MOCK_APPROVE_MS = '50';
delete process.env.GEMINI_API_KEY;
const { server } = await import('../server.js');
let base;
before(() => new Promise((r) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
after(() => server.close());

const jar = {};
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
async function req(path, { method = 'GET', form, json } = {}) {
  const headers = { cookie: cookieHeader() };
  let body;
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  const res = await fetch(base + path, { method, headers, body, redirect: 'manual' });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  return { res, text: await res.text() };
}

test('home page is tiny and accessible', async () => {
  const { res, text } = await req('/s/sunday-kiln/');
  assert.equal(res.status, 200);
  const kb = Buffer.byteLength(text) / 1024;
  assert.ok(kb < 14, `home HTML is ${kb.toFixed(1)} KB - keep it under 14 KB for the first round trip`);
  assert.match(text, /<html lang="en">/);
  assert.match(text, /class="skip" href="#main"/);
  assert.match(text, /Sunday Kiln/);
});

test('two storefronts share one catalogue with different themes', async () => {
  const a = (await req('/s/sunday-kiln/')).text, b = (await req('/s/night-market/')).text;
  assert.match(a, /Indigo glaze mug/); assert.match(b, /Indigo glaze mug/);
  assert.match(a, /--bg:#FBF6EF/); assert.match(b, /--bg:#14121A/);
});

test('full checkout in two currencies with mock mobile money', async () => {
  let r = await req('/s/sunday-kiln/cart/add', { method: 'POST', form: { id: 'mug-indigo', qty: '2' } });
  assert.equal(r.res.status, 303);
  r = await req('/s/sunday-kiln/currency', { method: 'POST', form: { currency: 'GBP', back: '/s/sunday-kiln/cart' } });
  r = await req('/s/sunday-kiln/cart');
  assert.match(r.text, /£14\.88/); // 2 x £7.44

  r = await req('/s/sunday-kiln/checkout', { method: 'POST', form: { name: '', phone: '12', method: '' } });
  assert.equal(r.res.status, 422);
  assert.match(r.text, /role="alert"/); assert.match(r.text, /aria-invalid="true"/);

  r = await req('/s/sunday-kiln/checkout', { method: 'POST', form: { name: 'Ama Mensah', phone: '024 412 3456', method: 'mtn-momo' } });
  assert.equal(r.res.status, 303);
  const orderPath = r.res.headers.get('location');
  const id = orderPath.split('/').pop();
  await new Promise((ok) => setTimeout(ok, 80));
  const status = await (await fetch(`${base}/api/orders/${id}`)).json();
  assert.equal(status.status, 'paid');
  r = await req(orderPath);
  assert.match(r.text, /Payment received/);
  assert.match(r.text, /£14\.88/);       // order kept the shopper's currency
  assert.match(r.text, /GH₵240\.00|GHS\s?240\.00/); // charged in cedis via MoMo
});

test('theme editor proposes, previews, applies and undoes', async () => {
  const p = await (await req('/api/genome/night-market/propose', { method: 'POST', json: { prompt: 'softer rounded corners' } })).text;
  const prop = JSON.parse(p);
  assert.ok(prop.changes.some((c) => c.path === 'layout.radius'));
  const preview = await req(prop.previewUrl);
  assert.match(preview.text, /--radius:20px/);
  assert.match((await req('/s/night-market/')).text, /--radius:4px/, 'live store unchanged until approved');
  await req('/api/genome/night-market/apply', { method: 'POST', json: { proposalId: prop.proposalId } });
  assert.match((await req('/s/night-market/')).text, /--radius:20px/);
  await req('/api/genome/night-market/undo', { method: 'POST', json: {} });
  assert.match((await req('/s/night-market/')).text, /--radius:4px/);
});
