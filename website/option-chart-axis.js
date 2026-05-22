/* Option Charts — axis labels, larger tick fonts, wheel/button zoom */
'use strict';

const OC_AXIS = {
  tick: '13px Consolas, monospace',
  label: 'bold 14px system-ui, Segoe UI, sans-serif',
  muted: '#94a3b8',
  line: '#475569',
  grid: 'rgba(51,65,85,.55)',
};

const _ocZoom = {};

function ocPad(kind) {
  if (kind === 'cartesian') return { l: 82, r: 28, t: 36, b: 62 };
  if (kind === 'hbar') return { l: 96, r: 78, t: 32, b: 48 };
  if (kind === 'vbar') return { l: 82, r: 24, t: 32, b: 62 };
  if (kind === 'hbarOi') return { l: 118, r: 36, t: 32, b: 44 };
  return { l: 72, r: 28, t: 32, b: 56 };
}

function ocZoomGet(id) {
  if (!_ocZoom[id]) _ocZoom[id] = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  return _ocZoom[id];
}

function ocZoomReset(id) {
  const z = ocZoomGet(id);
  z.xMin = 0; z.xMax = 1; z.yMin = 0; z.yMax = 1;
}

function ocZoomSpan(z) {
  return Math.max(0.06, (z.xMax - z.xMin) || 1);
}

function ocZoomWindow(lo, hi, z) {
  const span = hi - lo;
  return [lo + span * z.xMin, lo + span * z.xMax];
}

