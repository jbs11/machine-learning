/**
 * search.js — In-page search widget for ML Trading Dashboard
 * Adds a floating search bar (Ctrl+F or 🔍 nav button) that highlights
 * matching text across the entire page with Prev/Next navigation.
 */
(function () {
  'use strict';

  /* ── Constants ───────────────────────────────────────────────────── */
  const CSS = `
    #srch-overlay {
      position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      padding: .6rem 1rem; gap: .5rem;
      background: rgba(8,13,26,.95);
      border-bottom: 1px solid #243058;
      backdrop-filter: blur(8px);
      transform: translateY(-100%);
      transition: transform .22s cubic-bezier(.4,0,.2,1);
    }
    #srch-overlay.srch-open { transform: translateY(0); }
    #srch-input {
      flex: 1; max-width: 480px;
      padding: .42rem .75rem;
      background: #1a2540; color: #e8f4fc;
      border: 1px solid #243058; border-radius: 6px;
      font-size: .92rem; outline: none;
    }
    #srch-input:focus { border-color: #22d3ee; }
    #srch-counter {
      font-size: .82rem; color: #7fa3be; white-space: nowrap;
      min-width: 72px; text-align: right;
    }
    .srch-btn {
      padding: .38rem .7rem; border-radius: 5px; border: none;
      cursor: pointer; font-size: .84rem; font-weight: 600;
      background: #1a2540; color: #e8f4fc;
      border: 1px solid #243058; transition: background .15s;
    }
    .srch-btn:hover { background: #243058; }
    .srch-btn-close {
      background: transparent; border-color: transparent;
      color: #7fa3be; font-size: 1.1rem; padding: .3rem .5rem;
    }
    mark.srch-hit {
      background: rgba(251,191,36,.30); color: inherit;
      border-radius: 2px; padding: 0;
    }
    mark.srch-hit.srch-current {
      background: rgba(251,191,36,.85); color: #080d1a;
    }
    .srch-nav-btn { color: #22d3ee; }
    /* Trigger button in nav */
    .srch-trigger {
      background: none; border: none; cursor: pointer;
      color: #7fa3be; font-size: .88rem; padding: .3rem .5rem;
      transition: color .15s; display: flex; align-items: center; gap: .25rem;
    }
    .srch-trigger:hover { color: #22d3ee; }
  `;

  /* ── State ───────────────────────────────────────────────────────── */
  let hits = [];
  let cur = -1;
  let origBodyPad = '';
  let isOpen = false;

  /* ── DOM refs (set after inject) ─────────────────────────────────── */
  let overlay, inp, counter;

  /* ── Inject CSS ──────────────────────────────────────────────────── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── Inject overlay HTML ─────────────────────────────────────────── */
  function injectOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'srch-overlay';
    overlay.setAttribute('role', 'search');
    overlay.innerHTML = `
      <input id="srch-input" type="search" placeholder="Search this page…" autocomplete="off" spellcheck="false" />
      <span id="srch-counter"></span>
      <button class="srch-btn srch-nav-btn" id="srch-prev" title="Previous (Shift+Enter)">&#8679;</button>
      <button class="srch-btn srch-nav-btn" id="srch-next" title="Next (Enter)">&#8681;</button>
      <button class="srch-btn srch-btn-close" id="srch-close" title="Close (Escape)">&#10005;</button>
    `;
    document.body.insertBefore(overlay, document.body.firstChild);

    inp = document.getElementById('srch-input');
    counter = document.getElementById('srch-counter');

    inp.addEventListener('input', debounce(onSearch, 220));
    inp.addEventListener('keydown', onKey);
    document.getElementById('srch-prev').addEventListener('click', () => navigate(-1));
    document.getElementById('srch-next').addEventListener('click', () => navigate(+1));
    document.getElementById('srch-close').addEventListener('click', close);
  }

  /* ── Inject trigger button into existing nav ─────────────────────── */
  function injectNavButton() {
    const navLinks =
      document.querySelector('.nav-links') ||
      document.querySelector('nav ul') ||
      document.querySelector('header nav');
    if (!navLinks) return;

    const btn = document.createElement('button');
    btn.className = 'srch-trigger';
    btn.title = 'Search this page (Ctrl+F)';
    btn.innerHTML = '<span>🔍</span><span>Search</span>';
    btn.addEventListener('click', () => open());
    navLinks.appendChild(btn);
  }

  /* ── Open / close ────────────────────────────────────────────────── */
  function open(term) {
    if (!isOpen) {
      isOpen = true;
      origBodyPad = document.body.style.paddingTop || '';
      document.body.style.paddingTop = '54px';
      overlay.classList.add('srch-open');
    }
    inp.focus();
    if (term !== undefined) inp.value = term;
    if (inp.value) onSearch();
  }

  function close() {
    isOpen = false;
    overlay.classList.remove('srch-open');
    document.body.style.paddingTop = origBodyPad;
    clearHighlights();
    inp.value = '';
    counter.textContent = '';
    hits = [];
    cur = -1;
  }

  /* ── Search & highlight ──────────────────────────────────────────── */
  function onSearch() {
    clearHighlights();
    hits = [];
    cur = -1;
    const q = inp.value.trim();
    if (!q) { counter.textContent = ''; return; }

    const re = new RegExp(escapeRE(q), 'gi');
    walkText(document.body, re);

    if (hits.length) {
      navigate(+1);
    } else {
      counter.textContent = 'No results';
    }
  }

  /* Walk all text nodes under root, wrapping matches */
  function walkText(root, re) {
    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT',
                          'SELECT', 'OPTION', 'SRCH-OVERLAY', 'MARK']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Skip nodes inside the search overlay itself
        if (overlay.contains(node)) return NodeFilter.FILTER_REJECT;
        // Skip invisible / unwanted tags
        let p = node.parentElement;
        while (p) {
          if (skip.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return re.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
    });

    let node;
    const toReplace = [];
    while ((node = walker.nextNode())) {
      re.lastIndex = 0;
      if (re.test(node.nodeValue)) toReplace.push(node);
    }

    toReplace.forEach(n => {
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      const text = n.nodeValue;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.className = 'srch-hit';
        mark.textContent = m[0];
        frag.appendChild(mark);
        hits.push(mark);
        last = re.lastIndex;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  }

  /* Remove all <mark class="srch-hit"> and restore text nodes */
  function clearHighlights() {
    document.querySelectorAll('mark.srch-hit').forEach(m => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  /* ── Navigation ──────────────────────────────────────────────────── */
  function navigate(dir) {
    if (!hits.length) return;
    if (cur >= 0 && cur < hits.length) hits[cur].classList.remove('srch-current');
    cur = (cur + dir + hits.length) % hits.length;
    hits[cur].classList.add('srch-current');
    hits[cur].scrollIntoView({ behavior: 'smooth', block: 'center' });
    counter.textContent = `${cur + 1} / ${hits.length}`;
  }

  /* ── Key handlers ────────────────────────────────────────────────── */
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); navigate(e.shiftKey ? -1 : +1); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  /* Global Ctrl+F intercept */
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      if (isOpen) { inp.focus(); inp.select(); } else { open(); }
    }
    if (e.key === 'Escape' && isOpen) close();
  });

  /* ── Utilities ───────────────────────────────────────────────────── */
  function escapeRE(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function debounce(fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    injectCSS();
    injectOverlay();
    injectNavButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * cachedFetch — sessionStorage-backed API cache (2-min TTL).
 * Available globally on all pages since search.js is loaded everywhere.
 * Usage: const data = await cachedFetch('/api/market-summary');
 */
/**
 * showPageError — call when API load fails.
 * Sets the sdot to red, shows an error message, and wires the retry button.
 *   showPageError('Connection failed', reloadFn)
 */
window.showPageError = function(msg, retryFn) {
  var dot = document.getElementById('sdot');
  var smsg = document.getElementById('smsg');
  var rbtn = document.getElementById('retry-btn');
  if (dot)  dot.className = 'sdot';            // red dot
  if (smsg) smsg.textContent = msg || 'Connection error — server may be starting up.';
  if (rbtn) {
    rbtn.style.display = 'inline-flex';
    rbtn.onclick = function() {
      rbtn.style.display = 'none';
      if (typeof retryFn === 'function') retryFn();
    };
  }
};

/**
 * hideRetryBtn — call after successful load to hide the retry button.
 */
window.hideRetryBtn = function() {
  var rbtn = document.getElementById('retry-btn');
  if (rbtn) rbtn.style.display = 'none';
};

/**
 * lazyLoad(el, renderFn, rootMargin)
 * ──────────────────────────────────
 * Defers renderFn() until el is near the viewport (IntersectionObserver).
 * Falls back to immediate render if IO not supported.
 * Renders only ONCE — disconnects observer after first intersection.
 *
 * Usage:  lazyLoad(canvasEl, () => drawChart(canvasEl, data));
 */
window.lazyLoad = function lazyLoad(el, renderFn, rootMargin) {
  if (!el) { renderFn(); return; }
  if (!('IntersectionObserver' in window)) { renderFn(); return; }
  var io = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) {
      io.disconnect();
      renderFn();
    }
  }, { rootMargin: rootMargin || '300px 0px' });
  io.observe(el);
};

