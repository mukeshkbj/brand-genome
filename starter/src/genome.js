// The brand genome: one JSON description of a brand that every channel renders from.
// This module validates genomes, merges AI-proposed patches, diffs them,
// checks WCAG contrast, and turns a genome into CSS custom properties.

const HEX = /^#[0-9a-fA-F]{6}$/;
const COLOR_KEYS = ['bg', 'surface', 'text', 'muted', 'primary', 'onPrimary', 'accent'];
const SAFE_FONT = /^[\w\s,'"-]{1,160}$/;
const SAFE_URL = /^(\/[\w\-./]*|https:\/\/[\w\-./%?=&]+)?$/;

const clamp = (n, lo, hi, dflt) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, +n)) : dflt);
const str = (v, max, dflt = '') => (typeof v === 'string' ? v.slice(0, max) : dflt);

export function sanitizeGenome(g, fallback = {}) {
  const f = fallback;
  const out = {
    id: str(g.id, 60, f.id),
    name: str(g.name, 80, f.name),
    tagline: str(g.tagline, 140, f.tagline),
    story: str(g.story, 1200, f.story),
    voice: { tone: str(g.voice?.tone, 120, f.voice?.tone), greeting: str(g.voice?.greeting, 160, f.voice?.greeting) },
    colors: {},
    type: {
      heading: SAFE_FONT.test(g.type?.heading ?? '') ? g.type.heading : f.type?.heading ?? 'Georgia, serif',
      body: SAFE_FONT.test(g.type?.body ?? '') ? g.type.body : f.type?.body ?? 'system-ui, sans-serif',
      baseSize: clamp(g.type?.baseSize, 14, 22, f.type?.baseSize ?? 16),
      scale: clamp(g.type?.scale, 1.1, 1.6, f.type?.scale ?? 1.25),
    },
    layout: {
      radius: clamp(g.layout?.radius, 0, 32, f.layout?.radius ?? 8),
      density: ['cozy', 'airy'].includes(g.layout?.density) ? g.layout.density : f.layout?.density ?? 'airy',
      productColumns: clamp(Math.round(g.layout?.productColumns), 1, 4, f.layout?.productColumns ?? 3),
      imageRatio: ['1/1', '4/5', '3/4', '16/9'].includes(g.layout?.imageRatio) ? g.layout.imageRatio : f.layout?.imageRatio ?? '1/1',
    },
    hero: {
      headline: str(g.hero?.headline, 120, f.hero?.headline),
      sub: str(g.hero?.sub, 200, f.hero?.sub),
      image: SAFE_URL.test(g.hero?.image ?? '') ? g.hero.image : f.hero?.image ?? '',
      video: SAFE_URL.test(g.hero?.video ?? '') ? g.hero.video : f.hero?.video ?? '',
    },
    featured: Array.isArray(g.featured) ? g.featured.filter((x) => typeof x === 'string').slice(0, 8) : f.featured ?? [],
  };
  for (const k of COLOR_KEYS) out.colors[k] = HEX.test(g.colors?.[k] ?? '') ? g.colors[k] : f.colors?.[k] ?? '#000000';
  return out;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function deepMerge(base, patch) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(patch || {})) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
  return out;
}

export function applyPatch(genome, patch) {
  // id is fixed; everything else goes through the same validation as a full genome
  return sanitizeGenome({ ...deepMerge(genome, patch), id: genome.id }, genome);
}

export function diff(a, b, prefix = '') {
  const changes = [];
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isObj(a?.[k]) && isObj(b?.[k])) changes.push(...diff(a[k], b[k], path));
    else if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) changes.push({ path, from: a?.[k], to: b?.[k] });
  }
  return changes;
}

// --- WCAG contrast ---
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function accessibilityReport(g) {
  const c = g.colors;
  const checks = [
    { pair: 'text on bg', ratio: contrast(c.text, c.bg), min: 4.5 },
    { pair: 'text on surface', ratio: contrast(c.text, c.surface), min: 4.5 },
    { pair: 'muted on bg', ratio: contrast(c.muted, c.bg), min: 4.5 },
    { pair: 'button text on primary', ratio: contrast(c.onPrimary, c.primary), min: 4.5 },
    { pair: 'primary on bg (focus ring, links)', ratio: contrast(c.primary, c.bg), min: 3 },
  ].map((x) => ({ ...x, ratio: Math.round(x.ratio * 100) / 100, pass: x.ratio >= x.min }));
  return { pass: checks.every((x) => x.pass), checks };
}

export function genomeToCss(g) {
  const c = g.colors, t = g.type, l = g.layout;
  const pad = l.density === 'airy' ? 1.25 : 0.85;
  return `:root{--bg:${c.bg};--surface:${c.surface};--text:${c.text};--muted:${c.muted};--primary:${c.primary};--on-primary:${c.onPrimary};--accent:${c.accent};` +
    `--font-head:${t.heading};--font-body:${t.body};--fs:${t.baseSize}px;--scale:${t.scale};` +
    `--radius:${l.radius}px;--pad:${pad}rem;--cols:${l.productColumns};--ratio:${l.imageRatio}}`;
}
