export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge = 60 * 60 * 24 * 7, path = '/' } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
}

// Cart lives in a cookie so the whole shop works without JavaScript (fast on slow 3G, robust for screen readers).
export function readCart(cookies, brand) {
  try { return JSON.parse(Buffer.from(cookies[`cart_${brand}`] || '', 'base64url').toString() || '{}'); }
  catch { return {}; }
}
export function writeCart(brand, cart) {
  return cookie(`cart_${brand}`, Buffer.from(JSON.stringify(cart)).toString('base64url'), { path: '/' });
}
