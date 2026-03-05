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
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request, send_from_directory
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

# ETF proxies for futures GEX (yfinance has no futures options chains)
_FUTURES_PROXY_MAP = {
    'ES=F': 'SPY',   # S&P 500 E-mini → SPDR S&P 500 ETF
    'NQ=F': 'QQQ',   # Nasdaq E-mini → Invesco QQQ ETF
    'CL=F': 'USO',   # Crude Oil WTI → US Oil Fund ETF
    'GC=F': 'GLD',   # Gold → SPDR Gold Shares ETF
    'SI=F': 'SLV',   # Silver → iShares Silver Trust ETF
    'ZB=F': 'TLT',   # 30-Yr T-Bond → iShares 20+ Year Treasury ETF
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


# ── Static website serving ────────────────────────────────────────────────────
_WEBSITE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'website')

@app.route('/')
def index():
    return send_from_directory(_WEBSITE_DIR, 'live-trading.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(_WEBSITE_DIR, filename)


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
        'world_events':       world_events,
        'ml_ranking':         ml_ranking,
        'market_commentary':  market_commentary,
        'symbols_computed':   len(results),
        'timestamp':          datetime.now().isoformat(),
    })


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
    try:
        ticker = yf.Ticker(symbol)

        # ── Spot price ─────────────────────────────────────────────────────────
        try:
            spot = float(ticker.fast_info.last_price)
        except Exception:
            h = ticker.history(period='2d')
            spot = float(h['Close'].iloc[-1]) if not h.empty else 0.0
        if not spot or spot <= 0:
            return None

        # ── Options expiries ───────────────────────────────────────────────────
        try:
            expiries = ticker.options
        except Exception:
            expiries = []

        if not expiries:
            # ── Try ETF proxy for futures symbols ──────────────────────────────
            proxy_sym = _FUTURES_PROXY_MAP.get(symbol)
            if proxy_sym:
                try:
                    proxy_tk = yf.Ticker(proxy_sym)
                    proxy_expiries = proxy_tk.options
                    if proxy_expiries:
                        try:
                            proxy_spot = float(proxy_tk.fast_info.last_price)
                        except Exception:
                            ph = proxy_tk.history(period='2d')
                            proxy_spot = float(ph['Close'].iloc[-1]) if not ph.empty else 0.0
                        if proxy_spot > 0:
                            scale = spot / proxy_spot   # e.g., ES=F/SPY ≈ 10×
                            today  = datetime.now().date()
                            R      = 0.05
                            p_tgt  = []
                            for exp in proxy_expiries:
                                try:
                                    dte = (datetime.strptime(exp, '%Y-%m-%d').date() - today).days
                                    if 0 < dte <= 60:
                                        p_tgt.append((exp, max(dte, 1)))
                                except Exception:
                                    continue
                                if len(p_tgt) >= 3:
                                    break
                            if not p_tgt and proxy_expiries:
                                p_tgt = [(proxy_expiries[0], 1)]
                            if p_tgt:
                                gex_by_k, coi_by_k, poi_by_k = {}, {}, {}
                                lo, hi = spot * 0.85, spot * 1.15
                                for exp, dte in p_tgt:
                                    T = max(dte / 365.0, 1 / 365.0)
                                    try:
                                        chain = proxy_tk.option_chain(exp)
                                    except Exception:
                                        continue
                                    calls, puts = chain.calls.copy(), chain.puts.copy()
                                    for _, crow in calls.iterrows():
                                        K = float(crow['strike']) * scale
                                        if not (lo <= K <= hi):
                                            continue
                                        OI = int(crow.get('openInterest') or 0)
                                        IV = float(crow.get('impliedVolatility') or 0)
                                        if OI <= 0 or IV <= 0 or IV > 5:
                                            continue
                                        g = _bs_gamma(spot, K, T, R, IV)
                                        gex_by_k[K] = gex_by_k.get(K, 0.0) + g * OI * 100 * spot
                                        coi_by_k[K] = coi_by_k.get(K, 0) + OI
                                    for _, prow in puts.iterrows():
                                        K = float(prow['strike']) * scale
                                        if not (lo <= K <= hi):
                                            continue
                                        OI = int(prow.get('openInterest') or 0)
                                        IV = float(prow.get('impliedVolatility') or 0)
                                        if OI <= 0 or IV <= 0 or IV > 5:
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
                    print(f'[gex proxy] {symbol} → {proxy_sym}: {e}')
            # No proxy available — mark as no_options
            row = {'symbol': symbol, 'label': SYMBOL_LABELS.get(symbol, symbol),
                   'group': group, 'asset_type': _asset_type_for(symbol),
                   'spot': round(spot, 4), 'no_options': True}
            cache_set(ck, row)
            return row

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
            return None

        gex_by_k, coi_by_k, poi_by_k = {}, {}, {}

        for exp, dte in target:
            T = max(dte / 365.0, 1 / 365.0)
            try:
                chain = ticker.option_chain(exp)
            except Exception:
                continue
            calls, puts = chain.calls.copy(), chain.puts.copy()

            # Limit to ±15% of spot
            lo, hi = spot * 0.85, spot * 1.15
            calls = calls[(calls['strike'] >= lo) & (calls['strike'] <= hi)]
            puts  = puts [(puts['strike']  >= lo) & (puts['strike']  <= hi)]

            for _, row in calls.iterrows():
                K  = float(row['strike'])
                OI = int(row.get('openInterest') or 0)
                IV = float(row.get('impliedVolatility') or 0)
                if OI <= 0 or IV <= 0 or IV > 5:
                    continue
                g = _bs_gamma(spot, K, T, R, IV)
                gex_by_k[K] = gex_by_k.get(K, 0.0) + g * OI * 100 * spot   # positive
                coi_by_k[K] = coi_by_k.get(K, 0) + OI

            for _, row in puts.iterrows():
                K  = float(row['strike'])
                OI = int(row.get('openInterest') or 0)
                IV = float(row.get('impliedVolatility') or 0)
                if OI <= 0 or IV <= 0 or IV > 5:
                    continue
                g = _bs_gamma(spot, K, T, R, IV)
                gex_by_k[K] = gex_by_k.get(K, 0.0) - g * OI * 100 * spot   # negative
                poi_by_k[K] = poi_by_k.get(K, 0) + OI

        if not gex_by_k:
            return None

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
        return None


