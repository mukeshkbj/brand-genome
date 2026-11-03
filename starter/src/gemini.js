// Turns a merchant's plain-language request into a genome patch.
// With GEMINI_API_KEY set it calls Gemini (JSON output); without it, a small
// rule-based fallback keeps the demo working offline.

const SYSTEM = `You are the brand designer for a small online shop.
You receive the shop's current "brand genome" (JSON) and a request from the merchant.
Return ONLY a JSON object: {"patch": <partial genome with only the fields to change>, "summary": "<one sentence in plain words>"}.
Rules:
- Colours are 6-digit hex. Keep text readable: text/bg and onPrimary/primary contrast must be at least 4.5:1.
- Allowed fields: tagline, story, voice.tone, voice.greeting, colors.{bg,surface,text,muted,primary,onPrimary,accent},
  type.{heading,body,baseSize,scale}, layout.{radius,density(cozy|airy),productColumns(1-4),imageRatio(1/1|4/5|3/4|16/9)},
  hero.{headline,sub}, featured (product ids from the catalogue).
- Fonts must be system font stacks (no web fonts) so the store stays fast on slow 3G.
- Keep the brand recognisable: change what was asked, not everything.
- Write copy in the brand's own voice.`;

export async function proposePatch({ genome, prompt, products }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ...fallbackPatch(genome, prompt), source: 'fallback' };

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({
      genome, catalogue: products.map((p) => ({ id: p.id, name: p.name })), request: prompt,
    }) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
  const parsed = JSON.parse(text);
  return { patch: parsed.patch || {}, summary: parsed.summary || 'Updated the theme.', source: model };
}

// Offline fallback: a few keyword rules, enough to demo the approve/reject flow.
export function fallbackPatch(genome, prompt) {
  const p = prompt.toLowerCase();
  const patch = {}; const notes = [];
  const set = (path, value) => { const keys = path.split('.'); let o = patch;
    keys.slice(0, -1).forEach((k) => (o = o[k] ??= {})); o[keys.at(-1)] = value; };

  if (/bonfire|firework|autumn|warm|cosy|cozy/.test(p)) {
    set('colors.bg', '#1B1210'); set('colors.surface', '#2A1C17'); set('colors.text', '#FBEFE6');
    set('colors.muted', '#D9C2B4'); set('colors.primary', '#FF8A3D'); set('colors.onPrimary', '#1B1210'); set('colors.accent', '#FFD166');
    set('hero.headline', 'Something warm for the long nights.'); notes.push('warm, ember-toned palette');
  }
  if (/light|bright|fresh|spring|summer/.test(p)) {
    set('colors.bg', '#FFFDF7'); set('colors.surface', '#FFFFFF'); set('colors.text', '#1E1E1E'); set('colors.muted', '#5A5A5A');
    notes.push('lighter background');
  }
  if (/bigger|larger|big photos|image/.test(p)) { set('layout.productColumns', Math.max(1, genome.layout.productColumns - 1)); notes.push('bigger product photos'); }
  if (/smaller|more products|compact|dense/.test(p)) { set('layout.productColumns', Math.min(4, genome.layout.productColumns + 1)); set('layout.density', 'cozy'); notes.push('more products per row'); }
  if (/round|soft/.test(p)) { set('layout.radius', 20); notes.push('softer corners'); }
  if (/sharp|square|bold/.test(p)) { set('layout.radius', 2); notes.push('sharper corners'); }
  if (/serif|classic|elegant/.test(p)) { set('type.heading', "Georgia, 'Times New Roman', serif"); notes.push('classic serif headings'); }
  if (/modern|clean|sans/.test(p)) { set('type.heading', "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"); notes.push('clean sans-serif headings'); }

  return { patch, summary: notes.length ? `Offline editor: ${notes.join(', ')}.` : 'Offline editor could not match that request. Add GEMINI_API_KEY for full understanding.' };
}
