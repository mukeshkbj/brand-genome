// Optional progressive enhancement. The shop works fully without this file.
(() => {
  // 1) Load the hero video only after the page is usable (keeps the slow-3G budget intact).
  const v = document.querySelector('video[data-src]');
  if (v && !matchMedia('(prefers-reduced-motion: reduce)').matches && !(navigator.connection && navigator.connection.saveData)) {
    addEventListener('load', () => setTimeout(() => {
      v.src = v.dataset.src; v.hidden = false; v.play().catch(() => {});
      const img = v.parentElement.querySelector('img'); if (img) v.addEventListener('playing', () => img.remove(), { once: true });
    }, 300));
  }

  // 2) Order page: poll payment status and announce it in the live region instead of reloading.
  const s = document.getElementById('order-status');
  if (s && s.dataset.state === 'pending') {
    const msgs = { paid: 'Payment received - thank you!', failed: "Payment didn't go through." };
    const tick = async () => {
      try {
        const r = await fetch(`/api/orders/${s.dataset.order}`).then((x) => x.json());
        if (r.status !== 'pending') { s.textContent = r.status === 'failed' && r.reason ? `${msgs.failed} ${r.reason}` : msgs[r.status]; setTimeout(() => location.reload(), 1500); return; }
      } catch {}
      setTimeout(tick, 2500);
    };
    setTimeout(tick, 2500);
  }

  // 3) Move focus to the error summary after a failed checkout submit.
  const errs = document.getElementById('errors'); if (errs) errs.focus();
})();
