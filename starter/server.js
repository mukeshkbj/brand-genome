// Brand Genome - zero-dependency Node server (Node 20.12+).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ROOT, merchant, products, productById, isBrand, getGenome, saveGenome, undoGenome,
  addProposal, getProposal, dropProposal, getOrder, saveOrder, findOrderByProviderRef } from './src/store.js';
import { parseCookies, cookie, readCart, writeCart } from './src/cookies.js';
import { priceCart, convert, toProviderAmount } from './src/money.js';
import { applyPatch, diff, accessibilityReport } from './src/genome.js';
import { proposePatch } from './src/gemini.js';
import { adapterFor, normalisePhone, paymentsMode } from './src/payments/index.js';
import * as render from './src/render.js';

try { process.loadEnvFile(join(ROOT, '.env')); } catch { /* .env is optional */ }

const PORT = Number(process.env.PORT || 3000);
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.html': 'text/html; charset=utf-8', '.json': 'application/json' };

// ---------- helpers ----------
const send = (res, status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers }); res.end(body); };
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'content-type': 'application/json' });
const redirect = (res, to, headers = {}) => { res.writeHead(303, { location: to, ...headers }); res.end(); };

async function readBody(req, limit = 100_000) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > limit) throw Object.assign(new Error('Body too large'), { status: 413 }); }
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) return data ? JSON.parse(data) : {};
  return Object.fromEntries(new URLSearchParams(data));
}

function context(req, url, brand) {
  const cookies = parseCookies(req.headers.cookie);
  const currency = merchant.displayCurrencies.includes(cookies.currency) ? cookies.currency : merchant.displayCurrencies[0];
  const cart = brand ? readCart(cookies, brand) : {};
  const priced = priceCart(cart, products, currency, merchant);
  return {
    merchant, products, currency, cart, priced, cartCount: priced.count, path: url.pathname,
    priceOf: (p) => convert(p.price, merchant.baseCurrency, currency, merchant.currencies),
  };
}

function paymentQuotes(cart) {
  const sandbox = paymentsMode() === 'sandbox';
  return merchant.paymentMethods.map((m) => {
    const currency = sandbox && m.sandboxCurrency ? m.sandboxCurrency : m.currency;
    let amountMinor = priceCart(cart, products, currency, merchant).total;
    if (m.id === 'mpesa') amountMinor = Math.ceil(amountMinor / 100) * 100; // whole shillings
    return { ...m, currency, amountMinor };
  });
}

async function refreshOrder(o) {
  if (o.status !== 'pending') return o;
  try {
    const r = await adapterFor(o.payment.method).checkStatus(o.payment.providerRef);
    if (r.status !== 'pending') { o.status = r.status; o.payment.reason = r.reason; o.updatedAt = new Date().toISOString(); saveOrder(o); }
  } catch (e) { console.warn('status check failed', e.message); }
  return o;
}

async function serveStatic(res, pathname) {
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, 'public', safe);
  if (!file.startsWith(join(ROOT, 'public'))) return send(res, 403, 'Forbidden');
  try {
    const data = await readFile(file);
    send(res, 200, data, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'public, max-age=86400' });
  } catch { send(res, 404, render.notFound()); }
}

