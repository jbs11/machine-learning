/**
 * ibkr-widget.js — Global IBKR login widget (v2)
 * Renders a fixed floating button on every page.
 * On connect fires window.ibkrOnConnect() then falls back to window.loadData(true).
 */
(function () {
  'use strict';

  const API    = 'http://localhost:5050';
  const LS_PFX = 'ibkr_';

  /* ── Styles ────────────────────────────────────────────────────────────── */
  const css = `
    /* ── Floating trigger button ── */
    #ibkr-fab {
      position: fixed; bottom: 1.2rem; right: 1.2rem; z-index: 8888;
      display: inline-flex; align-items: center; gap: .4rem;
      background: #1e293b; border: 1px solid #334155;
      border-radius: 50px; padding: .45rem 1rem .45rem .7rem;
      cursor: pointer; font-size: .78rem; font-weight: 700;
      color: #94a3b8; box-shadow: 0 4px 20px rgba(0,0,0,.5);
      transition: border-color .15s, color .15s, background .15s, box-shadow .15s;
      user-select: none;
    }
    #ibkr-fab:hover {
      border-color: rgba(99,179,237,.6); color: #63b3ed;
      background: #1e3a5f; box-shadow: 0 6px 28px rgba(0,0,0,.6);
    }
    #ibkr-fab.connected {
      border-color: rgba(34,197,94,.5); color: #4ade80;
      background: rgba(15,30,15,.9); box-shadow: 0 4px 20px rgba(34,197,94,.2);
    }
    #ibkr-fab-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #475569; flex-shrink: 0; transition: background .3s, box-shadow .3s;
    }
    #ibkr-fab.connected #ibkr-fab-dot {
      background: #4ade80; box-shadow: 0 0 7px #4ade80;
    }

    /* ── Modal overlay ── */
    #ibkr-modal {
      position: fixed; inset: 0; z-index: 9999;
      display: none; align-items: center; justify-content: center;
      padding: 1rem;
    }
    #ibkr-modal.open { display: flex; }
    #ibkr-backdrop {
      position: absolute; inset: 0;
      background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
    }

    /* ── Panel ── */
    #ibkr-panel {
      position: relative; z-index: 1;
      background: #1e293b; border: 1px solid #334155;
      border-radius: 14px; padding: 1.6rem; width: 440px; max-width: 95vw;
      box-shadow: 0 24px 70px rgba(0,0,0,.7);
      animation: ibkr-pop .15s ease-out;
    }
    @keyframes ibkr-pop {
      from { transform: scale(.94); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }

    /* header */
    #ibkr-panel-hdr {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;
    }
    #ibkr-panel-hdr h3 {
      margin: 0; font-size: 1rem; font-weight: 800; color: #e2e8f0;
      display: flex; align-items: center; gap: .45rem;
    }
    #ibkr-close-btn {
      background: none; border: none; color: #64748b; font-size: 1.1rem;
      cursor: pointer; padding: .1rem .35rem; border-radius: 5px; transition: color .15s;
    }
    #ibkr-close-btn:hover { color: #e2e8f0; }

    /* status bar */
    #ibkr-status-bar {
      display: flex; align-items: center; gap: .55rem;
      background: rgba(255,255,255,.03); border: 1px solid #293548;
      border-radius: 8px; padding: .5rem .75rem; margin-bottom: 1rem;
      font-size: .8rem; color: #94a3b8;
    }
    #ibkr-sdot {
      width: 9px; height: 9px; border-radius: 50%;
      background: #475569; flex-shrink: 0; transition: all .3s;
    }
    #ibkr-sdot.on { background: #4ade80; box-shadow: 0 0 7px #4ade80; }

    /* form */
    .ibkr-row { display: flex; gap: .75rem; margin-bottom: .8rem; }
    .ibkr-field { display: flex; flex-direction: column; gap: .28rem; flex: 1; }
    .ibkr-field label {
      font-size: .7rem; color: #64748b;
      text-transform: uppercase; letter-spacing: .06em; font-weight: 700;
    }
    .ibkr-field input[type=text],
    .ibkr-field input[type=number] {
      background: #0f172a; border: 1px solid #334155; border-radius: 7px;
      color: #e2e8f0; padding: .45rem .65rem; font-size: .85rem; width: 100%;
      outline: none; transition: border-color .15s;
    }
    .ibkr-field input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,.15); }
    .ibkr-radios { display: flex; gap: .85rem; }
    .ibkr-radios label {
      display: flex; align-items: center; gap: .3rem;
      font-size: .82rem; color: #cbd5e1; cursor: pointer; font-weight: 400;
    }

    /* buttons */
    .ibkr-btns { display: flex; gap: .5rem; margin-top: .9rem; }
    .ibkr-btn {
      flex: 1; padding: .5rem; border-radius: 8px; font-size: .84rem;
      font-weight: 700; cursor: pointer; border: none; transition: background .15s, opacity .15s;
    }
    .ibkr-btn:disabled { opacity: .4; cursor: default; }
    .ibkr-btn-conn { background: #2563eb; color: #fff; }
    .ibkr-btn-conn:hover:not(:disabled) { background: #3b82f6; }
    .ibkr-btn-disc { background: rgba(127,29,29,.8); color: #fca5a5; border: 1px solid #7f1d1d; flex: 0; padding: .5rem .9rem; }
    .ibkr-btn-disc:hover:not(:disabled) { background: #991b1b; }

    /* result */
    #ibkr-result {
      display: none; margin-top: .75rem; padding: .55rem .75rem;
      border-radius: 7px; font-size: .8rem; line-height: 1.55;
      background: rgba(255,255,255,.04); border: 1px solid #293548;
    }

    /* hint */
    .ibkr-hint {
      margin-top: .9rem; padding: .65rem .85rem;
      background: rgba(59,130,246,.07); border: 1px solid rgba(59,130,246,.2);
      border-radius: 8px; font-size: .74rem; color: #94a3b8; line-height: 1.6;
    }
    .ibkr-hint strong { color: #cbd5e1; }

    /* data source badge in hint */
    .ibkr-ds-badge {
      display: inline-block; margin-top: .4rem; padding: .15rem .5rem;
      background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.25);
      border-radius: 4px; font-size: .72rem; color: #fbbf24; font-weight: 700;
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── Build DOM ─────────────────────────────────────────────────────────── */
  const container = document.createElement('div');
  container.innerHTML = `
    <!-- Floating trigger -->
    <button id="ibkr-fab" title="IBKR Login / Connection Status">
      <span id="ibkr-fab-dot"></span>
      <span id="ibkr-fab-label">🔌 IBKR Login</span>
    </button>

    <!-- Modal -->
    <div id="ibkr-modal">
      <div id="ibkr-backdrop"></div>
      <div id="ibkr-panel">
        <div id="ibkr-panel-hdr">
          <h3>🔌 Interactive Brokers <small style="font-weight:400;color:#64748b;font-size:.75rem">TWS / IB Gateway</small></h3>
          <button id="ibkr-close-btn" onclick="ibkrWidget.close()" title="Close">✕</button>
        </div>

        <div id="ibkr-status-bar">
          <div id="ibkr-sdot"></div>
          <span id="ibkr-stext">Checking connection…</span>
        </div>

        <div class="ibkr-row">
          <div class="ibkr-field" style="flex:2">
            <label>TWS Host</label>
            <input type="text" id="ibkr-host" value="127.0.0.1" placeholder="127.0.0.1">
          </div>
          <div class="ibkr-field" style="flex:1">
            <label>Client ID</label>
            <input type="number" id="ibkr-cid" value="10" min="1" max="999">
          </div>
        </div>

        <div class="ibkr-field">
          <label>Port</label>
          <div class="ibkr-radios" style="margin:.3rem 0">
            <label><input type="radio" name="ibkr-port-r" value="7497" checked
              onchange="document.getElementById('ibkr-port').value=7497"> 7497 — Paper Trading</label>
            <label><input type="radio" name="ibkr-port-r" value="7496"
              onchange="document.getElementById('ibkr-port').value=7496"> 7496 — Live Account</label>
          </div>
          <input type="number" id="ibkr-port" value="7497" min="1024" max="65535"
            oninput="document.querySelectorAll('[name=ibkr-port-r]').forEach(r=>r.checked=r.value==this.value)">
        </div>

        <div class="ibkr-btns">
          <button class="ibkr-btn ibkr-btn-conn" id="ibkr-conn-btn" onclick="ibkrWidget.connect()">Connect to IBKR</button>
          <button class="ibkr-btn ibkr-btn-disc" id="ibkr-disc-btn" onclick="ibkrWidget.disconnect()">Disconnect</button>
        </div>

        <div id="ibkr-result"></div>

        <div class="ibkr-hint">
          ⓘ &nbsp;TWS or IB Gateway must be <strong>running and logged in</strong> first.<br>
          Enable API: <strong>File → Global Configuration → API → Settings</strong> →
          check <em>Enable ActiveX and Socket Clients</em> → set port to
          <strong>7497</strong> (paper) or <strong>7496</strong> (live).<br>
          <span id="ibkr-ds-label" class="ibkr-ds-badge">Data: yfinance (delayed)</span>
          &nbsp;Settings saved automatically.
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  /* ── Element refs ──────────────────────────────────────────────────────── */
  const fab   = document.getElementById('ibkr-fab');
  const modal = document.getElementById('ibkr-modal');
  fab.addEventListener('click', () => ibkrWidget.open());
  document.getElementById('ibkr-backdrop').addEventListener('click', () => ibkrWidget.close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ibkrWidget.close(); });

  /* ── localStorage helpers ──────────────────────────────────────────────── */
  const get = k => localStorage.getItem(LS_PFX + k);
  const set = (k, v) => localStorage.setItem(LS_PFX + k, v);

  function restoreSettings() {
    const host = get('host'), port = get('port'), cid = get('cid');
    if (host) document.getElementById('ibkr-host').value = host;
    if (cid)  document.getElementById('ibkr-cid').value  = cid;
    if (port) {
      document.getElementById('ibkr-port').value = port;
      document.querySelectorAll('[name="ibkr-port-r"]').forEach(r => r.checked = r.value === String(port));
    }
  }

  /* ── Status update ─────────────────────────────────────────────────────── */
  function setStatus(connected, label) {
    // FAB button
    fab.classList.toggle('connected', connected);
    document.getElementById('ibkr-fab-label').textContent = connected ? '● IBKR Live' : '🔌 IBKR Login';

    // Modal status bar
    const sdot = document.getElementById('ibkr-sdot');
    const stxt = document.getElementById('ibkr-stext');
    const dslbl = document.getElementById('ibkr-ds-label');
    if (sdot) sdot.classList.toggle('on', connected);
    if (stxt) stxt.textContent = connected
      ? `Connected — real-time data active${label && label !== 'IBKR real-time' ? ' · ' + label : ''}`
      : (label || 'Not connected — using yfinance (15-20 min delayed)');
    if (dslbl) dslbl.textContent = connected ? 'Data: IBKR real-time' : 'Data: yfinance (delayed)';
    if (dslbl) dslbl.style.background = connected ? 'rgba(34,197,94,.1)' : 'rgba(251,191,36,.1)';
    if (dslbl) dslbl.style.borderColor = connected ? 'rgba(34,197,94,.3)' : 'rgba(251,191,36,.25)';
    if (dslbl) dslbl.style.color = connected ? '#4ade80' : '#fbbf24';

    // Sync live-trading page badge if present
    if (typeof window.updateIBKRBadge === 'function') window.updateIBKRBadge(connected, label);

    // Dispatch event for any page listener
    document.dispatchEvent(new CustomEvent('ibkr-status-changed', { detail: { connected, data_source: label } }));
  }

  /* ── Public API ────────────────────────────────────────────────────────── */
  window.ibkrWidget = {
    open() {
      restoreSettings();
      modal.classList.add('open');
      this.refreshStatus();
    },
    close() { modal.classList.remove('open'); },

    async refreshStatus() {
      try {
        const r = await fetch(`${API}/api/ibkr-status`, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) return;
        const d = await r.json();
        setStatus(d.connected, d.data_source || d.error || '');
      } catch (_) {}
    },

    async connect() {
      const host = (document.getElementById('ibkr-host').value || '127.0.0.1').trim();
      const port = parseInt(document.getElementById('ibkr-port').value) || 7497;
      const cid  = parseInt(document.getElementById('ibkr-cid').value)  || 10;
      const btn  = document.getElementById('ibkr-conn-btn');
      const res  = document.getElementById('ibkr-result');

      btn.disabled = true; btn.textContent = 'Connecting…'; res.style.display = 'none';

      try {
        const r = await fetch(`${API}/api/ibkr-connect`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host, port, clientId: cid }),
          signal: AbortSignal.timeout(15000)
        });
        const data = await r.json();
        res.style.display = 'block';

        if (data.success) {
          set('host', host); set('port', port); set('cid', cid);
          const acct = data.account && data.account !== 'unknown' ? ` · Account: ${data.account}` : '';
          res.innerHTML = `<span style="color:#4ade80">✓ Connected on ${host}:${port}${acct}</span>`;
          setStatus(true, 'IBKR real-time');

          // Reload page data after short delay
          setTimeout(() => {
            ibkrWidget.close();
            if (typeof window.ibkrOnConnect === 'function') {
              window.ibkrOnConnect();
            } else if (typeof window.loadData === 'function') {
              window.loadData(true);
            } else if (typeof window.loadAllForecasts === 'function') {
              window.loadAllForecasts();
            }
          }, 1200);
        } else {
          let msg = data.error || 'Connection failed';
          if (msg.toLowerCase().includes('refused') || msg.includes('111') || msg.includes('1225'))
            msg = `Connection refused on ${host}:${port} — is TWS/Gateway running with API enabled?`;
          else if (msg.toLowerCase().includes('timeout'))
            msg = `Timed out connecting to ${host}:${port} — check TWS API port setting matches.`;
          res.innerHTML = `<span style="color:#f87171">✗ ${msg}</span>`;
          setStatus(false, msg);
        }
      } catch (e) {
        res.style.display = 'block';
        res.innerHTML = `<span style="color:#f87171">✗ ${e.message}</span>`;
      } finally {
        btn.disabled = false; btn.textContent = 'Connect to IBKR';
      }
    },

    async disconnect() {
      const btn = document.getElementById('ibkr-disc-btn');
      const res = document.getElementById('ibkr-result');
      btn.disabled = true; btn.textContent = 'Disconnecting…'; res.style.display = 'none';
      try {
        const r = await fetch(`${API}/api/ibkr-disconnect`, { method: 'POST', signal: AbortSignal.timeout(6000) });
        const d = await r.json();
        res.style.display = 'block';
        if (d.success) {
          res.innerHTML = '<span style="color:#fbbf24">✓ Disconnected — switched to yfinance</span>';
          setStatus(false, 'yfinance (15-20 min delayed)');
        }
      } catch (e) {
        res.style.display = 'block';
        res.innerHTML = `<span style="color:#f87171">✗ ${e.message}</span>`;
      } finally {
        btn.disabled = false; btn.textContent = 'Disconnect';
      }
    }
  };

  /* ── Init (single-call guard) ──────────────────────────────────────────── */
  let _inited = false;
  function init() {
    if (_inited) return;
    _inited = true;
    // Silent status check on page load
    setTimeout(() => ibkrWidget.refreshStatus(), 600);
    // Re-check every 60 s
    setInterval(() => ibkrWidget.refreshStatus(), 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