_GEX_GROUPS = [
    ('ETFs',        SYMBOLS['sp500']),
    ('Mag 7',       SYMBOLS['mag7']),
    ('Blue Chips',  SYMBOLS['bluechip']),
    ('Futures',     SYMBOLS['futures']),
]


@app.route('/api/gamma-exposure')
def gamma_exposure_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'gamma-exposure')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    all_items = [(sym, grp) for grp, syms in _GEX_GROUPS for sym in syms]
    rows = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {pool.submit(_gex_row, sym, grp, nocache): sym for sym, grp in all_items}
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                rows.append(r)

    grp_ord = {g: i for i, (g, _) in enumerate(_GEX_GROUPS)}
    rows.sort(key=lambda r: (grp_ord.get(r['group'], 99), r['symbol']))

    result = {'assets': rows, 'count': len(rows), 'timestamp': datetime.now().isoformat()}
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

    result = {'assets': rows, 'count': len(rows), 'timestamp': datetime.now().isoformat()}
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
    try:
        # ── Spot price ─────────────────────────────────────────────────────────
        with _yf_lock:
            ticker = yf.Ticker(symbol)
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
                vol = float(r.get('volume', 0) or 0)
                oi  = float(r.get('openInterest', 0) or 0)
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
                vol = float(r.get('volume', 0) or 0)
                oi  = float(r.get('openInterest', 0) or 0)
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

    result = {'assets': rows, 'count': len(rows), 'timestamp': datetime.now().isoformat()}
    cache_set(ck, result)
    return jsonify(result)


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

        # ── Recent News (last 5) ─────────────────────────────────────────
        news = []
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

_VOL_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'META', 'TSLA', 'AMZN', 'GOOGL']
_VOL_MONO_TARGETS = [0.80, 0.85, 0.90, 0.92, 0.95, 0.97, 1.00, 1.03, 1.05, 1.08, 1.10, 1.15, 1.20]


def _vol_row(symbol: str) -> dict | None:
    """Fetch option chains and compute IV surface data for one symbol."""
    try:
        from datetime import date as _date
        tk = yf.Ticker(symbol)

        hist = tk.history(period='35d', auto_adjust=True)
        if hist.empty or len(hist) < 2:
            return None
        spot = float(hist['Close'].iloc[-1])

        # 30-day historical volatility (annualised)
        log_rets = np.log(hist['Close'] / hist['Close'].shift(1)).dropna()
        hv30 = float(log_rets.std() * np.sqrt(252))

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

                term_structure.append({
                    'expiry':   exp_str,
                    'dte':      dte,
                    'atm_iv':   round(atm_iv, 4),
                    'call_iv':  round(call_iv_atm, 4),
                    'put_iv':   round(put_iv_atm, 4),
                    'skew':     skew_val,
                    'rr25':     rr25,
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

        # IV rank: front-month ATM IV position within surface range
        ivs     = [t['atm_iv'] for t in term_structure]
        iv_min  = min(ivs)
        iv_max  = max(ivs)
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


@app.route('/api/volatility-surface')
def volatility_surface_endpoint():
    nocache = request.args.get('nocache', '0') == '1'
    ck = cache_key('all', 'vol-surface')
    if not nocache:
        cached = cache_get(ck)
        if cached:
            return jsonify(cached)

    rows = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        futs = {pool.submit(_vol_row, sym): sym for sym in _VOL_SYMBOLS}
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                rows.append(r)

    rows.sort(key=lambda r: _VOL_SYMBOLS.index(r['symbol'])
              if r['symbol'] in _VOL_SYMBOLS else 99)

    result = {'assets': rows, 'count': len(rows), 'timestamp': datetime.now().isoformat()}
    cache_set(ck, result)
    return jsonify(result)


# ── Startup ───────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("  Live ML Trading Server  —  http://localhost:5050")
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

    app.run(host='0.0.0.0', port=5050, debug=False, threaded=True)
