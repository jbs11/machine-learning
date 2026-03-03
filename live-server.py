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

import warnings
warnings.filterwarnings('ignore')

import threading
from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

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
    'futures': ['ES=F', 'NQ=F', 'CL=F', 'GC=F', 'SI=F', 'ZB=F']
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
    # Futures
    'ES=F':  'E-mini S&P 500 (ES)',
    'NQ=F':  'E-mini Nasdaq-100 (NQ)',
    'CL=F':  'Crude Oil WTI (CL)',
    'GC=F':  'Gold Futures (GC)',
    'SI=F':  'Silver Futures (SI)',
    'ZB=F':  '30-Year T-Bond (ZB)',
}

FUTURES_MULTIPLIERS = {
    'ES=F': 50,
    'NQ=F': 20,
    'CL=F': 1000,
    'GC=F': 100,
    'SI=F': 5000,
    'ZB=F': 1000,
}

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

# Map yfinance futures symbols → (IBKR symbol, exchange)
FUTURES_IB_MAP = {
    'ES=F': ('ES',  'CME'),
    'NQ=F': ('NQ',  'CME'),
    'CL=F': ('CL',  'NYMEX'),
    'GC=F': ('GC',  'COMEX'),
    'SI=F': ('SI',  'COMEX'),
    'ZB=F': ('ZB',  'CBOT'),
}


def get_ib_connection():
    """
    Return an active IB connection, or None if TWS is not reachable.
    Uses a singleton; reconnects automatically if the connection dropped.
    Thread-safe via _ib_lock.
    """
    global _ib, _ib_connected, _ib_error
    if not IB_AVAILABLE:
        return None
    with _ib_lock:
        try:
            if _ib is not None and _ib.isConnected():
                return _ib
            # Try paper-trading port first (7497), then live port (7496)
            for port in (7497, 7496):
                try:
                    ib = IB()
                    ib.connect('127.0.0.1', port, clientId=10, timeout=4)
                    if ib.isConnected():
                        _ib = ib
                        _ib_connected = True
                        _ib_error = ''
                        print(f"[IBKR] Connected on port {port}")
                        return _ib
                except Exception:
                    pass
            _ib_connected = False
            _ib_error = 'TWS/IB Gateway not running on ports 7496 or 7497'
            return None
        except Exception as e:
            _ib_connected = False
            _ib_error = str(e)
            return None


def ib_symbol_to_contract(symbol: str):
    """Map a yfinance-style symbol to an ib_async contract object."""
    if symbol in FUTURES_IB_MAP:
        sym, exch = FUTURES_IB_MAP[symbol]
        return Future(sym, '', exch)
    return Stock(symbol, 'SMART', 'USD')


def get_4h_candles_ibkr(symbol: str, period_days: int = 90) -> pd.DataFrame:
    """Fetch 1H bars from Interactive Brokers and resample to 4H candles."""
    ib = get_ib_connection()
    if ib is None:
        return pd.DataFrame()
    try:
        contract = ib_symbol_to_contract(symbol)
        ib.qualifyContracts(contract)

        # IBKR historical data request
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
        # Normalize column names (ib_async uses lowercase)
        df = df.rename(columns={
            'date':   'datetime',
            'open':   'Open',
            'high':   'High',
            'low':    'Low',
            'close':  'Close',
            'volume': 'Volume'
        })
        df = df.set_index('datetime')
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        df = df[['Open', 'High', 'Low', 'Close', 'Volume']]

        df_4h = df.resample('4h').agg({
            'Open':   'first',
            'High':   'max',
            'Low':    'min',
            'Close':  'last',
            'Volume': 'sum'
        }).dropna()
        print(f"[IBKR] {symbol}: {len(df_4h)} 4H bars from IBKR")
        return df_4h

    except Exception as e:
        print(f"[IBKR] get_4h_candles_ibkr({symbol}): {e}")
        return pd.DataFrame()


