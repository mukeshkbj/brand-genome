import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeGenome, applyPatch, diff, contrast, accessibilityReport, genomeToCss } from '../src/genome.js';
import { fallbackPatch } from '../src/gemini.js';

const load = (id) => JSON.parse(readFileSync(new URL(`../genomes/${id}.json`, import.meta.url)));

test('both starter genomes pass the readability check', () => {
  for (const id of ['sunday-kiln', 'night-market']) assert.ok(accessibilityReport(load(id)).pass, id);
});

test('contrast matches WCAG reference values', () => {
  assert.equal(Math.round(contrast('#000000', '#FFFFFF')), 21);
  assert.equal(contrast('#777777', '#777777'), 1);
});

test('patches cannot inject CSS, change id, or break ranges', () => {
  const g = load('sunday-kiln');
  const out = applyPatch(g, {
    id: 'hacked', colors: { bg: 'red;}body{display:none', primary: '#123456' },
    type: { heading: 'x;}</style><script>' }, layout: { productColumns: 40, radius: -5 }, hero: { image: 'javascript:alert(1)' },
  });
  assert.equal(out.id, 'sunday-kiln');
  assert.equal(out.colors.bg, g.colors.bg);
  assert.equal(out.colors.primary, '#123456');
  assert.equal(out.type.heading, g.type.heading);
  assert.equal(out.layout.productColumns, 4);
  assert.equal(out.layout.radius, 0);
  assert.equal(out.hero.image, g.hero.image);
  assert.ok(!genomeToCss(out).includes('<'));
});

test('diff lists only what changed', () => {
  const g = load('night-market');
  const changes = diff(g, applyPatch(g, { layout: { radius: 20 } }));
  assert.deepEqual(changes, [{ path: 'layout.radius', from: 4, to: 20 }]);
});

test('offline editor turns a request into a readable patch', () => {
  const g = load('sunday-kiln');
  const { patch } = fallbackPatch(g, 'Make it feel like Bonfire Night, bigger photos');
  const next = applyPatch(g, patch);
  assert.notEqual(next.colors.bg, g.colors.bg);
  assert.equal(next.layout.productColumns, 2);
  assert.ok(accessibilityReport(next).pass);
  assert.ok(sanitizeGenome(next, g));
});
