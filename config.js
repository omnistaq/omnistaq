/* OmniStaq front-end settings - the only file you edit for the website address setup.
 *
 * OMNI_API_BASE = web address of the folder where api.php lives (the PHP + MySQL host), ending with "/".
 *   Everything on ONE PHP host (or XAMPP) ........ leave it empty:  ''
 *   Pages on GitHub Pages, PHP on another host ... 'https://www.yourdomain.lk/omnistaq/'
 */
window.OMNI_API_BASE = 'https://omnistaq.github.io/omnistaq/';

window.OMNI = (function () {
  var base = String(window.OMNI_API_BASE || '').trim();
  if (base && !/\/$/.test(base)) base += '/';
  var configError = '';
  if (base) {
    try {
      var parsed = new URL(base);
      if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || /\.php\/?$/i.test(parsed.pathname)) throw new Error();
      if (location.protocol === 'https:' && parsed.protocol !== 'https:') throw new Error();
      base = parsed.href;
    } catch (e) { configError = 'Invalid OMNI_API_BASE. Use the HTTPS folder address of your PHP host, not api.php or a MySQL address.'; }
  }
  if (!base && /\.github\.io$/i.test(location.hostname)) configError = 'PHP backend is not configured. Set OMNI_API_BASE in config.js to your HTTPS PHP hosting folder. GitHub Pages cannot run PHP/MySQL.';
  if (location.protocol === 'file:') configError = 'Open this website using HTTP/HTTPS hosting, not by double-clicking the HTML file.';
  var remote = false;
  try { remote = !!base && new URL(base, location.href).origin !== location.origin; } catch (e) {}
  var page = (location.pathname.split('/').pop() || '').toLowerCase();
  // The admin panel needs cookies, so it must run on the PHP host itself (browsers block cross-site cookies).
  if (!configError && remote && (page === 'admin.html' || page === 'setup.html')) location.replace(base + page);
  return {
    version: '4.0.0',
    configError: configError,
    request: async function (path, options) {
      if (configError) throw new Error(configError);
      var target = base + 'api.php?r=' + path;
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 45000);
      try {
        var response;
        try { response = await fetch(target, Object.assign({}, options || {}, {signal: controller.signal, cache: 'no-store'})); }
        catch (e) { throw new Error(e.name === 'AbortError' ? 'PHP backend timed out. Check PHP hosting and MySQL, then retry.' : 'Cannot reach the PHP backend at ' + target + '. Check HTTPS, hosting availability and ALLOWED_ORIGINS.'); }
        var body = await response.text(), value;
        try { value = JSON.parse(body); }
        catch (e) { throw new Error('PHP backend returned a non-JSON response (HTTP ' + response.status + ') at ' + target + '. Verify PHP is enabled and api.php is uploaded.'); }
        if (!response.ok || !value || typeof value !== 'object' || Array.isArray(value) || value.error) {
          var err = new Error(value && value.error || 'Backend request failed (HTTP ' + response.status + ').');
          err.status = response.status; throw err;
        }
        return value;
      } finally { clearTimeout(timer); }
    },
    base: base,
    remote: remote,
    api: function (path) { return base + 'api.php?r=' + path; },
    url: function (u) { return !u || /^(https?:|data:|blob:)/i.test(u) ? u : base + u; }
  };
})();

/* Friendly warning when the pages are on GitHub Pages but no PHP backend address was set yet. */
(function () {
  if (OMNI.base || !/\.github\.io$/i.test(location.hostname)) return;
  document.addEventListener('DOMContentLoaded', function () {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#b42318;color:#fff;font:14px/1.4 system-ui,sans-serif;padding:10px 16px;text-align:center';
    d.textContent = 'Backend not connected: open config.js and set OMNI_API_BASE to your PHP + MySQL host (see README.md). Orders, demos and admin need it.';
    document.body.appendChild(d);
  });
})();