# ── Data Fetching (with IBKR → yfinance fallback) ────────────────────────────
def get_4h_candles(symbol: str, period: str = '90d') -> pd.DataFrame:
    """
    Download 1H bars and resample to 4H candles.
    Tries Interactive Brokers (ib_async) first; falls back to yfinance.
    """
    # Parse period string to days for IBKR
    try:
        period_days = int(period.replace('d', ''))
    except Exception:
        period_days = 90

    # 1) Try IBKR live data
    df = get_4h_candles_ibkr(symbol, period_days)
    if not df.empty:
        return df

    # 2) Fall back to yfinance (15-20 min delayed)
    try:
        raw = yf.download(symbol, period=period, interval='1h', progress=False)
        if raw.empty:
            return pd.DataFrame()
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        df = raw[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
        df_4h = df.resample('4h').agg({
            'Open':   'first',
            'High':   'max',
            'Low':    'min',
            'Close':  'last',
            'Volume': 'sum'
        }).dropna()
        print(f"[yfinance] {symbol}: {len(df_4h)} 4H bars")
        return df_4h
    except Exception as e:
        print(f"[ERROR] get_4h_candles({symbol}): {e}")
        return pd.DataFrame()


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

FEATURE_COLS = [
    'sma20_ratio', 'sma50_ratio', 'macd', 'macd_signal',
    'rsi', 'bb_width', 'bb_pos', 'vol_ratio',
    'ret1', 'ret3', 'ret5', 'atr_pct',
    'oc_range', 'hl_range'
]

def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add 14 technical features used by the ML models."""
    d = df.copy()
    sma20 = d['Close'].rolling(20).mean()
    sma50 = d['Close'].rolling(50).mean()
    ema12 = d['Close'].ewm(span=12).mean()
    ema26 = d['Close'].ewm(span=26).mean()
    std20 = d['Close'].rolling(20).std()

    d['sma20_ratio']  = d['Close'] / (sma20 + 1e-9)
    d['sma50_ratio']  = d['Close'] / (sma50 + 1e-9)
    d['macd']         = ema12 - ema26
    d['macd_signal']  = d['macd'].ewm(span=9).mean()
    d['rsi']          = compute_rsi(d['Close'], 14)
    d['atr']          = compute_atr(d, 14)
    bb_upper          = sma20 + 2 * std20
    bb_lower          = sma20 - 2 * std20
    d['bb_width']     = (bb_upper - bb_lower) / (sma20 + 1e-9)
    d['bb_pos']       = (d['Close'] - bb_lower) / (bb_upper - bb_lower + 1e-9)
    d['vol_ratio']    = d['Volume'] / (d['Volume'].rolling(20).mean() + 1e-9)
    d['ret1']         = d['Close'].pct_change(1)
    d['ret3']         = d['Close'].pct_change(3)
    d['ret5']         = d['Close'].pct_change(5)
    d['atr_pct']      = d['atr'] / (d['Close'] + 1e-9)
    d['oc_range']     = (d['Close'] - d['Open']) / (d['Open'] + 1e-9)
    d['hl_range']     = (d['High'] - d['Low'])  / (d['Open'] + 1e-9)
    return d.dropna()


# ── ML Models ─────────────────────────────────────────────────────────────────
def train_and_predict(df: pd.DataFrame):
    """
    Train GBM direction classifier + magnitude regressor on history,
    then predict on the most recent bar.
    Returns dict with all signal fields.
    """
    d = df.copy()
    d['future_ret'] = d['Close'].pct_change(1).shift(-1)
    d['direction']  = (d['future_ret'] > 0).astype(int)
    d = d.dropna(subset=FEATURE_COLS + ['direction', 'future_ret'])

    if len(d) < 80:
        return None

    X     = d[FEATURE_COLS].values
    y_dir = d['direction'].values
    y_mag = d['future_ret'].values

    scaler  = StandardScaler()
    X_sc    = scaler.fit_transform(X)

    clf = GradientBoostingClassifier(
        n_estimators=150, max_depth=4, learning_rate=0.05,
        subsample=0.8, random_state=42
    )
    reg = GradientBoostingRegressor(
        n_estimators=150, max_depth=4, learning_rate=0.05,
        subsample=0.8, random_state=42
    )
    clf.fit(X_sc, y_dir)
    reg.fit(X_sc, y_mag)

    # Predict on latest bar
    latest      = df.iloc[-1]
    X_latest    = np.array([[latest[c] for c in FEATURE_COLS]])
    X_latest_sc = scaler.transform(X_latest)

    prob_up  = float(clf.predict_proba(X_latest_sc)[0][1])
    pred_mag = float(reg.predict(X_latest_sc)[0])
    close    = float(latest['Close'])
    atr      = float(latest['atr'])

    if prob_up >= 0.65:
        signal = 'BUY'
    elif prob_up <= 0.35:
        signal = 'SELL'
    else:
        signal = 'HOLD'

    # Backtest accuracy on last 60 bars
    test_rows = min(60, len(d) - 1)
    X_bt   = scaler.transform(d[FEATURE_COLS].values[-test_rows:])
    y_pred = clf.predict(X_bt)
    acc    = float((y_pred == d['direction'].values[-test_rows:]).mean())

    feat_imp = dict(zip(FEATURE_COLS,
                        [round(float(v), 4) for v in clf.feature_importances_]))
    feat_imp = dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True))

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
        'backtest_accuracy':  round(acc, 4),
        'feature_importance': feat_imp,
        'timestamp':          datetime.now().isoformat()
    }


# ── Cache (simple in-memory, 4-min TTL) ──────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 240  # seconds

def cache_key(symbol, kind):
    return f'{kind}:{symbol}'

def cache_get(key):
    if key in _cache:
        ts, val = _cache[key]
        if (datetime.now() - ts).total_seconds() < CACHE_TTL:
            return val
    return None

def cache_set(key, val):
    _cache[key] = (datetime.now(), val)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.now().isoformat()})


@app.route('/api/ibkr-connect', methods=['POST'])
def ibkr_connect():
    """
    Connect (or reconnect) to IBKR TWS/Gateway with caller-supplied settings.
    Body JSON: { "host": "127.0.0.1", "port": 7497, "clientId": 10 }
    """
    global _ib, _ib_connected, _ib_error
    if not IB_AVAILABLE:
        return jsonify({'success': False, 'error': 'ib_async not installed — pip install ib_async'}), 400

    body = request.get_json(silent=True) or {}
    host      = str(body.get('host',     '127.0.0.1'))
    port      = int(body.get('port',     7497))
    client_id = int(body.get('clientId', 10))

    with _ib_lock:
        # Disconnect existing connection if any
        if _ib is not None:
            try:
                _ib.disconnect()
            except Exception:
                pass
            _ib = None
        _ib_connected = False
        _ib_error = ''

        try:
            ib = IB()
            ib.connect(host, port, clientId=client_id, timeout=5)
            if ib.isConnected():
                _ib = ib
                _ib_connected = True
                print(f"[IBKR] Connected via POST /api/ibkr-connect → {host}:{port} cid={client_id}")
                return jsonify({
                    'success':     True,
                    'connected':   True,
                    'host':        host,
                    'port':        port,
                    'clientId':    client_id,
                    'data_source': 'IBKR real-time',
                    'time':        datetime.now().isoformat()
                })
            else:
                _ib_error = f'Connection to {host}:{port} established but isConnected() = False'
                return jsonify({'success': False, 'error': _ib_error}), 500
        except Exception as e:
            _ib_error = str(e)
            print(f"[IBKR] /api/ibkr-connect failed: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/ibkr-status')
def ibkr_status():
    """Report Interactive Brokers connection state."""
    connected = False
    info = {}
    if IB_AVAILABLE:
        ib = get_ib_connection()
        connected = (ib is not None and ib.isConnected())
        if connected:
            try:
                info['server_version'] = ib.client.serverVersion()
            except Exception:
                pass
    return jsonify({
        'ib_async_installed': IB_AVAILABLE,
        'connected':          connected,
        'error':              _ib_error if not connected else '',
        'ports_tried':        [7497, 7496],
        'data_source':        'IBKR real-time' if connected else 'yfinance (15-20 min delayed)',
        'time':               datetime.now().isoformat()
    })


@app.route('/api/symbols')
def symbols():
    return jsonify({**SYMBOLS, 'labels': SYMBOL_LABELS})


@app.route('/api/candles/<symbol>')
def candles(symbol: str):
    symbol = symbol.upper()
    period = request.args.get('period', '90d')
    ck = cache_key(symbol, f'candles:{period}')
    cached = cache_get(ck)
    if cached:
        return jsonify(cached)

    df = get_4h_candles(symbol, period=period)
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


@app.route('/api/signal/<symbol>')
def signal(symbol: str):
    symbol = symbol.upper()
    ck = cache_key(symbol, 'signal')
    cached = cache_get(ck)
    if cached:
        return jsonify(cached)

    df_4h = get_4h_candles(symbol, period='120d')
    if df_4h.empty or len(df_4h) < 80:
        return jsonify({'error': f'Insufficient data for {symbol}'}), 500

    df = compute_features(df_4h)
    result = train_and_predict(df)
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
        res = train_and_predict(df)
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


# ── Startup ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    # Probe IBKR connection at startup (non-blocking — fails gracefully)
    ib_status = 'checking...'
    if IB_AVAILABLE:
        ib = get_ib_connection()
        ib_status = 'CONNECTED (real-time data)' if (ib and ib.isConnected()) \
                    else 'not connected — using yfinance'
    else:
        ib_status = 'ib_async not installed — using yfinance'

    print("=" * 60)
    print("  Live ML Trading Server  —  http://localhost:5050")
    print("=" * 60)
    print(f"  IBKR (ib_async) : {ib_status}")
    print( "  Data fallback   : yfinance (15-20 min delayed)")
    print()
    print("  GET /api/candles/<symbol>     — 4H OHLCV candles")
    print("  GET /api/signal/<symbol>      — ML direction + magnitude")
    print("  GET /api/multi/AAPL,ES=F      — batch signals")
    print("  GET /api/symbols              — available symbols list")
    print("  GET /api/ibkr-status          — IBKR connection info")
    print("  GET /api/health               — server health check")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5050, debug=False, threaded=True)
