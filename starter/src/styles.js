// Base CSS, inlined into every page (no extra request = faster first render on slow 3G).
// Brand-specific values come from genome CSS variables.
export const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{font-size:var(--fs);-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-body);line-height:1.55}
h1,h2,h3{font-family:var(--font-head);line-height:1.15;margin:0 0 .5em}
h1{font-size:calc(1rem*var(--scale)*var(--scale)*var(--scale))}
h2{font-size:calc(1rem*var(--scale)*var(--scale))}
h3{font-size:calc(1rem*var(--scale))}
a{color:inherit;text-underline-offset:.2em}
img{max-width:100%;height:auto;display:block}
:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
.skip{position:absolute;left:-999px;top:0;background:var(--primary);color:var(--on-primary);padding:.6rem 1rem;z-index:10}
.skip:focus{left:1rem}
.wrap{max-width:72rem;margin:0 auto;padding:0 1rem}
header.site{border-bottom:1px solid color-mix(in srgb,var(--text) 15%,transparent)}
header.site .wrap{display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap;padding-block:.75rem}
.logo{font-family:var(--font-head);font-weight:700;font-size:1.2rem;text-decoration:none}
nav ul{display:flex;gap:1rem;list-style:none;margin:0;padding:0;align-items:center;flex-wrap:wrap}
main{padding-block:calc(var(--pad)*2)}
.hero{display:grid;gap:calc(var(--pad)*1.5);align-items:center;margin:var(--pad) 0 calc(var(--pad)*3)}
@media(min-width:48rem){.hero{grid-template-columns:1.1fr 1fr}}
.hero p{color:var(--muted);font-size:1.1rem}
.hero .media{border-radius:var(--radius);overflow:hidden;aspect-ratio:4/3;background:var(--surface)}
.hero .media img,.hero .media video{width:100%;height:100%;object-fit:cover}
.grid{display:grid;gap:calc(var(--pad)*1.2);grid-template-columns:repeat(auto-fill,minmax(min(100%,calc(64rem/var(--cols) - 2rem)),1fr));list-style:none;padding:0;margin:0}
.card{background:var(--surface);border-radius:var(--radius);overflow:hidden;height:100%;display:flex;flex-direction:column}
.card img{aspect-ratio:var(--ratio);object-fit:cover;width:100%;background:color-mix(in srgb,var(--accent) 20%,var(--surface))}
.card .body{padding:var(--pad);display:flex;flex-direction:column;gap:.25rem;flex:1}
.card a{text-decoration:none}
.card a:hover h3{text-decoration:underline}
.price{font-weight:700}
.muted{color:var(--muted)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:44px;padding:.6rem 1.2rem;border-radius:var(--radius);border:2px solid var(--primary);background:var(--primary);color:var(--on-primary);font:inherit;font-weight:700;cursor:pointer;text-decoration:none}
.btn.ghost{background:transparent;color:var(--text)}
.product{display:grid;gap:calc(var(--pad)*2)}
@media(min-width:48rem){.product{grid-template-columns:1fr 1fr}}
.product img{border-radius:var(--radius);aspect-ratio:var(--ratio);object-fit:cover;width:100%}
.story{background:var(--surface);border-radius:var(--radius);padding:calc(var(--pad)*1.5);margin-block:calc(var(--pad)*3)}
label{display:block;font-weight:600;margin-bottom:.25rem}
input,select{font:inherit;color:var(--text);background:var(--surface);border:2px solid var(--muted);border-radius:calc(var(--radius)/2);padding:.55rem .7rem;min-height:44px;width:100%}
input[type=radio]{width:auto;min-height:auto;accent-color:var(--primary)}
.field{margin-bottom:1rem}
.hint{color:var(--muted);font-size:.9rem;margin:.25rem 0 0}
.error-text{color:var(--text);font-weight:700;margin:.25rem 0 0}
.error-text::before{content:"⚠ "}
[aria-invalid=true]{border-color:var(--accent);border-width:3px}
.error-summary{border:3px solid var(--accent);border-radius:var(--radius);padding:var(--pad);margin-bottom:1.5rem}
fieldset{border:2px solid color-mix(in srgb,var(--text) 20%,transparent);border-radius:var(--radius);padding:var(--pad);margin:0 0 1rem}
legend{font-weight:700;padding:0 .4rem}
.radio{display:flex;gap:.6rem;align-items:center;min-height:44px}
.radio label{margin:0;font-weight:500}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:.6rem .4rem;border-bottom:1px solid color-mix(in srgb,var(--text) 15%,transparent);vertical-align:middle}
td.num,th.num{text-align:right}
.qty{width:5rem}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.inline{display:inline}
.row{display:flex;gap:.75rem;flex-wrap:wrap;align-items:end}
.status{font-size:1.2rem;padding:var(--pad);border-radius:var(--radius);background:var(--surface)}
footer{padding-block:2rem;color:var(--muted);font-size:.9rem}
@media(prefers-reduced-motion:no-preference){.card,.btn{transition:transform .15s}.card:hover{transform:translateY(-2px)}}
`.replace(/\n/g, '');
