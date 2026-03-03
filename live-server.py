#!/usr/bin/env python3
"""
Live ML Trading Data Server
============================
Serves 4-hour candlestick data and XGBoost/GBM ML signals for:
  - Stocks  : AAPL, NVDA, MSFT, SPY, QQQ
  - Options : AAPL, NVDA, SPY (underlying data + IV proxy)
  - Futures : ES=F, CL=F, GC=F, NQ=F

Data source (default): yfinance — 15-20 min delayed, no account needed
Upgrade path: swap yfinance calls for ib_insync to get true real-time via
  Interactive Brokers TWS/Gateway.

Run:
    pip install flask flask-cors yfinance scikit-learn pandas numpy
    python live-server.py

Endpoints:
    GET /api/candles/<symbol>          → 4H OHLCV array
    GET /api/signal/<symbol>           → ML direction + magnitude signal
    GET /api/symbols                   → available symbol lists
    GET /api/health                    → server health check
"""

import warnings
warnings.filterwarnings('ignore')

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ── Available Symbols ────────────────────────────────────────────────────────
SYMBOLS = {
    'stocks':  ['AAPL', 'NVDA', 'MSFT', 'SPY', 'QQQ'],
    'options': ['AAPL', 'NVDA', 'SPY'],          # options use underlying price
    'futures': ['ES=F', 'CL=F', 'GC=F', 'NQ=F']
}

SYMBOL_LABELS = {
    'AAPL': 'Apple Inc.',
    'NVDA': 'NVIDIA Corp.',
    'MSFT': 'Microsoft Corp.',
    'SPY':  'S&P 500 ETF',
    'QQQ':  'Nasdaq-100 ETF',
    'ES=F': 'E-mini S&P 500',
    'CL=F': 'Crude Oil WTI',
    'GC=F': 'Gold Futures',
    'NQ=F': 'E-mini Nasdaq-100'
}

FUTURES_MULTIPLIERS = {
    'ES=F': 50,
    'CL=F': 1000,
    'GC=F': 100,
    'NQ=F': 20
}

# ── Data Fetching ────────────────────────────────────────────────────────────
def get_4h_candles(symbol: str, period: str = '90d') -> pd.DataFrame:
    """
    Download 1H bars from yfinance and resample to 4H candles.
    For Interactive Brokers live data, replace with ib_insync calls.
    """
    try:
        raw = yf.download(symbol, period=period, interval='1h', progress=False)
        if raw.empty:
            return pd.DataFrame()
        # Flatten MultiIndex if yfinance returns one
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
        return df_4h
    except Exception as e:
        print(f"[ERROR] get_4h_candles({symbol}): {e}")
        return pd.DataFrame()


# ── Technical Indicators ─────────────────────────────────────────────────────
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


# ── ML Models ────────────────────────────────────────────────────────────────
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
    latest   = df.iloc[-1]
    X_latest = np.array([[latest[c] for c in FEATURE_COLS]])
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

    # Backtest accuracy (last 60 bars)
    test_rows = min(60, len(d) - 1)
    X_bt   = scaler.transform(d[FEATURE_COLS].values[-test_rows:])
    y_pred = clf.predict(X_bt)
    acc    = float((y_pred == d['direction'].values[-test_rows:]).mean())

    feat_imp = dict(zip(FEATURE_COLS,
                        [round(float(v), 4) for v in clf.feature_importances_]))
    # Sort by importance
    feat_imp = dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True))

    return {
        'symbol':           latest.name if hasattr(latest, 'name') else '',
        'close':            round(close, 4),
        'prob_up':          round(prob_up, 4),
        'prob_down':        round(1 - prob_up, 4),
        'pred_magnitude_pct': round(pred_mag * 100, 3),
        'pred_magnitude_pts': round(pred_mag * close, 4),
        'atr':              round(atr, 4),
        'atr_pct':          round(atr / close * 100, 3),
        'signal':           signal,
        'entry':            round(close, 4),
        'stop_long':        round(close - 1.5 * atr, 4),
        'target_long':      round(close + abs(pred_mag) * close, 4),
        'stop_short':       round(close + 1.5 * atr, 4),
        'target_short':     round(close - abs(pred_mag) * close, 4),
        'risk_per_unit':    round(1.5 * atr, 4),
        'reward_per_unit':  round(abs(pred_mag) * close, 4),
        'rr_ratio':         round(abs(pred_mag) * close / (1.5 * atr + 1e-9), 2),
        'backtest_accuracy': round(acc, 4),
        'feature_importance': feat_imp,
        'timestamp':        datetime.now().isoformat()
    }


# ── Cache (simple in-memory) ─────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 240  # seconds (4 minutes — refresh every 4H bar roughly)

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


# ── Routes ───────────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.now().isoformat()})


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

    # Add futures-specific multiplier info
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
            cache_set(ck, res)
            results[sym] = res
        else:
            results[sym] = {'error': 'model failed'}
    return jsonify(results)


# ── Upgrade path: Interactive Brokers ───────────────────────────────────────
"""
To connect Interactive Brokers instead of yfinance:

pip install ib_insync

from ib_insync import IB, Stock, Future, util

ib = IB()
ib.connect('127.0.0.1', 7497, clientId=1)   # TWS on port 7497

# Fetch historical 1H bars
contract = Stock('AAPL', 'SMART', 'USD')
bars = ib.reqHistoricalData(
    contract,
    endDateTime='',
    durationStr='30 D',
    barSizeSetting='1 hour',
    whatToShow='MIDPOINT',
    useRTH=True
)
df = util.df(bars)

# Replace get_4h_candles() above with this data
"""


if __name__ == '__main__':
    print("=" * 55)
    print("  Live ML Trading Server  — http://localhost:5050")
    print("=" * 55)
    print("  Data source : yfinance (15-min delayed)")
    print("  Upgrade to  : Interactive Brokers ib_insync")
    print()
    print("  GET /api/candles/<symbol>   — 4H OHLCV candles")
    print("  GET /api/signal/<symbol>    — ML direction + magnitude")
    print("  GET /api/symbols            — available symbols list")
    print("  GET /api/multi/AAPL,ES=F    — batch signals")
    print("=" * 55)
    app.run(host='0.0.0.0', port=5050, debug=False, threaded=True)
