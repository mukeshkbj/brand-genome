// All money is integer minor units. Prices are stored in the merchant base currency.
// Rule that keeps totals right through checkout: convert the UNIT price once,
// then multiply and sum in the target currency. Displayed lines always add up to the total.

const MINOR_DIGITS = { GHS: 2, GBP: 2, KES: 2, EUR: 2, USD: 2, NGN: 2, UGX: 0 };

export const minorDigits = (code) => MINOR_DIGITS[code] ?? 2;

export function convert(amountMinor, from, to, currencies) {
  if (from === to) return amountMinor;
  const a = currencies[from], b = currencies[to];
  if (!a || !b) throw new Error(`Unknown currency ${from} or ${to}`);
  const major = amountMinor / 10 ** minorDigits(from);
  return Math.round(major * (b.rate / a.rate) * 10 ** minorDigits(to));
}

export function format(amountMinor, code, locale = 'en-GB') {
  const d = minorDigits(code);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: d, maximumFractionDigits: d })
    .format(amountMinor / 10 ** d);
}

// cart: { productId: qty }
export function priceCart(cart, products, currency, merchant) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [];
  for (const [id, rawQty] of Object.entries(cart || {})) {
    const product = byId.get(id);
    const qty = Math.max(0, Math.min(99, Math.trunc(Number(rawQty) || 0)));
    if (!product || qty === 0) continue;
    const unit = convert(product.price, merchant.baseCurrency, currency, merchant.currencies);
    lines.push({ product, qty, unit, lineTotal: unit * qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  return { currency, lines, subtotal, total: subtotal, count };
}

// M-Pesa only accepts whole units, so round up to avoid under-charging.
export function toProviderAmount(amountMinor, code, wholeUnitsOnly = false) {
  const major = amountMinor / 10 ** minorDigits(code);
  return wholeUnitsOnly ? Math.ceil(major) : Number(major.toFixed(minorDigits(code)));
}
