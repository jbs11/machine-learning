/**
 * Site-wide page export: PDF (print), Word, Excel — with snapshot timestamp for daily comparison.
 */
(function (global) {
  'use strict';

  const TZ = 'America/New_York';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatSnapshotEt(d) {
    try {
      return d.toLocaleString('en-US', {
        timeZone: TZ,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }) + ' ET';
    } catch (e) {
      return d.toISOString();
    }
  }

  function fileDateStamp(d) {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return p;
  }

  function findDataTimestamp() {
    const sels = [
      '#lastTs', '#oc-status', '#smsg', '.server-msg', '#rpt-cover-ts',
      '[id*="timestamp"]', '[id*="lastTs"]',
    ];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 8) {
        const t = el.textContent.trim();
        if (!/connecting|loading|polling/i.test(t)) return t;
      }
    }
    return null;
  }

  function pageSlug() {
    const p = (location.pathname || 'page').split('/').pop() || 'page';
    return p.replace(/\.html$/i, '') || 'page';
  }

  function getExportRoot() {
    return (
      document.getElementById('rpt-body') ||
      document.querySelector('.dashboard-wrap') ||
      document.querySelector('.wrap') ||
      document.querySelector('main') ||
      document.querySelector('.hero')?.parentElement ||
      document.body
    );
  }

  function meta() {
    const now = new Date();
    return {
      title: document.title || pageSlug(),
      capturedAt: now,
      capturedLabel: formatSnapshotEt(now),
      fileDate: fileDateStamp(now),
      dataAsOf: findDataTimestamp(),
      url: location.href,
      slug: pageSlug(),
    };
  }

  function logExport(type) {
    try {
      const key = 'pe_export_log_v1';
      const log = JSON.parse(localStorage.getItem(key) || '[]');
      log.unshift({
        page: location.pathname,
        title: document.title,
        type,
        at: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(log.slice(0, 300)));
    } catch (e) { /* ignore */ }
  }

  function ensureSnapshotBanner(m) {
    let el = document.getElementById('pe-snapshot-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pe-snapshot-banner';
      el.className = 'pe-snapshot-banner';
      const root = getExportRoot();
      root.insertBefore(el, root.firstChild);
    }
    el.innerHTML =
      '<h2>Data snapshot (frozen for archive)</h2>' +
      '<p><span class="pe-snap-val">Page:</span> ' + escapeHtml(m.title) + '</p>' +
      '<p><span class="pe-snap-val">Snapshot captured:</span> ' + escapeHtml(m.capturedLabel) + '</p>' +
      (m.dataAsOf
        ? '<p><span class="pe-snap-val">Market data as of:</span> ' + escapeHtml(m.dataAsOf) + '</p>'
        : '<p><span class="pe-snap-val">Market data as of:</span> Same session (see page status bar)</p>') +
      '<p style="font-size:.75rem">Save daily PDF/Word/Excel files and compare side-by-side for learning and trade review.</p>';
    return el;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function canvasesToImages(node) {
    node.querySelectorAll('canvas').forEach((cv) => {
      try {
        const img = document.createElement('img');
        img.src = cv.toDataURL('image/png');
        img.alt = 'Chart snapshot';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        const w = cv.style.width || cv.getAttribute('width');
        if (w) img.style.width = typeof w === 'number' ? w + 'px' : w;
        cv.parentNode.replaceChild(img, cv);
      } catch (e) { /* tainted canvas */ }
    });
  }

  function stripForExport(node) {
    node.querySelectorAll(
      'script, .pe-toolbar, .pe-no-print, .nav, .cdt-toolbar, .cdt-overlay, style[data-pe-ignore]'
    ).forEach((n) => n.remove());
    node.querySelectorAll('[hidden], .oc-loading').forEach((n) => {
      if (n.closest('table')) return;
      n.remove();
    });
  }

  function cloneExportContent() {
    const root = getExportRoot();
    const clone = root.cloneNode(true);
    stripForExport(clone);
    canvasesToImages(clone);
    return clone;
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function siteContentWidthPx() {
    const el = document.querySelector(
      '.section, .page-hero-inner, .dashboard-wrap, .wrap, #rpt-body, ' +
        '[class$="-wrap"]:not(.course-wrap):not(.pe-print-scale-wrap)'
    );
    if (el && el.clientWidth > 200) return el.clientWidth;
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--site-content-max')
      .trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 1200;
  }

  /** Printable width from CSS (letter margins); landscape when body.pe-print-landscape */
  function printableWidthPx() {
    const landscape = document.body.classList.contains('pe-print-landscape');
    const key = landscape ? '--site-print-landscape-px' : '--site-print-width-px';
    const raw = getComputedStyle(document.documentElement).getPropertyValue(key).trim();
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return n;
    return landscape ? 1000 : 720;
  }

  function prepareTablesForPrint() {
    document.body.classList.add('pe-printing');
    cleanupTablesForPrint();

    const tables = Array.from(document.querySelectorAll('table'));
    let needsLandscape = false;
    tables.forEach((tbl) => {
      const tableW = Math.max(tbl.scrollWidth, tbl.offsetWidth, 0);
      const row = tbl.querySelector('tr');
      const cols = row ? row.querySelectorAll('th, td').length : 0;
      const pageW = printableWidthPx();
      if (cols > 8 || tableW > pageW - 24 || tableW > siteContentWidthPx() * 0.92) {
        needsLandscape = true;
      }
    });
    if (needsLandscape) document.body.classList.add('pe-print-landscape');

    const maxW = printableWidthPx();
    tables.forEach((tbl) => {
      const wrap =
        tbl.closest(
          '.oc-table-scroll, .oc-ma-scroll, .oc-of-scroll, .oc-hiv-scroll, .oc-ivr-scroll, .oc-chain-scroll, .tblwrap, [class*="-scroll"]'
        ) || tbl.parentElement;
      if (wrap) wrap.classList.add('pe-print-unclip');

      const tableW = Math.max(tbl.scrollWidth, tbl.offsetWidth, 0);
      if (tableW > maxW + 20) {
        const scale = Math.max(0.52, Math.min(0.98, (maxW - 16) / tableW));
        let box = tbl.parentElement;
        if (!box || !box.classList.contains('pe-print-scale-wrap')) {
          box = document.createElement('div');
          box.className = 'pe-print-scale-wrap';
          tbl.parentNode.insertBefore(box, tbl);
          box.appendChild(tbl);
        }
        box.style.setProperty('--pe-print-scale', String(scale));
        tbl.classList.add('pe-print-scaled-table');
      }
    });
  }

  function cleanupTablesForPrint() {
    document.body.classList.remove('pe-printing', 'pe-print-landscape');
    document.querySelectorAll('.pe-print-unclip').forEach((el) => el.classList.remove('pe-print-unclip'));
    document.querySelectorAll('.pe-print-scaled-table').forEach((tbl) => {
      tbl.classList.remove('pe-print-scaled-table');
      const box = tbl.parentElement;
      if (box && box.classList.contains('pe-print-scale-wrap') && box.parentNode) {
        box.parentNode.insertBefore(tbl, box);
        box.remove();
      }
    });
  }

  function printFullPage() {
    const m = meta();
    document.body.classList.add('pe-export-prep');
    ensureSnapshotBanner(m);
    prepareTablesForPrint();
    logExport('pdf-full');
    const cleanup = () => {
      document.body.classList.remove('pe-export-prep');
      cleanupTablesForPrint();
    };
    if ('onafterprint' in window) {
      window.addEventListener('afterprint', cleanup, { once: true });
    } else {
      setTimeout(cleanup, 2000);
    }
    window.print();
  }

  /* ── Region select → preview → print / reselect / cancel ── */
  const regionState = {
    overlay: null,
    box: null,
    preview: null,
    drag: null,
    rect: null,
    exportViewport: null,
    keyHandler: null,
  };

  function normalizeClientRect(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    return { left, top, width, height };
  }

  function teardownRegionUi() {
    document.body.classList.remove('pe-region-selecting');
    window.removeEventListener('mousemove', regionOnMove);
    window.removeEventListener('mouseup', regionOnUp);
    if (regionState.keyHandler) {
      window.removeEventListener('keydown', regionState.keyHandler);
      regionState.keyHandler = null;
    }
    if (regionState.overlay) {
      regionState.overlay.remove();
      regionState.overlay = null;
      regionState.box = null;
    }
    if (regionState.preview) {
      regionState.preview.remove();
      regionState.preview = null;
    }
    regionState.drag = null;
    regionState.rect = null;
    regionState.exportViewport = null;
  }

  function isRegionChrome(el) {
    return !!el.closest(
      '.nav, #pe-toolbar, .pe-no-print, #pe-region-overlay, #pe-region-preview, ' +
        '#pe-region-capture-busy, script, style, noscript'
    );
  }

  function removeSelectionOverlay() {
    if (regionState.overlay) {
      regionState.overlay.remove();
      regionState.overlay = null;
      regionState.box = null;
    }
    document.body.classList.remove('pe-region-selecting');
  }

  const PE_CARD_SELECTORS =
    '.ghm-card, .ty-card, .flow-card, .oc-panel, .panel, .info-card, .course-card, ' +
    '.concept-card, .illus-card, .gex-card, .trade-card';

  const PE_CHART_HOST_SELECTORS =
    '.ty-chart, .ghm-canvas-wrap, .ghm-chart, #chart-container, .chart-wrap, .cdt-chart-slot';

  const PE_CLIP_DENY =
    '.ghm-grid, .wrap, .dashboard-wrap, .ghm-wrap, .section, .hero, ' +
    '[class$="-wrap"], [class$="-grid"], main, body, html';

  function rectOverlapArea(a, b) {
    const x1 = Math.max(a.left, b.left);
    const y1 = Math.max(a.top, b.top);
    const x2 = Math.min(a.left + a.width, b.left + b.width);
    const y2 = Math.min(a.top + a.height, b.top + b.height);
    if (x2 <= x1 || y2 <= y1) return 0;
    return (x2 - x1) * (y2 - y1);
  }

  function rectFullyContains(outer, inner) {
    return (
      outer.left <= inner.left + 2 &&
      outer.top <= inner.top + 2 &&
      outer.right >= inner.left + inner.width - 2 &&
      outer.bottom >= inner.top + inner.height - 2
    );
  }

  function isClipDenied(el) {
    return !!el.matches(PE_CLIP_DENY);
  }

  /** Best overlapping card (GEX heat map tile, flow card, etc.) — not just center point. */
  function findCardForSelection(rect) {
    const selArea = Math.max(1, rect.width * rect.height);
    let bestCard = null;
    let bestOverlap = 0;

    document.querySelectorAll(PE_CARD_SELECTORS).forEach((card) => {
      if (isRegionChrome(card)) return;
      const cr = card.getBoundingClientRect();
      const overlap = rectOverlapArea(rect, cr);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestCard = card;
      }
    });

    if (!bestCard) return null;
    const cardArea = Math.max(1, bestCard.getBoundingClientRect().width * bestCard.getBoundingClientRect().height);
    if (bestOverlap >= selArea * 0.22 || bestOverlap >= cardArea * 0.3) return bestCard;
    return null;
  }

  function selectionHasCanvas(rect) {
    let hit = false;
    document.querySelectorAll('canvas').forEach((cv) => {
      if (rectOverlapArea(rect, cv.getBoundingClientRect()) > 4) hit = true;
    });
    return hit;
  }

  /** Smallest chart-bearing block that overlaps the selection (any page). */
  function findChartContainerForSelection(rect) {
    const selArea = Math.max(1, rect.width * rect.height);
    let best = null;
    let bestScore = -Infinity;

    document.querySelectorAll('canvas').forEach((cv) => {
      if (rectOverlapArea(rect, cv.getBoundingClientRect()) < 1) return;
      let node = cv.parentElement;
      for (let d = 0; d < 16 && node && node !== document.body; d++, node = node.parentElement) {
        if (isRegionChrome(node) || isClipDenied(node)) break;
        const r = node.getBoundingClientRect();
        const overlap = rectOverlapArea(rect, r);
        if (overlap < selArea * 0.2) continue;
        const score = overlap / selArea - (r.width * r.height) / selArea / 12;
        if (node.matches(PE_CARD_SELECTORS)) score += 0.5;
        if (score > bestScore) {
          bestScore = score;
          best = node;
        }
      }
    });
    return best;
  }

  /** Smallest ancestor of `start` that fully contains the selection (not grid/page wrappers). */
  function innermostClipRoot(start, rect) {
    let node = start;
    while (node && node !== document.body && node !== document.documentElement) {
      if (!isRegionChrome(node) && !isClipDenied(node)) {
        const r = node.getBoundingClientRect();
        if (rectFullyContains(r, rect)) return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function findClipRoot(rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const selArea = rect.width * rect.height;

    const card = findCardForSelection(rect);
    if (card) return card;

    let start = document.elementFromPoint(cx, cy);
    if (start && !isRegionChrome(start)) {
      const inner = innermostClipRoot(start, rect);
      if (inner) return inner;
    }

    const candidates = [];
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const x = rect.left + (rect.width * i) / 4;
        const y = rect.top + (rect.height * j) / 4;
        document.elementsFromPoint(x, y).forEach((el) => {
          if (isRegionChrome(el) || isClipDenied(el)) return;
          let node = el;
          for (let d = 0; d < 14 && node; d++, node = node.parentElement) {
            if (isRegionChrome(node) || isClipDenied(node)) break;
            if (!candidates.includes(node)) candidates.push(node);
          }
        });
      }
    }

    let best = null;
    let bestScore = -Infinity;
    candidates.forEach((el) => {
      const r = el.getBoundingClientRect();
      const overlap = rectOverlapArea(rect, r);
      if (overlap < selArea * 0.5) return;
      const elArea = Math.max(1, r.width * r.height);
      const overlapRatio = overlap / selArea;
      const snug = overlap / elArea;
      let score = overlapRatio * 2 + snug * 4;
      if (el.matches(PE_CARD_SELECTORS)) score += 4;
      if (el.matches('table')) score += 2;
      if (elArea > selArea * 3) score -= 2;
      if (elArea > selArea * 8) score -= 6;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });

    if (best) return best;

    throw new Error('Could not identify a card or panel in the selected area.');
  }

  function refreshGhmChartPaint(sym) {
    try {
      if (typeof chartInstances !== 'undefined' && chartInstances[sym]) {
        if (chartInstances[sym].drawZones) chartInstances[sym].drawZones();
      }
    } catch (e) { /* page script not ready */ }
  }

  /** Merge every <canvas> intersecting a screen rectangle (exactly what you boxed). */
  function compositeCanvasesInRect(rect, bgColor) {
    const scale = Math.min(2, window.devicePixelRatio || 1.5);
    const w = Math.max(1, Math.ceil(rect.width * scale));
    const h = Math.max(1, Math.ceil(rect.height * scale));
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = bgColor || '#070d18';
    ctx.fillRect(0, 0, w, h);

    let drawn = 0;
    document.querySelectorAll('canvas').forEach((cv) => {
      if (!cv.width || !cv.height) return;
      const cr = cv.getBoundingClientRect();
      if (rectOverlapArea(rect, cr) < 1) return;
      const x = (cr.left - rect.left) * scale;
      const y = (cr.top - rect.top) * scale;
      const dw = cr.width * scale;
      const dh = cr.height * scale;
      try {
        ctx.drawImage(cv, 0, 0, cv.width, cv.height, x, y, dw, dh);
        drawn++;
      } catch (e) { /* skip */ }
    });

    if (!drawn) return null;
    return out.toDataURL('image/png');
  }

  /**
   * Merge every <canvas> inside a chart block into one bitmap (LW charts + overlays).
   */
  function compositeCanvasesInElement(container, bgColor) {
    const box = container.getBoundingClientRect();
    if (box.width < 8 || box.height < 8) return null;

    const scale = Math.min(2, window.devicePixelRatio || 1.5);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.ceil(box.width * scale));
    out.height = Math.max(1, Math.ceil(box.height * scale));
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = bgColor || '#070d18';
    ctx.fillRect(0, 0, out.width, out.height);

    const canvases = container.querySelectorAll('canvas');
    canvases.forEach((cv) => {
      if (!cv.width || !cv.height) return;
      const cr = cv.getBoundingClientRect();
      if (cr.width < 1 || cr.height < 1) return;
      const x = (cr.left - box.left) * scale;
      const y = (cr.top - box.top) * scale;
      const dw = cr.width * scale;
      const dh = cr.height * scale;
      try {
        ctx.drawImage(cv, 0, 0, cv.width, cv.height, x, y, dw, dh);
      } catch (e) { /* skip tainted canvas */ }
    });

    if (canvases.length === 0) return null;
    return out.toDataURL('image/png');
  }

  function appendChartSnapshot(exportRoot, chartEl, label) {
    if (chartEl.closest && chartEl.closest('.ghm-card')) {
      const sym = chartEl.closest('.ghm-card').getAttribute('data-sym');
      if (sym) refreshGhmChartPaint(sym);
    }
    const dataUrl = compositeCanvasesInElement(chartEl, '#070d18');
    if (!dataUrl) {
      throw new Error('Chart not ready — wait for data to load, then try again.');
    }
    const imgWrap = document.createElement('div');
    imgWrap.className = 'pe-chart-snapshot';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = label || 'Chart';
    img.className = 'pe-chart-snapshot-img';
    img.style.width = '100%';
    img.style.display = 'block';
    imgWrap.appendChild(img);
    exportRoot.appendChild(imgWrap);
  }

  function purgeStrayCanvasFromExport(root) {
    root.querySelectorAll('canvas').forEach((c) => c.remove());
    root.querySelectorAll(PE_CHART_HOST_SELECTORS).forEach((el) => {
      if (!el.querySelector('img.pe-chart-snapshot-img')) el.remove();
    });
    root.querySelectorAll('.cdt-wrap').forEach((w) => {
      if (!w.querySelector('img.pe-chart-snapshot-img')) w.remove();
    });
  }

  /** Panel/card with charts: text chrome + exactly ONE merged chart image. */
  function buildChartCardExport(card) {
    if (!card.querySelector('canvas')) {
      throw new Error('Chart not ready — wait for data to load, then try again.');
    }

    const titleEl = card.querySelector('.ty-card-t, .ghm-sym, h2, h3, .panel-title');
    const sym =
      card.getAttribute('data-sym') ||
      (titleEl ? titleEl.textContent.trim().slice(0, 48) : '');
    const exportRoot = document.createElement('div');
    exportRoot.className = 'pe-region-export-card pe-region-viewport-light';
    exportRoot.setAttribute('data-pe-export-mode', 'chart-card');
    if (sym) exportRoot.setAttribute('data-pe-sym', sym);

    Array.from(card.children).forEach((child) => {
      if (!child.querySelector('canvas')) {
        const clone = child.cloneNode(true);
        stripForExport(clone);
        exportRoot.appendChild(clone);
      }
    });

    appendChartSnapshot(exportRoot, card, sym || 'Chart');
    purgeStrayCanvasFromExport(exportRoot);
    return exportRoot;
  }

  /** Drag box over charts (no known card): one image matching the selection pixels. */
  function buildRectCompositeExport(rect) {
    const dataUrl = compositeCanvasesInRect(rect, '#070d18');
    if (!dataUrl) {
      throw new Error('Chart not ready — wait for data to load, then try again.');
    }
    const viewport = document.createElement('div');
    viewport.className = 'pe-region-viewport pe-region-viewport-light';
    viewport.setAttribute('data-pe-export-mode', 'rect-composite');
    viewport.style.width = Math.round(rect.width) + 'px';
    viewport.style.height = Math.round(rect.height) + 'px';
    viewport.style.overflow = 'hidden';
    viewport.style.background = '#070d18';
    viewport.style.boxSizing = 'border-box';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'Selected region';
    img.className = 'pe-chart-snapshot-img';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.display = 'block';
    viewport.appendChild(img);
    return viewport;
  }

  /** Clone DOM and crop to the dragged rectangle (tables, panels — not layered charts). */
  function buildClippedExport(root, rect) {
    const rr = root.getBoundingClientRect();
    const clone = root.cloneNode(true);
    stripForExport(clone);

    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const viewport = document.createElement('div');
    viewport.className = 'pe-region-viewport pe-region-viewport-light';
    viewport.style.width = w + 'px';
    viewport.style.height = h + 'px';
    viewport.style.overflow = 'hidden';
    viewport.style.position = 'relative';
    viewport.style.background = '#fff';
    viewport.style.boxSizing = 'border-box';

    const inner = document.createElement('div');
    inner.className = 'pe-region-viewport-inner';
    inner.style.position = 'relative';
    inner.style.marginTop = Math.round(-(rect.top - rr.top)) + 'px';
    inner.style.marginLeft = Math.round(-(rect.left - rr.left)) + 'px';
    inner.appendChild(clone);
    viewport.appendChild(inner);
    const sym = root.getAttribute && root.getAttribute('data-sym');
    if (sym) viewport.setAttribute('data-pe-sym', sym);
    return viewport;
  }

  function buildRegionViewport(rect) {
    removeSelectionOverlay();

    const card = findCardForSelection(rect) || findChartContainerForSelection(rect);
    if (card && card.querySelector('canvas')) {
      return buildChartCardExport(card);
    }

    if (selectionHasCanvas(rect)) {
      return buildRectCompositeExport(rect);
    }

    const root = findClipRoot(rect);
    if (root.querySelector && root.querySelector('canvas')) {
      return buildChartCardExport(root);
    }

    return buildClippedExport(root, rect);
  }

  function assetHref(file) {
    try {
      return new URL(file, location.href).href;
    } catch (e) {
      return file;
    }
  }

  function openRegionPrintWindow(viewport, m) {
    const w = window.open('', '_blank');
    if (!w) {
      alert('Pop-up blocked. Allow pop-ups for this site to print the selected region.');
      return;
    }
    const title = escapeHtml(m.title);
    const captured = escapeHtml(m.capturedLabel);
    const dataAsOf = m.dataAsOf ? escapeHtml(m.dataAsOf) : 'Same session (see page status)';
    const sym = viewport.getAttribute('data-pe-sym');
    const bodyHtml = viewport.outerHTML;

    w.document.open();
    w.document.write(
      '<!DOCTYPE html><html class="theme-light" lang="en"><head><meta charset="utf-8"><title>' +
      title +
      '</title><link rel="stylesheet" href="' +
      assetHref('style.css') +
      '"><link rel="stylesheet" href="' +
      assetHref('page-export.css') +
      '"><style>' +
      '@page{margin:0.45in 0.4in;size:letter portrait}' +
      'body{margin:0;padding:12px;background:#fff;color:#111}' +
      '.pe-region-print-hdr{margin:0 0 12px;padding:10px 12px;border:1px solid #0e7eb0;background:#e8f6fc;border-radius:6px;font-size:11px}' +
      '.pe-region-print-hdr h1{margin:0 0 6px;font-size:14px}' +
      '.pe-region-export-card,.pe-region-viewport,.pe-ghm-chart-snapshot{max-width:100%;page-break-inside:avoid;break-inside:avoid}' +
      '.pe-chart-snapshot-img,.pe-ghm-snapshot-img{width:100%;height:auto;display:block;page-break-inside:avoid;break-inside:avoid}' +
      '.pe-chart-snapshot{background:#070d18;line-height:0}' +
      '.pe-region-export-card .ghm-chart,.pe-region-export-card .ghm-cvd,.pe-region-export-card .ty-chart,.pe-region-export-card canvas,.cdt-toolbar{display:none!important}' +
      '.cdt-overlay,.nav,.pe-toolbar{display:none!important}' +
      '</style></head><body class="pe-region-print-doc">' +
      '<div class="pe-region-print-hdr"><h1>' +
      title +
      '</h1>' +
      (sym ? '<p><b>Asset:</b> ' + escapeHtml(sym) + '</p>' : '') +
      '<p><b>Snapshot:</b> ' +
      captured +
      '</p><p><b>Data as of:</b> ' +
      dataAsOf +
      '</p></div>' +
      bodyHtml +
      '<script>setTimeout(function(){window.focus();window.print()},600);' +
      'window.onafterprint=function(){window.close()};<' +
      '/script></body></html>'
    );
    w.document.close();
    logExport('pdf-region');
  }

  function showCaptureBusy() {
    const el = document.createElement('div');
    el.id = 'pe-region-capture-busy';
    el.className = 'pe-region-capture-busy pe-no-print';
    el.textContent = 'Preparing preview…';
    document.body.appendChild(el);
    return el;
  }

  function openPreviewModal(rect, viewport, sym) {
    const modal = document.createElement('div');
    modal.id = 'pe-region-preview';
    modal.className = 'pe-region-preview pe-no-print';
    modal.innerHTML =
      '<div class="pe-region-preview-card" role="dialog" aria-labelledby="pe-region-preview-title">' +
      '<div class="pe-region-preview-hdr">' +
      '<div><h3 id="pe-region-preview-title">Print preview</h3>' +
      '<div class="pe-region-preview-meta" id="pe-region-preview-meta">Selected area · ' +
      Math.round(rect.width) + ' × ' + Math.round(rect.height) + ' px</div></div>' +
      '</div>' +
      '<div class="pe-region-preview-body"></div>' +
      '<div class="pe-region-preview-actions">' +
      '<button type="button" class="pe-btn pe-btn-primary" id="pe-region-btn-print">Print selection</button>' +
      '<button type="button" class="pe-btn" id="pe-region-btn-reselect">Select again</button>' +
      '<button type="button" class="pe-btn pe-btn-ghost" id="pe-region-btn-cancel">Cancel</button>' +
      '<button type="button" class="pe-btn pe-btn-ghost" id="pe-region-btn-full" title="Print entire page">Full page</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    regionState.preview = modal;

    const metaEl = modal.querySelector('#pe-region-preview-meta');
    if (sym && metaEl) {
      metaEl.textContent = 'Asset: ' + sym + ' · ' + Math.round(rect.width) + ' × ' + Math.round(rect.height) + ' px';
    }

    const bodyEl = modal.querySelector('.pe-region-preview-body');
    const previewClone = viewport.cloneNode(true);
    previewClone.classList.add('pe-region-viewport-preview');
    bodyEl.appendChild(previewClone);

    modal.querySelector('#pe-region-btn-cancel').addEventListener('click', teardownRegionUi);
    modal.querySelector('#pe-region-btn-reselect').addEventListener('click', () => {
      teardownRegionUi();
      startRegionSelect();
    });
    modal.querySelector('#pe-region-btn-full').addEventListener('click', () => {
      teardownRegionUi();
      printFullPage();
    });
    modal.querySelector('#pe-region-btn-print').addEventListener('click', () => {
      const vp = regionState.exportViewport;
      if (!vp) return;
      teardownRegionUi();
      openRegionPrintWindow(vp, meta());
    });
  }

  function showRegionPreview(rect) {
    regionState.rect = rect;
    const busy = showCaptureBusy();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
      try {
        const viewport = buildRegionViewport(rect);
        regionState.exportViewport = viewport;
        busy.remove();
        const sym = viewport.getAttribute('data-pe-sym');
        const isChartExport = viewport.getAttribute('data-pe-export-mode') === 'chart-card';
        const pr = isChartExport
          ? { left: 0, top: 0, width: viewport.offsetWidth || rect.width, height: viewport.offsetHeight || rect.height }
          : rect;
        openPreviewModal(pr, viewport, sym);
      } catch (e) {
        busy.remove();
        alert('Could not prepare this selection. Try Select again or use Full page.');
        startRegionSelect();
      }
      });
    });
  }

  function updateRegionBox(x1, y1, x2, y2) {
    const r = normalizeClientRect(x1, y1, x2, y2);
    const box = regionState.box;
    if (!box) return;
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    box.style.display = r.width > 2 && r.height > 2 ? 'block' : 'none';
  }

  function startRegionSelect() {
    teardownRegionUi();
    document.body.classList.add('pe-region-selecting');

    const overlay = document.createElement('div');
    overlay.id = 'pe-region-overlay';
    overlay.className = 'pe-region-overlay pe-no-print';
    overlay.innerHTML =
      '<div class="pe-region-hint">Drag to select what to print · Esc to cancel</div>' +
      '<div class="pe-region-box" style="display:none"></div>';
    document.body.appendChild(overlay);
    regionState.overlay = overlay;
    regionState.box = overlay.querySelector('.pe-region-box');

    regionState.keyHandler = (e) => {
      if (e.key === 'Escape') teardownRegionUi();
    };
    window.addEventListener('keydown', regionState.keyHandler);

    overlay.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      regionState.drag = { x0: e.clientX, y0: e.clientY, active: true };
      updateRegionBox(e.clientX, e.clientY, e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', regionOnMove);
    window.addEventListener('mouseup', regionOnUp);
  }

  function regionOnMove(e) {
    if (!regionState.drag || !regionState.drag.active) return;
    updateRegionBox(regionState.drag.x0, regionState.drag.y0, e.clientX, e.clientY);
  }

  function regionOnUp(e) {
    if (!regionState.drag || !regionState.drag.active) return;
    regionState.drag.active = false;

    const rect = normalizeClientRect(
      regionState.drag.x0,
      regionState.drag.y0,
      e.clientX,
      e.clientY
    );
    if (rect.width < 28 || rect.height < 28) {
      if (regionState.box) regionState.box.style.display = 'none';
      return;
    }
    showRegionPreview(rect);
  }

  function printPdf() {
    startRegionSelect();
  }

  window.addEventListener('beforeprint', () => {
    if (
      document.getElementById('pe-region-preview') ||
      document.getElementById('pe-region-overlay') ||
      document.body.classList.contains('pe-region-selecting')
    ) {
      return;
    }
    if (!document.body.classList.contains('pe-export-prep')) {
      document.body.classList.add('pe-export-prep');
      ensureSnapshotBanner(meta());
    }
    prepareTablesForPrint();
  });

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('pe-export-prep');
    cleanupTablesForPrint();
  });

  function exportWord() {
    const m = meta();
    const content = cloneExportContent();
    const banner = document.createElement('div');
    banner.className = 'pe-snapshot-banner';
    banner.style.display = 'block';
    banner.innerHTML =
      '<h1 style="font-family:Calibri,Arial,sans-serif">' + escapeHtml(m.title) + '</h1>' +
      '<p><b>Snapshot captured:</b> ' + escapeHtml(m.capturedLabel) + '</p>' +
      (m.dataAsOf ? '<p><b>Data as of:</b> ' + escapeHtml(m.dataAsOf) + '</p>' : '') +
      '<p><b>URL:</b> ' + escapeHtml(m.url) + '</p><hr/>';

    const wrap = document.createElement('div');
    wrap.appendChild(banner);
    wrap.appendChild(content);

    const html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word">' +
      '<head><meta charset="utf-8"><title>' + escapeHtml(m.title) + '</title>' +
      '<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111}' +
      'table{border-collapse:collapse;width:100%;margin:8px 0}' +
      'th,td{border:1px solid #ccc;padding:4px 6px;font-size:10pt}' +
      'th{background:#e8eef5;font-weight:bold}</style></head><body>' +
      wrap.innerHTML +
      '</body></html>';

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    downloadBlob(blob, m.slug + '_' + m.fileDate + '.doc');
    logExport('word');
  }

  function tableHasData(tbl) {
    const rows = tbl.querySelectorAll('tr');
    if (rows.length < 2) return false;
    const text = tbl.innerText || '';
    return text.replace(/\s/g, '').length > 20;
  }

  function collectTables() {
    const tables = Array.from(document.querySelectorAll('table')).filter(tableHasData);
    return tables.slice(0, 12);
  }

  function tableToAoA(tbl) {
    const rows = [];
    tbl.querySelectorAll('tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
        (c.innerText || '').replace(/\s+/g, ' ').trim()
      );
      if (cells.length) rows.push(cells);
    });
    return rows;
  }

  function exportCsvFallback(tables, m) {
    if (!tables.length) {
      alert('No data tables found on this page for Excel export.');
      return;
    }
    if (tables.length === 1) {
      const aoa = tableToAoA(tables[0]);
      const lines = aoa.map((row) =>
        row.map((c) => (String(c).includes(',') ? '"' + String(c).replace(/"/g, '""') + '"' : c)).join(',')
      );
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, m.slug + '_' + m.fileDate + '.csv');
      logExport('excel-csv');
      return;
    }
    tables.forEach((tbl, i) => {
      const aoa = tableToAoA(tbl);
      const lines = aoa.map((row) =>
        row.map((c) => (String(c).includes(',') ? '"' + String(c).replace(/"/g, '""') + '"' : c)).join(',')
      );
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, m.slug + '_' + m.fileDate + '_table' + (i + 1) + '.csv');
    });
    logExport('excel-csv-multi');
  }

  function loadXlsx() {
    return new Promise((resolve, reject) => {
      if (global.XLSX) {
        resolve(global.XLSX);
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = () => resolve(global.XLSX);
      s.onerror = () => reject(new Error('Could not load Excel library'));
      document.head.appendChild(s);
    });
  }

  async function exportExcel() {
    const m = meta();
    const tables = collectTables();
    if (!tables.length) {
      alert('No data tables on this page. Use PDF/Word to capture charts and text.');
      return;
    }
    try {
      const XLSX = await loadXlsx();
      const wb = XLSX.utils.book_new();
      const metaAoA = [
        ['Page', m.title],
        ['Snapshot captured', m.capturedLabel],
        ['Data as of', m.dataAsOf || ''],
        ['URL', m.url],
      ];
      const metaWs = XLSX.utils.aoa_to_sheet(metaAoA);
      XLSX.utils.book_append_sheet(wb, metaWs, 'Snapshot');

      tables.forEach((tbl, i) => {
        const aoa = tableToAoA(tbl);
        if (!aoa.length) return;
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        let name = 'Table' + (i + 1);
        const cap = tbl.closest('.panel, .oc-panel, section, [id]');
        if (cap) {
          const h = cap.querySelector('h2, h3, .ph-title, .oc-ma-hdr h2');
          if (h && h.textContent) {
            name = h.textContent.trim().slice(0, 28).replace(/[\\/*?:\[\]]/g, '');
          }
        }
        XLSX.utils.book_append_sheet(wb, ws, name || 'Table' + (i + 1));
      });

      XLSX.writeFile(wb, m.slug + '_' + m.fileDate + '.xlsx');
      logExport('excel');
    } catch (e) {
      exportCsvFallback(tables, m);
    }
  }

  function hasTables() {
    return collectTables().length > 0;
  }

  function injectToolbar() {
    if (document.getElementById('pe-toolbar')) return;

    const bar = document.createElement('div');
    bar.id = 'pe-toolbar';
    bar.className = 'pe-toolbar pe-no-print';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Export snapshot');
    bar.innerHTML =
      '<span class="pe-toolbar-label">Snapshot</span>' +
      '<button type="button" class="pe-btn pe-btn-primary" id="pe-btn-pdf" title="Drag to select an area, preview, then print">PDF</button>' +
      '<button type="button" class="pe-btn" id="pe-btn-word" title="Word document">Word</button>' +
      '<button type="button" class="pe-btn" id="pe-btn-xls" title="Excel workbook from tables">Excel</button>';

    document.body.appendChild(bar);

    document.getElementById('pe-btn-pdf').addEventListener('click', printPdf);
    document.getElementById('pe-btn-word').addEventListener('click', exportWord);
    document.getElementById('pe-btn-xls').addEventListener('click', () => exportExcel());

    const xbtn = document.getElementById('pe-btn-xls');
    const syncExcel = () => {
      const ok = hasTables();
      xbtn.disabled = !ok;
      xbtn.title = ok
        ? 'Excel workbook from tables on this page'
        : 'No tables — Excel disabled on this page';
    };
    syncExcel();
    setTimeout(syncExcel, 3000);
    const obs = new MutationObserver(syncExcel);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectToolbar);
    } else {
      injectToolbar();
    }
  }

  global.PageExport = {
    init,
    printPdf,
    printFullPage,
    startRegionSelect,
    exportWord,
    exportExcel,
    prepareTablesForPrint,
    cleanupTablesForPrint,
    meta,
    formatSnapshotEt,
  };

  init();
})(typeof window !== 'undefined' ? window : globalThis);