// ---------- routes ----------
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method;

  if (url.pathname === '/') return send(res, 200, render.index(merchant.brands.map(getGenome)));
  if (parts[0] === 'assets' || parts[0] === 'editor.js') return serveStatic(res, url.pathname);
  if (url.pathname === '/healthz') return json(res, 200, { ok: true, payments: paymentsMode(), gemini: !!process.env.GEMINI_API_KEY });

  // ----- storefront: /s/:brand/... -----
  if (parts[0] === 's' && isBrand(parts[1])) {
    const brand = parts[1];
    const rest = parts.slice(2);
    const proposal = url.searchParams.get('proposal');
    const p = proposal && getProposal(proposal);
    const genome = p && p.brand === brand ? p.genome : getGenome(brand); // preview a proposal without saving it
    const ctx = context(req, url, brand);
    const page = (html) => send(res, 200, html, { 'cache-control': 'no-store' });

    if (method === 'GET' && rest.length === 0) return page(render.home(genome, ctx));
    if (method === 'GET' && rest[0] === 'p' && productById(rest[1])) return page(render.product(genome, productById(rest[1]), ctx));
    if (method === 'GET' && rest[0] === 'cart') return page(render.cart(genome, ctx.priced, ctx));

    if (method === 'POST' && rest[0] === 'cart' && rest[1] === 'add') {
      const body = await readBody(req);
      const prod = productById(body.id);
      if (!prod) return send(res, 400, render.notFound('Unknown product'));
      const cart = { ...ctx.cart, [prod.id]: Math.min(99, (ctx.cart[prod.id] || 0) + Math.max(1, Math.trunc(+body.qty || 1))) };
      return redirect(res, `/s/${brand}/cart`, { 'set-cookie': writeCart(brand, cart) });
    }
    if (method === 'POST' && rest[0] === 'cart' && rest[1] === 'update') {
      const body = await readBody(req);
      const cart = {};
      for (const [k, v] of Object.entries(body)) if (k.startsWith('qty_') && productById(k.slice(4)) && +v > 0) cart[k.slice(4)] = Math.min(99, Math.trunc(+v));
      return redirect(res, `/s/${brand}/cart`, { 'set-cookie': writeCart(brand, cart) });
    }
    if (method === 'POST' && rest[0] === 'currency') {
      const body = await readBody(req);
      const cur = merchant.displayCurrencies.includes(body.currency) ? body.currency : ctx.currency;
      const back = typeof body.back === 'string' && body.back.startsWith(`/s/${brand}`) ? body.back : `/s/${brand}/`;
      return redirect(res, back, { 'set-cookie': cookie('currency', cur) });
    }

    if (rest[0] === 'checkout') {
      if (ctx.priced.lines.length === 0) return redirect(res, `/s/${brand}/cart`);
      const quotes = paymentQuotes(ctx.cart);
      if (method === 'GET') return page(render.checkout(genome, ctx.priced, ctx, { quotes }));
      if (method === 'POST') {
        const values = await readBody(req);
        const errors = {};
        const m = quotes.find((q) => q.id === values.method);
        if (!values.name?.trim()) errors.name = 'Enter your full name';
        if (!m) errors.method = 'Choose how you would like to pay';
        const phone = normalisePhone(values.phone, values.method);
        if (!phone) errors.phone = 'Enter a mobile money number, like 024 412 3456';
        if (Object.keys(errors).length) return send(res, 422, render.checkout(genome, ctx.priced, ctx, { values, errors, quotes }));

        const id = `KR-${randomBytes(4).toString('hex').toUpperCase()}`;
        const o = {
          id, brand, status: 'pending', createdAt: new Date().toISOString(), customer: { name: values.name.trim(), phone },
          currency: ctx.currency, total: ctx.priced.total,
          lines: ctx.priced.lines.map((l) => ({ id: l.product.id, name: l.product.name, qty: l.qty, unit: l.unit, lineTotal: l.lineTotal })),
          payment: { method: m.id, label: m.label, currency: m.currency, amountMinor: m.amountMinor },
        };
        try {
          const r = await adapterFor(m.id).requestPayment({
            orderId: id, phone, currency: m.currency,
            amount: toProviderAmount(m.amountMinor, m.currency, m.id === 'mpesa'),
            callbackUrl: `${process.env.PUBLIC_URL || `http://localhost:${PORT}`}/api/payments/callback/${m.id}`,
          });
          o.payment.providerRef = r.providerRef;
        } catch (e) {
          console.error('payment request failed', e.message);
          o.status = 'failed'; o.payment.reason = 'The payment service did not respond. Please try again.';
        }
        saveOrder(o);
        return redirect(res, `/s/${brand}/order/${id}`, o.status === 'failed' ? {} : { 'set-cookie': writeCart(brand, {}) });
      }
    }

    if (method === 'GET' && rest[0] === 'order') {
      const o = getOrder(rest[1]);
      if (!o || o.brand !== brand) return send(res, 404, render.notFound('Order not found'));
      return page(render.order(genome, await refreshOrder(o), ctx));
    }
    return send(res, 404, render.notFound());
  }

  // ----- merchant theme editor -----
  if (method === 'GET' && parts[0] === 'editor' && isBrand(parts[1])) return serveStatic(res, '/editor.html');

  // ----- API -----
  if (parts[0] === 'api') {
    if (method === 'GET' && parts[1] === 'catalog') return json(res, 200, { baseCurrency: merchant.baseCurrency, products });
    if (method === 'GET' && parts[1] === 'orders' && getOrder(parts[2])) {
      const o = await refreshOrder(getOrder(parts[2]));
      return json(res, 200, { id: o.id, status: o.status, reason: o.payment.reason || null });
    }
    if (method === 'POST' && parts[1] === 'payments' && parts[2] === 'callback') {
      const body = await readBody(req).catch(() => ({}));
      const r = adapterFor(parts[3]).parseCallback(body);
      const o = r && findOrderByProviderRef(r.providerRef);
      if (o && o.status === 'pending' && r.status !== 'pending') { o.status = r.status; o.payment.reason = r.reason; saveOrder(o); }
      return json(res, 200, { ok: true });
    }

    if (parts[1] === 'genome' && isBrand(parts[2])) {
      const brand = parts[2];
      const current = getGenome(brand);
      if (method === 'GET' && !parts[3]) return json(res, 200, { genome: current, accessibility: accessibilityReport(current) });
      if (method === 'POST' && parts[3] === 'propose') {
        const { prompt } = await readBody(req);
        if (!prompt?.trim()) return json(res, 400, { error: 'Tell me what you would like to change.' });
        try {
          const { patch, summary, source } = await proposePatch({ genome: current, prompt: prompt.slice(0, 1000), products });
          const proposed = applyPatch(current, patch);
          const changes = diff(current, proposed);
          const id = addProposal({ brand, genome: proposed, prompt, summary });
          return json(res, 200, { proposalId: id, summary, source, changes, accessibility: accessibilityReport(proposed), previewUrl: `/s/${brand}/?proposal=${id}` });
        } catch (e) { console.error(e); return json(res, 502, { error: `The AI editor failed: ${e.message}` }); }
      }
      if (method === 'POST' && parts[3] === 'apply') {
        const { proposalId } = await readBody(req);
        const p = getProposal(proposalId);
        if (!p || p.brand !== brand) return json(res, 404, { error: 'Proposal not found or expired.' });
        saveGenome(p.genome); dropProposal(proposalId);
        return json(res, 200, { ok: true, genome: p.genome });
      }
      if (method === 'POST' && parts[3] === 'reject') { dropProposal((await readBody(req)).proposalId); return json(res, 200, { ok: true }); }
      if (method === 'POST' && parts[3] === 'undo') {
        const g = undoGenome(brand);
        return g ? json(res, 200, { ok: true, genome: g }) : json(res, 409, { error: 'Nothing to undo.' });
      }
    }
    return json(res, 404, { error: 'Not found' });
  }

  return send(res, 404, render.notFound());
}

export const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, render.notFound(e.status === 413 ? 'Request too large' : 'Something went wrong'));
  });
});

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  server.listen(PORT, () => console.log(`Brand Genome on http://localhost:${PORT}  (payments: ${paymentsMode()}, gemini: ${process.env.GEMINI_API_KEY ? 'on' : 'offline fallback'})`));
}
