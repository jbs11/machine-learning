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
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request
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
}

FUTURES_MULTIPLIERS = {
    'ES=F': 50,
    'NQ=F': 20,
    'CL=F': 1000,
    'GC=F': 100,
    'SI=F': 5000,
    'ZB=F': 1000,
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

    # 1) Try IBKR live data (skip for indices — not standard IBKR contracts)
    if symbol not in INDEX_SYMBOLS:
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
    all_probs   = clf.predict_proba(X_sc)[:, 1]
    all_signals = np.where(all_probs >= buy_thresh, 'BUY',
                  np.where(all_probs <= sell_thresh, 'SELL', 'HOLD'))

    # Convert DatetimeIndex to Unix seconds
    try:
        unix_ts = d.index.astype(np.int64) // 10 ** 9
    except Exception:
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
    return jsonify({'cleared': count, 'time': datetime.now().isoformat()})


@app.route('/api/symbols')
def symbols():
    return jsonify({**SYMBOLS, 'labels': SYMBOL_LABELS})


@app.route('/api/candles/<symbol>')
def candles(symbol: str):
    symbol  = symbol.upper()
    period  = request.args.get('period', '90d')
    nocache = request.args.get('nocache', '0') == '1'
    ck      = cache_key(symbol, f'candles:{period}')
    if not nocache:
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


# ── Market Summary helpers ────────────────────────────────────────────────────
def quick_signal(symbol: str, asset_type: str) -> dict | None:
    """
    Lightweight signal for batch/summary use — 100-tree GBM only, no CV,
    no ExtraTrees.  Uses the in-memory cache when available.
    """
    ck = cache_key(symbol, 'signal')
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
    """Auto-generate market events and insights from ML signal data."""
    notes = []
    all_r = list(sym_results.values())

    # ── VIX analysis ──────────────────────────────────────────────────────────
    vix = sym_results.get('^VIX')
    if vix:
        vc = vix.get('close', 20)
        vs = vix.get('signal', 'HOLD')
        if vc >= 30:
            notes.append({'type': 'danger', 'icon': '⚠',
                'title': f'VIX Extreme Fear ({vc:.1f})',
                'body':  'VIX above 30 — high fear. Options premiums very expensive. '
                         'Reduce leverage, widen stops. Contrarian long opportunities may emerge near capitulation.'})
        elif vc >= 20:
            notes.append({'type': 'warning', 'icon': '📊',
                'title': f'Elevated VIX ({vc:.1f}) — Options Premium Inflated',
                'body':  f'VIX at {vc:.1f}: above-average fear. Favor credit spreads / iron condors '
                         f'over debit spreads. ML signal for VIX: {vs}.'})
        elif vc < 13:
            notes.append({'type': 'info', 'icon': '😴',
                'title': f'Low VIX Complacency ({vc:.1f})',
                'body':  'VIX below 13 — complacency; cheap options. Good time to buy protection. '
                         'Low-vol regimes end abruptly — stay hedged.'})
        if vs == 'BUY':
            notes.append({'type': 'warning', 'icon': '🔺',
                'title': 'VIX Breakout — Volatility Expansion Expected',
                'body':  'ML signals VIX moving higher. Expect wider intraday swings. '
                         'Scale down position sizes and consider long-vol strategies (straddles, strangles).'})
        elif vs == 'SELL':
            notes.append({'type': 'bullish', 'icon': '📉',
                'title': 'VIX Declining — Fear Subsiding',
                'body':  'ML signals VIX dropping. Risk-on environment expected. '
                         'Selling premium strategies (iron condors, covered calls) benefit from declining vol.'})

    # ── Index futures direction ────────────────────────────────────────────────
    es = sym_results.get('ES=F')
    nq = sym_results.get('NQ=F')
    if es and nq:
        es_s, nq_s = es.get('signal'), nq.get('signal')
        if es_s == 'BUY' and nq_s == 'BUY':
            notes.append({'type': 'bullish', 'icon': '🚀',
                'title': 'Index Futures: Broad Bullish Setup',
                'body':  f'ES P(UP)={es["prob_up"]*100:.0f}% (BUY), NQ P(UP)={nq["prob_up"]*100:.0f}% (BUY). '
                         f'Broad upside expected — favor longs across stocks & ETFs. '
                         f'Magnitude forecast: ES {es["pred_magnitude_pct"]:+.2f}%, NQ {nq["pred_magnitude_pct"]:+.2f}%.'})
        elif es_s == 'SELL' and nq_s == 'SELL':
            notes.append({'type': 'bearish', 'icon': '🌧',
                'title': 'Index Futures: Broad Bearish Setup',
                'body':  f'ES P(UP)={es["prob_up"]*100:.0f}% (SELL), NQ P(UP)={nq["prob_up"]*100:.0f}% (SELL). '
                         f'Broad downside — reduce long exposure, consider hedges. '
                         f'Risk per ES contract: ${es.get("risk_dollars","—")}.'})
        elif es_s != nq_s:
            notes.append({'type': 'info', 'icon': '🔄',
                'title': 'S&P vs NASDAQ Divergence — Sector Rotation',
                'body':  f'ES is {es_s} while NQ is {nq_s}. Divergence suggests rotation '
                         f'between value (S&P heavy) and growth (NASDAQ heavy). Watch sector ETFs.'})

    # ── Gold / Oil signals ─────────────────────────────────────────────────────
    gc = sym_results.get('GC=F')
    cl = sym_results.get('CL=F')
    if gc and gc.get('signal') == 'BUY':
        notes.append({'type': 'info', 'icon': '🥇',
            'title': f'Gold Bullish — Safe-Haven Demand (P(UP)={gc["prob_up"]*100:.0f}%)',
            'body':  f'Gold futures ML signal: BUY. Forecast {gc["pred_magnitude_pct"]:+.2f}%. '
                     f'Rising gold signals inflation concerns or risk-off. Watch USD correlation.'})
    if cl and cl.get('signal') != 'HOLD':
        notes.append({'type': 'info', 'icon': '🛢',
            'title': f'Crude Oil: {cl["signal"]} (P(UP)={cl["prob_up"]*100:.0f}%)',
            'body':  f'WTI Crude forecast {cl["pred_magnitude_pct"]:+.2f}%. '
                     f'Oil moves impact energy stocks (XOM, CVX) and inflation expectations.'})

    # ── Market breadth ────────────────────────────────────────────────────────
    stk = [r for r in all_r if r.get('asset_type') in ('stock', 'index')]
    if stk:
        bp = sum(1 for r in stk if r.get('signal') == 'BUY')  / len(stk) * 100
        sp = sum(1 for r in stk if r.get('signal') == 'SELL') / len(stk) * 100
        if bp >= 70:
            notes.append({'type': 'bullish', 'icon': '📈',
                'title': f'Strong Bullish Breadth — {bp:.0f}% BUY',
                'body':  f'{bp:.0f}% of tracked stocks & indices show BUY signals — '
                         f'broad market participation. Favorable for momentum strategies.'})
        elif sp >= 70:
            notes.append({'type': 'bearish', 'icon': '📉',
                'title': f'Strong Bearish Breadth — {sp:.0f}% SELL',
                'body':  f'{sp:.0f}% of tracked stocks & indices show SELL signals — '
                         f'widespread selling pressure. Defensive positioning recommended.'})

    # ── High-vol regime stocks ────────────────────────────────────────────────
    hv = [r for r in all_r if r.get('vol_regime') == 2 and r.get('asset_type') == 'stock']
    if len(hv) >= 3:
        top_hv = ', '.join(r['symbol'] for r in sorted(hv, key=lambda x: x.get('atr_pct', 0), reverse=True)[:6])
        notes.append({'type': 'warning', 'icon': '⚡',
            'title': f'Elevated Volatility: {len(hv)} Stocks in High-Vol Regime',
            'body':  f'ATR well above recent history: {top_hv}. '
                     f'Use 1.5–2× wider stops and smaller position sizes to keep dollar risk constant.'})

    # ── Unusual volume ────────────────────────────────────────────────────────
    high_act = [r for r in all_r if r.get('vol_ratio', 1) > 2.0]
    if high_act:
        syms = ', '.join(f'{r["symbol"]} ({r["vol_ratio"]:.1f}×)' for r in
                         sorted(high_act, key=lambda x: x.get('vol_ratio', 1), reverse=True)[:5])
        notes.append({'type': 'info', 'icon': '🔥',
            'title': 'Unusual Trading Volume',
            'body':  f'Volume significantly above 20-bar average: {syms}. '
                     f'High volume often precedes breakouts or reversals — confirm price action before entering.'})

    # ── Mag 7 consensus ───────────────────────────────────────────────────────
    m7 = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA']
    m7r = [sym_results[s] for s in m7 if s in sym_results]
    if m7r:
        mb = sum(1 for r in m7r if r.get('signal') == 'BUY')
        ms = sum(1 for r in m7r if r.get('signal') == 'SELL')
        if mb >= 5:
            notes.append({'type': 'bullish', 'icon': '💎',
                'title': f'Mag 7 Bullish Consensus ({mb}/7 BUY)',
                'body':  f'{mb} of 7 mega-cap tech stocks show BUY — '
                         f'tech sector leading the rally. QQQ and NQ futures likely to follow.'})
        elif ms >= 5:
            notes.append({'type': 'bearish', 'icon': '💔',
                'title': f'Mag 7 Bearish Consensus ({ms}/7 SELL)',
                'body':  f'{ms} of 7 mega-cap tech stocks show SELL — '
                         f'tech headwinds dragging on indices. QQQ and NQ likely underperformers.'})

    # ── Largest magnitude forecast ─────────────────────────────────────────────
    top_mag = max(all_r, key=lambda r: abs(r.get('pred_magnitude_pct', 0)), default=None)
    if top_mag and abs(top_mag.get('pred_magnitude_pct', 0)) > 0.8:
        m = top_mag['pred_magnitude_pct']
        tgt = top_mag['target_long'] if m > 0 else top_mag['target_short']
        stp = top_mag['stop_long']   if m > 0 else top_mag['stop_short']
        notes.append({'type': 'bullish' if m > 0 else 'bearish', 'icon': '🎯',
            'title': f'Largest Forecast Move: {top_mag["symbol"]} ({m:+.2f}%)',
            'body':  f'{top_mag["label"]} — ML signal: {top_mag["signal"]} '
                     f'(P(UP)={top_mag["prob_up"]*100:.0f}%). '
                     f'Entry ${top_mag["entry"]}, stop ${stp}, target ${tgt}. R/R {top_mag["rr_ratio"]:.1f}:1.'})

    # ── Options context note ──────────────────────────────────────────────────
    opt_r = [r for r in all_r if r.get('asset_type') == 'options']
    if opt_r:
        vix_val = vix.get('close', 20) if vix else 20
        strategy = ('credit spreads / iron condors (sell premium)' if vix_val > 20
                    else 'debit spreads / directional options (buy premium)')
        hv_opts = sum(1 for r in opt_r if r.get('vol_regime') == 2)
        notes.append({'type': 'info', 'icon': '📋',
            'title': 'Options Strategy Context',
            'body':  f'VIX at {vix_val:.1f} — environment favors <strong>{strategy}</strong>. '
                     f'{hv_opts}/{len(opt_r)} options underlyings in high-vol regime. '
                     f'Always check IV rank: IV > 50th pct → sell; IV < 30th pct → buy.'})

    if not notes:
        notes.append({'type': 'info', 'icon': 'ℹ',
            'title': 'Signals Computing',
            'body':  'Loading fresh signals for all assets — check back in a moment.'})
    return notes


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

    results: dict[str, dict] = {}

    def fetch_one(key: str) -> tuple[str, dict | None]:
        sym, group, atype = sym_map[key]
        r = quick_signal(sym, atype)
        if r:
            r['group'] = group
        return key, r

    with ThreadPoolExecutor(max_workers=6) as ex:
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

    notes = generate_market_notes(sym_results)

    return jsonify({
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
        'symbols_computed':   len(results),
        'timestamp':          datetime.now().isoformat(),
    })


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
    app.run(host='0.0.0.0', port=5050, debug=False, threaded=True)
