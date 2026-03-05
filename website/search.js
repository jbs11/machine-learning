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
