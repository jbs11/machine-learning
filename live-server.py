#!/usr/bin/env python3
"""
Live ML Trading Data Server
============================
Serves 4-hour candlestick data and GBM ML signals for:
  - S&P 500 ETFs : SPY, QQQ, DIA, IWM
  - Mag 7        : AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA
  - Blue Chips   : JPM, BAC, V, XOM, CVX, JNJ, UNH, WMT, HD, BRK-B
  - Options      : SPY, QQQ, AAPL, NVDA, MSFT, GOOGL, AMZN, META, TSLA
  - Futures      : ES=F, NQ=F, CL=F, GC=F, SI=F, ZB=F

Data source (priority order):
  1. Interactive Brokers via ib_async (real-time when TWS/Gateway is running)
  2. yfinance fallback (15-20 min delayed, no account needed)

Run:
    pip install flask flask-cors yfinance scikit-learn pandas numpy ib_async
    python live-server.py

IBKR Setup (optional — enables real-time data):
    1. Install Trader Workstation (TWS) or IB Gateway from interactivebrokers.com
    2. In TWS: File → Global Configuration → API → Settings
       - Enable ActiveX and Socket Clients
       - Socket port: 7497 (paper) or 7496 (live)
       - Allow connections from localhost
    3. Start TWS / IB Gateway, log in
    4. Run this server — it will auto-detect the connection

Endpoints:
    GET /api/candles/<symbol>          → 4H OHLCV array
    GET /api/signal/<symbol>           → ML direction + magnitude signal
    GET /api/multi/<sym1,sym2>         → batch signals
    GET /api/symbols                   → available symbol lists
    GET /api/ibkr-status               → IBKR connection state
    GET /api/health                    → server health check
"""

import os
import warnings
warnings.filterwarnings('ignore')

import threading
import time
import math
from collections import deque, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request, send_from_directory, Response, stream_with_context
from flask_compress import Compress
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import (GradientBoostingClassifier, GradientBoostingRegressor,
                               ExtraTreesClassifier, ExtraTreesRegressor,
                               VotingClassifier, VotingRegressor)
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

app = Flask(__name__)
# Gzip compression — reduces JSON payloads 60-80%, JS/HTML 40-60%
app.config['COMPRESS_MIMETYPES'] = [
    'text/html', 'text/css', 'application/json',
    'application/javascript', 'text/javascript',
    'text/plain', 'text/xml'
]
app.config['COMPRESS_LEVEL'] = 6      # gzip level 6: good speed/ratio balance
app.config['COMPRESS_MIN_SIZE'] = 256 # compress responses >= 256 bytes
compress = Compress(app)
CORS(app)

# ── Finnhub Auto-Init ─────────────────────────────────────────────────────────
_FINNHUB_API_KEY = ''  # Set via brokers page — enter new key at localhost:3000/brokers.html
_finnhub_client = None
try:
    import finnhub as _fh_mod
    _finnhub_client = _fh_mod.Client(api_key=_FINNHUB_API_KEY)
    _fh_test = _finnhub_client.quote('SPY')
    print(f'[Finnhub] Auto-initialized — SPY ${_fh_test.get("c", "?")}')
except Exception as _fh_err:
    print(f'[Finnhub] Auto-init warning: {_fh_err}')

def _fh_quote(symbol: str) -> dict:
    """Return Finnhub real-time quote dict or {} on error."""
    if not _finnhub_client:
        return {}
    try:
        # Finnhub uses dashes for some symbols (BRK-B → BRK.B)
        fh_sym = symbol.replace('-', '.').replace('=F', '')
        q = _finnhub_client.quote(fh_sym)
        return q if isinstance(q, dict) else {}
    except Exception:
        return {}

def _fh_basic_financials(symbol: str) -> dict:
    """Return Finnhub basic_financials 'metric' dict or {} on error."""
    if not _finnhub_client:
        return {}
    try:
        fh_sym = symbol.replace('-', '.').replace('=F', '')
        res = _finnhub_client.company_basic_financials(fh_sym, 'all')
        return res.get('metric', {}) if isinstance(res, dict) else {}
    except Exception:
        return {}

def _fh_recommendations(symbol: str) -> dict:
    """Return latest Finnhub recommendation trend entry or {} on error."""
    if not _finnhub_client:
        return {}
    try:
        fh_sym = symbol.replace('-', '.').replace('=F', '')
        trends = _finnhub_client.recommendation_trends(fh_sym)
        if trends and isinstance(trends, list):
            return trends[0]  # most recent period
        return {}
    except Exception:
        return {}

def _fh_price_target(symbol: str) -> dict:
    """Return Finnhub price target dict or {} on error."""
    if not _finnhub_client:
        return {}
    try:
        fh_sym = symbol.replace('-', '.').replace('=F', '')
        pt = _finnhub_client.price_target(fh_sym)
        return pt if isinstance(pt, dict) else {}
    except Exception:
        return {}

def _fh_news(symbol: str, count: int = 7) -> list:
    """Return list of recent Finnhub news articles for symbol."""
    if not _finnhub_client:
        return []
    try:
        from datetime import datetime, timedelta
        fh_sym = symbol.replace('-', '.').replace('=F', '')
        today = datetime.now().strftime('%Y-%m-%d')
        week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        articles = _finnhub_client.company_news(fh_sym, _from=week_ago, to=today)
        if not articles:
            return []
        result = []
        for a in articles[:count]:
            result.append({
                'title':     str(a.get('headline', ''))[:120],
                'url':       str(a.get('url', '')),
                'published': (lambda ts: __import__('datetime').datetime.fromtimestamp(int(ts)).strftime('%Y-%m-%d') if ts and str(ts).isdigit() else str(ts)[:10])(a.get('datetime', '')),
                'source':    str(a.get('source', '')),
                'summary':   str(a.get('summary', ''))[:200],
            })
        return result
    except Exception:
        return []

# ── Available Symbols ─────────────────────────────────────────────────────────
SYMBOLS = {
    # S&P 500 index ETFs
    'sp500':   ['SPY', 'QQQ', 'DIA', 'IWM'],
    # Magnificent 7
    'mag7':    ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'],
    # Blue-chip S&P 500 components by sector
    'bluechip':['JPM', 'BAC', 'V', 'XOM', 'CVX', 'JNJ', 'UNH', 'WMT', 'HD', 'BRK-B'],
    # Combined stocks list (all of the above)
    'stocks':  ['SPY', 'QQQ', 'DIA', 'IWM',
                'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA',
                'JPM', 'BAC', 'V', 'XOM', 'CVX', 'JNJ', 'UNH', 'WMT', 'HD', 'BRK-B'],
    # Options — most liquid underlyings
    'options': ['SPY', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'],
    # Futures
    'futures': ['ES=F', 'NQ=F', 'CL=F', 'GC=F', 'SI=F', 'ZB=F'],
    # Market Indices (yfinance only — not directly tradeable via IBKR)
    'indices': ['^GSPC', '^DJI', '^IXIC', '^NDX', '^RUT', '^VIX'],
}

SYMBOL_LABELS = {
    # S&P 500 ETFs
    'SPY':   'S&P 500 ETF (SPY)',
    'QQQ':   'Nasdaq-100 ETF (QQQ)',
    'DIA':   'Dow Jones ETF (DIA)',
    'IWM':   'Russell 2000 ETF (IWM)',
    # Magnificent 7
    'AAPL':  'Apple Inc. (AAPL)',
    'MSFT':  'Microsoft Corp. (MSFT)',
    'NVDA':  'NVIDIA Corp. (NVDA)',
    'GOOGL': 'Alphabet / Google (GOOGL)',
    'AMZN':  'Amazon.com (AMZN)',
    'META':  'Meta Platforms (META)',
    'TSLA':  'Tesla Inc. (TSLA)',
    # Blue chips
    'JPM':   'JPMorgan Chase (JPM)',
    'BAC':   'Bank of America (BAC)',
    'V':     'Visa Inc. (V)',
    'XOM':   'Exxon Mobil (XOM)',
    'CVX':   'Chevron Corp. (CVX)',
    'JNJ':   'Johnson & Johnson (JNJ)',
    'UNH':   'UnitedHealth Group (UNH)',
    'WMT':   'Walmart Inc. (WMT)',
    'HD':    'Home Depot (HD)',
    'BRK-B': 'Berkshire Hathaway B (BRK-B)',
    'AMD':  'Advanced Micro Devices (AMD)',
    'INTC':  'Intel Corp. (INTC)',
    'PLTR':  'Palantir Technologies (PLTR)',
    'SOFI':  'SoFi Technologies (SOFI)',
    'NOK':  'Nokia Corp. (NOK)',
    'RGTI':  'Rigetti Computing (RGTI)',
    'COIN':  'Coinbase Global (COIN)',
    'MARA':  'Marathon Digital (MARA)',
    'F':  'Ford Motor Co. (F)',
    # Futures
    'ES=F':  'E-mini S&P 500 (ES)',
    'NQ=F':  'E-mini Nasdaq-100 (NQ)',
    'CL=F':  'Crude Oil WTI (CL)',
    'GC=F':  'Gold Futures (GC)',
    'SI=F':  'Silver Futures (SI)',
    'ZB=F':  '30-Year T-Bond (ZB)',
    # Indices
    '^GSPC': 'S&P 500 Index (^GSPC)',
    '^DJI':  'Dow Jones Indus. Avg (^DJI)',
    '^IXIC': 'NASDAQ Composite (^IXIC)',
    '^NDX':  'NASDAQ-100 Index (^NDX)',
    '^RUT':  'Russell 2000 Index (^RUT)',
    '^VIX':  'CBOE Volatility Index (VIX)',
    'SPX':   'S&P 500 Index (SPX / SPXW)',
}

FUTURES_MULTIPLIERS = {
    'ES=F': 50,
    'NQ=F': 20,
    'CL=F': 1000,
    'GC=F': 100,
    'SI=F': 5000,
    'ZB=F': 1000,
}

# ETF proxies for futures GEX (yfinance has no futures options chains)
_FUTURES_PROXY_MAP = {
    'ES=F': 'SPY',   # S&P 500 E-mini → SPDR S&P 500 ETF
    'NQ=F': 'QQQ',   # Nasdaq E-mini → Invesco QQQ ETF
    'CL=F': 'USO',   # Crude Oil WTI → US Oil Fund ETF
    'GC=F': 'GLD',   # Gold → SPDR Gold Shares ETF
    'SI=F': 'SLV',   # Silver → iShares Silver Trust ETF
    'ZB=F': 'TLT',   # 30-Yr T-Bond → iShares 20+ Year Treasury ETF
}

# ETF/options proxy for cash indices (scale GEX levels to index price)
_INDEX_GEX_PROXY: dict[str, tuple[str, str, str]] = {
    # symbol -> (options_proxy, spot_symbol, candle_symbol)
    'SPX':   ('SPY', '^GSPC', '^GSPC'),
    '^GSPC': ('SPY', '^GSPC', '^GSPC'),
    '^NDX':  ('QQQ', '^NDX',  '^NDX'),
    '^RUT':  ('IWM', '^RUT',  '^RUT'),
    '^DJI':  ('DIA', '^DJI',  '^DJI'),
    '^IXIC': ('QQQ', '^IXIC', '^IXIC'),
}

# Indices are yfinance-only — IBKR doesn't support them as standard contracts
INDEX_SYMBOLS = {'^GSPC', '^DJI', '^IXIC', '^NDX', '^RUT', '^VIX'}

# ── Interactive Brokers (ib_async) ────────────────────────────────────────────
try:
    from ib_async import IB, Stock, Future, util as ib_util
    IB_AVAILABLE = True
    print("[IBKR] ib_async imported successfully")
except ImportError:
    IB_AVAILABLE = False
    print("[IBKR] ib_async not installed — using yfinance only")

_ib = None
_ib_lock = threading.Lock()
_ib_connected = False
_ib_error = ''
_yf_lock = threading.Lock()   # serialize yf.download() — not thread-safe

# ── Live Flow (snapshot-delta derived) ───────────────────────────────────────
# NOTE: This is NOT a true options tape. We approximate "flow" by polling option
# chains and looking for volume deltas per contract between snapshots.
_LIVE_FLOW_LAST: dict[str, dict] = {}  # symbol -> {contractSymbol -> snapshot}
_LIVE_FLOW_EVENTS: dict[str, deque] = defaultdict(lambda: deque(maxlen=2000))  # symbol -> recent events
_LIVE_FLOW_SERIES: dict[str, deque] = defaultdict(lambda: deque(maxlen=6000))  # symbol -> time buckets (supports multi-hour ranges)
_LIVE_FLOW_LAST_RESET_ET: dict[str, str] = {}  # symbol -> YYYY-MM-DD (ET) after 09:30 reset
_LIVE_FLOW_LOCK = threading.Lock()

# Map yfinance futures symbols → (IBKR symbol, exchange)
FUTURES_IB_MAP = {
    'ES=F': ('ES',  'CME'),
    'NQ=F': ('NQ',  'CME'),
    'CL=F': ('CL',  'NYMEX'),
    'GC=F': ('GC',  'COMEX'),
    'SI=F': ('SI',  'COMEX'),
    'ZB=F': ('ZB',  'CBOT'),
}

# yfinance symbols that differ from IBKR ticker format
STOCK_IB_MAP = {
    'BRK-B': 'BRK B',   # Berkshire B: yfinance uses hyphen, IBKR uses space
    'BRK-A': 'BRK A',
}

# Stores the host:port used by the most recent successful connection
_ib_connection_info: dict = {}


# ── Orderflow (IBKR L1 tape + bid/ask classification) ─────────────────────────
# This is an MVP-style orderflow view:
# - Subscribes to L1 quotes + last trades from IBKR (when connected)
# - Classifies prints as buy/sell/unknown using bid/ask or mid
# - Maintains a rolling buffer for UI (tape + cumulative delta)
_ORDERFLOW_LOCK = threading.Lock()
_ORDERFLOW_SUBS: dict[str, dict] = {}   # symbol -> {'contract':..., 'md':Ticker, 'tbt':Ticker, 'last_seen':(price,size,ts)}
_ORDERFLOW_QUOTES: dict[str, dict] = defaultdict(dict)  # symbol -> {bid,ask,bidSize,askSize,last,lastSize,ts}
_ORDERFLOW_TAPE: dict[str, deque] = defaultdict(lambda: deque(maxlen=4000))  # symbol -> recent prints
_ORDERFLOW_SERIES: dict[str, deque] = defaultdict(lambda: deque(maxlen=3000))  # symbol -> time buckets for CVD
_ORDERFLOW_EVENTS: deque = deque(maxlen=8000)  # global event stream for SSE (multi-symbol)
_ORDERFLOW_EVENT_ID = 0


def _is_finite(x) -> bool:
    try:
        return x is not None and math.isfinite(float(x))
    except Exception:
        return False


def _now_ts() -> float:
    return time.time()


def _classify_print(price: float, bid: float | None, ask: float | None) -> str:
    """
    Classify a print as BUY/SELL/UNKNOWN using NBBO (bid/ask).
    This is heuristic; IBKR does not provide an explicit aggressor side in L1.
    """
    if not _is_finite(price):
        return "UNKNOWN"
    if _is_finite(bid) and _is_finite(ask) and float(ask) >= float(bid):
        b = float(bid)
        a = float(ask)
        p = float(price)
        # small epsilon relative to spread
        eps = max(1e-6, (a - b) * 0.15)
        if p >= a - eps:
            return "BUY"
        if p <= b + eps:
            return "SELL"
        mid = (a + b) / 2.0
        if p > mid + eps:
            return "BUY"
        if p < mid - eps:
            return "SELL"
    return "UNKNOWN"


def _orderflow_add_event(evt: dict):
    global _ORDERFLOW_EVENT_ID
    with _ORDERFLOW_LOCK:
        _ORDERFLOW_EVENT_ID += 1
        evt = dict(evt)
        evt["id"] = _ORDERFLOW_EVENT_ID
        _ORDERFLOW_EVENTS.append(evt)


def _orderflow_update_series(symbol: str, ts: float, side: str, size: float, price: float | None):
    """
    Maintain a per-symbol 1-second bucketed series for CVD/pressure charts.
    """
    if not _is_finite(ts):
        ts = _now_ts()
    sec = int(float(ts))
    signed = float(size) if side == "BUY" else (-float(size) if side == "SELL" else 0.0)

    dq = _ORDERFLOW_SERIES[symbol]
    if dq and dq[-1]["t"] == sec:
        dq[-1]["delta"] += signed
        dq[-1]["vol"] += float(size)
        dq[-1]["buyVol"] += float(size) if side == "BUY" else 0.0
        dq[-1]["sellVol"] += float(size) if side == "SELL" else 0.0
        dq[-1]["lastPrice"] = float(price) if _is_finite(price) else dq[-1].get("lastPrice")
    else:
        # carry-forward cvd for simple charting
        prev_cvd = dq[-1]["cvd"] if dq else 0.0
        cvd = prev_cvd + signed
        dq.append({
            "t": sec,
            "delta": signed,
            "vol": float(size),
            "buyVol": float(size) if side == "BUY" else 0.0,
            "sellVol": float(size) if side == "SELL" else 0.0,
            "cvd": cvd,
            "lastPrice": float(price) if _is_finite(price) else None,
        })
    # update last cvd for current bucket too
    if dq:
        # recompute latest cvd by carrying from previous
        if len(dq) == 1:
            dq[-1]["cvd"] = dq[-1]["delta"]
        else:
            dq[-1]["cvd"] = dq[-2]["cvd"] + dq[-1]["delta"]


def _orderflow_on_ticker_update(ticker):
    """
    Called on ticker.updateEvent. Captures quote changes + new prints.
    """
    try:
        c = getattr(ticker, "contract", None)
        sym = getattr(c, "symbol", None) if c else None
        if not sym:
            return
        # Normalize IBKR symbol formatting back to our keys
        symbol = sym
        # reverse-map for BRK B
        for yf_sym, ib_sym in STOCK_IB_MAP.items():
            if ib_sym == symbol:
                symbol = yf_sym
                break

        ts = getattr(ticker, "timestamp", None) or _now_ts()
        bid = getattr(ticker, "bid", None)
        ask = getattr(ticker, "ask", None)
        bidSize = getattr(ticker, "bidSize", None)
        askSize = getattr(ticker, "askSize", None)
        last = getattr(ticker, "last", None)
        lastSize = getattr(ticker, "lastSize", None)

        with _ORDERFLOW_LOCK:
            _ORDERFLOW_QUOTES[symbol] = {
                "symbol": symbol,
                "ts": float(ts),
                "bid": float(bid) if _is_finite(bid) else None,
                "ask": float(ask) if _is_finite(ask) else None,
                "bidSize": float(bidSize) if _is_finite(bidSize) else None,
                "askSize": float(askSize) if _is_finite(askSize) else None,
                "last": float(last) if _is_finite(last) else None,
                "lastSize": float(lastSize) if _is_finite(lastSize) else None,
            }

            sub = _ORDERFLOW_SUBS.get(symbol)
            if not sub:
                return
            prev = sub.get("last_seen")
            cur = (float(last) if _is_finite(last) else None,
                   float(lastSize) if _is_finite(lastSize) else None,
                   float(ts))
            # consider a new print when last price/size changes (best-effort)
            if cur[0] is None or cur[1] is None:
                return
            if prev and prev[0] == cur[0] and prev[1] == cur[1]:
                return
            sub["last_seen"] = cur

        # classify outside lock
        side = _classify_print(cur[0], bid, ask)
        evt = {
            "type": "print",
            "symbol": symbol,
            "ts": float(ts),
            "price": float(cur[0]),
            "size": float(cur[1]),
            "side": side,
            "bid": float(bid) if _is_finite(bid) else None,
            "ask": float(ask) if _is_finite(ask) else None,
        }
        with _ORDERFLOW_LOCK:
            _ORDERFLOW_TAPE[symbol].append(evt)
        _orderflow_update_series(symbol, float(ts), side, float(cur[1]), float(cur[0]))
        _orderflow_add_event(evt)
    except Exception:
        # avoid crashing ib event loop
        return


def orderflow_start(symbols: list[str]) -> dict:
    """
    Ensure subscriptions are running for requested symbols.
    Returns a status dict for the API response.
    """
    ib = get_ib_connection(auto_probe=False)
    if ib is None or not ib.isConnected():
        return {"success": False, "error": "IBKR not connected", "data_source": "yfinance (no orderflow)"}

    started = []
    with _ORDERFLOW_LOCK:
        # clean symbol list
        uniq = []
        seen = set()
        for s in symbols:
            if not s:
                continue
            s = s.strip()
            if not s:
                continue
            if s in INDEX_SYMBOLS:
                continue  # no IBKR contract
            if s not in seen:
                seen.add(s)
                uniq.append(s)
        symbols = uniq[:8]  # hard cap for MVP

    for symbol in symbols:
        with _ORDERFLOW_LOCK:
            if symbol in _ORDERFLOW_SUBS:
                continue
        try:
            contract = ib_symbol_to_contract(symbol)
            ib.qualifyContracts(contract)
            md = ib.reqMktData(contract, snapshot=False)
            # ensure update callback hooked
            md.updateEvent += _orderflow_on_ticker_update
            # tick-by-tick provides more granular prints for many products
            try:
                tbt = ib.reqTickByTickData(contract, tickType="Last", numberOfTicks=0, ignoreSize=False)
                tbt.updateEvent += _orderflow_on_ticker_update
            except Exception:
                tbt = None
            with _ORDERFLOW_LOCK:
                _ORDERFLOW_SUBS[symbol] = {
                    "contract": contract,
                    "md": md,
                    "tbt": tbt,
                    "last_seen": None,
                }
            started.append(symbol)
        except Exception as e:
            print(f"[ORDERFLOW] start({symbol}) failed: {e}")

    return {"success": True, "started": started, "subscribed": symbols, "data_source": "IBKR real-time"}


def orderflow_stop_all():
    """Cancel all orderflow subscriptions and clear current subs map."""
    ib = get_ib_connection(auto_probe=False)
    with _ORDERFLOW_LOCK:
        subs = list(_ORDERFLOW_SUBS.items())
        _ORDERFLOW_SUBS.clear()
    if ib is None or not subs:
        return
    for symbol, sub in subs:
        try:
            md = sub.get("md")
            tbt = sub.get("tbt")
            if md:
                try: md.updateEvent -= _orderflow_on_ticker_update
                except Exception: pass
                try: ib.cancelMktData(md.contract)
                except Exception: pass
            if tbt:
                try: tbt.updateEvent -= _orderflow_on_ticker_update
                except Exception: pass
                try: ib.cancelTickByTickData(tbt.contract, "Last")
                except Exception: pass
        except Exception:
            pass


def get_ib_connection(auto_probe: bool = True):
    """
    Return an active IB connection singleton, or None.

    auto_probe=True  (default) — attempt to connect if not already connected.
    auto_probe=False           — only check current state, no blocking I/O.
    """
    global _ib, _ib_connected, _ib_error
    if not IB_AVAILABLE:
        return None

    # Fast non-blocking check — avoids lock when already connected
    if _ib is not None and _ib.isConnected():
        return _ib

    if not auto_probe:
        # Report current state without attempting a new connection
        if _ib is not None:
            _ib_connected = False
            _ib_error = 'Connection dropped'
        return None

    # Blocking auto-probe under lock (prevents concurrent connect races)
    with _ib_lock:
        # Double-check after acquiring lock
        if _ib is not None and _ib.isConnected():
            return _ib
        # Clean up stale object
        if _ib is not None:
            try: _ib.disconnect()
            except Exception: pass
            _ib = None

        for port in (7497, 7496):
            try:
                ib = IB()
                ib.connect('127.0.0.1', port, clientId=10, timeout=4)
                if ib.isConnected():
                    _ib = ib
                    _ib_connected = True
                    _ib_error = ''
                    _ib_connection_info.update(host='127.0.0.1', port=port, clientId=10)
                    print(f"[IBKR] Auto-connected on port {port}")
                    return _ib
            except Exception:
                pass

        _ib_connected = False
        _ib_error = 'TWS/IB Gateway not running on ports 7497 or 7496'
        return None


def ib_symbol_to_contract(symbol: str):
    """Map a yfinance-style symbol to an ib_async contract object."""
    if symbol in FUTURES_IB_MAP:
        sym, exch = FUTURES_IB_MAP[symbol]
        return Future(sym, '', exch)
    ib_sym = STOCK_IB_MAP.get(symbol, symbol)
    return Stock(ib_sym, 'SMART', 'USD')


def get_ibkr_1h_bars(symbol: str, period_days: int = 90) -> pd.DataFrame:
    """Fetch raw 1H bars from Interactive Brokers (no resampling)."""
    # auto_probe=False: only use IBKR if already connected (set via /api/ibkr-connect).
    ib = get_ib_connection(auto_probe=False)
    if ib is None:
        return pd.DataFrame()
    try:
        contract = ib_symbol_to_contract(symbol)
        ib.qualifyContracts(contract)

        bars = ib.reqHistoricalData(
            contract,
            endDateTime='',
            durationStr=f'{period_days} D',
            barSizeSetting='1 hour',
            whatToShow='TRADES',
            useRTH=False,
            formatDate=1
        )
        if not bars:
            print(f"[IBKR] No bars returned for {symbol}")
            return pd.DataFrame()

        df = ib_util.df(bars)
        df = df.rename(columns={
            'date': 'datetime', 'open': 'Open',
            'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'
        })
        df = df.set_index('datetime')
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        df = df[['Open', 'High', 'Low', 'Close', 'Volume']]
        print(f"[IBKR] {symbol}: {len(df)} 1H bars")
        return df

    except Exception as e:
        print(f"[IBKR] get_ibkr_1h_bars({symbol}): {e}")
        return pd.DataFrame()


# ── Interval configuration ────────────────────────────────────────────────────
# Maps UI interval label → (yfinance interval, default period, pandas resample rule)
INTERVAL_CONFIG: dict[str, tuple[str, str, str | None]] = {
    '1m':  ('1m',  '5d',   None),
    '5m':  ('5m',  '30d',  None),
    '15m': ('15m', '60d',  None),
    '30m': ('30m', '60d',  None),
    '1h':  ('1h',  '90d',  None),
    '4h':  ('1h',  '90d',  '4h'),   # resample 1H → 4H
    '1d':  ('1d',  '365d', None),
}

_RESAMPLE_AGG = {'Open': 'first', 'High': 'max', 'Low': 'min',
                 'Close': 'last', 'Volume': 'sum'}


# ── Data Fetching (multi-interval, IBKR → yfinance fallback) ─────────────────
def get_candles(symbol: str, interval: str = '1h', period: str | None = None) -> pd.DataFrame:
    """
    Download OHLCV bars at the requested interval.
    IBKR (1H bars) is used as source for '1h' and '4h' intervals when connected.
    All other intervals use yfinance directly.
    """
    cfg = INTERVAL_CONFIG.get(interval, INTERVAL_CONFIG['1h'])
    yf_int, default_period, resample = cfg
    yf_period = period or default_period

    try:
        period_days = int(yf_period.replace('d', '').replace('y', ''))
    except Exception:
        period_days = 90

    # IBKR: only practical for 1H-based intervals (TWS provides 1H bars natively)
    if interval in ('1h', '4h') and symbol not in INDEX_SYMBOLS:
        df_1h = get_ibkr_1h_bars(symbol, period_days)
        if not df_1h.empty:
            if resample:
                return df_1h.resample(resample).agg(_RESAMPLE_AGG).dropna()
            return df_1h

    # Schwab: real-time 1H bars (equity/ETF symbols only, not futures or indices)
    if interval in ('1h', '4h') and symbol not in INDEX_SYMBOLS and not symbol.endswith('=F'):
        df_schwab = _schwab_price_history(symbol, period_days)
        if not df_schwab.empty:
            if resample:
                return df_schwab.resample(resample).agg(_RESAMPLE_AGG).dropna()
            return df_schwab

    # yfinance fallback (all intervals)
    try:
        with _yf_lock:
            raw = yf.download(symbol, period=yf_period, interval=yf_int, progress=False)
        if raw.empty:
            return pd.DataFrame()
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        df = raw[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
        if resample:
            df = df.resample(resample).agg(_RESAMPLE_AGG).dropna()
        print(f"[yfinance] {symbol} {interval}: {len(df)} bars")
        return df
    except Exception as e:
        print(f"[ERROR] get_candles({symbol}, {interval}): {e}")
        return pd.DataFrame()


def get_4h_candles(symbol: str, period: str = '90d') -> pd.DataFrame:
    """Backward-compat wrapper used by ML signal functions (always 4H)."""
    return get_candles(symbol, interval='4h', period=period)


# ── Technical Indicators ──────────────────────────────────────────────────────
def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain  = delta.clip(lower=0).rolling(period).mean()
    loss  = (-delta.clip(upper=0)).rolling(period).mean()
    rs    = gain / (loss + 1e-9)
    return 100 - 100 / (1 + rs)

def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    hl = df['High'] - df['Low']
    hc = (df['High'] - df['Close'].shift()).abs()
    lc = (df['Low']  - df['Close'].shift()).abs()
    tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    return tr.rolling(period).mean()

# ── Per-asset-type feature sets ───────────────────────────────────────────────
STOCK_FEATURE_COLS = [
    'sma20_ratio', 'sma50_ratio', 'sma200_ratio',
    'macd', 'macd_signal', 'macd_hist',
    'rsi', 'stoch_k', 'williams_r',
    'bb_width', 'bb_pos',
    'vol_ratio', 'vol_regime',
    'ret1', 'ret3', 'ret5', 'ret10', 'ret20',
    'atr_pct', 'oc_range', 'hl_range', 'obv_trend',
]  # 23 features — balanced momentum + mean-reversion

OPTIONS_FEATURE_COLS = [
    'sma20_ratio', 'sma50_ratio',
    'macd', 'macd_signal', 'macd_hist',
    'rsi', 'stoch_k',
    'bb_width', 'bb_pos',
    'vol_ratio', 'vol_regime', 'hv5_ratio',
    'ret1', 'ret3', 'ret5',
    'atr_pct', 'oc_range', 'hl_range',
]  # 18 features — volatility-heavy, shorter momentum horizon

FUTURES_FEATURE_COLS = [
    'sma20_ratio', 'sma50_ratio', 'sma200_ratio',
    'macd', 'macd_signal', 'macd_hist',
    'rsi', 'adx',
    'bb_width', 'bb_pos',
    'vol_ratio', 'vol_regime',
    'ret1', 'ret3', 'ret5', 'ret10', 'ret20',
    'atr_pct', 'oc_range', 'hl_range',
]  # 21 features — trend strength + longer momentum (ADX replaces volume-based)

# Indices: same as futures (index volume is unreliable for OBV)
INDEX_FEATURE_COLS = FUTURES_FEATURE_COLS

# Legacy alias so any other code referencing FEATURE_COLS still works
FEATURE_COLS = STOCK_FEATURE_COLS


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add all technical features used by the per-type ML models."""
    d = df.copy()

    # ── Price / trend ────────────────────────────────────────────────────────
    sma20  = d['Close'].rolling(20).mean()
    sma50  = d['Close'].rolling(50).mean()
    sma200 = d['Close'].rolling(200).mean()
    ema12  = d['Close'].ewm(span=12).mean()
    ema26  = d['Close'].ewm(span=26).mean()
    std20  = d['Close'].rolling(20).std()

    d['sma20_ratio']  = d['Close'] / (sma20 + 1e-9)
    d['sma50_ratio']  = d['Close'] / (sma50 + 1e-9)
    # sma200_ratio falls back to sma50_ratio for short histories
    d['sma200_ratio'] = np.where(
        d['Close'].expanding().count() >= 200,
        d['Close'] / (sma200 + 1e-9),
        d['Close'] / (sma50 + 1e-9)
    )

    # ── MACD ─────────────────────────────────────────────────────────────────
    d['macd']         = ema12 - ema26
    d['macd_signal']  = d['macd'].ewm(span=9).mean()
    d['macd_hist']    = d['macd'] - d['macd_signal']

    # ── RSI ──────────────────────────────────────────────────────────────────
    d['rsi']          = compute_rsi(d['Close'], 14)

    # ── Stochastic %K (14-period) ─────────────────────────────────────────────
    low14  = d['Low'].rolling(14).min()
    high14 = d['High'].rolling(14).max()
    d['stoch_k']      = (d['Close'] - low14) / (high14 - low14 + 1e-9) * 100

    # ── Williams %R ──────────────────────────────────────────────────────────
    d['williams_r']   = (high14 - d['Close']) / (high14 - low14 + 1e-9) * -100

    # ── Bollinger Bands ───────────────────────────────────────────────────────
    bb_upper          = sma20 + 2 * std20
    bb_lower          = sma20 - 2 * std20
    d['bb_width']     = (bb_upper - bb_lower) / (sma20 + 1e-9)
    d['bb_pos']       = (d['Close'] - bb_lower) / (bb_upper - bb_lower + 1e-9)

    # ── ATR ───────────────────────────────────────────────────────────────────
    d['atr']          = compute_atr(d, 14)
    d['atr_pct']      = d['atr'] / (d['Close'] + 1e-9)

    # ── ADX (14-period) ───────────────────────────────────────────────────────
    tr     = pd.concat([
        d['High'] - d['Low'],
        (d['High'] - d['Close'].shift()).abs(),
        (d['Low']  - d['Close'].shift()).abs(),
    ], axis=1).max(axis=1)
    dm_pos = (d['High'] - d['High'].shift()).clip(lower=0)
    dm_neg = (d['Low'].shift()  - d['Low']).clip(lower=0)
    dm_pos = np.where(dm_pos > dm_neg, dm_pos, 0.0)
    dm_neg = np.where(pd.Series(dm_neg.values) > pd.Series(dm_pos), dm_neg.values, 0.0)
    atr14  = tr.rolling(14).mean()
    di_pos = pd.Series(dm_pos, index=d.index).rolling(14).mean() / (atr14 + 1e-9) * 100
    di_neg = pd.Series(dm_neg, index=d.index).rolling(14).mean() / (atr14 + 1e-9) * 100
    dx     = (di_pos - di_neg).abs() / (di_pos + di_neg + 1e-9) * 100
    d['adx'] = dx.rolling(14).mean()

    # ── Volume features ───────────────────────────────────────────────────────
    vol_ma20          = d['Volume'].rolling(20).mean()
    d['vol_ratio']    = d['Volume'] / (vol_ma20 + 1e-9)

    # OBV trend: normalized 10-bar slope of on-balance volume
    obv = (np.sign(d['Close'].diff()) * d['Volume']).cumsum()
    obv_slope         = obv.diff(10) / (obv.rolling(10).std() + 1e-9)
    d['obv_trend']    = obv_slope.clip(-3, 3) / 3.0   # normalise to [-1, 1]

    # HV5/HV20 ratio: short-term vs medium-term realized volatility
    hv5               = d['Close'].pct_change().rolling(5).std()
    hv20              = d['Close'].pct_change().rolling(20).std()
    d['hv5_ratio']    = hv5 / (hv20 + 1e-9)

    # ── Volatility regime 0/1/2 (low / normal / high) ─────────────────────────
    atr_pct_med       = d['atr_pct'].rolling(50).median()
    d['vol_regime']   = np.where(d['atr_pct'] < atr_pct_med * 0.75, 0,
                        np.where(d['atr_pct'] > atr_pct_med * 1.50, 2, 1))

    # ── Returns ───────────────────────────────────────────────────────────────
    d['ret1']         = d['Close'].pct_change(1)
    d['ret3']         = d['Close'].pct_change(3)
    d['ret5']         = d['Close'].pct_change(5)
    d['ret10']        = d['Close'].pct_change(10)
    d['ret20']        = d['Close'].pct_change(20)

    # ── Bar shape ─────────────────────────────────────────────────────────────
    d['oc_range']     = (d['Close'] - d['Open']) / (d['Open'] + 1e-9)
    d['hl_range']     = (d['High'] - d['Low'])   / (d['Open'] + 1e-9)

    # ── Rolling Sharpe Ratio (20-bar, annualized) ─────────────────────────────
    _ret              = d['Close'].pct_change()
    _roll_mean        = _ret.rolling(20).mean()
    _roll_std         = _ret.rolling(20).std()
    d['sharpe_20']    = (_roll_mean / (_roll_std + 1e-9)) * np.sqrt(252)

    return d.dropna()


# ── ML Models ─────────────────────────────────────────────────────────────────
_ASSET_FEATURE_MAP = {
    'stock':   STOCK_FEATURE_COLS,
    'options': OPTIONS_FEATURE_COLS,
    'futures': FUTURES_FEATURE_COLS,
    'index':   INDEX_FEATURE_COLS,
}

def train_and_predict(df: pd.DataFrame, asset_type: str = 'stock'):
    """
    Train a per-asset-type ensemble (GBM + ExtraTrees voting) classifier for
    direction and a voting regressor for magnitude, then predict on the latest bar.

    asset_type: 'stock' | 'options' | 'futures' | 'index'
    Returns dict with all signal fields, or None if insufficient data.
    """
    feat_cols = _ASSET_FEATURE_MAP.get(asset_type, STOCK_FEATURE_COLS)

    d = df.copy()
    d['future_ret'] = d['Close'].pct_change(1).shift(-1)
    d['direction']  = (d['future_ret'] > 0).astype(int)
    d = d.dropna(subset=feat_cols + ['direction', 'future_ret'])

    if len(d) < 80:
        return None

    X     = d[feat_cols].values
    y_dir = d['direction'].values
    y_mag = d['future_ret'].values

    scaler = StandardScaler()
    X_sc   = scaler.fit_transform(X)

    # ── Ensemble direction classifier: GBM + ExtraTrees soft voting ──────────
    gbc = GradientBoostingClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        subsample=0.8, random_state=42
    )
    etc = ExtraTreesClassifier(
        n_estimators=200, max_depth=6, random_state=42, n_jobs=-1
    )
    clf = VotingClassifier([('gbc', gbc), ('etc', etc)], voting='soft')
    clf.fit(X_sc, y_dir)

    # ── Ensemble magnitude regressor: GBR + ExtraTrees average ───────────────
    gbr = GradientBoostingRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        subsample=0.8, random_state=42
    )
    etr = ExtraTreesRegressor(
        n_estimators=200, max_depth=6, random_state=42, n_jobs=-1
    )
    reg = VotingRegressor([('gbr', gbr), ('etr', etr)])
    reg.fit(X_sc, y_mag)

    # ── Walk-forward cross-validation accuracy ────────────────────────────────
    tscv = TimeSeriesSplit(n_splits=5)
    cv_scores = cross_val_score(
        VotingClassifier([
            ('gbc', GradientBoostingClassifier(n_estimators=100, max_depth=4,
                                               learning_rate=0.05, subsample=0.8,
                                               random_state=42)),
            ('etc', ExtraTreesClassifier(n_estimators=100, max_depth=6,
                                         random_state=42, n_jobs=-1))
        ], voting='soft'),
        X_sc, y_dir, cv=tscv, scoring='accuracy', n_jobs=1
    )
    cv_accuracy = float(cv_scores.mean())

    # ── Predict on latest bar ─────────────────────────────────────────────────
    latest      = df.iloc[-1]
    X_latest    = np.array([[latest[c] for c in feat_cols]])
    X_latest_sc = scaler.transform(X_latest)

    prob_up  = float(clf.predict_proba(X_latest_sc)[0][1])
    pred_mag = float(reg.predict(X_latest_sc)[0])
    close    = float(latest['Close'])
    atr      = float(latest['atr'])
    vol_reg   = int(latest.get('vol_regime', 1))
    vol_ratio = float(latest.get('vol_ratio', 1.0))

    # ── Dynamic signal thresholds based on volatility regime ─────────────────
    buy_thresh  = 0.62 if vol_reg == 2 else 0.60
    sell_thresh = 0.38 if vol_reg == 2 else 0.40
    if prob_up >= buy_thresh:
        signal = 'BUY'
    elif prob_up <= sell_thresh:
        signal = 'SELL'
    else:
        signal = 'HOLD'

    # ── Feature importance from the GBM sub-estimator ─────────────────────────
    gbc_fitted  = clf.estimators_[0]   # the fitted GradientBoostingClassifier
    feat_imp = dict(zip(feat_cols,
                        [round(float(v), 4) for v in gbc_fitted.feature_importances_]))
    feat_imp = dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True))

    vol_regime_label = {0: 'Low', 1: 'Normal', 2: 'High'}.get(vol_reg, 'Normal')

    # ── Historical signal markers (BUY/SELL onsets across all training bars) ──
    # Use a fixed 0.58 / 0.42 threshold for annotations so arrows appear even in
    # high-vol regimes (where the trading threshold is 0.62 / 0.38).
    all_probs   = clf.predict_proba(X_sc)[:, 1]
    marker_buy  = 0.58
    marker_sell = 0.42
    all_signals = np.where(all_probs >= marker_buy,  'BUY',
                  np.where(all_probs <= marker_sell, 'SELL', 'HOLD'))

    # Convert DatetimeIndex to Unix seconds (pandas 3.x returns seconds from astype int64)
    unix_ts = [int(pd.Timestamp(t).timestamp()) for t in d.index]

    # Emit only the first bar of each consecutive BUY / SELL run
    signal_markers = []
    prev_sig = 'HOLD'
    for ts, sig, prob in zip(unix_ts, all_signals, all_probs):
        if sig != 'HOLD' and sig != prev_sig:
            signal_markers.append({
                'time':    int(ts),
                'signal':  sig,
                'prob_up': round(float(prob), 3),
            })
        prev_sig = sig

    return {
        'symbol':             latest.name if hasattr(latest, 'name') else '',
        'close':              round(close, 4),
        'prob_up':            round(prob_up, 4),
        'prob_down':          round(1 - prob_up, 4),
        'pred_magnitude_pct': round(pred_mag * 100, 3),
        'pred_magnitude_pts': round(pred_mag * close, 4),
        'atr':                round(atr, 4),
        'atr_pct':            round(atr / close * 100, 3),
        'signal':             signal,
        'entry':              round(close, 4),
        'stop_long':          round(close - 1.5 * atr, 4),
        'target_long':        round(close + abs(pred_mag) * close, 4),
        'stop_short':         round(close + 1.5 * atr, 4),
        'target_short':       round(close - abs(pred_mag) * close, 4),
        'risk_per_unit':      round(1.5 * atr, 4),
        'reward_per_unit':    round(abs(pred_mag) * close, 4),
        'rr_ratio':           round(abs(pred_mag) * close / (1.5 * atr + 1e-9), 2),
        'backtest_accuracy':  round(cv_accuracy, 4),   # kept for back-compat
        'cv_accuracy':        round(cv_accuracy, 4),
        'feature_importance': feat_imp,
        'model_type':         'GBM+ExtraTrees Ensemble',
        'asset_type':         asset_type,
        'vol_regime':         vol_reg,
        'vol_regime_label':   vol_regime_label,
        'vol_ratio':          round(vol_ratio, 3),
        'features_used':      feat_cols,
        'signal_markers':     signal_markers,
        'timestamp':          datetime.now().isoformat()
    }


# ── Cache (in-memory, per-kind TTL) ─────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 480  # default: 8 min — safe because yfinance is 15-20 min delayed

# Stable data caches longer; volatile data caches shorter
_CACHE_TTL_BY_KIND: dict = {
    'fundamentals':     1800,  # 30 min — P/E, revenue growth rarely intraday
    'options_strategy':  600,  # 10 min
    'opt-strategy':      600,  # 10 min (key used by options-strategy endpoint)
    '0dte':              300,  # 5 min
    'market_summary':    300,  # 5 min
}

# API-level response cache — caches fully-assembled endpoint JSON
# Skips the per-symbol loop even when symbol cache is warm
_api_resp_cache: dict = {}
_API_RESP_TTL: dict = {
    '/api/fundamentals':       1800,
    '/api/options-strategy':    600,
    '/api/options-summary':     600,
    '/api/0dte':                300,
    '/api/market-summary':      300,
    '/api/gamma-exposure':      480,
    '/api/option-flows':        480,
    '/api/treasury-yields':     300,
    '/api/spx-0dte-risk':       120,
}

def api_resp_get(endpoint):
    """Return cached full API response if still fresh, else None."""
    if endpoint in _api_resp_cache:
        ts, val = _api_resp_cache[endpoint]
        ttl = _API_RESP_TTL.get(endpoint, CACHE_TTL)
        if (datetime.now() - ts).total_seconds() < ttl:
            return val
    return None

def api_resp_set(endpoint, val):
    _api_resp_cache[endpoint] = (datetime.now(), val)

def cache_key(symbol, kind):
    return f'{kind}:{symbol}'

def cache_get(key):
    if key in _cache:
        ts, val = _cache[key]
        kind = key.split(':')[0] if ':' in key else ''
        ttl = _CACHE_TTL_BY_KIND.get(kind, CACHE_TTL)
        if (datetime.now() - ts).total_seconds() < ttl:
            return val
    return None

def cache_set(key, val):
    _cache[key] = (datetime.now(), val)


def iso_now() -> str:
    """Timezone-aware ISO timestamp for browser parsing."""
    try:
        return datetime.now().astimezone().replace(microsecond=0).isoformat()
    except Exception:
        return datetime.now().replace(microsecond=0).isoformat()



@app.after_request
def add_cache_headers(response):
    """No-cache for all HTML, JS, CSS, and API responses so changes appear immediately."""
    path = request.path
    # Images and fonts only — safe to cache
    if path.endswith(('.png', '.jpg', '.jpeg', '.ico', '.svg', '.woff', '.woff2')):
        response.headers['Cache-Control'] = 'public, max-age=86400'
    else:
        # HTML, JS, CSS, API — always serve fresh
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        response.headers.pop('ETag', None)
        response.headers.pop('Last-Modified', None)
    return response


# ── Broker credentials store (persisted to disk so key survives restarts) ─────
import json as _json
_CREDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'broker_creds.json')

def _load_broker_creds():
    try:
        if os.path.exists(_CREDS_FILE):
            with open(_CREDS_FILE, 'r') as _f:
                return _json.load(_f)
    except Exception:
        pass
    return {}

def _save_broker_creds(creds):
    try:
        with open(_CREDS_FILE, 'w') as _f:
            _json.dump(creds, _f)
    except Exception as e:
        print(f"[Broker] Failed to save creds: {e}")

_broker_creds = _load_broker_creds()
_schwab_auth_result = {}  # tracks latest auto-callback result for polling

def _start_schwab_https_server():
    """Start a tiny HTTPS server on 127.0.0.1:443 to auto-capture Schwab OAuth callbacks.
    Requires running the batch file as Administrator. Falls back silently if not admin."""
    try:
        import ssl, threading, tempfile, os
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime, ipaddress
    except ImportError as _ie:
        print(f'[Schwab HTTPS] Missing package: {_ie} — run: py -m pip install cryptography')
        return
    try:
        # Generate self-signed cert for 127.0.0.1
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, u'127.0.0.1')])
        cert = (x509.CertificateBuilder()
            .subject_name(subject).issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=825))
            .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.IPv4Address('127.0.0.1'))]), critical=False)
            .sign(key, hashes.SHA256()))
        # Write cert/key to temp files
        tmpdir = tempfile.mkdtemp()
        cert_file = os.path.join(tmpdir, 'cert.pem')
        key_file  = os.path.join(tmpdir, 'key.pem')
        with open(cert_file, 'wb') as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        with open(key_file, 'wb') as f:
            f.write(key.private_bytes(serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption()))
        # Start mini HTTPS Flask server in thread
        import flask as _fl
        mini = _fl.Flask('schwab_https')
        @mini.route('/')
        def _mini_cb():
            import base64, time, requests as _req
            global _schwab_auth_result
            code = _fl.request.args.get('code', '').strip()
            if not code:
                _schwab_auth_result = {'ok': False, 'error': _fl.request.args.get('error','unknown')}
                return '<h2 style="font-family:sans-serif;color:#f87171;padding:2rem;">Auth failed. Close this tab.</h2>', 400
            sc = _broker_creds.get('schwab', {})
            cid, csec = sc.get('client_id',''), sc.get('client_secret','')
            cb = 'https://127.0.0.1'
            if not (cid and csec):
                _schwab_auth_result = {'ok': False, 'error': 'No Schwab credentials saved'}
                return 'Error: no credentials', 400
            try:
                b64 = base64.b64encode(f'{cid}:{csec}'.encode()).decode()
                r = _req.post('https://api.schwabapi.com/v1/oauth/token',
                    headers={'Authorization': f'Basic {b64}', 'Content-Type': 'application/x-www-form-urlencoded'},
                    data={'grant_type': 'authorization_code', 'code': code, 'redirect_uri': cb},
                    timeout=15, verify=False)
                if r.status_code != 200:
                    _schwab_auth_result = {'ok': False, 'error': f'Token exchange failed ({r.status_code}): {r.text[:200]}'}
                    return f'<h2 style="font-family:sans-serif;color:#f87171;padding:2rem;">Failed ({r.status_code}). Close this tab.</h2>', 400
                td = r.json()
                td['expires_at'] = time.time() + td.get('expires_in', 1800) - 60
                _broker_creds['schwab']['token'] = td
                _save_broker_creds(_broker_creds)
            except Exception as e:
                _schwab_auth_result = {'ok': False, 'error': str(e)}
                return f'Error: {e}', 500
            try:
                q = _schwab_quote('SPY')
                spot = str(q.get('lastPrice', '—'))
            except Exception:
                spot = '—'
            _schwab_auth_result = {'ok': True, 'spot': spot}
            return f'<html><body style="font-family:sans-serif;background:#070d18;color:#4ade80;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center"><h2>&#10003; Schwab Connected!</h2><p style="color:#94a3b8;">SPY ${spot} &mdash; you can close this tab.</p><script>try{{window.opener.postMessage({{type:"schwab_connected",spot:"{spot}"}},"*");}}catch(e){{}}setTimeout(function(){{window.close();}},2000);</script></div></body></html>'
        @mini.route('/')
        def _mini_root():
            return '', 200
        def _run_mini():
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(cert_file, key_file)
            ctx.check_hostname = False
            import werkzeug.serving
            srv = werkzeug.serving.make_server('127.0.0.1', 443, mini, ssl_context=ctx, threaded=True)
            print('[Schwab HTTPS] Listening on https://127.0.0.1:443/ — Schwab auto-capture ACTIVE')
            srv.serve_forever()
        threading.Thread(target=_run_mini, daemon=True).start()
    except PermissionError:
        print('[Schwab HTTPS] Port 443 requires admin — right-click the batch file and Run as Administrator to enable auto-capture.')
    except Exception as e:
        print(f'[Schwab HTTPS] Could not start: {e}')

# Auto-reconnect Finnhub if key was saved from a previous session
if 'finnhub' in _broker_creds:
    try:
        import finnhub as _fh_startup
        _fh_startup_client = _fh_startup.Client(api_key=_broker_creds['finnhub']['key'])
        _fh_startup_client.quote('SPY')  # verify key still works
        print(f"[Startup] Finnhub auto-reconnected with saved key.")
    except Exception as _e:
        print(f"[Startup] Saved Finnhub key failed ({_e}) — will need manual reconnect.")

# Auto-refresh Schwab token on startup if credentials are saved
if 'schwab' in _broker_creds:
    import time as _time_startup
    _sc = _broker_creds['schwab']
    _sc_token = _sc.get('token', {})
    _has_refresh = bool(_sc_token.get('refresh_token'))
    _token_ok = bool(_sc_token.get('access_token')) and _time_startup.time() < _sc_token.get('expires_at', 0)
    if _token_ok:
        print(f"[Startup] Schwab token still valid.")
    elif _has_refresh:
        print(f"[Startup] Schwab access token expired — refreshing...")
        # _schwab_refresh_token() not defined yet at this point; do it inline
        try:
            import requests as _req_s, base64 as _b64_s
            _creds_b64 = _b64_s.b64encode(f"{_sc['client_id']}:{_sc['client_secret']}".encode()).decode()
            _r = _req_s.post('https://api.schwabapi.com/v1/oauth/token',
                headers={'Authorization': f'Basic {_creds_b64}',
                         'Content-Type': 'application/x-www-form-urlencoded'},
                data={'grant_type': 'refresh_token', 'refresh_token': _sc_token['refresh_token']},
                timeout=15)
            if _r.status_code == 200:
                _td = _r.json()
                _td['expires_at'] = _time_startup.time() + _td.get('expires_in', 1800) - 60
                _broker_creds['schwab']['token'] = _td
                _save_broker_creds(_broker_creds)
                print(f"[Startup] Schwab token refreshed successfully.")
            else:
                print(f"[Startup] Schwab token refresh failed ({_r.status_code}) — reconnect on Brokers page.")
        except Exception as _e_s:
            print(f"[Startup] Schwab refresh error: {_e_s}")
    else:
        print(f"[Startup] Schwab credentials saved but no valid token — reconnect on Brokers page.")

@app.route('/api/broker-connect/tradier', methods=['POST'])
def broker_connect_tradier():
    data    = request.get_json(force=True)
    token   = data.get('token','').strip()
    sandbox = data.get('sandbox', True)
    if not token:
        return jsonify({'ok': False, 'error': 'Missing access token'})
    try:
        import requests as req_lib
        base = 'https://sandbox.tradier.com/v1' if sandbox else 'https://api.tradier.com/v1'
        r = req_lib.get(f'{base}/markets/quotes', params={'symbols':'SPY'},
                        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'},
                        timeout=10)
        if r.status_code != 200:
            return jsonify({'ok': False, 'error': f'HTTP {r.status_code}: {r.text[:100]}'})
        quote = r.json().get('quotes',{}).get('quote',{})
        spot  = quote.get('last', '—')
        env   = 'sandbox' if sandbox else 'live'
        _broker_creds['tradier'] = {'token': token, 'sandbox': sandbox}
        _save_broker_creds(_broker_creds)
        return jsonify({'ok': True, 'message': f'Tradier {env} connected — SPY ${spot}'})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)[:200]})

@app.route('/api/broker-disconnect/tradier', methods=['POST'])
def broker_disconnect_tradier():
    _broker_creds.pop('tradier', None)
    _save_broker_creds(_broker_creds)
    return jsonify({'ok': True})

# ── Broker: Finnhub ───────────────────────────────────────────────────────────
@app.route('/api/broker-connect/finnhub', methods=['POST'])
def broker_connect_finnhub():
    data = request.get_json(force=True)
    key  = data.get('key','').strip()
    if not key:
        return jsonify({'ok': False, 'error': 'Missing API key'})
    try:
        import finnhub
        client = finnhub.Client(api_key=key)
        quote  = client.quote('SPY')
        spot   = quote.get('c', '—')
        _broker_creds['finnhub'] = {'key': key}
        _save_broker_creds(_broker_creds)
        return jsonify({'ok': True, 'message': f'Finnhub connected — SPY ${spot}'})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)[:200]})

@app.route('/api/broker-disconnect/finnhub', methods=['POST'])
def broker_disconnect_finnhub():
    _broker_creds.pop('finnhub', None)
    _save_broker_creds(_broker_creds)
    return jsonify({'ok': True})
# ── Broker: Schwab (Charles Schwab Individual Trader API) ────────────────────
SCHWAB_AUTH_URL  = 'https://api.schwabapi.com/v1/oauth/authorize'
SCHWAB_TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token'
SCHWAB_QUOTES_URL = 'https://api.schwabapi.com/marketdata/v1/quotes'

def _schwab_refresh_token():
    """Exchange refresh_token for new access_token. Updates _broker_creds in-place."""
    import requests as _req
    import base64, time
    sc = _broker_creds.get('schwab', {})
    rt = sc.get('token', {}).get('refresh_token', '')
    client_id = sc.get('client_id', '')
    client_secret = sc.get('client_secret', '')
    if not (rt and client_id and client_secret):
        return None
    try:
        creds_b64 = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
        r = _req.post(SCHWAB_TOKEN_URL,
            headers={'Authorization': f'Basic {creds_b64}',
                     'Content-Type': 'application/x-www-form-urlencoded'},
            data={'grant_type': 'refresh_token', 'refresh_token': rt},
            timeout=15)
        if r.status_code == 200:
            td = r.json()
            td['expires_at'] = time.time() + td.get('expires_in', 1800) - 60
            _broker_creds['schwab']['token'] = td
            _save_broker_creds(_broker_creds)
            print('[Schwab] Token refreshed')
            return td
        print(f'[Schwab] Token refresh failed: {r.status_code} {r.text[:100]}')
    except Exception as e:
        print(f'[Schwab] Refresh error: {e}')
    return None

def _schwab_quote(symbol):
    """Get real-time quote from Schwab API. Returns dict with lastPrice etc."""
    import requests as _req
    import time
    sc = _broker_creds.get('schwab', {})
    token = sc.get('token', {})
    if not token.get('access_token'):
        return {}
    # Refresh if expired
    if time.time() > token.get('expires_at', 0):
        token = _schwab_refresh_token()
        if not token:
            return {}
    try:
        r = _req.get(f'{SCHWAB_QUOTES_URL}?symbols={symbol}&fields=quote',
            headers={'Authorization': f'Bearer {token["access_token"]}'},
            timeout=10)
        if r.status_code == 200:
            return r.json().get(symbol, {}).get('quote', {})
    except Exception as e:
        print(f'[Schwab] Quote error ({symbol}): {e}')
    return {}


SCHWAB_CHAIN_URL   = 'https://api.schwabapi.com/marketdata/v1/chains'
SCHWAB_HISTORY_URL = 'https://api.schwabapi.com/marketdata/v1/pricehistory'

def _schwab_access_token():
    """Return a valid Schwab access_token, auto-refreshing if expired."""
    import time
    sc = _broker_creds.get('schwab', {})
    token = sc.get('token', {})
    if not token.get('access_token'):
        return None
    if time.time() > token.get('expires_at', 0):
        token = _schwab_refresh_token()
        if not token:
            return None
    return token['access_token']

def _schwab_price_history(symbol, period_days=90):
    """Fetch 1-hour OHLCV bars from Schwab. Returns pd.DataFrame or empty."""
    import requests as _req
    tok = _schwab_access_token()
    if not tok:
        return pd.DataFrame()
    if symbol.endswith('=F'):
        return pd.DataFrame()   # futures not in Individual Trader API
    try:
        months = max(1, min(6, round(period_days / 30)))
        params = {
            'symbol':                symbol,
            'periodType':            'month',
            'period':                str(months),
            'frequencyType':         'minute',
            'frequency':             '60',
            'needExtendedHoursData': 'false',
        }
        r = _req.get(SCHWAB_HISTORY_URL, params=params,
                     headers={'Authorization': f'Bearer {tok}'}, timeout=20)
        if r.status_code == 401:
            tok = _schwab_access_token()
            if not tok:
                return pd.DataFrame()
            r = _req.get(SCHWAB_HISTORY_URL, params=params,
                         headers={'Authorization': f'Bearer {tok}'}, timeout=20)
        if r.status_code != 200:
            print(f'[Schwab History] {symbol}: HTTP {r.status_code}')
            return pd.DataFrame()
        data = r.json()
        if data.get('empty', True) or not data.get('candles'):
            return pd.DataFrame()
        df = pd.DataFrame(data['candles'])
        df['datetime'] = pd.to_datetime(df['datetime'], unit='ms', utc=True).dt.tz_convert('America/New_York')
        df = df.set_index('datetime').rename(columns={
            'open': 'Open', 'high': 'High', 'low': 'Low',
            'close': 'Close', 'volume': 'Volume'
        })[['Open', 'High', 'Low', 'Close', 'Volume']]
        print(f'[Schwab] {symbol}: {len(df)} 1H bars')
        return df
    except Exception as e:
        print(f'[Schwab History] {symbol}: {e}')
        return pd.DataFrame()

def _schwab_chain_raw(symbol, strike_count=60):
    """Fetch full option chain from Schwab. Returns JSON dict or None."""
    import requests as _req
    if symbol.endswith('=F'):
        return None   # futures options not in Individual Trader API
    tok = _schwab_access_token()
    if not tok:
        return None
    try:
        params = {
            'symbol':                symbol,
            'contractType':          'ALL',
            'strikeCount':           str(strike_count),
            'includeUnderlyingQuote':'true',
            'strategy':              'SINGLE',
        }
        r = _req.get(SCHWAB_CHAIN_URL, params=params,
                     headers={'Authorization': f'Bearer {tok}'}, timeout=25)
        if r.status_code == 401:
            tok = _schwab_access_token()
            if not tok:
                return None
            r = _req.get(SCHWAB_CHAIN_URL, params=params,
                         headers={'Authorization': f'Bearer {tok}'}, timeout=25)
        if r.status_code != 200:
            print(f'[Schwab Chain] {symbol}: HTTP {r.status_code}')
            return None
        data = r.json()
        if data.get('status') != 'SUCCESS':
            print(f'[Schwab Chain] {symbol}: status={data.get("status")}')
            return None
        return data
    except Exception as e:
        print(f'[Schwab Chain] {symbol}: {e}')
        return None

def _schwab_gex_from_chain(chain, symbol, group, spot):
    """Compute GEX row from Schwab option chain JSON (uses Schwab gamma directly)."""
    today = datetime.now().date()
    R = 0.05
    gex_by_k, coi_by_k, poi_by_k = {}, {}, {}
    lo, hi = spot * 0.85, spot * 1.15
    target_expiries = set()

    for side, sign in [('callExpDateMap', +1), ('putExpDateMap', -1)]:
        for exp_key, strikes_dict in chain.get(side, {}).items():
            exp_str = exp_key.split(':')[0]
            try:
                dte = (datetime.strptime(exp_str, '%Y-%m-%d').date() - today).days
            except Exception:
                continue
            if dte < 0 or dte > 60:
                continue
            target_expiries.add(exp_str)
            T = max(dte, 1) / 365.0
            for strike_str, contracts in strikes_dict.items():
                for c in contracts:
                    K = float(c.get('strikePrice') or strike_str)
                    if not (lo <= K <= hi):
                        continue
                    OI = int(c.get('openInterest') or 0)
                    if OI <= 0:
                        continue
                    # Prefer Schwab's pre-computed gamma; fall back to Black-Scholes
                    gamma = float(c.get('gamma') or 0)
                    if gamma <= 0:
                        iv = float(c.get('volatility') or 0)
                        if iv > 2: iv /= 100.0   # Schwab sometimes returns percent
                        gamma = _bs_gamma(spot, K, T, R, iv) if iv > 0 else 0.0
                    gex_val = gamma * OI * 100 * spot * sign
                    gex_by_k[K] = gex_by_k.get(K, 0.0) + gex_val
                    if sign > 0:
                        coi_by_k[K] = coi_by_k.get(K, 0) + OI
                    else:
                        poi_by_k[K] = poi_by_k.get(K, 0) + OI

    if not gex_by_k:
        return None

    strikes  = sorted(gex_by_k)
    gex_vals = [gex_by_k[k] for k in strikes]
    call_oi  = [coi_by_k.get(k, 0) for k in strikes]
    put_oi   = [poi_by_k.get(k, 0) for k in strikes]
    total_gex = sum(gex_vals)

    pos_items = [(k, v) for k, v in zip(strikes, gex_vals) if v > 0]
    neg_items = [(k, v) for k, v in zip(strikes, gex_vals) if v < 0]
    gamma_wall  = max(pos_items, key=lambda x: x[1])[0] if pos_items else None
    put_wall    = min(neg_items, key=lambda x: x[1])[0] if neg_items else None
    cwall_i     = max(range(len(strikes)), key=lambda i: call_oi[i]) if strikes else 0
    call_wall   = strikes[cwall_i] if strikes else None

    cum, flip_level = 0.0, None
    for k, g in zip(strikes, gex_vals):
        prev = cum; cum += g
        if prev != 0 and prev * cum <= 0 and flip_level is None:
            flip_level = k
    if flip_level is None:
        flip_level = min(strikes, key=lambda k: abs(k - spot))

    tot_c = sum(call_oi); tot_p = sum(put_oi)
    pcr = round(tot_p / max(tot_c, 1), 2)

    row = {
        'symbol':      symbol,
        'label':       SYMBOL_LABELS.get(symbol, symbol),
        'group':       group,
        'asset_type':  _asset_type_for(symbol),
        'spot':        round(spot, 4),
        'strikes':     [round(k, 2) for k in strikes],
        'gex':         [round(v / 1e6, 3) for v in gex_vals],
        'call_oi':     call_oi,
        'put_oi':      put_oi,
        'total_gex_m': round(total_gex / 1e6, 2),
        'gamma_wall':  round(gamma_wall, 2) if gamma_wall else None,
        'put_wall':    round(put_wall,   2) if put_wall   else None,
        'call_wall':   round(call_wall,  2) if call_wall  else None,
        'flip_level':  round(flip_level, 2) if flip_level else None,
        'regime':      'Long Gamma' if total_gex >= 0 else 'Short Gamma',
        'pcr':         pcr,
        'expiries':    sorted(target_expiries),
        'no_options':  False,
        'source':      'schwab',
    }
    print(f'[Schwab GEX] {symbol}: {len(strikes)} strikes, net={round(total_gex/1e6,1)}M, regime={row["regime"]}')
    return row

def _schwab_flows_from_chain(chain, symbol, group, spot):
    """Compute option flows row from Schwab option chain JSON."""
    today = datetime.now().date()
    strike_data = {}
    flow_expiries = []
    has_0dte = False
    lo, hi = spot * 0.85, spot * 1.15
    dte0_call_vol = 0; dte0_put_vol = 0
    unusual = []

    # Identify which expiries to include (0DTE + next 7 days)
    all_exp = {}
    for exp_key in chain.get('callExpDateMap', {}):
        exp_str = exp_key.split(':')[0]
        try:
            dte = (datetime.strptime(exp_str, '%Y-%m-%d').date() - today).days
            all_exp[exp_str] = dte
        except Exception:
            pass

    target_exps = set()
    for exp_str, dte in sorted(all_exp.items(), key=lambda x: x[1]):
        if dte == 0:
            has_0dte = True; target_exps.add(exp_str); flow_expiries.append((exp_str, 0))
        elif 1 <= dte <= 7:
            target_exps.add(exp_str); flow_expiries.append((exp_str, dte))
    if not target_exps:
        for exp_str, dte in sorted(all_exp.items(), key=lambda x: x[1])[:2]:
            if dte >= 0:
                target_exps.add(exp_str); flow_expiries.append((exp_str, dte))

    def _ensure(K):
        if K not in strike_data:
            strike_data[K] = {'call_vol':0,'put_vol':0,'call_oi':0,'put_oi':0,
                               'call_prem':0.0,'put_prem':0.0}

    for side, is_call in [('callExpDateMap', True), ('putExpDateMap', False)]:
        for exp_key, strikes_dict in chain.get(side, {}).items():
            exp_str = exp_key.split(':')[0]
            if exp_str not in target_exps:
                continue
            dte = all_exp.get(exp_str, 7)
            is_0dte = (dte == 0)
            for strike_str, contracts in strikes_dict.items():
                for c in contracts:
                    K = float(c.get('strikePrice') or strike_str)
                    if not (lo <= K <= hi):
                        continue
                    _ensure(K)
                    vol = int(c.get('totalVolume') or 0)
                    oi  = int(c.get('openInterest') or 0)
                    bid = float(c.get('bid') or 0)
                    ask = float(c.get('ask') or 0)
                    mark = (bid + ask) / 2 if bid > 0 and ask > 0 else float(c.get('mark') or 0)
                    prem = vol * mark * 100
                    if is_call:
                        strike_data[K]['call_vol']  += vol
                        strike_data[K]['call_oi']   += oi
                        strike_data[K]['call_prem'] += prem
                        if is_0dte: dte0_call_vol += vol
                    else:
                        strike_data[K]['put_vol']  += vol
                        strike_data[K]['put_oi']   += oi
                        strike_data[K]['put_prem'] += prem
                        if is_0dte: dte0_put_vol += vol
                    if oi > 0 and vol > oi * 2 and vol > 500:
                        unusual.append({'type': 'CALL' if is_call else 'PUT',
                                        'strike': K, 'expiry': exp_str,
                                        'vol': vol, 'ratio': round(vol / max(oi, 1), 1),
                                        'premium_k': round(prem / 1000, 2)})

    if not strike_data:
        return None

    skeys = sorted(strike_data)
    call_vol_a  = [strike_data[k]['call_vol']  for k in skeys]
    put_vol_a   = [strike_data[k]['put_vol']   for k in skeys]
    call_prem_k = [round(strike_data[k]['call_prem'] / 1000, 2) for k in skeys]
    put_prem_k  = [round(strike_data[k]['put_prem']  / 1000, 2) for k in skeys]
    net_prem_k  = [round((strike_data[k]['call_prem'] - strike_data[k]['put_prem']) / 1000, 2) for k in skeys]

    total_call_vol  = sum(call_vol_a);  total_put_vol  = sum(put_vol_a)
    total_call_prem = sum(strike_data[k]['call_prem'] for k in skeys)
    total_put_prem  = sum(strike_data[k]['put_prem']  for k in skeys)

    pcr_vol  = round(total_put_vol  / (total_call_vol  + 1e-9), 3)
    pcr_prem = round(total_put_prem / (total_call_prem + 1e-9), 3)
    if   total_call_prem > total_put_prem * 1.25: sentiment = 'BULLISH'
    elif total_put_prem  > total_call_prem * 1.25: sentiment = 'BEARISH'
    else:                                           sentiment = 'NEUTRAL'

    avg_dte = (sum(d for _, d in flow_expiries) / len(flow_expiries)) if flow_expiries else 7
    avg_T   = max(avg_dte, 1) / 365.0
    sigma   = 0.25
    dealer_delta_k = []
    for k in skeys:
        cd   = _bs_delta(spot, k, avg_T, 0.0, sigma, 'call')
        pd_a = abs(_bs_delta(spot, k, avg_T, 0.0, sigma, 'put'))
        buy  = strike_data[k]['call_vol'] * cd   * 100 * spot / 1000
        sell = strike_data[k]['put_vol']  * pd_a * 100 * spot / 1000
        dealer_delta_k.append(round(buy - sell, 2))
    net_dealer_delta_m = round(sum(dealer_delta_k) / 1000, 3)

    max_pain_strike = _compute_max_pain(strike_data, skeys)
    total_oi_by_k   = {k: strike_data[k]['call_oi'] + strike_data[k]['put_oi'] for k in skeys}
    pin_risk_strike = max(skeys, key=lambda k: total_oi_by_k[k]) if skeys else 0.0

    above = [k for k in skeys if k > spot * 1.005]
    below = [k for k in skeys if k < spot * 0.995]
    squeeze_potential = False; squeeze_strike = 0.0
    crash_potential   = False; crash_strike   = 0.0
    if above:
        sc = max(above, key=lambda k: strike_data[k]['call_oi'])
        if strike_data[sc]['call_oi'] > 2000:
            squeeze_potential = True; squeeze_strike = sc
    if below:
        sp = max(below, key=lambda k: strike_data[k]['put_oi'])
        if strike_data[sp]['put_oi'] > 2000:
            crash_potential = True; crash_strike = sp

    cm, pm = total_call_prem / 1e6, total_put_prem / 1e6
    parts = []
    if sentiment == 'BULLISH':
        parts.append(f'Call premium dominates: ${cm:.2f}M calls vs ${pm:.2f}M puts (P/C {pcr_prem:.2f}).')
    elif sentiment == 'BEARISH':
        parts.append(f'Put premium dominates: ${pm:.2f}M puts vs ${cm:.2f}M calls (P/C {pcr_prem:.2f}).')
    else:
        parts.append(f'Mixed flow: ${cm:.2f}M calls vs ${pm:.2f}M puts (P/C {pcr_prem:.2f}).')
    top_c = max(strike_data, key=lambda k: strike_data[k]['call_vol'], default=None)
    top_p = max(strike_data, key=lambda k: strike_data[k]['put_vol'],  default=None)
    if top_c: parts.append(f'Highest call volume at ${top_c:.0f}.')
    if top_p: parts.append(f'Highest put volume at ${top_p:.0f}.')
    if has_0dte: parts.append(f'0DTE: {int(dte0_call_vol):,} calls / {int(dte0_put_vol):,} puts.')
    if unusual:
        top_u = sorted(unusual, key=lambda x: x['ratio'], reverse=True)[:3]
        parts.append('Unusual: ' + ', '.join(f"${u['strike']:.0f} {u['type']} {u['ratio']}x OI" for u in top_u) + '.')
    dir_word = 'BUY' if net_dealer_delta_m >= 0 else 'SELL'
    parts.append(f'Dealer delta hedging requires ~${abs(net_dealer_delta_m):.2f}M in {dir_word} orders.')

    print(f'[Schwab Flows] {symbol}: {sentiment}, call_vol={total_call_vol:,}, put_vol={total_put_vol:,}')
    return {
        'symbol':             symbol,
        'label':              SYMBOL_LABELS.get(symbol, symbol),
        'group':              group,
        'asset_type':         _asset_type_for(symbol),
        'spot':               round(spot, 4),
        'no_options':         False,
        'has_0dte':           has_0dte,
        'flow_expiries':      [[e, d] for e, d in flow_expiries],
        'strikes':            [round(k, 2) for k in skeys],
        'call_vol':           call_vol_a,
        'put_vol':            put_vol_a,
        'call_prem_k':        call_prem_k,
        'put_prem_k':         put_prem_k,
        'net_prem_k':         net_prem_k,
        'dealer_delta_k':     dealer_delta_k,
        'net_dealer_delta_m': net_dealer_delta_m,
        'max_pain_strike':    round(max_pain_strike, 2),
        'pin_risk_strike':    round(pin_risk_strike, 2),
        'squeeze_potential':  squeeze_potential,
        'squeeze_strike':     round(squeeze_strike, 2),
        'crash_potential':    crash_potential,
        'crash_strike':       round(crash_strike, 2),
        'total_call_vol':     int(total_call_vol),
        'total_put_vol':      int(total_put_vol),
        'total_call_prem_m':  round(total_call_prem / 1e6, 3),
        'total_put_prem_m':   round(total_put_prem / 1e6, 3),
        'pcr_vol':            pcr_vol,
        'pcr_prem':           pcr_prem,
        'flow_sentiment':     sentiment,
        'unusual':            unusual[:20],
        'dte0_call_vol':      int(dte0_call_vol),
        'dte0_put_vol':       int(dte0_put_vol),
        'description':        ' '.join(parts),
        'source':             'schwab',
    }

@app.route('/api/broker-connect/schwab/auth-url', methods=['POST'])
def schwab_auth_url():
    """Step 1: Store credentials and return the OAuth authorization URL."""
    import urllib.parse
    data = request.get_json(force=True)
    client_id     = data.get('client_id', '').strip()
    client_secret = data.get('client_secret', '').strip()
    callback_url  = data.get('callback_url', '').strip()
    if not client_id or not client_secret:
        return jsonify({'ok': False, 'error': 'App Key and App Secret are required'})
    if not callback_url:
        callback_url = 'https://127.0.0.1'
    # Save credentials (no token yet)
    _broker_creds['schwab'] = {
        'client_id': client_id,
        'client_secret': client_secret,
        'callback_url': callback_url,
    }
    _save_broker_creds(_broker_creds)
    auth_url = (f"{SCHWAB_AUTH_URL}?response_type=code"
                f"&client_id={urllib.parse.quote(client_id)}"
                f"&redirect_uri={urllib.parse.quote(callback_url)}")
    return jsonify({'ok': True, 'auth_url': auth_url})

@app.route('/api/broker-connect/schwab/token', methods=['POST'])
def schwab_exchange_token():
    """Step 2: Exchange the authorization code (from redirect URL) for tokens."""
    import requests as _req
    import base64, time, urllib.parse
    data = request.get_json(force=True)
    redirect_response = data.get('redirect_response', '').strip()
    sc = _broker_creds.get('schwab', {})
    client_id     = sc.get('client_id', '')
    client_secret = sc.get('client_secret', '')
    callback_url  = sc.get('callback_url', '')
    if not (redirect_response and client_id and client_secret and callback_url):
        return jsonify({'ok': False, 'error': 'Complete Step 1 first, then paste the redirect URL'})
    # Extract authorization code from redirect URL
    try:
        parsed = urllib.parse.urlparse(redirect_response)
        params = urllib.parse.parse_qs(parsed.query)
        code = params.get('code', [None])[0]
        if not code:
            return jsonify({'ok': False, 'error': 'No authorization code found in the URL — paste the full redirect URL'})
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Could not parse URL: {e}'})
    # Exchange code for tokens
    try:
        creds_b64 = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
        r = _req.post(SCHWAB_TOKEN_URL,
            headers={'Authorization': f'Basic {creds_b64}',
                     'Content-Type': 'application/x-www-form-urlencoded'},
            data={'grant_type': 'authorization_code', 'code': code,
                  'redirect_uri': callback_url},
            timeout=15)
        if r.status_code != 200:
            return jsonify({'ok': False, 'error': f'Token exchange failed ({r.status_code}): {r.text[:200]}'})
        td = r.json()
        td['expires_at'] = time.time() + td.get('expires_in', 1800) - 60
        _broker_creds['schwab']['token'] = td
        _save_broker_creds(_broker_creds)
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Request error: {e}'})
    # Confirm with a live quote
    q = _schwab_quote('SPY')
    spot = q.get('lastPrice', '—')
    return jsonify({'ok': True, 'message': f'Schwab connected ✓ — SPY ${spot}'})

@app.route('/schwab-callback')
def schwab_callback():
    """Auto-capture Schwab OAuth redirect and exchange code for tokens immediately."""
    import base64, time
    import requests as _req
    global _schwab_auth_result
    code = request.args.get('code', '').strip()
    if not code:
        error = request.args.get('error', 'unknown')
        _schwab_auth_result = {'ok': False, 'error': error}
        return f'<h2 style="font-family:sans-serif;color:#f87171;padding:2rem;">Authorization failed: {error}<br><br>Close this tab and try again.</h2>', 400
    sc = _broker_creds.get('schwab', {})
    client_id     = sc.get('client_id', '')
    client_secret = sc.get('client_secret', '')
    callback_url  = request.base_url
    if not (client_id and client_secret):
        _schwab_auth_result = {'ok': False, 'error': 'Schwab credentials not found — complete Step 1 first'}
        return 'Error: credentials not found', 400
    try:
        creds_b64 = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
        r = _req.post(SCHWAB_TOKEN_URL,
            headers={'Authorization': f'Basic {creds_b64}',
                     'Content-Type': 'application/x-www-form-urlencoded'},
            data={'grant_type': 'authorization_code', 'code': code, 'redirect_uri': callback_url},
            timeout=15)
        if r.status_code != 200:
            _schwab_auth_result = {'ok': False, 'error': f'Token exchange failed ({r.status_code}): {r.text[:200]}'}
            return f'<h2 style="font-family:sans-serif;color:#f87171;padding:2rem;">Token exchange failed ({r.status_code})<br>{r.text[:200]}<br><br>Close this tab and try again.</h2>', 400
        td = r.json()
        td['expires_at'] = time.time() + td.get('expires_in', 1800) - 60
        _broker_creds['schwab']['token'] = td
        _save_broker_creds(_broker_creds)
    except Exception as e:
        _schwab_auth_result = {'ok': False, 'error': str(e)}
        return f'Error: {e}', 500
    q = _schwab_quote('SPY')
    spot = q.get('lastPrice', '—')
    _schwab_auth_result = {'ok': True, 'spot': str(spot)}
    return f'<html><body style="font-family:sans-serif;background:#070d18;color:#4ade80;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center"><h2>&#10003; Schwab Connected!</h2><p style="color:#94a3b8;">SPY ${spot} &mdash; you can close this tab.</p><script>try{{window.opener.postMessage({{type:"schwab_connected",spot:"{spot}"}},"*");}}catch(e){{}}setTimeout(function(){{window.close();}},2000);</script></div></body></html>'


@app.route('/api/broker-connect/schwab/auth-status')
def schwab_auth_status():
    """Poll endpoint — returns result of latest /schwab-callback exchange."""
    return jsonify(_schwab_auth_result)

@app.route('/api/broker-connect/schwab/exchange-code', methods=['POST'])
def schwab_exchange_code():
    """Exchange just the auth code (no full URL needed). Used by popup auto-capture."""
    import base64, time
    import requests as _req
    data = request.get_json(force=True)
    code = data.get('code', '').strip()
    if not code:
        return jsonify({'ok': False, 'error': 'No code provided'})
    sc = _broker_creds.get('schwab', {})
    client_id     = sc.get('client_id', '')
    client_secret = sc.get('client_secret', '')
    callback_url  = sc.get('callback_url', 'https://127.0.0.1')
    if not (client_id and client_secret):
        return jsonify({'ok': False, 'error': 'Complete Step 1 first'})
    try:
        creds_b64 = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
        r = _req.post(SCHWAB_TOKEN_URL,
            headers={'Authorization': f'Basic {creds_b64}',
                     'Content-Type': 'application/x-www-form-urlencoded'},
            data={'grant_type': 'authorization_code', 'code': code,
                  'redirect_uri': callback_url},
            timeout=15)
        if r.status_code != 200:
            return jsonify({'ok': False, 'error': f'Token exchange failed ({r.status_code}): {r.text[:200]}'})
        td = r.json()
        td['expires_at'] = time.time() + td.get('expires_in', 1800) - 60
        _broker_creds['schwab']['token'] = td
        _save_broker_creds(_broker_creds)
    except Exception as e:
        return jsonify({'ok': False, 'error': f'Request error: {e}'})
    q = _schwab_quote('SPY')
    spot = q.get('lastPrice', '—')
    return jsonify({'ok': True, 'message': f'Schwab connected ✓ — SPY ${spot}'})

@app.route('/api/broker-disconnect/schwab', methods=['POST'])
def schwab_disconnect():
    _broker_creds.pop('schwab', None)
    _save_broker_creds(_broker_creds)
    return jsonify({'ok': True})



# ── Broker: IBKR (re-use existing ibkr-connect) ──────────────────────────────
@app.route('/api/broker-connect/ibkr', methods=['POST'])
def broker_connect_ibkr():
    data = request.get_json(force=True)
    return ibkr_connect()

@app.route('/api/broker-disconnect/ibkr', methods=['POST'])
def broker_disconnect_ibkr():
    return ibkr_disconnect()

# ── Static website serving ────────────────────────────────────────────────────
_WEBSITE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'website')

@app.route('/')
def index():
    return send_from_directory(_WEBSITE_DIR, 'live-trading.html')


# ── Broker status (must be before catch-all static route) ────────────────────
@app.route('/api/broker-status')
def broker_status():
    """Return connection status for all brokers."""
    import time
    sc = _broker_creds.get('schwab', {})
    sc_token = sc.get('token', {})
    sc_has_token = bool(sc_token.get('access_token'))
    sc_expired = time.time() > sc_token.get('expires_at', 0)
    sc_has_refresh = bool(sc_token.get('refresh_token'))

    # Determine effective Schwab status
    if sc_has_token and not sc_expired:
        sc_status = 'connected'
        sc_msg = 'Schwab connected ✓ (token valid)'
    elif sc_has_refresh:
        sc_status = 'refresh'
        sc_msg = 'Schwab token expired — auto-refreshing...'
    elif sc.get('client_id'):
        sc_status = 'needs_auth'
        sc_msg = 'Schwab credentials saved — re-authorize to connect'
    else:
        sc_status = 'disconnected'
        sc_msg = 'Schwab not connected'

    return jsonify({
        'finnhub':   {'connected': bool(_finnhub_client),
                      'msg': 'Finnhub connected' if _finnhub_client else 'Not connected'},
        'schwab':    {'connected': sc_status == 'connected',
                      'status': sc_status,
                      'msg': sc_msg,
                      'has_credentials': bool(sc.get('client_id')),
                      'has_refresh': sc_has_refresh},
        'ibkr':      {'connected': bool(_ib_connection_info)},
        'timestamp': datetime.now().isoformat(),
    })


@app.route('/audio/<path:filename>')
def serve_audio(filename):
    audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'audio')
    resp = send_from_directory(audio_dir, filename)
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return resp

@app.route('/video/<path:filename>')
def serve_video(filename):
    video_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'video')
    return send_from_directory(video_dir, filename)

@app.route('/videos/<path:filename>')
def serve_videos(filename):
    video_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'website', 'videos')
    return send_from_directory(video_dir, filename)

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(_WEBSITE_DIR, filename)



# ── Real-Time News API ────────────────────────────────────────────────────────
_news_cache = {'data': [], 'ts': 0}
_NEWS_TTL = 90  # seconds

def _fetch_rss(url, source_name, symbol=None):
    import urllib.request, xml.etree.ElementTree as ET, time
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as r:
            xml_data = r.read()
        root = ET.fromstring(xml_data)
        items = []
        for item in root.findall('.//item')[:25]:
            title   = (item.findtext('title') or '').strip()
            link    = (item.findtext('link') or '').strip()
            summary = (item.findtext('description') or '').strip()
            pub     = (item.findtext('pubDate') or '').strip()
            if not title: continue
            try:
                from email.utils import parsedate_to_datetime
                ts = parsedate_to_datetime(pub).timestamp()
            except Exception:
                ts = time.time()
            items.append({'title': title, 'url': link, 'summary': summary,
                          'source': source_name, 'ts': ts,
                          'category': 'general', 'tickers': [symbol] if symbol else []})
        return items
    except Exception as e:
        print(f'[News] {source_name} RSS error: {e}')
        return []


def _fetch_finnhub_news():
    import time
    try:
        if not _finnhub_client:
            return []
        raw = _finnhub_client.general_news('general', min_id=0)
        items = []
        for a in (raw or [])[:30]:
            items.append({
                'title':    a.get('headline', '').strip(),
                'url':      a.get('url', ''),
                'summary':  a.get('summary', '').strip(),
                'source':   a.get('source', 'Finnhub'),
                'ts':       float(a.get('datetime', time.time())),
                'category': a.get('category', 'general'),
                'tickers':  a.get('related', '').split(',') if a.get('related') else [],
                'image':    a.get('image', ''),
            })
        return [x for x in items if x['title']]
    except Exception as e:
        print(f'[News] Finnhub error: {e}')
        return []

def _fetch_eod_news(symbol=None):
    import time, urllib.request, json as _json
    try:
        eod_key = _broker_creds.get('eod', {}).get('api_key', '')
        if not eod_key:
            return []
        if symbol:
            url = f'https://eodhistoricaldata.com/api/news?api_token={eod_key}&s={symbol}.US&limit=20&fmt=json'
        else:
            url = f'https://eodhistoricaldata.com/api/news?api_token={eod_key}&limit=30&fmt=json'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = _json.loads(r.read())
        items = []
        for a in (raw or []):
            title = (a.get('title') or '').strip()
            if not title: continue
            try:
                from datetime import datetime as _dt
                ts = _dt.strptime(a.get('date', '')[:19], '%Y-%m-%d %H:%M:%S').timestamp()
            except Exception:
                ts = time.time()
            items.append({
                'title':    title,
                'url':      a.get('link', ''),
                'summary':  (a.get('content') or a.get('summary') or '')[:300].strip(),
                'source':   'EOD',
                'ts':       ts,
                'category': 'general',
                'tickers':  [t.get('Code', '') for t in (a.get('symbols') or [])],
                'sentiment_score': a.get('sentiment', {}).get('polarity', 0) if isinstance(a.get('sentiment'), dict) else 0,
            })
        return items
    except Exception as e:
        print(f'[News] EOD error: {e}')
        return []

def _sentiment_label(item):
    pol = item.get('sentiment_score', None)
    if pol is not None:
        if pol > 0.1:  return 'bullish'
        if pol < -0.1: return 'bearish'
        return 'neutral'
    title = item.get('title', '').lower()
    bull = ['surge','rally','jump','gain','rise','beat','record','strong','upgrade']
    bear = ['fall','drop','plunge','decline','miss','weak','downgrade','loss','crash','cut']
    if any(w in title for w in bull): return 'bullish'
    if any(w in title for w in bear): return 'bearish'
    return 'neutral'

@app.route('/api/news')
def api_news():
    import time
    symbol  = request.args.get('symbol', '').upper().strip()
    nocache = request.args.get('nocache', '')
    now = time.time()
    if not symbol and not nocache and (now - _news_cache['ts']) < _NEWS_TTL:
        return jsonify({'ok': True, 'articles': _news_cache['data'], 'cached': True,
                        'count': len(_news_cache['data']), 'timestamp': _news_cache['ts']})
    fh   = _fetch_finnhub_news()
    eod  = _fetch_eod_news(symbol or None)
    cnbc = _fetch_rss('https://www.cnbc.com/id/100003114/device/rss/rss.html', 'CNBC')
    mw1  = _fetch_rss('https://feeds.marketwatch.com/marketwatch/topstories/', 'MarketWatch')
    mw2  = _fetch_rss('https://feeds.marketwatch.com/marketwatch/marketpulse/', 'MarketWatch')
    all_items = fh + eod + cnbc + mw1 + mw2
    if symbol:
        all_items += _fetch_rss(f'https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US', 'Yahoo Finance', symbol)
    _news_debug = {'finnhub': len(fh), 'eod': len(eod), 'cnbc': len(cnbc), 'mw1': len(mw1), 'mw2': len(mw2), 'total': len(all_items)}
    seen_urls, seen_titles, unique = set(), set(), []
    for item in sorted(all_items, key=lambda x: x['ts'], reverse=True):
        url        = item.get('url', '')
        title_key  = item['title'][:60].lower().strip()
        if (url and url in seen_urls) or title_key in seen_titles:
            continue
        if url: seen_urls.add(url)
        seen_titles.add(title_key)
        item['sentiment'] = _sentiment_label(item)
        unique.append(item)
    unique = unique[:60]
    if not symbol:
        _news_cache['data'] = unique
        _news_cache['ts']   = now
    return jsonify({'ok': True, 'articles': unique, 'cached': False,
                    'count': len(unique), 'timestamp': now, 'debug': _news_debug})

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.now().isoformat()})


@app.route('/api/ibkr-connect', methods=['POST'])
def ibkr_connect():
    """
    Connect (or reconnect) to IBKR TWS/Gateway with caller-supplied settings.
    Body JSON: { "host": "127.0.0.1", "port": 7497, "clientId": 10 }
    On success clears the data cache so the next fetch uses live IBKR data.
    """
    global _ib, _ib_connected, _ib_error, _ib_connection_info
    if not IB_AVAILABLE:
        return jsonify({'success': False,
                        'error': 'ib_async not installed — run: pip install ib_async'}), 400

    body      = request.get_json(silent=True) or {}
    host      = str(body.get('host',     '127.0.0.1'))
    port      = int(body.get('port',     7497))
    client_id = int(body.get('clientId', 10))

    with _ib_lock:
        # Tear down existing connection
        if _ib is not None:
            try: _ib.disconnect()
            except Exception: pass
            _ib = None
        _ib_connected = False
        _ib_error     = ''

        try:
            ib = IB()
            ib.connect(host, port, clientId=client_id, timeout=8)
            if ib.isConnected():
                _ib = ib
                _ib_connected = True
                _ib_connection_info = {'host': host, 'port': port, 'clientId': client_id}
                # ── Clear stale yfinance cache so next fetch uses IBKR ──
                _cache.clear()
                _api_resp_cache.clear()
                print(f"[IBKR] Connected via /api/ibkr-connect → {host}:{port} cid={client_id}")
                try:
                    acct = ib.managedAccounts()
                    account = acct[0] if acct else 'unknown'
                except Exception:
                    account = 'unknown'
                return jsonify({
                    'success':     True,
                    'connected':   True,
                    'host':        host,
                    'port':        port,
                    'clientId':    client_id,
                    'account':     account,
                    'data_source': 'IBKR real-time',
                    'time':        datetime.now().isoformat()
                })
            else:
                _ib_error = f'TCP connected to {host}:{port} but IB handshake failed'
                return jsonify({'success': False, 'error': _ib_error}), 500
        except Exception as e:
            _ib_error = str(e)
            print(f"[IBKR] /api/ibkr-connect failed: {e}")
            # Provide a helpful message for the most common errors
            msg = str(e)
            if 'refused' in msg.lower() or '1225' in msg or '111' in msg:
                msg = (f'Connection refused on {host}:{port}. '
                       f'Is TWS or IB Gateway running with API enabled?')
            elif 'timed out' in msg.lower():
                msg = (f'Timeout connecting to {host}:{port}. '
                       f'Check that API socket port matches TWS configuration.')
            return jsonify({'success': False, 'error': msg}), 500


@app.route('/api/ibkr-disconnect', methods=['POST'])
def ibkr_disconnect():
    """Disconnect from IBKR and fall back to yfinance."""
    global _ib, _ib_connected, _ib_error, _ib_connection_info
    with _ib_lock:
        # stop any real-time stream subscriptions that depend on IBKR
        try:
            orderflow_stop_all()
        except Exception:
            pass
        if _ib is not None:
            try: _ib.disconnect()
            except Exception: pass
            _ib = None
        _ib_connected = False
        _ib_error = ''
        _ib_connection_info = {}
    return jsonify({'success': True, 'data_source': 'yfinance (15-20 min delayed)'})


@app.route('/api/ibkr-status')
def ibkr_status():
    """
    Report current IBKR connection state without attempting a new connection.
    Use POST /api/ibkr-connect to establish a connection.
    """
    # auto_probe=False: just read current state, no blocking I/O
    ib        = get_ib_connection(auto_probe=False)
    connected = (ib is not None and ib.isConnected())
    info      = {}
    if connected:
        try:
            info['server_version'] = str(ib.client.serverVersion())
        except Exception:
            pass
        info.update(_ib_connection_info)
    return jsonify({
        'ib_async_installed': IB_AVAILABLE,
        'connected':          connected,
        'error':              _ib_error if not connected else '',
        'connection':         info,
        'data_source':        'IBKR real-time' if connected else 'yfinance (15-20 min delayed)',
        'time':               datetime.now().isoformat()
    })


@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Force-clear the in-memory data cache so next request fetches fresh data."""
    count = len(_cache)
    _cache.clear()
    _api_resp_cache.clear()
    return jsonify({'cleared': count, 'time': datetime.now().isoformat()})


# ── Orderflow API ─────────────────────────────────────────────────────────────
@app.route('/api/orderflow/snapshot')
def orderflow_snapshot():
    """
    Snapshot for orderflow UI.
    Query: /api/orderflow/snapshot?symbols=SPY,QQQ
    """
    sym_s = (request.args.get('symbols') or 'SPY').strip()
    symbols = [s.strip() for s in sym_s.split(',') if s.strip()]
    status = orderflow_start(symbols)

    # Build snapshot (even if not connected; UI can show status)
    out_assets = []
    with _ORDERFLOW_LOCK:
        for sym in symbols[:8]:
            q = _ORDERFLOW_QUOTES.get(sym) or {"symbol": sym}
            tape = list(_ORDERFLOW_TAPE.get(sym) or [])[-400:]
            series = list(_ORDERFLOW_SERIES.get(sym) or [])[-900:]
            out_assets.append({
                "symbol": sym,
                "quote": q,
                "tape": tape,
                "series": series,
                "subscribed": sym in _ORDERFLOW_SUBS,
            })
        last_id = _ORDERFLOW_EVENT_ID

    return jsonify({
        "success": bool(status.get("success")),
        "status": status,
        "assets": out_assets,
        "last_event_id": last_id,
        "timestamp": datetime.now().isoformat(),
    })


@app.route('/api/orderflow/stream')
def orderflow_stream():
    """
    Server-Sent Events (SSE) stream for orderflow updates.
    Query: /api/orderflow/stream?symbols=SPY,QQQ
    """
    sym_s = (request.args.get('symbols') or 'SPY').strip()
    symbols = [s.strip() for s in sym_s.split(',') if s.strip()][:8]
    sym_set = set(symbols)

    # ensure subscriptions (best-effort)
    _ = orderflow_start(symbols)

    # support resume
    last_id_hdr = request.headers.get("Last-Event-ID")
    try:
        last_id = int(last_id_hdr) if last_id_hdr else int(request.args.get("since", "0"))
    except Exception:
        last_id = 0

    def _fmt_sse(event_id: int | None, event_name: str, data_obj: dict) -> str:
        payload = _json.dumps(data_obj, separators=(",", ":"), ensure_ascii=False)
        lines = []
        if event_id is not None:
            lines.append(f"id: {event_id}")
        lines.append(f"event: {event_name}")
        # SSE requires data lines to be prefixed
        for ln in payload.splitlines() or ["{}"]:
            lines.append(f"data: {ln}")
        lines.append("")  # terminator
        return "\n".join(lines) + "\n"

    @stream_with_context
    def gen():
        nonlocal last_id
        # initial hello
        yield _fmt_sse(last_id, "hello", {"symbols": symbols, "time": datetime.now().isoformat()})
        last_ping = _now_ts()
        while True:
            try:
                batch = []
                with _ORDERFLOW_LOCK:
                    # copy recent events and filter
                    for ev in list(_ORDERFLOW_EVENTS):
                        eid = ev.get("id", 0)
                        if eid and eid > last_id and (not sym_set or ev.get("symbol") in sym_set):
                            batch.append(ev)
                    if batch:
                        last_id = batch[-1].get("id", last_id)
                if batch:
                    yield _fmt_sse(last_id, "batch", {"events": batch, "last_event_id": last_id})
                # keepalive ping every ~10s
                now = _now_ts()
                if now - last_ping >= 10:
                    last_ping = now
                    yield ": ping\n\n"
                time.sleep(0.25)
            except GeneratorExit:
                return
            except Exception:
                time.sleep(0.5)

    headers = {
        "Cache-Control": "no-cache",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
    }
    return Response(gen(), headers=headers)


@app.route('/api/symbols')
def symbols():
    return jsonify({**SYMBOLS, 'labels': SYMBOL_LABELS})


@app.route('/api/candles/<symbol>')
def candles(symbol: str):
    symbol   = symbol.upper()
    interval = request.args.get('interval', '1h')
    period   = request.args.get('period', None)   # None → auto from INTERVAL_CONFIG
    nocache  = request.args.get('nocache', '0') == '1'
    ck       = cache_key(symbol, f'candles:{interval}')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    df = get_candles(symbol, interval=interval, period=period)
    if df.empty:
        return jsonify({'error': f'No data for {symbol}'}), 404

    result = []
    for ts, row in df.iterrows():
        try:
            result.append({
                'time':   int(ts.timestamp()),
                'open':   round(float(row['Open']), 4),
                'high':   round(float(row['High']), 4),
                'low':    round(float(row['Low']), 4),
                'close':  round(float(row['Close']), 4),
                'volume': int(row['Volume'])
            })
        except Exception:
            pass

    cache_set(ck, result)
    return jsonify(result)


def _asset_type_for(symbol: str) -> str:
    """Determine asset_type string for ML model dispatch."""
    if symbol in SYMBOLS.get('futures', []):
        return 'futures'
    if symbol in SYMBOLS.get('options', []):
        return 'options'
    if symbol in INDEX_SYMBOLS:
        return 'index'
    return 'stock'


@app.route('/api/signal/<symbol>')
def signal(symbol: str):
    symbol  = symbol.upper()
    nocache = request.args.get('nocache', '0') == '1'
    ck      = cache_key(symbol, 'signal')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    df_4h = get_4h_candles(symbol, period='120d')
    if df_4h.empty or len(df_4h) < 80:
        return jsonify({'error': f'Insufficient data for {symbol}'}), 500

    df = compute_features(df_4h)
    asset_type = _asset_type_for(symbol)
    result = train_and_predict(df, asset_type=asset_type)
    if result is None:
        return jsonify({'error': f'Could not compute signal for {symbol}'}), 500

    result['symbol'] = symbol
    result['label']  = SYMBOL_LABELS.get(symbol, symbol)

    if symbol in FUTURES_MULTIPLIERS:
        mult = FUTURES_MULTIPLIERS[symbol]
        result['futures_multiplier'] = mult
        result['notional_per_pt']    = mult
        result['risk_dollars']       = round(result['risk_per_unit'] * mult, 2)
        result['reward_dollars']     = round(result['reward_per_unit'] * mult, 2)

    cache_set(ck, result)
    return jsonify(result)


@app.route('/api/multi/<symbols>')
def multi_signal(symbols: str):
    """Fetch signals for multiple comma-separated symbols at once."""
    results = {}
    for sym in symbols.upper().split(','):
        sym = sym.strip()
        ck = cache_key(sym, 'signal')
        cached = cache_get(ck)
        if cached:
            results[sym] = cached
            continue
        df_4h = get_4h_candles(sym, period='120d')
        if df_4h.empty or len(df_4h) < 80:
            results[sym] = {'error': 'insufficient data'}
            continue
        df = compute_features(df_4h)
        res = train_and_predict(df, asset_type=_asset_type_for(sym))
        if res:
            res['symbol'] = sym
            res['label']  = SYMBOL_LABELS.get(sym, sym)
            if sym in FUTURES_MULTIPLIERS:
                mult = FUTURES_MULTIPLIERS[sym]
                res['futures_multiplier'] = mult
                res['risk_dollars']       = round(res['risk_per_unit'] * mult, 2)
                res['reward_dollars']     = round(res['reward_per_unit'] * mult, 2)
            cache_set(ck, res)
            results[sym] = res
        else:
            results[sym] = {'error': 'model failed'}
    return jsonify(results)


# ── Daily candles + multi-horizon forecast ────────────────────────────────────
DAILY_FEAT_COLS = [
    'sma20_ratio', 'sma50_ratio', 'macd', 'macd_signal', 'macd_hist',
    'rsi', 'stoch_k', 'bb_width', 'bb_pos', 'vol_ratio',
    'ret1', 'ret5', 'ret20', 'atr_pct', 'oc_range', 'hl_range',
]


def get_daily_candles(symbol: str, period: str = '2y') -> pd.DataFrame:
    """Download daily OHLCV bars from yfinance."""
    try:
        tk = yf.Ticker(symbol)
        df = tk.history(period=period, interval='1d')
        if df.empty:
            return pd.DataFrame()
        if df.index.tz is not None:
            df.index = df.index.tz_localize(None)
        return df[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
    except Exception as e:
        print(f"[daily candles] {symbol}: {e}")
        return pd.DataFrame()


def forecast_multi_horizon(symbol: str, asset_type: str = 'stock') -> dict | None:
    """
    Train lightweight GBM models for 1-day, 5-day, and 20-day forward return
    targets using daily bars.  Returns per-horizon forecasts plus a 1-year
    daily OHLCV array for charting.
    """
    ck = cache_key(symbol, 'forecast')
    cached = cache_get(ck)
    if cached:
        return cached

    try:
        df_raw = get_daily_candles(symbol, period='2y')
        if df_raw.empty or len(df_raw) < 120:
            return None

        df = compute_features(df_raw)
        missing = [c for c in DAILY_FEAT_COLS if c not in df.columns]
        if missing:
            print(f"[forecast] {symbol} missing daily cols: {missing}")
            return None

        df = df.dropna(subset=DAILY_FEAT_COLS)
        if len(df) < 80:
            return None

        close     = df['Close']
        forecasts: dict[str, dict] = {}
        horizons   = {'1d': 1, '1w': 5, '1m': 20}
        thresholds = {'1d': (0.60, 0.40), '1w': (0.58, 0.42), '1m': (0.55, 0.45)}

        for label, n in horizons.items():
            fwd_pct   = (close.shift(-n) / close - 1)
            direction = (fwd_pct > 0).astype(int)
            d = df.copy()
            d['_dir'] = direction
            d['_mag'] = fwd_pct
            d = d.dropna(subset=['_dir', '_mag'])
            if len(d) < 60:
                continue

            scaler = StandardScaler()
            X_tr   = scaler.fit_transform(d[DAILY_FEAT_COLS].values)
            y_dir  = d['_dir'].values
            y_mag  = d['_mag'].values

            clf = GradientBoostingClassifier(n_estimators=100, max_depth=4,
                                             learning_rate=0.05, subsample=0.8, random_state=42)
            reg = GradientBoostingRegressor(n_estimators=100, max_depth=4,
                                            learning_rate=0.05, subsample=0.8, random_state=42)
            clf.fit(X_tr, y_dir)
            reg.fit(X_tr, y_mag)

            X_lat    = scaler.transform([df.iloc[-1][DAILY_FEAT_COLS].values])
            prob_up  = float(clf.predict_proba(X_lat)[0][1])
            pred_mag = float(reg.predict(X_lat)[0])
            cur      = float(close.iloc[-1])

            buy_t, sell_t = thresholds[label]
            sig = 'BUY' if prob_up >= buy_t else ('SELL' if prob_up <= sell_t else 'HOLD')

            forecasts[label] = {
                'signal':             sig,
                'prob_up':            round(prob_up, 4),
                'prob_down':          round(1 - prob_up, 4),
                'pred_magnitude_pct': round(pred_mag * 100, 3),
                'predicted_close':    round(cur * (1 + pred_mag), 4),
                'current_close':      round(cur, 4),
            }

        if not forecasts:
            return None

        # Build 1-year daily candle array for the chart
        chart_df = df_raw.iloc[-252:]
        candles = [
            {
                'time':  int(pd.Timestamp(ts).timestamp()),
                'open':  round(float(row['Open']),  4),
                'high':  round(float(row['High']),  4),
                'low':   round(float(row['Low']),   4),
                'close': round(float(row['Close']), 4),
            }
            for ts, row in chart_df.iterrows()
        ]

        result = {'symbol': symbol, 'forecasts': forecasts, 'candles': candles}
        cache_set(ck, result)
        return result

    except Exception as e:
        print(f"[forecast] {symbol}: {e}")
        return None


@app.route('/api/forecast/<path:symbol>')
def forecast_endpoint(symbol: str):
    symbol    = symbol.upper()
    asset_type = _asset_type_for(symbol)
    result    = forecast_multi_horizon(symbol, asset_type)
    if result is None:
        return jsonify({'error': 'insufficient data or model failed'}), 404
    return jsonify(result)


# ── Market Summary helpers ────────────────────────────────────────────────────
def quick_signal(symbol: str, asset_type: str, nocache: bool = False) -> dict | None:
    """
    Lightweight signal for batch/summary use — 100-tree GBM only, no CV,
    no ExtraTrees.  Uses the in-memory cache when available.
    """
    ck = cache_key(symbol, 'signal')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            # Return a slimmed copy (drop heavy arrays not needed for summary)
            skip = {'signal_markers', 'features_used'}
            return {k: v for k, v in cached.items() if k not in skip}

    feat_cols = _ASSET_FEATURE_MAP.get(asset_type, STOCK_FEATURE_COLS)
    try:
        df_4h = get_4h_candles(symbol, period='120d')
        if df_4h.empty or len(df_4h) < 80:
            return None
        df = compute_features(df_4h)

        d = df.copy()
        d['future_ret'] = d['Close'].pct_change(1).shift(-1)
        d['direction']  = (d['future_ret'] > 0).astype(int)
        d = d.dropna(subset=feat_cols + ['direction', 'future_ret'])
        if len(d) < 80:
            return None

        X     = d[feat_cols].values
        y_dir = d['direction'].values
        y_mag = d['future_ret'].values

        scaler = StandardScaler()
        X_sc   = scaler.fit_transform(X)

        clf = GradientBoostingClassifier(n_estimators=100, max_depth=4,
                                         learning_rate=0.05, subsample=0.8, random_state=42)
        reg = GradientBoostingRegressor(n_estimators=100, max_depth=4,
                                         learning_rate=0.05, subsample=0.8, random_state=42)
        clf.fit(X_sc, y_dir)
        reg.fit(X_sc, y_mag)
        feat_imps   = {k: round(float(v), 4) for k, v in zip(feat_cols, clf.feature_importances_)}

        latest      = df.iloc[-1]
        X_lat       = scaler.transform(np.array([[latest[c] for c in feat_cols]]))
        prob_up     = float(clf.predict_proba(X_lat)[0][1])
        pred_mag    = float(reg.predict(X_lat)[0])
        close       = float(latest['Close'])
        atr         = float(latest['atr'])
        vol_reg     = int(latest.get('vol_regime', 1))
        vol_ratio_v = float(latest.get('vol_ratio', 1.0))

        buy_t  = 0.62 if vol_reg == 2 else 0.60
        sell_t = 0.38 if vol_reg == 2 else 0.40
        sig    = 'BUY' if prob_up >= buy_t else ('SELL' if prob_up <= sell_t else 'HOLD')

        r = {
            'symbol':             symbol,
            'label':              SYMBOL_LABELS.get(symbol, symbol),
            'close':              round(close, 4),
            'prob_up':            round(prob_up, 4),
            'prob_down':          round(1 - prob_up, 4),
            'pred_magnitude_pct': round(pred_mag * 100, 3),
            'signal':             sig,
            'atr':                round(atr, 4),
            'atr_pct':            round(atr / close * 100, 3),
            'vol_regime':         vol_reg,
            'vol_regime_label':   {0: 'Low', 1: 'Normal', 2: 'High'}.get(vol_reg, 'Normal'),
            'vol_ratio':          round(vol_ratio_v, 3),
            'entry':              round(close, 4),
            'stop_long':          round(close - 1.5 * atr, 4),
            'target_long':        round(close + abs(pred_mag) * close, 4),
            'stop_short':         round(close + 1.5 * atr, 4),
            'target_short':       round(close - abs(pred_mag) * close, 4),
            'risk_per_unit':      round(1.5 * atr, 4),
            'reward_per_unit':    round(abs(pred_mag) * close, 4),
            'rr_ratio':           round(abs(pred_mag) * close / (1.5 * atr + 1e-9), 2),
            'asset_type':         asset_type,
            'feature_importances': feat_imps,
            'timestamp':          datetime.now().isoformat(),
        }
        if symbol in FUTURES_MULTIPLIERS:
            mult = FUTURES_MULTIPLIERS[symbol]
            r['futures_multiplier'] = mult
            r['risk_dollars']       = round(r['risk_per_unit'] * mult, 2)
            r['reward_dollars']     = round(r['reward_per_unit'] * mult, 2)
        return r
    except Exception as e:
        print(f"[quick_signal] {symbol}: {e}")
        return None


def generate_market_notes(sym_results: dict) -> list:
    """Auto-generate comprehensive market events and insights from ML signal data."""
    notes = []
    all_r = list(sym_results.values())

    vix  = sym_results.get('^VIX')
    es   = sym_results.get('ES=F')
    nq   = sym_results.get('NQ=F')
    gc   = sym_results.get('GC=F')
    cl   = sym_results.get('CL=F')
    si   = sym_results.get('SI=F')
    zb   = sym_results.get('ZB=F')
    spy  = sym_results.get('SPY')
    qqq  = sym_results.get('QQQ')
    iwm  = sym_results.get('IWM')
    vix_val = vix.get('close', 20) if vix else 20

    # ── 1. VIX / Fear regime ───────────────────────────────────────────────────
    if vix:
        vc = vix_val
        vs = vix.get('signal', 'HOLD')
        if vc >= 35:
            notes.append({'type': 'danger', 'icon': '🚨',
                'title': f'VIX Panic Zone ({vc:.1f}) — Extreme Market Fear',
                'body':  f'VIX at {vc:.1f} signals extreme fear and potential capitulation. '
                         f'Historically, VIX spikes above 35 precede sharp reversals within days-to-weeks. '
                         f'Avoid new shorts; this is a contrarian long setup for disciplined traders. '
                         f'Options buyers: consider buying cheap protection now before vol mean-reverts. '
                         f'ML signal on VIX itself: <strong>{vs}</strong>.'})
        elif vc >= 25:
            notes.append({'type': 'danger', 'icon': '⚠',
                'title': f'VIX Elevated ({vc:.1f}) — High Fear, Wide Spreads',
                'body':  f'VIX at {vc:.1f} indicates above-average market stress. '
                         f'Options premiums are expensive — credit spreads / iron condors outperform. '
                         f'Reduce leverage, widen stops to 1.5–2× normal. '
                         f'Key level: VIX < 20 would confirm risk-on return.'})
        elif vc >= 18:
            notes.append({'type': 'warning', 'icon': '📊',
                'title': f'VIX Cautious Zone ({vc:.1f}) — Options Premium Above Average',
                'body':  f'VIX at {vc:.1f}: borderline elevated. Favor credit spreads over debit spreads. '
                         f'Market moving toward risk-off — watch for breakdown below key support levels. '
                         f'ML signal on VIX: <strong>{vs}</strong>.'})
        elif vc < 13:
            notes.append({'type': 'info', 'icon': '😴',
                'title': f'VIX Complacency ({vc:.1f}) — Options Cheap, Market Calm',
                'body':  f'VIX at {vc:.1f} signals extreme complacency. Buy options protection cheaply now — '
                         f'low-vol regimes end abruptly. Consider straddles or cheap OTM puts. '
                         f'Avoid selling naked options — reward/risk is poor when IV this low.'})
        else:
            notes.append({'type': 'info', 'icon': '📊',
                'title': f'VIX Normal Range ({vc:.1f}) — Balanced Conditions',
                'body':  f'VIX at {vc:.1f} indicates balanced market sentiment — neither fearful nor complacent. '
                         f'Directional plays (debit spreads, long calls/puts) work well in this range. '
                         f'ML direction on VIX: <strong>{vs}</strong> — '
                         f'{"expect vol expansion" if vs == "BUY" else "expect vol contraction" if vs == "SELL" else "vol likely to stay range-bound"}.'})

        if vs == 'BUY':
            notes.append({'type': 'warning', 'icon': '🔺',
                'title': 'VIX Breakout Signal — Volatility Expansion Ahead',
                'body':  f'ML assigns {vix["prob_up"]*100:.0f}% probability VIX moves higher. '
                         f'Action: reduce gross exposure by 20–30%, widen stops to 1.5× ATR minimum, '
                         f'hedge long positions with OTM puts on SPY or QQQ. '
                         f'Long straddles on high-beta names become attractive.'})
        elif vs == 'SELL':
            notes.append({'type': 'bullish', 'icon': '📉',
                'title': 'VIX Declining Signal — Risk-On Environment',
                'body':  f'ML assigns {(1-vix["prob_up"])*100:.0f}% probability VIX moves lower. '
                         f'Fear subsiding → ideal for selling premium (iron condors, covered calls, cash-secured puts). '
                         f'Momentum stocks and small caps tend to outperform in falling-VIX environments.'})

    # ── 2. Index Futures Analysis ──────────────────────────────────────────────
    if es:
        notes.append({'type': 'bullish' if es.get('signal')=='BUY' else 'bearish' if es.get('signal')=='SELL' else 'info',
            'icon': '📈' if es.get('signal')=='BUY' else '📉' if es.get('signal')=='SELL' else '↔',
            'title': f'E-mini S&P 500 (ES): {es.get("signal","—")} — '
                     f'P(UP) {es["prob_up"]*100:.0f}%',
            'body':  f'ES futures at ${es["close"]:,.2f}. ML forecasts {es["pred_magnitude_pct"]:+.2f}% move. '
                     f'Entry: ${es["entry"]:,.2f} | '
                     f'{"Long stop" if es.get("signal")=="BUY" else "Short stop"}: '
                     f'${es["stop_long"] if es.get("signal")!="SELL" else es["stop_short"]:,.2f} | '
                     f'Target: ${es["target_long"] if es.get("signal")!="SELL" else es["target_short"]:,.2f}. '
                     f'Contract value: $50/pt. Risk per contract: ${es.get("risk_dollars","—")}. '
                     f'Vol regime: <strong>{es["vol_regime_label"]}</strong>.'})

    if nq:
        notes.append({'type': 'bullish' if nq.get('signal')=='BUY' else 'bearish' if nq.get('signal')=='SELL' else 'info',
            'icon': '💻',
            'title': f'E-mini Nasdaq-100 (NQ): {nq.get("signal","—")} — '
                     f'P(UP) {nq["prob_up"]*100:.0f}%',
            'body':  f'NQ futures at ${nq["close"]:,.2f}. ML forecasts {nq["pred_magnitude_pct"]:+.2f}% move. '
                     f'Risk per contract (${nq["futures_multiplier"]}/pt): ${nq.get("risk_dollars","—")}. '
                     f'Target: ${nq["target_long"] if nq.get("signal")!="SELL" else nq["target_short"]:,.2f}. '
                     f'Vol regime: <strong>{nq["vol_regime_label"]}</strong>. '
                     f'{"NQ bullish → favors AAPL, MSFT, NVDA, GOOGL long setups." if nq.get("signal")=="BUY" else "NQ bearish → tech headwinds; reduce tech exposure." if nq.get("signal")=="SELL" else "NQ neutral → no directional edge in tech futures."}'})

    if es and nq:
        es_s, nq_s = es.get('signal'), nq.get('signal')
        if es_s == 'BUY' and nq_s == 'BUY':
            notes.append({'type': 'bullish', 'icon': '🚀',
                'title': 'Broad Market Bullish Alignment — ES + NQ Both BUY',
                'body':  f'Both S&P 500 and Nasdaq futures signal upside: '
                         f'ES {es["pred_magnitude_pct"]:+.2f}%, NQ {nq["pred_magnitude_pct"]:+.2f}%. '
                         f'This alignment suggests broad institutional buying — best conditions for momentum longs. '
                         f'Favor SPY calls, QQQ calls, and long Mag 7 names. '
                         f'Sector ETFs (XLK, XLY, XLF) likely to outperform. '
                         f'Scale into longs at market open or on first 30-min consolidation.'})
        elif es_s == 'SELL' and nq_s == 'SELL':
            notes.append({'type': 'bearish', 'icon': '🌧',
                'title': 'Broad Market Bearish Alignment — ES + NQ Both SELL',
                'body':  f'Both S&P 500 and Nasdaq futures signal downside: '
                         f'ES {es["pred_magnitude_pct"]:+.2f}%, NQ {nq["pred_magnitude_pct"]:+.2f}%. '
                         f'Reduce gross long exposure. Defensive sectors (XLU, XLRE, XLP) may outperform. '
                         f'Consider SPY puts, inverse ETFs (SH, PSQ), or short high-beta names. '
                         f'Stop any new long entries until breadth improves.'})
        elif es_s != nq_s:
            notes.append({'type': 'info', 'icon': '🔄',
                'title': f'ES vs NQ Divergence: ES={es_s}, NQ={nq_s} — Sector Rotation',
                'body':  f'S&P ({es_s}) and Nasdaq ({nq_s}) are diverging. '
                         f'{"ES bullish + NQ bearish → value/cyclicals outperforming growth; watch XLF, XLE, XLI." if es_s=="BUY" else "ES bearish + NQ bullish → tech leading while broader market lags; watch FAANG names."} '
                         f'Divergence often resolves within 3–5 sessions — monitor for convergence.'})

    # ── 3. S&P 500 / ETF analysis ──────────────────────────────────────────────
    if spy:
        notes.append({'type': 'bullish' if spy.get('signal')=='BUY' else 'bearish' if spy.get('signal')=='SELL' else 'info',
            'icon': '🏛',
            'title': f'SPY S&P 500 ETF: {spy.get("signal","—")} @ ${spy["close"]:.2f}',
            'body':  f'ML P(UP)={spy["prob_up"]*100:.1f}%, predicted move {spy["pred_magnitude_pct"]:+.2f}%. '
                     f'ATR: ${spy["atr"]:.2f} ({spy["atr_pct"]:.2f}% of price). '
                     f'Vol regime: <strong>{spy["vol_regime_label"]}</strong>. '
                     f'Stop: ${spy["stop_long"] if spy.get("signal")!="SELL" else spy["stop_short"]:.2f} | '
                     f'Target: ${spy["target_long"] if spy.get("signal")!="SELL" else spy["target_short"]:.2f}. '
                     f'R/R: {spy["rr_ratio"]:.1f}:1.'})

    # ── 4. Small Cap (IWM / Russell 2000) ─────────────────────────────────────
    if iwm:
        risk_on = iwm.get('signal') == 'BUY'
        notes.append({'type': 'bullish' if risk_on else 'bearish' if iwm.get('signal')=='SELL' else 'info',
            'icon': '🏪',
            'title': f'Russell 2000 (IWM): {iwm.get("signal","—")} — Small Cap {"Risk-On" if risk_on else "Risk-Off" if iwm.get("signal")=="SELL" else "Neutral"}',
            'body':  f'IWM at ${iwm["close"]:.2f}. Small caps are a leading indicator of risk appetite. '
                     f'{"IWM BUY → risk-on environment; aggressive positioning in small/mid-cap names justified." if risk_on else "IWM SELL → risk-off rotation to large caps and defensives." if iwm.get("signal")=="SELL" else "IWM neutral → indecision in risk appetite; stick to large caps."} '
                     f'P(UP) {iwm["prob_up"]*100:.1f}%, forecast {iwm["pred_magnitude_pct"]:+.2f}%.'})

    # ── 5. Gold / Silver / Safe-haven analysis ────────────────────────────────
    if gc:
        gc_s = gc.get('signal', 'HOLD')
        notes.append({'type': 'bullish' if gc_s=='BUY' else 'bearish' if gc_s=='SELL' else 'info',
            'icon': '🥇',
            'title': f'Gold (GC): {gc_s} @ ${gc["close"]:,.2f} — '
                     f'{"Safe-Haven Demand Rising" if gc_s=="BUY" else "Safe-Haven Selling" if gc_s=="SELL" else "Gold Neutral"}',
            'body':  f'Gold ML P(UP)={gc["prob_up"]*100:.1f}%, forecast {gc["pred_magnitude_pct"]:+.2f}%. '
                     f'{"Rising gold signals: inflation expectations up, USD weakening, or geopolitical risk. Watch GDX (gold miners) for leverage." if gc_s=="BUY" else "Declining gold suggests: USD strengthening or risk-on rotation away from safety. May signal equity rally ahead." if gc_s=="SELL" else "Gold is consolidating — no clear macro signal from metals at this time."} '
                     f'Contract risk: ${gc.get("risk_dollars","—")} (100 oz × ${gc["risk_per_unit"]:.2f}/oz).'})
    if si and si.get('signal') != 'HOLD':
        notes.append({'type': 'bullish' if si.get('signal')=='BUY' else 'bearish', 'icon': '🥈',
            'title': f'Silver (SI): {si.get("signal","—")} — Industrial + Monetary Metal',
            'body':  f'Silver at ${si["close"]:,.2f}. Forecast {si["pred_magnitude_pct"]:+.2f}%. '
                     f'Silver is more volatile than gold and combines monetary and industrial demand. '
                     f'{"Silver BUY → confirm with gold signal; aligned metals = strong macro move." if si.get("signal")=="BUY" else "Silver SELL → watch for industrial slowdown signal."}'})
    if gc and si:
        gc_s, si_s = gc.get('signal'), si.get('signal')
        if gc_s == 'BUY' and si_s == 'BUY':
            notes.append({'type': 'bullish', 'icon': '💛',
                'title': 'Gold + Silver Both Bullish — Strong Metals Rally',
                'body':  'Both gold and silver signaling upside. This dual-metals rally typically signals: '
                         'inflation concerns, USD weakness, or broad risk-off rotation. '
                         'Consider: long GLD/SLV ETFs, gold miners (GDX/GDXJ), or direct futures exposure.'})

    # ── 6. Oil / Energy analysis ──────────────────────────────────────────────
    if cl:
        cl_s = cl.get('signal', 'HOLD')
        notes.append({'type': 'bullish' if cl_s=='BUY' else 'bearish' if cl_s=='SELL' else 'info',
            'icon': '🛢',
            'title': f'WTI Crude Oil (CL): {cl_s} @ ${cl["close"]:.2f}',
            'body':  f'Crude ML P(UP)={cl["prob_up"]*100:.1f}%, forecast {cl["pred_magnitude_pct"]:+.2f}%. '
                     f'{"Rising oil: bullish for XOM, CVX, PSX, VLO and energy sector ETF (XLE). Watch inflation impact on Fed policy." if cl_s=="BUY" else "Falling oil: bearish for energy stocks; bullish for airlines (AAL, DAL), trucking, consumer. Disinflationary signal." if cl_s=="SELL" else "Oil consolidating — energy stocks likely to trade sideways."} '
                     f'CL contract: 1,000 barrels. Risk per contract: ${cl.get("risk_dollars","—")}.'})

    # ── 7. Bonds (ZB=F — 30-Year T-Bond) ──────────────────────────────────────
    if zb:
        zb_s = zb.get('signal', 'HOLD')
        notes.append({'type': 'bullish' if zb_s=='BUY' else 'bearish' if zb_s=='SELL' else 'info',
            'icon': '🏦',
            'title': f'30-Year T-Bond (ZB): {zb_s} — '
                     f'{"Bond Rally / Rates Falling" if zb_s=="BUY" else "Bond Selloff / Rates Rising" if zb_s=="SELL" else "Bonds Neutral"}',
            'body':  f'ZB at ${zb["close"]:.2f}. Forecast {zb["pred_magnitude_pct"]:+.2f}%. '
                     f'{"Bond BUY (prices up, yields down) → risk-off; favors growth stocks, utilities (XLU), REITs (XLRE). Fed likely done hiking." if zb_s=="BUY" else "Bond SELL (prices down, yields up) → risk-on or inflation fears; favors banks (XLF), cyclicals (XLI). Value over growth." if zb_s=="SELL" else "Bonds neutral — no clear rate direction signal."} '
                     f'Watch 10Y yield alongside ZB futures for macro confirmation.'})

    # ── 8. Market breadth ─────────────────────────────────────────────────────
    stk = [r for r in all_r if r.get('asset_type') in ('stock', 'index')]
    if stk:
        bp  = sum(1 for r in stk if r.get('signal') == 'BUY')  / len(stk) * 100
        sp  = sum(1 for r in stk if r.get('signal') == 'SELL') / len(stk) * 100
        hp  = 100 - bp - sp
        notes.append({'type': 'bullish' if bp>=55 else 'bearish' if sp>=55 else 'info',
            'icon': '🌡',
            'title': f'Market Breadth: {bp:.0f}% BUY · {sp:.0f}% SELL · {hp:.0f}% HOLD '
                     f'({len(stk)} stocks + indices)',
            'body':  f'Breadth across {len(stk)} tracked equities and indices. '
                     f'{"Strong bullish breadth — broad participation confirms the uptrend. Favorable for momentum strategies across sectors." if bp>=70 else "Majority bullish — healthy market but not extreme. Focus on highest-conviction BUY setups." if bp>=55 else "Bearish breadth majority — widespread selling pressure. Defensive positioning and hedges recommended." if sp>=55 else "Mixed breadth signals — selective market. Stock-picking over index plays."} '
                     f'Historically, breadth > 70% BUY precedes +2-5% index moves over the following 2 weeks.'})

    # ── 9. Magnificent 7 tech leadership ──────────────────────────────────────
    m7 = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA']
    m7r = {s: sym_results[s] for s in m7 if s in sym_results}
    if m7r:
        mb    = sum(1 for r in m7r.values() if r.get('signal') == 'BUY')
        ms    = sum(1 for r in m7r.values() if r.get('signal') == 'SELL')
        mh    = len(m7r) - mb - ms
        m7txt = ', '.join(f'{s} ({r["signal"]})' for s,r in m7r.items())
        notes.append({'type': 'bullish' if mb>=5 else 'bearish' if ms>=5 else 'info',
            'icon': '💎',
            'title': f'Magnificent 7: {mb} BUY · {ms} SELL · {mh} HOLD — '
                     f'{"Tech Leading" if mb>=5 else "Tech Lagging" if ms>=5 else "Mixed Tech"}',
            'body':  f'{m7txt}. '
                     f'{"Mag 7 consensus BUY → NASDAQ-heavy portfolios favored. QQQ calls, NQ futures long." if mb>=5 else "Mag 7 consensus SELL → tech sector headwinds. Rotate to value (XLV, XLF, XLE) or reduce tech exposure." if ms>=5 else "Mag 7 split — no tech sector consensus. Best approach: individual stock selection over index plays."} '
                     f'Mag 7 companies represent ~30% of S&P 500 weight.'})

    # ── 10. Volatility regime analysis ────────────────────────────────────────
    hv_all  = [r for r in all_r if r.get('vol_regime') == 2]
    lv_all  = [r for r in all_r if r.get('vol_regime') == 0]
    hv_stk  = [r for r in hv_all if r.get('asset_type') == 'stock']
    if hv_all:
        top_hv = ', '.join(r['symbol'] for r in
                           sorted(hv_all, key=lambda x: x.get('atr_pct', 0), reverse=True)[:8])
        notes.append({'type': 'warning', 'icon': '⚡',
            'title': f'{len(hv_all)} Assets in High-Vol Regime — Position Sizing Alert',
            'body':  f'High-volatility regime (ATR >> 50-bar median): {top_hv}. '
                     f'Required action: reduce position size by 30–50% to maintain fixed dollar risk. '
                     f'Formula: shares = (account_risk_$) / (1.5 × ATR). '
                     f'Widen stops to 1.5–2× ATR. '
                     f'{"Many stocks in high-vol — use sector ETFs instead of individual names for safer exposure." if len(hv_stk)>=5 else ""}'})
    if len(lv_all) >= 5:
        top_lv = ', '.join(r['symbol'] for r in
                           sorted(lv_all, key=lambda x: x.get('atr_pct', 0))[:5])
        notes.append({'type': 'info', 'icon': '😴',
            'title': f'{len(lv_all)} Assets in Low-Vol Regime — Premium Selling Opportunities',
            'body':  f'Low-volatility consolidation: {top_lv}. '
                     f'Low ATR = cheap options premiums → avoid buying straddles here. '
                     f'These names may be building energy for a breakout — watch volume surge as trigger.'})

    # ── 11. Unusual volume spikes ──────────────────────────────────────────────
    high_act = sorted([r for r in all_r if r.get('vol_ratio', 1) > 1.8],
                      key=lambda x: x.get('vol_ratio', 1), reverse=True)
    if high_act:
        syms = ', '.join(f'<strong>{r["symbol"]}</strong> ({r["vol_ratio"]:.1f}×)' for r in high_act[:6])
        notes.append({'type': 'info', 'icon': '🔥',
            'title': f'Unusual Volume — {len(high_act)} Assets Surging',
            'body':  f'Volume well above 20-bar average: {syms}. '
                     f'High volume authenticates price moves — a breakout on 2×+ volume is far more reliable. '
                     f'{"Top mover: " + high_act[0]["symbol"] + " at " + str(round(high_act[0]["vol_ratio"],1)) + "x normal volume — watch for follow-through." if high_act else ""} '
                     f'Low volume on breakouts should be treated with skepticism.'})

    # ── 12. Largest magnitude forecasts ───────────────────────────────────────
    top3_mag = sorted(all_r, key=lambda r: abs(r.get('pred_magnitude_pct', 0)), reverse=True)[:3]
    for r in top3_mag:
        m = r.get('pred_magnitude_pct', 0)
        if abs(m) < 0.5:
            break
        tgt = r['target_long'] if m > 0 else r['target_short']
        stp = r['stop_long']   if m > 0 else r['stop_short']
        notes.append({'type': 'bullish' if m > 0 else 'bearish', 'icon': '🎯',
            'title': f'Trade Setup: {r["symbol"]} {r["signal"]} — Forecast {m:+.2f}%',
            'body':  f'{r.get("label", r["symbol"])}. '
                     f'ML P(UP)={r["prob_up"]*100:.1f}%, signal: <strong>{r["signal"]}</strong>. '
                     f'Entry: ${r["entry"]:,.4f} | Stop: ${stp:,.4f} | Target: ${tgt:,.4f}. '
                     f'Risk/Reward: {r["rr_ratio"]:.1f}:1. '
                     f'ATR: ${r["atr"]:.4f} ({r["atr_pct"]:.2f}%). '
                     f'Vol regime: {r["vol_regime_label"]}. '
                     f'{"Risk dollars: $" + str(r.get("risk_dollars","—")) + " per contract." if r.get("risk_dollars") else ""}'})

    # ── 13. Sector performance snapshot ──────────────────────────────────────
    sectors = {
        'Technology': ['AAPL','MSFT','NVDA','GOOGL','META'],
        'Finance':    ['JPM','BAC','V'],
        'Energy':     ['XOM','CVX'],
        'Healthcare': ['JNJ','UNH'],
        'Consumer':   ['AMZN','WMT','HD','TSLA'],
    }
    sector_notes = []
    for sec_name, sec_syms in sectors.items():
        sec_r = [sym_results[s] for s in sec_syms if s in sym_results]
        if len(sec_r) >= 2:
            sb = sum(1 for r in sec_r if r.get('signal')=='BUY')
            ss = sum(1 for r in sec_r if r.get('signal')=='SELL')
            avg_m = sum(r.get('pred_magnitude_pct',0) for r in sec_r) / len(sec_r)
            icon = '▲' if sb > ss else '▼' if ss > sb else '↔'
            sector_notes.append(f'{sec_name}: {icon} {sb}B/{ss}S (avg {avg_m:+.2f}%)')
    if sector_notes:
        notes.append({'type': 'info', 'icon': '🏢',
            'title': 'Sector Snapshot — ML Direction by Sector',
            'body':  ' &nbsp;|&nbsp; '.join(sector_notes) + '. '
                     'Strongest sector: consider sector ETFs (XLK, XLF, XLE, XLV, XLY) for diversified exposure.'})

    # ── 14. Options strategy context ──────────────────────────────────────────
    opt_r = [r for r in all_r if r.get('asset_type') == 'options']
    if opt_r:
        hv_opts  = sum(1 for r in opt_r if r.get('vol_regime') == 2)
        buy_opts = sum(1 for r in opt_r if r.get('signal') == 'BUY')
        sel_opts = sum(1 for r in opt_r if r.get('signal') == 'SELL')
        if vix_val > 25:
            strategy = 'credit spreads / iron condors (sell elevated premium)'
            ev_note  = 'High VIX = expensive options. Selling premium has positive expected value.'
        elif vix_val > 18:
            strategy = 'vertical debit spreads (defined risk directional)'
            ev_note  = 'Moderate IV — directional spreads offer good risk/reward.'
        else:
            strategy = 'long calls / puts or debit spreads (cheap premium, defined risk)'
            ev_note  = 'Low IV = cheap options. Buy defined-risk directional plays.'
        notes.append({'type': 'info', 'icon': '📋',
            'title': f'Options Strategy — VIX {vix_val:.1f}: Favor {strategy}',
            'body':  f'{ev_note} '
                     f'Of {len(opt_r)} options underlyings: {buy_opts} BUY, {sel_opts} SELL, '
                     f'{hv_opts} in high-vol regime. '
                     f'Always check IV rank before entering: IV > 50th pct → sell premium; '
                     f'IV < 30th pct → buy options. '
                     f'Avoid naked short options — use spreads to cap risk in all regimes.'})

    # ── 15. Position sizing / risk management ─────────────────────────────────
    hv_count = len([r for r in all_r if r.get('vol_regime') == 2])
    avg_atr  = sum(r.get('atr_pct', 1) for r in all_r) / max(len(all_r), 1)
    notes.append({'type': 'info', 'icon': '🔒',
        'title': 'Risk Management — Today\'s Position Sizing Guide',
        'body':  f'Average ATR across all tracked assets: {avg_atr:.2f}% of price. '
                 f'{hv_count} assets in high-vol regime. '
                 f'Recommended stop: 1.5× ATR from entry (wider in high-vol). '
                 f'Max risk per trade: 1–2% of account. '
                 f'Formula: position size = (account × 0.01) ÷ (1.5 × ATR in $). '
                 f'Never risk more than 5% of account in correlated positions simultaneously. '
                 f'In high-vol regimes: reduce size by 50%, widen stops by 50%.'})

    return notes


def generate_world_events(sym_results: dict) -> list:
    """
    Derive world and economic events from live ML signal data.
    Each event is ranked by market impact (magnitude + affected asset count).
    """
    events = []

    vix  = sym_results.get('^VIX')
    es   = sym_results.get('ES=F')
    nq   = sym_results.get('NQ=F')
    gc   = sym_results.get('GC=F')
    cl   = sym_results.get('CL=F')
    si   = sym_results.get('SI=F')
    zb   = sym_results.get('ZB=F')
    spy  = sym_results.get('SPY')
    qqq  = sym_results.get('QQQ')
    iwm  = sym_results.get('IWM')
    vix_val = vix.get('close', 20) if vix else 20
    all_r   = list(sym_results.values())

    # ── 1. Federal Reserve / Monetary Policy (30-yr bond futures) ─────────────
    if zb:
        zb_s   = zb.get('signal', 'HOLD')
        zb_mag = zb.get('pred_magnitude_pct', 0)
        if zb_s == 'BUY':
            events.append({
                'category': 'MONETARY POLICY',
                'event':    'Fed Policy Easing / Bond Rally',
                'impact':   'BULLISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Options', 'Futures'],
                'market_signal': f'ZB futures {zb_mag:+.2f}% | P(UP) {zb["prob_up"]*100:.0f}%',
                'description': (
                    f'30-Year T-Bond futures are bullish — prices rising, yields falling. '
                    f'A falling-rate environment is a tailwind for equities (especially growth/tech), '
                    f'REITs, and utilities. Signals the market expects Fed to pause or cut rates. '
                    f'Dollar may weaken, boosting gold and international equities. '
                    f'Reduced borrowing costs support corporate earnings revisions higher.'),
                'action': 'Long SPY/QQQ calls; overweight XLK, XLRE, XLU; sell short-term bond puts',
            })
        elif zb_s == 'SELL':
            events.append({
                'category': 'MONETARY POLICY',
                'event':    'Rising Interest Rates / Bond Selloff',
                'impact':   'BEARISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Options', 'Futures'],
                'market_signal': f'ZB futures {zb_mag:+.2f}% | P(DOWN) {zb["prob_down"]*100:.0f}%',
                'description': (
                    f'30-Year bond futures declining — yields rising. '
                    f'Higher rates compress price-to-earnings multiples, especially for growth and tech. '
                    f'Signals hawkish Fed or sticky inflation forcing rates higher. '
                    f'Banks (XLF) benefit from steeper yield curve; REITs and long-duration growth suffer. '
                    f'Mortgage rates rising — headwind for housing sector (XHB, DHI, LEN).'),
                'action': 'Reduce growth/tech; long XLF; short TLT; favor value over growth; buy TIPS',
            })

    # ── 2. Inflation / Commodity Price Event (Gold + Oil) ─────────────────────
    if gc and cl:
        gc_s, cl_s   = gc.get('signal','HOLD'), cl.get('signal','HOLD')
        gc_mag, cl_mag = gc.get('pred_magnitude_pct',0), cl.get('pred_magnitude_pct',0)
        if gc_s == 'BUY' and cl_s == 'BUY':
            events.append({
                'category': 'INFLATION',
                'event':    'Dual Commodity Rally — Inflation Pressure Rising',
                'impact':   'BEARISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Futures', 'Options'],
                'market_signal': f'GC {gc_mag:+.2f}% · CL {cl_mag:+.2f}%',
                'description': (
                    f'Both gold ({gc_mag:+.2f}%) and WTI crude ({cl_mag:+.2f}%) signal upside. '
                    f'Dual commodity rally is one of the strongest inflation indicators. '
                    f'Implications: Fed may keep rates higher longer, compressing equity multiples. '
                    f'Consumer purchasing power erodes — headwind for retail and consumer discretionary. '
                    f'Beneficiaries: energy (XLE, XOM, CVX), materials (XLB), commodity ETFs (GSG, DBC).'),
                'action': 'Long XLE, XLB, GC/CL futures, TIPS ETF; reduce growth stocks, XLY; buy inflation hedges',
            })
        elif gc_s == 'SELL' and cl_s == 'SELL':
            events.append({
                'category': 'INFLATION',
                'event':    'Disinflationary Signal — Commodities Declining',
                'impact':   'BULLISH', 'magnitude': 'MEDIUM',
                'affected': ['Stocks', 'Futures'],
                'market_signal': f'GC {gc_mag:+.2f}% · CL {cl_mag:+.2f}%',
                'description': (
                    f'Both gold and oil declining — disinflationary environment. '
                    f'Could allow Fed to cut rates sooner, boosting growth and tech stocks. '
                    f'Lower oil prices reduce input costs for airlines, trucking, and consumer goods. '
                    f'Dollar may strengthen as inflation premium fades.'),
                'action': 'Long growth/tech (XLK, QQQ); buy airlines (JETS); reduce energy; long USD',
            })
        elif gc_s == 'BUY' and cl_s != 'BUY':
            events.append({
                'category': 'GEOPOLITICAL / SAFE HAVEN',
                'event':    'Gold Surging Without Oil — Safe-Haven / Dollar Weakness',
                'impact':   'MIXED', 'magnitude': 'MEDIUM',
                'affected': ['Futures', 'Options'],
                'market_signal': f'GC {gc_mag:+.2f}% | CL {cl_mag:+.2f}%',
                'description': (
                    f'Gold rising ({gc_mag:+.2f}%) while oil is flat/down — not a broad commodity rally. '
                    f'This pattern signals USD weakness, geopolitical uncertainty, or central bank gold buying. '
                    f'Not primarily inflation-driven (oil confirms). Watch for currency moves (EUR/USD, DXY).'),
                'action': 'Long GLD/GC futures; monitor DXY; hedge equity portfolio with gold positions',
            })

    # ── 3. Geopolitical Risk Event (VIX + Gold spikes together) ──────────────
    if vix and gc:
        gc_s = gc.get('signal', 'HOLD')
        if vix_val >= 25 and gc_s == 'BUY':
            events.append({
                'category': 'GEOPOLITICAL',
                'event':    'Geopolitical / Macro Risk Event',
                'impact':   'BEARISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Options', 'Futures'],
                'market_signal': f'VIX {vix_val:.1f} | GC BUY {gc.get("pred_magnitude_pct",0):+.2f}%',
                'description': (
                    f'VIX at {vix_val:.1f} combined with gold bullish is a classic geopolitical risk signal. '
                    f'Safe-haven flows (gold, bonds, yen) are accelerating as equity volatility spikes. '
                    f'Historical pattern: VIX > 25 + Gold BUY often precedes broad risk-off episodes. '
                    f'Energy markets may gap on supply disruption fears. '
                    f'Defense stocks (LMT, NOC, RTX) and gold miners (GDX) tend to outperform.'),
                'action': 'Cut leverage 30–50%; buy SPY puts; long GLD/ZB; defense stocks; avoid new equity longs',
            })
        elif vix_val < 16 and gc_s == 'SELL':
            events.append({
                'category': 'GEOPOLITICAL',
                'event':    'Low Risk Environment — Geopolitical Calm',
                'impact':   'BULLISH', 'magnitude': 'MEDIUM',
                'affected': ['Stocks', 'Futures'],
                'market_signal': f'VIX {vix_val:.1f} | GC SELL {gc.get("pred_magnitude_pct",0):+.2f}%',
                'description': (
                    f'Low VIX ({vix_val:.1f}) and declining gold indicate minimal geopolitical risk premium. '
                    f'Risk assets favored over safe havens. Ideal for momentum strategies and leveraged exposure. '
                    f'Volatility is cheap — consider buying options for convex upside at low cost.'),
                'action': 'Increase equity exposure; sell hedges; buy high-beta names; cheap options for leverage',
            })

    # ── 4. Market Volatility / Financial Stress Event ─────────────────────────
    hv_count = sum(1 for r in all_r if r.get('vol_regime') == 2)
    if vix_val >= 20 or hv_count >= 8:
        mag  = 'HIGH' if (vix_val >= 30 or hv_count >= 15) else 'MEDIUM'
        events.append({
            'category': 'MARKET VOLATILITY',
            'event':    f'Elevated Volatility Event — VIX {vix_val:.1f}',
            'impact':   'BEARISH', 'magnitude': mag,
            'affected': ['Stocks', 'Options', 'Futures'],
            'market_signal': f'VIX {vix_val:.1f} | {hv_count} assets in high-vol regime',
            'description': (
                f'VIX at {vix_val:.1f} with {hv_count} assets in high-volatility regime. '
                f'{"Panic-level vol: sharp reversals common in both directions. Avoid market orders." if vix_val>=35 else "Elevated fear: options premiums expensive, bid-ask spreads wide, slippage higher." if vix_val>=25 else "Moderate vol pickup: increased caution warranted, reduce leverage by 20-30%."} '
                f'Options strategy shift: credit spreads and iron condors outperform when IV is elevated. '
                f'Position sizing formula: units = ($account × 0.01) ÷ (1.5 × ATR in $).'),
            'action': f'{"Sell iron condors / credit spreads; cut leverage 40-60%; hedge with puts" if vix_val>=25 else "Widen stops to 2×ATR; reduce size 20-30%; avoid chasing momentum"}',
        })

    # ── 5. Technology / AI Economy Event (NQ + Mag 7 consensus) ──────────────
    m7_sigs = {s: sym_results[s].get('signal','HOLD') for s in
               ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA'] if s in sym_results}
    m7_buys = sum(1 for v in m7_sigs.values() if v == 'BUY')
    m7_sells= sum(1 for v in m7_sigs.values() if v == 'SELL')
    if nq and len(m7_sigs) >= 4:
        nq_s   = nq.get('signal', 'HOLD')
        nq_mag = nq.get('pred_magnitude_pct', 0)
        if m7_buys >= 4 and nq_s in ('BUY', 'HOLD'):
            events.append({
                'category': 'TECHNOLOGY / AI',
                'event':    'Tech Sector / AI Investment Cycle Bullish',
                'impact':   'BULLISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Options', 'Futures'],
                'market_signal': f'NQ {nq_mag:+.2f}% | Mag7: {m7_buys} BUY / {m7_sells} SELL',
                'description': (
                    f'{m7_buys} of {len(m7_sigs)} Magnificent 7 stocks signaling BUY. '
                    f'NQ Nasdaq futures forecast {nq_mag:+.2f}%. '
                    f'Broad tech strength indicates AI capital expenditure cycle (NVDA, MSFT, GOOGL), '
                    f'strong earnings beats, or multiple expansion from falling rates. '
                    f'Represents ~30% of S&P 500 weight — tech leadership drives index returns. '
                    f'QQQ calls and NQ futures offer the most direct exposure.'),
                'action': 'Long QQQ/NQ; overweight XLK; buy NVDA/MSFT/AAPL; SPY calls on confirmation',
            })
        elif m7_sells >= 4 and nq_s in ('SELL', 'HOLD'):
            events.append({
                'category': 'TECHNOLOGY / AI',
                'event':    'Tech Sector Weakness / Valuation Reset',
                'impact':   'BEARISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Options', 'Futures'],
                'market_signal': f'NQ {nq_mag:+.2f}% | Mag7: {m7_buys} BUY / {m7_sells} SELL',
                'description': (
                    f'{m7_sells} of {len(m7_sigs)} Mag 7 stocks signaling SELL. '
                    f'Tech/growth rotation out: earnings disappointments, margin pressure, or valuation concerns. '
                    f'Impact amplified by S&P 500 ~30% tech weighting — index likely underperforms. '
                    f'Rotation into value (XLF, XLE, XLV, XLI) historically follows tech breakdowns.'),
                'action': 'Short QQQ / NQ; rotate to XLF/XLE/XLV; buy SPY puts; reduce Mag7 positions',
            })

    # ── 6. Energy Market Event (WTI Crude) ────────────────────────────────────
    if cl:
        cl_s   = cl.get('signal', 'HOLD')
        cl_val = cl.get('close', 80)
        cl_mag = cl.get('pred_magnitude_pct', 0)
        cl_vr  = cl.get('vol_ratio', 1)
        if cl_s != 'HOLD' and (abs(cl_mag) > 1.0 or cl_vr > 1.5):
            events.append({
                'category': 'ENERGY / COMMODITIES',
                'event':    f'WTI Crude Oil {"Rally" if cl_s=="BUY" else "Selloff"}',
                'impact':   'BULLISH' if cl_s == 'BUY' else 'BEARISH',
                'magnitude': 'HIGH' if abs(cl_mag) > 2.0 else 'MEDIUM',
                'affected': ['Stocks', 'Futures'],
                'market_signal': f'CL ${cl_val:.2f}/bbl | {cl_mag:+.2f}% | Vol {cl_vr:.1f}×',
                'description': (
                    f'WTI Crude at ${cl_val:.2f}/bbl with ML forecast {cl_mag:+.2f}%. '
                    f'{"Rising oil driven by OPEC+ supply cuts, geopolitical disruption, or demand surge. Bullish: XLE, XOM, CVX, HAL, PSX. Inflationary impact on Fed policy." if cl_s=="BUY" else "Falling oil signals demand concerns (economic slowdown) or supply increase (OPEC discord, US shale ramp). Bearish: energy sector. Bullish: airlines (JETS, DAL, AAL), trucking, consumer spending."} '
                    f'Contract: 1,000 barrels × ${cl_val:.2f} = ${cl_val*1000:,.0f} notional. '
                    f'Vol ratio {cl_vr:.1f}× — {"above-average institutional participation." if cl_vr>1.5 else "normal volume."}'),
                'action': f'{"Long XLE/CL futures; buy XOM/CVX; sell airline hedges" if cl_s=="BUY" else "Short energy (XLE puts); long airlines (JETS); reduce CL exposure; watch consumer"}',
            })

    # ── 7. Broad Market Risk Appetite (SPY + IWM alignment) ──────────────────
    if spy and iwm:
        spy_s, iwm_s = spy.get('signal','HOLD'), iwm.get('signal','HOLD')
        if spy_s == 'BUY' and iwm_s == 'BUY':
            events.append({
                'category': 'MARKET BREADTH',
                'event':    'Full Risk-On: Large & Small Cap Bullish Alignment',
                'impact':   'BULLISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Futures', 'Options'],
                'market_signal': f'SPY {spy.get("pred_magnitude_pct",0):+.2f}% | IWM {iwm.get("pred_magnitude_pct",0):+.2f}%',
                'description': (
                    f'S&P 500 (SPY) and Russell 2000 (IWM) both signaling upside. '
                    f'Full risk-on: large AND small caps aligned indicates broad economic optimism, '
                    f'easing credit conditions, and institutional buying across the cap spectrum. '
                    f'Historically, SPY + IWM bullish alignment precedes sustained uptrends of 2–4 weeks. '
                    f'Best conditions for momentum strategies — avoid excessive hedging.'),
                'action': 'Max equity allocation; add small/mid caps; buy ES and NQ; sell protective puts',
            })
        elif spy_s == 'SELL' and iwm_s == 'SELL':
            events.append({
                'category': 'MARKET BREADTH',
                'event':    'Broad Risk-Off: Large & Small Cap Both Bearish',
                'impact':   'BEARISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Futures', 'Options'],
                'market_signal': f'SPY {spy.get("pred_magnitude_pct",0):+.2f}% | IWM {iwm.get("pred_magnitude_pct",0):+.2f}%',
                'description': (
                    f'Both SPY and IWM signaling downside — widespread distribution across all cap sizes. '
                    f'Risk-off: credit conditions tightening, institutional de-risking. '
                    f'Defensive sectors (XLU, XLP, XLV) and Treasuries outperform. '
                    f'Avoid new long positions; prioritize capital preservation.'),
                'action': 'Reduce equities; long XLU/XLP/ZB; buy SPY puts; short ES/NQ; cash is a position',
            })
        elif spy_s != iwm_s and 'HOLD' not in (spy_s, iwm_s):
            events.append({
                'category': 'SECTOR ROTATION',
                'event':    f'Cap-Size Divergence: SPY {spy_s} / IWM {iwm_s}',
                'impact':   'NEUTRAL', 'magnitude': 'MEDIUM',
                'affected': ['Stocks'],
                'market_signal': f'SPY {spy_s} | IWM {iwm_s}',
                'description': (
                    f'Large caps (SPY {spy_s}) and small caps (IWM {iwm_s}) diverging. '
                    f'{"Large-cap outperformance: flight-to-quality, credit tightening, or risk reduction. Institutions favoring mega-caps." if spy_s=="BUY" else "Small-cap leadership: risk-on acceleration, improving credit, liquidity returning to risk assets."} '
                    f'Divergences typically resolve within 2–3 weeks — watch for convergence.'),
                'action': f'{"Overweight large caps (SPY, QQQ); reduce IWM exposure" if spy_s=="BUY" else "Rotate into small/mid caps; buy IWM calls; reduce SPY weighting"}',
            })

    # ── 8. ES + NQ Cross-Market Alignment ────────────────────────────────────
    if es and nq:
        es_s, nq_s   = es.get('signal','HOLD'), nq.get('signal','HOLD')
        es_mag, nq_mag = es.get('pred_magnitude_pct',0), nq.get('pred_magnitude_pct',0)
        if es_s == 'BUY' and nq_s == 'BUY':
            events.append({
                'category': 'FUTURES MARKET',
                'event':    'Futures Market Bullish — ES + NQ Aligned',
                'impact':   'BULLISH', 'magnitude': 'HIGH',
                'affected': ['Futures', 'Stocks', 'Options'],
                'market_signal': f'ES {es_mag:+.2f}% | NQ {nq_mag:+.2f}%',
                'description': (
                    f'E-mini S&P 500 (ES, {es_mag:+.2f}%) and E-mini Nasdaq-100 (NQ, {nq_mag:+.2f}%) '
                    f'both bullish — broadest futures market signal. '
                    f'Institutional money flow confirmed across broad market and tech sectors simultaneously. '
                    f'Options market: SPY and QQQ call skew likely elevated. '
                    f'Best setup for long futures or index ETF calls.'),
                'action': 'Long ES and NQ futures; buy SPY/QQQ calls; buy the dip on Mag 7',
            })
        elif es_s == 'SELL' and nq_s == 'SELL':
            events.append({
                'category': 'FUTURES MARKET',
                'event':    'Futures Market Bearish — ES + NQ Both Selling',
                'impact':   'BEARISH', 'magnitude': 'HIGH',
                'affected': ['Futures', 'Stocks', 'Options'],
                'market_signal': f'ES {es_mag:+.2f}% | NQ {nq_mag:+.2f}%',
                'description': (
                    f'Both E-mini S&P (ES, {es_mag:+.2f}%) and Nasdaq (NQ, {nq_mag:+.2f}%) bearish. '
                    f'Institutional sellers dominant across both indices. '
                    f'Defensive sectors (XLU, XLP, XLV) and bonds likely to outperform. '
                    f'Avoid buying equity dips until breadth improves.'),
                'action': 'Short ES/NQ futures; buy SPY puts; long ZB; rotate to defensive ETFs',
            })

    # ── 9. Bond / Equity Correlation Breakdown ────────────────────────────────
    if zb and es:
        zb_s, es_s = zb.get('signal','HOLD'), es.get('signal','HOLD')
        if zb_s == 'BUY' and es_s == 'BUY':
            events.append({
                'category': 'MACRO CORRELATION',
                'event':    'Both Bonds & Equities Rising — Liquidity Flood',
                'impact':   'BULLISH', 'magnitude': 'MEDIUM',
                'affected': ['Stocks', 'Futures'],
                'market_signal': f'ZB BUY | ES BUY',
                'description': (
                    f'Rare bullish signal in both bonds (ZB) and equities (ES) simultaneously. '
                    f'Typically signals: central bank liquidity injection (QE), risk-on with safe-haven demand, '
                    f'or expectation of imminent rate cuts. '
                    f'Gold often joins the rally in this environment. '
                    f'Highly favorable for risk assets in the near term.'),
                'action': 'Maximum risk-on: long equities, bonds, and gold simultaneously; sell USD',
            })
        elif zb_s == 'SELL' and es_s == 'SELL':
            events.append({
                'category': 'MACRO CORRELATION',
                'event':    'Both Bonds & Equities Declining — Stagflation Risk',
                'impact':   'BEARISH', 'magnitude': 'HIGH',
                'affected': ['Stocks', 'Futures', 'Options'],
                'market_signal': f'ZB SELL | ES SELL',
                'description': (
                    f'Both bonds and equities selling simultaneously — rare and dangerous signal. '
                    f'Pattern consistent with stagflation (high inflation + slowing growth) or '
                    f'systemic credit event (both asset classes selling to raise cash). '
                    f'Commodities (gold, oil) may be the only store of value in this environment. '
                    f'Cash and short-duration instruments outperform.'),
                'action': 'Raise cash; long commodities (GLD, CL); short ES and ZB; defensive positioning only',
            })

    # ── Sort by magnitude then impact (BULLISH/BEARISH before NEUTRAL) ────────
    _m = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
    _i = {'BULLISH': 0, 'BEARISH': 0, 'MIXED': 1, 'NEUTRAL': 2}
    events.sort(key=lambda e: (_m.get(e.get('magnitude','LOW'), 2),
                                _i.get(e.get('impact','NEUTRAL'), 2)))
    return events


_FEAT_DISPLAY = {
    'sma20_ratio':  'SMA 20 Ratio',    'sma50_ratio':  'SMA 50 Ratio',
    'sma200_ratio': 'SMA 200 Ratio',   'macd':         'MACD Line',
    'macd_signal':  'MACD Signal',     'macd_hist':    'MACD Histogram',
    'rsi':          'RSI (14)',         'stoch_k':      'Stochastic %K',
    'williams_r':   'Williams %R',     'bb_width':     'BB Width',
    'bb_pos':       'BB Position',     'vol_ratio':    'Volume Ratio',
    'vol_regime':   'Vol Regime',      'ret1':         '1-Bar Return',
    'ret3':         '3-Bar Return',    'ret5':         '5-Bar Return',
    'ret10':        '10-Bar Return',   'ret20':        '20-Bar Return',
    'atr_pct':      'ATR % (Volatility)', 'oc_range':  'Open-Close Range',
    'hl_range':     'High-Low Range',  'obv_trend':    'OBV Trend',
    'adx':          'ADX (Trend Strength)', 'hv5_ratio': 'HV5/HV20 Ratio',
}


def compute_ml_ranking(all_results: list) -> dict:
    """
    Aggregate GBM feature importances across all symbols per asset type.
    Returns ranked feature lists (top 12) per asset type plus model metadata.
    """
    accum: dict[str, dict[str, float]] = {}
    counts: dict[str, int] = {}

    for r in all_results:
        atype = r.get('asset_type', 'stock')
        fi    = r.get('feature_importances', {})
        if not fi:
            continue
        if atype not in accum:
            accum[atype]  = {}
            counts[atype] = 0
        for feat, imp in fi.items():
            accum[atype][feat] = accum[atype].get(feat, 0.0) + imp
        counts[atype] += 1

    ranking: dict[str, list] = {}
    for atype, imp_dict in accum.items():
        n = counts[atype]
        if n == 0:
            continue
        avg = {k: v / n for k, v in imp_dict.items()}
        ranked = sorted(avg.items(), key=lambda x: x[1], reverse=True)
        total_imp = sum(v for _, v in ranked) or 1
        ranking[atype] = [
            {
                'rank':       i + 1,
                'key':        k,
                'feature':    _FEAT_DISPLAY.get(k, k.replace('_', ' ').title()),
                'importance': round(v, 4),
                'pct':        round(v / total_imp * 100, 1),
            }
            for i, (k, v) in enumerate(ranked[:12])
        ]

    model_info = {
        'method':            'Ensemble — GradientBoostingClassifier + ExtraTreesClassifier',
        'ensemble':          'VotingClassifier (soft vote — average probability)',
        'regressor':         'VotingRegressor (GBM + ExtraTreesRegressor)',
        'cv_method':         'TimeSeriesSplit(n_splits=5) walk-forward validation',
        'direction_signal':  'P(UP) ≥ 0.60 → BUY · P(UP) ≤ 0.40 → SELL · else HOLD',
        'high_vol_signal':   'P(UP) ≥ 0.62 → BUY · P(UP) ≤ 0.38 → SELL (high-vol regime)',
        'stocks_features':   len(STOCK_FEATURE_COLS),
        'options_features':  len(OPTIONS_FEATURE_COLS),
        'futures_features':  len(FUTURES_FEATURE_COLS),
        'training_window':   '120 days 4H bars (~360 bars per model)',
        'gbm_params':        'n_estimators=200, max_depth=4, learning_rate=0.05, subsample=0.8',
        'et_params':         'n_estimators=200, max_depth=6',
    }

    return {'by_asset_type': ranking, 'model_info': model_info}


@app.route('/api/market-summary')
def market_summary_endpoint():
    """
    Aggregate ML signals across all unique symbols to produce a market overview.
    Uses cached signals where available; falls back to quick_signal() for missing ones.
    Returns sentiment breadth, top movers, auto-generated notes, and per-group tables.
    """
    # Build unique (symbol, asset_type) pairs with primary group label
    sym_map: dict[str, tuple[str, str, str]] = {}  # key → (symbol, group, asset_type)
    for group in ['sp500', 'mag7', 'bluechip', 'futures', 'indices']:
        for sym in SYMBOLS.get(group, []):
            atype = _asset_type_for(sym)
            if sym not in sym_map:
                sym_map[sym] = (sym, group, atype)
    # Options get a separate entry with asset_type='options'
    for sym in SYMBOLS.get('options', []):
        key = f'{sym}:opts'
        if key not in sym_map:
            sym_map[key] = (sym, 'options', 'options')

    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'market-summary')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    results: dict[str, dict] = {}

    def fetch_one(key: str) -> tuple[str, dict | None]:
        sym, group, atype = sym_map[key]
        r = quick_signal(sym, atype, nocache=nocache)
        if r:
            r['group'] = group
        return key, r

    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(fetch_one, k): k for k in sym_map}
        for fut in as_completed(futs, timeout=120):
            try:
                key, r = fut.result()
                if r:
                    results[key] = r
            except Exception as e:
                print(f"[market-summary] {futs[fut]}: {e}")

    all_r = list(results.values())
    buy_c = sum(1 for r in all_r if r.get('signal') == 'BUY')
    sel_c = sum(1 for r in all_r if r.get('signal') == 'SELL')
    hld_c = sum(1 for r in all_r if r.get('signal') == 'HOLD')
    total = len(all_r) or 1
    bull_pct = buy_c / total * 100
    bear_pct = sel_c / total * 100

    if bull_pct >= 60:   direction = 'BULLISH'
    elif bear_pct >= 60: direction = 'BEARISH'
    elif bull_pct >= 45: direction = 'SLIGHTLY BULLISH'
    elif bear_pct >= 45: direction = 'SLIGHTLY BEARISH'
    else:                direction = 'NEUTRAL'

    avg_mag = sum(r.get('pred_magnitude_pct', 0) for r in all_r) / total

    by_group: dict[str, list] = {}
    for r in all_r:
        g = r.get('group', 'stocks')
        by_group.setdefault(g, []).append(r)
    for g in by_group:
        by_group[g].sort(key=lambda r: r.get('vol_ratio', 1), reverse=True)

    top_magnitude = sorted(all_r, key=lambda r: abs(r.get('pred_magnitude_pct', 0)), reverse=True)[:12]
    top_activity  = sorted(all_r, key=lambda r: r.get('vol_ratio', 1), reverse=True)[:12]
    strong_signals = sorted(
        [r for r in all_r if r.get('signal') != 'HOLD'],
        key=lambda r: abs(r.get('prob_up', 0.5) - 0.5), reverse=True
    )[:10]

    # Deduplicate by symbol for notes (keep highest-confidence entry per symbol)
    sym_results: dict[str, dict] = {}
    for r in all_r:
        sym = r.get('symbol', '')
        if sym not in sym_results or (abs(r.get('prob_up', 0.5) - 0.5) >
                                      abs(sym_results[sym].get('prob_up', 0.5) - 0.5)):
            sym_results[sym] = r

    notes         = generate_market_notes(sym_results)
    world_events  = generate_world_events(sym_results)
    ml_ranking    = compute_ml_ranking(all_r)

    # ── Build a plain-English market commentary paragraph ─────────────────────
    vix_r    = sym_results.get('^VIX')
    vix_lev  = vix_r.get('close', 20) if vix_r else 20
    es_r     = sym_results.get('ES=F')
    nq_r     = sym_results.get('NQ=F')
    gc_r     = sym_results.get('GC=F')
    vr_label = {0:'Low-volatility', 1:'Normal-volatility', 2:'High-volatility'}
    # pick most common vol regime across all assets
    from statistics import mode as _mode
    try:
        dom_regime = _mode(r.get('vol_regime', 1) for r in all_r)
    except Exception:
        dom_regime = 1
    commentary_parts = [
        f"Market direction as of {datetime.now().strftime('%b %d, %Y %H:%M')} is "
        f"<strong class=\"dir-{direction.replace(' ','-')}\">{direction}</strong> "
        f"({buy_c} BUY / {sel_c} SELL / {hld_c} HOLD across {total} signals). ",
        f"VIX at <strong>{vix_lev:.1f}</strong> — "
        f"{'extreme fear' if vix_lev>=30 else 'elevated fear' if vix_lev>=20 else 'normal range' if vix_lev>=15 else 'complacency'}. ",
    ]
    if es_r:
        commentary_parts.append(
            f"E-mini S&P (ES) is <strong>{es_r.get('signal','—')}</strong> "
            f"(P(UP)={es_r['prob_up']*100:.0f}%, target {es_r['pred_magnitude_pct']:+.2f}%). ")
    if nq_r:
        commentary_parts.append(
            f"Nasdaq futures (NQ) is <strong>{nq_r.get('signal','—')}</strong> "
            f"(P(UP)={nq_r['prob_up']*100:.0f}%, target {nq_r['pred_magnitude_pct']:+.2f}%). ")
    commentary_parts.append(
        f"The dominant volatility regime across tracked assets is "
        f"<strong>{vr_label.get(dom_regime,'Normal')}</strong>. "
        f"Average forecast magnitude: <strong>{avg_mag:+.3f}%</strong> per 4H bar. ")
    if gc_r:
        commentary_parts.append(
            f"Gold (GC) is <strong>{gc_r.get('signal','—')}</strong> at ${gc_r['close']:,.2f} "
            f"— {'safe-haven demand' if gc_r.get('signal')=='BUY' else 'risk-on rotation' if gc_r.get('signal')=='SELL' else 'consolidating'}. ")
    market_commentary = ''.join(commentary_parts)

    result = {
        'market_direction':   direction,
        'sentiment':          {'buy': buy_c, 'sell': sel_c, 'hold': hld_c,
                               'bull_pct': round(bull_pct, 1), 'bear_pct': round(bear_pct, 1),
                               'total': total},
        'avg_magnitude_pct':  round(avg_mag, 3),
        'top_magnitude':      top_magnitude,
        'top_activity':       top_activity,
        'strong_signals':     strong_signals,
        'by_group':           by_group,
        'notes':              notes,
        'world_events':       world_events,
        'ml_ranking':         ml_ranking,
        'market_commentary':  market_commentary,
        'symbols_computed':   len(results),
        'timestamp':          iso_now(),
    }
    cache_set(ck, result)
    return jsonify(result)


# ── SPX Hub (SPX-focused dashboard helpers) ───────────────────────────────────
_SPX_HUB_UNIVERSE: list[tuple[str, str]] = [
    # (symbol, sector-ish bucket) — used for treemap + breadth proxy
    ('SPY', 'Index ETFs'),
    ('QQQ', 'Index ETFs'),
    ('DIA', 'Index ETFs'),
    ('IWM', 'Index ETFs'),
    ('AAPL', 'Technology'),
    ('MSFT', 'Technology'),
    ('NVDA', 'Technology'),
    ('GOOGL', 'Communication'),
    ('AMZN', 'Consumer Discretionary'),
    ('META', 'Communication'),
    ('TSLA', 'Consumer Discretionary'),
    ('JPM', 'Financials'),
    ('BAC', 'Financials'),
    ('V', 'Financials'),
    ('XOM', 'Energy'),
    ('CVX', 'Energy'),
    ('JNJ', 'Healthcare'),
    ('UNH', 'Healthcare'),
    ('WMT', 'Consumer Staples'),
    ('HD', 'Consumer Discretionary'),
    ('BRK-B', 'Financials'),
]


def _safe_float(x, default: float = 0.0) -> float:
    try:
        v = float(x)
        if v != v:  # NaN
            return default
        if v == float('inf') or v == float('-inf'):
            return default
        return v
    except Exception:
        return default


def _compute_breadth_from_closes(symbols: list[str], nocache: bool = False) -> dict:
    """
    Breadth proxy: % of symbols above SMA50 and SMA200 using yfinance daily closes.
    This is NOT the full S&P 500 breadth unless the universe contains all constituents.
    """
    ck = cache_key('all', f"spx-breadth:{','.join(symbols)}")
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return cached

    rows = []
    above50 = 0
    above200 = 0
    total = 0

    # Download all symbols in one call for efficiency.
    with _yf_lock:
        df = yf.download(' '.join(symbols), period='260d', interval='1d',
                         group_by='ticker', auto_adjust=True, progress=False, threads=False)

    def _get_close_series(sym: str):
        try:
            if sym in df.columns.get_level_values(0):
                s = df[sym]['Close']
            else:
                # fallback for single-ticker shape
                s = df['Close'] if 'Close' in df.columns else None
            if s is None:
                return None
            s = s.dropna()
            return s if len(s) >= 60 else None
        except Exception:
            return None

    for sym in symbols:
        s = _get_close_series(sym)
        if s is None or len(s) < 60:
            continue
        close = float(s.iloc[-1])
        sma50 = float(s.rolling(50).mean().iloc[-1]) if len(s) >= 50 else None
        sma200 = float(s.rolling(200).mean().iloc[-1]) if len(s) >= 200 else None
        if sma50 and close > sma50:
            above50 += 1
        if sma200 and close > sma200:
            above200 += 1
        total += 1
        rows.append({
            'symbol': sym,
            'close': round(close, 4),
            'sma50': round(sma50, 4) if sma50 else None,
            'sma200': round(sma200, 4) if sma200 else None,
            'above50': bool(sma50 and close > sma50),
            'above200': bool(sma200 and close > sma200),
        })

    out = {
        'universe_count': len(symbols),
        'computed_count': total,
        'pct_above_50': round((above50 / max(total, 1)) * 100, 1),
        'pct_above_200': round((above200 / max(total, 1)) * 100, 1),
        'rows': rows,
        'timestamp': iso_now(),
    }
    cache_set(ck, out)
    return out


_SP500_CONSTITUENTS_URL = 'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv'
_SP500_CONSTITUENTS_CACHE: dict[str, object] = {'ts': 0.0, 'rows': []}


def _load_sp500_constituents(nocache: bool = False) -> list[dict]:
    """
    Loads S&P 500 constituents as list of dicts:
      {symbol, name, sector, industry}

    Prefers local file `data/sp500_constituents.csv` if present AND looks complete.
    Otherwise fetches from a public dataset URL and caches in memory.
    """
    try:
        import time as _t
        now = float(_t.time())
    except Exception:
        now = 0.0

    if (not nocache) and _SP500_CONSTITUENTS_CACHE.get('rows') and (now - float(_SP500_CONSTITUENTS_CACHE.get('ts') or 0.0) < 3600):
        return list(_SP500_CONSTITUENTS_CACHE.get('rows') or [])

    local_rows: list[dict] = []
    try:
        import csv as _csv
        base = os.path.dirname(__file__)
        p = os.path.join(base, 'data', 'sp500_constituents.csv')
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8', newline='') as f:
                r = _csv.DictReader(f)
                for row in r:
                    sym = (row.get('Symbol') or row.get('symbol') or '').strip().upper()
                    if not sym:
                        continue
                    local_rows.append({
                        'symbol': sym.replace('.', '-'),
                        'name': (row.get('Security') or row.get('security') or sym).strip(),
                        'sector': (row.get('GICS Sector') or row.get('sector') or 'Unknown').strip() or 'Unknown',
                        'industry': (row.get('GICS Sub-Industry') or row.get('industry') or '').strip(),
                    })
    except Exception:
        local_rows = []

    # If local file exists and is plausibly complete, use it.
    if len(local_rows) >= 480:
        _SP500_CONSTITUENTS_CACHE['rows'] = local_rows
        _SP500_CONSTITUENTS_CACHE['ts'] = now
        return local_rows

    # Remote fallback.
    remote_rows: list[dict] = []
    try:
        import csv as _csv
        import io as _io
        import urllib.request as _ur
        req = _ur.Request(_SP500_CONSTITUENTS_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with _ur.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
        f = _io.StringIO(raw)
        r = _csv.DictReader(f)
        for row in r:
            sym = (row.get('Symbol') or '').strip().upper()
            if not sym:
                continue
            remote_rows.append({
                'symbol': sym.replace('.', '-'),
                'name': (row.get('Security') or sym).strip(),
                'sector': (row.get('GICS Sector') or 'Unknown').strip() or 'Unknown',
                'industry': (row.get('GICS Sub-Industry') or '').strip(),
            })
    except Exception:
        remote_rows = []

    # Prefer remote if it looks better; else fall back to local even if incomplete.
    rows = remote_rows if len(remote_rows) >= len(local_rows) else local_rows
    _SP500_CONSTITUENTS_CACHE['rows'] = rows
    _SP500_CONSTITUENTS_CACHE['ts'] = now
    return rows


def _download_daily_closes_batched(symbols: list[str], period: str = '260d', lock=None) -> pd.DataFrame:
    """
    Batch yfinance.download calls to avoid ticker-count/URL limits.
    Returns a DataFrame where columns are ticker symbols and rows are daily closes.
    """
    symbols = [s for s in symbols if s]
    if not symbols:
        return pd.DataFrame()
    if lock is None:
        lock = _yf_lock
    out: list[pd.DataFrame] = []
    step = 90
    for i in range(0, len(symbols), step):
        chunk = symbols[i:i + step]
        with lock:
            df = yf.download(' '.join(chunk), period=period, interval='1d',
                             group_by='ticker', auto_adjust=True, progress=False, threads=False)
        if df is None or getattr(df, 'empty', True):
            continue
        try:
            if isinstance(df.columns, pd.MultiIndex):
                closes = {}
                lv0 = set([str(x) for x in df.columns.get_level_values(0)])
                lv1 = set([str(x) for x in df.columns.get_level_values(1)])
                for t in chunk:
                    sub = None
                    try:
                        # Common shape: (TICKER, FIELD)
                        if t in lv0:
                            sub = df[t]
                        # Alternate shape: (FIELD, TICKER)
                        elif t in lv1:
                            sub = df.xs(t, axis=1, level=1)
                    except Exception:
                        sub = None

                    if sub is None:
                        continue
                    try:
                        s = sub['Close'] if 'Close' in sub.columns else None
                    except Exception:
                        s = None
                    if s is not None:
                        closes[t] = s
                if closes:
                    out.append(pd.DataFrame(closes))
            else:
                # single ticker shape
                if 'Close' in df.columns and len(chunk) == 1:
                    out.append(pd.DataFrame({chunk[0]: df['Close']}))
        except Exception:
            continue
    if not out:
        return pd.DataFrame()
    try:
        m = pd.concat(out, axis=1)
        m = m.loc[:, ~m.columns.duplicated()]
        return m
    except Exception:
        return out[0]


def _to_et_index(df: pd.DataFrame) -> pd.DataFrame:
    """Best-effort convert candle index to America/New_York."""
    if df is None or df.empty:
        return df
    try:
        idx = df.index
        if not isinstance(idx, pd.DatetimeIndex):
            df = df.copy()
            df.index = pd.to_datetime(df.index)
            idx = df.index
        if idx.tz is None:
            idx = idx.tz_localize('UTC')
        df = df.copy()
        df.index = idx.tz_convert('America/New_York')
        return df
    except Exception:
        return df


def _build_0dte_projection(symbol: str = 'SPY', lookback: int = 12, weekday: int | None = None,
                           use_rth: bool = True) -> dict:
    """
    0DTE projection indicator (proxy):
    - Pull 5m candles
    - Build seasonality by weekday + 5m bucket since 09:30 ET (RTH)
    - Return today's actual + projected path for remainder of session
    """
    lookback = int(max(3, min(30, lookback)))

    try:
        now_et = datetime.now(ZoneInfo("America/New_York"))
    except Exception:
        now_et = datetime.now()
    wd = int(now_et.weekday() if weekday is None else weekday)

    # Proxy mapping
    req = symbol.upper()
    sym = req
    if req in ('SPX', '^SPX', '^GSPC', '^SPXW'):
        sym = 'SPY'

    df = get_candles(sym, interval='5m', period='60d')
    df = _to_et_index(df)
    if df is None or df.empty:
        return {'ok': False, 'error': f'No 5m data for {sym}', 'symbol': sym, 'requested_symbol': req, 'timestamp': iso_now()}

    if use_rth:
        try:
            df = df.between_time('09:30', '16:00')
        except Exception:
            pass

    try:
        dates = sorted({ts.date() for ts in df.index})
    except Exception:
        dates = []
    if not dates:
        return {'ok': False, 'error': 'No session dates in 5m data', 'symbol': sym, 'requested_symbol': req, 'timestamp': iso_now()}

    today = dates[-1]
    df_today = df[df.index.date == today].copy()
    if df_today.empty or len(df_today) < 5:
        return {'ok': False, 'error': 'Insufficient 5m bars for today', 'symbol': sym, 'requested_symbol': req, 'timestamp': iso_now()}

    hist_days: list = []
    for d in reversed(dates[:-1]):
        try:
            if datetime(d.year, d.month, d.day).weekday() == wd:
                hist_days.append(d)
        except Exception:
            continue
        if len(hist_days) >= lookback:
            break
    hist_days = list(reversed(hist_days))

    if len(hist_days) < max(3, lookback // 2):
        hist_days = dates[-(lookback + 1):-1]

    def bucket_i(ts_):
        try:
            m = ts_.hour * 60 + ts_.minute
            base = 9 * 60 + 30
            return int((m - base) // 5)
        except Exception:
            return None

    buckets: dict[int, list[float]] = {}
    for d in hist_days:
        day_df = df[df.index.date == d]
        if day_df.empty or len(day_df) < 20:
            continue
        try:
            o = float(day_df['Open'].iloc[0])
            if not o or o <= 0:
                continue
            for ts, row in day_df.iterrows():
                bi = bucket_i(ts)
                if bi is None or bi < 0:
                    continue
                c = float(row['Close'])
                r = (c / o) - 1.0
                buckets.setdefault(bi, []).append(r)
        except Exception:
            continue

    if not buckets:
        return {'ok': False, 'error': 'No historical buckets built', 'symbol': sym, 'requested_symbol': req, 'timestamp': iso_now()}

    max_bi = max(buckets.keys())
    season = []
    for bi in range(0, max_bi + 1):
        arr = buckets.get(bi, [])
        if not arr:
            season.append({'i': bi, 'mean': None, 'p25': None, 'p75': None, 'n': 0})
            continue
        s = pd.Series(arr, dtype='float64')
        season.append({
            'i': bi,
            'mean': float(s.mean()),
            'p25': float(s.quantile(0.25)),
            'p75': float(s.quantile(0.75)),
            'n': int(s.count()),
        })

    o_today = float(df_today['Open'].iloc[0])
    actual = []
    last_ts = None
    for ts, row in df_today.iterrows():
        bi = bucket_i(ts)
        if bi is None or bi < 0:
            continue
        c = float(row['Close'])
        actual.append({
            'time': int(ts.timestamp()),
            'i': int(bi),
            'price': round(c, 4),
            'ret_from_open': (c / o_today) - 1.0 if o_today else 0.0,
        })
        last_ts = ts

    if not actual:
        return {'ok': False, 'error': 'No actual points built', 'symbol': sym, 'requested_symbol': req, 'timestamp': iso_now()}

    cur_i = int(actual[-1]['i'])

    proj = []
    for item in season:
        bi = int(item['i'])
        if bi <= cur_i:
            continue
        if item['mean'] is None:
            continue
        try:
            base = datetime(today.year, today.month, today.day, 9, 30, tzinfo=ZoneInfo("America/New_York"))
            ts = base + timedelta(minutes=bi * 5)
            tsec = int(ts.timestamp())
        except Exception:
            tsec = int((last_ts.timestamp() if last_ts else datetime.now().timestamp()) + (bi - cur_i) * 300)

        mean_px = o_today * (1.0 + float(item['mean']))
        lo_px = o_today * (1.0 + float(item['p25'])) if item.get('p25') is not None else None
        hi_px = o_today * (1.0 + float(item['p75'])) if item.get('p75') is not None else None
        proj.append({
            'time': tsec,
            'i': bi,
            'price_mean': round(float(mean_px), 4),
            'price_p25': round(float(lo_px), 4) if lo_px is not None else None,
            'price_p75': round(float(hi_px), 4) if hi_px is not None else None,
            'n': int(item.get('n') or 0),
        })

    return {
        'ok': True,
        'requested_symbol': req,
        'symbol': sym,
        'weekday': wd,
        'use_rth': bool(use_rth),
        'today_date_et': str(today),
        'lookback_days': len(hist_days),
        'actual': actual,
        'projection': proj,
        'timestamp': iso_now(),
        'note': 'Seasonality projection from 5m history by weekday/time bucket. Proxy uses SPY for SPX.',
    }


@app.route('/api/0dte-projection')
def o0dte_projection_endpoint():
    """
    0DTE Projection indicator (5m seasonality).
    Params:
      symbol=SPX|SPY
      lookback=12 (weekday samples)
      weekday=0..4 (optional, default = today ET)
      rth=1 (regular trading hours only)
    """
    nocache = request.args.get('nocache', '0') == '1'
    symbol = (request.args.get('symbol') or 'SPX').strip().upper()
    try:
        lookback = int(request.args.get('lookback') or 12)
    except Exception:
        lookback = 12
    w_s = request.args.get('weekday')
    try:
        weekday = int(w_s) if (w_s is not None and w_s != '') else None
    except Exception:
        weekday = None
    rth = request.args.get('rth', '1') == '1'

    ck = cache_key(symbol, f'0dte-proj:{lookback}:{weekday}:{int(rth)}')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    result = _build_0dte_projection(symbol=symbol, lookback=lookback, weekday=weekday, use_rth=rth)
    cache_set(ck, result)
    return jsonify(result)


@app.route('/api/sp500-map')
def sp500_map_endpoint():
    """
    Full S&P 500 treemap feed + true breadth.
    """
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'sp500-map')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    # This endpoint can be slow on first run (500 tickers). We compute in a background
    # thread and return quickly with a "computing" status; the frontend polls again.
    global _SP500_MAP_WORKING  # type: ignore[declared-but-unused]
    global _SP500_MAP_LAST_ERR  # type: ignore[declared-but-unused]
    try:
        _SP500_MAP_WORKING
    except Exception:
        _SP500_MAP_WORKING = False
    try:
        _SP500_MAP_LAST_ERR
    except Exception:
        _SP500_MAP_LAST_ERR = None

    if not _SP500_MAP_WORKING:
        _SP500_MAP_WORKING = True
        _SP500_MAP_LAST_ERR = None

        def _compute():
            global _SP500_MAP_WORKING
            global _SP500_MAP_LAST_ERR
            try:
                cons = _load_sp500_constituents(nocache=nocache)
                symbols = [c['symbol'] for c in cons if c.get('symbol')]

                # 220d usually covers SMA200 while being smaller/faster than 260d.
                # Use a dedicated lock so this job doesn't stall other yfinance-backed endpoints.
                global _SP500_YF_LOCK  # type: ignore[declared-but-unused]
                try:
                    _SP500_YF_LOCK
                except Exception:
                    import threading as _th2
                    _SP500_YF_LOCK = _th2.Lock()

                closes = _download_daily_closes_batched(symbols, period='220d', lock=_SP500_YF_LOCK)
                if closes is None or closes.empty:
                    out = {
                        'ok': False,
                        'status': 'error',
                        'error': 'No data returned from yfinance for constituents.',
                        'constituents_count': len(cons),
                        'computed_count': 0,
                        'treemap': [],
                        'breadth': {'pct_above_50': None, 'pct_above_200': None, 'computed_count': 0},
                        'timestamp': iso_now(),
                    }
                    cache_set(ck, out)
                    return

                # Compute daily % change from last two closes.
                try:
                    last = closes.iloc[-1]
                    prev = closes.iloc[-2] if len(closes) >= 2 else closes.iloc[-1]
                except Exception:
                    last = closes.tail(1).T.iloc[:, 0]
                    prev = last

                def _norm_sym(x) -> str:
                    try:
                        s = str(x).strip().upper()
                    except Exception:
                        s = ''
                    return s.replace('.', '-')

                # Build a lookup so we can handle occasional weird column labels.
                col_map: dict[str, object] = {}
                try:
                    for ccol in list(closes.columns):
                        raw = ccol[-1] if isinstance(ccol, tuple) and len(ccol) else ccol
                        col_map[_norm_sym(raw)] = ccol
                except Exception:
                    col_map = {}

                # Build sector/name lookup from constituents, but compute treemap using the
                # actual columns we received from yfinance (avoids symbol mismatch edge cases).
                meta_map: dict[str, dict] = {}
                try:
                    for c in cons:
                        s = c.get('symbol')
                        if not s:
                            continue
                        meta_map[_norm_sym(s)] = c
                except Exception:
                    meta_map = {}

                treemap: list[dict] = []
                computed = 0
                for ccol in list(closes.columns):
                    try:
                        raw = ccol[-1] if isinstance(ccol, tuple) and len(ccol) else ccol
                        sym = _norm_sym(raw)
                        c0 = _safe_float(last.get(ccol), None)  # type: ignore[arg-type]
                        c1 = _safe_float(prev.get(ccol), None)  # type: ignore[arg-type]
                        if c0 is None or c1 is None or c1 == 0:
                            continue
                        chg_pct = (c0 - c1) / c1 * 100.0
                        computed += 1
                        meta = meta_map.get(sym, {})
                        treemap.append({
                            'symbol': sym,
                            'label': meta.get('name') or sym,
                            'sector': meta.get('sector') or 'Unknown',
                            'industry': meta.get('industry') or '',
                            'price': round(float(c0), 4),
                            'change_pct': round(float(chg_pct), 3),
                            'weight': 1.0,
                        })
                    except Exception:
                        continue

                # Breadth: pct above SMA50 / SMA200 (vectorized).
                try:
                    sma50 = closes.rolling(50).mean().iloc[-1]
                    sma200 = closes.rolling(200).mean().iloc[-1] if len(closes) >= 200 else None
                    above50 = (last > sma50)
                    above200 = (last > sma200) if sma200 is not None else None
                    computed_b = int(above50.count())
                    pct50 = float((above50.sum() / max(computed_b, 1)) * 100.0)
                    if above200 is not None:
                        computed_b2 = int(above200.count())
                        pct200 = float((above200.sum() / max(computed_b2, 1)) * 100.0)
                    else:
                        pct200 = None
                except Exception:
                    computed_b = 0
                    pct50 = None
                    pct200 = None

                out = {
                    'ok': True,
                    'status': 'ready',
                    'constituents_count': len(cons),
                    'computed_count': computed,
                    'treemap': treemap,
                    'breadth': {
                        'pct_above_50': round(pct50, 1) if pct50 is not None else None,
                        'pct_above_200': round(pct200, 1) if pct200 is not None else None,
                        'computed_count': computed_b,
                    },
                    'timestamp': iso_now(),
                }
                cache_set(ck, out)
            except Exception as e:
                _SP500_MAP_LAST_ERR = str(e)
                cache_set(ck, {
                    'ok': False,
                    'status': 'error',
                    'error': _SP500_MAP_LAST_ERR,
                    'timestamp': iso_now(),
                })
            finally:
                _SP500_MAP_WORKING = False

        try:
            import threading as _th
            _th.Thread(target=_compute, daemon=True).start()
        except Exception:
            # If threading isn't available, we'll just fall through and compute inline next call.
            _SP500_MAP_WORKING = False

    out = {
        'ok': False,
        'status': 'computing',
        'error': _SP500_MAP_LAST_ERR,
        'timestamp': iso_now(),
    }
    return jsonify(out)


@app.route('/api/spx-hub')
def spx_hub_endpoint():
    """
    SPX-focused dashboard data:
    - SPX spot (via ^GSPC) + SPY proxy spot
    - Mini "constituent" treemap universe (ETFs + Mag7 + key blue chips)
    - Breadth proxy (% above 50/200-day SMA) for that universe
    """
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'spx-hub')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    universe_syms = [s for s, _ in _SPX_HUB_UNIVERSE]

    # Quotes (use existing /api/quote machinery via helper if present)
    def _quote(sym: str) -> dict:
        try:
            q = quote_symbol(sym, nocache=nocache)  # type: ignore[name-defined]
            if isinstance(q, dict):
                return q
        except Exception:
            pass
        # fallback minimal
        try:
            with _yf_lock:
                raw = yf.download(sym, period='5d', interval='1d', auto_adjust=True,
                                  progress=False, threads=False)
            if raw is None or raw.empty:
                return {'symbol': sym, 'price': None, 'change': None, 'change_pct': None}
            if isinstance(raw.columns, pd.MultiIndex):
                raw.columns = raw.columns.get_level_values(0)
            c0 = _safe_float(raw['Close'].iloc[-1], 0.0)
            c1 = _safe_float(raw['Close'].iloc[-2], c0)
            chg = c0 - c1
            pct = (chg / c1 * 100) if c1 else 0.0
            return {'symbol': sym, 'price': round(c0, 4), 'change': round(chg, 4), 'change_pct': round(pct, 2)}
        except Exception:
            return {'symbol': sym, 'price': None, 'change': None, 'change_pct': None}

    spx = _quote('^GSPC')
    spy = _quote('SPY')

    # Treemap returns: 1-day % change for universe
    quotes = {sym: _quote(sym) for sym in universe_syms}
    treemap = []
    for sym, sector in _SPX_HUB_UNIVERSE:
        q = quotes.get(sym, {})
        treemap.append({
            'symbol': sym,
            'label': SYMBOL_LABELS.get(sym, sym),
            'sector': sector,
            'price': q.get('price'),
            'change_pct': q.get('change_pct'),
            # Provide a default "weight" so tiles are stable even without real index weights
            'weight': 1.0,
        })

    breadth = _compute_breadth_from_closes(universe_syms, nocache=nocache)

    result = {
        'spx': spx,
        'spy': spy,
        'treemap': treemap,
        'breadth': breadth,
        'universe': [{'symbol': s, 'sector': sec} for s, sec in _SPX_HUB_UNIVERSE],
        'timestamp': iso_now(),
        'note': 'Breadth + treemap are computed on a proxy universe (ETFs + Mag7 + key blue chips). Add full SPX constituents list to upgrade to true S&P 500 breadth/map.',
    }
    cache_set(ck, result)
    return jsonify(result)



# ── SPX 0DTE Fat-Tail Risk Dashboard ─────────────────────────────────────────
def _vix1d_regime(v: float | None) -> dict:
    if v is None or not math.isfinite(float(v)):
        return {'level': 'unknown', 'label': 'Unavailable', 'color': '#94a3b8',
                'guidance': 'VIX1D data unavailable — use VIX9D proxy or wait for feed.'}
    if v < 12:
        return {'level': 'low', 'label': 'Low Risk', 'color': '#4ade80',
                'guidance': 'Market prices tight ranges — favor quick scalp exits and tight stops.'}
    if v <= 18:
        return {'level': 'normal', 'label': 'Normal Range', 'color': '#22d3ee',
                'guidance': 'Historical-normal 0DTE environment — standard ATM/OTM structures apply.'}
    if v <= 20:
        return {'level': 'elevated', 'label': 'Elevated', 'color': '#fbbf24',
                'guidance': 'Vol rising — trim contract size and avoid naked short gamma.'}
    return {'level': 'fat_tail', 'label': 'Fat Tail', 'color': '#f87171',
            'guidance': 'Premiums inflated, gap risk high — cut size sharply or widen spread distance.'}


def _gex_0dte_assessment(gex_row: dict | None) -> dict:
    if not gex_row or gex_row.get('no_options'):
        return {'level': 'unknown', 'label': 'GEX Unavailable', 'color': '#94a3b8',
                'guidance': 'No GEX data — confirm SPY chain before sizing 0DTE.'}
    total = float(gex_row.get('total_gex_m') or 0)
    regime = (gex_row.get('regime') or '').lower()
    neg = total < 0 or 'short' in regime or 'negative' in regime
    near_zero = abs(total) < 50
    if neg or near_zero:
        return {'level': 'negative', 'label': 'Zero / Negative GEX', 'color': '#f87171',
                'guidance': 'Dealers amplify moves — fat-tail breakouts likely; favor defined-risk spreads.'}
    return {'level': 'positive', 'label': 'Positive GEX', 'color': '#4ade80',
            'guidance': 'Dealers dampen vol — range/pin behavior more likely near key strikes.'}


def _option_mid(row) -> float:
    try:
        bid = float(row.get('bid') or 0)
        ask = float(row.get('ask') or 0)
        if bid > 0 and ask > 0:
            return (bid + ask) / 2.0
        for k in ('lastPrice', 'ask', 'bid'):
            v = float(row.get(k) or 0)
            if v > 0:
                return v
    except Exception:
        pass
    return 0.0


def _zero_dte_atm_straddle(spy_spot: float) -> dict | None:
    """ATM straddle on nearest 0DTE SPY expiry for expected-move estimate."""
    from datetime import date as _date
    if not spy_spot or spy_spot <= 0:
        return None
    try:
        with _yf_lock:
            tk = yf.Ticker('SPY')
            exps = list(tk.options or [])
        if not exps:
            return None
        today = _date.today().isoformat()
        exp = today if today in exps else exps[0]
        dte = max(0, (_date.fromisoformat(exp) - _date.today()).days)
        with _yf_lock:
            chain = tk.option_chain(exp)
        calls, puts = chain.calls, chain.puts
        if calls.empty or puts.empty:
            return None
        atm_idx = (calls['strike'] - spy_spot).abs().argsort().iloc[0]
        strike = float(calls.iloc[atm_idx]['strike'])
        cr = calls[calls['strike'] == strike]
        pr = puts[puts['strike'] == strike]
        if cr.empty or pr.empty:
            return None
        call_mid = _option_mid(cr.iloc[0])
        put_mid = _option_mid(pr.iloc[0])
        straddle = call_mid + put_mid
        if straddle <= 0:
            return None
        return {
            'expiry': exp,
            'dte': dte,
            'strike_spy': strike,
            'call_mid': round(call_mid, 2),
            'put_mid': round(put_mid, 2),
            'straddle_spy': round(straddle, 2),
            'straddle_pct_spy': round(straddle / spy_spot * 100, 3),
        }
    except Exception as e:
        print(f'[_zero_dte_atm_straddle] {e}')
        return None


def _session_open_from_candles(df: pd.DataFrame) -> float | None:
    if df is None or df.empty:
        return None
    try:
        idx = df.index
        if hasattr(idx, 'tz') and idx.tz is not None:
            local = idx.tz_convert('America/New_York')
        else:
            local = idx
        today = pd.Timestamp.now(tz='America/New_York').date()
        mask = local.date == today
        sub = df.loc[mask] if mask.any() else df.tail(78)
        if sub.empty:
            return None
        return float(sub['Open'].iloc[0])
    except Exception:
        try:
            return float(df['Open'].iloc[-78])
        except Exception:
            return float(df['Open'].iloc[0])


def _compute_tail_risk_stats(spx_spot: float, session_open: float | None) -> dict:
    from scipy.stats import kurtosis
    out = {
        'excess_kurtosis': None,
        'kurtosis_flag': False,
        'z_score_daily': None,
        'z_score_intraday': None,
        'z_breach_35': False,
        'daily_sigma_pct': None,
        'session_return_pct': None,
    }
    try:
        df_d = get_candles('^GSPC', interval='1d', period='120d')
        if df_d is not None and len(df_d) >= 30:
            rets = df_d['Close'].pct_change().dropna()
            if len(rets) >= 20:
                ex_k = float(kurtosis(rets.values, fisher=True))
                out['excess_kurtosis'] = round(ex_k, 2)
                out['kurtosis_flag'] = ex_k > 3.0
                sigma = float(rets.std())
                out['daily_sigma_pct'] = round(sigma * 100, 3)
                if len(rets) >= 2 and spx_spot:
                    prev = float(df_d['Close'].iloc[-2])
                    z_d = (spx_spot - prev) / (prev * sigma) if sigma > 0 else 0.0
                    out['z_score_daily'] = round(z_d, 2)
                    if abs(z_d) >= 3.5:
                        out['z_breach_35'] = True
        if session_open and spx_spot and session_open > 0:
            sess_ret = (spx_spot - session_open) / session_open
            out['session_return_pct'] = round(sess_ret * 100, 3)
            sigma = out.get('daily_sigma_pct')
            if sigma and sigma > 0:
                z_i = sess_ret / (sigma / 100.0)
                out['z_score_intraday'] = round(z_i, 2)
                if abs(z_i) >= 3.5:
                    out['z_breach_35'] = True
    except Exception as e:
        print(f'[_compute_tail_risk_stats] {e}')
    return out


def _build_spx_0dte_risk(nocache: bool = False) -> dict:
    """Aggregate VIX1D, expected move, GEX, and tail stats for SPX 0DTE prep."""
    def _last(sym: str) -> float | None:
        try:
            with _yf_lock:
                p = float(yf.Ticker(sym).fast_info.last_price)
                if p > 0:
                    return p
        except Exception:
            pass
        df = get_candles(sym, interval='1d', period='5d')
        if df is not None and not df.empty:
            return float(df['Close'].iloc[-1])
        return None

    vix1d_sym = '^VIX1D'
    vix1d = _last(vix1d_sym)
    vix1d_source = 'VIX1D'
    if vix1d is None:
        vix1d = _last('^VIX9D')
        vix1d_source = 'VIX9D (proxy)'
    vix30 = _last('^VIX')
    spx_spot = _last('^GSPC')
    spy_spot = _last('SPY')
    ratio = (spx_spot / spy_spot) if (spx_spot and spy_spot and spy_spot > 0) else None

    straddle = _zero_dte_atm_straddle(spy_spot or 0.0)
    vix_regime = _vix1d_regime(vix1d)

    em = {
        'method': None,
        'straddle_spx_pts': None,
        'straddle_pct': None,
        'vix1d_implied_pts': None,
        'vix1d_implied_pct': None,
        'partial_pct': 0.55,
        'partial_pts': round(spx_spot * 0.0055, 1) if spx_spot else None,
        'upper_full': None,
        'lower_full': None,
        'upper_partial': None,
        'lower_partial': None,
        'session_open': None,
        'breached_full': False,
        'breached_partial': False,
        'move_from_open_pct': None,
    }

    if straddle and ratio:
        spx_straddle = straddle['straddle_spy'] * ratio
        em['method'] = 'ATM 0DTE straddle (SPY scaled to SPX)'
        em['straddle_spx_pts'] = round(spx_straddle, 1)
        em['straddle_pct'] = round(spx_straddle / spx_spot * 100, 3) if spx_spot else None
        em['expiry'] = straddle.get('expiry')
        em['strike_spy'] = straddle.get('strike_spy')

    if vix1d and spx_spot:
        vix_pct = (vix1d / 100.0) / np.sqrt(252)
        em['vix1d_implied_pts'] = round(vix_pct * spx_spot, 1)
        em['vix1d_implied_pct'] = round(vix_pct * 100, 3)

    df5 = get_candles('SPY', interval='5m', period='5d')
    session_open_spy = _session_open_from_candles(df5)
    session_open = (session_open_spy * ratio) if (session_open_spy and ratio) else session_open_spy
    if session_open_spy and not ratio:
        session_open = session_open_spy
    em['session_open'] = round(session_open, 2) if session_open else None

    anchor = session_open or spx_spot
    move_pts = abs(spx_spot - anchor) if (spx_spot and anchor) else 0
    if anchor and spx_spot:
        em['move_from_open_pct'] = round((spx_spot - anchor) / anchor * 100, 3)

    full_pts = em.get('straddle_spx_pts') or em.get('vix1d_implied_pts')
    if anchor and full_pts:
        em['upper_full'] = round(anchor + full_pts, 2)
        em['lower_full'] = round(anchor - full_pts, 2)
        if move_pts >= full_pts:
            em['breached_full'] = True
    partial_pts = em.get('partial_pts') or (spx_spot * 0.0055 if spx_spot else None)
    if anchor and partial_pts:
        em['upper_partial'] = round(anchor + partial_pts, 2)
        em['lower_partial'] = round(anchor - partial_pts, 2)
        if move_pts >= partial_pts:
            em['breached_partial'] = True

    gex_row = _gex_row('SPX', 'Indices', nocache=nocache) or _gex_row('SPY', 'ETFs', nocache=nocache)
    gex_assess = _gex_0dte_assessment(gex_row)
    tail = _compute_tail_risk_stats(spx_spot or 0.0, session_open)

    score = 0
    if vix_regime['level'] == 'fat_tail':
        score += 3
    elif vix_regime['level'] == 'elevated':
        score += 2
    elif vix_regime['level'] == 'normal':
        score += 1
    if gex_assess['level'] == 'negative':
        score += 2
    if em.get('breached_full'):
        score += 2
    if tail.get('z_breach_35'):
        score += 2
    if tail.get('kurtosis_flag'):
        score += 1

    if score <= 2:
        composite = {'level': 'favorable', 'label': 'Favorable for Defined-Risk 0DTE',
                     'color': '#4ade80', 'size_guidance': 'Normal defined-risk size OK'}
    elif score <= 4:
        composite = {'level': 'caution', 'label': 'Caution — Trim Size',
                     'color': '#fbbf24', 'size_guidance': 'Reduce contracts ~30–50%; prefer spreads over naked'}
    elif score <= 6:
        composite = {'level': 'elevated', 'label': 'Elevated Tail Risk',
                     'color': '#f97316', 'size_guidance': 'Half size or wider spreads; avoid iron condors at EM boundary'}
    else:
        composite = {'level': 'extreme', 'label': 'Extreme — Capital Preservation',
                     'color': '#f87171', 'size_guidance': 'Avoid new 0DTE or paper-only until VIX1D & GEX stabilize'}

    playbook = []
    if vix_regime['level'] == 'low':
        playbook.append('VIX1D < 12: scalp-friendly — take profits quickly, don\'t hold through lunch chop.')
    elif vix_regime['level'] == 'fat_tail':
        playbook.append('VIX1D > 20: drop size, widen strikes, no naked short gamma.')
    if em.get('breached_full'):
        playbook.append('SPX beyond full expected move — mean-reversion thesis invalid; use stops at EM boundary.')
    if gex_assess['level'] == 'negative':
        playbook.append('Negative GEX: momentum can accelerate — avoid selling uncovered premium into trends.')
    if tail.get('z_breach_35'):
        playbook.append(f'Z-score breach (|Z| ≥ 3.5): distribution tail event — fade only with tight risk.')
    if not playbook:
        playbook.append('All pillars in normal band — standard SPXW defined-risk setups apply with normal size.')

    return {
        'vix1d': round(vix1d, 2) if vix1d else None,
        'vix1d_source': vix1d_source,
        'vix30': round(vix30, 2) if vix30 else None,
        'vix1d_regime': vix_regime,
        'spx_spot': round(spx_spot, 2) if spx_spot else None,
        'spy_spot': round(spy_spot, 2) if spy_spot else None,
        'expected_move': em,
        'gex': {
            'symbol': gex_row.get('symbol') if gex_row else None,
            'spot': gex_row.get('spot') if gex_row else None,
            'total_gex_m': gex_row.get('total_gex_m') if gex_row else None,
            'regime': gex_row.get('regime') if gex_row else None,
            'call_wall': gex_row.get('gamma_wall') or gex_row.get('call_wall') if gex_row else None,
            'put_wall': gex_row.get('put_wall') if gex_row else None,
            'flip_level': gex_row.get('flip_level') if gex_row else None,
            'assessment': gex_assess,
        },
        'tail_risk': tail,
        'composite': composite,
        'risk_score': score,
        'playbook': playbook,
        'timestamp': iso_now(),
    }


@app.route('/api/spx-0dte-risk')
def spx_0dte_risk_endpoint():
    """SPX 0DTE fat-tail prep: VIX1D, expected move, GEX regime, kurtosis/z-scores."""
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'spx-0dte-risk')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)
    result = _build_spx_0dte_risk(nocache=nocache)
    cache_set(ck, result)
    return jsonify(result)


# ── Feature Table endpoint ────────────────────────────────────────────────────
# Returns top-10 ML feature values + signal for every tracked asset so the
# ml-key-assets.html page can render a colour-coded feature × asset table.

TOP10_FEATURES = ['rsi', 'macd_hist', 'atr_pct', 'sma20_ratio', 'bb_pos',
                  'vol_ratio', 'ret5', 'obv_trend', 'stoch_k', 'adx', 'sharpe_20']

# Asset groups displayed in the page
_FEATURE_TABLE_GROUPS = [
    ('ETFs',        SYMBOLS['sp500']),
    ('Mag 7',       SYMBOLS['mag7']),
    ('Blue Chips',  SYMBOLS['bluechip']),
    ('Futures',     SYMBOLS['futures']),
]

def _feature_row(symbol: str, group: str, nocache: bool = False) -> dict | None:
    """Compute one row of the feature table for a single symbol."""
    atype = _asset_type_for(symbol)
    ck    = cache_key(symbol, 'feat-row')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return cached
    try:
        df_4h = get_4h_candles(symbol, period='120d')
        if df_4h.empty or len(df_4h) < 60:
            return None
        df      = compute_features(df_4h)
        if df.empty:
            return None
        latest  = df.iloc[-1]
        close   = float(latest['Close'])
        atr     = float(latest.get('atr', 0))

        # Feature values
        feats = {}
        for f in TOP10_FEATURES:
            feats[f] = round(float(latest[f]), 4) if f in df.columns else None

        # Quick ML signal (re-use cache if available)
        sig_ck  = cache_key(symbol, 'signal')
        sig_val = cache_get(sig_ck) if not nocache else None
        if sig_val is None:
            feat_cols = _ASSET_FEATURE_MAP.get(atype, STOCK_FEATURE_COLS)
            d = df.copy()
            d['future_ret'] = d['Close'].pct_change(1).shift(-1)
            d['direction']  = (d['future_ret'] > 0).astype(int)
            d = d.dropna(subset=feat_cols + ['direction', 'future_ret'])
            if len(d) >= 60:
                from sklearn.preprocessing import StandardScaler
                from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
                X      = d[feat_cols].values
                scaler = StandardScaler()
                X_sc   = scaler.fit_transform(X)
                clf    = GradientBoostingClassifier(n_estimators=100, max_depth=4,
                                                    learning_rate=0.05, subsample=0.8, random_state=42)
                clf.fit(X_sc, d['direction'].values)
                X_lat   = scaler.transform([[latest[c] for c in feat_cols]])
                prob_up = float(clf.predict_proba(X_lat)[0][1])
                vol_reg = int(latest.get('vol_regime', 1))
                buy_t, sell_t = (0.62, 0.38) if vol_reg == 2 else (0.60, 0.40)
                signal  = 'BUY' if prob_up >= buy_t else ('SELL' if prob_up <= sell_t else 'HOLD')
            else:
                prob_up, signal = 0.5, 'HOLD'
        else:
            prob_up = sig_val.get('prob_up', 0.5)
            signal  = sig_val.get('signal', 'HOLD')

        # Bullish/bearish score: count how many of the top-10 features lean bullish
        bull_pts = 0
        if feats.get('rsi') is not None:
            bull_pts += 1 if feats['rsi'] < 50 else (-1 if feats['rsi'] > 60 else 0)
        if feats.get('macd_hist') is not None:
            bull_pts += 1 if feats['macd_hist'] > 0 else -1
        if feats.get('sma20_ratio') is not None:
            bull_pts += 1 if feats['sma20_ratio'] > 1.002 else (-1 if feats['sma20_ratio'] < 0.998 else 0)
        if feats.get('bb_pos') is not None:
            bull_pts += 1 if feats['bb_pos'] > 0.55 else (-1 if feats['bb_pos'] < 0.40 else 0)
        if feats.get('ret5') is not None:
            bull_pts += 1 if feats['ret5'] > 0 else -1
        if feats.get('obv_trend') is not None:
            bull_pts += 1 if feats['obv_trend'] > 0.1 else (-1 if feats['obv_trend'] < -0.1 else 0)
        if feats.get('stoch_k') is not None:
            bull_pts += 0  # neutral (stoch_k is mostly regime, not direction)
        if feats.get('vol_ratio') is not None:
            bull_pts += 1 if feats['vol_ratio'] > 1.2 and signal == 'BUY' else 0

        trend = 'BULLISH' if (signal == 'BUY' or (signal == 'HOLD' and bull_pts >= 2)) else \
                'BEARISH' if (signal == 'SELL' or (signal == 'HOLD' and bull_pts <= -2)) else 'NEUTRAL'

        row = {
            'symbol':    symbol,
            'label':     SYMBOL_LABELS.get(symbol, symbol),
            'group':     group,
            'asset_type': atype,
            'close':     round(close, 4),
            'signal':    signal,
            'prob_up':   round(prob_up, 4),
            'trend':     trend,
            'bull_score': bull_pts,
            'atr_pct':   round(atr / close * 100, 3) if close > 0 else 0,
            'vol_regime': int(latest.get('vol_regime', 1)),
            'features':  feats,
        }
        cache_set(ck, row)
        return row
    except Exception as e:
        print(f'[feature-table] {symbol}: {e}')
        return None


@app.route('/api/feature-table')
def feature_table_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'feature-table')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    all_items = []
    for group, syms in _FEATURE_TABLE_GROUPS:
        for sym in syms:
            all_items.append((sym, group))

    from concurrent.futures import ThreadPoolExecutor, as_completed
    rows = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = {pool.submit(_feature_row, sym, grp, nocache): sym
                for sym, grp in all_items}
        for fut in as_completed(futs):
            row = fut.result()
            if row:
                rows.append(row)

    # Sort: groups in defined order, then by symbol
    group_order = {g: i for i, (g, _) in enumerate(_FEATURE_TABLE_GROUPS)}
    rows.sort(key=lambda r: (group_order.get(r['group'], 99), r['symbol']))

    result = {
        'assets':    rows,
        'features':  TOP10_FEATURES,
        'count':     len(rows),
        'timestamp': datetime.now().isoformat(),
    }
    cache_set(ck, result)
    return jsonify(result)


# ── Gamma Exposure (SpotGamma-style) ─────────────────────────────────────────
def _bs_gamma(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Black-Scholes gamma (identical for calls and puts)."""
    from scipy.stats import norm
    if T <= 1e-6 or sigma <= 1e-6 or S <= 0 or K <= 0:
        return 0.0
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        return float(norm.pdf(d1) / (S * sigma * np.sqrt(T)))
    except Exception:
        return 0.0


def _gex_row(symbol: str, group: str, nocache: bool = False) -> dict | None:
    """Fetch options chain, compute net GEX per strike, return SpotGamma data."""
    ck = cache_key(symbol, 'gex')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return cached

    _is_futures = symbol in SYMBOLS.get('futures', [])
    def _safe_int(x) -> int:
        try:
            if x is None or (isinstance(x, float) and np.isnan(x)) or (hasattr(pd, "isna") and pd.isna(x)):
                return 0
            return int(x)
        except Exception:
            return 0

    def _no_data_row(spot):
        """Return a minimal row so the symbol shows in the UI."""
        row = {'symbol': symbol, 'label': SYMBOL_LABELS.get(symbol, symbol),
               'group': group, 'asset_type': _asset_type_for(symbol),
               'spot': round(spot, 4) if spot else 0.0,
               'strikes': [], 'gex': [], 'call_oi': [], 'put_oi': [],
               'total_gex_m': 0.0, 'gamma_wall': None, 'put_wall': None,
               'call_wall': None, 'flip_level': None, 'regime': None,
               'pcr': None, 'expiries': [], 'no_options': True}
        cache_set(ck, row)
        return row

    # ── Try Schwab option chain first (real gamma, live OI, live volume) ──────
    if not _is_futures:
        _sc_chain = _schwab_chain_raw(symbol)
        if _sc_chain:
            _underlying = _sc_chain.get('underlying', {})
            _spot = float(_underlying.get('last') or _underlying.get('mark') or 0)
            if _spot > 0:
                _result = _schwab_gex_from_chain(_sc_chain, symbol, group, _spot)
                if _result:
                    cache_set(ck, _result)
                    return _result

    try:
        # yfinance is not reliably thread-safe under concurrent option_chain calls.
        # We guard network-bound yfinance operations with the shared lock.
        with _yf_lock:
            ticker = yf.Ticker(symbol)

        # ── Spot price ─────────────────────────────────────────────────────────
        try:
            with _yf_lock:
                spot = float(ticker.fast_info.last_price)
        except Exception:
            spot = 0.0
        if not spot or spot <= 0:
            try:
                with _yf_lock:
                    h = ticker.history(period='5d')
                spot = float(h['Close'].iloc[-1]) if not h.empty else 0.0
            except Exception:
                spot = 0.0
        if not spot or spot <= 0:
            if not _is_futures:
                return _no_data_row(0.0)
            # For futures, spot may be unavailable via yfinance — let the proxy
            # section below supply both spot (scaled) and options data.

        # ── Options expiries — futures always go to proxy first ────────────────
        expiries = []
        if not _is_futures:
            try:
                with _yf_lock:
                    expiries = ticker.options
            except Exception:
                expiries = []

        if not expiries:
            # ── Try ETF proxy for futures symbols ──────────────────────────────
            proxy_sym = _FUTURES_PROXY_MAP.get(symbol)
            if proxy_sym:
                try:
                    with _yf_lock:
                        proxy_tk = yf.Ticker(proxy_sym)
                        proxy_expiries = proxy_tk.options
                    # yfinance can intermittently return [] without raising; retry once.
                    if not proxy_expiries:
                        try:
                            time.sleep(0.25)
                        except Exception:
                            pass
                        with _yf_lock:
                            proxy_tk = yf.Ticker(proxy_sym)
                            proxy_expiries = proxy_tk.options
                    if not proxy_expiries:
                        # Fallback: compute proxy GEX directly (non-futures path) and rescale.
                        # This avoids intermittent empty `Ticker.options` responses for proxies.
                        proxy_row = _gex_row(proxy_sym, 'ETFs', nocache=nocache)
                        if proxy_row and (not proxy_row.get('no_options')) and (proxy_row.get('strikes') or []):
                            pspot = float(proxy_row.get('spot') or 0.0)
                            if pspot > 0:
                                if not spot or spot <= 0:
                                    mult = FUTURES_MULTIPLIERS.get(symbol, 10)
                                    spot = pspot * mult
                                scale = spot / pspot if pspot else 1.0
                                def _sc(v):
                                    try:
                                        return round(float(v) * scale, 2)
                                    except Exception:
                                        return None
                                strikes_sc = [_sc(k) for k in proxy_row.get('strikes', [])]
                                gex_sc     = []
                                for v in proxy_row.get('gex', []):
                                    try:
                                        gex_sc.append(round(float(v) * scale, 3))
                                    except Exception:
                                        gex_sc.append(0.0)
                                row_out = {
                                    'symbol':       symbol,
                                    'label':        SYMBOL_LABELS.get(symbol, symbol),
                                    'group':        group,
                                    'asset_type':   _asset_type_for(symbol),
                                    'spot':         round(spot, 4),
                                    'strikes':      strikes_sc,
                                    'gex':          gex_sc,
                                    'call_oi':      proxy_row.get('call_oi', []),
                                    'put_oi':       proxy_row.get('put_oi', []),
                                    'total_gex_m':  round(float(proxy_row.get('total_gex_m') or 0.0) * scale, 2),
                                    'gamma_wall':   _sc(proxy_row.get('gamma_wall')) if proxy_row.get('gamma_wall') else None,
                                    'put_wall':     _sc(proxy_row.get('put_wall'))   if proxy_row.get('put_wall')   else None,
                                    'call_wall':    _sc(proxy_row.get('call_wall'))  if proxy_row.get('call_wall')  else None,
                                    'flip_level':   _sc(proxy_row.get('flip_level')) if proxy_row.get('flip_level') else None,
                                    'regime':       proxy_row.get('regime'),
                                    'pcr':          proxy_row.get('pcr'),
                                    'expiries':     proxy_row.get('expiries', []),
                                    'no_options':   False,
                                    'proxy_symbol': proxy_sym,
                                    'proxy_label':  SYMBOL_LABELS.get(proxy_sym, proxy_sym),
                                }
                                cache_set(ck, row_out)
                                return row_out
                    if proxy_expiries:
                        try:
                            with _yf_lock:
                                proxy_spot = float(proxy_tk.fast_info.last_price)
                        except Exception:
                            with _yf_lock:
                                ph = proxy_tk.history(period='2d')
                            proxy_spot = float(ph['Close'].iloc[-1]) if not ph.empty else 0.0
                        if proxy_spot > 0:
                            # If futures spot was unavailable, derive from proxy × known multiplier
                            if not spot or spot <= 0:
                                mult = FUTURES_MULTIPLIERS.get(symbol, 10)
                                spot = proxy_spot * mult
                            scale = spot / proxy_spot   # e.g., ES=F/SPY ≈ 10×
                            today  = datetime.now().date()
                            R      = 0.05
                            p_tgt  = []
                            for exp in proxy_expiries:
                                try:
                                    dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
                                    # Prefer weekly/monthly expiries for proxy chains (daily expiries can have sparse/NaN OI early in session)
                                    if 7 <= dte <= 60:
                                        p_tgt.append((exp, max(dte, 1)))
                                except Exception:
                                    continue
                                if len(p_tgt) >= 10:
                                    break
                            if not p_tgt and proxy_expiries:
                                p_tgt = [(proxy_expiries[0], 1)]
                            if p_tgt:
                                gex_by_k, coi_by_k, poi_by_k = {}, {}, {}
                                lo, hi = spot * 0.85, spot * 1.15
                                for exp, dte in p_tgt:
                                    T = max(dte / 365.0, 1 / 365.0)
                                    try:
                                        with _yf_lock:
                                            chain = proxy_tk.option_chain(exp)
                                    except Exception:
                                        continue
                                    calls, puts = chain.calls.copy(), chain.puts.copy()
                                    IV_MAX = 10.0
                                    for _, crow in calls.iterrows():
                                        K = float(crow['strike']) * scale
                                        if not (lo <= K <= hi):
                                            continue
                                        OI = _safe_int(crow.get('openInterest'))
                                        IV = float(crow.get('impliedVolatility') or 0)
                                        if OI <= 0 or IV <= 0 or IV > IV_MAX:
                                            continue
                                        g = _bs_gamma(spot, K, T, R, IV)
                                        gex_by_k[K] = gex_by_k.get(K, 0.0) + g * OI * 100 * spot
                                        coi_by_k[K] = coi_by_k.get(K, 0) + OI
                                    for _, prow in puts.iterrows():
                                        K = float(prow['strike']) * scale
                                        if not (lo <= K <= hi):
                                            continue
                                        OI = _safe_int(prow.get('openInterest'))
                                        IV = float(prow.get('impliedVolatility') or 0)
                                        if OI <= 0 or IV <= 0 or IV > IV_MAX:
                                            continue
                                        g = _bs_gamma(spot, K, T, R, IV)
                                        gex_by_k[K] = gex_by_k.get(K, 0.0) - g * OI * 100 * spot
                                        poi_by_k[K] = poi_by_k.get(K, 0) + OI
                                if gex_by_k:
                                    p_strikes = sorted(gex_by_k)
                                    p_gex     = [gex_by_k[k] for k in p_strikes]
                                    p_coi     = [coi_by_k.get(k, 0) for k in p_strikes]
                                    p_poi     = [poi_by_k.get(k, 0) for k in p_strikes]
                                    p_tot     = sum(p_gex)
                                    p_pos = [(k, v) for k, v in zip(p_strikes, p_gex) if v > 0]
                                    p_neg = [(k, v) for k, v in zip(p_strikes, p_gex) if v < 0]
                                    p_gwall = max(p_pos, key=lambda x: x[1])[0] if p_pos else None
                                    p_pwall = min(p_neg, key=lambda x: x[1])[0] if p_neg else None
                                    p_cwi   = max(range(len(p_strikes)), key=lambda i: p_coi[i]) if p_strikes else 0
                                    p_cwall = p_strikes[p_cwi] if p_strikes else None
                                    cum, p_flip = 0.0, None
                                    for k, g in zip(p_strikes, p_gex):
                                        prev = cum; cum += g
                                        if prev != 0 and prev * cum <= 0 and p_flip is None:
                                            p_flip = k
                                    if p_flip is None:
                                        p_flip = min(p_strikes, key=lambda k: abs(k - spot))
                                    p_pcr    = round(sum(p_poi) / max(sum(p_coi), 1), 2)
                                    p_regime = 'Long Gamma' if p_tot >= 0 else 'Short Gamma'
                                    row_out = {
                                        'symbol':       symbol,
                                        'label':        SYMBOL_LABELS.get(symbol, symbol),
                                        'group':        group,
                                        'asset_type':   _asset_type_for(symbol),
                                        'spot':         round(spot, 4),
                                        'strikes':      [round(k, 2) for k in p_strikes],
                                        'gex':          [round(v / 1e6, 3) for v in p_gex],
                                        'call_oi':      p_coi,
                                        'put_oi':       p_poi,
                                        'total_gex_m':  round(p_tot / 1e6, 2),
                                        'gamma_wall':   round(p_gwall, 2) if p_gwall else None,
                                        'put_wall':     round(p_pwall, 2) if p_pwall else None,
                                        'call_wall':    round(p_cwall, 2) if p_cwall else None,
                                        'flip_level':   round(p_flip,  2) if p_flip  else None,
                                        'regime':       p_regime,
                                        'pcr':          p_pcr,
                                        'expiries':     [e for e, _ in p_tgt],
                                        'no_options':   False,
                                        'proxy_symbol': proxy_sym,
                                        'proxy_label':  SYMBOL_LABELS.get(proxy_sym, proxy_sym),
                                    }
                                    cache_set(ck, row_out)
                                    return row_out
                except Exception as e:
                    # NOTE: Keep log lines ASCII-only (Windows console cp1252 can choke on Unicode)
                    print(f'[gex proxy] {symbol} -> {proxy_sym}: {e}')
            # Proxy failed or no proxy — return minimal no_options row
            return _no_data_row(spot)

        # Pick front 3 expiries ≤ 60 DTE
        today  = datetime.now().date()
        R      = 0.05
        target = []
        for exp in expiries:
            try:
                dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
                if 0 < dte <= 60:
                    target.append((exp, max(dte, 1)))
            except Exception:
                continue
            if len(target) >= 3:
                break
        if not target and expiries:
            target = [(expiries[0], 1)]
        if not target:
            return _no_data_row(spot)

        gex_by_k, coi_by_k, poi_by_k = {}, {}, {}

        for exp, dte in target:
            T = max(dte / 365.0, 1 / 365.0)
            try:
                with _yf_lock:
                    chain = ticker.option_chain(exp)
            except Exception:
                continue
            calls, puts = chain.calls.copy(), chain.puts.copy()

            # Limit to ±15% of spot
            lo, hi = spot * 0.85, spot * 1.15
            calls = calls[(calls['strike'] >= lo) & (calls['strike'] <= hi)]
            puts  = puts [(puts['strike']  >= lo) & (puts['strike']  <= hi)]

            # IV cap: 10 (1000%) to allow high-vol stocks; filter clearly broken values
            IV_MAX = 10.0
            for _, row in calls.iterrows():
                K  = float(row['strike'])
                OI = _safe_int(row.get('openInterest'))
                IV = float(row.get('impliedVolatility') or 0)
                if OI <= 0 or IV <= 0 or IV > IV_MAX:
                    continue
                g = _bs_gamma(spot, K, T, R, IV)
                gex_by_k[K] = gex_by_k.get(K, 0.0) + g * OI * 100 * spot   # positive
                coi_by_k[K] = coi_by_k.get(K, 0) + OI

            for _, row in puts.iterrows():
                K  = float(row['strike'])
                OI = _safe_int(row.get('openInterest'))
                IV = float(row.get('impliedVolatility') or 0)
                if OI <= 0 or IV <= 0 or IV > IV_MAX:
                    continue
                g = _bs_gamma(spot, K, T, R, IV)
                gex_by_k[K] = gex_by_k.get(K, 0.0) - g * OI * 100 * spot   # negative
                poi_by_k[K] = poi_by_k.get(K, 0) + OI

        if not gex_by_k:
            return _no_data_row(spot)

        strikes   = sorted(gex_by_k)
        gex_vals  = [gex_by_k[k] for k in strikes]
        call_oi   = [coi_by_k.get(k, 0) for k in strikes]
        put_oi    = [poi_by_k.get(k, 0) for k in strikes]
        total_gex = sum(gex_vals)

        pos_items = [(k, v) for k, v in zip(strikes, gex_vals) if v > 0]
        neg_items = [(k, v) for k, v in zip(strikes, gex_vals) if v < 0]
        gamma_wall = max(pos_items, key=lambda x: x[1])[0] if pos_items else None
        put_wall   = min(neg_items, key=lambda x: x[1])[0] if neg_items else None
        call_wall_i = max(range(len(strikes)), key=lambda i: call_oi[i]) if strikes else 0
        call_wall  = strikes[call_wall_i] if strikes else None

        # Gamma flip: cumulative GEX sign reversal closest to spot
        cum, flip_level = 0.0, None
        for k, g in zip(strikes, gex_vals):
            prev = cum
            cum += g
            if prev != 0 and prev * cum <= 0 and flip_level is None:
                flip_level = k
        if flip_level is None:
            flip_level = min(strikes, key=lambda k: abs(k - spot))

        # OI put/call ratio
        tot_call_oi = sum(call_oi)
        tot_put_oi  = sum(put_oi)
        pcr = round(tot_put_oi / max(tot_call_oi, 1), 2)

        regime = 'Long Gamma' if total_gex >= 0 else 'Short Gamma'

        row_out = {
            'symbol':      symbol,
            'label':       SYMBOL_LABELS.get(symbol, symbol),
            'group':       group,
            'asset_type':  _asset_type_for(symbol),
            'spot':        round(spot, 4),
            'strikes':     [round(k, 2) for k in strikes],
            'gex':         [round(v / 1e6, 3) for v in gex_vals],   # in $M
            'call_oi':     call_oi,
            'put_oi':      put_oi,
            'total_gex_m': round(total_gex / 1e6, 2),               # in $M
            'gamma_wall':  round(gamma_wall, 2) if gamma_wall else None,
            'put_wall':    round(put_wall,   2) if put_wall   else None,
            'call_wall':   round(call_wall,  2) if call_wall  else None,
            'flip_level':  round(flip_level, 2) if flip_level else None,
            'regime':      regime,
            'pcr':         pcr,
            'expiries':    [e for e, _ in target],
            'no_options':  False,
        }
        cache_set(ck, row_out)
        return row_out

    except Exception as e:
        print(f'[gex] {symbol}: {e}')
        return None   # genuine unexpected error — don't cache


_GEX_GROUPS = [
    ('ETFs',        SYMBOLS['sp500']),
    ('Indices',     ['SPX', '^GSPC', '^NDX', '^RUT', '^VIX', '^DJI']),
    ('Mag 7',       SYMBOLS['mag7']),
    ('Blue Chips',  SYMBOLS['bluechip']),
    ('Futures',     SYMBOLS['futures']),
]

# ── GEX wall shift history (call wall / put wall / gamma flip) ────────────────
_GEX_WALL_HISTORY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'gex_wall_history.json')
_gex_wall_history: dict[str, list] = {}
_gex_wall_shifts: list = []
_gex_wall_history_lock = threading.Lock()
_GEX_WALL_MAX_SNAPS = 400
_GEX_WALL_MAX_SHIFTS = 600
_GEX_WALL_RECORD_INTERVAL_SEC = 60


def _gex_wall_load() -> None:
    global _gex_wall_history, _gex_wall_shifts
    try:
        if os.path.exists(_GEX_WALL_HISTORY_FILE):
            with open(_GEX_WALL_HISTORY_FILE, 'r', encoding='utf-8') as f:
                data = _json.load(f)
            _gex_wall_history = data.get('history') or {}
            _gex_wall_shifts = data.get('shifts') or []
    except Exception as e:
        print(f'[gex-wall] load failed: {e}')


def _gex_wall_save() -> None:
    try:
        os.makedirs(os.path.dirname(_GEX_WALL_HISTORY_FILE), exist_ok=True)
        with open(_GEX_WALL_HISTORY_FILE, 'w', encoding='utf-8') as f:
            _json.dump(
                {'history': _gex_wall_history, 'shifts': _gex_wall_shifts[-_GEX_WALL_MAX_SHIFTS:]},
                f,
            )
    except Exception as e:
        print(f'[gex-wall] save failed: {e}')


def _gex_wall_threshold(spot: float) -> float:
    if not spot or spot <= 0:
        return 0.5
    return max(0.25, float(spot) * 0.002)


def _parse_iso_ts(ts_str: str | None):
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(str(ts_str).replace('Z', '+00:00'))
    except Exception:
        return None


def _gex_levels_changed(prev: dict, curr: dict, spot: float) -> bool:
    if not prev:
        return True
    thr = _gex_wall_threshold(spot)
    for key in ('gamma_wall', 'put_wall', 'flip_level'):
        pv, cv = prev.get(key), curr.get(key)
        if pv is None and cv is None:
            continue
        if pv is None or cv is None:
            return True
        if abs(float(cv) - float(pv)) >= thr:
            return True
    return False


def _gex_level_delta(prev_val, curr_val):
    if prev_val is None or curr_val is None:
        return None
    return round(float(curr_val) - float(prev_val), 4)


def _find_snapshot_at_or_before(hist: list, target_dt) -> dict | None:
    best = None
    for snap in hist:
        ts = _parse_iso_ts(snap.get('ts'))
        if ts and ts <= target_dt:
            best = snap
    return best


def _find_overnight_baseline(hist: list) -> dict | None:
    """Last snapshot before today's 9:30 ET RTH open (or prior close if pre-market)."""
    if not hist:
        return None
    try:
        et = ZoneInfo('America/New_York')
        now = datetime.now(et)
    except Exception:
        now = datetime.now().astimezone()
        et = now.tzinfo
    rth_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    if now < rth_open:
        prev_close = (now - timedelta(days=1)).replace(hour=16, minute=0, second=0, microsecond=0)
        return _find_snapshot_at_or_before(hist, prev_close) or hist[0]
    baseline = _find_snapshot_at_or_before(hist, rth_open)
    return baseline or hist[0]


def _find_session_open_baseline(hist: list) -> dict | None:
    if not hist:
        return None
    try:
        et = ZoneInfo('America/New_York')
        now = datetime.now(et)
    except Exception:
        return hist[0]
    rth_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    for snap in hist:
        ts = _parse_iso_ts(snap.get('ts'))
        if ts and ts >= rth_open:
            return snap
    return hist[0]


def _find_snapshot_hours_ago(hist: list, hours: float = 1.0) -> dict | None:
    if not hist:
        return None
    target = datetime.now().astimezone() - timedelta(hours=hours)
    return _find_snapshot_at_or_before(hist, target)


def _detect_gex_wall_shifts(sym: str, row: dict, prev: dict, curr: dict) -> None:
    spot = float(curr.get('spot') or 0)
    thr = _gex_wall_threshold(spot)
    label = row.get('label', sym)
    group = row.get('group', '')
    now_iso = curr['ts']
    for snap_key, level_name in (
        ('gamma_wall', 'Call Wall'),
        ('put_wall', 'Put Wall'),
        ('flip_level', 'Gamma Flip'),
    ):
        pv, cv = prev.get(snap_key), curr.get(snap_key)
        if pv is None or cv is None:
            continue
        delta = float(cv) - float(pv)
        if abs(delta) < thr:
            continue
        mag = 'large' if abs(delta) >= thr * 3 else ('medium' if abs(delta) >= thr * 1.5 else 'small')
        _gex_wall_shifts.append({
            'ts': now_iso,
            'symbol': sym,
            'label': label,
            'group': group,
            'level': level_name,
            'field': snap_key,
            'from': round(float(pv), 4),
            'to': round(float(cv), 4),
            'delta': round(delta, 4),
            'spot': round(spot, 4) if spot else None,
            'magnitude': mag,
        })
    if len(_gex_wall_shifts) > _GEX_WALL_MAX_SHIFTS:
        del _gex_wall_shifts[:-_GEX_WALL_MAX_SHIFTS]


def _record_gex_wall_snapshots(rows: list) -> None:
    with _gex_wall_history_lock:
        now = datetime.now().astimezone()
        now_iso = now.replace(microsecond=0).isoformat()
        for row in rows:
            if row.get('no_options'):
                continue
            sym = row.get('symbol')
            if not sym:
                continue
            snap = {
                'ts': now_iso,
                'gamma_wall': row.get('gamma_wall') or row.get('call_wall'),
                'put_wall': row.get('put_wall'),
                'flip_level': row.get('flip_level'),
                'spot': row.get('spot'),
                'regime': row.get('regime'),
            }
            hist = _gex_wall_history.setdefault(sym, [])
            prev = hist[-1] if hist else None
            should_record = False
            if not prev:
                should_record = True
            elif _gex_levels_changed(prev, snap, float(snap.get('spot') or 0)):
                should_record = True
            else:
                pts = _parse_iso_ts(prev.get('ts'))
                if pts and (now - pts).total_seconds() >= _GEX_WALL_RECORD_INTERVAL_SEC:
                    should_record = True
            if not should_record:
                continue
            if prev and _gex_levels_changed(prev, snap, float(snap.get('spot') or 0)):
                _detect_gex_wall_shifts(sym, row, prev, snap)
            hist.append(snap)
            if len(hist) > _GEX_WALL_MAX_SNAPS:
                _gex_wall_history[sym] = hist[-_GEX_WALL_MAX_SNAPS:]
        _gex_wall_save()


def _change_block(baseline: dict | None, curr: dict) -> dict:
    def one(field):
        bv = baseline.get(field) if baseline else None
        cv = curr.get(field)
        return {'prev': bv, 'now': cv, 'delta': _gex_level_delta(bv, cv)}
    return {
        'call_wall': one('gamma_wall'),
        'put_wall': one('put_wall'),
        'flip_level': one('flip_level'),
    }


def _last_shift_for_symbol(sym: str) -> dict | None:
    for shift in reversed(_gex_wall_shifts):
        if shift.get('symbol') == sym:
            return shift
    return None


def _build_gex_wall_tracker(rows: list, record: bool = True) -> dict:
    if record:
        _record_gex_wall_snapshots(rows)
    assets = []
    shift_count_today = 0
    try:
        et = ZoneInfo('America/New_York')
        today = datetime.now(et).date()
    except Exception:
        today = datetime.now().date()

    for shift in _gex_wall_shifts:
        ts = _parse_iso_ts(shift.get('ts'))
        if ts and ts.date() == today:
            shift_count_today += 1

    for row in rows:
        sym = row.get('symbol')
        hist = _gex_wall_history.get(sym, [])
        curr_snap = {
            'gamma_wall': row.get('gamma_wall') or row.get('call_wall'),
            'put_wall': row.get('put_wall'),
            'flip_level': row.get('flip_level'),
            'spot': row.get('spot'),
            'regime': row.get('regime'),
        }
        prev_snap = hist[-2] if len(hist) >= 2 else None
        overnight = _find_overnight_baseline(hist)
        session_open = _find_session_open_baseline(hist)
        hour_ago = _find_snapshot_hours_ago(hist, 1.0)
        last_shift = _last_shift_for_symbol(sym)
        assets.append({
            **row,
            'call_wall': curr_snap['gamma_wall'],
            'changes': {
                'since_last': _change_block(prev_snap, curr_snap),
                'overnight': _change_block(overnight, curr_snap),
                'session_open': _change_block(session_open, curr_snap),
                'one_hour': _change_block(hour_ago, curr_snap),
            },
            'history': hist[-200:],
            'history_full': hist,
            'last_shift': last_shift,
            'snapshot_count': len(hist),
        })

    recent_shifts = sorted(_gex_wall_shifts, key=lambda x: x.get('ts', ''), reverse=True)[:60]
    return {
        'assets': assets,
        'count': len(assets),
        'recent_shifts': recent_shifts,
        'shift_count_today': shift_count_today,
        'timestamp': iso_now(),
    }


def _fetch_gex_rows(nocache: bool = False) -> list:
    def _quick_spot(sym: str) -> float:
        try:
            with _yf_lock:
                return float(yf.Ticker(sym).fast_info.last_price or 0)
        except Exception:
            return 0.0

    def _scale_gex_row(row: dict, symbol: str, group: str, scale: float,
                       spot: float, proxy_sym: str | None = None,
                       candle_sym: str | None = None) -> dict:
        def sc(v):
            if v is None:
                return None
            try:
                return round(float(v) * scale, 2)
            except Exception:
                return None

        out = dict(row)
        out['symbol'] = symbol
        out['label'] = SYMBOL_LABELS.get(symbol, symbol)
        out['group'] = group
        out['asset_type'] = 'index'
        out['spot'] = round(spot, 4) if spot else out.get('spot')
        out['gamma_wall'] = sc(row.get('gamma_wall') or row.get('call_wall'))
        out['put_wall'] = sc(row.get('put_wall'))
        out['flip_level'] = sc(row.get('flip_level'))
        out['call_wall'] = out['gamma_wall']
        if row.get('strikes'):
            out['strikes'] = [sc(k) for k in row.get('strikes', [])]
        if row.get('gex'):
            out['gex'] = [round(float(v) * scale, 3) for v in row.get('gex', [])]
        if proxy_sym:
            out['proxy_symbol'] = proxy_sym
        if candle_sym:
            out['candle_symbol'] = candle_sym
        out['no_options'] = row.get('no_options', False)
        return out

    def _gex_index_row(symbol: str, group: str) -> dict | None:
        if symbol == '^VIX':
            row = _gex_row('^VIX', group, nocache=nocache)
            if row:
                row = dict(row)
                row['symbol'] = '^VIX'
                row['label'] = SYMBOL_LABELS.get('^VIX', '^VIX')
                row['group'] = group
                row['asset_type'] = 'index'
                row['candle_symbol'] = '^VIX'
            return row

        proxy_info = _INDEX_GEX_PROXY.get(symbol)
        if not proxy_info:
            return None
        proxy_sym, spot_sym, candle_sym = proxy_info
        proxy_row = _gex_row(proxy_sym, group, nocache=nocache)
        if not proxy_row:
            return None
        index_spot = _quick_spot(spot_sym)
        proxy_spot = float(proxy_row.get('spot') or 0)
        if index_spot <= 0:
            index_spot = proxy_spot
        scale = (index_spot / proxy_spot) if proxy_spot > 0 else 1.0
        return _scale_gex_row(proxy_row, symbol, group, scale, index_spot, proxy_sym, candle_sym)

    all_items = [(sym, grp) for grp, syms in _GEX_GROUPS for sym in syms]
    rows = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        def _fetch_one(sym: str, grp: str):
            if sym in _INDEX_GEX_PROXY or sym == '^VIX' or grp == 'Indices':
                return _gex_index_row(sym, grp)
            return _gex_row(sym, grp, nocache)

        futs = {pool.submit(_fetch_one, sym, grp): (sym, grp) for sym, grp in all_items}
        for fut in as_completed(futs):
            sym, grp = futs[fut]
            try:
                r = fut.result()
            except Exception as e:
                print(f'[gex-wall] {sym}: {e}')
                r = None
            if r:
                rows.append(r)
            else:
                rows.append({
                    'symbol': sym, 'label': SYMBOL_LABELS.get(sym, sym),
                    'group': grp, 'asset_type': _asset_type_for(sym),
                    'spot': 0.0, 'strikes': [], 'gex': [], 'call_oi': [], 'put_oi': [],
                    'total_gex_m': 0.0, 'gamma_wall': None, 'put_wall': None,
                    'call_wall': None, 'flip_level': None, 'regime': 'No Data',
                    'pcr': None, 'expiries': [], 'no_options': True,
                })
    grp_ord = {g: i for i, (g, _) in enumerate(_GEX_GROUPS)}
    rows.sort(key=lambda r: (grp_ord.get(r['group'], 99), r['symbol']))
    return rows


_gex_wall_load()


# ── Treasury yields (10Y / 2Y / curve vs SPX options) ─────────────────────────
_TREASURY_Y2_CANDIDATES = ('^US2Y', '^IRX')    # ^IRX = 13-week bill proxy if 2Y index unavailable
_TREASURY_Y5_CANDIDATES = ('^FVX',)            # 5-year yield index
_TREASURY_Y10_CANDIDATES = ('^TNX',)           # 10-year yield index
_TREASURY_Y30_CANDIDATES = ('^TYX',)           # 30-year yield index
_TREASURY_SPX_CANDIDATES = ('^GSPC', 'SPY')
_TREASURY_VIX_CANDIDATES = ('^VIX',)


def _df_to_candle_list(df: pd.DataFrame) -> list:
    out = []
    if df is None or df.empty:
        return out
    for ts, row in df.iterrows():
        try:
            out.append({
                'time': int(ts.timestamp()),
                'open': round(float(row['Open']), 4),
                'high': round(float(row['High']), 4),
                'low': round(float(row['Low']), 4),
                'close': round(float(row['Close']), 4),
                'volume': int(row.get('Volume', 0) or 0),
            })
        except Exception:
            pass
    return out


def _first_valid_candles(candidates: tuple, interval: str, period: str) -> tuple:
    for sym in candidates:
        df = get_candles(sym, interval=interval, period=period)
        if df is not None and not df.empty and len(df) >= 10:
            return sym, _df_to_candle_list(df)
    return candidates[0], []


def _yield_chg_bps(candles: list, lookback: int = 1) -> float | None:
    if len(candles) <= lookback:
        return None
    return round((candles[-1]['close'] - candles[-1 - lookback]['close']) * 100, 2)


def _merge_spread_series(y10: list, y2: list) -> list:
    y2_map = {c['time']: c['close'] for c in y2}
    spread = []
    for c in y10:
        y2v = y2_map.get(c['time'])
        if y2v is None:
            continue
        spread.append({'time': c['time'], 'value': round(c['close'] - y2v, 4)})
    return spread


def _classify_curve(d2_bps: float | None, d10_bps: float | None) -> dict:
    if d2_bps is None or d10_bps is None:
        return {'curve': 'unknown', 'label': 'Insufficient data', 'spx_bias': 'neutral', 'detail': ''}
    dspread = d10_bps - d2_bps
    if dspread > 3:
        if d10_bps >= 0:
            return {
                'curve': 'bear_steepener',
                'label': 'Bear Steepener',
                'spx_bias': 'risk_off',
                'detail': 'Long-end yields rising faster than the front end — typically pressures SPX / expands vol.',
            }
        return {
            'curve': 'bull_steepener',
            'label': 'Bull Steepener',
            'spx_bias': 'risk_on',
            'detail': 'Curve steepening with the long end lagging a front-end rally — often growth-friendly.',
        }
    if dspread < -3:
        if d2_bps >= 0:
            return {
                'curve': 'bear_flattener',
                'label': 'Bear Flattener',
                'spx_bias': 'risk_off',
                'detail': 'Front-end yields rising faster — Fed repricing / hawkish impulse; SPX vol risk elevated.',
            }
        return {
            'curve': 'bull_flattener',
            'label': 'Bull Flattener',
            'spx_bias': 'mixed',
            'detail': 'Front-end yields falling faster — rate-cut hopes; can be risk-on if growth holds.',
        }
    return {
        'curve': 'neutral',
        'label': 'Stable Curve',
        'spx_bias': 'neutral',
        'detail': '2s/10s shape little changed — yields may still move SPX directionally via level shocks.',
    }


def _shock_flags(d2_bps: float | None, d10_bps: float | None, threshold: float = 8.0) -> dict:
    shocks = []
    if d2_bps is not None and abs(d2_bps) >= threshold:
        shocks.append(f'2Y {"+" if d2_bps > 0 else ""}{d2_bps:.1f} bps')
    if d10_bps is not None and abs(d10_bps) >= threshold:
        shocks.append(f'10Y {"+" if d10_bps > 0 else ""}{d10_bps:.1f} bps')
    return {
        'active': len(shocks) > 0,
        'threshold_bps': threshold,
        'messages': shocks,
        'options_note': (
            'Sharp yield moves often coincide with IV expansion and directional breaks — '
            'short gamma / tight iron condors are vulnerable.'
            if shocks else ''
        ),
    }


@app.route('/api/treasury-yields')
def treasury_yields_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    interval = request.args.get('interval', '1d')
    period = request.args.get('period', '365d')
    ep_key = f'/api/treasury-yields:{interval}:{period}'
    if not nocache:
        cached = api_resp_get(ep_key)
        if cached:
            return jsonify(cached)

    y2_sym, y2 = _first_valid_candles(_TREASURY_Y2_CANDIDATES, interval, period)
    y5_sym, y5 = _first_valid_candles(_TREASURY_Y5_CANDIDATES, interval, period)
    y10_sym, y10 = _first_valid_candles(_TREASURY_Y10_CANDIDATES, interval, period)
    y30_sym, y30 = _first_valid_candles(_TREASURY_Y30_CANDIDATES, interval, period)
    y2_proxy = y2_sym != '^US2Y'
    spx_sym, spx = _first_valid_candles(_TREASURY_SPX_CANDIDATES, interval, period)
    vix_sym, vix = _first_valid_candles(_TREASURY_VIX_CANDIDATES, interval, period)
    spread = _merge_spread_series(y10, y2)

    d2 = _yield_chg_bps(y2)
    d5 = _yield_chg_bps(y5)
    d10 = _yield_chg_bps(y10)
    d30 = _yield_chg_bps(y30)
    d_spread = None
    if len(spread) >= 2:
        d_spread = round((spread[-1]['value'] - spread[-2]['value']) * 100, 2)

    spx_chg = None
    if len(spx) >= 2 and spx[-2]['close']:
        spx_chg = round((spx[-1]['close'] - spx[-2]['close']) / spx[-2]['close'] * 100, 2)
    vix_chg = None
    if len(vix) >= 2 and vix[-2]['close']:
        vix_chg = round((vix[-1]['close'] - vix[-2]['close']) / vix[-2]['close'] * 100, 2)

    curve = _classify_curve(d2, d10)
    shock = _shock_flags(d2, d10)

    payload = {
        'updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'interval': interval,
        'period': period,
        'symbols': {
            'y2': y2_sym,
            'y2_proxy': y2_proxy,
            'y5': y5_sym,
            'y10': y10_sym,
            'y30': y30_sym,
            'spx': spx_sym,
            'vix': vix_sym,
        },
        'snapshot': {
            'y2': y2[-1]['close'] if y2 else None,
            'y2_chg_bps': d2,
            'y5': y5[-1]['close'] if y5 else None,
            'y5_chg_bps': d5,
            'y10': y10[-1]['close'] if y10 else None,
            'y10_chg_bps': d10,
            'y30': y30[-1]['close'] if y30 else None,
            'y30_chg_bps': d30,
            'spread_2s10s': spread[-1]['value'] if spread else None,
            'spread_chg_bps': d_spread,
            'spx': spx[-1]['close'] if spx else None,
            'spx_chg_pct': spx_chg,
            'vix': vix[-1]['close'] if vix else None,
            'vix_chg_pct': vix_chg,
        },
        'regime': curve,
        'shock': shock,
        'series': {
            'y2': y2,
            'y5': y5,
            'y10': y10,
            'y30': y30,
            'spread': spread,
            'spx': spx,
            'vix': vix,
        },
        'calendar': [
            {'event': '10Y Treasury Auction', 'time_et': '1:00 PM ET', 'impact': 'high',
             'note': 'Long-end supply often moves ^TNX and SPX gamma in the hour after.'},
            {'event': '30Y Treasury Auction', 'time_et': '1:00 PM ET', 'impact': 'high',
             'note': 'Extends duration shock — watch 2s/10s and VIX together.'},
            {'event': 'CPI Release', 'time_et': '8:30 AM ET', 'impact': 'extreme',
             'note': '2Y moves first (Fed path); 8–10+ bps 2Y days frequently expand SPX IV.'},
            {'event': 'Non-Farm Payrolls (NFP)', 'time_et': '8:30 AM ET', 'impact': 'extreme',
             'note': 'Labor + wages repricing in 2Y; directional SPX breaks vs short gamma.'},
            {'event': 'FOMC Rate Decision', 'time_et': '2:00 PM ET', 'impact': 'extreme',
             'note': 'Statement + dots move 2Y instantly; press conference can steepen/flatten curve.'},
        ],
    }
    api_resp_set(ep_key, payload)
    return jsonify(payload)


@app.route('/api/gamma-exposure')
def gamma_exposure_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'gamma-exposure')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    rows = _fetch_gex_rows(nocache=nocache)
    result = {'assets': rows, 'count': len(rows), 'timestamp': iso_now()}
    _record_gex_wall_snapshots(rows)
    cache_set(ck, result)
    return jsonify(result)


@app.route('/api/gex-wall-tracker')
def gex_wall_tracker_endpoint():
    """Track call wall, put wall, and gamma flip shifts across all GEX assets."""
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'gex-wall-tracker')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    gex_ck = cache_key('all', 'gamma-exposure')
    gex_cached = None if nocache else cache_get(gex_ck)
    fresh = nocache or not (gex_cached and gex_cached.get('assets'))
    if fresh:
        rows = _fetch_gex_rows(nocache=nocache)
        cache_set(gex_ck, {'assets': rows, 'count': len(rows), 'timestamp': iso_now()})
    else:
        rows = gex_cached['assets']

    result = _build_gex_wall_tracker(rows, record=fresh)
    cache_set(ck, result)
    return jsonify(result)


# ── Options Strategy Advisor ─────────────────────────────────────────────────
def _bs_option_price(S, K, T, r, sigma, opt_type='call'):
    """Black-Scholes option price."""
    from scipy.stats import norm
    if T <= 0 or sigma <= 0:
        return max(0.0, S - K) if opt_type == 'call' else max(0.0, K - S)
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        if opt_type == 'call':
            return float(S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2))
        return float(K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1))
    except Exception:
        return 0.0


def _bs_delta(S, K, T, r, sigma, opt_type='call'):
    """Black-Scholes delta."""
    from scipy.stats import norm
    if T <= 0 or sigma <= 0:
        return 0.5
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        return float(norm.cdf(d1)) if opt_type == 'call' else float(norm.cdf(d1) - 1.0)
    except Exception:
        return 0.5 if opt_type == 'call' else -0.5


def _bs_vega(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Black-Scholes vega (per 1.00 vol, not per 1%)."""
    from scipy.stats import norm
    if T <= 1e-6 or sigma <= 1e-6 or S <= 0 or K <= 0:
        return 0.0
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        return float(S * norm.pdf(d1) * np.sqrt(T))
    except Exception:
        return 0.0


def _bs_theta(S: float, K: float, T: float, r: float, sigma: float, opt_type: str = 'call') -> float:
    """Black-Scholes theta (per year)."""
    from scipy.stats import norm
    if T <= 1e-6 or sigma <= 1e-6 or S <= 0 or K <= 0:
        return 0.0
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        term1 = -(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T))
        if opt_type == 'call':
            return float(term1 - r * K * np.exp(-r * T) * norm.cdf(d2))
        return float(term1 + r * K * np.exp(-r * T) * norm.cdf(-d2))
    except Exception:
        return 0.0


def _opt_strategy_row(symbol: str, group: str, nocache: bool = False) -> dict | None:
    """Select best option strategy per ML signal; return candles + full strategy details."""
    ck = cache_key(symbol, 'opt-strat')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return cached
    try:
        # ── Daily candles ──────────────────────────────────────────────────────
        with _yf_lock:
            raw = yf.download(symbol, period='90d', interval='1d',
                              progress=False, auto_adjust=True)
        if raw.empty or len(raw) < 20:
            return None
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        raw = raw[['Open', 'High', 'Low', 'Close', 'Volume']].copy()

        spot = float(raw['Close'].iloc[-1])
        if spot <= 0:
            return None

        # ── Quick direction score from technical features ───────────────────
        df = compute_features(raw.copy())
        if df.empty:
            return None
        lat = df.iloc[-1]
        rsi      = float(lat.get('rsi', 50) or 50)
        macd_h   = float(lat.get('macd_hist', 0) or 0)
        sma20_r  = float(lat.get('sma20_ratio', 1) or 1)
        bb_pos   = float(lat.get('bb_pos', 0.5) or 0.5)
        vol_reg  = int(lat.get('vol_regime', 1) or 1)
        atr_pct  = float(lat.get('atr_pct', 1) or 1)

        score  = sum([
            1 if rsi < 45 else (-1 if rsi > 60 else 0),
            1 if macd_h > 0 else -1,
            1 if sma20_r > 1.001 else (-1 if sma20_r < 0.999 else 0),
            1 if bb_pos > 0.55 else (-1 if bb_pos < 0.40 else 0),
        ])
        direction = 'BULLISH' if score >= 2 else 'BEARISH' if score <= -2 else 'NEUTRAL'

        # ── Build candle array ─────────────────────────────────────────────────
        candles = []
        for i in range(len(raw)):
            try:
                ts = int(pd.Timestamp(raw.index[i]).timestamp())
                r_ = raw.iloc[i]
                candles.append([ts, round(float(r_['Open']),4), round(float(r_['High']),4),
                                 round(float(r_['Low']),4), round(float(r_['Close']),4),
                                 int(r_.get('Volume', 0) or 0)])
            except Exception:
                pass

        # ── Options chain ──────────────────────────────────────────────────────
        ticker = yf.Ticker(symbol)
        try:
            expiries = ticker.options or []
        except Exception:
            expiries = []

        if not expiries:
            row = {'symbol': symbol, 'label': SYMBOL_LABELS.get(symbol, symbol),
                   'group': group, 'asset_type': _asset_type_for(symbol),
                   'spot': round(spot, 4), 'direction': direction,
                   'no_options': True, 'candles': candles}
            cache_set(ck, row)
            return row

        # Find expiry closest to 40 DTE (21–60 day window)
        today = datetime.now().date()
        R = 0.05
        best_exp, best_dte = None, None
        for exp in expiries:
            try:
                dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
                if 7 <= dte <= 60:
                    if best_exp is None or abs(dte - 40) < abs(best_dte - 40):
                        best_exp, best_dte = exp, dte
            except Exception:
                continue
        if not best_exp:
            for exp in expiries:
                try:
                    dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
                    if dte > 2:
                        best_exp, best_dte = exp, dte
                        break
                except Exception:
                    continue
        if not best_exp:
            return None

        T = max(best_dte / 365.0, 1 / 365.0)
        try:
            chain = ticker.option_chain(best_exp)
        except Exception:
            return None

        calls_df = chain.calls.copy()
        puts_df  = chain.puts.copy()
        lo, hi   = spot * 0.78, spot * 1.22
        calls_df = calls_df[(calls_df['strike'] >= lo) & (calls_df['strike'] <= hi)]
        puts_df  = puts_df [(puts_df['strike']  >= lo) & (puts_df['strike']  <= hi)]

        def nearest(df, tgt):
            if df.empty: return None
            return df.loc[(df['strike'] - tgt).abs().idxmin()]

        def mid(row, otype='call'):
            if row is None: return None
            bid = float(row.get('bid', 0) or 0)
            ask = float(row.get('ask', 0) or 0)
            if bid > 0 and ask > 0: return round((bid + ask) / 2, 2)
            lp = float(row.get('lastPrice', 0) or 0)
            if lp > 0: return round(lp, 2)
            iv = float(row.get('impliedVolatility', 0.3) or 0.3)
            if not (0.01 < iv < 5): iv = 0.3
            return round(_bs_option_price(spot, float(row['strike']), T, R, iv, otype), 2)

        def iv_pct(row):
            v = float(row.get('impliedVolatility', 0.3) or 0.3)
            return round((v if 0.01 < v < 5 else 0.3) * 100, 1)

        def delta(row, otype):
            iv = float(row.get('impliedVolatility', 0.3) or 0.3)
            if not (0.01 < iv < 5): iv = 0.3
            return round(_bs_delta(spot, float(row['strike']), T, R, iv, otype), 3)

        def leg(action, otype, row):
            p = mid(row, otype)
            k = float(row['strike'])
            return {
                'action': action, 'type': otype, 'strike': k,
                'expiry': best_exp, 'dte': best_dte,
                'premium': p or 0,
                'iv': iv_pct(row),
                'delta': delta(row, otype),
                'contract': str(row.get('contractSymbol', '') or ''),
            }

        strat = None

        # ── BULLISH strategies ─────────────────────────────────────────────────
        if direction == 'BULLISH':
            if vol_reg >= 1:
                # Bull Put Spread: sell OTM put, buy further OTM put (credit)
                sr = nearest(puts_df, spot * 0.96)
                br = nearest(puts_df, spot * 0.91)
                if sr is not None and br is not None:
                    sk, bk = float(sr['strike']), float(br['strike'])
                    sp = mid(sr, 'put') or 0
                    bp = mid(br, 'put') or 0
                    credit = round(sp - bp, 2)
                    width  = round(sk - bk, 2)
                    if credit > 0:
                        strat = {
                            'name': 'Bull Put Spread', 'type': 'bull_put_spread',
                            'direction': 'bullish',
                            'description': f'Sell the ${sk:.0f} put and buy the ${bk:.0f} put expiring {best_exp} ({best_dte} DTE) for a net credit of ${credit:.2f}/share (${credit*100:.0f}/contract). '
                                           f'Maximum profit of ${credit*100:.0f} is achieved if {symbol} closes above ${sk:.0f} at expiration. '
                                           f'Maximum loss of ${(width-credit)*100:.0f} occurs if {symbol} falls below ${bk:.0f}. '
                                           f'The breakeven price is ${sk-credit:.2f}. This strategy is ideal when moderately bullish and wanting to collect premium in a normal-to-high IV environment.',
                            'legs': [leg('SELL','put',sr), leg('BUY','put',br)],
                            'net_credit': credit, 'net_debit': None,
                            'max_profit': round(credit*100,2), 'max_loss': round((width-credit)*100,2),
                            'breakeven': [round(sk-credit,2)], 'spread_width': width,
                            'prob_profit': round(1-abs(delta(sr,'put')),2),
                        }
            if strat is None:
                # Long Call: buy ATM/slightly OTM call (debit)
                cr = nearest(calls_df, spot * 1.01)
                if cr is not None:
                    ck2, cp = float(cr['strike']), mid(cr, 'call')
                    if cp:
                        strat = {
                            'name': 'Long Call', 'type': 'long_call',
                            'direction': 'bullish',
                            'description': f'Buy the ${ck2:.0f} call expiring {best_exp} ({best_dte} DTE) for ${cp:.2f}/share (${cp*100:.0f}/contract). '
                                           f'Breakeven at expiration: ${ck2+cp:.2f}. '
                                           f'Maximum loss is limited to the ${cp*100:.0f} premium paid if {symbol} closes below ${ck2:.0f}. '
                                           f'Profit potential is unlimited as {symbol} rises above the breakeven. Best used when strongly bullish with low IV — options are cheaper to buy.',
                            'legs': [leg('BUY','call',cr)],
                            'net_credit': None, 'net_debit': cp,
                            'max_profit': None, 'max_loss': round(cp*100,2),
                            'breakeven': [round(ck2+cp,2)], 'spread_width': None,
                            'prob_profit': delta(cr,'call'),
                        }

        # ── BEARISH strategies ─────────────────────────────────────────────────
        elif direction == 'BEARISH':
            if vol_reg >= 1:
                # Bear Call Spread: sell OTM call, buy further OTM call (credit)
                sr = nearest(calls_df, spot * 1.04)
                br = nearest(calls_df, spot * 1.09)
                if sr is not None and br is not None:
                    sk, bk = float(sr['strike']), float(br['strike'])
                    sp = mid(sr, 'call') or 0
                    bp = mid(br, 'call') or 0
                    credit = round(sp - bp, 2)
                    width  = round(bk - sk, 2)
                    if credit > 0:
                        strat = {
                            'name': 'Bear Call Spread', 'type': 'bear_call_spread',
                            'direction': 'bearish',
                            'description': f'Sell the ${sk:.0f} call and buy the ${bk:.0f} call expiring {best_exp} ({best_dte} DTE) for a net credit of ${credit:.2f}/share (${credit*100:.0f}/contract). '
                                           f'Maximum profit of ${credit*100:.0f} is achieved if {symbol} stays below ${sk:.0f} at expiration. '
                                           f'Maximum loss of ${(width-credit)*100:.0f} occurs if {symbol} rallies above ${bk:.0f}. '
                                           f'The breakeven price is ${sk+credit:.2f}. This strategy profits from bearish movement or time decay while capping risk.',
                            'legs': [leg('SELL','call',sr), leg('BUY','call',br)],
                            'net_credit': credit, 'net_debit': None,
                            'max_profit': round(credit*100,2), 'max_loss': round((width-credit)*100,2),
                            'breakeven': [round(sk+credit,2)], 'spread_width': width,
                            'prob_profit': round(1-delta(sr,'call'),2),
                        }
            if strat is None:
                # Long Put: buy ATM/slightly OTM put (debit)
                pr = nearest(puts_df, spot * 0.99)
                if pr is not None:
                    pk, pp = float(pr['strike']), mid(pr, 'put')
                    if pp:
                        strat = {
                            'name': 'Long Put', 'type': 'long_put',
                            'direction': 'bearish',
                            'description': f'Buy the ${pk:.0f} put expiring {best_exp} ({best_dte} DTE) for ${pp:.2f}/share (${pp*100:.0f}/contract). '
                                           f'Breakeven at expiration: ${pk-pp:.2f}. '
                                           f'Maximum loss is limited to the ${pp*100:.0f} premium paid if {symbol} stays above ${pk:.0f}. '
                                           f'Maximum profit approaches ${pk*100:.0f}/contract if {symbol} falls to zero. Best used when strongly bearish — provides full downside leverage.',
                            'legs': [leg('BUY','put',pr)],
                            'net_credit': None, 'net_debit': pp,
                            'max_profit': round((pk-pp)*100,2), 'max_loss': round(pp*100,2),
                            'breakeven': [round(pk-pp,2)], 'spread_width': None,
                            'prob_profit': round(abs(delta(pr,'put')),2),
                        }

        # ── NEUTRAL strategies (Iron Condor) ───────────────────────────────────
        else:
            sc_r = nearest(calls_df, spot * 1.04)
            bc_r = nearest(calls_df, spot * 1.09)
            sp_r = nearest(puts_df,  spot * 0.96)
            bp_r = nearest(puts_df,  spot * 0.91)
            if all(r is not None for r in [sc_r, bc_r, sp_r, bp_r]):
                sk_c = float(sc_r['strike']); bk_c = float(bc_r['strike'])
                sk_p = float(sp_r['strike']); bk_p = float(bp_r['strike'])
                sp_c = mid(sc_r,'call') or 0; bp_c = mid(bc_r,'call') or 0
                sp_p = mid(sp_r,'put')  or 0; bp_p = mid(bp_r,'put')  or 0
                credit = round((sp_c - bp_c) + (sp_p - bp_p), 2)
                mw = max(round(bk_c-sk_c,2), round(sk_p-bk_p,2))
                if credit > 0:
                    strat = {
                        'name': 'Iron Condor', 'type': 'iron_condor',
                        'direction': 'neutral',
                        'description': f'Sell the ${sk_c:.0f}/{bk_c:.0f} call spread and the ${sk_p:.0f}/{bk_p:.0f} put spread expiring {best_exp} ({best_dte} DTE) for a net credit of ${credit:.2f}/share (${credit*100:.0f}/contract). '
                                       f'Maximum profit of ${credit*100:.0f} is collected if {symbol} remains between ${sk_p:.0f} and ${sk_c:.0f} at expiration. '
                                       f'Maximum loss of ${(mw-credit)*100:.0f} if price breaches either wing. '
                                       f'Upside breakeven: ${sk_c+credit:.2f}. Downside breakeven: ${sk_p-credit:.2f}. Best in a rangebound, high-IV environment where theta decay works in your favor.',
                        'legs': [leg('SELL','call',sc_r), leg('BUY','call',bc_r),
                                 leg('SELL','put',sp_r),  leg('BUY','put',bp_r)],
                        'net_credit': credit, 'net_debit': None,
                        'max_profit': round(credit*100,2), 'max_loss': round((mw-credit)*100,2),
                        'breakeven': [round(sk_c+credit,2), round(sk_p-credit,2)],
                        'spread_width': mw, 'prob_profit': 0.55,
                    }

        if strat is None:
            return None

        row_out = {
            'symbol': symbol, 'label': SYMBOL_LABELS.get(symbol, symbol),
            'group': group, 'asset_type': _asset_type_for(symbol),
            'spot': round(spot, 4), 'direction': direction,
            'vol_regime': vol_reg, 'atr_pct': round(atr_pct, 3),
            'strategy': strat, 'candles': candles, 'no_options': False,
        }
        cache_set(ck, row_out)
        return row_out

    except Exception as e:
        print(f'[opt-strat] {symbol}: {e}')
        return None


_OPT_STRAT_GROUPS = [
    ('ETFs',        SYMBOLS['sp500']),
    ('Mag 7',       SYMBOLS['mag7']),
    ('Blue Chips',  SYMBOLS['bluechip']),
    ('Futures',     SYMBOLS['futures']),
]


@app.route('/api/options-strategy')
def options_strategy_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'opt-strategy')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    items = [(sym, grp) for grp, syms in _OPT_STRAT_GROUPS for sym in syms]
    rows = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(_opt_strategy_row, sym, grp, nocache): sym for sym, grp in items}
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                rows.append(r)

    go = {g: i for i, (g, _) in enumerate(_OPT_STRAT_GROUPS)}
    rows.sort(key=lambda r: (go.get(r['group'], 99), r['symbol']))

    result = {'assets': rows, 'count': len(rows), 'timestamp': iso_now()}
    cache_set(ck, result)
    return jsonify(result)


# ── Option Flows ──────────────────────────────────────────────────────────────
def _compute_max_pain(strike_data: dict, skeys: list) -> float:
    """Max pain: strike where total option-holder dollar loss at expiry is minimized."""
    if not skeys:
        return 0.0
    min_loss, mp = float('inf'), skeys[0]
    for exp_k in skeys:
        loss = sum(
            strike_data[k]['call_oi'] * max(0.0, exp_k - k) * 100 +
            strike_data[k]['put_oi']  * max(0.0, k - exp_k) * 100
            for k in skeys
        )
        if loss < min_loss:
            min_loss = loss
            mp = exp_k
    return mp


def _flow_row(symbol: str, group: str, nocache: bool = False) -> dict | None:
    """Aggregate options flow (0DTE + weekly) per symbol: volume, premium, unusual activity."""
    ck = cache_key(symbol, 'opt-flow')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return cached
    # ── Try Schwab option chain first (real volume, premium, OI) ─────────────
    _sc_chain2 = _schwab_chain_raw(symbol)
    if _sc_chain2:
        _underlying2 = _sc_chain2.get('underlying', {})
        _spot2 = float(_underlying2.get('last') or _underlying2.get('mark') or 0)
        if _spot2 > 0:
            _result2 = _schwab_flows_from_chain(_sc_chain2, symbol, group, _spot2)
            if _result2:
                cache_set(ck, _result2)
                return _result2

    try:
        # ── Spot price ─────────────────────────────────────────────────────────
        ticker = yf.Ticker(symbol)  # object creation only — no lock needed
        try:
            spot = float(ticker.fast_info.last_price or 0)
        except Exception:
            spot = 0.0
        if spot <= 0:
            try:
                spot = float(ticker.info.get('regularMarketPrice', 0) or 0)
            except Exception:
                spot = 0.0
        if spot <= 0:
            return None

        # ── Expiry selection ────────────────────────────────────────────────────
        try:
            expiries = ticker.options or []
        except Exception:
            expiries = []
        if not expiries:
            row = {'symbol': symbol, 'label': SYMBOL_LABELS.get(symbol, symbol),
                   'group': group, 'asset_type': _asset_type_for(symbol),
                   'spot': round(spot, 4), 'no_options': True}
            cache_set(ck, row)
            return row

        today = datetime.now().date()
        flow_expiries, has_0dte = [], False
        for exp in expiries:
            try:
                dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
                if dte == 0:
                    has_0dte = True
                    flow_expiries.append((exp, 0))
                elif 1 <= dte <= 7:
                    flow_expiries.append((exp, dte))
            except Exception:
                continue
        if not flow_expiries:
            for exp in expiries[:2]:
                try:
                    dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
                    flow_expiries.append((exp, max(dte, 0)))
                except Exception:
                    continue

        if not flow_expiries:
            row = {'symbol': symbol, 'label': SYMBOL_LABELS.get(symbol, symbol),
                   'group': group, 'asset_type': _asset_type_for(symbol),
                   'spot': round(spot, 4), 'no_options': True}
            cache_set(ck, row)
            return row

        # ── Aggregate per-strike flow ───────────────────────────────────────────
        lo, hi = spot * 0.85, spot * 1.15
        strike_data: dict[float, dict] = {}
        total_call_vol = total_put_vol = 0.0
        total_call_prem = total_put_prem = 0.0
        dte0_call_vol = dte0_put_vol = 0.0
        dte0_call_prem = dte0_put_prem = 0.0
        unusual: list[dict] = []

        for exp, dte in flow_expiries:
            try:
                chain = ticker.option_chain(exp)
            except Exception:
                continue
            calls = chain.calls.copy()
            puts  = chain.puts.copy()
            calls = calls[(calls['strike'] >= lo) & (calls['strike'] <= hi)]
            puts  = puts [(puts['strike']  >= lo) & (puts['strike']  <= hi)]

            def _mid(row_):
                b = float(row_.get('bid', 0) or 0)
                a = float(row_.get('ask', 0) or 0)
                if b > 0 and a > 0: return (b + a) / 2
                return float(row_.get('lastPrice', 0) or 0)

            for _, r in calls.iterrows():
                k   = round(float(r['strike']), 2)
                _v  = r.get('volume', 0); vol = 0.0 if (_v != _v or _v is None) else float(_v or 0)
                _o  = r.get('openInterest', 0); oi = 0.0 if (_o != _o or _o is None) else float(_o or 0)
                prm = vol * _mid(r) * 100
                sd  = strike_data.setdefault(k, dict(call_vol=0, put_vol=0, call_prem=0,
                                                      put_prem=0, call_oi=0, put_oi=0))
                sd['call_vol'] += vol; sd['call_prem'] += prm; sd['call_oi'] += oi
                total_call_vol += vol; total_call_prem += prm
                if dte == 0: dte0_call_vol += vol; dte0_call_prem += prm
                if oi > 0 and vol > 0 and vol / oi > 3 and vol > 500:
                    unusual.append({'strike': k, 'type': 'CALL', 'vol': int(vol), 'oi': int(oi),
                                    'ratio': round(vol / oi, 1),
                                    'premium_k': round(prm / 1000, 1), 'expiry': exp, 'dte': dte})

            for _, r in puts.iterrows():
                k   = round(float(r['strike']), 2)
                _v  = r.get('volume', 0); vol = 0.0 if (_v != _v or _v is None) else float(_v or 0)
                _o  = r.get('openInterest', 0); oi = 0.0 if (_o != _o or _o is None) else float(_o or 0)
                prm = vol * _mid(r) * 100
                sd  = strike_data.setdefault(k, dict(call_vol=0, put_vol=0, call_prem=0,
                                                      put_prem=0, call_oi=0, put_oi=0))
                sd['put_vol'] += vol; sd['put_prem'] += prm; sd['put_oi'] += oi
                total_put_vol += vol; total_put_prem += prm
                if dte == 0: dte0_put_vol += vol; dte0_put_prem += prm
                if oi > 0 and vol > 0 and vol / oi > 3 and vol > 500:
                    unusual.append({'strike': k, 'type': 'PUT', 'vol': int(vol), 'oi': int(oi),
                                    'ratio': round(vol / oi, 1),
                                    'premium_k': round(prm / 1000, 1), 'expiry': exp, 'dte': dte})

        if not strike_data:
            return None

        # ── Build sorted arrays ─────────────────────────────────────────────────
        skeys = sorted(strike_data.keys())
        call_vol_a   = [int(strike_data[k]['call_vol'])              for k in skeys]
        put_vol_a    = [int(strike_data[k]['put_vol'])               for k in skeys]
        call_prem_k  = [round(strike_data[k]['call_prem'] / 1000, 2) for k in skeys]
        put_prem_k   = [round(strike_data[k]['put_prem']  / 1000, 2) for k in skeys]
        net_prem_k   = [round((strike_data[k]['call_prem'] - strike_data[k]['put_prem']) / 1000, 2)
                        for k in skeys]

        # ── Sentiment ───────────────────────────────────────────────────────────
        pcr_vol  = round(total_put_vol  / (total_call_vol  + 1e-9), 3)
        pcr_prem = round(total_put_prem / (total_call_prem + 1e-9), 3)
        if   total_call_prem > total_put_prem * 1.25: sentiment = 'BULLISH'
        elif total_put_prem  > total_call_prem * 1.25: sentiment = 'BEARISH'
        else:                                           sentiment = 'NEUTRAL'

        # ── Top strikes ─────────────────────────────────────────────────────────
        top_c = max(strike_data, key=lambda k: strike_data[k]['call_vol'], default=None)
        top_p = max(strike_data, key=lambda k: strike_data[k]['put_vol'],  default=None)

        # ── Delta hedge pressure (dealer buy/sell per strike) ────────────────────
        avg_dte = (sum(d for _, d in flow_expiries) / len(flow_expiries)) if flow_expiries else 7
        avg_T   = max(avg_dte, 1) / 365.0
        sigma   = 0.25  # 25% IV proxy (reasonable for most equities)
        dealer_delta_k = []
        for k in skeys:
            cd  = _bs_delta(spot, k, avg_T, 0.0, sigma, 'call')     # call delta 0→1
            pd  = abs(_bs_delta(spot, k, avg_T, 0.0, sigma, 'put')) # put delta abs 0→1
            # Dealers are assumed short the options (they sold to the market)
            # Short call → must BUY cd shares per contract to stay delta-neutral (bullish pressure)
            # Short put  → must SELL pd shares per contract to stay delta-neutral (bearish pressure)
            buy_k  = strike_data[k]['call_vol'] * cd * 100 * spot / 1000  # $K to buy
            sell_k = strike_data[k]['put_vol']  * pd * 100 * spot / 1000  # $K to sell
            dealer_delta_k.append(round(buy_k - sell_k, 2))
        net_dealer_delta_m = round(sum(dealer_delta_k) / 1000, 3)  # net $M

        # ── Max pain (expiry gravity) ────────────────────────────────────────────
        max_pain_strike = _compute_max_pain(strike_data, skeys)

        # ── Pin risk (highest total OI strike) ──────────────────────────────────
        total_oi_by_k   = {k: strike_data[k]['call_oi'] + strike_data[k]['put_oi'] for k in skeys}
        pin_risk_strike = max(skeys, key=lambda k: total_oi_by_k[k]) if skeys else 0.0

        # ── Squeeze / cascade potential ──────────────────────────────────────────
        above = [k for k in skeys if k > spot * 1.005]
        below = [k for k in skeys if k < spot * 0.995]
        squeeze_potential = False; squeeze_strike = 0.0
        crash_potential   = False; crash_strike   = 0.0
        if above:
            scall = max(above, key=lambda k: strike_data[k]['call_oi'])
            if strike_data[scall]['call_oi'] > 2000:
                squeeze_potential = True; squeeze_strike = scall
        if below:
            sput = max(below, key=lambda k: strike_data[k]['put_oi'])
            if strike_data[sput]['put_oi'] > 2000:
                crash_potential = True; crash_strike = sput

        # ── Description ─────────────────────────────────────────────────────────
        cm, pm = total_call_prem / 1e6, total_put_prem / 1e6
        parts = []
        if sentiment == 'BULLISH':
            parts.append(f'Call premium dominates: ${cm:.2f}M calls vs ${pm:.2f}M puts (P/C {pcr_prem:.2f}).')
        elif sentiment == 'BEARISH':
            parts.append(f'Put premium dominates: ${pm:.2f}M puts vs ${cm:.2f}M calls (P/C {pcr_prem:.2f}).')
        else:
            parts.append(f'Mixed flow: ${cm:.2f}M calls vs ${pm:.2f}M puts (P/C {pcr_prem:.2f}).')
        if top_c: parts.append(f'Highest call volume at ${top_c:.0f}.')
        if top_p: parts.append(f'Highest put volume at ${top_p:.0f}.')
        if has_0dte:
            parts.append(f'0DTE: {int(dte0_call_vol):,} calls / {int(dte0_put_vol):,} puts.')
        if unusual:
            top_u = sorted(unusual, key=lambda x: x['ratio'], reverse=True)[:3]
            parts.append('Unusual: ' + ', '.join(f"${u['strike']:.0f} {u['type']} {u['ratio']}× OI" for u in top_u) + '.')
        # Delta hedging narrative
        dir_word   = 'BUY' if net_dealer_delta_m >= 0 else 'SELL'
        press_word = 'upward' if net_dealer_delta_m >= 0 else 'downward'
        parts.append(f'Dealer delta hedging requires ~${abs(net_dealer_delta_m):.2f}M in {dir_word} orders, creating {press_word} price pressure.')
        if max_pain_strike > 0 and spot > 0:
            mp_dist = (max_pain_strike - spot) / spot * 100
            mp_dir  = 'above' if mp_dist > 0 else 'below'
            parts.append(f'Max pain at ${max_pain_strike:.0f} ({abs(mp_dist):.1f}% {mp_dir} spot) — options market gravity toward this level at expiry.')
        if squeeze_potential:
            parts.append(f'Gamma squeeze risk: large call OI at ${squeeze_strike:.0f} could force dealers to aggressively buy if price advances.')
        if crash_potential:
            parts.append(f'Put cascade risk: large put OI at ${crash_strike:.0f} could trigger forced selling if price declines.')

        row_out = {
            'symbol':             symbol,
            'label':              SYMBOL_LABELS.get(symbol, symbol),
            'group':              group,
            'asset_type':         _asset_type_for(symbol),
            'spot':               round(spot, 4),
            'no_options':         False,
            'has_0dte':           has_0dte,
            'flow_expiries':      [[e, d] for e, d in flow_expiries],
            'strikes':            [round(k, 2) for k in skeys],
            'call_vol':           call_vol_a,
            'put_vol':            put_vol_a,
            'call_prem_k':        call_prem_k,
            'put_prem_k':         put_prem_k,
            'net_prem_k':         net_prem_k,
            'dealer_delta_k':     dealer_delta_k,
            'net_dealer_delta_m': net_dealer_delta_m,
            'max_pain_strike':    round(max_pain_strike, 2),
            'pin_risk_strike':    round(pin_risk_strike, 2),
            'squeeze_potential':  squeeze_potential,
            'squeeze_strike':     round(squeeze_strike, 2),
            'crash_potential':    crash_potential,
            'crash_strike':       round(crash_strike, 2),
            'total_call_vol':     int(total_call_vol),
            'total_put_vol':      int(total_put_vol),
            'total_call_prem_m':  round(total_call_prem / 1e6, 3),
            'total_put_prem_m':   round(total_put_prem  / 1e6, 3),
            'pcr_vol':            pcr_vol,
            'pcr_prem':           pcr_prem,
            'flow_sentiment':     sentiment,
            'dte0_call_vol':      int(dte0_call_vol),
            'dte0_put_vol':       int(dte0_put_vol),
            'dte0_call_prem_k':   round(dte0_call_prem / 1000, 2),
            'dte0_put_prem_k':    round(dte0_put_prem  / 1000, 2),
            'unusual':            sorted(unusual, key=lambda x: x['ratio'], reverse=True)[:10],
            'description':        ' '.join(parts),
        }
        cache_set(ck, row_out)
        return row_out

    except Exception as e:
        print(f'[opt-flow] {symbol}: {e}')
        return None


_FLOW_GROUPS = [
    ('ETFs',        SYMBOLS['sp500']),
    ('Mag 7',       SYMBOLS['mag7']),
    ('Blue Chips',  SYMBOLS['bluechip']),
    ('Futures',     SYMBOLS['futures']),
]



_MOST_ACTIVE_ETFS = set(SYMBOLS['sp500'])
_MOST_ACTIVE_STOCKS = set(SYMBOLS['mag7'] + SYMBOLS['bluechip'])
_MOST_ACTIVE_EXTRA = ['AMD', 'INTC', 'PLTR', 'SOFI', 'NOK', 'RGTI', 'COIN', 'MARA', 'F', 'BAC']
_MOST_ACTIVE_ALL_SYMS = list(dict.fromkeys(
    list(SYMBOLS['sp500']) + list(SYMBOLS['mag7']) + list(SYMBOLS['bluechip']) + _MOST_ACTIVE_EXTRA
))


def _short_company_name(symbol: str) -> str:
    lb = SYMBOL_LABELS.get(symbol, symbol)
    if '(' in lb:
        return lb.split('(')[0].strip()
    return lb


def _most_active_asset_class(symbol: str) -> str:
    if symbol in _MOST_ACTIVE_ETFS:
        return 'etf'
    if symbol.endswith('=F'):
        return 'futures'
    if symbol.startswith('^'):
        return 'index'
    return 'stock'


def _rel_option_vol_pct(symbol: str, total_vol: int) -> float | None:
    """Option volume vs typical daily baseline (yfinance share ADV proxy)."""
    if total_vol <= 0:
        return None
    try:
        with _yf_lock:
            info = yf.Ticker(symbol).info or {}
        avg = float(
            info.get('averageVolume')
            or info.get('averageDailyVolume10Day')
            or info.get('averageDailyVolume3Month')
            or 0
        )
        if avg <= 0:
            return None
        baseline = max(avg * 0.006, 400)
        return round(total_vol / baseline * 100, 2)
    except Exception:
        return None


def _most_active_from_flow(r: dict) -> dict | None:
    if not r or r.get('no_options'):
        return None
    cv = int(r.get('total_call_vol') or 0)
    pv = int(r.get('total_put_vol') or 0)
    tv = cv + pv
    if tv <= 0:
        return None
    sym = r.get('symbol', '')
    return {
        'symbol': sym,
        'name': _short_company_name(sym),
        'asset_class': _most_active_asset_class(sym),
        'option_volume': tv,
        'call_volume': cv,
        'put_volume': pv,
        'put_call_ratio': round(pv / max(cv, 1), 2),
        'avg_daily_volume_pct': _rel_option_vol_pct(sym, tv),
        'flow_sentiment': r.get('flow_sentiment'),
        'spot': r.get('spot'),
    }


def _build_most_active_rows(nocache: bool = False) -> list:
    rows = []
    flows = None
    if not nocache:
        try:
            flows = cache_get(cache_key('all', 'opt-flows'))
        except Exception:
            flows = None
    if flows and flows.get('assets'):
        for r in flows['assets']:
            row = _most_active_from_flow(r)
            if row:
                rows.append(row)
    sym_set = {x['symbol'] for x in rows}
    missing = [s for s in _MOST_ACTIVE_ALL_SYMS if s not in sym_set]
    if missing:
        grp_map = {}
        for sym in missing:
            if sym in _MOST_ACTIVE_ETFS:
                grp_map[sym] = 'ETFs'
            elif sym in SYMBOLS.get('mag7', []):
                grp_map[sym] = 'Mag 7'
            else:
                grp_map[sym] = 'Stocks'
        with ThreadPoolExecutor(max_workers=4) as pool:
            futs = {pool.submit(_flow_row, sym, grp_map.get(sym, 'Stocks'), nocache): sym for sym in missing}
            for fut in as_completed(futs):
                try:
                    r = fut.result()
                    row = _most_active_from_flow(r) if r else None
                    if row:
                        rows.append(row)
                except Exception:
                    pass
    rows.sort(key=lambda x: x['option_volume'], reverse=True)
    return rows






def _flow_rank_symbols(max_n: int = 14) -> list[str]:
    """Top symbols from cached option-flows + high-vol names."""
    sym_list: list[str] = list(_FLOW_TRADE_EXTRA)
    try:
        flows = cache_get(cache_key('all', 'opt-flows'))
        if flows and flows.get('assets'):
            ranked = sorted(
                flows['assets'],
                key=lambda x: int(x.get('total_call_vol') or 0) + int(x.get('total_put_vol') or 0),
                reverse=True,
            )
            for r in ranked:
                sym = r.get('symbol')
                if sym and sym not in sym_list:
                    sym_list.append(sym)
                if len(sym_list) >= max_n:
                    break
    except Exception:
        pass
    return sym_list[:max_n]


def _pick_scan_expiries(expiries: list, max_n: int = 6) -> list[str]:
    today = datetime.now().date()
    target: list[tuple[str, int]] = []
    for exp in expiries or []:
        try:
            dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
        except Exception:
            continue
        if 0 <= dte <= 120:
            target.append((exp, dte))
    target.sort(key=lambda x: x[1])
    if len(target) <= max_n:
        return [e for e, _ in target]
    near = [t for t in target if t[1] <= 14]
    rest = [t for t in target if t[1] > 14]
    picked = (near[:4] + rest[-2:])[:max_n]
    return [e for e, _ in picked]


def _flow_trades_from_flow_row(r: dict) -> list:
    """Fast flow rows from cached /api/option-flows asset (no yfinance)."""
    if not r or r.get('no_options'):
        return []
    symbol = r.get('symbol', '')
    asset_class = _most_active_asset_class(symbol)
    spot = r.get('spot')
    exp_default = ''
    fex = r.get('flow_expiries') or []
    if fex:
        fe = fex[0]
        exp_default = fe[0] if isinstance(fe, (list, tuple)) else str(fe)
    session_ts = _traded_at_et()
    trades: list[dict] = []

    for u in r.get('unusual') or []:
        prem_k = float(u.get('premium_k') or 0)
        tv = round(prem_k * 1000.0, 2)
        if tv < 10_000:
            continue
        side = str(u.get('type') or 'CALL').upper()
        strike = float(u.get('strike') or 0)
        exp = str(u.get('expiry') or exp_default)
        vol = int(u.get('vol') or 0)
        oi = int(u.get('oi') or 0)
        avg = round(tv / max(vol * 100, 1), 4) if vol else 0
        trades.append({
            'symbol': symbol,
            'contract': _format_contract_desc(symbol, exp, strike, side),
            'expiry': exp,
            'strike': strike,
            'side': side,
            'type': _flow_trade_type(tv),
            'sentiment': _flow_trade_sentiment(side, vol, oi),
            'total_value': tv,
            'total_size': vol,
            'avg_price': avg,
            'underlying_price': round(spot, 2) if spot else None,
            'traded_at': session_ts,
            'asset_class': asset_class,
            'source': 'flow',
        })

    strikes = r.get('strikes') or []
    call_vol = r.get('call_vol') or []
    put_vol = r.get('put_vol') or []
    call_prem_k = r.get('call_prem_k') or []
    put_prem_k = r.get('put_prem_k') or []
    for i, k in enumerate(strikes):
        strike = float(k)
        for side, vols, prems in (
            ('CALL', call_vol, call_prem_k),
            ('PUT', put_vol, put_prem_k),
        ):
            if i >= len(vols) or i >= len(prems):
                continue
            vol = int(vols[i] or 0)
            tv = round(float(prems[i] or 0) * 1000.0, 2)
            if tv < 25_000:
                continue
            trades.append({
                'symbol': symbol,
                'contract': _format_contract_desc(symbol, exp_default, strike, side),
                'expiry': exp_default,
                'strike': strike,
                'side': side,
                'type': _flow_trade_type(tv),
                'sentiment': _flow_trade_sentiment(side, vol, 0),
                'total_value': tv,
                'total_size': vol,
                'avg_price': round(tv / max(vol * 100, 1), 4) if vol else 0,
                'underlying_price': round(spot, 2) if spot else None,
                'traded_at': session_ts,
                'asset_class': asset_class,
                'source': 'flow',
            })

    merged: dict[str, dict] = {}
    for t in trades:
        key = f"{t['symbol']}|{t['expiry']}|{t['strike']}|{t['side']}"
        if key not in merged or t['total_value'] > merged[key]['total_value']:
            merged[key] = t
    return sorted(merged.values(), key=lambda x: x['total_value'], reverse=True)[:40]


def _high_iv_from_greeks_cached(symbol: str) -> list | None:
    row = cache_get(cache_key(symbol, 'greeks'))
    if not row or row.get('no_options'):
        return None
    exp = row.get('expiry') or ''
    asset_class = _most_active_asset_class(symbol)
    out: list[dict] = []
    strikes = row.get('strikes') or []
    types = row.get('types') or []
    ivs = row.get('iv') or []
    for i, k in enumerate(strikes):
        if i >= len(types) or i >= len(ivs):
            break
        iv_pct = float(ivs[i] or 0)
        if iv_pct < 80:
            continue
        side = 'CALL' if str(types[i]).lower() == 'call' else 'PUT'
        strike = float(k)
        out.append({
            'symbol': symbol,
            'contract': _format_contract_desc(symbol, exp, strike, side),
            'expiry': exp,
            'strike': strike,
            'side': side,
            'implied_volatility': round(iv_pct, 2),
            'option_interest': 0,
            'option_volume': 0,
            'asset_class': asset_class,
        })
    out.sort(key=lambda x: x['implied_volatility'], reverse=True)
    return out[:40] if out else None

_FLOW_TRADE_EXTRA = ['MSTR', 'NFLX', 'ARM', 'SMCI', 'MU', 'AVGO']
_FLOW_TRADE_SYMS = list(dict.fromkeys(_MOST_ACTIVE_ALL_SYMS + _FLOW_TRADE_EXTRA))


def _format_expiry_label(exp: str) -> str:
    try:
        dt = datetime.strptime(exp, '%Y-%m-%d')
        return f"{dt.strftime('%b')} {dt.day}, {dt.year}"
    except Exception:
        return exp


def _format_contract_desc(symbol: str, expiry: str, strike: float, side: str) -> str:
    opt = 'call' if str(side).upper() == 'CALL' else 'put'
    return f"{symbol} {_format_expiry_label(expiry)} {strike:.2f} {opt}"


def _flow_trade_type(total_value: float) -> str:
    if total_value >= 1_000_000:
        return 'large'
    if total_value >= 250_000:
        return 'medium'
    return 'small'


def _flow_trade_sentiment(side: str, vol: int, oi: int) -> str:
    ratio = vol / max(oi, 1) if oi > 0 else (2.5 if vol >= 1500 else 1.0)
    if str(side).upper() == 'CALL':
        return 'bullish' if ratio >= 1.4 or vol >= 2500 else 'neutral'
    return 'bearish' if ratio >= 1.4 or vol >= 2500 else 'neutral'


def _traded_at_et(ts_ms: int | None = None) -> str:
    try:
        tz = ZoneInfo('America/New_York')
        ts = ts_ms if ts_ms else int(datetime.now().timestamp() * 1000)
        dt = datetime.fromtimestamp(ts / 1000.0, tz=tz)
        h12 = dt.hour % 12 or 12
        ampm = 'AM' if dt.hour < 12 else 'PM'
        return f"{dt.year}-{dt.month:02d}-{dt.day:02d} {h12}:{dt.minute:02d}{ampm} EDT"
    except Exception:
        return '—'


def _contract_trades_for_symbol(symbol: str, group: str = 'Stocks', nocache: bool = False, skip_live: bool = False) -> list:
    """Largest option contracts by estimated premium (volume × mid × 100)."""
    ck = cache_key(symbol, 'opt-flow-trades')
    if not nocache:
        cached = cache_get(ck)
        if cached is not None:
            return cached

    trades: list[dict] = []
    asset_class = _most_active_asset_class(symbol)
    session_ts = _traded_at_et()

    live_events: list = []
    if not skip_live:
        try:
            _poll_live_flow(symbol, nocache=nocache)
        except Exception:
            pass
        with _LIVE_FLOW_LOCK:
            live_events = list(_LIVE_FLOW_EVENTS.get(symbol, []))[:400]
    for ev in live_events:
        contracts = int(ev.get('contracts') or 0)
        if contracts <= 0:
            continue
        prem_k = float(ev.get('premium_k') or 0)
        total_value = round(prem_k * 1000.0, 2)
        if total_value < 25_000:
            continue
        strike = float(ev.get('strike') or 0)
        expiry = str(ev.get('expiry') or '')
        side = str(ev.get('side') or 'CALL').upper()
        avg_price = round(total_value / max(contracts * 100, 1), 4)
        trades.append({
            'symbol': symbol,
            'contract': _format_contract_desc(symbol, expiry, strike, side),
            'expiry': expiry,
            'strike': strike,
            'side': side,
            'type': _flow_trade_type(total_value),
            'sentiment': _flow_trade_sentiment(side, contracts, 0),
            'total_value': total_value,
            'total_size': contracts,
            'avg_price': avg_price,
            'underlying_price': None,
            'traded_at': _traded_at_et(ev.get('ts_ms')),
            'asset_class': asset_class,
            'source': 'live',
        })

    try:
        with _yf_lock:
            ticker = yf.Ticker(symbol)
            try:
                spot = float(ticker.fast_info.last_price or 0)
            except Exception:
                spot = 0.0
            if spot <= 0:
                spot = float((ticker.info or {}).get('regularMarketPrice', 0) or 0)
            expiries = list(ticker.options or [])
    except Exception:
        spot = 0.0
        expiries = []

    if not expiries:
        cache_set(ck, trades)
        return trades

    target_exps = _pick_scan_expiries(expiries, max_n=6)
    lo, hi = (spot * 0.70, spot * 1.35) if spot > 0 else (0, float('inf'))

    def _mid(row_):
        b = float(row_.get('bid', 0) or 0)
        a = float(row_.get('ask', 0) or 0)
        if b > 0 and a > 0:
            return (b + a) / 2
        return float(row_.get('lastPrice', 0) or 0)

    for exp in target_exps:
        try:
            with _yf_lock:
                chain = ticker.option_chain(exp)
        except Exception:
            continue
        for side, df in (('CALL', chain.calls), ('PUT', chain.puts)):
            if df is None or df.empty:
                continue
            try:
                df = df[(df['strike'] >= lo) & (df['strike'] <= hi)]
            except Exception:
                pass
            for _, r in df.iterrows():
                _v = r.get('volume', 0)
                vol = 0 if (_v is None or (_v != _v)) else int(float(_v or 0))
                if vol < 25:
                    continue
                _o = r.get('openInterest', 0)
                oi = 0 if (_o is None or (_o != _o)) else int(float(_o or 0))
                strike = round(float(r.get('strike') or 0), 2)
                mid = float(_mid(r) or 0)
                if mid <= 0:
                    continue
                total_value = round(vol * mid * 100.0, 2)
                if total_value < 25_000:
                    continue
                avg_price = round(mid, 4)
                trades.append({
                    'symbol': symbol,
                    'contract': _format_contract_desc(symbol, exp, strike, side),
                    'expiry': exp,
                    'strike': strike,
                    'side': side,
                    'type': _flow_trade_type(total_value),
                    'sentiment': _flow_trade_sentiment(side, vol, oi),
                    'total_value': total_value,
                    'total_size': vol,
                    'avg_price': avg_price,
                    'underlying_price': round(spot, 2) if spot > 0 else None,
                    'traded_at': session_ts,
                    'asset_class': asset_class,
                    'source': 'chain',
                })

    # Dedupe: prefer live event over chain snapshot for same contract key
    merged: dict[str, dict] = {}
    for t in trades:
        key = f"{t['symbol']}|{t['expiry']}|{t['strike']}|{t['side']}"
        prev = merged.get(key)
        if not prev or t.get('source') == 'live' or t['total_value'] > prev.get('total_value', 0):
            merged[key] = t
    out = sorted(merged.values(), key=lambda x: x['total_value'], reverse=True)[:80]
    cache_set(ck, out)
    return out


def _build_options_flow_trades(nocache: bool = False) -> list:
    all_trades: list[dict] = []
    flows = None
    if not nocache:
        try:
            flows = cache_get(cache_key('all', 'opt-flows'))
        except Exception:
            flows = None
    if flows and flows.get('assets'):
        for r in flows['assets']:
            all_trades.extend(_flow_trades_from_flow_row(r))
    else:
        for sym in _flow_rank_symbols(14):
            row = cache_get(cache_key(sym, 'opt-flow'))
            if row:
                all_trades.extend(_flow_trades_from_flow_row(row))

    have = {t['symbol'] for t in all_trades}
    # Only deep-scan a few names missing from flows cache (meme/high-vol)
    scan_syms = [sym for sym in _FLOW_TRADE_EXTRA if sym not in have][:4]
    if scan_syms:
        with ThreadPoolExecutor(max_workers=3) as pool:
            futs = {
                pool.submit(
                    _contract_trades_for_symbol,
                    sym,
                    'Stocks',
                    nocache,
                    True,
                ): sym
                for sym in scan_syms
            }
            for fut in as_completed(futs, timeout=90):
                try:
                    rows = fut.result(timeout=1) or []
                    all_trades.extend(rows[:20])
                except Exception:
                    pass

    merged: dict[str, dict] = {}
    for t in all_trades:
        key = f"{t.get('symbol')}|{t.get('expiry')}|{t.get('strike')}|{t.get('side')}"
        if key not in merged or t.get('total_value', 0) > merged[key].get('total_value', 0):
            merged[key] = t
    out = sorted(merged.values(), key=lambda x: x.get('total_value', 0), reverse=True)
    return out[:400]


@app.route('/api/options-flow-trades')
def options_flow_trades_endpoint():
    """Largest option trades by total premium value (chain volume + live deltas)."""
    filt = (request.args.get('filter') or 'stock').strip().lower()
    if filt not in ('stock', 'etf', 'index', 'all'):
        filt = 'stock'
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key(filt, 'opt-flow-trades')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    all_rows = _build_options_flow_trades(nocache=nocache)
    if filt == 'all':
        rows = all_rows
    else:
        rows = [r for r in all_rows if r.get('asset_class') == filt]

    result = {
        'filter': filt,
        'rows': rows,
        'count': len(rows),
        'timestamp': iso_now(),
        'note': 'Estimated from chain volume × mid and live volume deltas — not exchange tape.',
    }
    cache_set(ck, result)
    return jsonify(result)




_HIV_EXTRA = ['MSTR', 'AMC', 'INTC', 'SLS', 'GME', 'RIOT', 'COIN', 'MARA', 'PLTR', 'SOFI', 'NFLX', 'SMCI']


def _iv_to_pct(raw) -> float | None:
    """Normalize yfinance/Schwab IV to percent (e.g. 340.79)."""
    try:
        iv = float(raw or 0)
    except (TypeError, ValueError):
        return None
    if iv <= 0.001 or iv > 50:
        return None
    if iv <= 1.0:
        pct = iv * 100.0
    elif iv <= 15.0:
        pct = iv * 100.0
    else:
        pct = iv
    if pct < 50 or pct > 2000:
        return None
    return round(pct, 2)


def _high_iv_contracts_for_symbol(symbol: str, nocache: bool = False) -> list:
    """Contracts with highest implied volatility for one underlying."""
    ck = cache_key(symbol, 'high-iv-contracts')
    if not nocache:
        cached = cache_get(ck)
        if cached is not None:
            return cached

    rows: list[dict] = []
    asset_class = _most_active_asset_class(symbol)

    try:
        with _yf_lock:
            ticker = yf.Ticker(symbol)
            try:
                spot = float(ticker.fast_info.last_price or 0)
            except Exception:
                spot = 0.0
            if spot <= 0:
                spot = float((ticker.info or {}).get('regularMarketPrice', 0) or 0)
            expiries = list(ticker.options or [])
    except Exception:
        expiries = []
        spot = 0.0

    if not expiries:
        cache_set(ck, rows)
        return rows

    cached = _high_iv_from_greeks_cached(symbol)
    if cached is not None:
        cache_set(ck, cached)
        return cached

    target_exps = _pick_scan_expiries(expiries, max_n=6)
    lo = spot * 0.25 if spot > 0 else 0
    hi = spot * 2.5 if spot > 0 else float('inf')

    for exp in target_exps:
        try:
            with _yf_lock:
                chain = ticker.option_chain(exp)
        except Exception:
            continue
        for side, df in (('CALL', chain.calls), ('PUT', chain.puts)):
            if df is None or df.empty:
                continue
            try:
                df = df[(df['strike'] >= lo) & (df['strike'] <= hi)]
            except Exception:
                pass
            for _, r in df.iterrows():
                iv_pct = _iv_to_pct(r.get('impliedVolatility'))
                if iv_pct is None or iv_pct < 80:
                    continue
                _v = r.get('volume', 0)
                vol = 0 if (_v is None or (_v != _v)) else int(float(_v or 0))
                _o = r.get('openInterest', 0)
                oi = 0 if (_o is None or (_o != _o)) else int(float(_o or 0))
                strike = round(float(r.get('strike') or 0), 2)
                rows.append({
                    'symbol': symbol,
                    'contract': _format_contract_desc(symbol, exp, strike, side),
                    'expiry': exp,
                    'strike': strike,
                    'side': side,
                    'implied_volatility': iv_pct,
                    'option_interest': oi,
                    'option_volume': vol,
                    'asset_class': asset_class,
                })

    rows.sort(key=lambda x: x['implied_volatility'], reverse=True)
    out = rows[:60]
    cache_set(ck, out)
    return out


def _build_highest_iv_contracts(nocache: bool = False) -> list:
    all_rows: list[dict] = []
    sym_list = _flow_rank_symbols(12)
    for sym in _HIV_EXTRA:
        if sym not in sym_list:
            sym_list.append(sym)
    sym_list = sym_list[:12]

    need_scan: list[str] = []
    for sym in sym_list:
        if not nocache:
            hit = _high_iv_from_greeks_cached(sym)
            if hit:
                all_rows.extend(hit[:25])
                continue
        need_scan.append(sym)

    if need_scan:
        with ThreadPoolExecutor(max_workers=3) as pool:
            futs = {pool.submit(_high_iv_contracts_for_symbol, sym, nocache): sym for sym in need_scan}
            for fut in as_completed(futs, timeout=90):
                try:
                    chunk = fut.result(timeout=1) or []
                    all_rows.extend(chunk[:25])
                except Exception:
                    pass
    all_rows.sort(key=lambda x: x.get('implied_volatility', 0), reverse=True)
    return all_rows[:350]


@app.route('/api/highest-iv-contracts')
def highest_iv_contracts_endpoint():
    """Stock option contracts ranked by highest implied volatility."""
    filt = (request.args.get('filter') or 'stock').strip().lower()
    if filt not in ('stock', 'etf', 'index', 'all'):
        filt = 'stock'
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key(filt, 'high-iv-contracts')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    all_rows = _build_highest_iv_contracts(nocache=nocache)
    if filt == 'all':
        rows = all_rows
    else:
        rows = [r for r in all_rows if r.get('asset_class') == filt]

    result = {
        'filter': filt,
        'rows': rows,
        'count': len(rows),
        'timestamp': iso_now(),
    }
    cache_set(ck, result)
    return jsonify(result)


@app.route('/api/most-active-options')
def most_active_options_endpoint():
    """Rank underlyings by total option volume (calls + puts) for session."""
    filt = (request.args.get('filter') or 'all').strip().lower()
    if filt not in ('stock', 'etf', 'index', 'all'):
        filt = 'all'
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key(filt, 'most-active-opt')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    all_rows = _build_most_active_rows(nocache=nocache)
    if filt == 'all':
        rows = all_rows
    else:
        rows = [r for r in all_rows if r.get('asset_class') == filt]

    result = {
        'filter': filt,
        'rows': rows,
        'count': len(rows),
        'timestamp': iso_now(),
    }
    cache_set(ck, result)
    return jsonify(result)


@app.route('/api/option-flows')
def option_flows_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'opt-flows')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    items = [(sym, grp) for grp, syms in _FLOW_GROUPS for sym in syms]
    rows  = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(_flow_row, sym, grp, nocache): sym for sym, grp in items}
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                rows.append(r)

    go = {g: i for i, (g, _) in enumerate(_FLOW_GROUPS)}
    rows.sort(key=lambda r: (go.get(r['group'], 99), r['symbol']))

    result = {'assets': rows, 'count': len(rows), 'timestamp': iso_now()}
    cache_set(ck, result)
    return jsonify(result)


# ── Greeks (ATM + key strikes) ───────────────────────────────────────────────
def _pick_expiry(expiries: list[str], target_dte: int = 30, lo: int = 2, hi: int = 60) -> tuple[str | None, int | None]:
    if not expiries:
        return None, None
    today = datetime.now().date()
    best = None
    best_d = None
    for exp in expiries:
        try:
            dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
        except Exception:
            continue
        if not (lo <= dte <= hi):
            continue
        if best is None or abs(dte - target_dte) < abs(best_d - target_dte):
            best, best_d = exp, dte
    if best is None:
        # fallback to first future expiry
        for exp in expiries:
            try:
                dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
                if dte >= 1:
                    return exp, dte
            except Exception:
                continue
        return expiries[0], 0
    return best, best_d


def _greeks_for_symbol(symbol: str, nocache: bool = False) -> dict:
    ck = cache_key(symbol, 'greeks')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return cached

    # Schwab (if available) would be best; for now, use yfinance chain.
    with _yf_lock:
        tk = yf.Ticker(symbol)

    # Spot
    spot = 0.0
    try:
        with _yf_lock:
            spot = float(tk.fast_info.last_price or 0)
    except Exception:
        spot = 0.0
    if spot <= 0:
        try:
            with _yf_lock:
                h = tk.history(period='5d')
            spot = float(h['Close'].iloc[-1]) if (h is not None and not h.empty) else 0.0
        except Exception:
            spot = 0.0

    # Expiry
    try:
        with _yf_lock:
            expiries = list(tk.options or [])
    except Exception:
        expiries = []
    exp, dte = _pick_expiry(expiries)
    if not exp or spot <= 0:
        out = {
            'symbol': symbol,
            'label': SYMBOL_LABELS.get(symbol, symbol),
            'spot': round(spot, 4),
            'no_options': True,
        }
        cache_set(ck, out)
        return out

    # Chain
    try:
        with _yf_lock:
            ch = tk.option_chain(exp)
    except Exception:
        ch = None
    if ch is None:
        out = {'symbol': symbol, 'label': SYMBOL_LABELS.get(symbol, symbol), 'spot': round(spot, 4), 'no_options': True}
        cache_set(ck, out)
        return out

    calls = ch.calls.copy()
    puts = ch.puts.copy()
    if calls.empty or puts.empty:
        out = {'symbol': symbol, 'label': SYMBOL_LABELS.get(symbol, symbol), 'spot': round(spot, 4), 'no_options': True}
        cache_set(ck, out)
        return out

    # ATM strike
    calls['dist'] = (calls['strike'] - spot).abs()
    puts['dist'] = (puts['strike'] - spot).abs()
    c_atm = calls.loc[calls['dist'].idxmin()]
    p_atm = puts.loc[puts['dist'].idxmin()]
    K = float(c_atm['strike'])

    def _iv(row) -> float:
        try:
            v = float(row.get('impliedVolatility') or 0)
            return v if 0.001 < v < 10 else 0.0
        except Exception:
            return 0.0

    iv_c = _iv(c_atm)
    iv_p = _iv(p_atm)
    iv = iv_c or iv_p or 0.25
    T = max((dte or 1) / 365.0, 1 / 365.0)
    R = 0.05

    greeks_call = {
        'iv': round(iv_c * 100, 2) if iv_c else None,
        'delta': round(_bs_delta(spot, K, T, R, iv, 'call'), 4),
        'gamma': round(_bs_gamma(spot, K, T, R, iv), 6),
        'vega': round(_bs_vega(spot, K, T, R, iv) / 100.0, 4),   # per 1% IV
        'theta': round(_bs_theta(spot, K, T, R, iv, 'call') / 365.0, 6),  # per day
    }
    greeks_put = {
        'iv': round(iv_p * 100, 2) if iv_p else None,
        'delta': round(_bs_delta(spot, K, T, R, iv, 'put'), 4),
        'gamma': round(_bs_gamma(spot, K, T, R, iv), 6),
        'vega': round(_bs_vega(spot, K, T, R, iv) / 100.0, 4),
        'theta': round(_bs_theta(spot, K, T, R, iv, 'put') / 365.0, 6),
    }

    # Key strikes around spot (closest 9 strikes combined)
    strikes = sorted(set([float(x) for x in calls['strike'].tolist()] + [float(x) for x in puts['strike'].tolist()]))
    strikes_sorted = sorted(strikes, key=lambda x: abs(x - spot))[:9]
    strikes_sorted = sorted(strikes_sorted)

    # Full Greek curves by strike (OptionCharts-style)
    curve_strikes = sorted(strikes, key=lambda x: abs(x - spot))[:42]
    curve_strikes = sorted(curve_strikes)
    curve = {'strikes': [round(x, 2) for x in curve_strikes],
             'call': {'delta': [], 'gamma': [], 'theta': [], 'vega': [], 'iv': []},
             'put':  {'delta': [], 'gamma': [], 'theta': [], 'vega': [], 'iv': []}}

    def _row_iv(df, strike):
        sub = df.iloc[(df['strike'] - strike).abs().argsort()[:1]]
        if sub.empty:
            return iv
        return _iv(sub.iloc[0]) or iv

    for k in curve_strikes:
        iv_k_c = _row_iv(calls, k)
        iv_k_p = _row_iv(puts, k)
        curve['call']['iv'].append(round(iv_k_c * 100, 2))
        curve['put']['iv'].append(round(iv_k_p * 100, 2))
        curve['call']['delta'].append(round(_bs_delta(spot, k, T, R, iv_k_c, 'call'), 4))
        curve['put']['delta'].append(round(_bs_delta(spot, k, T, R, iv_k_p, 'put'), 4))
        curve['call']['gamma'].append(round(_bs_gamma(spot, k, T, R, iv_k_c), 6))
        curve['put']['gamma'].append(round(_bs_gamma(spot, k, T, R, iv_k_p), 6))
        curve['call']['vega'].append(round(_bs_vega(spot, k, T, R, iv_k_c) / 100.0, 4))
        curve['put']['vega'].append(round(_bs_vega(spot, k, T, R, iv_k_p) / 100.0, 4))
        curve['call']['theta'].append(round(_bs_theta(spot, k, T, R, iv_k_c, 'call') / 365.0, 4))
        curve['put']['theta'].append(round(_bs_theta(spot, k, T, R, iv_k_p, 'put') / 365.0, 4))

    # Table rows for frontend (near strikes)
    tbl_strikes, tbl_types, tbl_delta, tbl_gamma, tbl_theta, tbl_vega, tbl_iv = [], [], [], [], [], [], []
    for k in strikes_sorted:
        for otype, iv_k in (('call', _row_iv(calls, k)), ('put', _row_iv(puts, k))):
            tbl_strikes.append(round(k, 2))
            tbl_types.append(otype)
            tbl_delta.append(round(_bs_delta(spot, k, T, R, iv_k, otype), 4))
            tbl_gamma.append(round(_bs_gamma(spot, k, T, R, iv_k), 6))
            tbl_vega.append(round(_bs_vega(spot, k, T, R, iv_k) / 100.0, 4))
            tbl_theta.append(round(_bs_theta(spot, k, T, R, iv_k, otype) / 365.0, 4))
            tbl_iv.append(round(iv_k * 100, 2))

    out = {
        'symbol': symbol,
        'label': SYMBOL_LABELS.get(symbol, symbol),
        'spot': round(spot, 4),
        'expiry': exp,
        'dte': int(dte or 0),
        'atm_strike': round(K, 2),
        'atm': {'call': greeks_call, 'put': greeks_put},
        'near_strikes': [round(x, 2) for x in strikes_sorted],
        'curves': curve,
        'strikes': tbl_strikes,
        'types': tbl_types,
        'delta': tbl_delta,
        'gamma': tbl_gamma,
        'theta': tbl_theta,
        'vega': tbl_vega,
        'iv': tbl_iv,
        'no_options': False,
        'timestamp': iso_now(),
    }
    cache_set(ck, out)
    return out


def _option_chain_row(df_row, spot: float, T: float, R: float, otype: str) -> dict:
    try:
        K = float(df_row['strike'])
        bid = float(df_row.get('bid') or 0)
        ask = float(df_row.get('ask') or 0)
        last = float(df_row.get('lastPrice') or 0)
        mid = (bid + ask) / 2 if bid > 0 and ask > 0 else (last or 0)
        vol = int(df_row.get('volume') or 0)
        oi = int(df_row.get('openInterest') or 0)
        iv = float(df_row.get('impliedVolatility') or 0)
        if iv <= 0.001 or iv > 5:
            iv = 0.25
        return {
            'strike': round(K, 2),
            'last': round(last, 2) if last else None,
            'bid': round(bid, 2) if bid else None,
            'ask': round(ask, 2) if ask else None,
            'mid': round(mid, 2) if mid else None,
            'volume': vol,
            'open_interest': oi,
            'iv': round(iv * 100, 2),
            'delta': round(_bs_delta(spot, K, T, R, iv, otype), 4),
            'gamma': round(_bs_gamma(spot, K, T, R, iv), 6),
            'theta': round(_bs_theta(spot, K, T, R, iv, otype) / 365.0, 4),
            'vega': round(_bs_vega(spot, K, T, R, iv) / 100.0, 4),
            'contract': str(df_row.get('contractSymbol', '') or ''),
        }
    except Exception:
        return None


def _option_chain_for_symbol(symbol: str, expiry: str | None = None, nocache: bool = False) -> dict | None:
    fetch_sym = 'SPY' if symbol.upper() in ('SPX', '^SPX', '^GSPC') else symbol.upper()
    ck = cache_key(fetch_sym, f'opt-chain:{expiry or "front"}')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            if symbol.upper() in ('SPX', '^SPX', '^GSPC'):
                cached = dict(cached)
                cached['symbol'] = symbol.upper()
                cached['proxy'] = 'SPY'
            return cached

    with _yf_lock:
        tk = yf.Ticker(fetch_sym)
    try:
        with _yf_lock:
            spot = float(tk.fast_info.last_price or 0)
    except Exception:
        spot = 0.0
    if spot <= 0:
        with _yf_lock:
            h = tk.history(period='5d')
        if h is not None and not h.empty:
            spot = float(h['Close'].iloc[-1])

    try:
        with _yf_lock:
            expiries = sorted(list(tk.options or []))
    except Exception:
        expiries = []
    if not expiries or spot <= 0:
        return None

    exp, dte = _pick_expiry(expiries)
    if expiry and expiry in expiries:
        exp = expiry
        from datetime import date as _date
        try:
            dte = (_date.fromisoformat(exp) - _date.today()).days
        except Exception:
            dte = 0

    try:
        with _yf_lock:
            ch = tk.option_chain(exp)
    except Exception:
        return None

    T = max((dte or 1) / 365.0, 1 / 365.0)
    R = 0.05
    lo, hi = spot * 0.82, spot * 1.18

    calls, puts = [], []
    for _, row in ch.calls.iterrows():
        K = float(row['strike'])
        if lo <= K <= hi:
            r = _option_chain_row(row, spot, T, R, 'call')
            if r:
                calls.append(r)
    for _, row in ch.puts.iterrows():
        K = float(row['strike'])
        if lo <= K <= hi:
            r = _option_chain_row(row, spot, T, R, 'put')
            if r:
                puts.append(r)

    calls.sort(key=lambda x: x['strike'])
    puts.sort(key=lambda x: x['strike'])

    tot_c_oi = sum(c['open_interest'] for c in calls)
    tot_p_oi = sum(p['open_interest'] for p in puts)
    tot_c_vol = sum(c['volume'] for c in calls)
    tot_p_vol = sum(p['volume'] for p in puts)

    top_oi = []
    for c in calls:
        if c['open_interest'] > 0:
            top_oi.append({**c, 'type': 'CALL'})
    for p in puts:
        if p['open_interest'] > 0:
            top_oi.append({**p, 'type': 'PUT'})
    top_oi.sort(key=lambda x: x['open_interest'], reverse=True)

    out = {
        'symbol': symbol.upper(),
        'proxy': fetch_sym if fetch_sym != symbol.upper() else None,
        'spot': round(spot, 4),
        'expiry': exp,
        'dte': int(dte or 0),
        'expiries': expiries[:24],
        'calls': calls,
        'puts': puts,
        'totals': {
            'call_oi': tot_c_oi, 'put_oi': tot_p_oi,
            'call_vol': tot_c_vol, 'put_vol': tot_p_vol,
            'pcr_oi': round(tot_p_oi / max(tot_c_oi, 1), 3),
            'pcr_vol': round(tot_p_vol / max(tot_c_vol, 1), 3),
        },
        'top_open_interest': top_oi[:25],
        'timestamp': iso_now(),
    }
    if symbol.upper() in ('SPX', '^SPX', '^GSPC'):
        ratio = _spx_spy_ratio()
        out['spx_ratio'] = round(ratio, 4)
        out = _scale_spx_chain_row(out, ratio)
        out['symbol'] = 'SPX'
        out['proxy'] = 'SPY'
    cache_set(ck, out)
    return out


@app.route('/api/option-chain')
def option_chain_endpoint():
    """Full option chain for one symbol + expiry (OptionCharts-style table)."""
    sym = request.args.get('symbol', 'SPY').strip().upper()
    exp = request.args.get('expiry', '').strip() or None
    nocache = request.args.get('nocache', '0') == '1'
    row = _option_chain_for_symbol(sym, expiry=exp, nocache=nocache)
    if not row:
        return jsonify({'error': f'No chain for {sym}', 'symbol': sym}), 404
    return jsonify(row)


@app.route('/api/greeks')
def greeks_endpoint():
    """
    Greeks endpoint: ATM greeks + nearby strikes for quick risk view.
    Query: /api/greeks?symbols=SPY,QQQ,AAPL
    """
    nocache = request.args.get('nocache', '0') == '1'
    sym_s = (request.args.get('symbols') or 'SPY,QQQ').strip()
    symbols = [s.strip() for s in sym_s.split(',') if s.strip()]
    symbols = symbols[:12]
    sync = nocache or len(symbols) == 1

    rows = []
    for s in symbols:
        requested = s
        u = requested.upper()
        if u in ('SPX', '^SPX', '^GSPC', '^SPXW'):
            s = 'SPY'
        elif u in ('NDX', '^NDX', '^IXIC', 'NASDAQ'):
            s = 'QQQ'
        elif u in ('RUT', '^RUT', 'RUSSELL', 'RUSSELL2000'):
            s = 'IWM'
        elif u in ('VIX', '^VIX'):
            s = 'VXX'
        proxy = s
        ck = cache_key(proxy, 'greeks')
        row = None
        if not nocache:
            try:
                row = cache_get(ck)
            except Exception:
                row = None

        if row is None and sync:
            row = _greeks_for_symbol(proxy, nocache=True)
        elif row is None:
            global _GREEKS_WORKING  # type: ignore[declared-but-unused]
            try:
                _GREEKS_WORKING
            except Exception:
                _GREEKS_WORKING = {}

            if not _GREEKS_WORKING.get(proxy):
                _GREEKS_WORKING[proxy] = True

                def _compute_g(sym: str):
                    try:
                        _greeks_for_symbol(sym, nocache=True)
                    finally:
                        try:
                            _GREEKS_WORKING[sym] = False
                        except Exception:
                            pass

                try:
                    import threading as _th
                    _th.Thread(target=_compute_g, args=(proxy,), daemon=True).start()
                except Exception:
                    _GREEKS_WORKING[proxy] = False

            row = {
                'symbol': proxy,
                'label': SYMBOL_LABELS.get(proxy, proxy),
                'status': 'computing',
                'no_options': False,
                'timestamp': iso_now(),
            }

        if row and requested.upper() in ('SPX', '^SPX', '^GSPC', '^SPXW'):
            ratio = _spx_spy_ratio()
            row = dict(row)
            if row.get('curves'):
                row = _scale_spx_greeks_row(row, ratio)
            row['requested_symbol'] = requested
            row['proxy_symbol'] = proxy
            row['symbol'] = 'SPX'
            row['spx_ratio'] = round(ratio, 4)
        elif requested.upper() != s.upper():
            row = dict(row)
            row['requested_symbol'] = requested
            row['proxy_symbol'] = s
        rows.append(row)
    return jsonify({'assets': rows, 'count': len(rows), 'timestamp': iso_now()})


# ── Live Flow (snapshot deltas) ──────────────────────────────────────────────
def _classify_flow(delta_vol: int, premium_k: float) -> str:
    # Heuristic labels to mimic "Sweep/Split" vibes. Not a true tape classification.
    if premium_k >= 750 and delta_vol >= 500:
        return 'SWEEP'
    if premium_k >= 250 and delta_vol >= 200:
        return 'SPLIT'
    if premium_k >= 100 and delta_vol >= 100:
        return 'BLOCK'
    return 'PRINT'


def _poll_live_flow(symbol: str, nocache: bool = False) -> dict:
    # Auto-reset at US cash market open (09:30 ET) once per day.
    # This keeps "session" totals meaningful for day trading.
    try:
        now_et = datetime.now(ZoneInfo("America/New_York"))
        open_et = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
        et_day = now_et.date().isoformat()
    except Exception:
        now_et = None
        open_et = None
        et_day = datetime.now().date().isoformat()

    with _yf_lock:
        tk = yf.Ticker(symbol)

    # Spot
    spot = 0.0
    try:
        with _yf_lock:
            spot = float(tk.fast_info.last_price or 0)
    except Exception:
        spot = 0.0

    # Expiries: focus 0–7 DTE
    try:
        with _yf_lock:
            expiries = list(tk.options or [])
    except Exception:
        expiries = []
    today = datetime.now().date()
    targets: list[tuple[str, int]] = []
    for exp in expiries[:25]:
        try:
            dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
        except Exception:
            continue
        if 0 <= dte <= 7:
            targets.append((exp, dte))
    if not targets:
        exp, dte = _pick_expiry(expiries, target_dte=7, lo=0, hi=14)
        if exp:
            targets = [(exp, int(dte or 0))]

    snapshot: dict[str, dict] = {}
    now = datetime.now()
    ts_ms = int(now.timestamp() * 1000)
    new_events: list[dict] = []

    def _mid(row_):
        b = float(row_.get('bid', 0) or 0)
        a = float(row_.get('ask', 0) or 0)
        if b > 0 and a > 0:
            return (b + a) / 2
        lp = float(row_.get('lastPrice', 0) or 0)
        return lp

    for exp, dte in targets[:3]:
        try:
            with _yf_lock:
                ch = tk.option_chain(exp)
        except Exception:
            continue
        calls = ch.calls.copy()
        puts = ch.puts.copy()
        if calls is None or puts is None:
            continue
        lo, hi = (spot * 0.85, spot * 1.15) if spot > 0 else (0, float('inf'))
        try:
            calls = calls[(calls['strike'] >= lo) & (calls['strike'] <= hi)]
            puts  = puts [(puts['strike']  >= lo) & (puts['strike']  <= hi)]
        except Exception:
            pass

        for side, df in (('CALL', calls), ('PUT', puts)):
            if df is None or df.empty:
                continue
            for _, r in df.iterrows():
                cs = str(r.get('contractSymbol', '') or '')
                if not cs:
                    continue
                _v = r.get('volume', 0)
                vol = 0 if (_v is None or (_v != _v)) else int(float(_v or 0))
                strike = float(r.get('strike') or 0)
                mid = float(_mid(r) or 0.0)
                snapshot[cs] = {
                    'ts_ms': ts_ms,
                    'symbol': symbol,
                    'expiry': exp,
                    'dte': int(dte),
                    'side': side,
                    'strike': round(strike, 2),
                    'vol': vol,
                    'mid': round(mid, 4),
                }

    with _LIVE_FLOW_LOCK:
        if open_et is not None:
            last_reset = _LIVE_FLOW_LAST_RESET_ET.get(symbol)
            if last_reset != et_day and now_et >= open_et:
                _LIVE_FLOW_LAST[symbol] = {}
                _LIVE_FLOW_EVENTS[symbol].clear()
                _LIVE_FLOW_SERIES[symbol].clear()
                _LIVE_FLOW_LAST_RESET_ET[symbol] = et_day

        prev = _LIVE_FLOW_LAST.get(symbol, {})
        for cs, cur in snapshot.items():
            p = prev.get(cs)
            if not p:
                continue
            dv = int(cur.get('vol', 0) - (p.get('vol', 0) or 0))
            if dv <= 0:
                continue
            prem_k = round(dv * float(cur.get('mid') or 0.0) * 100.0 / 1000.0, 2)
            typ = _classify_flow(dv, prem_k)
            new_events.append({
                'ts_ms': ts_ms,
                'time': now.strftime('%H:%M:%S'),
                'symbol': symbol,
                'expiry': cur.get('expiry'),
                'dte': cur.get('dte'),
                'strike': cur.get('strike'),
                'side': cur.get('side'),
                'contracts': dv,
                'premium_k': prem_k,
                'type': typ,
                'contract': cs,
            })

        # persist
        if snapshot:
            _LIVE_FLOW_LAST[symbol] = snapshot

        # keep event tape
        for ev in sorted(new_events, key=lambda x: x['premium_k'], reverse=True)[:250]:
            _LIVE_FLOW_EVENTS[symbol].appendleft(ev)

        # rollup bucket for charts
        call_k = sum(e['premium_k'] for e in new_events if e['side'] == 'CALL')
        put_k  = sum(e['premium_k'] for e in new_events if e['side'] == 'PUT')
        _LIVE_FLOW_SERIES[symbol].append({'ts_ms': ts_ms, 'call_prem_k': round(call_k, 2), 'put_prem_k': round(put_k, 2)})

        # Send more history than the UI table shows so we can build "session" summaries.
        tape = list(_LIVE_FLOW_EVENTS[symbol])[:800]
        series = list(_LIVE_FLOW_SERIES[symbol])[-3600:]

    return {'symbol': symbol, 'spot': round(spot, 4), 'events': tape, 'series': series}


@app.route('/api/live-flow')
def live_flow_endpoint():
    """
    Live-ish flow tape from snapshot deltas.
    Query: /api/live-flow?symbols=SPY,QQQ&nocache=1
    """
    nocache = request.args.get('nocache', '0') == '1'
    sym_s = (request.args.get('symbols') or 'SPY').strip()
    symbols = [s.strip() for s in sym_s.split(',') if s.strip()][:8]
    # Index proxies
    mapped: list[tuple[str, str]] = []  # (requested, proxy)
    for s in symbols:
        requested = s
        u = requested.upper()
        if u in ('SPX', '^SPX', '^GSPC', '^SPXW'):
            mapped.append((requested, 'SPY'))
        elif u in ('NDX', '^NDX', '^IXIC', 'NASDAQ'):
            mapped.append((requested, 'QQQ'))
        elif u in ('RUT', '^RUT', 'RUSSELL', 'RUSSELL2000'):
            mapped.append((requested, 'IWM'))
        elif u in ('VIX', '^VIX'):
            mapped.append((requested, 'VXX'))
        else:
            mapped.append((requested, requested))

    rows = []
    for requested, proxy in mapped:
        try:
            a = _poll_live_flow(proxy, nocache=nocache)
            if requested.upper() != proxy.upper():
                a = dict(a)
                a['requested_symbol'] = requested
                a['proxy_symbol'] = proxy
            rows.append(a)
        except Exception as e:
            rows.append({'symbol': proxy, 'requested_symbol': requested, 'proxy_symbol': (proxy if requested.upper()!=proxy.upper() else None),
                         'error': str(e), 'events': [], 'series': []})
    return jsonify({'assets': rows, 'count': len(rows), 'timestamp': datetime.now().isoformat()})


# ── 0DTE Analysis ─────────────────────────────────────────────────────────────

def _build_0dte_analysis(r: dict) -> dict:
    """Enrich an option-flows row with 0DTE-specific trade recommendations and impact analysis."""
    spot          = r.get('spot', 0) or 0
    dte0_call_vol = r.get('dte0_call_vol', 0) or 0
    dte0_put_vol  = r.get('dte0_put_vol',  0) or 0
    dte0_cprem    = r.get('dte0_call_prem_k', 0) or 0
    dte0_pprem    = r.get('dte0_put_prem_k',  0) or 0
    total_vol     = dte0_call_vol + dte0_put_vol
    total_prem    = dte0_cprem + dte0_pprem

    dte0_unusual = [u for u in r.get('unusual', []) if u.get('dte', 1) == 0]

    if dte0_call_vol > dte0_put_vol * 1.5:
        dte0_bias = 'BULLISH'
    elif dte0_put_vol > dte0_call_vol * 1.5:
        dte0_bias = 'BEARISH'
    else:
        dte0_bias = 'NEUTRAL'

    activity_score = round(total_vol + total_prem * 10, 0)

    # ── Trade Recommendations ─────────────────────────────────────────────
    trades = []
    for u in sorted(dte0_unusual, key=lambda x: x['vol'], reverse=True)[:5]:
        k   = u['strike']
        pct = (k - spot) / spot * 100 if spot else 0
        if u['type'] == 'CALL':
            moneyness = 'ITM' if pct < -0.5 else ('OTM' if pct > 0.5 else 'ATM')
            action    = 'BUY CALL' if dte0_bias in ('BULLISH', 'NEUTRAL') else 'SELL CALL'
            rationale = (f"{'Strong' if u['ratio'] > 5 else 'Active'} call flow at ${k:.0f} "
                         f"({moneyness}, {pct:+.1f}% from spot). "
                         f"{u['vol']:,} contracts × {u['ratio']:.1f}×OI = "
                         f"{'fresh institutional positioning' if u['ratio'] > 5 else 'directional accumulation'}.")
        else:
            moneyness = 'ITM' if pct > 0.5 else ('OTM' if pct < -0.5 else 'ATM')
            action    = 'BUY PUT' if dte0_bias in ('BEARISH', 'NEUTRAL') else 'SELL PUT'
            rationale = (f"{'Strong' if u['ratio'] > 5 else 'Active'} put flow at ${k:.0f} "
                         f"({moneyness}, {pct:+.1f}% from spot). "
                         f"{u['vol']:,} contracts × {u['ratio']:.1f}×OI = "
                         f"{'downside hedge or directional bet' if u['vol'] > 1000 else 'protective positioning'}.")
        trades.append({
            'rank': len(trades) + 1, 'type': u['type'], 'action': action,
            'strike': k, 'pct_from_spot': round(pct, 1), 'moneyness': moneyness,
            'vol': u['vol'], 'oi': u['oi'], 'ratio': u['ratio'],
            'premium_k': u['premium_k'], 'expiry': u.get('expiry', ''),
            'rationale': rationale,
        })

    if not trades and spot and dte0_bias != 'NEUTRAL':
        atm     = round(spot / 5) * 5
        is_bull = dte0_bias == 'BULLISH'
        trades.append({
            'rank': 1, 'type': 'CALL' if is_bull else 'PUT',
            'action': 'BUY CALL' if is_bull else 'BUY PUT', 'strike': atm,
            'pct_from_spot': 0, 'moneyness': 'ATM',
            'vol': dte0_call_vol if is_bull else dte0_put_vol, 'oi': 0, 'ratio': 0,
            'premium_k': dte0_cprem if is_bull else dte0_pprem, 'expiry': '',
            'rationale': (f"{'Bullish' if is_bull else 'Bearish'} 0DTE flow: "
                          f"{(dte0_call_vol if is_bull else dte0_put_vol):,} "
                          f"{'call' if is_bull else 'put'} contracts vs "
                          f"{(dte0_put_vol if is_bull else dte0_call_vol):,} "
                          f"{'puts' if is_bull else 'calls'}. ATM near ${atm:.0f} "
                          f"captures directional momentum today."),
        })

    # ── Narratives ────────────────────────────────────────────────────────
    max_pain = r.get('max_pain_strike', 0) or 0
    mp_dist  = abs(max_pain - spot) / spot * 100 if spot and max_pain else 0
    gdir     = ('upward' if dte0_bias == 'BULLISH' else
                'downward' if dte0_bias == 'BEARISH' else 'mixed')

    market_impact = (
        f"0DTE options generate the most extreme intraday gamma of any expiry — dealers must hedge "
        f"continuously as price moves, amplifying every tick near active strikes. "
        f"{'Bullish' if dte0_bias == 'BULLISH' else 'Bearish' if dte0_bias == 'BEARISH' else 'Balanced'} "
        f"0DTE flow of ${total_prem / 1000:.2f}M total premium creates {gdir} dealer hedging pressure today."
    )
    if max_pain and spot:
        market_impact += (f" Max pain at ${max_pain:.0f} ({mp_dist:.1f}% from spot) exerts gravitational "
                          f"pull on price into the close — expect convergence toward this level.")
    if r.get('squeeze_potential'):
        market_impact += (f" Gamma squeeze risk at ${r['squeeze_strike']:.0f}: if price advances here, "
                          f"forced dealer buying accelerates sharply.")
    if r.get('crash_potential'):
        market_impact += (f" Put cascade risk at ${r['crash_strike']:.0f}: breakdown triggers forced dealer selling.")

    call_pct = int(100 * dte0_call_vol / max(total_vol, 1))
    retail_impact = (
        f"Retail traders dominate 0DTE volume ({call_pct}% call-side today). "
        "0DTE options offer high leverage with all-or-nothing outcomes by close — premium decays to zero in hours. "
        f"The {'bullish' if dte0_bias == 'BULLISH' else 'bearish' if dte0_bias == 'BEARISH' else 'balanced'} "
        f"0DTE bias suggests retail is "
        f"{'optimistic — buying calls for intraday upside' if dte0_bias == 'BULLISH' else 'defensive — buying puts for downside protection' if dte0_bias == 'BEARISH' else 'neutral — hedging both directions'}. "
        "Risk management: never allocate more than 1–2% of portfolio to 0DTE."
    )

    ratios_str = ', '.join(f"{u['ratio']:.1f}\u00d7" for u in dte0_unusual[:3]) if dte0_unusual else 'none flagged'
    institutional_impact = (
        "Institutional desks use 0DTE for intraday delta hedging and gamma scalping. "
        f"High vol/OI ratios ({ratios_str}) indicate fresh positioning — new directional bets, not closures. "
        "Market makers short 0DTE options and delta-hedge all day: near expiry, a $1 move forces a near-100% "
        "delta change on ATM options, creating a self-reinforcing feedback loop of stock buying or selling."
    )
    if r.get('squeeze_potential'):
        institutional_impact += (f" The squeeze at ${r['squeeze_strike']:.0f} is a key institutional catalyst: "
                                  f"a move above triggers cascading MM buy orders.")
    if r.get('crash_potential'):
        institutional_impact += (f" Put cascade at ${r['crash_strike']:.0f}: institutions with large put blocks "
                                  f"here will exert downward pressure on a breach.")

    out = dict(r)
    out.update({
        'dte0_unusual':         dte0_unusual,
        'dte0_bias':            dte0_bias,
        'activity_score':       activity_score,
        'trades':               trades,
        'market_impact':        market_impact.strip(),
        'retail_impact':        retail_impact.strip(),
        'institutional_impact': institutional_impact.strip(),
    })
    return out


@app.route('/api/0dte')
def dte0_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', '0dte')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    flows_ck   = cache_key('all', 'opt-flows')
    flows_data = None if nocache else cache_get(flows_ck)
    if flows_data:
        rows = flows_data.get('assets', [])
    else:
        items = [(sym, grp) for grp, syms in _FLOW_GROUPS for sym in syms]
        rows  = []
        with ThreadPoolExecutor(max_workers=4) as pool:
            futs = {pool.submit(_flow_row, sym, grp, nocache): sym for sym, grp in items}
            for fut in as_completed(futs):
                r = fut.result()
                if r:
                    rows.append(r)
        cache_set(flows_ck, {'assets': rows, 'count': len(rows),
                              'timestamp': datetime.now().isoformat()})

    result = [_build_0dte_analysis(r) for r in rows if r.get('has_0dte')]
    result.sort(key=lambda x: x.get('activity_score', 0), reverse=True)

    out = {'assets': result, 'count': len(result), 'timestamp': datetime.now().isoformat()}
    cache_set(ck, out)
    return jsonify(out)


# ── Fundamentals ──────────────────────────────────────────────────────────────

_FUND_GROUPS = [
    ('ETFs',        SYMBOLS['sp500']),
    ('Mag 7',       SYMBOLS['mag7']),
    ('Blue Chips',  SYMBOLS['bluechip']),
]


def _fund_row(symbol: str, group: str, nocache: bool = False) -> dict | None:
    """Fetch fundamental data for a single stock/ETF via yfinance .info."""
    ck = cache_key(symbol, 'fundamentals')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return cached
    try:
        with _yf_lock:
            ticker = yf.Ticker(symbol)
            info   = ticker.info

        def _g(key, default=None):
            v = info.get(key, default)
            return v if v not in (None, 'None', '', 'N/A') else default

        spot     = _g('currentPrice') or _g('regularMarketPrice') or _g('previousClose') or 0
        spot     = float(spot) if spot else 0

        # ── Finnhub enrichment (fills gaps when yfinance returns None/ETF 404) ──
        _fh_q  = _fh_quote(symbol)
        _fh_bf = _fh_basic_financials(symbol)
        _fh_pt = _fh_price_target(symbol)
        _fh_rec = _fh_recommendations(symbol)

        # Use Finnhub spot if yfinance returned 0
        if not spot and _fh_q.get('c'):
            spot = float(_fh_q['c'])

        # Valuation
        mktcap   = _g('marketCap')
        ev       = _g('enterpriseValue')
        trail_pe = _g('trailingPE')
        fwd_pe   = _g('forwardPE')
        pb       = _g('priceToBook')
        ps       = _g('priceToSalesTrailing12Months')
        ev_ebit  = _g('enterpriseToEbitda')

        # Earnings/Revenue
        trail_eps = _g('trailingEps')
        fwd_eps   = _g('forwardEps')
        rev       = _g('totalRevenue')
        rev_grow  = _g('revenueGrowth')
        earn_grow = _g('earningsGrowth')

        # Margins
        gross_m  = _g('grossMargins')
        op_m     = _g('operatingMargins')
        net_m    = _g('profitMargins')
        roe      = _g('returnOnEquity')
        roa      = _g('returnOnAssets')

        # Health
        curr_r   = _g('currentRatio')
        d2e      = _g('debtToEquity')
        tot_cash = _g('totalCash')
        tot_debt = _g('totalDebt')
        fcf      = _g('freeCashflow')

        # Dividends
        div_yield = _g('dividendYield')
        div_rate  = _g('dividendRate')
        payout    = _g('payoutRatio')

        # Technical
        beta      = _g('beta')
        wk52_hi   = _g('fiftyTwoWeekHigh')
        wk52_lo   = _g('fiftyTwoWeekLow')
        wk52_chg  = _g('52WeekChange')

        # Analyst
        tgt_mean  = _g('targetMeanPrice')
        tgt_lo    = _g('targetLowPrice')
        tgt_hi    = _g('targetHighPrice')
        rec_mean  = _g('recommendationMean')
        rec_key   = (_g('recommendationKey') or '').upper().replace('_', ' ')
        n_analysts= int(_g('numberOfAnalystOpinions') or 0)

        # Supplement analyst data with Finnhub if yfinance returned nothing
        if tgt_mean is None and _fh_pt.get('targetMean'):
            tgt_mean = _fh_pt.get('targetMean')
            tgt_lo   = _fh_pt.get('targetLow')
            tgt_hi   = _fh_pt.get('targetHigh')
        if rec_mean is None and _fh_rec:
            # Finnhub gives buy/hold/sell counts — derive a mean (1=Strong Buy, 5=Strong Sell)
            _buy   = (_fh_rec.get('strongBuy', 0)  + _fh_rec.get('buy', 0))
            _hold  = _fh_rec.get('hold', 0)
            _sell  = (_fh_rec.get('sell', 0) + _fh_rec.get('strongSell', 0))
            _total = _buy + _hold + _sell
            if _total > 0:
                rec_mean   = round((_buy * 1.5 + _hold * 3.0 + _sell * 4.5) / _total, 2)
                n_analysts = _total
        if n_analysts == 0 and _fh_pt.get('numberOfAnalysts'):
            n_analysts = int(_fh_pt['numberOfAnalysts'])

        # Supplement key financials with Finnhub basic_financials when yfinance missing
        if fwd_pe is None and _fh_bf.get('forwardPE'):
            fwd_pe = _fh_bf['forwardPE']
        if trail_pe is None and _fh_bf.get('peNormalizedAnnual'):
            trail_pe = _fh_bf['peNormalizedAnnual']
        if beta is None and _fh_bf.get('beta'):
            beta = _fh_bf['beta']
        if net_m is None and _fh_bf.get('netProfitMarginAnnual'):
            net_m = _fh_bf['netProfitMarginAnnual'] / 100.0  # Finnhub returns percentage
        if roe is None and _fh_bf.get('roeTTM'):
            roe = _fh_bf['roeTTM'] / 100.0
        if rev_grow is None and _fh_bf.get('revenueGrowthQuarterlyYoy'):
            rev_grow = _fh_bf['revenueGrowthQuarterlyYoy'] / 100.0
        if wk52_hi is None and _fh_bf.get('52WeekHigh'):
            wk52_hi = _fh_bf['52WeekHigh']
        if wk52_lo is None and _fh_bf.get('52WeekLow'):
            wk52_lo = _fh_bf['52WeekLow']

        # Compute upside
        upside_pct = None
        if tgt_mean and spot and float(spot) > 0:
            upside_pct = round((float(tgt_mean) - float(spot)) / float(spot) * 100, 1)

        # ── Next Earnings Date ───────────────────────────────────────────
        next_earn = None
        eps_est   = None
        try:
            cal = ticker.calendar
            if cal is not None:
                if hasattr(cal, 'to_dict'):
                    cd = cal.to_dict()
                    dates = cd.get('Earnings Date') or cd.get('Earnings High') or {}
                    if isinstance(dates, dict):
                        vals = list(dates.values())
                        if vals: next_earn = str(vals[0])[:10]
                    elif isinstance(dates, list) and dates:
                        next_earn = str(dates[0])[:10]
                    eps_est = cd.get('EPS Estimate') or cd.get('EPS Estimate Low')
                    if isinstance(eps_est, dict):
                        eps_est = list(eps_est.values())[0] if eps_est else None
                elif isinstance(cal, dict):
                    dates = cal.get('Earnings Date', [])
                    if dates: next_earn = str(dates[0])[:10]
                    eps_est = cal.get('EPS Estimate')
        except Exception:
            pass

        # ── Recent Analyst Upgrades (last 5) ────────────────────────────
        upgrades = []
        try:
            upg = ticker.upgrades_downgrades
            if upg is not None and not upg.empty:
                for idx, row in upg.head(5).iterrows():
                    upgrades.append({
                        'firm':   str(row.get('Firm', '')),
                        'to':     str(row.get('ToGrade', '')),
                        'from':   str(row.get('FromGrade', '')),
                        'action': str(row.get('Action', '')),
                        'date':   str(idx.date()) if hasattr(idx, 'date') else str(idx)[:10],
                    })
        except Exception:
            pass

        # ── Recent News (last 5) — Finnhub preferred, yfinance fallback ───────
        news = []
        try:
            news = _fh_news(symbol, count=5)
        except Exception:
            pass
        if not news:
          try:
            raw_news = ticker.news or []
            for n in raw_news[:5]:
                content = n.get('content', {}) if isinstance(n, dict) else {}
                title = (content.get('title') or n.get('title', '')) if content else n.get('title', '')
                url   = (content.get('canonicalUrl', {}) or {}).get('url', '') or n.get('link', '')
                pub   = content.get('pubDate', '') or str(n.get('providerPublishTime', ''))[:10]
                src   = (content.get('provider', {}) or {}).get('displayName', '') or n.get('publisher', '')
                if title and url:
                    news.append({'title': str(title)[:120], 'url': str(url), 'published': str(pub)[:10], 'source': str(src)})
          except Exception:
            pass

        # ── Fundamental Score ────────────────────────────────────────────
        score = 50.0
        if rev_grow  is not None: score += min(15, float(rev_grow)  * 100)
        if earn_grow is not None: score += min(10, float(earn_grow) * 50)
        if fwd_pe is not None:
            fp = float(fwd_pe)
            if   fp < 15:  score += 10
            elif fp < 25:  score += 5
            elif fp > 60:  score -= 20
            elif fp > 40:  score -= 10
        if rec_mean is not None:
            score += (3.0 - float(rec_mean)) * 7.5
        if net_m is not None and float(net_m) > 0.15:
            score += 5
        if wk52_chg is not None:
            score += min(10, max(-10, float(wk52_chg) * 100 * 0.2))
        if tgt_mean and spot and float(spot) > 0:
            score += min(10, max(-10, (float(tgt_mean) - float(spot)) / float(spot) * 100 * 0.2))
        score = max(0, min(100, round(score, 1)))

        # ── Rating label ─────────────────────────────────────────────────
        if rec_mean is None:
            rating = 'N/A'
        elif float(rec_mean) <= 1.5:
            rating = 'STRONG BUY'
        elif float(rec_mean) <= 2.5:
            rating = 'BUY'
        elif float(rec_mean) <= 3.5:
            rating = 'HOLD'
        elif float(rec_mean) <= 4.5:
            rating = 'SELL'
        else:
            rating = 'STRONG SELL'

        def _r(v):
            """Safe round to 4 decimal places, return None if falsy."""
            try: return round(float(v), 4) if v is not None else None
            except Exception: return None

        def _ri(v):
            """Safe int, return None if falsy."""
            try: return int(float(v)) if v is not None else None
            except Exception: return None

        row = {
            'symbol': symbol,
            'label':  SYMBOL_LABELS.get(symbol, symbol),
            'group':  group,
            'asset_type': _asset_type_for(symbol),
            'sector':   _g('sector', ''),
            'industry': _g('industry', ''),
            'spot':     _r(spot),
            # Valuation
            'market_cap':       _ri(mktcap),
            'enterprise_value': _ri(ev),
            'trailing_pe':      _r(trail_pe),
            'forward_pe':       _r(fwd_pe),
            'price_to_book':    _r(pb),
            'price_to_sales':   _r(ps),
            'ev_ebitda':        _r(ev_ebit),
            # Earnings
            'trailing_eps':   _r(trail_eps),
            'forward_eps':    _r(fwd_eps),
            'revenue':        _ri(rev),
            'revenue_growth': _r(rev_grow),
            'earnings_growth': _r(earn_grow),
            # Margins
            'gross_margin':     _r(gross_m),
            'operating_margin': _r(op_m),
            'net_margin':       _r(net_m),
            'roe':              _r(roe),
            'roa':              _r(roa),
            # Health
            'current_ratio':  _r(curr_r),
            'debt_to_equity': _r(d2e),
            'total_cash':     _ri(tot_cash),
            'total_debt':     _ri(tot_debt),
            'free_cash_flow': _ri(fcf),
            # Dividends
            'dividend_yield': _r(div_yield),
            'dividend_rate':  _r(div_rate),
            'payout_ratio':   _r(payout),
            # Technical
            'beta':       _r(beta),
            'wk52_high':  _r(wk52_hi),
            'wk52_low':   _r(wk52_lo),
            'wk52_change': _r(wk52_chg),
            # Analyst
            'target_mean':  _r(tgt_mean),
            'target_low':   _r(tgt_lo),
            'target_high':  _r(tgt_hi),
            'rec_mean':     _r(rec_mean),
            'rec_key':      rec_key,
            'n_analysts':   n_analysts,
            'upside_pct':   upside_pct,
            'rating':       rating,
            # Dates & extras
            'next_earnings': next_earn,
            'eps_estimate':  _r(eps_est),
            'upgrades':      upgrades,
            'news':          news,
            'fund_score':    score,
            # Metadata
            'description':       (_g('longBusinessSummary', '') or '')[:700],
            'full_time_employees': _ri(_g('fullTimeEmployees')),
            'website':           _g('website', ''),
        }
        cache_set(ck, row)
        return row
    except Exception as e:
        return None


@app.route('/api/fundamentals')
def fundamentals_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'fundamentals')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    all_items = [(sym, grp) for grp, syms in _FUND_GROUPS for sym in syms]
    rows = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(_fund_row, sym, grp, nocache): sym for sym, grp in all_items}
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                rows.append(r)

    grp_ord = {g: i for i, (g, _) in enumerate(_FUND_GROUPS)}
    rows.sort(key=lambda r: (grp_ord.get(r['group'], 99), -r.get('fund_score', 0)))

    out = {'assets': rows, 'count': len(rows), 'timestamp': datetime.now().isoformat()}
    cache_set(ck, out)
    return jsonify(out)


# ── Finnhub Real-Time Endpoints ───────────────────────────────────────────────

@app.route('/api/quote/<symbol>')
def quote_endpoint(symbol):
    """Real-time quote: Finnhub → Schwab → yfinance fallback."""
    symbol = symbol.upper().strip()
    q = _fh_quote(symbol)
    if q and q.get('c'):
        return jsonify({
            'symbol': symbol,
            'price':  q.get('c'),
            'open':   q.get('o'),
            'high':   q.get('h'),
            'low':    q.get('l'),
            'prev_close': q.get('pc'),
            'change': round(q.get('c', 0) - q.get('pc', 0), 4) if q.get('pc') else None,
            'change_pct': round((q.get('c', 0) - q.get('pc', 0)) / q.get('pc', 1) * 100, 3) if q.get('pc') else None,
            'bid': None,
            'ask': None,
            'bidSize': None,
            'askSize': None,
            'source': 'finnhub',
            'timestamp': datetime.now().isoformat(),
        })
    # Try Schwab real-time quote
    sq = _schwab_quote(symbol)
    if sq and sq.get('lastPrice'):
        lp = sq.get('lastPrice', 0)
        pc = sq.get('closePrice', 0)
        return jsonify({
            'symbol': symbol,
            'price':  lp,
            'open':   sq.get('openPrice'),
            'high':   sq.get('highPrice'),
            'low':    sq.get('lowPrice'),
            'prev_close': pc,
            'change': round(lp - pc, 4) if pc else None,
            'change_pct': round((lp - pc) / pc * 100, 3) if pc else None,
            'bid': sq.get('bidPrice'),
            'ask': sq.get('askPrice'),
            'bidSize': sq.get('bidSize'),
            'askSize': sq.get('askSize'),
            'source': 'schwab',
            'timestamp': datetime.now().isoformat(),
        })
    # Fallback to yfinance
    try:
        with _yf_lock:
            t = yf.Ticker(symbol)
            info = t.info
        price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
        return jsonify({
            'symbol': symbol,
            'price':  price,
            'bid': None,
            'ask': None,
            'bidSize': None,
            'askSize': None,
            'source': 'yfinance',
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        return jsonify({'symbol': symbol, 'error': str(e)[:100]}), 500


@app.route('/api/news/<symbol>')
def news_endpoint(symbol):
    """Recent company news via Finnhub."""
    symbol = symbol.upper().strip()
    count  = min(int(request.args.get('count', 10)), 30)
    articles = _fh_news(symbol, count=count)
    return jsonify({
        'symbol':   symbol,
        'articles': articles,
        'count':    len(articles),
        'source':   'finnhub' if articles else 'none',
        'timestamp': datetime.now().isoformat(),
    })


# ── XGBoost All-Assets Charts ─────────────────────────────────────────────────
_XGB_GROUPS = [
    ('ETFs',        SYMBOLS['sp500']),
    ('Mag 7',       SYMBOLS['mag7']),
    ('Blue Chips',  SYMBOLS['bluechip']),
    ('Futures',     SYMBOLS['futures']),
]

def _xgb_chart_row(symbol: str, group: str, nocache: bool = False) -> dict | None:
    """Fetch daily data 2024-present, train XGBClassifier, return candles + signals."""
    ck = cache_key(symbol, 'xgb-chart')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return cached
    try:
        from xgboost import XGBClassifier
        atype     = _asset_type_for(symbol)
        feat_cols = _ASSET_FEATURE_MAP.get(atype, STOCK_FEATURE_COLS)

        # ── Fetch daily data from 2024-01-01 ──────────────────────────────────
        with _yf_lock:
            raw = yf.download(symbol, start='2024-01-01', interval='1d',
                              progress=False, auto_adjust=True)
        if raw.empty or len(raw) < 80:
            return None
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        raw = raw[['Open', 'High', 'Low', 'Close', 'Volume']].copy()

        df  = compute_features(raw)
        if len(df) < 80:
            return None

        # ── Prepare ML labels ─────────────────────────────────────────────────
        d = df.copy()
        d['future_ret'] = d['Close'].pct_change(1).shift(-1)
        d['direction']  = (d['future_ret'] > 0).astype(int)
        feat_avail = [c for c in feat_cols if c in d.columns]
        d = d.dropna(subset=feat_avail + ['direction'])
        if len(d) < 80:
            return None

        # ── Train/test split at 2025-01-01 ────────────────────────────────────
        split_date = pd.Timestamp('2025-01-01', tz=d.index.tz)
        train_mask = d.index < split_date
        n_train    = int(train_mask.sum())
        if n_train < 60:                       # not enough — use 65% split
            n_train    = max(60, int(len(d) * 0.65))
            train_mask = np.zeros(len(d), dtype=bool)
            train_mask[:n_train] = True

        X = d[feat_avail].values
        y = d['direction'].values

        scaler    = StandardScaler()
        X_tr_sc   = scaler.fit_transform(X[:n_train])
        X_all_sc  = scaler.transform(X)

        # ── Train XGBoost ─────────────────────────────────────────────────────
        xgb = XGBClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            eval_metric='logloss', verbosity=0, random_state=42,
        )
        xgb.fit(X_tr_sc, y[:n_train])

        # ── Out-of-sample accuracy ────────────────────────────────────────────
        if n_train < len(d):
            X_te_sc   = scaler.transform(X[n_train:])
            preds_te  = xgb.predict(X_te_sc)
            oos_acc   = float((preds_te == y[n_train:]).mean())
        else:
            oos_acc = None

        # ── Generate signal markers over full period ──────────────────────────
        all_probs   = xgb.predict_proba(X_all_sc)[:, 1]
        all_sigs    = np.where(all_probs >= 0.58, 'BUY',
                     np.where(all_probs <= 0.42, 'SELL', 'HOLD'))

        # Convert DatetimeIndex to Unix seconds (pandas 3.x returns seconds from astype int64)
        unix_ts = [int(pd.Timestamp(t).timestamp()) for t in d.index]

        markers, prev_sig = [], 'HOLD'
        for ts, sig, prob in zip(unix_ts, all_sigs, all_probs):
            if sig != 'HOLD' and sig != prev_sig:
                markers.append({'time': int(ts), 'type': sig,
                                 'prob': round(float(prob), 3)})
            prev_sig = sig

        # Latest signal
        latest_prob = float(all_probs[-1])
        cur_sig = 'BUY' if latest_prob >= 0.60 else ('SELL' if latest_prob <= 0.40 else 'HOLD')

        # Train-end timestamp for chart vertical divider
        train_end_ts = int(unix_ts[n_train - 1])

        # ── Candle array [ts, O, H, L, C, V] ─────────────────────────────────
        candles = []
        for i, (idx, row) in enumerate(d.iterrows()):
            candles.append([
                int(unix_ts[i]),
                round(float(row['Open']),  4),
                round(float(row['High']),  4),
                round(float(row['Low']),   4),
                round(float(row['Close']), 4),
                int(row['Volume']) if not np.isnan(float(row.get('Volume', 0))) else 0,
            ])

        # ── Feature importance (top 8) ────────────────────────────────────────
        imp = dict(sorted(
            zip(feat_avail, [round(float(v), 4) for v in xgb.feature_importances_]),
            key=lambda x: x[1], reverse=True
        )[:8])

        row_out = {
            'symbol':         symbol,
            'label':          SYMBOL_LABELS.get(symbol, symbol),
            'group':          group,
            'asset_type':     atype,
            'candles':        candles,
            'signals':        markers,
            'train_end_ts':   train_end_ts,
            'oos_accuracy':   round(oos_acc, 4) if oos_acc is not None else None,
            'current_signal': cur_sig,
            'current_prob':   round(latest_prob, 4),
            'importance':     imp,
            'n_train':        n_train,
            'n_test':         len(d) - n_train,
            'close':          round(float(d['Close'].iloc[-1]), 4),
        }
        cache_set(ck, row_out)
        return row_out
    except Exception as e:
        print(f'[xgb-chart] {symbol}: {e}')
        return None


@app.route('/api/xgboost-charts')
def xgboost_charts_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'xgboost-charts')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    all_items = [(sym, grp) for grp, syms in _XGB_GROUPS for sym in syms]

    rows = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futs = {pool.submit(_xgb_chart_row, sym, grp, nocache): sym
                for sym, grp in all_items}
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                rows.append(r)

    grp_ord = {g: i for i, (g, _) in enumerate(_XGB_GROUPS)}
    rows.sort(key=lambda r: (grp_ord.get(r['group'], 99), r['symbol']))

    result = {
        'assets':    rows,
        'count':     len(rows),
        'timestamp': datetime.now().isoformat(),
    }
    cache_set(ck, result)
    return jsonify(result)


# ── Volatility Surface ────────────────────────────────────────────────────────

_VOL_SYMBOLS = list(dict.fromkeys(
    SYMBOLS['stocks'] + SYMBOLS['futures'][:1]  # ETFs, Mag7, blue chips + ES=F
))
_VOL_MONO_TARGETS = [0.80, 0.85, 0.90, 0.92, 0.95, 0.97, 1.00, 1.03, 1.05, 1.08, 1.10, 1.15, 1.20]

_IV_RANK_EXTRA = ['BTM', 'FUTU', 'DELL', 'SES', 'ONDS', 'NAKA', 'BMNR', 'MSTR', 'AMC', 'PLTR', 'SOFI']


def _compute_iv_rank_pct(symbol: str, current_iv: float) -> float | None:
    """IV Rank vs 1y range of 30-day realized vol (proxy when historical IV tape unavailable)."""
    if current_iv is None or current_iv <= 0:
        return None
    try:
        with _yf_lock:
            hist = yf.Ticker(symbol).history(period='1y', auto_adjust=True)
        if hist is None or hist.empty or len(hist) < 40:
            return None
        rets = np.log(hist['Close'] / hist['Close'].shift(1)).dropna()
        rolling = (rets.rolling(30).std() * np.sqrt(252)).dropna()
        if len(rolling) < 20:
            return None
        lo, hi = float(rolling.min()), float(rolling.max())
        if hi <= lo:
            return 50.0
        return round((float(current_iv) - lo) / max(hi - lo, 0.001) * 100, 2)
    except Exception:
        return None


def _vol_option_totals(vol_row: dict) -> tuple[int, int]:
    tv, oi = 0, 0
    for t in vol_row.get('term_structure') or []:
        tv += int(t.get('call_vol') or 0) + int(t.get('put_vol') or 0)
        oi += int(t.get('call_oi') or 0) + int(t.get('put_oi') or 0)
    return tv, oi


def _iv_rank_stock_from_vol(vol_row: dict, flow_row: dict | None = None) -> dict | None:
    if not vol_row or not vol_row.get('symbol'):
        return None
    sym = vol_row['symbol']
    atm = float(vol_row.get('atm_iv') or 0)
    if atm <= 0:
        return None
    iv_rank = vol_row.get('iv_rank')
    if iv_rank is None:
        iv_rank = _compute_iv_rank_pct(sym, atm)
    iv_pct = round(atm * 100, 2) if atm < 3 else round(atm, 2)
    vol, oi = _vol_option_totals(vol_row)
    if flow_row and not flow_row.get('no_options'):
        vol = max(vol, int(flow_row.get('total_call_vol') or 0) + int(flow_row.get('total_put_vol') or 0))
        # OI not in flow row totals — keep vol surface oi
    return {
        'symbol': sym,
        'name': _short_company_name(sym),
        'iv_rank': iv_rank,
        'implied_volatility_30d': iv_pct,
        'volume': vol,
        'open_interest': oi,
        'asset_class': _most_active_asset_class(sym),
        'spot': vol_row.get('spot'),
    }


def _build_iv_rank_stocks(nocache: bool = False) -> list:
    rows: list[dict] = []
    flow_map: dict[str, dict] = {}
    try:
        flows = cache_get(cache_key('all', 'opt-flows'))
        if flows and flows.get('assets'):
            for r in flows['assets']:
                if r.get('symbol'):
                    flow_map[r['symbol']] = r
    except Exception:
        pass

    vol_assets: list[dict] = []
    try:
        vs = cache_get(cache_key('all', 'vol-surface'))
        if vs and vs.get('assets'):
            vol_assets = vs['assets']
    except Exception:
        pass

    if not vol_assets and not nocache:
        for sym in _VOL_SYMBOLS[:14]:
            vr = cache_get(cache_key(sym, 'vol-surface-one'))
            if vr and vr.get('assets'):
                vol_assets.extend(vr['assets'])

    seen = set()
    for vol_row in vol_assets:
        sym = vol_row.get('symbol')
        if not sym or sym in seen:
            continue
        seen.add(sym)
        row = _iv_rank_stock_from_vol(vol_row, flow_map.get(sym))
        if row and row.get('iv_rank') is not None:
            rows.append(row)

    # Per-symbol vol cache fallback
    if len(rows) < 8:
        for sym in _flow_rank_symbols(14):
            if sym in seen:
                continue
            vol_row = cache_get(cache_key(sym, 'vol-surface-one'))
            if isinstance(vol_row, dict) and vol_row.get('assets'):
                vol_row = vol_row['assets'][0]
            elif isinstance(vol_row, dict) and vol_row.get('symbol'):
                pass
            else:
                vol_row = cache_get(cache_key(sym, 'vol-surface'))
            if not vol_row or not isinstance(vol_row, dict):
                continue
            if vol_row.get('assets'):
                vol_row = vol_row['assets'][0]
            row = _iv_rank_stock_from_vol(vol_row, flow_map.get(sym))
            if row and row.get('iv_rank') is not None:
                rows.append(row)
                seen.add(sym)

    return rows


@app.route('/api/iv-rank-stocks')
def iv_rank_stocks_endpoint():
    """Underlying IV Rank table (high or low sort)."""
    sort = (request.args.get('sort') or 'high').strip().lower()
    if sort not in ('high', 'low'):
        sort = 'high'
    filt = (request.args.get('filter') or 'stock').strip().lower()
    if filt not in ('stock', 'etf', 'index', 'all'):
        filt = 'stock'
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key(f'{sort}:{filt}', 'iv-rank-stocks')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    all_rows = _build_iv_rank_stocks(nocache=nocache)
    if filt != 'all':
        all_rows = [r for r in all_rows if r.get('asset_class') == filt]
    rev = sort == 'high'
    all_rows.sort(key=lambda x: (x.get('iv_rank') is None, x.get('iv_rank') or 0), reverse=rev)

    result = {
        'sort': sort,
        'filter': filt,
        'rows': all_rows,
        'count': len(all_rows),
        'timestamp': iso_now(),
        'note': 'IV Rank uses 1y realized-vol range as proxy; IV 30d is front-month ATM implied vol.',
    }
    cache_set(ck, result)
    return jsonify(result)



_SPX_RATIO_CACHE: tuple[float, float] | None = None  # (ratio, monotonic time)


def _spx_spy_ratio() -> float:
    """Live SPX index level / SPY price for scaling proxy chains to SPX display."""
    global _SPX_RATIO_CACHE
    import time as _time
    now = _time.monotonic()
    if _SPX_RATIO_CACHE and (now - _SPX_RATIO_CACHE[1]) < 120:
        return _SPX_RATIO_CACHE[0]
    spx = spy = 0.0
    try:
        with _yf_lock:
            spx = float(yf.Ticker('^GSPC').fast_info.last_price or 0)
            spy = float(yf.Ticker('SPY').fast_info.last_price or 0)
    except Exception:
        pass
    ratio = (spx / spy) if spx > 0 and spy > 0 else 10.0
    _SPX_RATIO_CACHE = (ratio, now)
    return ratio


def _scale_num(v, ratio: float):
    if v is None:
        return None
    try:
        return round(float(v) * ratio, 4)
    except Exception:
        return v


def _scale_spx_chain_row(row: dict, ratio: float) -> dict:
    """Scale strikes/spot for SPX display; option premiums stay SPY-contract $."""
    out = dict(row)
    out['spot'] = _scale_num(out.get('spot'), ratio)
    for key in ('calls', 'puts'):
        scaled = []
        for r in out.get(key) or []:
            nr = dict(r)
            nr['strike'] = _scale_num(nr.get('strike'), ratio)
            scaled.append(nr)
        out[key] = scaled
    top = []
    for r in out.get('top_open_interest') or []:
        nr = dict(r)
        nr['strike'] = _scale_num(nr.get('strike'), ratio)
        top.append(nr)
    out['top_open_interest'] = top
    return out


def _scale_spx_vol_row(row: dict, ratio: float) -> dict:
    out = dict(row)
    out['spot'] = _scale_num(out.get('spot'), ratio)
    ts = []
    for t in out.get('term_structure') or []:
        nt = dict(t)
        if nt.get('max_pain') is not None:
            nt['max_pain'] = _scale_num(nt['max_pain'], ratio)
        ts.append(nt)
    out['term_structure'] = ts
    mx = out.get('matrix')
    if mx and isinstance(mx, dict) and mx.get('strikes'):
        mx = dict(mx)
        mx['strikes'] = [_scale_num(s, ratio) for s in mx['strikes']]
        out['matrix'] = mx
    return out


def _scale_spx_greeks_row(row: dict, ratio: float) -> dict:
    out = dict(row)
    out['spot'] = _scale_num(out.get('spot'), ratio)
    if out.get('atm_strike') is not None:
        out['atm_strike'] = _scale_num(out['atm_strike'], ratio)
    curves = out.get('curves')
    if curves and isinstance(curves, dict):
        curves = dict(curves)
        curves['strikes'] = [_scale_num(s, ratio) for s in curves.get('strikes') or []]
        out['curves'] = curves
    if out.get('near_strikes'):
        out['near_strikes'] = [_scale_num(s, ratio) for s in out['near_strikes']]
    if out.get('strikes'):
        out['strikes'] = [_scale_num(s, ratio) for s in out['strikes']]
    return out


def _chain_max_pain(calls, puts) -> float | None:
    """Strike where total option-holder payout at expiry is minimized."""
    strikes = set()
    for df in (calls, puts):
        if df is not None and not df.empty:
            strikes.update(float(x) for x in df['strike'].tolist())
    if not strikes:
        return None
    call_oi = {}
    put_oi = {}
    if calls is not None and not calls.empty and 'openInterest' in calls.columns:
        for k, v in calls.groupby('strike')['openInterest'].sum().items():
            call_oi[float(k)] = float(v or 0)
    if puts is not None and not puts.empty and 'openInterest' in puts.columns:
        for k, v in puts.groupby('strike')['openInterest'].sum().items():
            put_oi[float(k)] = float(v or 0)
    best_s, best_p = None, 1e30
    for s in sorted(strikes):
        pain = 0.0
        for k, oi in call_oi.items():
            pain += oi * max(0.0, s - k) * 100
        for k, oi in put_oi.items():
            pain += oi * max(0.0, k - s)  * 100
        if pain < best_p:
            best_p = pain
            best_s = s
    return round(best_s, 2) if best_s is not None else None


def _vol_row(symbol: str) -> dict | None:
    """Fetch option chains and compute IV surface data for one symbol."""
    try:
        from datetime import date as _date
        # yfinance is not reliably thread-safe across many concurrent tickers.
        # Use the shared lock to reduce partial surfaces (missing SPY/QQQ).
        with _yf_lock:
            tk = yf.Ticker(symbol)

        with _yf_lock:
            hist = tk.history(period='35d', auto_adjust=True)
        if hist.empty or len(hist) < 2:
            return None
        spot = float(hist['Close'].iloc[-1])

        # 30-day historical volatility (annualised)
        log_rets = np.log(hist['Close'] / hist['Close'].shift(1)).dropna()
        hv30 = float(log_rets.std() * np.sqrt(252))

        with _yf_lock:
            expirations = tk.options
        if not expirations:
            return None

        today = _date.today()
        term_structure = []
        skew_by_exp    = {}
        exp_labels     = []
        dtes_list      = []
        iv_grid        = {m: [] for m in _VOL_MONO_TARGETS}

        for exp_str in expirations[:8]:
            try:
                exp_date = _date.fromisoformat(exp_str)
                dte = max(1, (exp_date - today).days)

                with _yf_lock:
                    chain = tk.option_chain(exp_str)
                calls = chain.calls[chain.calls['impliedVolatility'] > 0.01].copy()
                puts  = chain.puts[chain.puts['impliedVolatility']  > 0.01].copy()
                if calls.empty or puts.empty:
                    continue

                # ATM IV (average of 3 nearest strikes)
                atm_c = calls.iloc[(calls['strike'] - spot).abs().argsort()[:3]]
                atm_p = puts.iloc[(puts['strike']  - spot).abs().argsort()[:3]]
                call_iv_atm = float(atm_c['impliedVolatility'].mean())
                put_iv_atm  = float(atm_p['impliedVolatility'].mean())
                atm_iv      = (call_iv_atm + put_iv_atm) / 2

                # Skew = put_iv_ATM - call_iv_ATM (positive = put premium)
                skew_val = round(put_iv_atm - call_iv_atm, 4)

                # 25-delta risk reversal approx: 5% OTM put - 5% OTM call IV
                otm_c = calls[calls['strike'] > spot * 1.04]
                otm_p = puts[puts['strike']   < spot * 0.96]
                rr25 = 0.0
                if not otm_c.empty and not otm_p.empty:
                    rr25 = round(
                        float(otm_p['impliedVolatility'].mean()) -
                        float(otm_c['impliedVolatility'].mean()), 4)

                c_vol = int(calls['volume'].fillna(0).sum()) if 'volume' in calls.columns else 0
                p_vol = int(puts['volume'].fillna(0).sum()) if 'volume' in puts.columns else 0
                c_oi  = int(calls['openInterest'].fillna(0).sum()) if 'openInterest' in calls.columns else 0
                p_oi  = int(puts['openInterest'].fillna(0).sum()) if 'openInterest' in puts.columns else 0
                mp    = _chain_max_pain(calls, puts)

                term_structure.append({
                    'expiry':   exp_str,
                    'dte':      dte,
                    'atm_iv':   round(atm_iv, 4),
                    'call_iv':  round(call_iv_atm, 4),
                    'put_iv':   round(put_iv_atm, 4),
                    'skew':     skew_val,
                    'rr25':     rr25,
                    'call_vol': c_vol,
                    'put_vol':  p_vol,
                    'pcr_vol':  round(p_vol / max(c_vol, 1), 3),
                    'call_oi':  c_oi,
                    'put_oi':   p_oi,
                    'pcr_oi':   round(p_oi / max(c_oi, 1), 3),
                    'max_pain': mp,
                })

                # Skew curve: IV at each available strike
                skew_pts = []
                for _, row in calls.iterrows():
                    m = row['strike'] / spot
                    if 0.75 <= m <= 1.28:
                        skew_pts.append({'strike': round(float(row['strike']), 1),
                                         'moneyness': round(m, 4),
                                         'type': 'call',
                                         'iv': round(float(row['impliedVolatility']), 4)})
                for _, row in puts.iterrows():
                    m = row['strike'] / spot
                    if 0.75 <= m <= 1.28:
                        skew_pts.append({'strike': round(float(row['strike']), 1),
                                         'moneyness': round(m, 4),
                                         'type': 'put',
                                         'iv': round(float(row['impliedVolatility']), 4)})
                skew_by_exp[exp_str] = sorted(skew_pts, key=lambda x: x['strike'])

                # Fixed-strike matrix: IV at each moneyness bucket
                all_opts = pd.concat([
                    calls[['strike', 'impliedVolatility']].assign(side='call'),
                    puts[['strike',  'impliedVolatility']].assign(side='put'),
                ])
                exp_labels.append(exp_str)
                dtes_list.append(dte)
                for mono in _VOL_MONO_TARGETS:
                    target_k = spot * mono
                    side_df  = all_opts[all_opts['side'] == ('put' if mono <= 1.0 else 'call')]
                    if side_df.empty:
                        side_df = all_opts
                    closest = side_df.iloc[(side_df['strike'] - target_k).abs().argsort()[:2]]
                    iv_grid[mono].append(round(float(closest['impliedVolatility'].mean()), 4))

            except Exception:
                continue

        if not term_structure:
            return None

        # IV rank: percentile vs 1y realized-vol range (proxy for IV Rank)
        atm_iv_front = float(term_structure[0]['atm_iv'])
        iv_rank = _compute_iv_rank_pct(symbol, atm_iv_front)
        if iv_rank is None:
            ivs = [t['atm_iv'] for t in term_structure]
            iv_min, iv_max = min(ivs), max(ivs)
            iv_rank = round((ivs[0] - iv_min) / max(iv_max - iv_min, 0.001) * 100, 1)

        return {
            'symbol':       symbol,
            'spot':         round(spot, 2),
            'hv30':         round(hv30, 4),
            'atm_iv':       term_structure[0]['atm_iv'],
            'iv_rank':      iv_rank,
            'iv_rv_spread': round((term_structure[0]['atm_iv'] if term_structure else 0) - hv30, 4),
            'term_structure': term_structure,
            'skew_by_exp':    skew_by_exp,
            'matrix': {
                'expirations': exp_labels,
                'dtes':        dtes_list,
                'moneyness':   _VOL_MONO_TARGETS,
                'strikes':     [round(spot * m, 1) for m in _VOL_MONO_TARGETS],
                'iv_grid':     {str(m): iv_grid[m] for m in _VOL_MONO_TARGETS},
            },
        }
    except Exception as e:
        print(f'[vol-surface] {symbol}: {e}')
        return None


def _vol_fetch_symbol(symbol: str) -> dict | None:
    """Map display symbols (SPX) to yfinance tickers and return one vol row."""
    sym = (symbol or '').strip().upper()
    if not sym:
        return None
    fetch_sym = 'SPY' if sym == 'SPX' else sym
    row = _vol_row(fetch_sym)
    if row and sym == 'SPX':
        ratio = _spx_spy_ratio()
        row = _scale_spx_vol_row(dict(row), ratio)
        row['symbol'] = 'SPX'
        row['proxy'] = 'SPY'
        row['spx_ratio'] = round(ratio, 4)
    elif row and sym != fetch_sym:
        row = dict(row)
        row['symbol'] = sym
    return row


@app.route('/api/volatility-surface')
def volatility_surface_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    sym_q = request.args.get('symbol', '').strip().upper()
    if sym_q:
        ck1 = cache_key(sym_q, 'vol-surface-one')
        if not nocache:
            cached1 = cache_get(ck1)
            if cached1:
                return jsonify(cached1)
        row = _vol_fetch_symbol(sym_q)
        result = {'assets': [row] if row else [], 'count': 1 if row else 0,
                  'symbol': sym_q, 'timestamp': iso_now()}
        if row:
            cache_set(ck1, result)
        return jsonify(result)

    ck = cache_key('all', 'vol-surface')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    rows = []
    # SPY/QQQ can take longer than 5s for option chains; give each worker more time.
    with ThreadPoolExecutor(max_workers=5) as pool:
        futs = {pool.submit(_vol_row, sym): sym for sym in _VOL_SYMBOLS}
        try:
            for fut in as_completed(futs, timeout=120):
                try:
                    r = fut.result(timeout=20)
                    if r:
                        rows.append(r)
                except Exception:
                    pass
        except TimeoutError:
            print('[vol-surface] Timed out waiting for futures — returning partial results')

    rows.sort(key=lambda r: _VOL_SYMBOLS.index(r['symbol'])
              if r['symbol'] in _VOL_SYMBOLS else 99)

    result = {'assets': rows, 'count': len(rows), 'timestamp': iso_now()}
    cache_set(ck, result)
    return jsonify(result)


# ── Startup ───────────────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════════════════════════
# ALGORITHM & BOT ENGINE
# ══════════════════════════════════════════════════════════════════════════════
import uuid as _uuid_mod

BOT_ASSETS = [
    'SPY', 'QQQ', 'DIA', 'IWM',                                    # ETFs
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA',      # Mag 7
    'JPM', 'BAC', 'V', 'XOM', 'CVX', 'JNJ', 'UNH', 'WMT', 'HD', 'BRK-B',  # Blue chips
    'ES=F',                                                          # Futures
]

BOT_ASSET_TYPE = {
    **{s: 'stock' for s in ['SPY','QQQ','DIA','IWM','AAPL','MSFT','NVDA','GOOGL',
                              'AMZN','META','TSLA','JPM','BAC','V','XOM','CVX',
                              'JNJ','UNH','WMT','HD','BRK-B']},
    'ES=F': 'futures',
}

_bot_lock  = threading.Lock()
_bot_threads = {}
_bot_states  = {}

def _bot_default_state(sym):
    atype = BOT_ASSET_TYPE.get(sym, 'stock')
    return {
        'symbol': sym, 'asset_type': atype,
        'running': False, 'position': None,
        'trades': [], 'pnl': 0.0, 'total_trades': 0, 'wins': 0,
        'config': {
            'capital': 50000 if atype == 'futures' else 10000,
            'risk_pct': 1.0, 'stop_loss_pct': 1.5,
            'take_profit_pct': 3.0, 'signal_threshold': 65,
            'mode': 'paper', 'instrument': atype, 'interval_sec': 60,
        },
        'status': 'idle', 'last_signal': None,
        'last_check': None, 'error': None,
    }

for _s in BOT_ASSETS:
    _bot_states[_s] = _bot_default_state(_s)

def _bot_fetch_signal(symbol):
    try:
        import urllib.request as _ur2, json as _j2
        with _ur2.urlopen(f'http://localhost:3000/api/signal/{symbol}', timeout=30) as r:
            return _j2.loads(r.read())
    except Exception:
        return None


def _bot_open_position(symbol, price, side, sig):
    state = _bot_states[symbol]
    cfg   = state['config']
    atype = state['asset_type']
    mult  = sig.get('futures_multiplier', 50) if atype == 'futures' else 1
    size  = round((cfg['capital'] * cfg['risk_pct'] / 100) / (price * mult), 4) if price > 0 else 0
    stop   = sig.get('stop_long'   if side == 'long'  else 'stop_short',
                     price * (0.985 if side == 'long' else 1.015))
    target = sig.get('target_long' if side == 'long'  else 'target_short',
                     price * (1.03  if side == 'long' else 0.97))
    state['position'] = {
        'side': side, 'entry': price, 'size': size,
        'stop': stop, 'target': target,
        'time': datetime.utcnow().isoformat() + 'Z',
        'instrument': cfg.get('instrument', 'stock'),
    }
    state['status'] = side
    state['error']  = None

def _bot_close_position(symbol, price, reason):
    state = _bot_states[symbol]
    pos   = state['position']
    if not pos:
        return
    pnl_pts = (price - pos['entry']) if pos['side'] == 'long' else (pos['entry'] - price)
    pnl     = round(pnl_pts * pos['size'], 2)
    trade   = {
        'id':   str(_uuid_mod.uuid4())[:8],
        'symbol': symbol, 'side': pos['side'],
        'entry': pos['entry'], 'exit': price,
        'size': pos['size'], 'pnl': pnl, 'reason': reason,
        'opened': pos['time'], 'closed': datetime.utcnow().isoformat() + 'Z',
        'instrument': pos.get('instrument', 'stock'),
    }
    state['trades'].insert(0, trade)
    if len(state['trades']) > 100:
        state['trades'] = state['trades'][:100]
    state['pnl']          = round(state['pnl'] + pnl, 2)
    state['total_trades'] += 1
    if pnl > 0:
        state['wins'] += 1
    state['position'] = None
    state['status']   = 'running'

def _bot_algo_tick(symbol):
    state = _bot_states[symbol]
    sig   = _bot_fetch_signal(symbol)
    if not sig:
        state['error'] = 'Signal fetch failed'
        return
    price    = sig.get('close', 0)
    prob_up  = sig.get('prob_up', 0.5) * 100
    cfg      = state['config']
    thresh   = cfg['signal_threshold']
    state['last_check']  = datetime.utcnow().isoformat() + 'Z'
    state['last_signal'] = {
        'direction': sig.get('signal', 'HOLD'),
        'prob_up': round(prob_up, 1), 'price': price,
        'time': state['last_check'],
    }
    state['error'] = None
    pos = state['position']
    if pos and price > 0:
        pnl_pct = ((price - pos['entry']) / pos['entry'] * 100) if pos['side'] == 'long'                   else ((pos['entry'] - price) / pos['entry'] * 100)
        if pnl_pct <= -cfg['stop_loss_pct']:
            _bot_close_position(symbol, price, 'Stop Loss'); return
        if pnl_pct >= cfg['take_profit_pct']:
            _bot_close_position(symbol, price, 'Take Profit'); return
        if pos['side'] == 'long'  and prob_up <= (100 - thresh):
            _bot_close_position(symbol, price, 'Signal Reversal'); return
        if pos['side'] == 'short' and prob_up >= thresh:
            _bot_close_position(symbol, price, 'Signal Reversal'); return
    if not pos and price > 0:
        if prob_up >= thresh:
            _bot_open_position(symbol, price, 'long',  sig)
        elif prob_up <= (100 - thresh):
            _bot_open_position(symbol, price, 'short', sig)

def _bot_run_loop(symbol):
    state = _bot_states[symbol]
    while state['running']:
        try:
            with _bot_lock:
                _bot_algo_tick(symbol)
        except Exception as e:
            state['error'] = str(e)[:200]
        interval = state['config'].get('interval_sec', 60)
        for _ in range(interval * 4):
            if not state['running']:
                break
            time.sleep(0.25)
    state['status'] = 'idle'

# ── Bot API ───────────────────────────────────────────────────────────────────
@app.route('/api/bots')
def api_bots():
    with _bot_lock:
        result = {}
        for sym, st in _bot_states.items():
            result[sym] = {
                'symbol': sym, 'asset_type': st['asset_type'],
                'running': st['running'], 'status': st['status'],
                'pnl': st['pnl'], 'total_trades': st['total_trades'],
                'wins': st['wins'], 'position': st['position'],
                'last_signal': st['last_signal'], 'last_check': st['last_check'],
                'config': st['config'], 'error': st['error'],
                'recent_trades': st['trades'][:5],
            }
    return jsonify(result)

@app.route('/api/bots/<symbol>/start', methods=['POST'])
def api_bot_start(symbol):
    if symbol not in _bot_states:
        return jsonify({'ok': False, 'error': 'Unknown symbol'})
    cfg_in = request.get_json(force=True) or {}
    state  = _bot_states[symbol]
    if state['running']:
        return jsonify({'ok': True, 'message': 'Already running'})
    state['config'].update({k: v for k, v in cfg_in.items() if k in state['config']})
    state['running'] = True
    state['status']  = 'running'
    state['error']   = None
    t = threading.Thread(target=_bot_run_loop, args=(symbol,), daemon=True)
    _bot_threads[symbol] = t
    t.start()
    return jsonify({'ok': True, 'message': f'{symbol} bot started'})

@app.route('/api/bots/<symbol>/stop', methods=['POST'])
def api_bot_stop(symbol):
    if symbol not in _bot_states:
        return jsonify({'ok': False, 'error': 'Unknown symbol'})
    _bot_states[symbol]['running'] = False
    return jsonify({'ok': True, 'message': f'{symbol} bot stopping'})

@app.route('/api/bots/start-all', methods=['POST'])
def api_bots_start_all():
    started = []
    for sym in BOT_ASSETS:
        state = _bot_states[sym]
        if not state['running']:
            state['running'] = True
            state['status']  = 'running'
            t = threading.Thread(target=_bot_run_loop, args=(sym,), daemon=True)
            _bot_threads[sym] = t
            t.start()
            started.append(sym)
    return jsonify({'ok': True, 'started': started})

@app.route('/api/bots/stop-all', methods=['POST'])
def api_bots_stop_all():
    for sym in BOT_ASSETS:
        _bot_states[sym]['running'] = False
    return jsonify({'ok': True})

@app.route('/api/bots/<symbol>/config', methods=['POST'])
def api_bot_config(symbol):
    if symbol not in _bot_states:
        return jsonify({'ok': False, 'error': 'Unknown symbol'})
    cfg = request.get_json(force=True) or {}
    _bot_states[symbol]['config'].update({k: v for k, v in cfg.items()
                                          if k in _bot_states[symbol]['config']})
    return jsonify({'ok': True, 'config': _bot_states[symbol]['config']})

@app.route('/api/bots/<symbol>/reset', methods=['POST'])
def api_bot_reset(symbol):
    if symbol not in _bot_states:
        return jsonify({'ok': False, 'error': 'Unknown symbol'})
    state = _bot_states[symbol]
    if state['running']:
        return jsonify({'ok': False, 'error': 'Stop bot before reset'})
    state.update({'trades': [], 'pnl': 0.0, 'total_trades': 0, 'wins': 0,
                  'position': None, 'status': 'idle', 'last_signal': None, 'error': None})
    return jsonify({'ok': True})

@app.route('/api/bots/<symbol>/trades')
def api_bot_trades(symbol):
    if symbol not in _bot_states:
        return jsonify({'ok': False, 'error': 'Unknown symbol'})
    return jsonify({'ok': True, 'trades': _bot_states[symbol]['trades']})

if __name__ == '__main__':
    print("=" * 60)
    print("  Live ML Trading Server  —  http://localhost:3000")
    print("=" * 60)
    print(f"  IBKR (ib_async) : {'available' if IB_AVAILABLE else 'not installed'} — probing in background…")
    print( "  Data fallback   : yfinance (15-20 min delayed)")
    print()
    print("  GET  /api/candles/<symbol>    — 4H OHLCV candles (?nocache=1)")
    print("  GET  /api/signal/<symbol>     — ML direction + magnitude (?nocache=1)")
    print("  GET  /api/multi/AAPL,ES=F     — batch signals")
    print("  GET  /api/symbols             — available symbols list")
    print("  GET  /api/ibkr-status         — IBKR connection state (no probe)")
    print("  POST /api/ibkr-connect        — connect IBKR {host,port,clientId}")
    print("  POST /api/ibkr-disconnect     — disconnect IBKR, revert to yfinance")
    print("  POST /api/cache/clear         — force-clear data cache")
    print("  GET  /api/health              — server health check")
    print("=" * 60)

    # Probe IBKR in a background thread so Flask starts immediately
    if IB_AVAILABLE:
        def _bg_ibkr_probe():
            ib = get_ib_connection()
            status = 'CONNECTED (real-time data)' if (ib and ib.isConnected()) \
                     else 'not connected — using yfinance'
            print(f"[IBKR] Probe complete: {status}")
        threading.Thread(target=_bg_ibkr_probe, daemon=True).start()

    # Pre-warm cache in background so first user hits cached data, not cold yfinance
    def _bg_prewarm():
        import time, urllib.request, sys
        time.sleep(6)  # let Flask finish binding the port
        PREWARM_ENDPOINTS = [
            '/api/market-summary',
            '/api/gamma-exposure',
            '/api/gex-wall-tracker',
            '/api/option-flows',
            '/api/most-active-options',
            '/api/0dte',
            '/api/spx-0dte-risk',
            '/api/options-strategy',
            '/api/fundamentals',
            '/api/volatility-surface?symbol=SPY',
            '/api/greeks?symbols=SPY',
            '/api/option-chain?symbol=SPY',
            # Key asset candles + signals (most-visited asset pages)
            '/api/candles/SPY?interval=1h',
            '/api/candles/QQQ?interval=1h',
            '/api/candles/AAPL?interval=1h',
            '/api/signal/SPY',
            '/api/signal/QQQ',
            '/api/signal/AAPL',
        ]
        for ep in PREWARM_ENDPOINTS:
            try:
                urllib.request.urlopen(f'http://localhost:3000{ep}', timeout=90)
                sys.stdout.buffer.write(f'[prewarm] {ep} OK cached\n'.encode('utf-8'))
                sys.stdout.buffer.flush()
            except Exception as e:
                sys.stdout.buffer.write(f'[prewarm] {ep} FAIL {e}\n'.encode('utf-8'))
                sys.stdout.buffer.flush()
    threading.Thread(target=_bg_prewarm, daemon=True).start()
    try:
        _start_schwab_https_server()
    except Exception as _e_https:
        print(f'[Schwab HTTPS] Skipped: {_e_https}')

    app.run(host='0.0.0.0', port=3000, debug=False, threaded=True)
