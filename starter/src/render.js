// Server-rendered pages. No client framework: the storefront works with JavaScript off,
// which keeps it fast on slow 3G and friendly to keyboards and screen readers.
import { BASE_CSS } from './styles.js';
import { genomeToCss } from './genome.js';
import { format } from './money.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function layout({ genome, title, body, ctx, head = '' }) {
  const b = `/s/${genome.id}`;
  const currencyForm = ctx.merchant.displayCurrencies.length > 1 ? `
    <form method="post" action="${b}/currency" class="row">
      <input type="hidden" name="back" value="${esc(ctx.path)}">
      <div><label for="cur" class="sr-only">Currency</label>
      <select id="cur" name="currency">${ctx.merchant.displayCurrencies.map((c) =>
        `<option value="${c}"${c === ctx.currency ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
      <button class="btn ghost" type="submit">Change currency</button>
    </form>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(genome.name)}</title>
<meta name="description" content="${esc(genome.tagline)}">
<meta name="theme-color" content="${genome.colors.bg}">
<style>${genomeToCss(genome)}${BASE_CSS}</style>${head}</head>
<body><a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
<a class="logo" href="${b}/">${esc(genome.name)}</a>
<nav aria-label="Main"><ul>
<li><a href="${b}/#shop">Shop</a></li><li><a href="${b}/#story">Our story</a></li>
<li><a href="${b}/cart">Basket <span>(${ctx.cartCount}<span class="sr-only"> items</span>)</span></a></li>
<li>${currencyForm}</li></ul></nav></div></header>
<main id="main" class="wrap" tabindex="-1">${body}</main>
<footer class="wrap"><p>${esc(genome.name)} · ${esc(genome.tagline)}</p></footer>
<script src="/assets/enhance.js" defer></script></body></html>`;
}

const productCard = (p, genome, ctx) => `<li><article class="card">
<a href="/s/${genome.id}/p/${p.id}"><img src="${esc(p.image)}" alt="" width="400" height="500" loading="lazy" decoding="async">
<div class="body"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.summary)}</p>
<p class="price">${format(ctx.priceOf(p), ctx.currency)}</p></div></a></article></li>`;

export function home(genome, ctx) {
  const featured = genome.featured.map((id) => ctx.products.find((p) => p.id === id)).filter(Boolean);
  const rest = ctx.products.filter((p) => !featured.includes(p));
  const hero = genome.hero;
  // Hero image is small and eager; any video is loaded by enhance.js only after the page is usable.
  const body = `<section class="hero" aria-labelledby="hero-h">
<div><p class="muted">${esc(genome.voice.greeting)}</p><h1 id="hero-h">${esc(hero.headline)}</h1><p>${esc(hero.sub)}</p>
<a class="btn" href="#shop">Shop the collection</a></div>
<div class="media">${hero.image ? `<img src="${esc(hero.image)}" alt="" width="800" height="600" fetchpriority="high">` : ''}
${hero.video ? `<video muted loop playsinline aria-hidden="true" data-src="${esc(hero.video)}" hidden></video>` : ''}</div></section>
<section id="shop" aria-labelledby="shop-h"><h2 id="shop-h">The collection</h2>
<ul class="grid">${[...featured, ...rest].map((p) => productCard(p, genome, ctx)).join('')}</ul></section>
<section id="story" class="story" aria-labelledby="story-h"><h2 id="story-h">Our story</h2><p>${esc(genome.story)}</p></section>`;
  return layout({ genome, title: genome.tagline, body, ctx });
}

export function product(genome, p, ctx) {
  const body = `<div class="product"><img src="${esc(p.image)}" alt="${esc(p.name)}" width="600" height="750">
<div><h1>${esc(p.name)}</h1><p class="price">${format(ctx.priceOf(p), ctx.currency)}</p><p>${esc(p.summary)}</p>
<form method="post" action="/s/${genome.id}/cart/add" class="row">
<input type="hidden" name="id" value="${esc(p.id)}">
<div class="field"><label for="qty">Quantity</label><input id="qty" class="qty" name="qty" type="number" inputmode="numeric" min="1" max="${Math.min(99, p.stock)}" value="1"></div>
<div class="field"><button class="btn" type="submit">Add to basket</button></div></form>
<p class="muted">${p.stock > 0 ? `${p.stock} in stock` : 'Sold out'}</p>
<section class="story" aria-labelledby="ps-h"><h2 id="ps-h">The story</h2><p>${esc(p.story)}</p></section></div></div>`;
  return layout({ genome, title: p.name, body, ctx });
}

export function cart(genome, priced, ctx, notice = '') {
  const b = `/s/${genome.id}`;
  const body = priced.lines.length === 0
    ? `<h1>Your basket</h1>${notice}<p>Your basket is empty.</p><a class="btn" href="${b}/#shop">Browse the collection</a>`
    : `<h1>Your basket</h1>${notice}
