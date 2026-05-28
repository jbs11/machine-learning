/**
 * brief-spy-chart.js — lightweight SPY candle chart for summary-style pages
 */
(function () {
  'use strict';

  async function mountBriefSpyChart(elId, height) {
    var el = document.getElementById(elId);
    if (!el || typeof LightweightCharts === 'undefined') return;
    height = height || 280;
    try {
      var res = await fetch('/api/candles/SPY?interval=1h&period=5d', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var raw = await res.json();
      var candles = (raw.candles || raw || [])
        .map(function (c) {
          return {
            time: c.time || c.timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          };
        })
        .filter(function (c) {
          return c.time && c.open != null && c.close != null;
        });
      if (!candles.length) throw new Error('No candles');
      el.innerHTML = '';
      var chart = (window.createLwcChart || LightweightCharts.createChart)(el, {
        height: height,
        layout: { background: { color: '#070d18' }, textColor: 'rgba(148,163,184,.9)' },
        grid: { vertLines: { color: '#1e2d4a' }, horzLines: { color: '#1e2d4a' } },
        rightPriceScale: { borderColor: 'rgba(255,255,255,.1)' },
        timeScale: { borderColor: 'rgba(255,255,255,.1)', timeVisible: true, secondsVisible: false },
      });
      var series = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      series.setData(candles);
      chart.timeScale().fitContent();
      if (window.cdtRescan) requestAnimationFrame(function () { window.cdtRescan(); });
    } catch (e) {
      el.innerHTML =
        '<div style="padding:1.25rem;color:var(--muted);font-size:.85rem;text-align:center;">SPY chart unavailable — start live server (py live-server.py)</div>';
    }
  }

  window.mountBriefSpyChart = mountBriefSpyChart;
})();
