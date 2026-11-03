const brand = location.pathname.split('/').filter(Boolean)[1];
const $ = (id) => document.getElementById(id);
const status = (msg) => { $('status').textContent = msg; };
let proposalId = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const show = (v) => {
  if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return `<span class="swatch" style="background:${v}"></span>${v}`;
  return esc(typeof v === 'object' ? JSON.stringify(v) : v);
};

async function api(path, body) {
  const res = await fetch(`/api/genome/${brand}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || res.statusText);
  return j;
}

function reloadCurrent() { $('current').src = `/s/${brand}/?t=${Date.now()}`; }
function clearProposal() { proposalId = null; $('result').hidden = true; $('prop-wrap').hidden = true; $('previews').classList.remove('two'); $('cur-label').textContent = 'Current store'; }

async function init() {
  const { genome } = await api('');
  $('brand-name').textContent = genome.name;
  $('open-store').href = `/s/${brand}/`;
  document.title = `Theme editor · ${genome.name}`;
  reloadCurrent();
}

document.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { $('prompt').value = b.dataset.ex; $('prompt').focus(); }));

$('ask').addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = $('prompt').value.trim();
  if (!prompt) { status('Type what you would like to change first.'); $('prompt').focus(); return; }
  $('go').disabled = true; status('Working on it…');
  try {
    const r = await api('/propose', { prompt });
    proposalId = r.proposalId;
    $('summary').textContent = `${r.summary} (${r.source})`;
    $('changes').innerHTML = r.changes.length
      ? r.changes.map((c) => `<tr><th scope="row">${esc(c.path)}</th><td>${show(c.from)}</td><td>${show(c.to)}</td></tr>`).join('')
      : '<tr><td colspan="3">No changes proposed.</td></tr>';
    $('a11y').innerHTML = r.accessibility.checks.map((c) =>
      `<li class="${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✗'} ${esc(c.pair)}: ${c.ratio}:1 (needs ${c.min}:1)</li>`).join('');
    $('approve').disabled = !r.accessibility.pass || r.changes.length === 0;
    $('approve').title = r.accessibility.pass ? '' : 'Fix readability before publishing';
    $('result').hidden = false; $('prop-wrap').hidden = false; $('previews').classList.add('two');
    $('cur-label').textContent = 'Current store (live)';
    $('proposed').src = r.previewUrl;
    status(r.accessibility.pass ? 'Proposal ready. Compare the two previews, then approve or reject.' : 'Proposal ready, but some text would be hard to read - it cannot be published as is.');
  } catch (err) { status(`Sorry - ${err.message}`); }
  finally { $('go').disabled = false; }
});

$('approve').addEventListener('click', async () => {
  try { await api('/apply', { proposalId }); clearProposal(); reloadCurrent(); status('Published. Your store now uses the new look.'); }
  catch (err) { status(`Could not publish: ${err.message}`); }
});
$('reject').addEventListener('click', async () => { await api('/reject', { proposalId }).catch(() => {}); clearProposal(); status('Proposal discarded. Nothing changed.'); });
$('undo').addEventListener('click', async () => {
  try { await api('/undo', {}); clearProposal(); reloadCurrent(); status('Undone. The previous look is back.'); }
  catch (err) { status(err.message); }
});

init().catch((e) => status(`Could not load this brand: ${e.message}`));
