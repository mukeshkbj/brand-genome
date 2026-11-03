# Brand Genome — Krifth Hackathon starter

One merchant, one shared product catalogue, and one **brand genome** per storefront.
A genome is a single JSON file describing the brand (colours, type, layout, voice, story, hero).
Every page is rendered from it, and the merchant changes it by describing what they want in plain words.

## Run it

Needs Node 20.12 or newer. There are no dependencies to install.

```bash
cd brand-genome
cp .env.example .env        # optional - works without it
npm start                   # http://localhost:3000
npm test                    # 13 tests: money, genome safety, full checkout, editor
```

| URL | What it is |
|---|---|
| `/` | List of storefronts |
| `/s/sunday-kiln/` and `/s/night-market/` | Two storefronts, different themes, **same catalogue** |
| `/editor/sunday-kiln` | Theme editor: describe a change, compare side by side, approve / reject / undo |
| `/healthz` | Shows payments mode and whether Gemini is on |

Without `GEMINI_API_KEY` the editor uses a small offline rule set (try "Bonfire Night", "bigger photos", "softer corners").
Without payment keys, checkout runs in **mock mode**: the order waits ~4 s for a simulated phone approval, then is marked paid.
A phone number ending in `0000` is declined, so you can demo the failure path.

## How it maps to the quests

| Quest | Where it lives |
|---|---|
| First to publish a theme (home, product, working cart) | `src/render.js`, `server.js` storefront routes |
| First non-card payment method | `src/payments/` — MTN MoMo and M-Pesa sandbox adapters, Telecel Cash mocked |
| First real merchant live (≥5 real products) | Replace `data/catalog.json` and `public/assets/products/` |
| First multi-brand setup | `data/merchant.json` → `brands`, one file per brand in `genomes/` |
| Under a second on slow 3G | Server-rendered, CSS inlined, system fonts, no framework, home HTML ≈ 8.5 KB (test fails above 14 KB). Video loads only after the page is usable. |
| Two currencies | `src/money.js` — integer minor units; unit price converted once, then multiplied and summed, so lines always add up to the total. Shopper's currency is kept on the order; the provider is charged in its own currency. |
| Most accessible checkout | Works without JS, real labels, fieldset/legend, error summary with links, `aria-invalid`, live region for payment status, 44 px targets, visible focus. The editor refuses to publish any theme that fails WCAG contrast. |

## Project layout

```
server.js               routes (storefront, checkout, editor API, payment callbacks)
src/genome.js           validate, merge, diff, contrast check, genome -> CSS variables
src/gemini.js           plain-language request -> genome patch (Gemini, or offline fallback)
src/money.js            currency conversion and cart totals
src/render.js           HTML pages
src/styles.js           base CSS (inlined)
src/payments/           mock, mtn-momo, mpesa adapters
data/merchant.json      currencies, brands, payment methods (rates are placeholders)
data/catalog.json       shared catalogue
genomes/*.json          one genome per storefront
public/editor.html      merchant theme editor
```

## Going live with real mobile money (sandbox)

1. MTN MoMo: create a Collection sandbox user at momodeveloper.mtn.com and fill in the `MOMO_*` values. The sandbox only accepts **EUR**, which the checkout handles automatically.
2. M-Pesa: create a Daraja app at developer.safaricom.co.ke and use the sandbox shortcode and passkey.
3. Set `PAYMENTS_MODE=sandbox` and set `PUBLIC_URL` to a public https tunnel so the providers can call `/api/payments/callback/:provider`.

## Still to do

- [ ] Confirm with Krifth: host on their platform or our own? Is there a catalogue or payments API?
- [ ] Real seller: their products, photos and story (with permission)
- [ ] Update the exchange rates in `data/merchant.json`
- [ ] Genome from Instagram photos (Gemini image understanding) and generated product shots / hero video
- [ ] Order agent with tools (order lookup, Gmail confirmation, low-stock alert), exposed as MCP
- [ ] Lighthouse trace on throttled slow 3G for the quest proof
- [ ] Demo video
