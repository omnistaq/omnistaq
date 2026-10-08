/* OmniStaq loader – outlined "OMNISTAQ" with a glow.
   Shows on every page load / refresh and while the site is processing a request.
   API:  OmniLoader.wrap(promise, 'Placing your order…')   → shows the loader while the promise is pending */
(function () {
  if (window.OmniLoader) return;
  var css = '' +
  '#omni-loader{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:radial-gradient(circle at 50% 42%,#0c2c4d 0,#061a30 55%,#041222 100%);opacity:1;visibility:visible;transition:opacity .4s ease,visibility .4s ease}' +
  '#omni-loader.ol-processing{background:rgba(4,18,34,.88);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}' +
  '#omni-loader.ol-hide{opacity:0;visibility:hidden;pointer-events:none}' +
  '#omni-loader .ol-wrap{text-align:center;padding:0 18px;width:100%}' +
  '#omni-loader .ol-word{position:relative;display:inline-block;font:800 clamp(30px,9.4vw,78px)/1.05 Manrope,"SF Pro Display","Segoe UI",system-ui,-apple-system,sans-serif;letter-spacing:.14em;margin-right:-.14em;color:transparent;-webkit-text-stroke:1.7px #22d7f8;text-stroke:1.7px #22d7f8;filter:drop-shadow(0 0 5px #22d7f8) drop-shadow(0 0 16px rgba(34,215,248,.65));animation:olGlow 2s ease-in-out infinite;user-select:none;-webkit-user-select:none}' +
  '#omni-loader .ol-word::after{content:attr(data-text);position:absolute;left:0;top:0;width:100%;color:transparent;-webkit-text-stroke:2px #fff;text-stroke:2px #fff;-webkit-mask-image:linear-gradient(100deg,transparent 38%,#000 50%,transparent 62%);mask-image:linear-gradient(100deg,transparent 38%,#000 50%,transparent 62%);-webkit-mask-size:260% 100%;mask-size:260% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;animation:olSweep 1.9s linear infinite}' +
  '#omni-loader .ol-bar{width:min(220px,56vw);height:3px;border-radius:3px;background:rgba(34,215,248,.16);margin:26px auto 14px;overflow:hidden}' +
  '#omni-loader .ol-bar i{display:block;height:100%;width:38%;border-radius:3px;background:linear-gradient(90deg,transparent,#22d7f8,#2ee59d,transparent);animation:olBar 1.3s ease-in-out infinite}' +
  '#omni-loader .ol-label{font:600 12px/1.4 "SF Pro Text","Segoe UI",system-ui,-apple-system,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8fb6d0}' +
  '@keyframes olGlow{0%,100%{-webkit-text-stroke-color:#22d7f8;filter:drop-shadow(0 0 4px #22d7f8) drop-shadow(0 0 12px rgba(34,215,248,.5))}50%{-webkit-text-stroke-color:#7ff1ff;filter:drop-shadow(0 0 8px #22d7f8) drop-shadow(0 0 28px rgba(46,229,157,.7))}}' +
  '@keyframes olSweep{from{-webkit-mask-position:130% 0;mask-position:130% 0}to{-webkit-mask-position:-30% 0;mask-position:-30% 0}}' +
  '@keyframes olBar{0%{transform:translateX(-110%)}100%{transform:translateX(290%)}}' +
  '@media (prefers-reduced-motion:reduce){#omni-loader .ol-word,#omni-loader .ol-word::after,#omni-loader .ol-bar i{animation:none}#omni-loader .ol-word::after{display:none}#omni-loader .ol-bar i{width:100%}}';

  var style = document.createElement('style');
  style.id = 'omni-loader-css';
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);

  var el = document.createElement('div');
  el.id = 'omni-loader';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="ol-wrap"><div class="ol-word" data-text="OMNISTAQ">OMNISTAQ</div><div class="ol-bar"><i></i></div><div class="ol-label">Loading…</div></div>';
  document.documentElement.appendChild(el);
  var label = el.querySelector('.ol-label');

  var MIN_FIRST = 900;           // the first screen stays at least this long so the animation is seen
  var MIN_PROCESS = 450;         // a processing overlay never flashes faster than this
  var started = Date.now(), pageLoaded = false, pending = 0, visibleSince = started, hideTimer = 0, showTimer = 0, firstDone = false;

  function show(text, processing) {
    clearTimeout(hideTimer); clearTimeout(showTimer);
    label.textContent = text || 'Loading…';
    el.classList.toggle('ol-processing', !!processing);
    el.classList.remove('ol-hide');
    visibleSince = Date.now();
  }
  function hideNow() { el.classList.add('ol-hide'); }
  function maybeHide() {
    if (pending > 0 || !pageLoaded && !firstDone) return;
    var min = firstDone ? MIN_PROCESS : MIN_FIRST;
    var since = firstDone ? visibleSince : started;
    var wait = Math.max(0, min - (Date.now() - since));
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { firstDone = true; if (pending === 0) hideNow(); }, wait);
  }

  function onLoaded() { pageLoaded = true; maybeHide(); }
  if (document.readyState === 'complete') onLoaded(); else window.addEventListener('load', onLoaded);
  setTimeout(function () { pageLoaded = true; pending = 0; maybeHide(); }, 9000);   // safety net
  // Back/forward cache: show the animation again when a page is restored
  window.addEventListener('pageshow', function (e) { if (e.persisted) { firstDone = false; pageLoaded = true; started = Date.now(); show('Loading…', false); maybeHide(); } });
  // Leaving the page (link click / refresh) – show the loader right away
  window.addEventListener('beforeunload', function () { show('Loading…', false); hideTimer = setTimeout(hideNow, 2500); });   // timer: downloads / app links do not unload the page

  window.OmniLoader = {
    show: function (t) { pending++; show(t || 'Processing…', firstDone); },
    hide: function () { pending = Math.max(0, pending - 1); maybeHide(); },
    wrap: function (promise, text) {
      pending++;
      if (firstDone) {                       // processing: appear only if it takes a moment (no flicker on fast calls)
        clearTimeout(showTimer);
        showTimer = setTimeout(function () { if (pending > 0) show(text || 'Processing…', true); }, 160);
      } else { label.textContent = text || label.textContent; }
      var done = function () { pending = Math.max(0, pending - 1); maybeHide(); };
      promise.then(done, done);
      return promise;
    }
  };
})();
