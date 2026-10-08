(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  const digits = v => String(v || '').replace(/\D/g, '');

  const KINDS = {
    pos: { tab: 'POS Systems', badge: 'POS SYSTEM', group: 'POS systems for your business' },
    hardware: { tab: 'Hardware', badge: 'HARDWARE', group: 'Hardware & devices' },
    addon: { tab: 'Add-on Modules', badge: 'ADD-ON', group: 'Add-on modules' },
    service: { tab: 'Services', badge: 'SERVICE', group: 'Setup, training & support' },
  };
  const BIZ_TYPES = ['Supermarket / Grocery', 'Retail shop', 'Restaurant / Café', 'Pharmacy', 'Fashion shop', 'Electronics / Mobile shop', 'Service / Repair shop', 'Wholesale / Distribution', 'Multi-branch business', 'Other'];
  const BIZ_CATS = ['Groceries', 'Beverages', 'Dairy', 'Bakery', 'Fruits & Vegetables', 'Meat & Seafood', 'Frozen Foods', 'Snacks', 'Household', 'Cleaning Products', 'Personal Care', 'Health & Beauty', 'Baby Products', 'Stationery', 'Electronics', 'Mobile Accessories', 'Clothing', 'Footwear', 'Bags', 'Cosmetics', 'Pharmacy', 'Pet Supplies', 'Toys', 'Hardware & Tools', 'Automotive', 'Gift Items', 'Services'];
  const FALLBACK_IMG = { 'retail-pos': 'retail-pos.webp', 'restaurant-pos': 'restaurant-pos.webp' };

  let config = { products: [], settings: {}, campaign: {}, cardEnabled: false };
  let cart = [], filter = 'all', query = '', toastTimer;
  try {
    cart = JSON.parse(localStorage.getItem('omnistaq_cart_v3') || 'null') || [];
    if (!cart.length) cart = (JSON.parse(localStorage.getItem('omnistaq_cart_v2') || '[]') || []).map(id => ({ id, qty: 1 }));
  } catch { cart = []; }

  /* ---------------- helpers ---------------- */
  async function api(path, method = 'GET', body, loaderText) {
    const job = (async () => {
      const v = await OMNI.request(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      return v;
    })();
    return window.OmniLoader ? window.OmniLoader.wrap(job, loaderText) : job;
  }
  function track(type) { try { fetch(OMNI.api('events'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }), keepalive: true }).catch(() => {}); } catch {} }
  function toast(message) { const t = $('#toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3400); }
  const product = id => config.products.find(p => p.id === id);
  const salePrice = p => p.price * (1 - p.discount / 100);
  const unitLabel = p => p.price ? (p.discount ? `<span class="old-price">${money(p.price)}</span> <b>${money(salePrice(p))}</b>` : `<b>${money(p.price)}</b>`) : '<b class="quote">Request a quote</b>';
  const productImage = p => p.image ? OMNI.url(p.image) : (FALLBACK_IMG[p.id] || '');
  const qtyOf = id => (cart.find(l => l.id === id) || {}).qty || 0;

  function lockScroll() { document.documentElement.classList.toggle('no-scroll', !!document.querySelector('.modal-backdrop.show, .cart-panel.open')); }
  const openModal = el => { el.classList.add('show'); lockScroll(); };
  const closeModal = el => { el.classList.remove('show'); lockScroll(); };

  /* ---------------- WhatsApp: opens the WhatsApp app / WhatsApp Web directly ---------------- */
  function wa(message) {
    const n = digits(config.settings.whatsapp);
    if (!n) { toast('WhatsApp contact is being set up. Please book a demo.'); location.hash = '#demo'; return; }
    track('whatsapp');
    window.OmniWA.open(n, message);
  }
  const hello = () => window.OmniWA.msg.hello();
  const basketMessage = () => {
    const lines = cart.map(l => ({ p: product(l.id), q: l.qty })).filter(x => x.p).map(x => ({ name: x.p.name, qty: x.q, price: x.p.price ? salePrice(x.p) : null }));
    const sum = lines.reduce((a, l) => a + (l.price ? l.price * l.qty : 0), 0), quoted = lines.filter(l => !l.price).length;
    return window.OmniWA.msg.basket(lines, sum, quoted);
  };

  /* ---------------- catalogue ---------------- */
  function renderTabs() {
    const counts = { all: config.products.length };
    config.products.forEach(p => { counts[p.kind] = (counts[p.kind] || 0) + 1; });
    const tabs = [['all', 'All']].concat(Object.keys(KINDS).filter(k => counts[k]).map(k => [k, KINDS[k].tab]));
    $('#catTabs').innerHTML = tabs.map(([k, label]) => `<button type="button" role="tab" class="cat-tab ${filter === k ? 'active' : ''}" data-kind="${k}" aria-selected="${filter === k}">${esc(label)} <em>${counts[k] || 0}</em></button>`).join('');
  }
  function cardVisual(p) {
    const img = productImage(p);
    const sale = p.discount ? `<span class="pc-sale">−${p.discount}%</span>` : '';
    const label = `<span class="pc-kind">${esc((KINDS[p.kind] || KINDS.pos).badge)}</span>`;
    if (img) return `<div class="pc-visual has-img"><img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">${label}${sale}${p.image ? '' : '<span class="pc-illus">ILLUSTRATIVE</span>'}</div>`;
    return `<div class="pc-visual"><div class="pc-icon" aria-hidden="true">${esc(p.icon || '✳')}</div>${label}${sale}</div>`;
  }
  function actionHtml(p) {
    const q = qtyOf(p.id);
    if (!q) return `<button type="button" class="button pc-add" data-add="${esc(p.id)}">Add to basket <span>＋</span></button>`;
    return `<div class="stepper" role="group" aria-label="Quantity for ${esc(p.name)}"><button type="button" data-dec="${esc(p.id)}" aria-label="Decrease">−</button><span aria-live="polite">${q}</span><button type="button" data-inc="${esc(p.id)}" aria-label="Increase">＋</button></div>`;
  }
  function cardHtml(p) {
    const chips = (p.features || []).slice(0, 4).map(f => `<li>${esc(f)}</li>`).join('');
    const ends = p.discount && p.discountEnds ? `<small class="sale-ends">Offer ends ${esc(p.discountEnds)}</small>` : '';
    return `<article class="pcard k-${esc(p.kind)} ${p.featured ? 'featured' : ''} ${qtyOf(p.id) ? 'in-cart' : ''}" data-id="${esc(p.id)}">${cardVisual(p)}<div class="pc-body"><span class="pc-cat">${esc(p.category || 'OMNISTAQ')}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><ul class="pc-chips">${chips}</ul><div class="pc-foot"><div class="pc-price">${unitLabel(p)}${ends}</div><div class="pc-action">${actionHtml(p)}</div></div><button type="button" class="pc-more" data-details="${esc(p.id)}">View details →</button></div></article>`;
  }
  function renderProducts() {
    const q = query.trim().toLowerCase();
    let list = config.products.filter(p => (filter === 'all' || p.kind === filter) && (!q || [p.name, p.category, p.description, (p.features || []).join(' ')].join(' ').toLowerCase().includes(q)));
    const grid = $('#productGrid');
    if (!list.length) { grid.innerHTML = `<div class="empty-catalog">${q ? 'No items match “' + esc(query) + '”. Try another word, or ' : 'Nothing here yet. '}<a href="#demo">ask our team</a>.</div>`; return; }
    if (filter === 'all' && !q) {
      grid.innerHTML = Object.keys(KINDS).map(k => { const items = list.filter(p => p.kind === k); return items.length ? `<h3 class="group-title" style="grid-column:1/-1"><span>${esc(KINDS[k].group)}</span></h3>` + items.map(cardHtml).join('') : ''; }).join('');
    } else grid.innerHTML = list.map(cardHtml).join('');
  }
  function refreshCard(id) {
    const p = product(id), card = $(`.pcard[data-id="${CSS.escape(id)}"]`);
    if (!p || !card) return;
    card.querySelector('.pc-action').innerHTML = actionHtml(p);
    card.classList.toggle('in-cart', qtyOf(id) > 0);
  }
  function renderCompare() {
    const rows = config.products.filter(p => p.kind === 'pos');
    $('#compareRows').innerHTML = rows.map(p => `<tr><td>${esc(p.name)}</td><td>${p.price ? money(salePrice(p)) : 'Request a quote'}</td><td>${(p.features || []).map(esc).join(' · ')}</td><td><a href="#solutions" data-compare-id="${esc(p.id)}">Add to basket ↗</a></td></tr>`).join('');
    $$('[data-compare-id]').forEach(a => a.onclick = e => { e.preventDefault(); setQty(a.dataset.compareId, qtyOf(a.dataset.compareId) || 1, true); });
  }

  /* ---------------- product details modal ---------------- */
  function openDetails(id) {
    const p = product(id); if (!p) return;
    const img = productImage(p), im = $('#detailImage'), ic = $('#detailIcon');
    im.hidden = !img; ic.hidden = !!img;
    if (img) { im.src = img; im.alt = p.name; } else ic.textContent = p.icon || '✳';
    $('#detailCategory').textContent = (KINDS[p.kind] || KINDS.pos).badge + ' · ' + (p.category || 'OMNISTAQ');
    $('#detailTitle').textContent = p.name; $('#detailDescription').textContent = p.description;
    $('#detailFeatures').innerHTML = (p.features || []).map(f => `<li>${esc(f)}</li>`).join('');
    $('#detailPrice').textContent = p.price ? (p.discount ? money(p.price) + ' → ' : '') + money(salePrice(p)) : 'Price on request';
    $('#detailAdd').innerHTML = qtyOf(id) ? 'In basket · add one more <span>＋</span>' : 'Add to basket <span>＋</span>';
    $('#detailAdd').onclick = () => { closeModal($('#productModal')); setQty(id, qtyOf(id) + 1, true); };
    openModal($('#productModal'));
  }

  /* ---------------- basket ---------------- */
  function persistCart() { cart = cart.filter(l => product(l.id) && l.qty > 0); localStorage.setItem('omnistaq_cart_v3', JSON.stringify(cart)); renderCart(); }
  function setQty(id, qty, announce) {
    if (!product(id)) return;
    qty = Math.max(0, Math.min(99, qty | 0));
    const line = cart.find(l => l.id === id), had = !!line;
    if (line) line.qty = qty; else if (qty) { cart.push({ id, qty }); track('cart_add'); }
    persistCart(); refreshCard(id);
    if (announce && qty && !had) toast(`${product(id).name} added to your basket.`);
    const pill = $('#basketPill'); pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump');
  }
  function totals() {
    let sum = 0, quoted = 0, count = 0;
    cart.forEach(l => { const p = product(l.id); if (!p) return; count += l.qty; if (p.price) sum += Math.round(salePrice(p) * 100) * l.qty / 100; else quoted++; });
    return { sum, quoted, count, lines: cart.length };
  }
  function totalsHtml(t) {
    return `${t.sum ? `<div><span>Listed-price items</span><b>${money(t.sum)}</b></div>` : ''}${t.quoted ? `<div><span>${t.quoted} item${t.quoted > 1 ? 's' : ''} to be quoted</span><b>Price on request</b></div>` : ''}<p>${t.quoted ? 'Our team confirms your final total for quoted items.' : 'Final charges are confirmed before payment.'}</p>`;
  }
  function renderCart() {
    const t = totals(), lines = cart.map(l => ({ p: product(l.id), q: l.qty })).filter(x => x.p);
    $('#cartCount').textContent = t.count; $('#cartCountLabel').textContent = `(${t.count})`;
    $('#cartItems').innerHTML = lines.length ? lines.map(({ p, q }) => `<div class="cart-line"><div class="cl-ico">${esc(p.icon || '✳')}</div><div class="cl-main"><h3>${esc(p.name)}</h3><p>${p.price ? money(salePrice(p)) + ' each' : 'Price confirmed by our team'}</p><div class="cl-row"><div class="stepper sm"><button type="button" data-cart-dec="${esc(p.id)}" aria-label="Decrease">−</button><span>${q}</span><button type="button" data-cart-inc="${esc(p.id)}" aria-label="Increase">＋</button></div><button type="button" class="cart-remove" data-remove="${esc(p.id)}">Remove</button></div></div><b class="cl-total">${p.price ? money(salePrice(p) * q) : 'Quote'}</b></div>`).join('') : '<div class="empty-cart"><div>🧾</div>Your basket is empty.<br>Choose a POS system, hardware or add-ons to get started.</div>';
    $('#cartTotals').innerHTML = lines.length ? totalsHtml(t) : '';
    $('#checkoutBtn').disabled = !lines.length; $('#cartWa').hidden = !lines.length;
    const pill = $('#basketPill'); pill.hidden = !lines.length; $('#bpCount').textContent = t.count;
    $('#bpText').textContent = t.sum && !t.quoted ? `View basket · ${money(t.sum)}` : 'View basket';
    renderSummary();
  }
  function openCart() { $('#cartPanel').classList.add('open'); $('#cartPanel').setAttribute('aria-hidden', 'false'); $('#overlay').classList.add('active'); lockScroll(); }
  function closeCart() { $('#cartPanel').classList.remove('open'); $('#cartPanel').setAttribute('aria-hidden', 'true'); $('#overlay').classList.remove('active'); lockScroll(); }

  /* ---------------- checkout ---------------- */
  const form = $('#checkoutForm');
  const method = () => (form.querySelector('[name="payment"]:checked') || {}).value || 'bank';
  function cardAvailable() { return config.cardEnabled && cart.length > 0 && cart.every(l => product(l.id) && product(l.id).price > 0); }
  function renderSummary() {
    const lines = cart.map(l => ({ p: product(l.id), q: l.qty })).filter(x => x.p), t = totals();
    $('#checkoutSummary').innerHTML = lines.map(({ p, q }) => `<div class="sum-line"><span class="sl-ico">${esc(p.icon || '✳')}</span><span class="sl-name">${esc(p.name)}<small>× ${q}</small></span><b>${p.price ? money(salePrice(p) * q) : 'Quote'}</b></div>`).join('');
    $('#checkoutTotals').innerHTML = totalsHtml(t);
    updatePaymentUi();
  }
  function bankRow(label, value) {
    return `<div class="bank-row"><span>${label}</span><b>${esc(value || '—')}</b>${value ? `<button type="button" class="copy" data-copy="${esc(value)}" aria-label="Copy ${label}">Copy</button>` : ''}</div>`;
  }
  function renderBank() {
    const s = config.settings || {}, has = s.accountNumber || s.bankName;
    $('#panelBank').innerHTML = `<div class="bank-card"><div class="bank-head"><span>🏦</span><div><b>Bank transfer details</b><small>${has ? 'Transfer the total, then upload your slip on your tracking page.' : 'Bank details will be confirmed by our team.'}</small></div></div>${has ? bankRow('Bank', s.bankName) + bankRow('Account name', s.accountName) + bankRow('Account number', s.accountNumber) + bankRow('Branch', s.bankBranch) : '<p class="bank-empty">Place your order and we will share the account details on your private tracking page and by phone.</p>'}</div><ol class="steps-mini"><li>Place your order. You get an order number and private tracking link.</li><li>Transfer the total using the order number as the payment reference.</li><li>Upload your bank slip on the tracking page. We verify and confirm.</li></ol>`;
  }
  function updatePaymentUi() {
    const card = method() === 'card';
    $('#panelBank').hidden = card; $('#panelCard').hidden = !card;
    form.querySelectorAll('.pay-tile').forEach(t => t.classList.toggle('selected', t.querySelector('input').checked));
    const ok = cardAvailable(), note = $('#cardNote'), btn = $('#placeOrder');
    if (card) {
      note.className = 'pay-note ' + (ok ? 'info' : 'warn');
      note.innerHTML = ok ? '🔒 For your security, your card is charged on PayHere’s secure page right after you place the order. Card details typed here stay in this browser and are never stored or sent to our server.'
        : (!config.cardEnabled ? '⚠️ Card payments are not active yet. Please choose <b>Bank transfer</b> to place your order now.' : '⚠️ Card payment needs a fixed price. Your basket has items our team will quote, so please choose <b>Bank transfer</b> and we will confirm your total.');
    }
    btn.disabled = !cart.length || (card && !ok);
    btn.innerHTML = card ? (ok ? 'Continue to secure payment <span>→</span>' : 'Card unavailable') : 'Place order <span>→</span>';
  }
  function setErr(input, msg) { const fe = input.closest('label') && input.closest('label').querySelector('.fe'); if (fe) fe.textContent = msg || ''; input.classList.toggle('bad', !!msg); }
  function openCheckout() {
    if (!cart.length) return toast('Add a POS system, device or service first.');
    closeCart(); renderSummary(); renderBank(); openModal($('#checkoutModal'));
    $('#checkoutModal .modal').scrollTop = 0;
  }

  // live card preview (browser only – never posted)
  const cc = { num: $('#cardNumber'), name: $('#cardName'), exp: $('#cardExp'), cvv: $('#cardCvv'), card: $('#ccCard') };
  const brandOf = n => /^4/.test(n) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(n) ? 'MASTERCARD' : /^3[47]/.test(n) ? 'AMEX' : /^(62|81)/.test(n) ? 'UNIONPAY' : '';
  const luhn = n => { let s = 0, alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return n.length >= 13 && s % 10 === 0; };
  function updateCard() {
    const raw = digits(cc.num.value).slice(0, 19), b = brandOf(raw), amex = b === 'AMEX';
    const groups = amex ? [4, 6, 5] : [4, 4, 4, 4, 3]; let out = [], i = 0;
    for (const g of groups) { if (i >= raw.length) break; out.push(raw.slice(i, i + g)); i += g; }
    cc.num.value = out.join(' ');
    const pattern = amex ? '•••• •••••• •••••' : '•••• •••• •••• ••••', typed = out.join(' ');
    $('#ccNum').textContent = typed + pattern.slice(typed.length);
    $('#ccBrand').textContent = b || 'CARD'; cc.card.dataset.brand = b.toLowerCase();
    $('#ccName').textContent = cc.name.value.trim().toUpperCase() || 'FULL NAME';
    $('#ccExp').textContent = cc.exp.value || 'MM/YY';
    $('#ccCvv').textContent = cc.cvv.value || (amex ? '••••' : '•••');
    const err = $('#cardNumErr');
    if (raw.length >= 13 && !luhn(raw)) err.textContent = 'This card number does not look right.'; else err.textContent = raw.length >= 13 ? '✓ Card number looks valid' : '';
    err.classList.toggle('ok', raw.length >= 13 && luhn(raw));
  }
  cc.num.addEventListener('input', updateCard);
  cc.name.addEventListener('input', () => { cc.name.value = cc.name.value.replace(/[^A-Za-z .'-]/g, ''); updateCard(); });
  cc.exp.addEventListener('input', () => { let v = digits(cc.exp.value).slice(0, 4); if (v.length === 1 && +v > 1) v = '0' + v; if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2); cc.exp.value = v; updateCard(); });
  cc.cvv.addEventListener('input', () => { cc.cvv.value = digits(cc.cvv.value).slice(0, 4); updateCard(); });
  cc.cvv.addEventListener('focus', () => cc.card.classList.add('flip')); cc.cvv.addEventListener('blur', () => cc.card.classList.remove('flip'));
  const clearCard = () => { [cc.num, cc.name, cc.exp, cc.cvv].forEach(i => { i.value = ''; }); updateCard(); };

  form.addEventListener('change', e => { if (e.target.name === 'payment') updatePaymentUi(); });
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const done = () => { b.textContent = 'Copied ✓'; setTimeout(() => { b.textContent = 'Copy'; }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, () => toast('Press and hold to copy.')); else toast('Press and hold to copy.');
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(form), pm = method();
    const get = k => String(d.get(k) || '').trim();
    let bad = null;
    const fail = (name, msg) => { const el = form.elements[name]; setErr(el, msg); if (!bad) bad = el; };
    ['name', 'phone', 'email', 'address', 'city'].forEach(k => setErr(form.elements[k], ''));
    if (get('name').length < 2) fail('name', 'Enter your name.');
    if (digits(get('phone')).length < 7 || digits(get('phone')).length > 15) fail('phone', 'Enter a valid phone number.');
    if (get('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email'))) fail('email', 'Enter a valid email.');
    if (pm === 'card') { if (!get('email')) fail('email', 'Email is needed for card payment.'); if (!get('address')) fail('address', 'Address is needed for card payment.'); if (!get('city')) fail('city', 'City is needed.'); }
    if (bad) { bad.focus(); return toast('Please check the highlighted fields.'); }
    if (pm === 'card' && !cardAvailable()) return toast('Card payment is not available for this basket. Please choose bank transfer.');
    const cats = $$('#bizCats input:checked').map(i => i.value), btn = $('#placeOrder');
    btn.disabled = true;
    try {
      const v = await api('orders', 'POST', { name: get('name'), phone: get('phone'), email: get('email'), business: get('business'), address: get('address'), city: get('city'), businessType: get('businessType'), businessCategories: cats, paymentMethod: pm, items: cart.map(l => ({ id: l.id, qty: l.qty })) }, 'Placing your order…');
      localStorage.setItem('omnistaq_order_' + v.order.ref, v.token);
      clearCard(); cart = []; persistCart();
      if (v.checkout) {
        const pay = document.createElement('form'); pay.action = v.checkout.action; pay.method = 'POST';
        for (const [k, val] of Object.entries(v.checkout.fields)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = val; pay.append(i); }
        document.body.append(pay); window.OmniLoader && window.OmniLoader.show('Opening secure payment…'); pay.submit(); return;
      }
      window.OmniLoader && window.OmniLoader.show('Opening your order…');
      location.href = `order.html?ref=${encodeURIComponent(v.order.ref)}#token=${encodeURIComponent(v.token)}`;
    } catch (err) { toast(err.message); updatePaymentUi(); }
  });

  /* ---------------- settings / campaign ---------------- */
  function renderSettings() {
    const s = config.settings;
    if (s.heroImage) { $('#heroRealImage').src = OMNI.url(s.heroImage); $('#heroReal').hidden = false; $('.hero-art').classList.add('has-real'); }
    else { $('#heroReal').hidden = true; $('.hero-art').classList.remove('has-real'); }
    for (const [key, id] of [['setupText', '#setupAnswer'], ['updateText', '#updateAnswer']]) if (s[key]) $(id).textContent = s[key];
    if (s.demoVideo) { try { const url = new URL(s.demoVideo); if (url.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com'].includes(url.hostname)) { const a = $('#demoVideoLink'); a.href = url.href; a.hidden = false; } } catch {} }
  }
  function renderCampaign() {
    const c = config.campaign, seenKey = 'omnistaq_promo_' + (c.version || 'v');
    if (!c.active || sessionStorage.getItem(seenKey)) return;
    $('#promoTitle').textContent = c.title || 'A special offer for your business'; $('#promoMessage').textContent = c.message || '';
    $('#promoDiscount').textContent = c.discountText || 'SPECIAL OFFER'; $('#promoCtaText').textContent = c.ctaLabel || 'Claim this offer';
    if (c.image) { $('#promoImage').src = OMNI.url(c.image); $('#promoImage').classList.add('has-image'); } else $('#promoImageWrap').classList.add('placeholder');
    setTimeout(() => { if (!document.querySelector('.modal-backdrop.show')) openModal($('#promoModal')); sessionStorage.setItem(seenKey, '1'); }, 1800);
    $('#promoCta').onclick = () => { closeModal($('#promoModal')); wa(`👋 Hello OmniStaq team!\n\nI saw your offer on the website 🎁\n🏷️ *${c.discountText || 'Special offer'}*\n\nCould you please tell me more about it? 😊\n\nThank you! 🙏`); };
  }
  function render() { renderTabs(); renderProducts(); renderCompare(); persistCart(); renderSettings(); renderCampaign(); }

  /* ---------------- wiring ---------------- */
  $('#bizType').innerHTML = BIZ_TYPES.map(t => `<option>${esc(t)}</option>`).join('');
  $('#bizCats').innerHTML = BIZ_CATS.map(c => `<label class="chip"><input type="checkbox" value="${esc(c)}"><span>${esc(c)}</span></label>`).join('');

  $('#catTabs').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; filter = b.dataset.kind; renderTabs(); renderProducts(); });
  let searchTimer; $('#catSearch').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { query = e.target.value; renderProducts(); }, 120); });
  $('#productGrid').addEventListener('click', e => {
    const t = e.target.closest('[data-add],[data-inc],[data-dec],[data-details]'); if (!t) return;
    if (t.dataset.add) setQty(t.dataset.add, 1, true);
    else if (t.dataset.inc) setQty(t.dataset.inc, qtyOf(t.dataset.inc) + 1);
    else if (t.dataset.dec) setQty(t.dataset.dec, qtyOf(t.dataset.dec) - 1);
    else openDetails(t.dataset.details);
  });
  $('#cartItems').addEventListener('click', e => {
    const t = e.target.closest('[data-cart-inc],[data-cart-dec],[data-remove]'); if (!t) return;
    const id = t.dataset.cartInc || t.dataset.cartDec || t.dataset.remove;
    setQty(id, t.dataset.remove ? 0 : qtyOf(id) + (t.dataset.cartInc ? 1 : -1));
  });
  $('#cartOpen').onclick = openCart; $('#basketPill').onclick = openCart; $('#cartClose').onclick = closeCart; $('#overlay').onclick = closeCart;
  $('#checkoutBtn').onclick = openCheckout; $('#cartWa').onclick = () => wa(basketMessage());
  $$('.modal-backdrop').forEach(m => { m.addEventListener('click', e => { if (e.target === m) closeModal(m); }); m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(m))); });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; closeCart(); $$('.modal-backdrop.show').forEach(closeModal); });

  $('#demoForm').onsubmit = async e => {
    e.preventDefault(); const f = e.currentTarget, d = new FormData(f), btn = f.querySelector('button'); btn.disabled = true;
    try { const v = await api('demos', 'POST', { name: d.get('name'), phone: d.get('phone'), business: d.get('business'), shopType: d.get('shopType'), message: d.get('message') }, 'Sending your request…'); $('#demoResult').className = 'form-result ok'; $('#demoResult').textContent = `Request ${v.ref} received. Our team will contact you.`; f.reset(); }
    catch (err) { $('#demoResult').className = 'form-result bad'; $('#demoResult').textContent = err.message; }
    finally { btn.disabled = false; }
  };
  $('#contactWhatsApp').onclick = () => wa(window.OmniWA.msg.contact());
  $('#navWhatsApp').onclick = $('#heroWhatsApp').onclick = $('#stickyWa').onclick = () => wa(hello());
  $('#stickyDemo').onclick = () => { track('cta_demo'); location.hash = '#demo'; };
  $('#menuToggle').onclick = () => { const n = $('.desktop-nav'); n.classList.toggle('open'); $('#menuToggle').setAttribute('aria-expanded', n.classList.contains('open')); };
  $$('.desktop-nav a').forEach(a => a.onclick = () => $('.desktop-nav').classList.remove('open'));
  $('#year').textContent = new Date().getFullYear();

  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
    $$('.feature-tiles article,.steps-v3 article,.section-intro,.demo-form,.contact-card,.payment-card').forEach(el => { el.classList.add('reveal'); io.observe(el); });
  }
  updateCard();
  api('config', 'GET', undefined, 'Loading…').then(v => { config = v; render(); }).catch(err => { toast(err.message); $('#productGrid').innerHTML = `<div class="empty-catalog">Could not load the catalogue. ${esc(err.message)} <a href="">Refresh</a></div>`; });
})();
