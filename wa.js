/* OmniStaq – shared WhatsApp helper: one place for opening WhatsApp and for every message template.
   WhatsApp formatting used: *bold*  _italic_.  A link placed on its own line gets a rich preview card
   (OmniStaq logo + title) from the page's og: tags – that is how the logo travels with each message. */
(() => {
  'use strict';
  const LINE = '━━━━━━━━━━━━━━';
  const HEAD = `✨ *OmniStaq POS* ✨\n${LINE}`;
  const SIGN = 'Warm regards,\n*OmniStaq POS Team* 🤝';
  const rs = n => 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  const first = n => String(n || '').trim().split(/\s+/)[0] || 'there';
  const label = s => String(s || '').replaceAll('_', ' ');
  const mobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  const siteUrl = () => { try { return new URL('.', location.href).href; } catch { return ''; } };
  const join = parts => parts.filter(p => p !== null && p !== undefined && p !== false).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  /* Opens the WhatsApp app directly; WhatsApp Web only if the app does not take over. */
  function open(number, text) {
    const n = String(number || '').replace(/\D/g, '');
    const t = encodeURIComponent(text || ''), m = mobile();
    const app = `whatsapp://send?phone=${n}&text=${t}`;
    const web = `https://${m ? 'api' : 'web'}.whatsapp.com/send?phone=${n}&text=${t}`;
    let left = false; const mark = () => { left = true; };
    const off = () => { window.removeEventListener('blur', mark); window.removeEventListener('pagehide', mark); document.removeEventListener('visibilitychange', mark); };
    window.addEventListener('blur', mark); window.addEventListener('pagehide', mark); document.addEventListener('visibilitychange', mark);
    if (m) location.href = app; else { const a = document.createElement('a'); a.href = app; a.style.display = 'none'; document.body.append(a); a.click(); a.remove(); }
    setTimeout(() => { off(); if (left) return; if (m) location.href = web; else if (!window.open(web, 'omnistaq_whatsapp')) location.href = web; }, 1700);
  }

  /* ---------- customer → OmniStaq (website buttons) ---------- */
  const toTeam = (body, link) => join([HEAD, '', '👋 *Hello OmniStaq team!*', '', body, '', 'Thank you! 🙏', LINE, link === false ? null : `🌐 ${siteUrl()}`]);

  const hello = () => toTeam(join([
    'I am interested in your *POS systems* 🛒 and would like to learn more.', '',
    '🙋 Could you please guide me to the right setup for my business? 😊']));

  const contact = () => toTeam(join([
    'I would like to know more about your *POS system* 💻', '',
    '📌 *I am interested in:*', '▫️ The software', '▫️ Compatible hardware', '▫️ Pricing', '',
    '📞 Please get in touch when you have a moment. 😊']));

  /* lines: [{ name, qty, price }]  (price = unit price or null when quote needed) */
  const basket = (lines, total, quoted) => {
    if (!lines.length) return hello();
    const items = lines.map(l => `▫️ ${l.name} × ${l.qty}${l.price ? ' — ' + rs(l.price * l.qty) : ' — _quote needed_'}`);
    return toTeam(join([
      'I would like a *quote* 🧾 for the following:', '',
      '🛒 *My selection*', ...items, '',
      total ? `💰 *Listed-price total:* ${rs(total)}${quoted ? ` _(+ ${quoted} item${quoted > 1 ? 's' : ''} to be quoted)_` : ''}` : null,
      total ? '' : null,
      '📩 Could you please share the pricing and the next steps? 😊']));
  };

  /* customer on the tracking page → OmniStaq */
  const aboutOrder = o => toTeam(join([
    'I am contacting you about my order 📦', '',
    `🧾 *Order No:* ${o.ref}`,
    `📌 *Status:* ${label(o.status)}`,
    o.amount != null ? `💰 *Amount:* ${rs(o.amount)}` : null, '',
    '🙏 Could you please assist me? 😊']));

  /* ---------- OmniStaq admin → customer ---------- */
  const STATUS = {
    new:              ['🆕 Order received', 'We have received your order 🎉 and our team is reviewing it.\nTo confirm it, please complete the bank transfer and upload your payment slip on your tracking page 🧾'],
    needs_quote:      ['📝 Preparing your quote', 'Our team is preparing a personalised quote for the items you selected.\nWe will share the final price and payment details very shortly ⏳'],
    awaiting_payment: ['💳 Awaiting payment', 'Your order is ready for payment 🙌\nYou will find the payment details on your tracking page. Once paid, please upload your slip there 🧾'],
    proof_submitted:  ['🧾 Payment slip received', 'Thank you! We have received your payment slip and our team is verifying it ⏳\nWe will confirm as soon as it is approved.'],
    paid:             ['✅ Payment confirmed', 'Your payment has been confirmed 🎉\nOur team will contact you shortly to arrange installation and training 🛠️'],
    payment_failed:   ['⚠️ Payment unsuccessful', 'Unfortunately your payment did not go through.\nYou can try again from your tracking page, or reply here and we will gladly help 🤝'],
    cancelled:        ['❌ Order cancelled', 'Your order has been cancelled.\nIf this was unexpected, simply reply to this message and we will sort it out for you 🙏'],
    chargeback:       ['⚠️ Payment reversed', 'We noticed that your payment was reversed by the bank.\nPlease reply to this message so we can resolve it together 🤝'],
  };
  const orderToCustomer = (o, url) => {
    const [st, note0] = STATUS[o.status] || ['📦 Order update', 'Here is the latest update on your order.'];
    const note = (o.status === 'awaiting_payment' && o.payment_method === 'card') ? 'Your order is ready for payment 🙌\nYou can complete your secure card payment from your tracking page 💳' : note0;
    const items = (o.items || []).map(i => `▫️ ${i.name} × ${i.qty || 1}`);
    return join([
      HEAD, '',
      `Hello *${first(o.name)}*! 👋`,
      'Thank you for choosing *OmniStaq POS* 🙏', '',
      `🧾 *Order No:* ${o.ref}`,
      `📌 *Status:* ${st}`,
      `💳 *Payment:* ${o.payment_method === 'card' ? 'Card' : 'Bank transfer'}`, '',
      '🛒 *Your selection*', ...items, '',
      `💰 *Total:* ${o.amount == null ? '_To be confirmed with your personalised quote_' : rs(o.amount)}`, '',
      '📝 *What happens next*', note, '',
      '🔗 *Track your order live*',
      '👇 Tap the link — it opens your order directly. No order number or password needed.',
      url,
      '🔒 _This link is private to you. Please do not share it._', '',
      '💬 Any questions? Just reply to this message — we are happy to help!', '',
      LINE, SIGN]);
  };

  const DEMO = {
    new:       'We would love to show you how OmniStaq can make your counter faster and your business days clearer 🚀\n\n📅 When would be a convenient time for a quick walkthrough? Just reply with a day and time that suits you.',
    contacted: 'Just following up on your demo request 😊\n\n📅 Shall we fix a time for your OmniStaq walkthrough? Reply with a day and time that suits you and we will arrange it.',
    scheduled: 'Your demo is all set ✅ We look forward to showing you OmniStaq 🎉\n\nIf you need to reschedule, simply reply to this message.',
    closed:    'Thank you for your time and interest in OmniStaq 🙏\n\nWhenever you are ready to take the next step, we are only a message away 💬',
  };
  const demoToCustomer = d => join([
    HEAD, '',
    `Hello *${first(d.name)}*! 👋`,
    'Thank you for your interest in *OmniStaq POS* 🎯', '',
    `📋 *Request No:* ${d.ref}`,
    d.business ? `🏪 *Business:* ${d.business}${d.shop_type ? ' (' + d.shop_type + ')' : ''}` : (d.shop_type ? `🏪 *Business type:* ${d.shop_type}` : null), '',
    DEMO[d.status] || DEMO.new, '',
    `🌐 ${siteUrl()}`, '',
    LINE, SIGN]);

  window.OmniWA = { open, siteUrl, msg: { hello, contact, basket, aboutOrder, orderToCustomer, demoToCustomer } };
})();
