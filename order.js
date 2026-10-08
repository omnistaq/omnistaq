(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  const qs = new URLSearchParams(location.search);
  let waNumber = '', orderInfo = null;
  let ref = qs.get('ref') || '', token = new URLSearchParams(location.hash.slice(1)).get('token') || localStorage.getItem('omnistaq_order_' + ref) || '', checkout = null;
  const error = m => { $('#orderError').textContent = m || ''; };
  const wrap = (p, t) => window.OmniLoader ? window.OmniLoader.wrap(p, t) : p;

  async function call(path, opts, text) {
    const job = (async () => {
      const v = await OMNI.request(path, opts);
      return v;
    })();
    return wrap(job, text);
  }

  function tracker(o) {
    const box = $('#orderTracker');
    if (['cancelled', 'payment_failed', 'chargeback'].includes(o.status)) { box.hidden = true; return; }
    box.hidden = false;
    const paid = o.status === 'paid', proof = o.status === 'proof_submitted' || paid;
    const steps = [['1', 'Order placed', true], [proof ? '✓' : '2', o.payment_method === 'card' ? 'Card payment' : 'Payment slip', proof], [paid ? '✓' : '3', 'Confirmed', paid]];
    box.innerHTML = steps.map(s => `<div class="${s[2] ? 'done' : ''}"><i>${s[2] && s[0] !== '1' ? '✓' : s[0]}</i>${s[1]}</div>`).join('');
  }

  async function load() {
    if (!ref || !token) { $('#lookupForm').hidden = false; return; }
    try {
      const v = await call('orders/' + encodeURIComponent(ref), { headers: { 'X-Order-Token': token } }, 'Loading your order…');
      localStorage.setItem('omnistaq_order_' + ref, token);
      const o = v.order; orderInfo = o; waNumber = String(v.whatsapp || ''); $('#orderWa').hidden = !waNumber; $('#lookupForm').hidden = true; $('#orderView').hidden = false; error('');
      $('#orderStatus').textContent = o.status.replaceAll('_', ' '); $('#orderStatus').className = 'status-badge ' + o.status;
      tracker(o);
      $('#orderDetails').innerHTML = `<div><small>Order number</small><b>${esc(o.ref)}</b></div><div><small>Payment</small><b>${o.payment_method === 'bank' ? 'Bank transfer' : 'Card'}</b></div><div><small>Customer</small><b>${esc(o.name)}</b></div><div><small>Amount</small><b>${o.amount == null ? 'Quote pending' : money(o.amount)}</b></div>`;
      $('#orderItems').innerHTML = '<div class="co-label">Your selection</div><div class="order-lines">' + o.items.map(i => `<div><span>${esc(i.name)} <small>× ${esc(i.qty || 1)}</small></span><b>${i.total != null ? money(i.total) : 'Quote'}</b></div>`).join('') + '</div>';
      if (v.bank && o.amount != null) {
        $('#bankDetails').hidden = false;
        $('#bankDetails').innerHTML = `<h2>Bank transfer details</h2><p>Bank: <b>${esc(v.bank.bankName || 'Confirm with our team')}</b></p><p>Account name: <b>${esc(v.bank.accountName || 'Confirm with our team')}</b></p><p>Account number: <b>${esc(v.bank.accountNumber || 'Confirm with our team')}</b></p><p>Branch: <b>${esc(v.bank.bankBranch || '—')}</b></p><p>Use order number <b>${esc(o.ref)}</b> as the payment reference. Upload your slip after transferring. Our team verifies each payment.</p>`;
        $('#proofForm').hidden = ['paid', 'cancelled', 'chargeback'].includes(o.status) || !v.bank.accountNumber;
      } else { $('#bankDetails').hidden = true; $('#proofForm').hidden = true; }
      checkout = v.checkout; $('#cardRetry').hidden = !checkout;
      const msg = $('#orderMessage'); msg.innerHTML = '';
      if (o.status === 'proof_submitted') msg.innerHTML = '<p class="order-success">Your slip was received. Payment will be confirmed after review.</p>';
      if (o.status === 'paid') msg.innerHTML = '<p class="order-success">Payment confirmed. Our team will contact you about setup.</p>';
      if (o.status === 'needs_quote') msg.innerHTML = '<p class="order-success" style="background:#fff6e5;color:#8a5a00">Our team will confirm your price and next steps. You will see the amount and bank details here once your quote is ready.</p>';
    } catch (e) { error(e.message); $('#orderView').hidden = true; $('#lookupForm').hidden = false; }
  }

  $('#lookupForm').onsubmit = e => { e.preventDefault(); const d = new FormData(e.currentTarget); ref = String(d.get('ref')).trim(); token = String(d.get('token')).trim(); history.replaceState({}, '', `order.html?ref=${encodeURIComponent(ref)}#token=${encodeURIComponent(token)}`); error(''); load(); };
  $('#proofForm').onsubmit = async e => {
    e.preventDefault();
    const f = e.currentTarget, file = f.elements.proof.files[0]; if (!file) return;
    if (file.size > 3 * 1024 * 1024) return error('Choose an image under 3 MB.');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return error('Choose a PNG, JPG or WebP image.');
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const btn = f.querySelector('button'); btn.disabled = true;
    try { await call(`orders/${encodeURIComponent(ref)}/proof`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Token': token }, body: JSON.stringify({ image: data }) }, 'Uploading your slip…'); error(''); f.reset(); await load(); }
    catch (err) { error(err.message); } finally { btn.disabled = false; }
  };
  $('#orderWa').onclick = () => { if (waNumber && orderInfo) window.OmniWA.open(waNumber, window.OmniWA.msg.aboutOrder(orderInfo)); };
  $('#copyLink').onclick = async () => {
    const link = `${location.origin}${location.pathname}?ref=${encodeURIComponent(ref)}#token=${encodeURIComponent(token)}`;
    try { await navigator.clipboard.writeText(link); $('#copyLink').textContent = 'Private link copied ✓'; } catch { error('Copy the URL from your browser address bar.'); }
  };
  $('#payNow').onclick = () => {
    if (!checkout) return;
    const form = document.createElement('form'); form.method = 'POST'; form.action = checkout.action;
    for (const [k, val] of Object.entries(checkout.fields)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = val; form.append(i); }
    document.body.append(form); form.submit();
  };
  load();
})();
