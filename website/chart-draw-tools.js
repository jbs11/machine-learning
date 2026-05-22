/**
 * chart-draw-tools.js — Drawing toolbar for Lightweight Charts + canvas charts
 */
(function () {
  'use strict';

  if (window.__cdtBootstrapped) return;
  window.__cdtBootstrapped = true;

  var STORAGE_VER = 'cdt-v1';
  var DEFAULT_COLOR = '#fbbf24';
  var DEFAULT_WIDTH = 2;

  /* Only real chart hosts — not chart-ohlc-display, chart-loading, etc. */
  var CHART_SEL = [
    '.ty-chart', '.ghm-chart', '#chart-container',
    '[id^="cv-"]', '.ap-chart', '.lt-chart',
    '.flow-chart', '.vix-chart', '.opt-chart', '.ms-chart',
    '#vd-term-chart', '#vf-chart',
    '#oc-price-chart', '#oc-term-chart', '#oc-pnl-chart', '#oc-pnl-page-chart',
  ].join(',');

  var CHART_ID_DENY = /^(chart-symbol-title|chart-ohlc-display|chart-candle-count|chart-loading|chart-header)$/;

  function uid() {
    return 'd' + Math.random().toString(36).slice(2, 10);
  }

  function injectCss() {
    if (document.getElementById('cdt-styles-inline')) return;
    var st = document.createElement('style');
    st.id = 'cdt-styles-inline';
    st.textContent = [
      '.cdt-wrap{position:relative;width:100%;height:100%;display:flex;flex-direction:column;min-height:0;}',
      '.chart-wrap>.cdt-wrap,.chart-wrap .cdt-wrap{position:absolute;inset:0;height:100%;}',
      '.cdt-chart-slot{position:relative;width:100%;flex:1 1 auto;min-height:0;overflow:hidden;}',
      '.cdt-chart-slot>#chart-container{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;}',
      '.cdt-chart-slot>*:first-child:not(.cdt-overlay){width:100%!important;}',
      '.cdt-overlay{position:absolute;left:0;top:0;width:100%;height:100%;z-index:12;pointer-events:none;}',
      '.cdt-wrap.cdt-draw .cdt-overlay{pointer-events:auto;cursor:crosshair;}',
      '.cdt-wrap.cdt-hand .cdt-overlay{pointer-events:none;}',
      '.cdt-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:3px;padding:4px 6px;',
      'background:#0a1020;border-bottom:1px solid #243058;z-index:20;flex-shrink:0;}',
      '.cdt-toolbar button{border:1px solid #243058;background:#121a2e;color:#94a3b8;border-radius:4px;',
      'padding:3px 7px;font-size:11px;font-weight:700;cursor:pointer;line-height:1.2;min-width:26px;}',
      '.cdt-toolbar button:hover{border-color:#22d3ee;color:#e8f4fc;}',
      '.cdt-toolbar button.cdt-active{background:rgba(34,211,238,.2);border-color:#22d3ee;color:#22d3ee;}',
      '.cdt-toolbar input[type=color]{width:22px;height:22px;padding:0;border:1px solid #243058;border-radius:4px;cursor:pointer;}',
      '.cdt-sep{width:1px;height:14px;background:#243058;margin:0 2px;}',
      '.cdt-mini .cdt-toolbar{padding:2px 4px;}',
      '.cdt-mini .cdt-toolbar button{padding:2px 5px;font-size:10px;min-width:22px;}',
    ].join('');
    document.head.appendChild(st);
  }

  function storageKey(chartId) {
    return STORAGE_VER + ':' + (location.pathname || '/') + ':' + chartId;
  }

  function loadDrawings(chartId) {
    try {
      var raw = localStorage.getItem(storageKey(chartId));
      return raw ? JSON.parse(raw) : [];
    } catch (_e) {
      return [];
    }
  }

  function saveDrawings(chartId, list) {
    try {
      localStorage.setItem(storageKey(chartId), JSON.stringify(list.slice(-200)));
    } catch (_e) {}
  }

  var patchedCharts = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  function patchSeries(chart, state) {
    if (!chart) return;
    if (patchedCharts && patchedCharts.has(chart)) return;
    if (patchedCharts) patchedCharts.add(chart);
    var names = ['addCandlestickSeries', 'addLineSeries', 'addAreaSeries', 'addHistogramSeries', 'addBaselineSeries'];
    names.forEach(function (name) {
      if (typeof chart[name] !== 'function') return;
      var orig = chart[name].bind(chart);
      chart[name] = function () {
        var s = orig.apply(chart, arguments);
        if (s && !state.series) state.series = s;
        return s;
      };
    });
  }

  function setChartPan(chart, enabled) {
    if (!chart || !chart.applyOptions) return;
    try {
      chart.applyOptions({
        handleScroll: { mouseWheel: enabled, pressedMouseMove: enabled, horzTouchDrag: enabled },
        handleScale: { mouseWheel: enabled, pinch: enabled, axisPressedMouseMove: enabled },
      });
    } catch (_e) {}
  }

  function clientToLocal(container, clientX, clientY) {
    var r = container.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function pointFromEvent(chart, series, container, clientX, clientY, mode) {
    var loc = clientToLocal(container, clientX, clientY);
    if (mode === 'canvas' || !chart || !series) {
      return { x: loc.x, y: loc.y, time: null, price: null };
    }
    var time = null;
    var price = null;
    try { time = chart.timeScale().coordinateToTime(loc.x); } catch (_e) {}
    try {
      if (typeof series.coordinateToPrice === 'function') price = series.coordinateToPrice(loc.y);
    } catch (_e2) {}
    return { time: time, price: price, x: loc.x, y: loc.y };
  }

  function coordFromPoint(chart, series, p, mode) {
    if (mode === 'canvas' || !chart || !series) {
      return { x: p.x, y: p.y };
    }
    var x = null;
    var y = null;
    if (p.time != null) {
      try { x = chart.timeScale().timeToCoordinate(p.time); } catch (_e) {}
    }
    if (p.price != null && typeof series.priceToCoordinate === 'function') {
      try { y = series.priceToCoordinate(p.price); } catch (_e2) {}
    }
    if (x == null && p.x != null) x = p.x;
    if (y == null && p.y != null) y = p.y;
    return { x: x, y: y };
  }

  function drawArrowHead(ctx, x1, y1, x2, y2, color, width) {
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var len = Math.max(8, width * 4);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - len * Math.cos(angle - Math.PI / 7), y2 - len * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(x2 - len * Math.cos(angle + Math.PI / 7), y2 - len * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
  }

  function renderOne(ctx, chart, series, d, mode, plotW, plotH) {
    var a = coordFromPoint(chart, series, d.p1 || {}, mode);
    var b = coordFromPoint(chart, series, d.p2 || d.p1 || {}, mode);
    if (a.x == null || a.y == null) return;

    ctx.strokeStyle = d.color || DEFAULT_COLOR;
    ctx.fillStyle = d.color || DEFAULT_COLOR;
    ctx.lineWidth = d.width || DEFAULT_WIDTH;

    var bx = b.x != null ? b.x : a.x;
    var by = b.y != null ? b.y : a.y;

    if (d.type === 'text' && d.text) {
      ctx.font = '600 13px system-ui,sans-serif';
      ctx.fillText(d.text, a.x + 4, a.y - 4);
      return;
    }

    if (d.type === 'line' || d.type === 'arrow') {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (d.type === 'arrow') drawArrowHead(ctx, a.x, a.y, bx, by, d.color || DEFAULT_COLOR, d.width || DEFAULT_WIDTH);
      return;
    }

    if (d.type === 'line-dashed') {
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    var x0 = Math.min(a.x, bx);
    var y0 = Math.min(a.y, by);
    var w = Math.abs(bx - a.x);
    var h = Math.abs(by - a.y);
    if (d.type === 'square') {
      var s = Math.min(w, h);
      w = h = s;
    }
    if (d.type === 'rect' || d.type === 'square') {
      ctx.setLineDash([]);
      ctx.strokeRect(x0, y0, w, h);
      return;
    }
    if (d.type === 'circle') {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(x0 + w / 2, y0 + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function redraw(state) {
    var canvas = state.overlay;
    if (!canvas) return;
    var slot = state.slot || state.container;
    var plotW = slot.clientWidth || 300;
    var plotH = slot.clientHeight || 200;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(plotW * dpr));
    canvas.height = Math.max(1, Math.floor(plotH * dpr));
    canvas.style.width = plotW + 'px';
    canvas.style.height = plotH + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, plotW, plotH);
    var list = state.drawings.slice();
    if (state.preview) list.push(state.preview);
    list.forEach(function (d) {
      renderOne(ctx, state.chart, state.series, d, state.mode, plotW, plotH);
    });
  }

  function buildToolbar(state) {
    var bar = document.createElement('div');
    bar.className = 'cdt-toolbar';
    bar.setAttribute('role', 'toolbar');
    var tools = [
      ['hand', '\u270B', 'Hand \u2014 pan & zoom'],
      ['line', '\u2571', 'Solid line'],
      ['line-dashed', '\u2504', 'Dashed line'],
      ['arrow', '\u2192', 'Arrow'],
      ['rect', '\u25AD', 'Rectangle'],
      ['square', '\u25A1', 'Square'],
      ['circle', '\u25CB', 'Circle'],
      ['text', 'T', 'Text note'],
    ];
    tools.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-tool', t[0]);
      btn.title = t[2];
      btn.textContent = t[1];
      if (t[0] === 'hand') btn.classList.add('cdt-active');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        state.tool = t[0];
        state.preview = null;
        state.wrap.classList.toggle('cdt-hand', t[0] === 'hand');
        state.wrap.classList.toggle('cdt-draw', t[0] !== 'hand');
        bar.querySelectorAll('button[data-tool]').forEach(function (b) {
          b.classList.toggle('cdt-active', b.getAttribute('data-tool') === t[0]);
        });
        if (state.chart) setChartPan(state.chart, t[0] === 'hand');
      });
      bar.appendChild(btn);
    });
    var sep = document.createElement('span');
    sep.className = 'cdt-sep';
    bar.appendChild(sep);
    var color = document.createElement('input');
    color.type = 'color';
    color.value = state.color;
    color.title = 'Color';
    color.addEventListener('input', function () { state.color = color.value; });
    bar.appendChild(color);
    var undo = document.createElement('button');
    undo.type = 'button';
    undo.textContent = '\u21B6';
    undo.title = 'Undo';
    undo.addEventListener('click', function (e) {
      e.stopPropagation();
      state.drawings.pop();
      saveDrawings(state.chartId, state.drawings);
      redraw(state);
    });
    bar.appendChild(undo);
    var clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = '\u232B';
    clear.title = 'Clear all';
    clear.addEventListener('click', function (e) {
      e.stopPropagation();
      if (state.drawings.length && !window.confirm('Clear all drawings on this chart?')) return;
      state.drawings = [];
      saveDrawings(state.chartId, state.drawings);
      redraw(state);
    });
    bar.appendChild(clear);
    return bar;
  }

  function bindOverlay(state) {
    var overlay = state.overlay;
    var dragging = false;

    function onDown(e) {
      if (state.tool === 'hand') return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      var pt = pointFromEvent(state.chart, state.series, state.container, e.clientX, e.clientY, state.mode);
      if (state.tool === 'text') {
        var text = window.prompt('Chart note:', '');
        if (text) {
          state.drawings.push({
            id: uid(), type: 'text', color: state.color, width: DEFAULT_WIDTH,
            p1: pt, p2: pt, text: text,
          });
          saveDrawings(state.chartId, state.drawings);
          redraw(state);
        }
        dragging = false;
        return;
      }
      state.preview = {
        id: uid(), type: state.tool, color: state.color, width: DEFAULT_WIDTH, p1: pt, p2: pt,
      };
      redraw(state);
    }

    function onMove(e) {
      if (!dragging || !state.preview) return;
      e.preventDefault();
      state.preview.p2 = pointFromEvent(state.chart, state.series, state.container, e.clientX, e.clientY, state.mode);
      redraw(state);
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      if (state.preview) {
        state.drawings.push(state.preview);
        state.preview = null;
        saveDrawings(state.chartId, state.drawings);
        redraw(state);
      }
    }

    overlay.addEventListener('mousedown', onDown);
    overlay.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function attachCore(container, opts) {
    if (!container || !(container instanceof Element)) return null;

    var existingWrap = container.closest('.cdt-wrap');
    if (existingWrap) {
      var st = existingWrap.__cdtState || container.__cdtState;
      if (st && opts.chart) {
        st.chart = opts.chart;
        st.mode = 'lwc';
        container.__lwcChart = opts.chart;
        patchSeries(opts.chart, st);
        redraw(st);
      }
      return st;
    }

    injectCss();

    var chartId = container.id || (opts.chartId || ('cdt-' + uid()));
    if (!container.id) container.id = chartId;

    var wrap = document.createElement('div');
    wrap.className = 'cdt-wrap cdt-hand';
    wrap.setAttribute('data-cdt-wrapped', '1');

    var parent = container.parentNode;
    if (!parent) return null;

    parent.insertBefore(wrap, container);
    wrap.appendChild(container);

    var slot = document.createElement('div');
    slot.className = 'cdt-chart-slot';
    wrap.insertBefore(slot, container);
    slot.appendChild(container);

    var h = container.clientHeight || parseInt(container.style.height, 10) || 0;
    if (h > 0 && h < 130) wrap.classList.add('cdt-mini');

    var overlay = document.createElement('canvas');
    overlay.className = 'cdt-overlay';

    var state = {
      wrap: wrap,
      slot: slot,
      container: container,
      overlay: overlay,
      chartId: chartId,
      chart: opts.chart || container.__lwcChart || null,
      series: opts.series || null,
      mode: opts.mode || (opts.chart ? 'lwc' : 'canvas'),
      tool: 'hand',
      color: DEFAULT_COLOR,
      drawings: loadDrawings(chartId),
      preview: null,
    };

    slot.appendChild(overlay);
    state.toolbar = buildToolbar(state);
    wrap.insertBefore(state.toolbar, slot);

    bindOverlay(state);

    if (state.chart) {
      patchSeries(state.chart, state);
      try {
        state.chart.timeScale().subscribeVisibleLogicalRangeChange(function () { redraw(state); });
      } catch (_e) {}
      setChartPan(state.chart, true);
    }

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { redraw(state); }).observe(slot);
    }
    window.addEventListener('resize', function () { redraw(state); });

    wrap.__cdtState = state;
    container.__cdtState = state;
    container.__cdtAttached = true;

    setTimeout(function () { redraw(state); }, 50);
    setTimeout(function () { redraw(state); }, 400);

    return state;
  }

  function attachLightweightChart(chart, container) {
    if (!chart || !container) return null;
    container.__lwcChart = chart;
    var state = attachCore(container, { chart: chart, mode: 'lwc' });
    if (state) patchSeries(chart, state);
    return state;
  }

  function isChartContainer(el) {
    if (!el || el.closest('nav') || el.closest('.cdt-toolbar')) return false;
    if (el.id && CHART_ID_DENY.test(el.id)) return false;
    if (el.closest('.chart-header') && el.id !== 'chart-container') return false;
    if (el.id === 'chart-container') return true;
    if (el.id === 'vd-term-chart' || el.id === 'vf-chart') return true;
    if (el.classList && (
      el.classList.contains('ty-chart') || el.classList.contains('ghm-chart') ||
      el.classList.contains('ap-chart') || el.classList.contains('lt-chart') ||
      el.classList.contains('flow-chart') || el.classList.contains('vix-chart') ||
      el.classList.contains('opt-chart') || el.classList.contains('ms-chart')
    )) return true;
    if (el.id && /^cv-/.test(el.id)) return true;
    if (el.id === 'oc-price-chart' || el.id === 'oc-term-chart' ||
        el.id === 'oc-pnl-chart' || el.id === 'oc-pnl-page-chart') return true;
    return false;
  }

  function chartHostFromWrap(wrap) {
    if (!wrap) return null;
    var slot = wrap.querySelector('.cdt-chart-slot');
    if (!slot) return null;
    for (var i = 0; i < slot.children.length; i++) {
      var ch = slot.children[i];
      if (ch.classList && ch.classList.contains('cdt-overlay')) continue;
      return ch;
    }
    return null;
  }

  function removeWrap(wrap) {
    if (!wrap || !wrap.parentNode) return;
    var host = chartHostFromWrap(wrap);
    if (!host) {
      wrap.remove();
      return;
    }
    wrap.parentNode.insertBefore(host, wrap);
    wrap.remove();
    delete host.__cdtAttached;
    delete host.__cdtState;
    delete host.__lwcChart;
  }

  function cleanupBadWraps() {
    document.querySelectorAll('.cdt-wrap').forEach(function (wrap) {
      var host = chartHostFromWrap(wrap);
      if (!host || !isChartContainer(host)) removeWrap(wrap);
    });
    document.querySelectorAll('.chart-wrap').forEach(function (cw) {
      var wraps = cw.querySelectorAll(':scope > .cdt-wrap');
      if (wraps.length <= 1) return;
      var keep = null;
      wraps.forEach(function (w) {
        var h = chartHostFromWrap(w);
        if (h && h.id === 'chart-container') keep = w;
      });
      if (!keep) keep = wraps[0];
      wraps.forEach(function (w) {
        if (w !== keep) removeWrap(w);
      });
    });
  }

  function scanContainers() {
    injectCss();
    cleanupBadWraps();
    try {
      document.querySelectorAll(CHART_SEL).forEach(function (el) {
        if (!isChartContainer(el)) return;
        if (el.closest('.cdt-wrap')) return;
        if (el.__cdtAttached) return;
        var chart = el.__lwcChart || null;
        attachCore(el, { chart: chart, mode: chart ? 'lwc' : 'canvas' });
      });
    } catch (_e) {}

    document.querySelectorAll('canvas').forEach(function (cv) {
      if (cv.classList.contains('cdt-overlay')) return;
      if (cv.closest('.cdt-wrap') || cv.closest('nav') || cv.closest('.cdt-toolbar')) return;
      if (cv.closest('#chart-container') || cv.closest('.cdt-chart-slot')) return;
      var r = cv.getBoundingClientRect();
      if (r.width < 80 || r.height < 40) return;
      if (cv.id && /^cv-/.test(cv.id)) {
        if (cv.closest('.cdt-wrap') || cv.__cdtAttached) return;
        attachCore(cv, { mode: 'canvas', chartId: cv.id });
        return;
      }
      var parent = cv.parentElement;
      if (!parent || parent.__cdtAttached || !isChartContainer(parent)) return;
      attachCore(parent, { mode: 'canvas', chartId: parent.id || uid() });
    });
    cleanupBadWraps();
  }

  var lwcCreateChartPatched = false;

  function patchCreateChart() {
    if (typeof LightweightCharts === 'undefined') return false;
    if (lwcCreateChartPatched) return true;
    try {
      var orig = LightweightCharts.createChart.bind(LightweightCharts);
      LightweightCharts.createChart = function (container, options) {
        var chart = orig(container, options);
        try {
          attachLightweightChart(chart, container);
        } catch (err) {
          console.warn('[chart-draw-tools] attach failed', err);
        }
        return chart;
      };
      lwcCreateChartPatched = true;
      return true;
    } catch (_e) {
      return false;
    }
  }

  function createLwcChart(container, options) {
    if (typeof LightweightCharts === 'undefined') return null;
    var chart = LightweightCharts.createChart(container, options);
    attachLightweightChart(chart, container);
    return chart;
  }

  function init() {
    injectCss();
    scanContainers();
    patchCreateChart();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scanContainers);
    }
    window.addEventListener('load', scanContainers);
    setTimeout(scanContainers, 500);
    setTimeout(scanContainers, 1500);
    setTimeout(scanContainers, 3500);

    if (typeof MutationObserver !== 'undefined') {
      var t = null;
      new MutationObserver(function () {
        if (t) return;
        t = setTimeout(function () { t = null; scanContainers(); }, 300);
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  window.ChartDrawTools = {
    attach: attachLightweightChart,
    rescan: scanContainers,
    patch: patchCreateChart,
    createChart: createLwcChart,
  };
  window.createLwcChart = createLwcChart;

  init();
})();
