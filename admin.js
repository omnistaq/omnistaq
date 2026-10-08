(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = n => 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  const when = s => { const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? esc(s) : d.toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }); };
  const KIND = { pos: 'POS system', hardware: 'Hardware', addon: 'Add-on', service: 'Service' };
  const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  let csrf = '', signedIn = false, toastTimer, kindFilter = 'all';
  let state = { products: [], settings: {}, campaign: {}, demos: [], orders: [], stats: {}, daily: [], cardEnabled: false };

  const toast = m => { const t = $('#adminToast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400); };

  /* ---------------- API ---------------- */
  function api(path, method = 'GET', body, label) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && csrf) headers['X-CSRF-Token'] = csrf;
    const job = (async () => {
      let v;
      try { v = await OMNI.request(path, { method, credentials: 'same-origin', headers, body: body !== undefined ? JSON.stringify(body) : undefined }); }
      catch (err) {
        if (err.status === 401 && signedIn && path !== 'admin/login') showLogin('Your session expired. Please sign in again.');
        throw err;
      }
      return v;
    })();
    return method !== 'GET' && window.OmniLoader ? window.OmniLoader.wrap(job, label || 'Processing…') : job;
  }
  const readFile = f => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(f); });

  /* ---------------- image field (choose / preview / remove) ---------------- */
  class ImageField {
    constructor(root, onChange) {
      this.root = root; this.onChange = onChange || (() => {}); this.url = ''; this.file = null; this.blob = '';
      this.prev = root.querySelector('.imgfield-preview'); this.input = root.querySelector('input[type=file]');
      this.rm = root.querySelector('[data-remove]'); this.status = root.querySelector('.imgfield-status');
      this.input.addEventListener('change', () => this.pick());
      this.rm.addEventListener('click', () => this.clear());
      this.render(true);            // silent: the owner variable does not exist yet
    }
    drop() { this.file = null; if (this.blob) URL.revokeObjectURL(this.blob); this.blob = ''; this.input.value = ''; }
    set(url) { this.drop(); this.url = url || ''; this.render(); }
    pick() {
      const f = this.input.files && this.input.files[0]; if (!f) return;
      if (!TYPES.includes(f.type)) { this.input.value = ''; return toast('Choose a PNG, JPG or WebP image.'); }
      if (f.size > 2 * 1024 * 1024) { this.input.value = ''; return toast('Image must be under 2 MB.'); }
      if (this.blob) URL.revokeObjectURL(this.blob);
      this.file = f; this.blob = URL.createObjectURL(f); this.render();
    }
    clear() { this.drop(); this.url = ''; this.render(); }
    get src() { return this.blob || this.url; }
    render(silent) {
      const src = this.src;
      this.prev.innerHTML = src ? `<img src="${esc(src)}" alt="">` : 'No image';
      this.rm.disabled = !src; this.root.classList.toggle('has', !!src);
      this.status.textContent = this.file ? 'New image selected — press Save to apply' : (this.url ? 'Current image' : 'No image');
      if (!silent) this.onChange(this);
    }
    async resolve() { if (this.file) return (await api('admin/upload', 'POST', { image: await readFile(this.file) }, 'Uploading image…')).url; return this.url; }
  }
  const imgProduct = new ImageField($('#imgProduct'));
  const cf = $('#campaignForm');
  const imgCampaign = new ImageField($('#imgCampaign'), () => updatePreview());
  const imgHero = new ImageField($('#imgHero'));

  /* ---------------- navigation ---------------- */
  const TITLES = { overview: ['OVERVIEW', 'Dashboard'], products: ['CATALOGUE', 'POS offers'], campaign: ['CAMPAIGNS', 'Discount popup'], leads: ['LEADS', 'Demo requests'], orders: ['SALES', 'Orders & payments'], settings: ['CONFIGURATION', 'Settings'] };
  function goTab(name) {
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    $('#crumb').textContent = TITLES[name][0]; $('#pageTitle').textContent = TITLES[name][1];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('.tab').forEach(b => b.onclick = () => goTab(b.dataset.tab));

  /* ---------------- login / session ---------------- */
  function showLogin(message) {
    signedIn = false; csrf = '';
    $('#dashboardView').hidden = true; $('#loginView').hidden = false; closeEditor();
    $('#loginPassword').value = ''; $('#loginError').textContent = message || '';
  }
  async function refresh() { state = Object.assign(state, await api('admin/overview')); renderAll(); }
  function showDash() { signedIn = true; $('#loginView').hidden = true; $('#dashboardView').hidden = false; refresh().catch(e => toast(e.message)); }
  api('admin/me').then(v => { csrf = v.csrf; showDash(); }).catch(async () => {
    try { const v = await api('setup/status'); if (v.needed) location.replace('setup.html'); } catch (e) { $('#loginError').textContent = e.message; }
  });
  $('#loginShow').onchange = e => { $('#loginPassword').type = e.target.checked ? 'text' : 'password'; };
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); const btn = $('#loginBtn'); btn.disabled = true; $('#loginError').textContent = '';
    try { const v = await api('admin/login', 'POST', { password: $('#loginPassword').value }, 'Signing in…'); csrf = v.csrf; showDash(); }
    catch (err) { $('#loginError').textContent = err.message; } finally { btn.disabled = false; }
  });
  $('#logout').onclick = async () => { try { await api('admin/logout', 'POST', {}, 'Signing out…'); } catch {} showLogin(); };
  $('#reload').onclick = () => refresh().then(() => toast('Up to date.')).catch(e => toast(e.message));

  function renderAll() { renderStats(); renderChart(); renderAttention(); renderKindChips(); renderProducts(); renderCampaign(); renderSettings(); renderDemos(); renderOrders(); }

  /* ---------------- dashboard ---------------- */
  function renderStats() {
    const s = state.stats || {};
    const cards = [
      ['New demo requests', s.demosNew, s.demosNew > 0], ['Payment slips to verify', s.proofsWaiting, s.proofsWaiting > 0], ['Quotes to price', s.quotesNeeded, s.quotesNeeded > 0], ['Open orders', s.ordersOpen],
      ['Demo requests · 7 days', s.demos7d], ['WhatsApp clicks · 7 days', s.whatsapp7d], ['Added to basket · 7 days', s.cartAdds7d], ['Paid revenue', rs(s.paidRevenue)],
    ];
    $('#statGrid').innerHTML = cards.map(c => `<div class="stat ${c[2] ? 'hot' : ''}"><b>${esc(c[1] ?? 0)}</b><small>${esc(c[0])}</small></div>`).join('');
    const nd = s.demosNew || 0, no = (s.proofsWaiting || 0) + (s.quotesNeeded || 0);
    $('#badgeDemos').hidden = !nd; $('#badgeDemos').textContent = nd; $('#badgeOrders').hidden = !no; $('#badgeOrders').textContent = no;
  }
  function renderChart() {
    const d = state.daily || []; if (!d.length) { $('#chart').innerHTML = ''; return; }
    const W = 620, H = 210, pl = 28, pr = 6, pt = 10, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
    const max = Math.max(4, ...d.map(x => Math.max(x.demos, x.orders))), step = iw / d.length, bw = Math.min(11, step / 2.6);
    let g = '';
    [0, .5, 1].forEach(t => { const y = pt + ih * (1 - t); g += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text x="${pl - 6}" y="${y + 3}" text-anchor="end">${Math.round(max * t)}</text>`; });
    d.forEach((x, i) => {
      const cx = pl + i * step + step / 2, hd = ih * x.demos / max, ho = ih * x.orders / max;
      g += `<rect class="bar-d" x="${cx - bw - 1}" y="${pt + ih - hd}" width="${bw}" height="${hd}" rx="3"><title>${esc(x.date)} · ${x.demos} demo request(s)</title></rect>`;
      g += `<rect class="bar-o" x="${cx + 1}" y="${pt + ih - ho}" width="${bw}" height="${ho}" rx="3"><title>${esc(x.date)} · ${x.orders} order(s)</title></rect>`;
      if (i % 2 === 0 || d.length < 8) g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(x.date.slice(8))}</text>`;
    });
    $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Demo requests and orders for the last 14 days">${g}</svg>`;
  }
  function renderAttention() {
    const t = [];
    state.orders.filter(o => o.status === 'proof_submitted').forEach(o => t.push(['Verify payment · ' + o.ref, `${o.name} · ${o.phone} · ${o.amount == null ? 'quote pending' : rs(o.amount)}`, 'orders']));
    state.orders.filter(o => o.status === 'needs_quote').forEach(o => t.push(['Set a quote · ' + o.ref, `${o.name} · ${o.phone} · ${o.items.map(i => i.name).join(', ')}`, 'orders']));
    state.demos.filter(d => d.status === 'new').slice(0, 6).forEach(d => t.push(['Call back · ' + d.name, `${d.phone} · ${d.business || d.shop_type || ''}`, 'leads']));
    $('#attention').innerHTML = t.map(x => `<div class="todo-item"><div><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></div><button class="btn sm" data-go="${x[2]}" type="button">Open</button></div>`).join('') || '<div class="empty">Nothing needs attention right now. 🎉</div>';
  }
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if (!go) return;
    goTab(go.dataset.go); if (go.dataset.new) openEditor(null);
  });

  /* ---------------- offers ---------------- */
  function renderKindChips() {
    const c = { all: state.products.length, pos: 0, hardware: 0, addon: 0, service: 0 }; state.products.forEach(p => c[p.kind] = (c[p.kind] || 0) + 1);
    $('#kindChips').innerHTML = [['all', 'All'], ['pos', 'POS systems'], ['hardware', 'Hardware'], ['addon', 'Add-ons'], ['service', 'Services']].map(([k, l]) => `<button type="button" class="chip ${kindFilter === k ? 'on' : ''}" data-kind="${k}">${l}<b>${c[k] || 0}</b></button>`).join('');
  }
  $('#kindChips').onclick = e => { const b = e.target.closest('[data-kind]'); if (b) { kindFilter = b.dataset.kind; renderKindChips(); renderProducts(); } };
  $('#productSearch').oninput = () => renderProducts();
  function saleTag(p) {
    if (!p.rawDiscount) return '';
    const today = new Date().toISOString().slice(0, 10);
    if (p.discountStart && today < p.discountStart) return `<span class="tag sched">${p.rawDiscount}% from ${esc(p.discountStart)}</span>`;
    if (p.discountEnd && today > p.discountEnd) return `<span class="tag off">${p.rawDiscount}% ended</span>`;
    return `<span class="tag sale">${p.rawDiscount}% sale${p.discountEnd ? ' to ' + esc(p.discountEnd) : ''}</span>`;
  }
  function renderProducts() {
    const q = $('#productSearch').value.trim().toLowerCase();
    const rows = state.products.filter(p => (kindFilter === 'all' || p.kind === kindFilter) && (!q || (p.name + ' ' + p.category + ' ' + p.description).toLowerCase().includes(q)));
    $('#productAdminList').innerHTML = rows.map(p => `<article class="pa ${p.active ? '' : 'is-hidden'}"><div class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="">` : esc(p.icon || '✳')}</div><div><div class="tags"><span class="tag k-${esc(p.kind)}">${esc(KIND[p.kind] || p.kind)}</span>${p.featured ? '<span class="tag feat">Featured</span>' : ''}${p.active ? '' : '<span class="tag off">Hidden</span>'}${saleTag(p)}</div><h3>${esc(p.name)}</h3><div class="cat">${esc(p.category || '')}</div><div class="price">${p.price ? rs(p.price) : 'Price on request'}</div></div><div class="acts"><button class="btn sm" data-edit="${esc(p.id)}" type="button">Edit</button><button class="btn sm" data-toggle="${esc(p.id)}" type="button">${p.active ? 'Hide' : 'Show'}</button><button class="btn sm danger-ghost" data-delete="${esc(p.id)}" type="button">Delete</button></div></article>`).join('') || '<div class="empty">No offers match. Use “Add offer” to create one.</div>';
  }
  $('#productAdminList').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const find = id => state.products.find(x => x.id === id);
    if (b.dataset.edit) return openEditor(find(b.dataset.edit));
    try {
      if (b.dataset.toggle) { const p = find(b.dataset.toggle); await saveProduct({ ...p, discount: p.rawDiscount, active: !p.active }); await refresh(); toast(p.active ? 'Offer hidden from the website.' : 'Offer is visible again.'); }
      if (b.dataset.delete) { const p = find(b.dataset.delete); if (!confirm(`Delete “${p.name}” permanently? Its uploaded image is deleted too.`)) return; await api('admin/products/' + encodeURIComponent(p.id), 'DELETE', undefined, 'Deleting…'); await refresh(); toast('Offer deleted.'); }
    } catch (err) { toast(err.message); }
  };
  const saveProduct = p => api('admin/products', 'POST', {
    id: p.id || '', kind: p.kind || 'pos', name: p.name, category: p.category, price: Number(p.price || 0), discount: Number(p.discount || 0), discountStart: p.discountStart || '', discountEnd: p.discountEnd || '',
    icon: p.icon, featured: !!p.featured, active: !!p.active, sortOrder: Number(p.sortOrder || 0), description: p.description, features: p.features || [], image: p.image || '',
  }, 'Saving offer…');

  const editor = $('#productEditor'), form = $('#productForm'), backdrop = $('#drawerBackdrop');
  function openEditor(p) {
    form.reset();
    if (p) {
      for (const f of ['id', 'kind', 'name', 'category', 'price', 'icon', 'description', 'discountStart', 'discountEnd', 'sortOrder']) form.elements[f].value = p[f] ?? '';
      form.elements.discount.value = p.rawDiscount ?? 0; form.elements.features.value = (p.features || []).join(', ');
      form.elements.featured.checked = !!p.featured; form.elements.active.checked = !!p.active; imgProduct.set(p.image);
    } else {
      form.elements.id.value = ''; form.elements.kind.value = kindFilter === 'all' ? 'pos' : kindFilter; form.elements.price.value = 0; form.elements.discount.value = 0;
      form.elements.sortOrder.value = state.products.length + 1; form.elements.active.checked = true; form.elements.icon.value = '🛒'; imgProduct.set('');
    }
    $('#productEditorTitle').textContent = p ? 'Edit offer' : 'Add offer';
    editor.hidden = false; backdrop.hidden = false; document.body.style.overflow = 'hidden'; editor.querySelector('.drawer-body').scrollTop = 0;
  }
  function closeEditor() { editor.hidden = true; backdrop.hidden = true; document.body.style.overflow = ''; }
  $('#addProduct').onclick = () => openEditor(null);
  $$('[data-editor-close]').forEach(b => b.onclick = closeEditor); backdrop.onclick = closeEditor;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeEditor(); $('#lightbox').hidden = true; } });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const image = await imgProduct.resolve(), d = new FormData(form);
      await saveProduct({
        id: d.get('id'), kind: d.get('kind'), name: d.get('name'), category: d.get('category'), price: d.get('price'), discount: d.get('discount'), discountStart: d.get('discountStart'), discountEnd: d.get('discountEnd'),
        icon: d.get('icon'), featured: form.elements.featured.checked, active: form.elements.active.checked, sortOrder: d.get('sortOrder'), description: d.get('description'),
        features: String(d.get('features')).split(',').map(x => x.trim()).filter(Boolean), image,
      });
      closeEditor(); await refresh(); toast('Offer saved for all visitors.');
    } catch (err) { toast(err.message); }
  });

  /* ---------------- popup ---------------- */
  function updatePreview() {
    const g = n => cf.elements[n].value.trim();
    $('#ppTitle').textContent = g('title') || 'A special offer for your business'; $('#ppDisc').textContent = g('discountText') || 'SPECIAL OFFER';
    $('#ppMsg').textContent = g('message'); $('#ppBtn').textContent = g('ctaLabel') || 'Claim this offer';
    const src = imgCampaign.src; $('#ppImg').style.backgroundImage = src ? `url("${src}")` : ''; $('#ppImg').hidden = !src;
  }
  cf.addEventListener('input', updatePreview);
  function renderCampaign() {
    const c = state.campaign || {};
    $('#campaignActive').checked = !!c.active;
    for (const k of ['title', 'message', 'discountText', 'ctaLabel', 'startAt', 'endAt']) cf.elements[k].value = c[k] || '';
    imgCampaign.set(c.image);
    const st = $('#campStatus'); st.className = 'pill ' + (c.live ? 'live' : (c.active ? 'sched' : ''));
    st.textContent = c.live ? 'LIVE NOW' : (c.active ? 'SCHEDULED / EXPIRED' : 'OFF');
  }
  cf.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const d = new FormData(cf), image = await imgCampaign.resolve();
      await api('admin/campaign', 'PUT', { active: $('#campaignActive').checked, title: d.get('title'), message: d.get('message'), discountText: d.get('discountText'), ctaLabel: d.get('ctaLabel'), startAt: d.get('startAt'), endAt: d.get('endAt'), image }, 'Saving popup…');
      await refresh(); toast('Discount popup saved.');
    } catch (err) { toast(err.message); }
  });

  /* ---------------- settings ---------------- */
  const SET_KEYS = ['whatsapp', 'bankName', 'accountName', 'accountNumber', 'bankBranch', 'supportHours', 'demoVideo', 'setupText', 'updateText'];
  function renderSettings() {
    const s = state.settings || {}, f = $('#settingsForm');
    SET_KEYS.forEach(k => { f.elements[k].value = s[k] || ''; }); imgHero.set(s.heroImage);
    $('#cardTip').textContent = state.cardEnabled ? 'Card checkout is ACTIVE (PayHere credentials found in config.php).' : 'Card checkout is off. Add your PayHere merchant ID, secret and BASE_URL in config.local.php to enable it. Secrets are never entered here.';
  }
  $('#settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const f = e.currentTarget, d = new FormData(f), data = {}; SET_KEYS.forEach(k => data[k] = d.get(k)); data.heroImage = await imgHero.resolve();
      await api('admin/settings', 'PUT', data, 'Saving settings…'); await refresh(); toast('Website settings saved.');
    } catch (err) { toast(err.message); }
  });
  $('#passwordForm').addEventListener('submit', async e => {
    e.preventDefault();
    try { const d = new FormData(e.currentTarget); await api('admin/password', 'PUT', { current: d.get('current'), next: d.get('next') }, 'Updating password…'); e.currentTarget.reset(); showLogin('Password changed. Please sign in with the new password.'); }
    catch (err) { toast(err.message); }
  });

  /* ---------------- demos & orders ---------------- */
  const demoStatuses = ['new', 'contacted', 'scheduled', 'closed'];
  const orderStatuses = ['new', 'awaiting_payment', 'proof_submitted', 'needs_quote', 'payment_failed', 'paid', 'cancelled', 'chargeback'];
  const label = s => String(s).replaceAll('_', ' ');
  const sel = (status, ref, type, opts) => `<select data-type="${type}" data-ref="${esc(ref)}" aria-label="Status">${opts.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${label(s)}</option>`).join('')}</select>`;
  const notesBox = (ref, type, notes) => `<div class="notes"><textarea placeholder="Internal note (customers never see this)" data-notes="${esc(ref)}" data-type="${type}">${esc(notes || '')}</textarea><button class="btn sm" data-save-notes="${esc(ref)}" data-type="${type}" type="button">Save</button></div>`;
  const waNumber = p => { let n = String(p).replace(/\D/g, ''); if (n.startsWith('00')) n = n.slice(2); if (n.startsWith('0')) n = '94' + n.slice(1); else if (n.length === 9) n = '94' + n; return n; };
  const waBtn = (kind, ref) => kind === 'order'
    ? `<button class="btn sm primary" data-wa-order="${esc(ref)}" type="button">💬 WhatsApp + tracking link</button>`
    : `<button class="btn sm" data-wa-demo="${esc(ref)}" type="button">💬 WhatsApp</button>`;

  const match = (text, q) => !q || text.toLowerCase().includes(q.toLowerCase());
  async function onListClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.waOrder) {
        const o = state.orders.find(x => x.ref === b.dataset.waOrder); if (!o) return;
        const n = waNumber(o.phone); if (n.length < 9) return toast('This customer phone number looks incomplete.');
        const v = await api(`admin/orders/${encodeURIComponent(o.ref)}/link`, 'POST', {}, 'Preparing WhatsApp message…');
        return window.OmniWA.open(n, window.OmniWA.msg.orderToCustomer(o, v.url));
      }
      if (b.dataset.waDemo) {
        const d = state.demos.find(x => x.ref === b.dataset.waDemo); if (!d) return;
        const n = waNumber(d.phone); if (n.length < 9) return toast('This customer phone number looks incomplete.');
        return window.OmniWA.open(n, window.OmniWA.msg.demoToCustomer(d));
      }
      if (b.dataset.saveNotes) { const ta = b.parentElement.querySelector('textarea'); await api(`admin/${b.dataset.type}/${encodeURIComponent(b.dataset.saveNotes)}`, 'PUT', { notes: ta.value }, 'Saving note…'); return toast('Note saved.'); }
      if (b.dataset.delDemo) { if (!confirm('Delete this demo request?')) return; await api('admin/demos/' + encodeURIComponent(b.dataset.delDemo), 'DELETE', undefined, 'Deleting…'); await refresh(); return toast('Demo request deleted.'); }
      if (b.dataset.slip) { $('#lightbox img').src = b.dataset.slip; $('#lightbox').hidden = false; return; }
      if (b.dataset.delSlip) { if (!confirm('Remove this payment slip image from the server?')) return; await api(`admin/orders/${encodeURIComponent(b.dataset.delSlip)}/proof`, 'DELETE', undefined, 'Removing slip…'); await refresh(); return toast('Payment slip removed.'); }
      if (b.dataset.quote) {
        const input = b.parentElement.querySelector('input'); if (!input.value) return toast('Enter the quoted amount.');
        await api('admin/orders/' + encodeURIComponent(b.dataset.quote), 'PUT', { status: 'awaiting_payment', amount: Number(input.value) }, 'Saving quote…'); await refresh(); toast('Quote saved. The customer can now see the amount.');
      }
    } catch (err) { toast(err.message); }
  }
  async function onListChange(e) {
    const s = e.target.closest('select[data-ref]'); if (!s) return;
    try { await api(`admin/${s.dataset.type}/${encodeURIComponent(s.dataset.ref)}`, 'PUT', { status: s.value }, 'Updating status…'); await refresh(); toast('Status updated.'); }
    catch (err) { toast(err.message); await refresh().catch(() => {}); }
  }
  ['#demoList', '#orderList'].forEach(id => { $(id).addEventListener('click', onListClick); $(id).addEventListener('change', onListChange); });
  $('#lightbox').onclick = e => { if (e.target.id === 'lightbox' || e.target.closest('.x')) $('#lightbox').hidden = true; };

  function renderDemos() {
    const q = $('#demoSearch').value.trim(), f = $('#demoFilter').value;
    const rows = state.demos.filter(d => (!f || d.status === f) && match([d.ref, d.name, d.phone, d.business, d.shop_type, d.message].join(' '), q));
    $('#demoList').innerHTML = rows.map(d => `<article class="row"><div><h3>${esc(d.name)} <span class="st ${esc(d.status)}">${label(d.status)}</span></h3><p><strong>${esc(d.phone)}</strong> · ${esc(d.business || 'Business not given')} · ${esc(d.shop_type || 'POS setup')}</p><p>${esc(d.message || 'No message')}</p><span class="ts">${esc(d.ref)} · ${when(d.created_at)}</span>${notesBox(d.ref, 'demos', d.notes)}</div><div class="side-actions">${sel(d.status, d.ref, 'demos', demoStatuses)}${waBtn('demo', d.ref)}<button class="btn sm danger-ghost" data-del-demo="${esc(d.ref)}" type="button">Delete</button></div></article>`).join('') || '<div class="empty">No demo requests found.</div>';
  }
  function renderOrders() {
    const q = $('#orderSearch').value.trim(), f = $('#orderFilter').value;
    const rows = state.orders.filter(o => (!f || o.status === f) && match([o.ref, o.name, o.phone, o.email, o.business].join(' '), q));
    $('#orderList').innerHTML = rows.map(o => {
      const items = o.items.map(i => `<div><span>${esc(i.name)} × ${esc(i.qty || 1)}</span><b>${i.total == null ? 'Quote' : rs(i.total)}</b></div>`).join('');
      const cats = (o.businessCategories || []).length ? `<div class="chiplist">${o.businessCategories.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : '';
      return `<article class="row"><div><h3>${esc(o.ref)} · ${esc(o.name)} <span class="st ${esc(o.status)}">${label(o.status)}</span></h3><p><strong>${esc(o.phone)}</strong> · ${esc(o.email || 'No email')} · ${esc(o.business || 'Business not given')}${o.businessType ? ' · ' + esc(o.businessType) : ''}</p>${cats}<div class="items">${items}<div><span>Total</span><b>${o.amount == null ? 'Price on request' : rs(o.amount)}</b></div></div><p>${o.payment_method === 'bank' ? 'Bank transfer' : 'Card'} · ${esc([o.address, o.city].filter(Boolean).join(', ') || 'No address')}</p>${o.amount == null ? `<div class="quote"><input type="number" min="1" step="0.01" placeholder="Quote total in LKR"><button class="btn sm primary" data-quote="${esc(o.ref)}" type="button">Set quote</button></div>` : ''}${o.proofUrl ? `<div class="slip"><button class="btn sm" data-slip="${esc(o.proofUrl)}" type="button">View payment slip</button><button class="btn sm danger-ghost" data-del-slip="${esc(o.ref)}" type="button">Remove slip</button></div>` : ''}<span class="ts">${when(o.created_at)}</span>${notesBox(o.ref, 'orders', o.notes)}</div><div class="side-actions">${sel(o.status, o.ref, 'orders', orderStatuses)}${waBtn('order', o.ref)}</div></article>`;
    }).join('') || '<div class="empty">No orders found.</div>';
  }
  ['#demoSearch', '#demoFilter'].forEach(s => $(s).addEventListener('input', renderDemos));
  ['#orderSearch', '#orderFilter'].forEach(s => $(s).addEventListener('input', renderOrders));
})();
