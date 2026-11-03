import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, priceCart, format, toProviderAmount } from '../src/money.js';

const merchant = { baseCurrency: 'GHS', currencies: { GHS: { rate: 1 }, GBP: { rate: 0.062 }, KES: { rate: 10.4 } } };
const products = [{ id: 'a', price: 12000 }, { id: 'b', price: 9850 }, { id: 'c', price: 333 }];

test('converts between currencies in minor units', () => {
  assert.equal(convert(12000, 'GHS', 'GHS', merchant.currencies), 12000);
  assert.equal(convert(10000, 'GHS', 'GBP', merchant.currencies), 620);
});

test('totals always equal the sum of displayed lines, in every currency', () => {
  const cart = { a: 3, b: 7, c: 11, missing: 2 };
  for (const cur of ['GHS', 'GBP', 'KES']) {
    const p = priceCart(cart, products, cur, merchant);
    assert.equal(p.lines.length, 3, 'unknown products are dropped');
    assert.equal(p.total, p.lines.reduce((s, l) => s + l.unit * l.qty, 0));
    for (const l of p.lines) assert.ok(Number.isInteger(l.unit) && Number.isInteger(l.lineTotal));
  }
});

test('quantities are clamped and junk is ignored', () => {
  const p = priceCart({ a: '1000', b: -4, c: 'x' }, products, 'GHS', merchant);
  assert.deepEqual(p.lines.map((l) => [l.product.id, l.qty]), [['a', 99]]);
});

test('formats and rounds provider amounts', () => {
  assert.match(format(12345, 'GBP'), /£123\.45/);
  assert.equal(toProviderAmount(123401, 'KES', true), 1235);
  assert.equal(toProviderAmount(12345, 'EUR'), 123.45);
});