function ocNiceTicks(min, max, n) {
  if (min === max) return [min];
  const raw = (max - min) / Math.max(n - 1, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.ceil(raw / mag) * mag;
  const start = Math.ceil(min / step) * step;
  const out = [];
  for (let v = start; v <= max + step * 0.01; v += step) out.push(+v.toFixed(10));
  if (!out.length) out.push(min, max);
  return out;
}

function ocDrawCartesianAxes(ctx, W, H, pad, opts) {
  const xLabel = opts.xLabel || 'X';
  const yLabel = opts.yLabel || 'Y';
  const xTicks = opts.xTicks || [];
  const yTicks = opts.yTicks || [];
  const fmtX = opts.fmtX || (v => String(v));
  const fmtY = opts.fmtY || (v => String(v));
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const x0 = pad.l, y0 = pad.t, x1 = W - pad.r, y1 = H - pad.b;

  ctx.strokeStyle = OC_AXIS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.font = OC_AXIS.tick;
  ctx.fillStyle = OC_AXIS.muted;
  ctx.strokeStyle = OC_AXIS.grid;
  ctx.lineWidth = 1;

  yTicks.forEach(v => {
    const y = opts.yp(v);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtY(v), x0 - 8, y);
  });

  xTicks.forEach(v => {
    const x = opts.xp(v);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(fmtX(v), x, y1 + 6);
  });

  ctx.font = OC_AXIS.label;
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(xLabel, x0 + plotW / 2, H - 8);

  ctx.save();
  ctx.translate(16, y0 + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function ocDrawHBarAxes(ctx, W, H, pad, opts) {
  const yLabel = opts.yLabel || 'Strike';
  const xLabel = opts.xLabel || 'Value';
  const yTicks = opts.yTicks || [];
  const xTicks = opts.xTicks || [];
  const fmtX = opts.fmtX || (v => String(v));
  const fmtY = opts.fmtY || (v => String(v));
  const yp = opts.yp;
  const x0 = pad.l, x1 = W - pad.r, y1 = H - pad.b;

  ctx.strokeStyle = OC_AXIS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, pad.t); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.font = OC_AXIS.tick;
  ctx.fillStyle = OC_AXIS.muted;
  xTicks.forEach(v => {
    const x = opts.xp(v);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(fmtX(v), x, y1 + 6);
  });
  yTicks.forEach((v, yi) => {
    const y = yp(v);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const lbl = (opts.yLabels && opts.yLabels[yi] != null) ? opts.yLabels[yi] : fmtY(v);
    ctx.fillText(lbl, x0 - 8, y);
  });

  ctx.font = OC_AXIS.label;
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText(xLabel, x0 + (x1 - x0) / 2, H - 6);
  ctx.save();
  ctx.translate(14, pad.t + (y1 - pad.t) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function ocDrawVBarAxes(ctx, W, H, pad, opts) {
  const xLabel = opts.xLabel || 'Strike';
  const yLabel = opts.yLabel || 'Value';
  const xTicks = opts.xTicks || [];
  const yTicks = opts.yTicks || [];
  const fmtX = opts.fmtX || (v => String(v));
  const fmtY = opts.fmtY || (v => String(v));
  const x0 = pad.l, y0 = pad.t, x1 = W - pad.r, y1 = H - pad.b;

  ctx.strokeStyle = OC_AXIS.line;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.font = OC_AXIS.tick;
  ctx.fillStyle = OC_AXIS.muted;
  yTicks.forEach(v => {
    const y = opts.yp(v);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtY(v), x0 - 8, y);
  });
  xTicks.forEach(v => {
    const x = opts.xp(v);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(fmtX(v), x, y1 + 6);
  });

  ctx.font = OC_AXIS.label;
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText(xLabel, x0 + (x1 - x0) / 2, H - 8);
  ctx.save();
  ctx.translate(16, y0 + (y1 - y0) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function ocBindZoom(cv, chartId, redraw) {
  if (!cv || cv._ocZoomBound) return;
  cv._ocZoomBound = true;
  const wrap = cv.closest('.oc-canvas-wrap');
  if (wrap && !wrap.querySelector('.oc-zoom-bar')) {
    const bar = document.createElement('div');
    bar.className = 'oc-zoom-bar';
    bar.innerHTML = '<span class="oc-zoom-lbl">Zoom</span>'
      + '<button type="button" title="Zoom in" data-z="in">+</button>'
      + '<button type="button" title="Zoom out" data-z="out">−</button>'
      + '<button type="button" title="Reset view" data-z="reset">⟲</button>'
      + '<span class="oc-zoom-hint">Scroll wheel on chart</span>';
    const lbl = wrap.querySelector('.oc-canvas-lbl');
    if (lbl) lbl.after(bar); else wrap.prepend(bar);
    bar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const z = ocZoomGet(chartId);
        if (btn.dataset.z === 'in') {
          const m = (z.xMin + z.xMax) / 2;
          const half = ocZoomSpan(z) / 2;
          z.xMin = Math.max(0, m - half * 0.72);
          z.xMax = Math.min(1, m + half * 0.72);
        } else if (btn.dataset.z === 'out') {
          z.xMin = Math.max(0, z.xMin - 0.1);
          z.xMax = Math.min(1, z.xMax + 0.1);
        } else ocZoomReset(chartId);
        redraw();
      });
    });
  }
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const z = ocZoomGet(chartId);
    const d = e.deltaY > 0 ? 0.06 : -0.06;
    z.xMin = Math.max(0, Math.min(z.xMax - 0.06, z.xMin + d));
    z.xMax = Math.min(1, Math.max(z.xMin + 0.06, z.xMax - d));
    redraw();
  }, { passive: false });
}

function ocSetupCanvas(cv, H, chartId, redraw) {
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max((cv.parentElement && cv.parentElement.clientWidth) || 400, 320);
  const h = H || parseInt(cv.getAttribute('height'), 10) || 360;
  cv.width = W * dpr;
  cv.height = h * dpr;
  cv.style.width = W + 'px';
  cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ocBindZoom(cv, chartId, redraw);
  return { ctx, W, H: h, dpr };
}

window.OC_AXIS = OC_AXIS;
window.OcChartAxis = {
  OC_AXIS, ocPad, ocZoomGet, ocZoomReset, ocZoomWindow, ocNiceTicks,
  ocDrawCartesianAxes, ocDrawHBarAxes, ocDrawVBarAxes, ocBindZoom, ocSetupCanvas,
};
