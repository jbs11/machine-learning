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
    # auto_probe=False: only use IBKR if already connected (set via /api/ibkr-connect).
    # Never attempt a new connection here — each failed probe blocks 8 s per symbol.
    ib = get_ib_connection(auto_probe=False)
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
    # Use a fixed 0.58 / 0.42 threshold for annotations so arrows appear even in
    # high-vol regimes (where the trading threshold is 0.62 / 0.38).
    all_probs   = clf.predict_proba(X_sc)[:, 1]
    marker_buy  = 0.58
    marker_sell = 0.42
    all_signals = np.where(all_probs >= marker_buy,  'BUY',
                  np.where(all_probs <= marker_sell, 'SELL', 'HOLD'))

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

    notes = generate_market_notes(sym_results)

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
        'market_commentary':  market_commentary,
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