/**
 * memoize(fn)
 * ───────────
 * Returns a version of fn that caches results by JSON-serialized args.
 * Use for pure, expensive computations (not canvas draws).
 *
 * Usage:  const fastBuildCard = memoize(buildCard);
 */
window.memoize = function memoize(fn) {
  var cache = Object.create(null);
  return function() {
    var key = JSON.stringify(Array.prototype.slice.call(arguments));
    if (key in cache) return cache[key];
    return (cache[key] = fn.apply(this, arguments));
  };
};

/**
 * batchRender(items, renderOne, chunkSize, delayMs)
 * ──────────────────────────────────────────────────
 * Renders items in chunks using setTimeout to yield to the browser between
 * chunks — prevents long tasks from blocking user interaction.
 *
 * Usage:  batchRender(assets, a => drawCard(a), 4, 16);
 */
window.batchRender = function batchRender(items, renderOne, chunkSize, delayMs) {
  chunkSize = chunkSize || 4;
  delayMs   = delayMs   || 16;
  var i = 0;
  function next() {
    var end = Math.min(i + chunkSize, items.length);
    for (; i < end; i++) renderOne(items[i]);
    if (i < items.length) setTimeout(next, delayMs);
  }
  next();
};

window.cachedFetch = (function () {
  'use strict';

  // Per-endpoint client-side TTL (ms)
  // Fundamentals/strategy change slowly — cache longer to avoid cold-start waits
  var TTL_MAP = {
    '/api/fundamentals':      15 * 60 * 1000,  // 15 min — P/E, ratings rarely intraday
    '/api/options-strategy':   8 * 60 * 1000,  // 8 min
    '/api/options-summary':    8 * 60 * 1000,
    '/api/gamma-exposure':     8 * 60 * 1000,
    '/api/option-flows':       8 * 60 * 1000,
    '/api/market-summary':     5 * 60 * 1000,  // 5 min
    '/api/0dte':               5 * 60 * 1000,
  };
  var DEFAULT_TTL = 2 * 60 * 1000;

  // Endpoints stored in localStorage (survive tab close, speed up next session open)
  var LS_KEYS = {
    '/api/fundamentals':    true,
    '/api/options-strategy':true,
    '/api/options-summary': true,
  };

  var SS_PREFIX = 'mltd_cache_';
  var LS_PREFIX = 'mltd_ls_';

  function getStore(url) {
    return LS_KEYS[url.replace(/\?.*$/, '')] ? localStorage : sessionStorage;
  }

  function getTtl(url) {
    var base = url.replace(/\?.*$/, '');
    return TTL_MAP[base] || DEFAULT_TTL;
  }

  function storageKey(url) {
    var store = getStore(url);
    var prefix = store === localStorage ? LS_PREFIX : SS_PREFIX;
    return prefix + url;
  }

  function readCache(url) {
    try {
      var raw = getStore(url).getItem(storageKey(url));
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function writeCache(url, data) {
    try {
      getStore(url).setItem(storageKey(url), JSON.stringify({ ts: Date.now(), data: data }));
    } catch (_) {}
  }

  async function fetchFresh(url, opts) {
    var resp = await fetch(url, Object.assign({ signal: AbortSignal.timeout(15000) }, opts || {}));
    var data = await resp.json();
    writeCache(url, data);
    return data;
  }

  return async function cachedFetch(url, opts) {
    var ttl = getTtl(url);
    var entry = readCache(url);
    if (entry) {
      var age = Date.now() - entry.ts;
      if (age < ttl) {
        // Fresh — return immediately; if > 75% of TTL elapsed, refresh in background
        if (age > ttl * 0.75) fetchFresh(url, opts).catch(function(){});
        return entry.data;
      }
      // Stale but not empty — return stale immediately, refresh in background
      if (age < ttl * 3) {
        fetchFresh(url, opts).catch(function(){});
        return entry.data;
      }
    }
    // No cache or too old — must await fresh data
    return fetchFresh(url, opts);
  };
})();

// ── Theme Toggle ──────────────────────────────────────────────────────────────
(function () {
  'use strict';
  var THEME_KEY = 'ml-theme';

  // Apply saved theme — dark is the project default
  // v2 key resets any stale 'light' preference from prior site conversion
  var THEME_KEY_V2 = 'ml-theme-v2';
  var _saved = localStorage.getItem(THEME_KEY_V2) || 'dark';
  if (_saved === 'light') document.documentElement.classList.add('theme-light');

  // Helper: get current chart colors matching the active theme
  window.getThemeChartColors = function () {
    var lt = document.documentElement.classList.contains('theme-light');
    return {
      bg:    lt ? '#f8fafc'              : '#070d18',
      grid:  lt ? 'rgba(0,0,0,.07)'     : 'rgba(255,255,255,.04)',
      label: lt ? 'rgba(71,85,105,.8)'  : 'rgba(127,163,190,.85)',
      text:  lt ? '#475569'             : '#7fa3be',
    };
  };

  function injectToggleBtn() {
    if (document.getElementById('theme-toggle-btn')) return;
    var pageNav = document.querySelector('.page-nav');
    if (!pageNav) return;

    var lt = document.documentElement.classList.contains('theme-light');
    var btn = document.createElement('button');
    btn.id = 'theme-toggle-btn';
    btn.className = 'theme-toggle-btn';
    btn.title = 'Toggle light / dark theme';
    btn.innerHTML = lt ? '&#127769; Dark' : '&#9728;&#65039; Light';

    btn.addEventListener('click', function () {
      var nowLight = document.documentElement.classList.toggle('theme-light');
      localStorage.setItem(THEME_KEY_V2, nowLight ? 'light' : 'dark');
      btn.innerHTML = nowLight ? '&#127769; Dark' : '&#9728;&#65039; Light';
      // Notify charts to redraw if a page defines this global
      if (typeof window.redrawAllCharts === 'function') window.redrawAllCharts();
    });

    var sep = document.createElement('span');
    sep.className = 'page-nav-sep';
    sep.textContent = '|';
    pageNav.appendChild(sep);
    pageNav.appendChild(btn);
  }

  if (document.readyState !== 'loading') {
    injectToggleBtn();
  } else {
    document.addEventListener('DOMContentLoaded', injectToggleBtn);
  }
})();