<form method="post" action="${b}/cart/update"><table><caption class="sr-only">Items in your basket, prices in ${ctx.currency}</caption>
<thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col" class="num">Price</th><th scope="col" class="num">Total</th></tr></thead><tbody>
${priced.lines.map((l) => `<tr><th scope="row"><a href="${b}/p/${l.product.id}">${esc(l.product.name)}</a></th>
<td><label class="sr-only" for="q-${l.product.id}">Quantity of ${esc(l.product.name)}</label>
<input class="qty" id="q-${l.product.id}" name="qty_${l.product.id}" type="number" inputmode="numeric" min="0" max="99" value="${l.qty}"></td>
<td class="num">${format(l.unit, ctx.currency)}</td><td class="num">${format(l.lineTotal, ctx.currency)}</td></tr>`).join('')}
</tbody><tfoot><tr><th scope="row" colspan="3">Total</th><td class="num price">${format(priced.total, ctx.currency)}</td></tr></tfoot></table>
<p class="hint">Set a quantity to 0 to remove an item.</p>
<div class="row"><button class="btn ghost" type="submit">Update basket</button><a class="btn" href="${b}/checkout">Go to checkout</a></div></form>`;
  return layout({ genome, title: 'Basket', body, ctx });
}

export function checkout(genome, priced, ctx, { values = {}, errors = {}, quotes = [] } = {}) {
  const b = `/s/${genome.id}`;
  const errList = Object.entries(errors);
  const fieldErr = (k) => errors[k] ? `<p class="error-text" id="${k}-err">${esc(errors[k])}</p>` : '';
  const aria = (k, hint) => errors[k] ? ` aria-invalid="true" aria-describedby="${k}-err${hint ? ` ${hint}` : ''}"` : hint ? ` aria-describedby="${hint}"` : '';
  const body = `<h1>Checkout</h1>
${errList.length ? `<div class="error-summary" role="alert" tabindex="-1" id="errors"><h2>There is a problem</h2><ul>${errList.map(([k, m]) => `<li><a href="#${k}">${esc(m)}</a></li>`).join('')}</ul></div>` : ''}
<p>Order total: <strong>${format(priced.total, ctx.currency)}</strong> (${priced.count} item${priced.count === 1 ? '' : 's'})</p>
<form method="post" action="${b}/checkout" novalidate>
<div class="field"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" value="${esc(values.name)}"${aria('name')} required>${fieldErr('name')}</div>
<fieldset${errors.method ? ' aria-describedby="method-err"' : ''}><legend>How would you like to pay?</legend>
${quotes.map((q, i) => `<div class="radio"><input type="radio" name="method" id="${i === 0 ? 'method' : `m-${q.id}`}" value="${q.id}"${values.method === q.id ? ' checked' : ''}>
<label for="${i === 0 ? 'method' : `m-${q.id}`}">${esc(q.label)} <span class="muted">- you'll be charged ${format(q.amountMinor, q.currency)}</span></label></div>`).join('')}
${fieldErr('method')}</fieldset>
<div class="field"><label for="phone">Mobile money number</label>
<input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" value="${esc(values.phone)}"${aria('phone', 'phone-hint')} required>
<p class="hint" id="phone-hint">We'll send a payment prompt to this phone. Example: 024 412 3456 or 0712 345 678.</p>${fieldErr('phone')}</div>
<button class="btn" type="submit">Send payment prompt</button></form>`;
  return layout({ genome, title: 'Checkout', body, ctx });
}

export function order(genome, o, ctx) {
  const msg = { pending: 'Waiting for you to approve the payment on your phone…', paid: 'Payment received - thank you!', failed: `Payment didn't go through: ${o.payment.reason || 'please try again.'}` }[o.status];
  const head = o.status === 'pending' ? '<noscript><meta http-equiv="refresh" content="4"></noscript>' : '';
  const body = `<h1>Order ${esc(o.id)}</h1>
<p class="status" role="status" aria-live="polite" id="order-status" data-order="${esc(o.id)}" data-state="${o.status}">${esc(msg)}</p>
${o.status === 'pending' ? `<p><a href="">Check again</a></p>` : ''}
<table><caption class="sr-only">Order summary</caption><tbody>
${o.lines.map((l) => `<tr><th scope="row">${esc(l.name)} × ${l.qty}</th><td class="num">${format(l.lineTotal, o.currency)}</td></tr>`).join('')}
</tbody><tfoot><tr><th scope="row">Total</th><td class="num price">${format(o.total, o.currency)}</td></tr>
<tr><th scope="row">Charged via ${esc(o.payment.label)}</th><td class="num">${format(o.payment.amountMinor, o.payment.currency)}</td></tr></tfoot></table>
${o.status === 'failed' ? `<p><a class="btn" href="/s/${genome.id}/checkout">Try again</a></p>` : `<p><a class="btn ghost" href="/s/${genome.id}/">Back to the shop</a></p>`}`;
  return layout({ genome, title: `Order ${o.id}`, body, ctx, head });
}

export function index(genomes) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brand Genome · storefronts</title><style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5}a{color:#0b5394}li{margin:.5rem 0}</style></head>
<body><main><h1>Brand Genome</h1><p>One merchant, one shared catalogue, one genome per storefront.</p>
<h2>Storefronts</h2><ul>${genomes.map((g) => `<li><a href="/s/${g.id}/">${esc(g.name)}</a> - ${esc(g.tagline)} · <a href="/editor/${g.id}">edit theme</a></li>`).join('')}</ul></main></body></html>`;
}

export function notFound(msg = 'Page not found') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found</title></head><body><main><h1>${esc(msg)}</h1><p><a href="/">Home</a></p></main></body></html>`;
}
