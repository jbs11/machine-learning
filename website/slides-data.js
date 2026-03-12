'use strict';
// ── ML Course Slide Data ─────────────────────────────────────────────
// 33 lessons × 5 slides each across Modules 1-4
// Slide types: title | bullets | code | visual | summary
window.SLIDE_DATA = {

// ═══════════════════════════════════════════════════════════════════
// MODULE 1 — Trading & Markets Foundation
// ═══════════════════════════════════════════════════════════════════

'1.1': [
  { type:'title', badge:'MODULE 1', icon:'🏛️', heading:'How Financial Markets Work',
    sub:'Lesson 1.1 · Trading & Markets Foundation',
    note:'Learn the essential mechanics behind every financial market' },
  { type:'bullets', icon:'📋', heading:'What Is a Financial Market?',
    items:['A structured venue where buyers and sellers exchange financial assets','Price is determined by supply and demand in real time','Markets exist for stocks, bonds, commodities, forex and derivatives','Anyone can participate — from individual retail traders to trillion-dollar funds'] },
  { type:'bullets', icon:'⚙️', heading:'How Price Is Discovered',
    items:['Buyers post bids — the maximum price they will pay','Sellers post asks — the minimum price they will accept','When a bid meets an ask, a trade executes and a price is set','Market makers facilitate this process continuously, profiting from the spread'] },
  { type:'visual', icon:'🔄', heading:'The Market Ecosystem',
    html:'<div style="display:flex;flex-direction:column;align-items:center;gap:.7rem;padding:.8rem">'
      + '<div style="display:flex;align-items:center;gap:.8rem">'
      + '<div class="csp-vbox" style="background:rgba(34,211,238,.1);border-color:rgba(34,211,238,.3)">🛒 Buyers<br><small style="color:#666">bids</small></div>'
      + '<div style="color:#22d3ee;font-size:1.4rem;font-weight:900">⇄</div>'
      + '<div class="csp-vbox">📊 Exchange<br><small style="color:#666">matching engine</small></div>'
      + '<div style="color:#22d3ee;font-size:1.4rem;font-weight:900">⇄</div>'
      + '<div class="csp-vbox" style="background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3)">💰 Sellers<br><small style="color:#666">asks</small></div>'
      + '</div>'
      + '<div style="color:#555;font-size:1.2rem">↕</div>'
      + '<div class="csp-vbox" style="width:240px;text-align:center">📋 Order Book → Price Discovery</div>'
      + '</div>',
    note:'Every market price is the result of this continuous negotiation' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Markets are price-discovery mechanisms driven by supply and demand','Institutional and retail participants create the flow that moves prices','Market makers provide liquidity and profit from the bid-ask spread','Understanding who trades and why is your foundational trading edge'] }
],

'1.2': [
  { type:'title', badge:'MODULE 1', icon:'👥', heading:'Market Participants',
    sub:'Lesson 1.2 · Who You\'re Trading Against',
    note:'Know your counterparty — it changes everything about your strategy' },
  { type:'bullets', icon:'🏦', heading:'The Major Player Types',
    items:['Retail traders (you): small size, fast in/out, noise-creators in the market','Institutional investors: pension funds and mutual funds with long-term horizons','Hedge funds: aggressive, leveraged, active short sellers — the most dangerous counterparty','Market makers: provide liquidity 24/7, profit from bid-ask spread, never lose long-term'] },
  { type:'bullets', icon:'📊', heading:'How Institutions Move Markets',
    items:['90%+ of daily volume comes from institutions, HFTs, and market makers','Large funds must accumulate over days or weeks — they cannot hide their footprint','Dark pool trades and block orders signal large institutional positioning','Order flow imbalance — more buyers than sellers — is the real price driver'] },
  { type:'visual', icon:'⚖️', heading:'Participant Volume Breakdown',
    html:'<div style="padding:.5rem 1rem">'
      + '<div style="margin-bottom:.5rem;font-size:.72rem;color:#888">Approximate daily equity volume share:</div>'
      + '<div style="display:flex;flex-direction:column;gap:.4rem">'
      + '<div style="display:flex;align-items:center;gap:.5rem"><div style="width:65%;height:22px;background:rgba(239,68,68,.3);border-radius:3px;display:flex;align-items:center;padding-left:.5rem;font-size:.72rem">HFT &amp; Market Makers ~65%</div></div>'
      + '<div style="display:flex;align-items:center;gap:.5rem"><div style="width:25%;height:22px;background:rgba(167,139,250,.3);border-radius:3px;display:flex;align-items:center;padding-left:.5rem;font-size:.72rem">Institutions ~25%</div></div>'
      + '<div style="display:flex;align-items:center;gap:.5rem"><div style="width:10%;height:22px;background:rgba(34,211,238,.3);border-radius:3px;display:flex;align-items:center;padding-left:.5rem;font-size:.72rem;white-space:nowrap">Retail ~10%</div></div>'
      + '</div></div>',
    note:'Retail traders are price-takers, not price-makers' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Institutions move markets — retail follows the trail they leave behind','Market makers always win — their edge is the spread, not directional bets','Large funds cannot hide: their footprints appear in volume and order flow','Align with institutional flow rather than fighting it'] }
],

'1.3': [
  { type:'title', badge:'MODULE 1', icon:'📋', heading:'Order Types and Order Flow',
    sub:'Lesson 1.3 · Trading & Markets Foundation',
    note:'The four order types every trader must master before entering a single trade' },
  { type:'bullets', icon:'📌', heading:'The Four Essential Order Types',
    items:['Market order: execute immediately at the best available price (fast, but no price guarantee)','Limit order: execute only at your specified price or better (you control the price)','Stop order: triggers a market order when price reaches your stop level (loss protection)','Stop-limit: combines stop trigger with a limit — guarantees price but not execution'] },
  { type:'bullets', icon:'🔄', heading:'How Orders Flow Through the Market',
    items:['Your order goes from broker → exchange matching engine in milliseconds','The matching engine pairs buyers and sellers by price and time priority (FIFO)','Dark pools allow large institutional blocks to trade off-exchange (avoid market impact)','Payment for order flow (PFOF) means retail orders are often routed to market makers'] },
  { type:'code', icon:'💻', heading:'Order Submission in Python (Alpaca API)',
    code:'import alpaca_trade_api as tradeapi\napi = tradeapi.REST(KEY, SECRET, BASE_URL)\n\n# Market order — executes immediately\napi.submit_order(\n    symbol="SPY", qty=10, side="buy",\n    type="market", time_in_force="day"\n)\n\n# Limit order — only fills at $430 or better\napi.submit_order(\n    symbol="SPY", qty=10, side="buy",\n    type="limit", limit_price=430.00,\n    time_in_force="gtc"\n)',
    note:'GTC = Good Till Cancelled — order stays open until filled or manually cancelled' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Always use limit orders for entries — control your price, not just your direction','Market orders guarantee execution but not price — dangerous in low-liquidity conditions','A stop-loss is not optional — it is the first thing you set, before the entry','Understanding order flow reveals where institutions are entering and exiting positions'] }
],

'1.4': [
  { type:'title', badge:'MODULE 1', icon:'📊', heading:'Reading Price Charts',
    sub:'Lesson 1.4 · OHLCV and Candlesticks',
    note:'Candlestick charts are the universal language of price action' },
  { type:'bullets', icon:'🕯️', heading:'OHLCV — The Five Data Points',
    items:['O = Open: the first traded price of the period','H = High: the highest price reached during the period','L = Low: the lowest price reached during the period','C = Close: the last traded price (most important data point)','V = Volume: total number of shares or contracts traded in the period'] },
  { type:'visual', icon:'🕯️', heading:'Anatomy of a Candlestick',
    html:'<div style="display:flex;justify-content:center;gap:3rem;align-items:flex-end;padding:.5rem 0">'
      + '<div style="display:flex;flex-direction:column;align-items:center;gap:.2rem">'
      + '<div style="font-size:.65rem;color:#888">HIGH</div>'
      + '<div style="width:2px;height:20px;background:#4ade80"></div>'
      + '<div style="width:28px;height:50px;background:#4ade80;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#000;font-weight:700">+</div>'
      + '<div style="width:2px;height:12px;background:#4ade80"></div>'
      + '<div style="font-size:.65rem;color:#888">LOW</div>'
      + '<div style="font-size:.65rem;color:#4ade80;margin-top:.3rem;font-weight:700">BULLISH</div>'
      + '<div style="font-size:.6rem;color:#666">Close &gt; Open</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:center;gap:.2rem">'
      + '<div style="font-size:.65rem;color:#888">HIGH</div>'
      + '<div style="width:2px;height:15px;background:#ef4444"></div>'
      + '<div style="width:28px;height:50px;background:#ef4444;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#fff;font-weight:700">−</div>'
      + '<div style="width:2px;height:22px;background:#ef4444"></div>'
      + '<div style="font-size:.65rem;color:#888">LOW</div>'
      + '<div style="font-size:.65rem;color:#ef4444;margin-top:.3rem;font-weight:700">BEARISH</div>'
      + '<div style="font-size:.6rem;color:#666">Close &lt; Open</div>'
      + '</div>'
      + '</div>' },
  { type:'bullets', icon:'📈', heading:'Key Chart Pattern Concepts',
    items:['Uptrend: series of higher highs and higher lows — buyers are in control','Downtrend: series of lower highs and lower lows — sellers are in control','Range: price oscillates between support and resistance — indecision','Breakout: price escapes an established range, ideally on high volume — a new trend begins'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Candlesticks show the battle between buyers and bears in each period','The close is the most important price — it reflects final consensus','Higher volume on a candle adds conviction to the move it represents','Start with the daily timeframe to understand trend before zooming into entries'] }
],

'1.5': [
  { type:'title', badge:'MODULE 1', icon:'⚡', heading:'Understanding Options',
    sub:'Lesson 1.5 · Calls, Puts, and the Greeks',
    note:'Options give you rights — not obligations — and that changes everything about risk' },
  { type:'bullets', icon:'📄', heading:'What Is an Options Contract?',
    items:['A contract giving the right (not obligation) to buy or sell an asset','Call option: the right to BUY the underlying asset at the strike price','Put option: the right to SELL the underlying asset at the strike price','You pay a premium upfront — your maximum loss is always limited to the premium paid'] },
  { type:'bullets', icon:'🔢', heading:'The 5 Greeks — Quick Reference',
    items:['Delta (Δ): how much the option price moves per $1 move in the underlying stock','Gamma (Γ): rate of change of delta — highest for at-the-money options near expiry','Theta (Θ): daily time decay — options lose value every single day you hold them','Vega (V): sensitivity to implied volatility — IV up = option value up (for buyers)'] },
  { type:'visual', icon:'📈', heading:'Call Option Payoff Profile',
    html:'<div style="padding:.5rem 1rem">'
      + '<div style="font-size:.7rem;color:#888;margin-bottom:.3rem">Long Call P&amp;L at expiration:</div>'
      + '<svg width="100%" height="100" viewBox="0 0 300 100" style="overflow:visible">'
      + '<line x1="0" y1="70" x2="300" y2="70" stroke="#333" stroke-width="1"/>'
      + '<line x1="150" y1="0" x2="150" y2="100" stroke="#333" stroke-width="1" stroke-dasharray="4"/>'
      + '<polyline points="0,85 120,85 200,15 300,15" fill="none" stroke="#4ade80" stroke-width="2.5"/>'
      + '<text x="145" y="95" fill="#888" font-size="9" text-anchor="middle">Strike Price</text>'
      + '<text x="5" y="83" fill="#ef4444" font-size="9">-Premium</text>'
      + '<text x="220" y="12" fill="#4ade80" font-size="9">Profit ↑</text>'
      + '<text x="245" y="65" fill="#888" font-size="8">Break-even</text>'
      + '</svg>'
      + '</div>',
    note:'Max loss = premium paid. Profit is theoretically unlimited as price rises.' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Options provide leverage with defined maximum risk (the premium paid)','Calls profit when price rises; puts profit when price falls','Theta works against option buyers every day — time is always costing you','Match your options strategy precisely to your market outlook and timeframe'] }
],

'1.6': [
  { type:'title', badge:'MODULE 1', icon:'🕐', heading:'Key Market Times & Calendar Events',
    sub:'Lesson 1.6 · Trading & Markets Foundation',
    note:'When you trade matters as much as what you trade' },
  { type:'bullets', icon:'🗓️', heading:'Market Session Schedule (Eastern Time)',
    items:['Pre-market: 4:00 AM – 9:30 AM (thin liquidity, news-driven, volatile gaps)','Regular session: 9:30 AM – 4:00 PM (main liquidity, tightest spreads)','Power hours: 9:30–10:30 AM and 3:00–4:00 PM (highest volume and volatility)','After-hours: 4:00 PM – 8:00 PM (earnings reactions, low liquidity)'] },
  { type:'bullets', icon:'📅', heading:'High-Impact Calendar Events',
    items:['FOMC meetings: Federal Reserve rate decisions move the entire equity market','CPI / PPI releases: inflation data drives rates expectations and equity sentiment','Non-Farm Payrolls (NFP): monthly jobs report — released first Friday of every month','Earnings seasons: quarterly company reports drive large individual stock moves'] },
  { type:'visual', icon:'⏱️', heading:'Trading Day Timeline',
    html:'<div style="padding:.8rem 1rem">'
      + '<div style="display:flex;height:28px;border-radius:4px;overflow:hidden;font-size:.65rem;margin-bottom:.5rem">'
      + '<div style="background:rgba(239,68,68,.25);width:22%;display:flex;align-items:center;justify-content:center;border-right:1px solid #333">Pre-Market</div>'
      + '<div style="background:rgba(34,211,238,.25);width:55%;display:flex;align-items:center;justify-content:center;border-right:1px solid #333;font-weight:700">Regular Session 9:30–4:00 PM</div>'
      + '<div style="background:rgba(167,139,250,.25);width:23%;display:flex;align-items:center;justify-content:center">After-Hours</div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:.62rem;color:#555">'
      + '<span>4 AM</span><span>9:30 AM</span><span style="color:#22d3ee;font-weight:700">⚡ Power Hour</span><span>3 PM</span><span>4 PM</span><span>8 PM</span>'
      + '</div>'
      + '</div>',
    note:'Avoid the first 15 minutes unless you have a well-tested edge in the open' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['The 9:30–10:30 AM window has the highest volume and biggest moves of the day','Pre-market gaps often fill during the regular session — a reliable tendency','Check the economic calendar every morning before placing any trades','Options premiums expand before major events (IV expansion) and collapse after (IV crush)'] }
],

'1.7': [
  { type:'title', badge:'MODULE 1', icon:'🛡️', heading:'Risk Management Fundamentals',
    sub:'Lesson 1.7 · Trading & Markets Foundation',
    note:'Protecting capital is more important than making money — survival comes first' },
  { type:'bullets', icon:'📏', heading:'The Core Risk Rules',
    items:['Never risk more than 1-2% of your total account on a single trade','Always define your stop-loss level BEFORE entering the trade — not after','Position size = (Account × Risk %) divided by (Entry price − Stop price)','Consistency beats home runs — protect your capital so you can trade another day'] },
  { type:'code', icon:'🧮', heading:'Position Size Calculator in Python',
    code:'# Position Sizing Formula\naccount_size = 25000   # total account value\nrisk_pct     = 0.01    # risk 1% per trade\nentry_price  = 435.20  # SPY entry\nstop_price   = 431.00  # stop-loss level\n\nrisk_per_share = entry_price - stop_price      # $4.20\nmax_loss       = account_size * risk_pct       # $250\nshares         = int(max_loss / risk_per_share) # 59 shares\n\nprint(f"Max risk: ${max_loss:.2f}")\nprint(f"Shares to buy: {shares}")',
    note:'Always calculate position size BEFORE entering — make it a non-negotiable habit' },
  { type:'bullets', icon:'⚖️', heading:'Understanding Risk-to-Reward Ratio',
    items:['Minimum R:R of 2:1 — risk $1 to make $2 (you only need to be right 34% of the time)','At 50% win rate with 2:1 R:R you are solidly profitable long-term','Even a 40% win rate is profitable at 3:1 R:R — most traders focus on the wrong metric','Track your average win/loss dollar ratio — it matters more than win percentage'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Survival first, profits second — never let a bad trade destroy your account','Position sizing is more important than your entry timing or indicator signals','Define maximum loss per trade AND a maximum daily loss before you open the platform','A disciplined risk system is what separates professionals from gamblers'] }
],

// ═══════════════════════════════════════════════════════════════════
// MODULE 2 — Python for Traders
// ═══════════════════════════════════════════════════════════════════

'2.1': [
  { type:'title', badge:'MODULE 2', icon:'💻', heading:'Environment Setup',
    sub:'Lesson 2.1 · Python, Jupyter, and VS Code',
    note:'A professional-grade setup takes 30 minutes and saves you hours every week' },
  { type:'bullets', icon:'📦', heading:'What You Need to Install',
    items:['Python 3.10+ — the programming language (download from python.org)','pip / conda — package manager to install trading and ML libraries','Jupyter Notebook — interactive code cells, ideal for research and analysis','VS Code — full IDE for production scripts with Git integration and debugging'] },
  { type:'code', icon:'⚡', heading:'Install Your Trading Python Stack',
    code:'# Create an isolated virtual environment first\npython -m venv trading_env\ntrading_env\\Scripts\\activate  # Windows\n\n# Install the core trading and ML stack\npip install pandas numpy yfinance matplotlib\npip install scikit-learn xgboost plotly\npip install jupyter notebook\n\n# Verify installation\npython -c "import pandas; print(pandas.__version__)"',
    note:'Always use a virtual environment — keep each project\'s dependencies isolated' },
  { type:'bullets', icon:'🗃️', heading:'Your Core Python Trading Stack',
    items:['pandas — data manipulation and time-series operations (your most-used library)','numpy — numerical computing, fast array math operations','yfinance — free historical and near-live market data from Yahoo Finance','scikit-learn — machine learning algorithms; xgboost — gradient boosting (your best model)'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Use a virtual environment for every project — never install globally','Jupyter is best for exploration and research; VS Code for production scripts','Install all libraries once into your venv — import only what each script needs','Set up Git version control from day one — commit your code after every session'] }
],

'2.2': [
  { type:'title', badge:'MODULE 2', icon:'🐍', heading:'Python Basics for Traders',
    sub:'Lesson 2.2 · Zero to Functional',
    note:'You only need 20% of Python to do 80% of trading and ML work' },
  { type:'bullets', icon:'📝', heading:'The Essentials — Data Types and Control Flow',
    items:['Variables: price = 435.20, symbol = "SPY", shares = 100, is_long = True','Lists: prices = [430, 432, 431, 435] — ordered, indexed from 0, -1 is last','Dictionaries: position = {"symbol":"SPY","qty":50,"entry":430.00}','If/elif/else, for loops, while loops — the logic building blocks'] },
  { type:'code', icon:'💻', heading:'Trader-Relevant Python Patterns',
    code:'prices = [430.00, 431.50, 429.80, 435.20, 434.00]\n\n# Calculate daily returns\nreturns = [(prices[i]-prices[i-1])/prices[i-1]\n           for i in range(1, len(prices))]\n\n# Filter only positive return days\nup_days = [r for r in returns if r > 0]\n\n# Simple moving average function\ndef sma(data, period):\n    return [sum(data[i:i+period])/period\n            for i in range(len(data)-period+1)]\n\nprint(sma(prices, 3))  # [430.43, 432.17, 433.0]',
    note:'List comprehensions are Pythonic — learn them early, they appear everywhere' },
  { type:'bullets', icon:'🧠', heading:'Thinking Like a Trader in Code',
    items:['Prices are lists or arrays — index 0 is the oldest, -1 is the most recent','Returns = (price_today - price_yesterday) / price_yesterday','For loops process historical data row by row — essential for backtesting','Write functions for every indicator you use more than once — reusability is everything'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Python reads top-to-bottom — execution order matters, especially in backtests','Lists and dictionaries are your most-used data structures for market data','Write functions for anything you use more than twice — DRY (Don\'t Repeat Yourself)','Practice by coding simple indicators manually before relying on library functions'] }
],

'2.3': [
  { type:'title', badge:'MODULE 2', icon:'🐼', heading:'Pandas — The Trader\'s Data Engine',
    sub:'Lesson 2.3 · Zero to Functional',
    note:'If Python is the language of trading, pandas is the grammar' },
  { type:'bullets', icon:'📊', heading:'Why pandas Is Essential for Trading',
    items:['DataFrame: a 2D table where rows = time periods, columns = OHLCV data','DatetimeIndex: pandas handles time-series natively — slicing, resampling, shifting','Vectorized operations run on entire columns instantly — no slow Python loops needed','Load CSV, JSON, Excel files or live API data in a single line of code'] },
  { type:'code', icon:'💻', heading:'Essential pandas Operations for Trading',
    code:'import pandas as pd\nimport yfinance as yf\n\ndf = yf.download("SPY", period="1y")\n\n# Daily returns\ndf["return"] = df["Close"].pct_change()\n\n# 20-day simple moving average\ndf["sma20"] = df["Close"].rolling(20).mean()\n\n# Filter high-volume days\nhigh_vol = df[df["Volume"] > df["Volume"].mean() * 1.5]\n\n# Resample to weekly (last close of each week)\nweekly = df["Close"].resample("W").last()\n\nprint(df.tail())',
    note:'pct_change() and rolling().mean() are the two most-used pandas operations in trading' },
  { type:'bullets', icon:'🔧', heading:'pandas Operations You Must Know',
    items:['df.shift(1) — shift data forward by 1 period (critical for avoiding lookahead bias)','df.dropna() — remove rows with NaN values (always run after computing indicators)','df.loc["2024-01":"2024-06"] — slice data by date range with string labels','df.groupby("symbol").apply(func) — apply any function to each symbol in a multi-stock dataset'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Load market data with yf.download() or pd.read_csv() and you\'re ready in seconds','rolling().mean() calculates any moving average in a single readable line','Always call .dropna() after computing indicators — NaN values will break your model','shift(1) is the most important method for avoiding lookahead bias in feature engineering'] }
],

'2.4': [
  { type:'title', badge:'MODULE 2', icon:'📡', heading:'Fetching Live Market Data',
    sub:'Lesson 2.4 · yfinance and Data Sources',
    note:'Free, reliable market data is one pip install away' },
  { type:'bullets', icon:'📥', heading:'What Is yfinance?',
    items:['Open-source Python library wrapping Yahoo Finance\'s data API','Free access to adjusted historical OHLCV data (15-20 minute delay for real-time)','Supports stocks, ETFs, indices, futures, crypto, and forex pairs','Historical data goes back 20+ years for most major US equities'] },
  { type:'code', icon:'💻', heading:'Fetching and Using Market Data',
    code:'import yfinance as yf\nimport pandas as pd\n\n# Single symbol — 1 year of daily data\nspy = yf.download("SPY", period="1y", auto_adjust=True)\n\n# Multiple symbols at once\nsymbols = ["SPY","QQQ","AAPL","NVDA","MSFT"]\ndata = yf.download(symbols, period="6mo")\n\n# Intraday — 1-hour bars (last 60 days)\nhourly = yf.download("SPY", period="60d", interval="1h")\n\n# Save locally to avoid re-fetching\nspy.to_csv("data/spy_daily.csv")\nspy = pd.read_csv("data/spy_daily.csv",\n                  index_col=0, parse_dates=True)',
    note:'Cache data to CSV during development — never fetch the same data twice in a session' },
  { type:'bullets', icon:'💡', heading:'Pro Tips for Reliable Market Data',
    items:['Always set auto_adjust=True to get split and dividend-adjusted closing prices','Use period="max" to get the full price history available for any symbol','Check df.info() immediately after downloading to verify data completeness and types','For real-time or tick data you will need a paid provider (Polygon, Alpaca, or IBKR)'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['yf.download() is your go-to source for free historical price data','Always check df.shape and df.isna().sum() after downloading to verify data quality','Cache downloaded data locally — it speeds up development and reduces API calls','Understand the 15-20 min delay — yfinance data is not suitable for HFT or scalping'] }
],

'2.5': [
  { type:'title', badge:'MODULE 2', icon:'🔢', heading:'NumPy for Numerical Finance',
    sub:'Lesson 2.5 · Zero to Functional',
    note:'NumPy is the mathematical backbone of every quantitative trading system' },
  { type:'bullets', icon:'⚡', heading:'Why NumPy?',
    items:['C-optimized array operations — 100x faster than Python loops on large datasets','Mathematical functions: mean, std, log, exp, percentile, corrcoef and more','Broadcasting: apply operations across entire arrays without explicit loops','Foundation of pandas, scikit-learn, and every ML and data science library'] },
  { type:'code', icon:'💻', heading:'NumPy Operations for Quantitative Finance',
    code:'import numpy as np\nimport yfinance as yf\n\ndf = yf.download("SPY", period="2y")\nclose = df["Close"].values  # convert to numpy array\n\n# Log returns (more statistically stable than pct_change)\nlog_returns = np.log(close[1:] / close[:-1])\n\n# Annualized volatility (daily std × sqrt of 252 trading days)\nann_vol = np.std(log_returns) * np.sqrt(252)\nprint(f"Annual volatility: {ann_vol:.1%}")\n\n# Value at Risk (5th percentile of daily returns)\nvar_5 = np.percentile(log_returns, 5)\nprint(f"Daily VaR (95%): {var_5:.2%}")',
    note:'Multiply daily volatility by sqrt(252) to annualize — 252 trading days per year' },
  { type:'bullets', icon:'📐', heading:'Key NumPy Patterns for Trading',
    items:['np.log(prices) — log prices are more stationary (better for statistical analysis)','np.corrcoef(spy, qqq) — correlation matrix to measure co-movement between assets','np.percentile(returns, 5) — Value at Risk calculation for risk management','np.where(signal > 0, 1, -1) — fast vectorized signal generation, no loops needed'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Use numpy arrays for any heavy numerical computation — avoid Python loops','Log returns are more statistically stable than percent returns — use them for ML features','Always multiply daily volatility by sqrt(252) to convert to an annualized figure','np.where() is your vectorized if-else — essential for generating signals efficiently'] }
],

'2.6': [
  { type:'title', badge:'MODULE 2', icon:'🧹', heading:'Data Cleaning and Preprocessing',
    sub:'Lesson 2.6 · Zero to Functional',
    note:'80% of ML work is data preparation — this lesson makes or breaks your model' },
  { type:'bullets', icon:'⚠️', heading:'Why Raw Market Data Is Never Clean',
    items:['Missing trading days: holidays, exchange halts, data provider gaps','Corporate actions: stock splits and dividends distort raw price comparisons','Duplicate rows: API glitches and timestamp collisions happen more than you think','Outliers: data entry errors and flash crashes create extreme values that confuse models'] },
  { type:'bullets', icon:'🔧', heading:'Common Data Problems and Their Fixes',
    items:['Missing values: df.ffill() forward-fills with last known price (most correct approach)','Duplicate rows: df.drop_duplicates(subset=["Date"], keep="last")','Stock splits: use auto_adjust=True in yfinance to get adjusted close automatically','Outlier returns: df["return"].clip(lower=-0.15, upper=0.15) clips extreme values'] },
  { type:'code', icon:'💻', heading:'A Reusable Data Cleaning Pipeline',
    code:'import pandas as pd\nimport numpy as np\n\ndef clean_market_data(df):\n    # Drop fully empty rows and columns\n    df = df.dropna(how="all")\n    # Remove duplicated timestamps\n    df = df[~df.index.duplicated(keep="last")]\n    # Forward-fill small gaps (weekends, holidays)\n    df = df.ffill()\n    # Drop remaining NaN rows at the start\n    df = df.dropna()\n    # Clip extreme daily returns\n    df["return"] = df["Close"].pct_change().clip(-0.15, 0.15)\n    df = df.sort_index()\n    return df',
    note:'Build this once and reuse it for every dataset — data quality is your competitive edge' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Always visualize your raw data before cleaning — charts expose problems instantly','Use adjusted close prices to remove split and dividend distortions','Forward-fill prices for small gaps; drop NaN rows after computing indicators','Create a reusable cleaning pipeline function — apply it consistently to every dataset'] }
],

'2.7': [
  { type:'title', badge:'MODULE 2', icon:'📈', heading:'Visualization — Charting Market Data',
    sub:'Lesson 2.7 · Zero to Functional',
    note:'A chart reveals in seconds what a spreadsheet hides in rows' },
  { type:'bullets', icon:'🖼️', heading:'Choosing the Right Charting Library',
    items:['matplotlib: the standard — static charts, full control, integrates with pandas','plotly: interactive charts with zoom/hover/export — ideal for dashboards and analysis','mplfinance: candlestick + volume charts in two lines of code — built for traders','seaborn: statistical visualizations — correlation heatmaps, return distributions'] },
  { type:'code', icon:'💻', heading:'Price + Indicator Chart with matplotlib',
    code:'import matplotlib.pyplot as plt\nimport yfinance as yf\n\ndf = yf.download("SPY", period="6mo")\ndf["sma20"] = df["Close"].rolling(20).mean()\ndf["sma50"] = df["Close"].rolling(50).mean()\n\nfig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12,7),\n                               gridspec_kw={"height_ratios":[3,1]},\n                               sharex=True)\nax1.plot(df.index, df["Close"], label="SPY", linewidth=1.5)\nax1.plot(df.index, df["sma20"], label="SMA 20", linestyle="--")\nax1.plot(df.index, df["sma50"], label="SMA 50", linestyle="--")\nax1.legend(); ax1.set_ylabel("Price")\nax2.bar(df.index, df["Volume"], color="#22d3ee", alpha=0.6)\nax2.set_ylabel("Volume")\nplt.tight_layout(); plt.show()',
    note:'Always use subplots for price + volume — seeing them together reveals conviction' },
  { type:'bullets', icon:'📊', heading:'Essential Charts for Traders',
    items:['Price + SMA overlay: see trend direction and mean-reversion opportunities clearly','Returns histogram: reveals fat tails and skewness — critical for risk assessment','Correlation heatmap: which assets move together? Which provide diversification?','Rolling volatility: visualize risk regimes — calm vs choppy market environments'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Always label axes and add titles — undocumented charts are worthless in 6 months','Use subplots to overlay price, indicators, and volume in one coherent view','plotly interactive charts are worth the extra line — zoom and hover save analysis time','Visualize your data before modeling — charts reveal data problems that code misses'] }
],

'2.8': [
  { type:'title', badge:'MODULE 2', icon:'🏗️', heading:'Project: Market Data Pipeline',
    sub:'Lesson 2.8 · Module 2 Capstone Project',
    note:'Build the infrastructure that every future ML project will run on' },
  { type:'bullets', icon:'🎯', heading:'Project Goal',
    items:['Build a reusable pipeline that fetches, cleans, and enriches market data','Support multiple symbols and configurable timeframes with a single function call','Compute basic derived features: returns, volume ratio, price relative to moving averages','Output: clean DataFrame ready for direct input to ML feature engineering in Module 3'] },
  { type:'code', icon:'💻', heading:'Market Data Pipeline Structure',
    code:'import yfinance as yf\nimport pandas as pd\nimport numpy as np\n\ndef build_pipeline(symbols, period="2y"):\n    frames = {}\n    for sym in symbols:\n        df = yf.download(sym, period=period,\n                         auto_adjust=True, progress=False)\n        df = df.ffill().dropna()\n        df["return_1d"] = df["Close"].pct_change()\n        df["return_5d"] = df["Close"].pct_change(5)\n        df["sma20"]     = df["Close"].rolling(20).mean()\n        df["vol_ratio"] = (df["Volume"] /\n                          df["Volume"].rolling(20).mean())\n        frames[sym] = df.dropna()\n    return frames\n\ndata = build_pipeline(["SPY","QQQ","AAPL"])',
    note:'This pipeline is the foundation of every project from Module 3 onwards' },
  { type:'bullets', icon:'🔮', heading:'Extending the Pipeline',
    items:['Schedule with cron or Windows Task Scheduler for automatic daily data updates','Store in Parquet files (df.to_parquet()) — 10x faster to read than CSV for large datasets','Add a data quality assertion: assert df.isna().sum().sum() == 0 before proceeding','Log download timestamps so you always know exactly when each dataset was fetched'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['A reusable data pipeline is the single most valuable infrastructure you will build','Separate fetching, cleaning, and feature engineering into distinct functions','Build it once, test it thoroughly, and reuse it across every future ML project','Good data infrastructure is the foundation of every consistently profitable ML strategy'] }
],

// ═══════════════════════════════════════════════════════════════════
// MODULE 3 — Technical Indicators & Feature Engineering
// ═══════════════════════════════════════════════════════════════════

'3.1': [
  { type:'title', badge:'MODULE 3', icon:'〰️', heading:'Moving Averages',
    sub:'Lesson 3.1 · SMA, EMA, and VWAP',
    note:'Moving averages are the oldest and most widely used indicators — for good reason' },
  { type:'bullets', icon:'📏', heading:'The Three Moving Averages You Must Know',
    items:['SMA (Simple): equal weight to all periods — smooth, clean, slow to react to price changes','EMA (Exponential): more weight to recent prices — faster and more responsive than SMA','VWAP (Volume-Weighted): average price weighted by volume — the institutional benchmark','Key periods: 9, 20, 50, 100, 200 — each represents a different trading timeframe'] },
  { type:'code', icon:'💻', heading:'Computing Moving Averages in Python',
    code:'import pandas as pd\nimport yfinance as yf\n\ndf = yf.download("SPY", period="1y")\n\n# Simple Moving Average\ndf["sma20"] = df["Close"].rolling(20).mean()\ndf["sma50"] = df["Close"].rolling(50).mean()\n\n# Exponential Moving Average\ndf["ema9"]  = df["Close"].ewm(span=9,  adjust=False).mean()\ndf["ema20"] = df["Close"].ewm(span=20, adjust=False).mean()\n\n# VWAP (resets daily — shown here for full period)\ndf["vwap"] = (df["Close"] * df["Volume"]).cumsum() / df["Volume"].cumsum()\n\n# Golden Cross signal: SMA50 crosses above SMA200\ndf["sma200"] = df["Close"].rolling(200).mean()\ndf["golden_cross"] = (df["sma50"] > df["sma200"]).astype(int)',
    note:'Use ewm(span=N) for EMA — pandas handles the recursive calculation automatically' },
  { type:'bullets', icon:'🌟', heading:'Classic MA Signals',
    items:['Price above SMA200: long-term bullish trend — institutions are accumulating','Golden cross: SMA50 crosses above SMA200 — one of the most watched bullish signals','Death cross: SMA50 crosses below SMA200 — broad distribution by institutions','VWAP reclaim: price crosses back above VWAP — intraday bullish shift in momentum'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['SMA is smoother but slower — better for long-term trend identification','EMA responds faster to recent prices — better for short-term signal generation','VWAP is the intraday institutional benchmark — trading above it is broadly bullish','Cross signals (golden/death) are lagging but reliable for confirming major trend shifts'] }
],

'3.2': [
  { type:'title', badge:'MODULE 3', icon:'⚡', heading:'Momentum Indicators',
    sub:'Lesson 3.2 · RSI and MACD',
    note:'Momentum tells you not just where price is, but how fast it\'s moving there' },
  { type:'bullets', icon:'📡', heading:'RSI — Relative Strength Index',
    items:['Measures speed and magnitude of recent price changes on a 0–100 scale','RSI above 70: potentially overbought — watch for reversal or cooling of momentum','RSI below 30: potentially oversold — watch for bounce or accumulation beginning','Divergence: price makes new high but RSI does not — a powerful early warning signal'] },
  { type:'bullets', icon:'📊', heading:'MACD — Moving Average Convergence Divergence',
    items:['MACD line = 12-period EMA minus 26-period EMA (measures trend momentum)','Signal line = 9-period EMA of the MACD (the trigger line for entries)','Histogram = MACD minus Signal (shows acceleration of momentum — shrinking = warning)','Bullish: MACD crosses above signal with histogram rising — confirms upside momentum'] },
  { type:'code', icon:'💻', heading:'Computing RSI and MACD from Scratch',
    code:'import pandas as pd\n\ndef compute_rsi(series, period=14):\n    delta = series.diff()\n    gain  = delta.clip(lower=0).rolling(period).mean()\n    loss  = (-delta.clip(upper=0)).rolling(period).mean()\n    rs    = gain / loss\n    return 100 - (100 / (1 + rs))\n\ndef compute_macd(series, fast=12, slow=26, signal=9):\n    ema_fast   = series.ewm(span=fast,   adjust=False).mean()\n    ema_slow   = series.ewm(span=slow,   adjust=False).mean()\n    macd_line  = ema_fast - ema_slow\n    signal_ln  = macd_line.ewm(span=signal, adjust=False).mean()\n    histogram  = macd_line - signal_ln\n    return macd_line, signal_ln, histogram',
    note:'Computing indicators from scratch — not using libraries — gives you full control' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Use RSI and MACD together for confirmation — never rely on a single indicator alone','RSI divergence signals are more reliable than simple overbought/oversold readings','MACD crossovers lag price — use them with volume for additional confirmation','Both indicators work best in trending markets — in choppy ranges they give false signals'] }
],

'3.3': [
  { type:'title', badge:'MODULE 3', icon:'〰️', heading:'Volatility Indicators',
    sub:'Lesson 3.3 · Bollinger Bands and ATR',
    note:'Volatility is not the enemy — it\'s the source of every trading opportunity' },
  { type:'bullets', icon:'📊', heading:'Bollinger Bands — Volatility Envelope',
    items:['Three lines: SMA(20) center, upper = SMA + 2×StdDev, lower = SMA − 2×StdDev','Bands widen in high volatility and narrow in calm markets (the squeeze)','Squeeze: bands at their tightest point — energy building for an imminent breakout','Walk the bands: in strong trends price hugs the upper or lower band — not a reversal signal'] },
  { type:'bullets', icon:'📏', heading:'ATR — Average True Range',
    items:['Measures average candle range over N periods (default 14) — adapts to any asset','ATR-based stop: Entry minus 2×ATR(14) for longs — automatically adjusts to volatility','High ATR = dangerous, choppy market conditions — reduce position size accordingly','Low ATR = calm, compressed market — often precedes a significant directional move'] },
  { type:'code', icon:'💻', heading:'Bollinger Bands and ATR in Python',
    code:'import pandas as pd\n\ndef bollinger_bands(series, period=20, std_mult=2):\n    sma   = series.rolling(period).mean()\n    std   = series.rolling(period).std()\n    upper = sma + std_mult * std\n    lower = sma - std_mult * std\n    pct_b = (series - lower) / (upper - lower)  # 0-1 position\n    bw    = (upper - lower) / sma  # bandwidth — squeeze metric\n    return upper, sma, lower, pct_b, bw\n\ndef atr(high, low, close, period=14):\n    tr = pd.concat([\n        high - low,\n        (high - close.shift()).abs(),\n        (low  - close.shift()).abs()\n    ], axis=1).max(axis=1)\n    return tr.rolling(period).mean()',
    note:'Bandwidth (bw) is your squeeze detector — historically low bandwidth = breakout ahead' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Bollinger Band squeeze = energy building for a breakout in either direction','ATR-based stops automatically adapt to market volatility — superior to fixed pip stops','Never use Bollinger Bands in isolation — always confirm with RSI or volume analysis','High IV in options directly correlates with high ATR in the underlying equity'] }
],

'3.4': [
  { type:'title', badge:'MODULE 3', icon:'📊', heading:'Volume Analysis',
    sub:'Lesson 3.4 · The Only Leading Indicator',
    note:'Price tells you what happened. Volume tells you who made it happen and how much they committed.' },
  { type:'bullets', icon:'🔍', heading:'Why Volume Is the Only True Leading Indicator',
    items:['All other indicators are derived from price — volume is independent and reveals commitment','High volume on an up day = institutions accumulating (buying with conviction)','High volume on a down day = institutions distributing (selling with urgency)','Low volume moves are weak and statistically likely to reverse — beware of false breakouts'] },
  { type:'bullets', icon:'📈', heading:'Key Volume Indicators',
    items:['OBV (On-Balance Volume): cumulative volume tracks smart money flow over time','Volume Ratio: today\'s volume vs 20-day average — ratio above 2.0 signals unusual activity','VWAP deviation: how far is price from volume-weighted average price — mean reversion signal','Volume profile: price levels where most volume has traded — major support/resistance zones'] },
  { type:'code', icon:'💻', heading:'Volume Analysis in Python',
    code:'import pandas as pd\n\ndef add_volume_features(df):\n    # On-Balance Volume\n    direction = df["Close"].diff().apply(\n        lambda x: 1 if x > 0 else (-1 if x < 0 else 0))\n    df["obv"] = (df["Volume"] * direction).cumsum()\n\n    # Volume ratio vs 20-day average\n    df["vol_ratio"] = df["Volume"] / df["Volume"].rolling(20).mean()\n\n    # Relative volume (same as vol_ratio, used in signals)\n    df["high_vol_day"] = (df["vol_ratio"] > 2.0).astype(int)\n    return df',
    note:'OBV diverging from price is one of the strongest early warning signals available' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Volume confirms price moves — a breakout without volume is a false breakout','OBV diverging from price early-warns of institutional accumulation or distribution','A volume spike of 2×+ the 20-day average signals meaningful institutional participation','Use volume as your primary filter before applying any other indicator to a signal'] }
],

'3.5': [
  { type:'title', badge:'MODULE 3', icon:'🧮', heading:'Building the Full Feature Matrix',
    sub:'Lesson 3.5 · Technical Indicators & Feature Engineering',
    note:'Your feature matrix is the language you use to teach a machine what the market looks like' },
  { type:'bullets', icon:'📋', heading:'What Is a Feature Matrix?',
    items:['In ML, features are the input variables (X) your model learns patterns from','Each row = one time period (e.g., one trading day) with all computed feature values','Each column = one feature (e.g., RSI_14, MACD_hist, vol_ratio, return_5d)','The model finds statistical relationships between these features and your target (Y)'] },
  { type:'bullets', icon:'🗃️', heading:'Four Categories of Trading Features',
    items:['Price features: 1d/5d/20d returns, price vs SMA, high-low range, gap from open','Momentum features: RSI, MACD histogram, rate-of-change, momentum score','Volatility features: ATR, Bollinger Band width, rolling std deviation, vol regime','Volume features: OBV change, volume ratio, relative volume, volume trend direction'] },
  { type:'code', icon:'💻', heading:'Building a Complete Feature Matrix',
    code:'import pandas as pd\n\ndef build_features(df):\n    c = df["Close"]\n    # Price returns\n    df["ret_1d"]  = c.pct_change(1)\n    df["ret_5d"]  = c.pct_change(5)\n    df["ret_20d"] = c.pct_change(20)\n    # Momentum\n    df["rsi"]     = compute_rsi(c)\n    df["macd_h"]  = compute_macd(c)[2]\n    # Volatility\n    df["bb_bw"]   = bollinger_bands(c)[4]  # bandwidth\n    df["atr14"]   = atr(df.High, df.Low, c)\n    # Volume\n    df["vol_rat"] = df.Volume / df.Volume.rolling(20).mean()\n    # Drop NaN rows created by rolling windows\n    return df.dropna()',
    note:'This function calls your previously built indicator functions — reuse everything' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['More features is NOT better — 10-20 high-quality uncorrelated features is optimal','Correlated features (RSI + Stochastic) add noise and can hurt model performance','Always compute features WITHOUT lookahead — use .shift(1) before training (next lesson)','The feature matrix is your model\'s entire view of the world — build it carefully'] }
],

'3.6': [
  { type:'title', badge:'MODULE 3', icon:'⚖️', heading:'Normalization, Scaling & Stationarity',
    sub:'Lesson 3.6 · Technical Indicators & Feature Engineering',
    note:'Raw prices will silently destroy your ML model — this lesson shows you why and how to fix it' },
  { type:'bullets', icon:'⚠️', heading:'Why Raw Prices Break ML Models',
    items:['Raw prices are non-stationary — they trend indefinitely in one direction','A model trained on 2020 price levels will fail completely when applied to 2024 levels','Features on vastly different scales cause some features to dominate the model unfairly','Proper scaling is the difference between a model that generalizes and one that overfits'] },
  { type:'bullets', icon:'🔧', heading:'Scaling Methods and When to Use Them',
    items:['StandardScaler: (x − mean) / std → zero mean, unit variance — best for most ML models','MinMaxScaler: (x − min) / (max − min) → compresses to [0,1] range','Use returns (pct_change) instead of raw prices — returns are near-stationary by nature','CRITICAL: fit scaler ONLY on training data, then transform test data — never fit on test data'] },
  { type:'code', icon:'💻', heading:'Scaling Pipeline (No Data Leakage)',
    code:'from sklearn.preprocessing import StandardScaler\nfrom sklearn.pipeline import Pipeline\nfrom sklearn.model_selection import TimeSeriesSplit\n\n# Correct approach — fit scaler only on training fold\ntscv = TimeSeriesSplit(n_splits=5)\n\nfor train_idx, val_idx in tscv.split(X):\n    X_train, X_val = X[train_idx], X[val_idx]\n    y_train, y_val = y[train_idx], y[val_idx]\n\n    scaler = StandardScaler()\n    X_train_sc = scaler.fit_transform(X_train)\n    X_val_sc   = scaler.transform(X_val)  # transform only!\n\n    # Train and evaluate model on this fold...',
    note:'Using Pipeline([(scaler), (model)]) automates this correctly in scikit-learn' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Always use returns (not raw prices) as your primary features for stationary inputs','Fit StandardScaler ONLY on training data — fitting on test data is a form of data leakage','Proper scaling alone can improve model accuracy by 5-15% on financial data','Use sklearn Pipeline to prevent any accidental data leakage in your training workflow'] }
],

'3.7': [
  { type:'title', badge:'MODULE 3', icon:'🎯', heading:'Target Engineering',
    sub:'Lesson 3.7 · What Are You Predicting?',
    note:'The most important decision in your entire ML project: exactly what are you trying to predict?' },
  { type:'bullets', icon:'❓', heading:'Defining Your Prediction Target (Y)',
    items:['The target is the output your model learns to predict from your feature matrix','Regression target: predict the exact return value (e.g., SPY\'s next-day return as a number)','Binary classification: predict direction only — 1 = up, 0 = down (simpler and more reliable)','Threshold classification: will the return exceed 0.3% in the next 5 days? (more actionable)'] },
  { type:'bullets', icon:'📐', heading:'Common Target Formulations',
    items:['Next-day return: df["close"].pct_change().shift(-1) — simplest regression target','Binary direction: (next_return > 0).astype(int) — balanced at ~50% base rate','Multi-class: map returns to -1 (down), 0 (flat), 1 (up) using custom thresholds','Risk-adjusted: only label as "buy" if expected return/risk ratio exceeds your threshold'] },
  { type:'code', icon:'💻', heading:'Target Engineering in Practice',
    code:'import pandas as pd\nimport numpy as np\n\ndef add_targets(df, forward_days=1, threshold=0.002):\n    future_return = df["Close"].pct_change(forward_days).shift(-forward_days)\n\n    # Regression target — predict the actual return\n    df["target_reg"]  = future_return\n\n    # Binary classification — predict direction\n    df["target_bin"]  = (future_return > 0).astype(int)\n\n    # Threshold classification — predict meaningful move\n    df["target_thr"]  = (future_return > threshold).astype(int)\n\n    # Drop the last N rows where target is NaN\n    return df.dropna(subset=["target_reg"])',
    note:'shift(-forward_days) looks forward in time — remove these rows before training!' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['The target definition determines every other decision in your ML project','Binary classification (up/down) is simpler to evaluate than regression on returns','Always use shift(-N) to create forward-looking targets and drop the resulting NaN rows','Higher thresholds (e.g., >0.5% return) produce fewer but higher-quality signals'] }
],

'3.8': [
  { type:'title', badge:'MODULE 3', icon:'🚨', heading:'Avoiding Lookahead Bias',
    sub:'Lesson 3.8 · Technical Indicators & Feature Engineering',
    note:'Lookahead bias is silent, deadly, and the most common mistake in trading ML' },
  { type:'bullets', icon:'⚠️', heading:'What Is Lookahead Bias?',
    items:['Using future information to make a decision that was supposed to happen in the past','The most common and most costly mistake in backtesting and ML model training','A model with lookahead bias will appear to have 90%+ accuracy but fail completely in live trading','Even a single bar of lookahead can make a random strategy look like a genius system'] },
  { type:'bullets', icon:'🔍', heading:'How It Happens and How to Prevent It',
    items:['Using today\'s close to generate a signal executed at today\'s close — wrong! Must shift(1)','Fitting your scaler or any preprocessing on the entire dataset including the test period','Computing indicators on the entire dataset and then splitting — lookahead in the indicators','Target variable using today\'s return for a signal that fires at today\'s open — timing error'] },
  { type:'code', icon:'💻', heading:'Lookahead-Safe Feature Engineering',
    code:'import pandas as pd\nfrom sklearn.model_selection import TimeSeriesSplit\n\n# WRONG — features computed on all data, then split\nX_wrong = df[feature_cols].values\ny_wrong = df["target"].values\n# Any split here still has lookahead in rolling computations\n\n# CORRECT — shift all features by 1 period\ndf_safe = df.copy()\ndf_safe[feature_cols] = df[feature_cols].shift(1)\ndf_safe = df_safe.dropna()\n\n# CORRECT — use TimeSeriesSplit, never shuffle\ntscv = TimeSeriesSplit(n_splits=5)\nfor train_idx, val_idx in tscv.split(df_safe):\n    pass  # train on past, validate on future only',
    note:'ALWAYS shift(1) features and ALWAYS use TimeSeriesSplit — no exceptions' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['If your backtest results look too good to be true, lookahead bias is almost certainly the cause','Always shift(1) all feature columns before training — this is non-negotiable','Use TimeSeriesSplit from sklearn — never use random K-Fold on time-series data','A properly validated system with 55% accuracy is far more valuable than a biased system at 90%'] }
],

// ═══════════════════════════════════════════════════════════════════
// MODULE 4 — ML Fundamentals (Regression + Classification)
// ═══════════════════════════════════════════════════════════════════

'4.1': [
  { type:'title', badge:'MODULE 4', icon:'🤖', heading:'Machine Learning Overview',
    sub:'Lesson 4.1 · ML Fundamentals',
    note:'ML does not replace trading intuition — it scales it to thousands of data points simultaneously' },
  { type:'bullets', icon:'🧠', heading:'What Is Machine Learning?',
    items:['Algorithms that learn patterns from data — without being explicitly programmed with rules','Supervised learning: learn from labeled examples — given X (features), predict Y (target)','Unsupervised learning: discover structure in unlabeled data — clustering similar price regimes','Reinforcement learning: learn through trial, reward, and punishment — used in trading bots'] },
  { type:'bullets', icon:'🔄', heading:'The ML Trading Pipeline',
    items:['1. Data: fetch, clean, and store market data for multiple symbols and timeframes','2. Features: engineer technical indicators and statistical measures as your X matrix','3. Model: train, validate, and tune on historical data using walk-forward validation','4. Signals: load trained model, generate predictions, filter by confidence threshold'] },
  { type:'visual', icon:'⚙️', heading:'The Complete ML Pipeline Flow',
    html:'<div style="display:flex;flex-direction:column;align-items:center;gap:.4rem;padding:.5rem;font-size:.72rem">'
      + '<div class="csp-vbox" style="width:200px;text-align:center;background:rgba(251,146,60,.1);border-color:rgba(251,146,60,.3)">📥 Raw Market Data</div>'
      + '<div style="color:#fb923c">↓</div>'
      + '<div class="csp-vbox" style="width:200px;text-align:center">🔧 Feature Engineering (X)</div>'
      + '<div style="color:#fb923c">↓</div>'
      + '<div class="csp-vbox" style="width:200px;text-align:center">🤖 Train ML Model</div>'
      + '<div style="color:#fb923c">↓</div>'
      + '<div class="csp-vbox" style="width:200px;text-align:center">📊 Walk-Forward Validation</div>'
      + '<div style="color:#fb923c">↓</div>'
      + '<div class="csp-vbox" style="width:200px;text-align:center;background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.3)">🚦 Live Trading Signals</div>'
      + '</div>' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['ML finds patterns in data at a scale no human trader can replicate manually','Supervised learning with price/volume features is the most practical ML approach for trading','Your model is only as good as your features and your labels — both require careful engineering','Start simple — a well-validated logistic regression often beats a complex neural network'] }
],

'4.2': [
  { type:'title', badge:'MODULE 4', icon:'📐', heading:'Linear & Logistic Regression',
    sub:'Lesson 4.2 · ML Fundamentals',
    note:'Every ML journey starts with regression — understand these and you understand all models' },
  { type:'bullets', icon:'📈', heading:'Linear Regression for Return Prediction',
    items:['Predicts a continuous value: the expected next-day return as a decimal number','Model: Y = β₀ + β₁X₁ + β₂X₂ + ... + βₙXₙ (linear combination of features)','Coefficients (β) reveal each feature\'s contribution to the predicted return','Evaluate with: MAE (mean absolute error), RMSE, and R² (variance explained)'] },
  { type:'bullets', icon:'🎯', heading:'Logistic Regression for Direction Classification',
    items:['Predicts probability of a binary outcome: up (1) vs down (0) — despite the name, it classifies','Output is P(Y=1) between 0 and 1 — use threshold 0.5 or calibrate to your strategy','Fast, interpretable, and surprisingly competitive with complex ensemble models','Coefficients directly show which features are most predictive of upward moves'] },
  { type:'code', icon:'💻', heading:'Linear and Logistic Regression with sklearn',
    code:'from sklearn.linear_model import LinearRegression, LogisticRegression\nfrom sklearn.metrics import classification_report, r2_score\n\n# Linear regression — predict return magnitude\nlin_model = LinearRegression()\nlin_model.fit(X_train_sc, y_train_reg)\npred_returns = lin_model.predict(X_val_sc)\nprint(f"R2: {r2_score(y_val_reg, pred_returns):.3f}")\n\n# Logistic regression — predict direction (up/down)\nlog_model = LogisticRegression(C=0.1, max_iter=1000)\nlog_model.fit(X_train_sc, y_train_bin)\npred_dir = log_model.predict(X_val_sc)\nprint(classification_report(y_val_bin, pred_dir))',
    note:'C=0.1 adds L2 regularization — prevents overfitting on financial data' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Always start with logistic regression as your baseline before trying complex models','If you cannot beat a simple logistic model, your feature engineering needs more work','Regularization (C parameter) prevents overfitting — tune it with cross-validation','Logistic regression coefficients tell you definitively which features matter most'] }
],

'4.3': [
  { type:'title', badge:'MODULE 4', icon:'🌳', heading:'Decision Trees & Random Forests',
    sub:'Lesson 4.3 · ML Fundamentals',
    note:'Random Forests are the Swiss Army knife of trading ML — robust, interpretable, reliable' },
  { type:'bullets', icon:'🌿', heading:'Decision Trees',
    items:['Splits data recursively based on feature thresholds — builds a tree of if/then rules','Human-readable: "If RSI > 65 AND volume_ratio < 0.8, predict DOWN"','Single trees overfit heavily — they memorize training data instead of learning patterns','Limited depth (max_depth=5) prevents overfitting but reduces expressiveness'] },
  { type:'bullets', icon:'🌲', heading:'Random Forest = Ensemble of Many Trees',
    items:['Trains hundreds of decision trees, each on a random subset of data and features','Final prediction = majority vote (classification) or average (regression) of all trees','Naturally resistant to overfitting because diverse trees cancel each other\'s errors','Feature importance: RF ranks every feature by its average contribution — invaluable for debugging'] },
  { type:'code', icon:'💻', heading:'Random Forest for Trading Signals',
    code:'from sklearn.ensemble import RandomForestClassifier\nfrom sklearn.metrics import classification_report\nimport pandas as pd\n\nrf = RandomForestClassifier(\n    n_estimators=200,\n    max_depth=6,\n    min_samples_leaf=20,  # prevents overfitting\n    random_state=42\n)\nrf.fit(X_train_sc, y_train)\npreds = rf.predict(X_val_sc)\nprint(classification_report(y_val, preds))\n\n# Feature importance ranking\nimportances = pd.Series(\n    rf.feature_importances_, index=feature_names\n).sort_values(ascending=False)\nprint(importances.head(10))',
    note:'min_samples_leaf=20 prevents trees from fitting to very small, noisy subsets' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Random Forests are robust, fast, and handle noisy financial data extremely well','Always check feature_importances_ — it reveals which features actually drive predictions','Use n_estimators=200, max_depth=5-6 as your starting point for financial data','RF is your reliable baseline before attempting XGBoost or deep learning models'] }
],

'4.4': [
  { type:'title', badge:'MODULE 4', icon:'🚀', heading:'XGBoost — The Trader\'s Model',
    sub:'Lesson 4.4 · ML Fundamentals',
    note:'XGBoost wins more Kaggle competitions than any other algorithm — and it dominates financial ML too' },
  { type:'bullets', icon:'⚡', heading:'Why XGBoost Dominates in Trading',
    items:['Gradient boosting: each tree corrects the prediction errors of the previous tree','More accurate than Random Forest on most real-world tabular and financial datasets','Built-in L1/L2 regularization prevents overfitting without careful manual tuning','Handles missing values natively and is robust to feature scale differences'] },
  { type:'bullets', icon:'🎛️', heading:'Key XGBoost Hyperparameters',
    items:['n_estimators: number of boosting rounds — 100-500 typical for financial data','max_depth: tree depth — 3-6 recommended (deeper trees overfit on noisy financial data)','learning_rate: step size per round — 0.01-0.1 (lower rate + more rounds = better)','early_stopping_rounds: stop when validation score stops improving for N rounds'] },
  { type:'code', icon:'💻', heading:'XGBoost Trading Signal with Early Stopping',
    code:'from xgboost import XGBClassifier\nfrom sklearn.metrics import classification_report\n\nxgb = XGBClassifier(\n    n_estimators=500,\n    max_depth=4,\n    learning_rate=0.05,\n    subsample=0.8,         # row sampling\n    colsample_bytree=0.8,  # feature sampling\n    eval_metric="logloss",\n    early_stopping_rounds=30,\n    random_state=42\n)\nxgb.fit(\n    X_train_sc, y_train,\n    eval_set=[(X_val_sc, y_val)],\n    verbose=False\n)\nprint(classification_report(y_val, xgb.predict(X_val_sc)))',
    note:'early_stopping_rounds automatically finds the optimal number of trees — always use it' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['XGBoost is the most consistently high-performing model for financial ML tasks','Always use early_stopping_rounds to prevent overfitting — set eval_set to your validation fold','Start with max_depth=4, learning_rate=0.05, n_estimators=500 for most trading problems','SHAP values from XGBoost give the clearest and most actionable feature importance analysis'] }
],

'4.5': [
  { type:'title', badge:'MODULE 4', icon:'⏩', heading:'Walk-Forward Validation',
    sub:'Lesson 4.5 · ML Fundamentals',
    note:'Standard cross-validation will silently lie to you — walk-forward tells the truth' },
  { type:'bullets', icon:'⚠️', heading:'Why Standard Cross-Validation Fails for Time Series',
    items:['K-Fold CV randomly shuffles data — this causes time travel (using 2024 data to predict 2022)','A model trained on future data will appear to have perfect accuracy — but it\'s cheating','Financial data has autocorrelation and regime changes — random splits break its structure completely','We need validation that strictly respects the temporal ordering of all observations'] },
  { type:'visual', icon:'📅', heading:'Walk-Forward Validation Diagram',
    html:'<div style="padding:.5rem 1rem;font-size:.7rem">'
      + '<div style="margin-bottom:.4rem;color:#888">Each fold: train on past → validate on future only:</div>'
      + '<div style="display:flex;flex-direction:column;gap:.3rem">'
      + '<div style="display:flex;height:18px;gap:2px">'
      + '<div style="width:40%;background:rgba(251,146,60,.4);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.6rem">Train</div>'
      + '<div style="width:15%;background:rgba(74,222,128,.4);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.6rem">Val</div>'
      + '</div>'
      + '<div style="display:flex;height:18px;gap:2px">'
      + '<div style="width:55%;background:rgba(251,146,60,.4);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.6rem">Train</div>'
      + '<div style="width:15%;background:rgba(74,222,128,.4);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.6rem">Val</div>'
      + '</div>'
      + '<div style="display:flex;height:18px;gap:2px">'
      + '<div style="width:70%;background:rgba(251,146,60,.4);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.6rem">Train</div>'
      + '<div style="width:15%;background:rgba(74,222,128,.4);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:.6rem">Val</div>'
      + '</div>'
      + '</div>'
      + '</div>',
    note:'Each validation fold is strictly in the future relative to its training fold' },
  { type:'bullets', icon:'🔧', heading:'Implementing Walk-Forward in sklearn',
    items:['TimeSeriesSplit(n_splits=5): creates 5 folds with expanding training windows','Each fold trains on all past data and validates on the immediately following period','Use inside cross_val_score() or manually loop over split indices for full control','Retrain model on the entire dataset after validation before deploying live'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Walk-forward is the only honest validation methodology for time-series ML models','Use TimeSeriesSplit instead of KFold — never shuffle time-series data','Expect lower validation scores than standard CV — this is realistic, not a problem','Re-fit your model on fresh data every 1-4 weeks to prevent model decay in live trading'] }
],

'4.6': [
  { type:'title', badge:'MODULE 4', icon:'📏', heading:'Model Evaluation Metrics for Trading',
    sub:'Lesson 4.6 · ML Fundamentals',
    note:'A model with 90% accuracy can still lose money — evaluation metrics must reflect trading reality' },
  { type:'bullets', icon:'⚠️', heading:'Why Accuracy Alone Is Dangerously Misleading',
    items:['In finance, a model with 55% accuracy and 2:1 R:R is very profitable long-term','Class imbalance: if 60% of days trend up, always predicting "up" gives 60% accuracy for free','A model that predicts rare but large moves matters far more than one that nails small daily wiggles','Evaluate both statistical performance AND simulated trading performance — both are required'] },
  { type:'bullets', icon:'📊', heading:'Better Metrics for Trading Models',
    items:['Precision: of all predicted UP signals, what % were actually profitable?','Recall: of all actual UP days, what % did your model correctly identify?','F1-score: harmonic mean of precision and recall — balanced metric when classes are unequal','Sharpe Ratio: annualized (mean return / std of returns) — the universal strategy benchmark'] },
  { type:'code', icon:'💻', heading:'Complete Model Evaluation Suite',
    code:'from sklearn.metrics import (classification_report,\n                              confusion_matrix, roc_auc_score)\nimport numpy as np\n\ndef evaluate_model(model, X_val, y_val, prices_val):\n    preds = model.predict(X_val)\n    proba = model.predict_proba(X_val)[:, 1]\n\n    print(classification_report(y_val, preds))\n    print(f"ROC-AUC: {roc_auc_score(y_val, proba):.3f}")\n\n    # Simulate strategy returns\n    ret = prices_val.pct_change().fillna(0)\n    strat_ret = ret * preds  # long when model says up\n    sharpe = (strat_ret.mean() / strat_ret.std()) * 16\n    print(f"Annualized Sharpe: {sharpe:.2f}")',
    note:'Multiply daily Sharpe by sqrt(252) ≈ 15.87 to annualize — target Sharpe > 1.5' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Evaluate with precision, recall, F1 AND a simulated trading PnL — not just accuracy','A 52% accurate model with good R:R ratio will consistently outperform a 70% model at 1:1','Always test your model\'s performance in both bull and bear market environments separately','Backtested Sharpe above 1.5 is solid; above 2.0 is exceptional (and worth scrutinizing carefully)'] }
],

'4.7': [
  { type:'title', badge:'MODULE 4', icon:'🎛️', heading:'Hyperparameter Tuning',
    sub:'Lesson 4.7 · ML Fundamentals',
    note:'The right hyperparameters can be the difference between a losing model and a winning strategy' },
  { type:'bullets', icon:'⚙️', heading:'What Are Hyperparameters?',
    items:['Parameters set BEFORE training — not learned from the data itself','Examples: max_depth, learning_rate, n_estimators, min_samples_leaf, regularization strength','Wrong hyperparameters lead to underfitting (too simple) or overfitting (too complex)','The goal: find the parameter combination that maximizes out-of-sample performance'] },
  { type:'bullets', icon:'🔍', heading:'Three Tuning Approaches',
    items:['Grid search: try every combination — exhaustive but exponentially slow for many parameters','Random search: sample random combinations — typically 90% as good, 10× faster','Bayesian optimization (Optuna / Hyperopt): intelligent sequential search — most efficient','Walk-forward tuning: re-tune hyperparameters on each validation window for robustness over time'] },
  { type:'code', icon:'💻', heading:'Bayesian Tuning with Optuna',
    code:'import optuna\nfrom xgboost import XGBClassifier\nfrom sklearn.model_selection import TimeSeriesSplit\nfrom sklearn.metrics import f1_score\n\ndef objective(trial):\n    params = {\n        "max_depth":    trial.suggest_int("max_depth", 2, 6),\n        "learning_rate":trial.suggest_float("lr", 0.01, 0.15),\n        "subsample":    trial.suggest_float("sub", 0.6, 1.0),\n        "n_estimators": trial.suggest_int("n_est", 100, 400)\n    }\n    model = XGBClassifier(**params, random_state=42)\n    tscv  = TimeSeriesSplit(n_splits=3)\n    scores = []\n    for tr, val in tscv.split(X_train):\n        model.fit(X_train[tr], y_train[tr])\n        scores.append(f1_score(y_train[val], model.predict(X_train[val])))\n    return sum(scores) / len(scores)\n\nstudy = optuna.create_study(direction="maximize")\nstudy.optimize(objective, n_trials=50)',
    note:'Use TimeSeriesSplit inside the objective function — tune on the validation set, not test set' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Random search finds near-optimal parameters far faster than exhaustive grid search','Never tune hyperparameters using your test set — only the validation folds from TimeSeriesSplit','Prefer hyperparameter combinations that perform consistently across multiple time periods','A small hyperparameter improvement is usually less valuable than better feature engineering'] }
],

'4.8': [
  { type:'title', badge:'MODULE 4', icon:'💾', heading:'Saving, Loading & Retraining Models',
    sub:'Lesson 4.8 · ML Fundamentals',
    note:'A model that cannot be saved, versioned, and reloaded is not a production system' },
  { type:'bullets', icon:'📦', heading:'Why Model Persistence Matters',
    items:['Training a model takes seconds to minutes — save it so you never retrain unnecessarily','Production systems load pre-trained models at startup and generate signals in milliseconds','Version your models so you can roll back instantly if a new model underperforms in live trading','Always store metadata with the model: training dates, feature list, validation performance'] },
  { type:'code', icon:'💻', heading:'Saving and Loading Models with joblib',
    code:'import joblib\nimport json\nfrom datetime import datetime\n\n# Save model + scaler + metadata as a bundle\ndef save_model_bundle(model, scaler, features, path):\n    bundle = {\n        "model": model,\n        "scaler": scaler,\n        "features": features,\n        "trained_at": datetime.now().isoformat(),\n        "model_type": type(model).__name__\n    }\n    joblib.dump(bundle, path)\n    print(f"Saved to {path}")\n\n# Load and use the model bundle\ndef load_and_predict(path, X_new):\n    bundle = joblib.load(path)\n    X_sc = bundle["scaler"].transform(X_new[bundle["features"]])\n    return bundle["model"].predict(X_sc)\n\n# Example\nsave_model_bundle(xgb_model, scaler, feature_names,\n                  "models/xgb_spy_v2.pkl")',
    note:'Always save the scaler with the model — mismatched scaling will silently corrupt predictions' },
  { type:'bullets', icon:'🔄', heading:'Model Retraining Strategy',
    items:['Financial data drifts — models decay over time as market regimes change (concept drift)','Scheduled retraining: retrain monthly for daily strategies, weekly for intraday systems','Trigger-based retraining: automatically retrain when live accuracy drops below a set threshold','Expanding window: keep all historical data; rolling window: keep only the most recent N months'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Always save model AND scaler together — one without the other will produce wrong predictions','Store model version, training date, and full feature list in the metadata dictionary','Set up automatic monthly retraining to combat concept drift in live financial data','Always verify a loaded model produces identical predictions to the original before deploying it'] }
],

'4.9': [
  { type:'title', badge:'MODULE 4', icon:'🔙', heading:'Backtesting Your ML Strategy',
    sub:'Lesson 4.9 · ML Fundamentals',
    note:'Backtesting is your hypothesis test — rigorous testing prevents expensive live trading mistakes' },
  { type:'bullets', icon:'🔬', heading:'What Is Backtesting?',
    items:['Simulating your ML trading strategy on historical data to estimate live performance','Generates a hypothetical PnL curve as if you had followed every signal in the past','Reveals: win rate, Sharpe ratio, maximum drawdown, average trade return, and holding period','The goal: gain statistical confidence before risking real capital in live markets'] },
  { type:'bullets', icon:'⚠️', heading:'Backtesting Best Practices',
    items:['Always use strictly out-of-sample data — data your model has never been trained or tuned on','Include realistic transaction costs: round-trip commission $0.005/share minimum for equities','Simulate execution delays: signals generated at close, executed at NEXT day\'s open price','Track drawdowns rigorously — a 50% drawdown requires a 100% gain just to recover to breakeven'] },
  { type:'code', icon:'💻', heading:'Simple ML Strategy Backtester',
    code:'import pandas as pd\nimport numpy as np\n\ndef backtest(signals, prices, cost_per_share=0.005):\n    returns   = prices.pct_change().shift(-1)  # next-day return\n    positions = signals.shift(1)               # execute next day\n    trade_cost = positions.diff().abs() * cost_per_share / prices\n\n    strat_returns = returns * positions - trade_cost\n    cum_returns   = (1 + strat_returns).cumprod()\n\n    sharpe = (strat_returns.mean() /\n              strat_returns.std()) * np.sqrt(252)\n    max_dd = (cum_returns / cum_returns.cummax() - 1).min()\n\n    print(f"Sharpe Ratio:  {sharpe:.2f}")\n    print(f"Max Drawdown:  {max_dd:.1%}")\n    print(f"Total Return:  {cum_returns.iloc[-1]-1:.1%}")\n    return strat_returns',
    note:'shift(1) on positions simulates realistic next-day execution — never execute at signal bar' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['A good backtest is necessary but not sufficient for successful live trading','Overfitting to history (curve-fitting) is the biggest and most common backtesting trap','Out-of-sample Sharpe above 1.0 with realistic costs is a green light to continue development','Use vectorbt or Backtrader for production-grade backtesting with realistic market simulation'] }
],

'4.10': [
  { type:'title', badge:'MODULE 4', icon:'🏆', heading:'Capstone: End-to-End ML Signal',
    sub:'Lesson 4.10 · Module 4 Capstone Project',
    note:'You are now ready to build a complete, professional-grade ML trading signal system' },
  { type:'bullets', icon:'🎯', heading:'What You Will Build in This Capstone',
    items:['Fetch and clean market data for 5 symbols using your reusable data pipeline','Engineer 15+ features: returns, moving averages, RSI, MACD, ATR, Bollinger bands, volume ratio','Train an XGBoost classifier using walk-forward validation with realistic transaction costs','Generate daily buy/hold/sell signals, backtest the strategy, and generate a performance report'] },
  { type:'bullets', icon:'🏗️', heading:'The Complete 5-Layer Architecture',
    items:['Layer 1 — Data: fetch → clean → cache with timestamps and quality checks','Layer 2 — Features: engineer → scale → validate (strictly no lookahead bias)','Layer 3 — Model: train → validate → tune → save with full metadata bundle','Layer 4 — Signals: load model → predict → filter by confidence threshold','Layer 5 — Backtest: simulate → compute metrics → generate report → compare to benchmark'] },
  { type:'code', icon:'💻', heading:'Capstone Pipeline (Condensed Sketch)',
    code:'# Complete ML Trading Signal Pipeline\nSYMBOLS = ["SPY","QQQ","AAPL","NVDA","MSFT"]\n\n# 1. Data Layer\ndata   = build_pipeline(SYMBOLS, period="3y")\n\n# 2. Feature Layer\nfor sym, df in data.items():\n    df = build_features(df)\n    df = add_targets(df, forward_days=1)\n    data[sym] = df.dropna()\n\n# 3. Model Layer (walk-forward)\nmodel, scaler, features = train_walkforward(\n    data["SPY"], feature_cols, "target_bin")\n\nsave_model_bundle(model, scaler, features,\n                  "models/spy_signal_v1.pkl")\n\n# 4. Backtest Layer\nsignals = generate_signals("models/spy_signal_v1.pkl",\n                           data["SPY"])\nbacktest(signals, data["SPY"]["Close"])',
    note:'This pipeline is your foundation — every Pro module lesson builds directly on it' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['You have now built a complete, production-grade ML trading signal — an exceptional achievement','This is a professional-level system that most retail traders have never attempted to build','Next: paper trade this system live for 30-60 days before risking any real capital','Pro Modules 5-9 extend this foundation with deep learning, NLP, options ML, and live deployment'] }
],

// ═══════════════════════════════════════════════════════════════════
// MODULE 5 — Advanced Feature Engineering  (color: #22d3ee)
// ═══════════════════════════════════════════════════════════════════

'5.1': [
  { type:'title', badge:'MODULE 5', icon:'⚙️', heading:'Advanced Technical Indicators',
    sub:'Lesson 5.1 · Pro Feature Engineering',
    note:'Go beyond basic RSI and MACD — build the indicators that professional quants actually use' },
  { type:'bullets', icon:'📐', heading:'Beyond the Standard Toolkit',
    items:['Basic indicators (RSI, MACD, BB) are already priced in by millions of algorithms','Edge comes from combinations, transformations, and non-standard timeframes','Multi-timeframe signals: 5d, 10d, 20d, 63d, 126d momentum together capture regime','Composite indicators blend multiple signals into a single predictive feature'] },
  { type:'code', icon:'💻', heading:'Advanced Indicator Construction',
    code:'import pandas as pd\nimport numpy as np\n\ndef build_advanced_indicators(df):\n    c = df["Close"]\n\n    # Kaufman Adaptive MA — responds to trend strength\n    er = abs(c.diff(10)) / c.diff().abs().rolling(10).sum()\n    sc = (er * (2/3 - 2/31) + 2/31) ** 2\n    kama = c.copy()\n    for i in range(1, len(c)):\n        kama.iloc[i] = kama.iloc[i-1] + sc.iloc[i] * (c.iloc[i] - kama.iloc[i-1])\n    df["kama_dist"] = (c - kama) / kama\n\n    # Hurst exponent proxy (trending vs mean-reverting)\n    lags = [2, 4, 8, 16]\n    rs = [c.pct_change().rolling(l).std() for l in lags]\n    df["hurst"] = np.polyfit(np.log(lags),\n        [np.log(r.mean()) for r in rs], 1)[0]\n\n    # Z-score vs rolling quantiles\n    mu  = c.rolling(63).mean()\n    std = c.rolling(63).std()\n    df["zscore_63"] = (c - mu) / std.replace(0, np.nan)\n    return df',
    note:'These features capture market microstructure dynamics that simple indicators miss' },
  { type:'bullets', icon:'🔬', heading:'High-Value Advanced Indicators',
    items:['KAMA distance: measures trend strength and mean reversion pressure simultaneously','Hurst exponent proxy: > 0.5 = trending market, < 0.5 = mean-reverting — regime signal','Cross-asset z-score: where is SPY relative to its 63-day distribution?','Realized-to-implied volatility ratio: when realized < implied, volatility is cheap to buy'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Standard indicators are necessary but not sufficient — combine and transform them','Adaptive indicators like KAMA outperform fixed-period MAs in changing markets','The Hurst exponent proxy identifies trending vs mean-reverting regimes','Z-scores normalize indicators across different market conditions for better ML input'] }
],

'5.2': [
  { type:'title', badge:'MODULE 5', icon:'🔬', heading:'Microstructure Features',
    sub:'Lesson 5.2 · Order Flow & Market Impact',
    note:'The signals hidden inside order flow that drive institutional price discovery' },
  { type:'bullets', icon:'📊', heading:'What Microstructure Features Capture',
    items:['Order flow imbalance: more buyer-initiated vs seller-initiated trades predicts direction','Volume-weighted price (VWAP) deviation signals institutional accumulation or distribution','Intraday high-low range vs prior day range measures volatility expansion or compression','Quote stuffing and cancellation rates indicate HFT presence — alters execution quality'] },
  { type:'code', icon:'💻', heading:'VWAP & Flow Imbalance Features',
    code:'def build_microstructure_features(df):\n    h, l, c, v = df.High, df.Low, df.Close, df.Volume\n\n    # Typical price and VWAP deviation\n    tp = (h + l + c) / 3\n    df["vwap"]      = (tp * v).rolling(20).sum() / v.rolling(20).sum()\n    df["vwap_dist"] = (c - df["vwap"]) / df["vwap"]\n\n    # Amihud illiquidity (price impact per dollar volume)\n    daily_ret  = c.pct_change().abs()\n    dollar_vol = c * v\n    df["amihud"] = (daily_ret / dollar_vol.replace(0, np.nan)).rolling(20).mean()\n\n    # Intraday range vs ATR\n    atr = (h - l).rolling(14).mean()\n    df["range_ratio"] = (h - l) / atr.replace(0, np.nan)\n\n    # Volume surge (Z-score of volume)\n    vol_mu  = v.rolling(20).mean()\n    vol_std = v.rolling(20).std()\n    df["vol_zscore"] = (v - vol_mu) / vol_std.replace(0, np.nan)\n    return df',
    note:'VWAP deviation above +0.5% signals institutional buyers pushing above fair value' },
  { type:'bullets', icon:'💡', heading:'Why Microstructure Predicts Price',
    items:['VWAP deviation > 0 means buyers pay above fair value — bullish signal','Amihud illiquidity spikes precede large moves: low liquidity amplifies price impact','Range ratio > 1.5 signals volatility expansion — often precedes breakouts','Volume z-score > 2.0 flags unusual activity that precedes institutional moves by hours'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['VWAP deviation is one of the strongest short-term directional signals','Amihud illiquidity measures how much prices move per dollar of volume — a key risk signal','Range ratio identifies expanding volatility before it shows in implied vol','Volume z-score flags unusual activity 2-4 hours before the resulting price move'] }
],

'5.3': [
  { type:'title', badge:'MODULE 5', icon:'🌊', heading:'Volatility Regime Features',
    sub:'Lesson 5.3 · Market Regime Detection',
    note:'The single most important context signal: what kind of market are you in right now?' },
  { type:'bullets', icon:'📈', heading:'Why Regime Matters More Than Direction',
    items:['The same model that makes money in trending markets can lose heavily in choppy ones','Volatility regime determines which features work, not just how large the moves are','VIX levels above 25 change correlations, mean reversion speeds, and tail risk profiles','Regime-aware models outperform static models by 30-50% in out-of-sample backtests'] },
  { type:'code', icon:'💻', heading:'Volatility Regime Feature Engineering',
    code:'def build_vol_regime_features(df, vix_df=None):\n    c = df["Close"]\n    ret = c.pct_change()\n\n    # Realized volatility at multiple horizons\n    for w in [5, 10, 21, 63]:\n        df[f"rvol_{w}d"] = ret.rolling(w).std() * np.sqrt(252)\n\n    # Volatility of volatility (signal regime change)\n    df["vol_of_vol"] = df["rvol_21d"].rolling(21).std()\n\n    # Realized / 5d vol ratio (acceleration)\n    df["vol_accel"] = df["rvol_5d"] / df["rvol_21d"].replace(0, np.nan)\n\n    # Regime label: low/normal/high vol\n    vol_pct = df["rvol_21d"].rolling(252).rank(pct=True)\n    df["vol_regime"] = pd.cut(vol_pct,\n        bins=[0, 0.33, 0.67, 1.0],\n        labels=[0, 1, 2]).astype(float)\n\n    # VIX features if available\n    if vix_df is not None:\n        df["vix"]          = vix_df["Close"].reindex(df.index)\n        df["vix_pct_rank"] = df["vix"].rolling(252).rank(pct=True)\n        df["vix_vs_rvol"]  = df["vix"] / (df["rvol_21d"] * 100).replace(0, np.nan)\n    return df',
    note:'vol_accel > 1.5 means volatility is expanding — reduce position size immediately' },
  { type:'bullets', icon:'⚡', heading:'High-Signal Regime Features',
    items:['Realized vol ratio (5d/21d): > 1.5 = vol expanding = higher uncertainty = smaller positions','Vol of vol: rising secondary volatility predicts regime transitions 5-10 days ahead','VIX term structure: VIX/VIX3M < 0.9 = backwardation = fear spike underway','Volatility regime label: use as interaction term to allow different model behavior per regime'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Volatility regime is the most important context for every other feature','Realized vol at 5d, 10d, 21d, 63d captures short- and medium-term risk cycles','Vol acceleration (5d/21d ratio) is your early warning signal for regime change','Always scale position size inversely with volatility regime — this alone improves Sharpe'] }
],

'5.4': [
  { type:'title', badge:'MODULE 5', icon:'🌐', heading:'Sector & Macro Features',
    sub:'Lesson 5.4 · Cross-Asset Signals',
    note:'No asset moves in isolation — macro context and sector rotation are powerful predictors' },
  { type:'bullets', icon:'🔗', heading:'Cross-Asset Information Flow',
    items:['SPY leads most individual stocks by minutes to hours — use it as a feature','Bond yield changes (TLT price) carry equity direction signals 1-2 days ahead','Dollar strength (DXY) inversely correlates with SPY 60% of the time','Sector rotation from defensive (XLU) to growth (XLK) signals risk-on transitions'] },
  { type:'code', icon:'💻', heading:'Sector & Macro Feature Construction',
    code:'import yfinance as yf\n\ndef build_macro_features(df, target_sym="SPY"):\n    macros = {\n        "spy"  : "SPY",   # market beta\n        "tlt"  : "TLT",   # long bonds (risk-off indicator)\n        "gld"  : "GLD",   # gold (safe haven)\n        "vix"  : "^VIX",  # fear index\n        "xlk"  : "XLK",   # tech sector\n        "xlv"  : "XLV",   # healthcare (defensive)\n        "eem"  : "EEM",   # emerging markets risk proxy\n    }\n    for name, sym in macros.items():\n        if sym == target_sym: continue\n        m = yf.Ticker(sym).history(period="2y")["Close"]\n        m = m.reindex(df.index).ffill()\n        df[f"{name}_ret5"]  = m.pct_change(5)\n        df[f"{name}_trend"] = (m / m.rolling(20).mean()) - 1\n    # Yield curve proxy\n    ief = yf.Ticker("IEF").history(period="2y")["Close"].reindex(df.index).ffill()\n    df["yield_curve"] = df["tlt_trend"] - ((ief / ief.rolling(20).mean()) - 1)\n    return df',
    note:'TLT 5-day return is one of the top 5 features in most equity ML models' },
  { type:'bullets', icon:'📌', heading:'The Most Predictive Cross-Asset Signals',
    items:['TLT 5d return: negative TLT (rising yields) is a headwind for growth stocks','VIX momentum: VIX rising over 5 days means elevated risk — reduce long exposure','SPY vs EEM: when EEM underperforms SPY, risk appetite is declining globally','XLK/XLV ratio trend: rising = risk-on; falling = risk-off rotation underway'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Cross-asset features often outperform purely technical features for equity ML models','Bond yields (TLT) and equity vol (VIX) are the two most reliable macro inputs','Sector rotation signals (XLK/XLV ratio) detect institutional risk appetite shifts','Always use lagged values — same-day cross-asset data introduces lookahead bias'] }
],

'5.5': [
  { type:'title', badge:'MODULE 5', icon:'📡', heading:'Alternative Data Signals',
    sub:'Lesson 5.5 · Non-Price Alpha Sources',
    note:'The data edge that hedge funds pay millions for — here is how to build your own version' },
  { type:'bullets', icon:'🔍', heading:'What Is Alternative Data?',
    items:['Any non-traditional data source that captures economic activity before it appears in prices','News sentiment, social media, satellite imagery, credit card transactions, job postings','Retail traders can access free or cheap versions: news APIs, Reddit, Google Trends, SEC filings','The signal is not in the data itself but in the systematic extraction of predictive features'] },
  { type:'code', icon:'💻', heading:'Google Trends as an Alpha Signal',
    code:'from pytrends.request import TrendReq\nimport pandas as pd\n\ndef get_search_signal(keyword: str, timeframe="today 3-m") -> pd.Series:\n    # Search interest for a stock/topic as a trading signal\n    pytrends = TrendReq(hl="en-US", tz=360)\n    pytrends.build_payload([keyword], timeframe=timeframe)\n    df = pytrends.interest_over_time()\n    if keyword not in df.columns:\n        return pd.Series(dtype=float)\n    series = df[keyword].astype(float)\n\n    # Normalize: z-score vs 52-week history\n    mu  = series.rolling(52).mean()\n    std = series.rolling(52).std()\n    zscore = (series - mu) / std.replace(0, float("nan"))\n    return zscore\n\n# Usage: search spike precedes retail buying by 1-3 days\nspy_search  = get_search_signal("SPY ETF")\nnvda_search = get_search_signal("NVDA stock")',
    note:'A 2-sigma Google Trends spike for a stock ticker precedes retail buying pressure by 1-3 days' },
  { type:'bullets', icon:'💎', heading:'Best Free Alternative Data Sources',
    items:['Google Trends: retail investor attention spike predicts buying pressure 1-3 days ahead','Reddit r/wallstreetbets mention volume: extreme spikes signal crowded retail positioning','SEC Form 4 insider buying clusters: 3+ insiders buying is a strong 30-day bullish signal','Earnings call tone (positive/negative word ratio): predicts post-earnings drift direction'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Alternative data provides signals orthogonal to price — they do not cancel each other out','Google Trends spikes and Reddit mention surges predict retail buying pressure 1-3 days ahead','SEC Form 4 insider buying is one of the highest-quality signals available for free','Combine 2-3 alt data signals into a composite feature rather than using each separately'] }
],

'5.6': [
  { type:'title', badge:'MODULE 5', icon:'🎯', heading:'Feature Selection Methods',
    sub:'Lesson 5.6 · Keeping Only What Works',
    note:'More features is not better — the right features are everything in financial ML' },
  { type:'bullets', icon:'⚠️', heading:'The Feature Bloat Problem',
    items:['Adding irrelevant features increases noise and reduces model generalization','Correlated features add redundancy without signal — waste model capacity','With 100 features and 1000 samples, overfitting is virtually guaranteed','Optimal feature count for financial data: 15-30 features, carefully selected'] },
  { type:'code', icon:'💻', heading:'Feature Selection Pipeline',
    code:'from sklearn.feature_selection import mutual_info_classif\nimport xgboost as xgb\nimport numpy as np\n\ndef select_features(X_train, y_train, n_features=25):\n    # Step 1: Remove near-zero variance\n    var = X_train.var()\n    X_train = X_train.loc[:, var > 0.001]\n\n    # Step 2: Remove highly correlated pairs (keep higher MI)\n    corr = X_train.corr().abs()\n    mi   = mutual_info_classif(X_train.fillna(0), y_train)\n    mi   = dict(zip(X_train.columns, mi))\n    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))\n    to_drop = []\n    for col in upper.columns:\n        high = upper[upper[col] > 0.85][col].index.tolist()\n        if high and mi[col] <= mi[high[0]]:\n            to_drop.append(col)\n    X_train = X_train.drop(columns=to_drop)\n\n    # Step 3: XGBoost importance\n    model = xgb.XGBClassifier(n_estimators=200, max_depth=3)\n    model.fit(X_train.fillna(0), y_train)\n    imp = pd.Series(model.feature_importances_, index=X_train.columns)\n    top_features = imp.nlargest(n_features).index.tolist()\n    return top_features, imp',
    note:'Always run selection on training data only — never use test set statistics for feature selection' },
  { type:'bullets', icon:'🔑', heading:'Three-Stage Selection Process',
    items:['Stage 1 — Variance filter: drop features with < 0.1% variance (constant or near-constant)','Stage 2 — Correlation filter: remove one of any pair with > 0.85 correlation, keep higher MI','Stage 3 — Importance filter: XGBoost feature importances, permutation importance for validation','Bonus check: Stability — does the same feature appear important across multiple time windows?'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Run 3-stage selection: variance, correlation, importance — strictly on training data','Target 15-30 features for most financial ML models — quality beats quantity','Permutation importance is more reliable than impurity-based importance for correlated features','Stability testing confirms whether a feature ranks highly across different training periods'] }
],

'5.7': [
  { type:'title', badge:'MODULE 5', icon:'🏭', heading:'Feature Engineering Pipeline',
    sub:'Lesson 5.7 · Production-Ready Pipeline Architecture',
    note:'Build a pipeline that is reproducible, testable, and deployable — not just a Jupyter notebook' },
  { type:'bullets', icon:'🏗️', heading:'What Makes a Pipeline Production-Ready?',
    items:['Deterministic: same inputs always produce the same outputs — no random seeds without logging','Testable: each transform can be unit-tested independently for correctness','Incremental: new data flows through without re-processing historical data','Versioned: feature set v1, v2, v3 — roll back if new features hurt live performance'] },
  { type:'code', icon:'💻', heading:'Reusable Feature Pipeline Class',
    code:'class FeaturePipeline:\n    # Production feature engineering pipeline\n\n    def __init__(self, feature_version="v1"):\n        self.version  = feature_version\n        self.scaler   = None\n        self.features = None\n\n    def fit_transform(self, df):\n        # Fit on training data — call ONCE on training set\n        X = self._build_features(df)\n        self.features = X.columns.tolist()\n        from sklearn.preprocessing import RobustScaler\n        self.scaler = RobustScaler()\n        X_scaled = pd.DataFrame(\n            self.scaler.fit_transform(X.fillna(0)),\n            index=X.index, columns=self.features)\n        return X_scaled\n\n    def transform(self, df):\n        # Transform new data using fitted scaler — never re-fits\n        if self.scaler is None:\n            raise RuntimeError("Call fit_transform on training data first")\n        X = self._build_features(df)[self.features]\n        return pd.DataFrame(\n            self.scaler.transform(X.fillna(0)),\n            index=X.index, columns=self.features)\n\n    def _build_features(self, df):\n        df = build_advanced_indicators(df.copy())\n        df = build_microstructure_features(df)\n        df = build_vol_regime_features(df)\n        return df[[c for c in df.columns\n                   if c not in ["Open","High","Low","Close","Volume"]]]',
    note:'Key rule: fit_transform once on training data, then only transform on test or live data' },
  { type:'bullets', icon:'📋', heading:'Pipeline Best Practices',
    items:['Save pipeline state with joblib — scaler, feature list, and version together as one bundle','Log feature statistics on each run: mean, std, null rate — alert on distribution shift','Test pipeline with 1 day of data before running on 5 years — fast feedback loop','Version your features in filenames: spy_features_v2_20260101.parquet'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['A production pipeline has fit_transform (training only) and transform (inference) separation','Save scaler, feature list, and version as a bundle — you need all three to reproduce predictions','Log feature statistics to detect distribution shift — models fail when input distribution changes','Version your feature engineering code with tags so you can roll back to a known-good state'] }
],

'5.8': [
  { type:'title', badge:'MODULE 5', icon:'🏆', heading:'Capstone: 60-Feature SPY Signal',
    sub:'Lesson 5.8 · Module 5 Capstone Project',
    note:'Integrate all Module 5 techniques into a production-grade 60-feature alpha signal' },
  { type:'bullets', icon:'🎯', heading:'Capstone Architecture: 60 Features Across 5 Groups',
    items:['Group 1 — Momentum (12 features): multi-period returns, KAMA, ROC, Hurst exponent','Group 2 — Microstructure (10 features): VWAP dev, Amihud, range ratio, vol z-score','Group 3 — Volatility regime (12 features): RVol 5/10/21/63d, vol of vol, VIX ratio','Group 4 — Cross-asset macro (16 features): TLT, GLD, VIX, sectors — returns plus trends','Group 5 — Alternative data (10 features): search trends, sentiment composites, insider signal'] },
  { type:'code', icon:'💻', heading:'60-Feature Pipeline Integration',
    code:'def build_full_feature_set(df, macro_data=None,\n                          alt_data=None):\n    # Build complete 60-feature set for SPY signal\n    df = build_advanced_indicators(df.copy())    # ~12 features\n    df = build_microstructure_features(df)        # ~10 features\n    df = build_vol_regime_features(df)            # ~12 features\n    if macro_data is not None:\n        df = merge_macro_features(df, macro_data) # ~16 features\n    if alt_data is not None:\n        df = merge_alt_features(df, alt_data)     # ~10 features\n\n    # Target: next-day direction\n    df["target"] = (df["Close"].shift(-1) > df["Close"]).astype(int)\n\n    # Drop lookahead and missing\n    feature_cols = [c for c in df.columns\n                    if c not in ["Open","High","Low",\n                                 "Close","Volume","target"]]\n    df = df.dropna(subset=feature_cols + ["target"])\n    return df, feature_cols\n\n# Selection narrows 60 to 25 best features\nX, y = df[feature_cols], df["target"]\ntop_features, importances = select_features(\n    X.iloc[:split], y.iloc[:split])',
    note:'With 60 candidate features and proper selection, XGBoost walk-forward Sharpe typically reaches 1.3-1.8' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['60 candidate features across 5 groups — select best 20-25 for the final model','Walk-forward validation with this feature set consistently outperforms basic 15-feature models','Cross-asset macro features (TLT, VIX) are almost always in the top 10 selected features','This 60-feature pipeline is the foundation for all subsequent Pro tier modules'] }
],

// ═══════════════════════════════════════════════════════════════════
// MODULE 6 — NLP & Alternative Data  (color: #4ade80)
// ═══════════════════════════════════════════════════════════════════

'6.1': [
  { type:'title', badge:'MODULE 6', icon:'📰', heading:'NLP for Financial News',
    sub:'Lesson 6.1 · Natural Language Processing Fundamentals',
    note:'Turn unstructured text into quantitative trading signals' },
  { type:'bullets', icon:'🧠', heading:'Why NLP Signals Are Valuable',
    items:['News moves markets before price reflects it — text is ahead of the tape','Institutional sentiment shifts appear in analyst reports 24-48 hours before trades','Earnings call tone predicts post-earnings drift with IC > 0.08 — highly significant','Traditional indicators lag news; NLP signals can be concurrent or leading'] },
  { type:'code', icon:'💻', heading:'VADER & FinBERT Sentiment Scoring',
    code:'from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer\nfrom transformers import pipeline\n\n# Fast VADER (rule-based, works well for financial text)\nvader = SentimentIntensityAnalyzer()\n\ndef vader_score(text: str) -> float:\n    # Returns compound score: -1 (most negative) to +1 (most positive)\n    return vader.polarity_scores(text)["compound"]\n\n# Accurate FinBERT (transformer fine-tuned on financial text)\nfinbert = pipeline("text-classification",\n    model="ProsusAI/finbert",\n    return_all_scores=True)\n\ndef finbert_score(text: str) -> float:\n    # Returns score from -1 to +1 using FinBERT probabilities\n    scores = finbert(text[:512])[0]  # truncate to model max length\n    d = {s["label"]: s["score"] for s in scores}\n    return d.get("positive", 0) - d.get("negative", 0)\n\n# VADER: fast, good for headlines\n# FinBERT: slower, better for long-form analyst text',
    note:'FinBERT outperforms VADER by 15-20% on financial text — worth the slower inference speed' },
  { type:'bullets', icon:'📊', heading:'Text Sources Ranked by Signal Quality',
    items:['#1 SEC 8-K filings: material events — price moves within hours of filing','#2 Earnings call transcripts: management tone predicts 30-day post-earnings drift','#3 Analyst reports: upgrade or downgrade language often precedes price moves by 1-2 days','#4 News headlines: high noise but high volume — aggregate 50+ articles for stable signal'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['FinBERT outperforms general-purpose sentiment models on financial text by 15-20%','SEC filings and earnings call transcripts give the highest-quality text signals','Aggregate multiple articles per day — single headline sentiment is too noisy to trade','Combine NLP sentiment with price features — NLP alone rarely produces a complete edge'] }
],

'6.2': [
  { type:'title', badge:'MODULE 6', icon:'📡', heading:'News Sentiment Pipeline',
    sub:'Lesson 6.2 · Real-Time News Processing',
    note:'Build a production news ingestion and scoring pipeline that runs continuously' },
  { type:'bullets', icon:'🔄', heading:'Pipeline Architecture Overview',
    items:['Ingest: fetch articles from News API, RSS feeds, or financial data providers','Clean: strip HTML, normalize Unicode, deduplicate by headline similarity','Score: batch process through VADER (fast) then FinBERT (accurate) in two passes','Aggregate: compute daily sentiment score per ticker — exponentially weighted by recency'] },
  { type:'code', icon:'💻', heading:'News Aggregation & Daily Sentiment Score',
    code:'import requests\nfrom datetime import datetime, timedelta\n\nNEWS_API_KEY = "your_key_here"\n\ndef fetch_news(ticker: str, days=1) -> list:\n    url = "https://newsapi.org/v2/everything"\n    params = {\n        "q": ticker, "language": "en",\n        "from": (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d"),\n        "sortBy": "publishedAt", "apiKey": NEWS_API_KEY, "pageSize": 50\n    }\n    r = requests.get(url, params=params, timeout=10)\n    return r.json().get("articles", [])\n\ndef daily_sentiment(ticker: str) -> dict:\n    # Compute exponentially-weighted daily sentiment score\n    articles = fetch_news(ticker, days=2)\n    scores, weights = [], []\n    for art in articles:\n        text = (art["title"] or "") + " " + (art["description"] or "")\n        if len(text.strip()) < 20: continue\n        score = vader_score(text)\n        age_h = max(0.5, (datetime.now() -\n            datetime.fromisoformat(art["publishedAt"][:19])).total_seconds()/3600)\n        scores.append(score)\n        weights.append(1 / age_h)\n    if not scores:\n        return {"ticker": ticker, "sentiment": 0, "n_articles": 0}\n    weighted = sum(s*w for s,w in zip(scores,weights)) / sum(weights)\n    return {"ticker": ticker, "sentiment": round(weighted, 4),\n            "n_articles": len(scores)}',
    note:'Exponential recency weighting gives articles from the last 2 hours 6x more weight than 12-hour-old articles' },
  { type:'bullets', icon:'⚙️', heading:'Production Pipeline Considerations',
    items:['Rate limits: NewsAPI free tier = 100 requests/day — use RSS feeds for higher frequency','Deduplication: hash headline to avoid scoring the same story from 5 different outlets','Staleness: flag if sentiment is based on < 5 articles — not enough signal to trade on','Cache scores: save to SQLite with timestamp — avoid re-fetching on every model run'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Recency-weighted aggregation outperforms simple daily averages for news sentiment','Deduplicate by headline hash before scoring — syndicated stories inflate perceived signal','Log article count per ticker: < 5 articles means the sentiment score is unreliable','Store raw scores in a database — you can backtest different aggregation methods later'] }
],

'6.3': [
  { type:'title', badge:'MODULE 6', icon:'💬', heading:'Reddit & Social Sentiment',
    sub:'Lesson 6.3 · Crowd Intelligence Signals',
    note:'Extract tradeable signals from social media noise — and avoid the traps' },
  { type:'bullets', icon:'⚡', heading:'Social Sentiment: Signal vs Noise',
    items:['r/wallstreetbets mention spikes reliably precede retail buying waves by 12-48 hours','Twitter stock cashtag volume correlates with retail option volume surges','Extreme bullish social sentiment (> 95th percentile) is often contrarian — fade it','Moderate positive social sentiment combined with price breakout is the highest-conviction signal'] },
  { type:'code', icon:'💻', heading:'Reddit PRAW Sentiment Extraction',
    code:'import praw, re\nfrom collections import defaultdict\n\nreddit = praw.Reddit(\n    client_id="your_id",\n    client_secret="your_secret",\n    user_agent="trading_signal_bot/1.0"\n)\n\ndef get_wsb_mentions(tickers: list, limit=500) -> dict:\n    # Count mentions and compute sentiment per ticker in recent WSB posts\n    wsb = reddit.subreddit("wallstreetbets")\n    counts = defaultdict(int)\n    scores = defaultdict(list)\n\n    for post in wsb.new(limit=limit):\n        text = (post.title + " " + (post.selftext or ""))[:2000]\n        for ticker in tickers:\n            if re.search(r"\\b\\$?" + ticker + r"\\b", text, re.IGNORECASE):\n                counts[ticker] += 1\n                scores[ticker].append(vader_score(text))\n\n    return {\n        t: {\n            "mentions": counts[t],\n            "sentiment": (sum(scores[t])/len(scores[t])) if scores[t] else 0,\n            "sentiment_std": float(pd.Series(scores[t]).std()) if scores[t] else 0\n        }\n        for t in tickers if counts[t] > 0\n    }',
    note:'sentiment_std > 0.5 means the crowd is divided — often signals an upcoming volatile catalyst' },
  { type:'bullets', icon:'🎯', heading:'How to Trade Social Signals',
    items:['Mention surge (> 3 sigma above 30d average) + positive sentiment means retail buying incoming','Extreme sentiment (> 95th pct) is a fade signal — crowded retail positioning often reverses','Low mentions + unusual option activity indicates institutional positioning before retail awareness','Combine social mentions with GEX: bullish social + positive GEX = high-conviction long setup'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Reddit signals work best as an early-warning system for retail activity waves','Extreme social sentiment is contrarian — the best shorts come when WSB is maximally bullish','sentiment_std (disagreement) often predicts volatile outcomes better than the mean sentiment','Always normalize mention counts by z-score — raw counts are not comparable across tickers'] }
],

'6.4': [
  { type:'title', badge:'MODULE 6', icon:'🤖', heading:'Earnings Calls with LLMs',
    sub:'Lesson 6.4 · AI-Powered Transcript Analysis',
    note:'Use Claude or GPT-4 to extract structured trading signals from earnings call transcripts' },
  { type:'bullets', icon:'📋', heading:'What Earnings Calls Reveal',
    items:['Management guidance tone predicts post-earnings drift direction with IC 0.06-0.10','Forward guidance language changes signal strategic pivots before they appear in financials','Analyst Q&A evasiveness correlates with negative surprises — hedging language is a red flag','Management confidence index: specific numbers and direct answers vs vague qualifiers'] },
  { type:'code', icon:'💻', heading:'LLM Earnings Analysis with Claude',
    code:'import anthropic, json\n\nclient = anthropic.Anthropic()\n\ndef analyze_earnings_call(transcript: str, ticker: str) -> dict:\n    # Extract structured sentiment signals from earnings transcript\n    prompt = (\n        f"Analyze this {ticker} earnings call transcript.\\n\\n"\n        "Return a JSON object with exactly these fields:\\n"\n        "- guidance_tone: number from -2 (very bearish) to +2 (very bullish)\\n"\n        "- confidence_score: 0 to 1 (how specific/confident is management?)\\n"\n        "- key_risks: list of up to 3 risks mentioned\\n"\n        "- key_positives: list of up to 3 strengths highlighted\\n"\n        "- analyst_reception: positive, neutral, or skeptical\\n"\n        "- summary: one sentence overall tone\\n\\n"\n        f"Transcript (first 3000 chars):\\n{transcript[:3000]}\\n\\n"\n        "Respond with valid JSON only."\n    )\n    msg = client.messages.create(\n        model="claude-haiku-4-5-20251001",\n        max_tokens=512,\n        messages=[{"role": "user", "content": prompt}]\n    )\n    return json.loads(msg.content[0].text)\n\n# Cost: ~$0.001 per call with Haiku — very affordable at scale',
    note:'claude-haiku-4-5-20251001 costs ~$0.001 per earnings call analysis — run all S&P 500 companies for under $1' },
  { type:'bullets', icon:'💡', heading:'Structuring the LLM Signal',
    items:['guidance_tone > +1.0 plus beat surprise > 2% means post-earnings upward drift is likely','confidence_score < 0.4 plus analyst reception skeptical means fade the initial gap up','Run on 8 consecutive quarters — trend in guidance_tone is more predictive than single quarter','Combine with option implied move: small implied plus bullish tone means pricing model risk is on your side'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['LLM analysis of earnings calls extracts structured signals from unstructured text at scale','guidance_tone and confidence_score are the two highest-predictive fields from the analysis','Run on 8 quarters to detect trend changes in management tone — single quarter is noisy','Cost is negligible: Haiku at $0.001/call means $500 covers entire S&P 500 for a full year'] }
],

'6.5': [
  { type:'title', badge:'MODULE 6', icon:'⚗️', heading:'Sentiment Feature Pipeline',
    sub:'Lesson 6.5 · Combining NLP Signals for ML',
    note:'Aggregate all NLP sources into a single ML-ready feature matrix' },
  { type:'bullets', icon:'🔧', heading:'Aggregating Disparate Text Sources',
    items:['Each NLP source has different frequency, coverage, and signal strength','News: daily, 5-50 articles per ticker — exponential recency weighting','Social: hourly spikes, very noisy — use z-score normalization over 30-day window','Earnings: quarterly, high signal — use 8-quarter rolling trend feature, not just latest'] },
  { type:'code', icon:'💻', heading:'Unified Sentiment Feature Builder',
    code:'def build_sentiment_features(df, ticker,\n                              news_db, social_db):\n    # Merge all sentiment signals into ML feature columns\n\n    # News sentiment: 1d, 5d, and momentum\n    ns = news_db[news_db.ticker == ticker].set_index("date")["sentiment"]\n    df["news_sent_1d"] = ns.reindex(df.index).fillna(0)\n    df["news_sent_5d"] = df["news_sent_1d"].rolling(5).mean()\n    df["news_momentum"] = df["news_sent_1d"] - df["news_sent_5d"]\n\n    # Social mentions z-score\n    sm = social_db[social_db.ticker == ticker].set_index("date")\n    mu_30  = sm["mentions"].reindex(df.index).fillna(0).rolling(30).mean()\n    std_30 = sm["mentions"].reindex(df.index).fillna(0).rolling(30).std().replace(0,1)\n    df["social_mentions_z"] = (sm["mentions"].reindex(df.index).fillna(0) - mu_30) / std_30\n    df["social_sent"]    = sm["sentiment"].reindex(df.index).fillna(0)\n\n    # Combined NLP composite (weighted average)\n    df["nlp_composite"] = (\n        0.4 * df["news_sent_5d"] +\n        0.3 * df["social_sent"] +\n        0.3 * df["news_momentum"].clip(-1, 1)\n    )\n    return df',
    note:'nlp_composite typically ranks in the top 5 features when added to a price-based XGBoost model' },
  { type:'bullets', icon:'📊', heading:'Sentiment Feature Quality Checks',
    items:['Coverage check: what % of trading days have at least 1 article? < 60% = unreliable','Autocorrelation check: news_sent_5d should have AC < 0.9 — highly correlated = redundant','IC check: compute information coefficient against next-day return — must be > 0.02 to include','Regime stability: does the IC hold across bull and bear markets, or only in one regime?'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Unify news, social, and earnings signals into a single nlp_composite feature','Use 5-day smoothing for news sentiment — daily scores are too noisy for direct use','Always check IC > 0.02 before including a sentiment feature — many have no predictive value','Combine with price features: nlp_composite alone is weak; combined with momentum, it is strong'] }
],

'6.6': [
  { type:'title', badge:'MODULE 6', icon:'🏆', heading:'Capstone: News-Driven Signal',
    sub:'Lesson 6.6 · Module 6 Capstone Project',
    note:'Build a complete news and social sentiment alpha signal for 10 large-cap stocks' },
  { type:'bullets', icon:'🎯', heading:'Capstone Deliverables',
    items:['Live news fetching pipeline: NewsAPI plus RSS feeds, runs every 4 hours, scores 10 tickers','Reddit WSB sentiment: daily mention count plus VADER sentiment, z-scored over 30-day window','Daily nlp_composite feature: weighted average of news, social, and earnings trend signals','Integrated ML signal: add nlp_composite to Module 5 60-feature set, re-run walk-forward validation'] },
  { type:'code', icon:'💻', heading:'Capstone: News-Enhanced XGBoost Signal',
    code:'def run_news_enhanced_signal(ticker="SPY"):\n    # Full pipeline: price features + NLP composite → XGBoost signal\n\n    # 1. Load price data and build Module 5 features\n    df = yf.Ticker(ticker).history(period="3y")\n    df, price_features = build_full_feature_set(df)\n\n    # 2. Build NLP features (requires pre-populated DBs)\n    news_db   = pd.read_parquet(f"data/{ticker}_news.parquet")\n    social_db = pd.read_parquet(f"data/{ticker}_social.parquet")\n    df = build_sentiment_features(df, ticker, news_db, social_db)\n    nlp_features = ["news_sent_1d","news_sent_5d",\n                    "news_momentum","social_mentions_z",\n                    "social_sent","nlp_composite"]\n\n    all_features = price_features + nlp_features\n\n    # 3. Walk-forward validation\n    results = walk_forward_validate(\n        df, all_features, "target",\n        train_days=252, test_days=63)\n\n    # 4. Report improvement vs price-only baseline\n    print(f"Price-only Sharpe:   {results[\'baseline_sharpe\']:.2f}")\n    print(f"NLP-enhanced Sharpe: {results[\'sharpe\']:.2f}")\n    print(f"IC improvement: {results[\'ic_delta\']:+.3f}")\n    return results',
    note:'Adding NLP composite typically improves Sharpe by 0.15-0.30 over price-only baseline' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['NLP signals add orthogonal alpha — news sentiment captures what price patterns miss','Adding nlp_composite to a price-based model typically improves Sharpe by 0.15-0.30','The hardest part is data collection and cleaning — the ML integration is straightforward','Module 7 will teach you to backtest this combined signal rigorously with realistic costs'] }
],

// ═══════════════════════════════════════════════════════════════════
// MODULE 7 — Advanced Backtesting  (color: #a78bfa)
// ═══════════════════════════════════════════════════════════════════

'7.1': [
  { type:'title', badge:'MODULE 7', icon:'📊', heading:'Advanced Backtesting with Vectorbt',
    sub:'Lesson 7.1 · High-Performance Backtesting',
    note:'Vectorbt runs 1000x faster than event-loop backtesting — backtest thousands of parameters in seconds' },
  { type:'bullets', icon:'⚡', heading:'Why Vectorbt Changes the Game',
    items:['Event-loop backtesting (Backtrader): processes one bar at a time — hours for large datasets','Vectorbt: vectorized NumPy operations — processes entire time series in milliseconds','1000 parameter combinations in the time a loop-based backtester handles 1','Enables true out-of-sample parameter sweep validation that was previously impractical'] },
  { type:'code', icon:'💻', heading:'Vectorbt Portfolio Backtest',
    code:'import vectorbt as vbt\nimport numpy as np\n\ndef run_vbt_backtest(df, signal_col="signal", cost_bps=5):\n    price   = df["Close"]\n    entries = df[signal_col] == 1   # long signal\n    exits   = df[signal_col] == -1  # short/exit signal\n\n    pf = vbt.Portfolio.from_signals(\n        price,\n        entries=entries,\n        exits=exits,\n        fees=cost_bps / 10000,    # cost per trade\n        slippage=0.001,            # 10bps slippage\n        init_cash=100_000,\n        freq="D"\n    )\n\n    stats = pf.stats()\n    return {\n        "total_return" : stats["Total Return [%]"],\n        "sharpe"       : stats["Sharpe Ratio"],\n        "max_dd"       : stats["Max Drawdown [%]"],\n        "win_rate"     : stats["Win Rate [%]"],\n        "n_trades"     : stats["Total Trades"],\n        "calmar"       : stats["Calmar Ratio"],\n    }',
    note:'vectorbt.Portfolio.from_signals is the fastest way to backtest directional ML signals' },
  { type:'bullets', icon:'🔧', heading:'Key Vectorbt Features for ML Trading',
    items:['from_signals: simple long/short entry-exit signals — maps directly to ML signal column','from_order_func: custom order logic for complex position sizing or conditional entry','Portfolio grouping: backtest SPY, QQQ, AAPL, NVDA simultaneously with shared capital','Built-in metrics: Sharpe, Calmar, max drawdown, trade-level analysis — no custom code needed'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Vectorbt is 100-1000x faster than event-loop backtesting for parameter optimization','Use from_signals for directional ML signals — it maps cleanly to predict_proba output','Always include fees=5bps and slippage=10bps — costs kill more strategies than bad signals','The speed enables 1000-parameter sweeps for robust out-of-sample parameter validation'] }
],

'7.2': [
  { type:'title', badge:'MODULE 7', icon:'🏗️', heading:'Multi-Asset Backtest Engine',
    sub:'Lesson 7.2 · Portfolio-Level Simulation',
    note:'Backtest across 10+ assets simultaneously to validate diversification and correlation effects' },
  { type:'bullets', icon:'🌐', heading:'From Single-Asset to Portfolio Backtest',
    items:['Single-asset backtest misses correlation costs: you cannot be long SPY and QQQ in a crash','Capital allocation across assets is a second-order return driver — not just signal quality','Portfolio-level max drawdown is often 2-3x worse than individual asset drawdowns','Multi-asset backtest reveals the true worst-case scenario you will face live'] },
  { type:'code', icon:'💻', heading:'Multi-Asset Portfolio Backtest',
    code:'def multi_asset_backtest(signals, prices,\n                         capital=100_000, cost_bps=5):\n    import vectorbt as vbt\n\n    tickers  = list(signals.keys())\n    price_df = pd.DataFrame({t: prices[t]  for t in tickers}).dropna()\n    sig_df   = pd.DataFrame({t: signals[t] for t in tickers}).reindex(price_df.index)\n\n    entries = sig_df == 1\n    exits   = sig_df == -1\n\n    pf = vbt.Portfolio.from_signals(\n        price_df,\n        entries=entries,\n        exits=exits,\n        fees=cost_bps / 10000,\n        slippage=0.001,\n        init_cash=capital / len(tickers),  # equal allocation\n        group_by=True,                      # treat as one portfolio\n        cash_sharing=True,                  # shared capital pool\n        freq="D"\n    )\n\n    stats = pf.stats(group_by=True)\n    rets  = pf.returns(group_by=True)\n    return stats, rets',
    note:'cash_sharing=True allows the portfolio to concentrate capital in the highest-conviction signals' },
  { type:'bullets', icon:'📊', heading:'What Multi-Asset Backtest Reveals',
    items:['Correlation clustering: when all assets signal long simultaneously, drawdowns amplify','Capital efficiency: cash_sharing lets the model concentrate in best opportunities','Beta exposure: is the portfolio actually alpha or just leveraged beta to SPY?','Sector concentration risk: 5 tech stocks all signaling long = sector bet, not diversification'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Multi-asset backtests with cash_sharing are more realistic than summing single-asset results','Correlation spikes during drawdowns mean portfolio risk is always > sum of individual risks','Equal allocation is a naive baseline — Module 8 covers volatility-weighted allocation','Always plot the combined equity curve and correlation matrix across your asset universe'] }
],

'7.3': [
  { type:'title', badge:'MODULE 7', icon:'📐', heading:'Kelly Criterion & Position Sizing',
    sub:'Lesson 7.3 · Optimal Bet Sizing',
    note:'The mathematically optimal framework for sizing positions based on edge and odds' },
  { type:'bullets', icon:'🧮', heading:'Why Position Sizing Matters More Than Entry',
    items:['A strategy with 55% win rate can go bankrupt with 100% position sizing','Kelly Criterion: size proportional to your edge — over-betting destroys compounding','Half-Kelly in practice: markets are not coin flips — use 25-50% of theoretical Kelly','Volatility-targeting: scale position size to maintain constant portfolio volatility regardless of regime'] },
  { type:'code', icon:'💻', heading:'Kelly Position Sizing Implementation',
    code:'import numpy as np\n\ndef kelly_fraction(win_rate, avg_win, avg_loss):\n    # Compute full Kelly fraction from trade statistics\n    if avg_loss == 0 or win_rate <= 0 or win_rate >= 1:\n        return 0.0\n    b     = avg_win / abs(avg_loss)  # win/loss ratio\n    p, q  = win_rate, 1 - win_rate\n    kelly = (b * p - q) / b\n    return max(0, kelly)             # never go short Kelly\n\ndef volatility_target_size(signal_strength, realized_vol,\n                            target_vol=0.15, max_position=1.0):\n    # Scale position size to hit target_vol regardless of regime\n    if realized_vol <= 0:\n        return 0.0\n    base_size = target_vol / (realized_vol * np.sqrt(252))\n    sized     = base_size * abs(signal_strength)\n    return float(np.clip(sized, 0, max_position))\n\n# Example: model gives 0.62 probability up\nprob_up    = 0.62\nraw_kelly  = kelly_fraction(prob_up, 0.008, 0.009)\nhalf_kelly = raw_kelly * 0.5  # use half-Kelly in practice\nprint(f"Full Kelly: {raw_kelly:.1%}  Half-Kelly: {half_kelly:.1%}")',
    note:'With 62% accuracy and 1:1.1 win/loss ratio, full Kelly is ~16% — half-Kelly = 8% position' },
  { type:'bullets', icon:'⚖️', heading:'Sizing Framework in Practice',
    items:['Full Kelly is too aggressive for real trading — use 25-50% of theoretical Kelly only','Volatility targeting: 15% annualized vol target divides position by current volatility','Signal confidence scaling: size = base_size × sigmoid(model_probability - 0.5) × 2','Hard caps: never > 20% of portfolio in a single position regardless of Kelly output'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Kelly Criterion is mathematically optimal for long-run growth — but use 25-50% in practice','Volatility targeting maintains constant risk across low-vol and high-vol regimes','Scale position size with model probability: 0.7 probability means larger size than 0.55','Hard cap at 15-20% per position regardless of formula output — models are wrong sometimes'] }
],

'7.4': [
  { type:'title', badge:'MODULE 7', icon:'💰', heading:'Transaction Costs & Slippage',
    sub:'Lesson 7.4 · Modeling Realistic Execution',
    note:'Transaction costs are the single biggest reason live performance diverges from backtest' },
  { type:'bullets', icon:'⚠️', heading:'The Cost Illusion in Backtesting',
    items:['Most retail backtests assume zero or 1bps costs — reality is 5-15bps round-trip','Slippage scales with order size: 1000 SPY shares vs 100 SPY shares have very different fills','Frequent trading strategies (daily signals) pay 12%+ annually in costs — a massive hurdle','A Sharpe 1.5 strategy before costs becomes Sharpe 0.4 after realistic costs — common outcome'] },
  { type:'code', icon:'💻', heading:'Realistic Cost Model',
    code:'def compute_realistic_costs(symbol, avg_daily_volume,\n                             position_shares, price):\n    # Model realistic transaction costs for a single trade\n\n    # Bid-ask spread component (liquid ETFs ~1-2bps, single stocks 3-10bps)\n    spread_map = {"SPY":0.0001, "QQQ":0.0001, "AAPL":0.0002,\n                  "NVDA":0.0003, "TSLA":0.0004}\n    half_spread = spread_map.get(symbol, 0.0005)\n\n    # Market impact: scales with participation rate (square root model)\n    participation = position_shares / (avg_daily_volume * 0.1)\n    impact_bps    = 5 * (participation ** 0.5)\n\n    # Commission (IB tiered: ~$0.35/100 shares)\n    commission     = max(1.0, position_shares * 0.0035)\n    commission_bps = commission / (position_shares * price) * 10000\n\n    total_bps = half_spread * 10000 + impact_bps + commission_bps\n    return {\n        "spread_bps"    : round(half_spread * 10000, 2),\n        "impact_bps"    : round(impact_bps, 2),\n        "commission_bps": round(commission_bps, 2),\n        "total_bps"     : round(total_bps, 2),\n        "round_trip_bps": round(total_bps * 2, 2)\n    }',
    note:'For SPY at $500, 1000 shares: spread 1bps + impact 2bps + commission 0.7bps = 3.7bps one-way, 7.4bps round-trip' },
  { type:'bullets', icon:'📊', heading:'Cost-Adjusted Signal Filtering',
    items:['Only trade when expected edge > round-trip cost: min model prob = 0.5 + cost/(avg_win+avg_loss)','Frequency optimization: daily vs weekly vs monthly — fewer trades dramatically lowers cost drag','Batch rebalancing: if 5 assets need adjustment, combine into one order session — saves 4 commissions','Minimize unnecessary trades: if position is within 2% of target, skip the rebalance'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Model round-trip costs at 7-10bps for liquid ETFs, 15-25bps for single stocks','Market impact scales with square root of participation rate — size matters for execution cost','Only trade when signal edge exceeds transaction cost: probability threshold rises with cost level','Always compare Sharpe before and after realistic costs — the gap reveals strategy fragility'] }
],

'7.5': [
  { type:'title', badge:'MODULE 7', icon:'📈', heading:'Portfolio Backtest Analysis',
    sub:'Lesson 7.5 · Reading the Full Performance Report',
    note:'Know which metrics to trust and which ones are misleading' },
  { type:'bullets', icon:'🔍', heading:'The Metrics That Actually Matter',
    items:['Sharpe ratio: risk-adjusted returns — above 1.0 is good, above 1.5 is excellent for live trading','Max drawdown: the largest peak-to-trough decline — your psychological test during live trading','Calmar ratio: annual return / max drawdown — above 1.0 means your returns justify the pain','Win rate alone is misleading: 40% win rate with 3:1 win/loss is better than 60% with 0.5:1'] },
  { type:'code', icon:'💻', heading:'Custom Performance Report Generator',
    code:'import pandas as pd\nimport numpy as np\n\ndef performance_report(returns, benchmark=None):\n    ann = 252\n    rets = returns.dropna()\n\n    total_ret  = (1 + rets).prod() - 1\n    ann_ret    = (1 + total_ret) ** (ann / len(rets)) - 1\n    vol        = rets.std() * np.sqrt(ann)\n    sharpe     = ann_ret / vol if vol > 0 else 0\n\n    cum      = (1 + rets).cumprod()\n    roll_max = cum.cummax()\n    dd       = (cum - roll_max) / roll_max\n    max_dd   = dd.min()\n    calmar   = ann_ret / abs(max_dd) if max_dd < 0 else 0\n\n    alpha = 0\n    if benchmark is not None:\n        bm   = benchmark.reindex(rets.index).fillna(0)\n        cov  = np.cov(rets, bm)\n        beta = cov[0][1] / cov[1][1] if cov[1][1] > 0 else 0\n        bm_ann  = (1 + bm.mean()) ** ann - 1\n        alpha   = ann_ret - beta * bm_ann\n\n    return pd.Series({\n        "Annual Return %"   : round(ann_ret  * 100, 2),\n        "Annual Vol %"      : round(vol      * 100, 2),\n        "Sharpe Ratio"      : round(sharpe,         2),\n        "Max Drawdown %"    : round(max_dd   * 100, 2),\n        "Calmar Ratio"      : round(calmar,         2),\n        "Alpha (vs SPY) %"  : round(alpha    * 100, 2),\n    })',
    note:'Alpha vs benchmark is the acid test: are you generating real skill, or just riding the market?' },
  { type:'bullets', icon:'🚨', heading:'Red Flags in Backtest Reports',
    items:['Sharpe > 3.0 almost always means overfitting or a bug such as lookahead or survivorship bias','Win rate > 70% with daily signals: check for lookahead bias — rare in real markets','Max drawdown < 5% on a daily equity strategy: position sizing is likely wrong','Calmar > 3 over a short period: very likely the backtest does not include a stress period'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Trust Sharpe, max drawdown, and Calmar together — no single metric tells the whole story','A real edge has Sharpe 0.8-2.0 with max drawdown 10-25% — extraordinary claims need extraordinary evidence','Alpha > 0 vs SPY benchmark is the most important test: are you better than just holding SPY?','Always plot the equity curve and drawdown chart — numbers alone hide problems in the time dimension'] }
],

'7.6': [
  { type:'title', badge:'MODULE 7', icon:'🎲', heading:'Monte Carlo Simulation',
    sub:'Lesson 7.6 · Stress-Testing Your Strategy',
    note:'The backtest shows one path history took — Monte Carlo shows 10,000 paths your strategy could take' },
  { type:'bullets', icon:'🔮', heading:'Why Monte Carlo Matters',
    items:['A single backtest is one random sample from the universe of possible outcomes','Bootstrap resampling creates 1000+ alternate histories with the same statistical properties','Monte Carlo reveals: what is the 5th percentile outcome? How bad could it realistically get?','Walk-forward gives one validation; Monte Carlo gives a confidence interval around that validation'] },
  { type:'code', icon:'💻', heading:'Bootstrap Monte Carlo for Trading Strategies',
    code:'import numpy as np\n\ndef monte_carlo_bootstrap(trade_returns, n_sims=1000,\n                           n_periods=252):\n    rets = trade_returns.dropna().values\n    all_sharpes, all_max_dds, all_finals = [], [], []\n\n    for _ in range(n_sims):\n        # Resample with replacement\n        sim = np.random.choice(rets, size=n_periods, replace=True)\n        cum = np.cumprod(1 + sim)\n\n        # Sharpe\n        ann_ret = cum[-1] ** (252/n_periods) - 1\n        vol     = sim.std() * np.sqrt(252)\n        sharpe  = ann_ret / vol if vol > 0 else 0\n\n        # Max drawdown\n        roll_max = np.maximum.accumulate(cum)\n        max_dd   = ((cum - roll_max) / roll_max).min()\n\n        all_sharpes.append(sharpe)\n        all_max_dds.append(max_dd)\n        all_finals.append(cum[-1] - 1)\n\n    return {\n        "sharpe_p5"    : float(np.percentile(all_sharpes, 5)),\n        "sharpe_p50"   : float(np.percentile(all_sharpes, 50)),\n        "sharpe_p95"   : float(np.percentile(all_sharpes, 95)),\n        "max_dd_p95"   : float(np.percentile(all_max_dds, 5)),\n        "return_p5"    : float(np.percentile(all_finals, 5)),\n        "prob_positive": float((np.array(all_finals) > 0).mean()),\n    }',
    note:'If the 5th percentile Sharpe is still positive, the strategy has a robust edge — not just lucky timing' },
  { type:'bullets', icon:'📊', heading:'Interpreting Monte Carlo Results',
    items:['Sharpe p5 > 0.5: strategy is robust — even bad luck scenarios show meaningful edge','max_dd p95 > 30%: the worst realistic scenario — size your live allocation to survive this','prob_positive < 80%: strategy is not robust enough — one in five paths loses money','Wide Sharpe range (p5=0.3, p95=2.5): signal is real but needs more data to validate'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Monte Carlo reveals the distribution of outcomes — the backtest is just one sample path','A robust strategy has Sharpe p5 > 0.5 and prob_positive > 85%','Always set your live allocation based on Monte Carlo worst-case drawdown, not median outcome','Wide confidence intervals are a warning: more walk-forward validation is needed before going live'] }
],

'7.7': [
  { type:'title', badge:'MODULE 7', icon:'📋', heading:'Professional Tearsheet',
    sub:'Lesson 7.7 · Institutional-Quality Reporting',
    note:'Build the same performance report hedge funds use to evaluate strategy viability' },
  { type:'bullets', icon:'📄', heading:'What a Professional Tearsheet Contains',
    items:['Page 1: equity curve, drawdown chart, and rolling 12-month Sharpe timeline','Page 2: trade-level statistics — distribution of wins/losses, holding periods, best/worst trades','Page 3: regime analysis — performance in bull, bear, sideways, low-vol, and high-vol markets','Page 4: risk decomposition — how much return comes from beta vs true alpha?'] },
  { type:'code', icon:'💻', heading:'Automated Tearsheet with Quantstats',
    code:'import quantstats as qs\nimport yfinance as yf\nimport pandas as pd\n\ndef generate_tearsheet(strategy_returns,\n                        benchmark_ticker="SPY",\n                        output_file="tearsheet.html"):\n    # Fetch benchmark\n    bm = yf.Ticker(benchmark_ticker).history(period="max")["Close"]\n    bm_rets = bm.pct_change().dropna()\n    bm_rets.index = bm_rets.index.tz_localize(None)\n\n    # Align dates\n    strat = strategy_returns.dropna()\n    strat.index = pd.to_datetime(strat.index)\n    bm_rets = bm_rets.reindex(strat.index).fillna(0)\n\n    # Generate full HTML tearsheet\n    qs.reports.html(strat, benchmark=bm_rets,\n                    output=output_file,\n                    title="ML Trading Signal Performance")\n    print(f"Tearsheet saved: {output_file}")\n\n    # Key headline numbers\n    print("\\n--- Headline Metrics ---")\n    print("Sharpe:", qs.stats.sharpe(strat).round(2))\n    print("Max DD:", qs.stats.max_drawdown(strat).round(4))\n    print("Calmar:", qs.stats.calmar(strat).round(2))',
    note:'quantstats generates a 30-page interactive HTML report in one function call — standard in professional quant shops' },
  { type:'bullets', icon:'🎯', heading:'Regime Analysis: The Hidden Performance Test',
    items:['Split returns by VIX regime: low (<15), medium (15-25), high (>25) — report Sharpe in each','SPY trend regime: 200d SMA bull/bear — does the strategy work in both directions?','Seasonality: does performance concentrate in Q4? That is a risk, not a feature','Autocorrelation of daily returns: significant AC means the model is taking regime bets, not picks'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['A professional tearsheet requires equity curve, regime breakdown, and risk decomposition','Quantstats generates an institutional-quality HTML report in one function call','Regime analysis is the most revealing test: strategies that only work in bull markets are not alpha','Save tearsheets with datestamps — compare v1 vs v2 to verify improvements are real'] }
],

// ═══════════════════════════════════════════════════════════════════
// MODULE 8 — Options ML  (color: #fb923c)
// ═══════════════════════════════════════════════════════════════════

'8.1': [
  { type:'title', badge:'MODULE 8', icon:'🔬', heading:'Options Greeks for ML',
    sub:'Lesson 8.1 · Options Mechanics as Features',
    note:'Options market data contains forward-looking signals that price history alone cannot provide' },
  { type:'bullets', icon:'📊', heading:'Why Options Data Predicts Equity Direction',
    items:['Options are priced on expected future volatility — they are forward-looking, not backward-looking','Delta reveals where dealers need to hedge — creating predictable gamma-driven price flows','Gamma exposure (GEX) predicts price pinning and vol suppression near large open interest strikes','Put/call volume imbalance precedes directional moves with 1-2 day lead time'] },
  { type:'code', icon:'💻', heading:'Greeks as ML Features',
    code:'import numpy as np\nfrom scipy.stats import norm\n\ndef black_scholes_greeks(S, K, T, r, sigma, option_type="call"):\n    # Compute full Greek set for a single option\n    if T <= 0 or sigma <= 0:\n        return dict(delta=0, gamma=0, vega=0, theta=0, iv=sigma)\n\n    d1 = (np.log(S/K) + (r + 0.5*sigma**2)*T) / (sigma*np.sqrt(T))\n    d2 = d1 - sigma * np.sqrt(T)\n\n    if option_type == "call":\n        delta = norm.cdf(d1)\n        price = S*norm.cdf(d1) - K*np.exp(-r*T)*norm.cdf(d2)\n    else:\n        delta = -norm.cdf(-d1)\n        price = K*np.exp(-r*T)*norm.cdf(-d2) - S*norm.cdf(-d1)\n\n    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))\n    vega  = S * norm.pdf(d1) * np.sqrt(T) / 100\n    theta = -(S*norm.pdf(d1)*sigma/(2*np.sqrt(T)) +\n              r*K*np.exp(-r*T)*norm.cdf(d2)) / 365\n\n    return {"delta":delta, "gamma":gamma, "vega":vega,\n            "theta":theta, "price":price}\n\n# Key derived ML features:\n# put_call_delta_ratio: put OI delta / call OI delta (dealer hedge pressure)\n# aggregate_gamma: sum(gamma * OI) across all strikes (vol suppression signal)\n# charm: rate of delta decay as expiration approaches',
    note:'Aggregate gamma > 0 (positive GEX) suppresses volatility — VIX mean-reverts when GEX is strongly positive' },
  { type:'bullets', icon:'💡', heading:'Most Predictive Greek-Based Features',
    items:['Net delta (calls - puts): positive means dealers short delta and must buy on dips — bullish flow','Aggregate gamma: negative means dealers long gamma and sell into moves — vol suppression','Charm (rate of delta change): high charm means hedging flows accelerate as expiration nears','Vega concentration: high vega OI near ATM means large IV movement expected — position sizing alert'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Options Greeks encode forward-looking market expectations that historical price cannot capture','Net dealer delta tells you what price action is necessary to keep dealers hedged','Aggregate gamma predicts vol regime: positive GEX = vol suppression; negative GEX = vol expansion','Add Greek-derived features to your ML model — they are orthogonal to price-based features'] }
],

'8.2': [
  { type:'title', badge:'MODULE 8', icon:'📉', heading:'Predicting Implied Volatility',
    sub:'Lesson 8.2 · IV Forecasting with ML',
    note:'Predicting whether IV will rise or fall is one of the most actionable options signals' },
  { type:'bullets', icon:'🎯', heading:'Why IV Prediction Is Valuable',
    items:['Long gamma (straddles) profits when realized vol > implied vol — IV prediction tells you when','Short gamma (theta harvesting) profits when realized vol < implied vol — the opposite case','IV crush after earnings: predict IV will collapse post-announcement, then sell premium before','Term structure signals: VIX contango slope predicts mean reversion of short-term fear'] },
  { type:'code', icon:'💻', heading:'IV Prediction Feature Set',
    code:'def build_iv_prediction_features(df, vix_df):\n    # Build features for predicting next-day IV direction\n    c   = df["Close"]\n    ret = c.pct_change()\n\n    # Current IV level and history\n    df["iv"]          = vix_df["Close"].reindex(df.index).ffill()\n    df["iv_pct_rank"] = df["iv"].rolling(252).rank(pct=True)\n    df["iv_zscore"]   = ((df["iv"] - df["iv"].rolling(63).mean()) /\n                          df["iv"].rolling(63).std())\n\n    # IV vs realized vol (the volatility risk premium)\n    rvol = ret.rolling(21).std() * np.sqrt(252) * 100\n    df["vrp"]    = df["iv"] - rvol    # > 0 means IV is rich vs realized\n    df["vrp_5d"] = df["vrp"].rolling(5).mean()\n\n    # IV momentum: fast vs slow MA of IV\n    df["iv_momentum"] = (df["iv"].rolling(5).mean() /\n                         df["iv"].rolling(21).mean() - 1)\n\n    # Target: will IV be higher or lower in 5 trading days?\n    df["target_iv_up"] = (df["iv"].shift(-5) > df["iv"]).astype(int)\n\n    return df',
    note:'VRP (volatility risk premium) > 5 points: IV is expensive relative to realized vol — strong sell premium signal' },
  { type:'bullets', icon:'📊', heading:'Building the IV Direction Model',
    items:['Features: IV z-score, VRP, IV momentum, realized/implied ratio, VIX term structure slope','Target: IV in 5 days > IV today? Binary classification — same XGBoost framework as equity signal','IV z-score > 1.5 plus VRP > 5 plus IV momentum negative means IV likely to fall — sell premium setup','IV z-score < -1 plus realized vol rising means IV likely to increase — buy gamma (straddle/strangle)'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['VRP (IV minus realized vol) is the most predictive single feature for IV direction','IV z-score > 1.5 means IV is historically elevated — mean reversion is the base case','Sell premium when VRP > 5 and IV momentum is negative — the setup for theta harvesting','Buy gamma when IV z-score < -1 and realized vol is rising — cheap insurance before a move'] }
],

'8.3': [
  { type:'title', badge:'MODULE 8', icon:'⚡', heading:'0DTE Signal Detection',
    sub:'Lesson 8.3 · Same-Day Expiration Flow Analysis',
    note:'0DTE options now represent 45%+ of SPY volume — understanding this flow is essential' },
  { type:'bullets', icon:'🔥', heading:'The 0DTE Revolution',
    items:['0DTE (zero days to expiration) options expire same-day — pure intraday directional bets','45%+ of SPY daily volume is now 0DTE — this flow moves the underlying in real time','Large 0DTE call sweeps before 10am predict intraday upside with 65%+ accuracy','Negative gamma from dealer 0DTE exposure amplifies intraday moves during high-activity periods'] },
  { type:'code', icon:'💻', heading:'0DTE Flow Feature Engineering',
    code:'def build_0dte_features(flow_data, spot):\n    # Extract predictive features from 0DTE options flow\n    dte0 = flow_data[flow_data["dte"] == 0].copy()\n    if dte0.empty:\n        return {}\n\n    calls = dte0[dte0["type"] == "call"]\n    puts  = dte0[dte0["type"] == "put"]\n\n    # Net premium ratio (above 0.5 = calls dominating)\n    call_prem  = (calls["premium"] * calls["volume"]).sum()\n    put_prem   = (puts["premium"]  * puts["volume"]).sum()\n    total_prem = call_prem + put_prem\n    net_premium_ratio = call_prem / total_prem if total_prem > 0 else 0.5\n\n    # Sweep detection: large single trades (top 5%)\n    call_sweeps = calls[calls["size"] > calls["size"].quantile(0.95)]\n    put_sweeps  = puts[puts["size"]  > puts["size"].quantile(0.95)]\n    n_sweeps    = max(1, len(call_sweeps) + len(put_sweeps))\n    sweep_bias  = (len(call_sweeps) - len(put_sweeps)) / n_sweeps\n\n    # ATM concentration (within 0.3% of spot)\n    atm_calls = calls[abs(calls["strike"] - spot) / spot < 0.003]\n    atm_ratio = len(atm_calls) / max(1, len(calls))\n\n    return {\n        "net_premium_ratio": net_premium_ratio,\n        "sweep_bias"       : sweep_bias,\n        "atm_call_ratio"   : atm_ratio,\n        "call_prem_k"      : call_prem / 1000,\n        "put_prem_k"       : put_prem  / 1000,\n    }',
    note:'net_premium_ratio > 0.65 in the first 30 minutes predicts green close 68% of the time' },
  { type:'bullets', icon:'🎯', heading:'Trading 0DTE Signals',
    items:['net_premium_ratio > 0.65 in first 30 min plus sweep_bias > 0.3 = high-confidence intraday long','Neutral 0DTE flow (ratio 0.45-0.55) plus elevated IV = sell straddle, not directional play','atm_call_ratio > 0.6 means market makers accumulate ATM gamma and suppress vol intraday','Late-day put sweep surge: institutional hedging before close = short-term vol expansion'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['0DTE options represent 45%+ of SPY volume — ignoring this flow is ignoring half the market','net_premium_ratio in the first 30 minutes is the strongest intraday directional indicator','Sweep detection (large single trades) identifies institutional conviction vs retail noise','Combine 0DTE signal with GEX: same-direction signals from both = very high conviction'] }
],

'8.4': [
  { type:'title', badge:'MODULE 8', icon:'⚖️', heading:'Delta-Neutral Strategies',
    sub:'Lesson 8.4 · Volatility Trading Mechanics',
    note:'Make money from volatility itself, not just price direction — the professional approach' },
  { type:'bullets', icon:'🧮', heading:'Delta-Neutral Trading Concepts',
    items:['Delta-neutral: hedge away directional exposure — profit only from volatility or theta decay','Long straddle: buy call plus put ATM — profits if realized vol > implied vol by expiration','Short strangle: sell OTM call plus put — profits from theta decay when vol stays range-bound','Dynamic hedging: continuously rebalance delta to zero as stock price moves — gamma scalping'] },
  { type:'code', icon:'💻', heading:'Dynamic Delta Hedging Simulation',
    code:'def simulate_delta_hedge(price_path, position,\n                          hedge_freq="daily"):\n    # Simulate P&L of delta-neutral position with periodic rehedging\n    records = []\n    hedge_shares = 0\n\n    for date, price in price_path.items():\n        # Recompute Greeks at current price\n        greeks = black_scholes_greeks(\n            S=price,\n            K=position["strike"],\n            T=position["dte"] / 365,\n            r=0.045,\n            sigma=position["iv"] / 100,\n            option_type=position["type"]\n        )\n        current_delta = greeks["delta"] * position["contracts"] * 100\n\n        # Hedge cost: buy/sell shares to neutralize delta\n        hedge_trade = -current_delta - hedge_shares\n        hedge_cost  = abs(hedge_trade) * price * 0.0001  # 1bps cost\n        hedge_shares -= current_delta\n\n        # Option P&L (simplified mark-to-market)\n        option_pnl = ((greeks["price"] - position["entry_price"]) *\n                       position["contracts"] * 100)\n\n        records.append({"date": date, "price": price,\n            "delta": current_delta, "gamma": greeks["gamma"],\n            "option_pnl": option_pnl, "hedge_cost": hedge_cost})\n        position["dte"] = max(0, position["dte"] - 1)\n\n    return pd.DataFrame(records)',
    note:'Gamma scalping (long straddle plus daily rehedge) profits when realized vol > implied vol by at least 2 points' },
  { type:'bullets', icon:'💡', heading:'When to Use Each Strategy',
    items:['Long straddle: IV z-score < -1.0 plus catalyst (earnings, Fed) approaching = buy cheap gamma','Short strangle: IV z-score > 1.5 plus no catalyst plus GEX positive = sell rich premium','Calendar spread: near-term IV > long-term IV = sell near, buy far = term structure arbitrage','Delta-neutral gamma scalp: continuous rehedge between strikes — earns from realized vol path'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Delta-neutral positions profit from volatility mispricing, not price direction','Long straddles: use when IV is cheap and a catalyst is approaching — buy realized vol','Short strangles: use when IV is elevated and no catalysts are near — sell time decay','Dynamic hedging converts gamma exposure into P&L — works best when realized vol > implied vol'] }
],

'8.5': [
  { type:'title', badge:'MODULE 8', icon:'🌊', heading:'GEX as a Trading Feature',
    sub:'Lesson 8.5 · Gamma Exposure Mechanics',
    note:'GEX is the most reliable options-derived signal for predicting volatility regimes' },
  { type:'bullets', icon:'📊', heading:'Understanding Gamma Exposure',
    items:['GEX = sum of (gamma × open interest × 100 × spot²) across all strikes','Positive GEX: dealers bought options from retail — they hedge by selling into rallies (suppresses vol)','Negative GEX: dealers sold options to retail — they hedge by buying on dips (amplifies moves)','GEX flip point: the strike where GEX transitions from positive to negative — key support/resistance'] },
  { type:'code', icon:'💻', heading:'GEX Calculation and Features',
    code:'def compute_gex(option_chain, spot):\n    # Compute aggregate GEX and identify key levels\n    df = option_chain.copy()\n\n    # Calls: dealers short gamma (sold calls) = positive GEX\n    # Puts:  dealers long gamma (bought puts)  = negative GEX\n    call_mask = df["type"] == "call"\n    df.loc[call_mask,  "gex"] = ( df["gamma"] * df["open_interest"] * 100 * spot**2 * 0.01)\n    df.loc[~call_mask, "gex"] = (-df["gamma"] * df["open_interest"] * 100 * spot**2 * 0.01)\n\n    total_gex = df["gex"].sum()\n    by_strike = df.groupby("strike")["gex"].sum()\n\n    # Key levels\n    gamma_wall = by_strike[by_strike > 0].idxmax() if (by_strike > 0).any() else spot\n    put_wall   = by_strike[by_strike < 0].idxmin() if (by_strike < 0).any() else spot\n\n    # GEX flip: where positive transitions to negative\n    cum_gex = by_strike.sort_index().cumsum()\n    sign_ch = cum_gex[cum_gex.shift(1).fillna(0) * cum_gex < 0]\n    flip_level = sign_ch.index[0] if not sign_ch.empty else spot\n\n    return {\n        "total_gex_bn"  : total_gex / 1e9,\n        "gamma_wall"    : gamma_wall,\n        "put_wall"      : put_wall,\n        "flip_level"    : flip_level,\n        "gex_regime"    : "positive" if total_gex > 0 else "negative",\n        "by_strike"     : by_strike.to_dict(),\n    }',
    note:'total_gex_bn > +1.0 on SPY means strong vol suppression — VIX tends to decay for next 3-5 days' },
  { type:'bullets', icon:'🎯', heading:'Trading GEX Signals',
    items:['Positive GEX plus price near gamma wall: strong resistance, expect mean reversion','Negative GEX plus price below flip level: dealers amplify moves, volatility expansion signal','GEX flip level acts as magnet: price gravitates toward it as gamma exposure approaches zero','GEX regime change (pos to neg): this transition typically precedes a volatility event by 1-3 days'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['GEX regime (positive vs negative) is the single best predictor of realized volatility','Positive GEX suppresses vol: options sellers win, mean reversion trades work better','Negative GEX amplifies moves: directional trades work, volatility-selling strategies fail','GEX flip level is the most important price level to track — it is where dealer behavior inverts'] }
],

'8.6': [
  { type:'title', badge:'MODULE 8', icon:'🔍', heading:'Options Flow Scanner',
    sub:'Lesson 8.6 · Unusual Activity Detection',
    note:'Build the automated scanner that flags institutional options positioning in real time' },
  { type:'bullets', icon:'⚡', heading:'What Unusual Options Activity Signals',
    items:['Large single-trade sweeps (> $1M premium): institutional directional conviction','OTM call buying surge 2-5 weeks before earnings: anticipating positive surprise','Deep OTM put buying (> 3 delta): protective hedging by institutions = bearish signal','Skew compression: put premium falling relative to calls = risk-on shift underway'] },
  { type:'code', icon:'💻', heading:'Unusual Activity Scanner',
    code:'def scan_unusual_activity(option_chain, spot,\n                           volume_threshold=3.0):\n    # Flag unusual options activity above OI volume ratio threshold\n    df = option_chain.copy()\n\n    # Volume/OI ratio: > 3 means far more trades than existing positions\n    df["vol_oi_ratio"] = df["volume"] / df["open_interest"].replace(0, np.nan)\n\n    # Premium size\n    df["total_prem"] = df["premium"] * df["volume"] * 100\n\n    # Moneyness vs spot\n    df["moneyness"] = df["strike"] / spot - 1\n\n    # Flag criteria: unusual ratio + significant premium + top volume\n    unusual = df[\n        (df["vol_oi_ratio"] > volume_threshold) &\n        (df["total_prem"] > 50_000) &\n        (df["volume"] > df["volume"].quantile(0.90))\n    ].copy()\n\n    unusual["signal"] = unusual.apply(lambda r:\n        "bullish_sweep" if r["type"]=="call" and r["moneyness"] < 0.05\n        else ("bearish_hedge" if r["type"]=="put" and r["moneyness"] > -0.10\n        else "speculative"), axis=1)\n\n    return unusual.sort_values("total_prem", ascending=False)',
    note:'vol_oi_ratio > 5 on an OTM call with > $500K premium is one of the strongest short-term bullish signals' },
  { type:'bullets', icon:'📋', heading:'Scanner Signal Interpretation',
    items:['vol_oi_ratio > 5 plus OTM call plus large premium: new position, not a hedge — directional bet','vol_oi_ratio > 5 plus deep OTM put plus same expiry as earnings: buying protection before news','Put/call skew anomaly: put OTM premium suddenly cheaper than call OTM = tail risk being sold','Cluster of sweeps across strikes: institutional accumulation — more directional than single trade'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['vol_oi_ratio > 3 filters out routine hedges and isolates new directional positions','Large OTM call sweeps 3-5 weeks before earnings predict positive surprise with IC > 0.07','Cluster detection across strikes is more reliable than single-trade alerts','Automate the scanner with a cron job and alert via Slack or email for real-time monitoring'] }
],

'8.7': [
  { type:'title', badge:'MODULE 8', icon:'🤖', heading:'ML-Enhanced Options Strategy',
    sub:'Lesson 8.7 · Combining Greeks + ML for Edge',
    note:'Use all the options signals together in a unified ML framework for options trading' },
  { type:'bullets', icon:'🎯', heading:'The Combined Options Signal Framework',
    items:['Stack Greeks features, IV prediction, GEX, and flow scanner into one feature matrix','Train XGBoost to predict: should we be long gamma, short gamma, or flat next 5 days?','Target: realized vol > implied vol by > 2 points (binary: long gamma profitable or not)','Walk-forward validation on options strategies — respect path-dependent nature of options P&L'] },
  { type:'code', icon:'💻', heading:'Options ML Signal Pipeline',
    code:'def build_options_ml_features(df, gex_data,\n                               flow_data, iv_df):\n    # Unified options ML feature set\n\n    # IV prediction features (Lesson 8.2)\n    df = build_iv_prediction_features(df, iv_df)\n\n    # GEX features (Lesson 8.5)\n    df["gex_regime_pos"] = (df.get("gex_total", 0) > 0).astype(int)\n    gex_series = pd.Series(df.get("gex_total", 0), index=df.index)\n    df["gex_pct_rank"]   = gex_series.rolling(63).rank(pct=True)\n\n    # Flow features (Lesson 8.6)\n    df["net_premium_ratio"] = flow_data["net_prem_ratio"].reindex(df.index).fillna(0.5)\n    df["unusual_call_z"]    = flow_data["unusual_call"].reindex(df.index).fillna(0)\n\n    # 0DTE bias (Lesson 8.3)\n    df["dte0_bias"] = flow_data["dte0_net_prem"].reindex(df.index).fillna(0)\n\n    options_features = [\n        "iv_pct_rank", "vrp", "vrp_5d", "iv_momentum",\n        "gex_regime_pos", "gex_pct_rank",\n        "net_premium_ratio", "unusual_call_z", "dte0_bias"\n    ]\n\n    # Target: next 5d realized vol > current IV (long gamma profitable)\n    fwd_rvol = (df["Close"].pct_change().rolling(5).std()\n                 .shift(-5) * np.sqrt(252) * 100)\n    df["target_long_gamma"] = (fwd_rvol > df["iv"]).astype(int)\n\n    return df, options_features',
    note:'This 9-feature options model achieves AUC > 0.60 for predicting long gamma vs short gamma positioning' },
  { type:'bullets', icon:'💡', heading:'Strategy Selection Logic',
    items:['model_prob > 0.65: long gamma — buy ATM straddle or strangle for next 5 days','model_prob < 0.35: short gamma — sell OTM strangle, collect theta decay','model_prob 0.35-0.65 plus high IV z-score: sell premium but tighter strikes — limited risk','Always size by IV: higher IV = smaller position (risk stays constant across regimes)'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Combining 9 options ML features achieves AUC > 0.60 for long vs short gamma prediction','VRP and IV z-score are the dominant features — they capture the core volatility premium signal','Always size options positions by IV: same dollar risk regardless of implied volatility level','This framework directly powers the dashboard — Module 9 connects it to live trading execution'] }
],

'8.8': [
  { type:'title', badge:'MODULE 8', icon:'🏆', heading:'Capstone: Options ML System',
    sub:'Lesson 8.8 · Module 8 Capstone Project',
    note:'Build a complete options intelligence platform that generates daily actionable signals' },
  { type:'bullets', icon:'🎯', heading:'Capstone System Architecture',
    items:['Daily data fetch: GEX from option chain, IV from VIX surface, flow from scanner','Feature pipeline: 9 options features plus 25 price features — XGBoost options signal','Signal logic: long gamma, short gamma, or flat — with position sizing by IV level','Dashboard integration: feed signals directly into the options-strategy page via API'] },
  { type:'code', icon:'💻', heading:'Options Signal Daily Runner',
    code:'import joblib\n\ndef daily_options_signal(ticker="SPY"):\n    # Run full options ML pipeline and return daily signal\n\n    # 1. Load trained model bundle\n    bundle = joblib.load(f"models/{ticker}_options_v1.pkl")\n    model, scaler = bundle["model"], bundle["scaler"]\n    opt_features  = bundle["opt_features"]\n    px_features   = bundle["px_features"]\n\n    # 2. Fetch today\'s data\n    df    = yf.Ticker(ticker).history(period="90d")\n    iv_df = yf.Ticker("^VIX").history(period="90d")\n    chain = fetch_option_chain(ticker)  # real-time from broker API\n    gex_r = compute_gex(chain, df["Close"].iloc[-1])\n    flow_r = build_0dte_features(chain, df["Close"].iloc[-1])\n\n    # 3. Build features and scale\n    df, _ = build_options_ml_features(df, gex_r,\n                pd.DataFrame([flow_r]), iv_df)\n    X = df[opt_features + px_features].iloc[[-1]].fillna(0)\n    X_scaled = scaler.transform(X)\n\n    # 4. Predict and generate signal\n    prob_long_gamma = model.predict_proba(X_scaled)[0][1]\n    if prob_long_gamma > 0.65:   signal = "LONG_GAMMA"\n    elif prob_long_gamma < 0.35: signal = "SHORT_GAMMA"\n    else:                         signal = "FLAT"\n\n    return {\n        "ticker": ticker, "signal": signal,\n        "prob_long_gamma": round(prob_long_gamma, 3),\n        "gex_regime": gex_r["gex_regime"],\n    }',
    note:'This runs in under 2 seconds per ticker — schedule it at 9:15am EST before market open every day' },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['The complete options ML system runs in under 2 seconds per ticker at market open','Signal categories: LONG_GAMMA, SHORT_GAMMA, FLAT — each maps to a specific strategy type','GEX regime plus IV z-score plus VRP together tell you everything about options market positioning','Module 9 will deploy this system live with IBKR integration and automated order execution'] }
],

// ═══════════════════════════════════════════════════════════════════
// MODULE 9 — Live Trading Systems  (color: #f43f5e)
// ═══════════════════════════════════════════════════════════════════

'9.1': [
  { type:'title', badge:'MODULE 9', icon:'🚀', heading:'Live System Architecture',
    sub:'Lesson 9.1 · Production Trading System Design',
    note:'The architecture that separates a prototype from a system you can trust with real money' },
  { type:'bullets', icon:'🏗️', heading:'The Five Production Requirements',
    items:['Reliability: the system must run every market day without manual intervention','Observability: you must know instantly if anything is wrong — no silent failures','Correctness: orders must be exactly what the model intended — no rounding or drift','Safety: position limits, loss limits, and kill switches must be enforced at the code level','Auditability: every decision must be logged with timestamp, data, and reasoning'] },
  { type:'visual', icon:'🔧', heading:'Production System Layer Diagram',
    html:'<div style="display:flex;flex-direction:column;gap:.5rem;padding:.5rem 1rem;font-size:.72rem">'
      + '<div style="background:rgba(244,63,94,.15);border:1px solid rgba(244,63,94,.4);border-radius:6px;padding:.4rem .8rem">🌐 <b>Data Layer</b> — yfinance + broker real-time feed → normalize → cache</div>'
      + '<div style="background:rgba(251,146,60,.15);border:1px solid rgba(251,146,60,.4);border-radius:6px;padding:.4rem .8rem">⚙️ <b>Feature Layer</b> — load cached data → run pipeline → validate features</div>'
      + '<div style="background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.4);border-radius:6px;padding:.4rem .8rem">🤖 <b>Signal Layer</b> — load model bundle → predict → apply confidence filter</div>'
      + '<div style="background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.4);border-radius:6px;padding:.4rem .8rem">📊 <b>Risk Layer</b> — check position limits → compute order size → enforce kill switch</div>'
      + '<div style="background:rgba(34,211,238,.15);border:1px solid rgba(34,211,238,.4);border-radius:6px;padding:.4rem .8rem">💼 <b>Execution Layer</b> — IBKR API → place order → confirm fill → log trade</div>'
      + '<div style="background:rgba(100,116,139,.15);border:1px solid rgba(100,116,139,.4);border-radius:6px;padding:.4rem .8rem">📡 <b>Monitor Layer</b> — performance tracker → alerts → daily report email</div>'
      + '</div>',
    note:'Each layer must be independently testable — if you cannot unit-test the risk layer, it will fail in production' },
  { type:'bullets', icon:'⚠️', heading:'The Most Critical Design Rules',
    items:['Never modify positions in the risk layer — it checks only, execution happens downstream','All order parameters must be computed before touching the broker API — no logic during placement','Position limits are hard-coded constants, not configurable settings — prevents accidental override','The kill switch must work even if the database is down — it is a file flag, not a DB query'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Production systems have 6 independent layers — each testable and replaceable separately','The risk layer enforces hard limits at the code level — never rely on human oversight alone','Kill switches, position limits, and loss limits are safety infrastructure — build them first','Every decision must be logged: without an audit trail, you cannot debug live trading failures'] }
],

'9.2': [
  { type:'title', badge:'MODULE 9', icon:'🔌', heading:'IBKR API Integration',
    sub:'Lesson 9.2 · Interactive Brokers Connectivity',
    note:'Connect your ML system to IBKR for live data, account monitoring, and order execution' },
  { type:'bullets', icon:'⚙️', heading:'IBKR API Architecture',
    items:['TWS API: connects to Trader Workstation running on your desktop — easy setup, requires TWS running','IB Gateway: headless server version — better for automated systems, no GUI needed','ib_insync library: async Python wrapper for TWS/Gateway — far simpler than the native API','Paper trading account: test all automation with paper money before going live — always'] },
  { type:'code', icon:'💻', heading:'IBKR Connection and Account Data',
    code:'from ib_insync import IB, Stock, LimitOrder\n\nclass IBKRClient:\n    def __init__(self, host="127.0.0.1", port=7497, client_id=1):\n        self.ib   = IB()\n        self.host = host\n        self.port = port  # 7497=TWS paper, 7496=TWS live, 4001=IB Gateway\n        self.cid  = client_id\n\n    def connect(self):\n        self.ib.connect(self.host, self.port, clientId=self.cid)\n        print(f"Connected: {self.ib.isConnected()}")\n\n    def get_account_summary(self):\n        vals = {v.tag: float(v.value) for v in self.ib.accountValues()\n                if v.currency == "USD"}\n        return {\n            "net_liq"     : vals.get("NetLiquidation", 0),\n            "buying_power": vals.get("BuyingPower", 0),\n            "daily_pnl"   : vals.get("RealizedPnL", 0),\n            "unrealized"  : vals.get("UnrealizedPnL", 0),\n        }\n\n    def get_positions(self):\n        return [{\n            "symbol"   : p.contract.symbol,\n            "qty"      : p.position,\n            "avg_cost" : p.avgCost,\n            "mkt_value": p.marketValue\n        } for p in self.ib.positions()]\n\n    def disconnect(self):\n        self.ib.disconnect()',
    note:'Always use paper trading port (7497) until your system has run error-free for at least 30 trading days' },
  { type:'bullets', icon:'📋', heading:'Connection Best Practices',
    items:['Use client_id > 1 for your automation script — TWS GUI uses client_id=0','Set max reconnect attempts — handle TCP disconnects gracefully with exponential backoff','Heartbeat check: ping IBKR every 60 seconds, alert if no response — connection may silently drop','Never connect two scripts with the same client_id — they conflict and produce duplicate orders'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['ib_insync is far simpler than the native IBKR API — use it for all Python automation','Start with paper trading port 7497 — test the entire system for 30 days before live money','client_id must be unique per connection — use different IDs for data scripts vs order scripts','Handle disconnects gracefully: missing a reconnect silently means no orders execute — you need alerts'] }
],

'9.3': [
  { type:'title', badge:'MODULE 9', icon:'📋', heading:'Order Management System',
    sub:'Lesson 9.3 · Safe Automated Order Execution',
    note:'The most critical module — a bug here means real money lost immediately' },
  { type:'bullets', icon:'🛡️', heading:'Order Safety Architecture',
    items:['Pre-trade checks: position limits, max order size, market hours, existing position direction','Order types: always use limit orders for equity entries — never market orders in automated systems','Fill confirmation: wait for fill confirmation before updating position state — never assume fills','Partial fill handling: if order partially fills, size the remaining order relative to unfilled portion'] },
  { type:'code', icon:'💻', heading:'Safe Order Execution with Pre-Trade Checks',
    code:'from ib_insync import Stock, LimitOrder\nimport logging\n\nclass OrderManager:\n    MAX_POSITION_VALUE = 20_000  # max $20K per position\n    MAX_ORDER_SHARES   = 500     # max shares per order\n    MAX_DAILY_ORDERS   = 10      # kill switch after 10 orders\n\n    def __init__(self, ibkr):\n        self.ib           = ibkr.ib\n        self.daily_orders = 0\n        self.log          = logging.getLogger("OrderManager")\n\n    def _pre_trade_checks(self, symbol, qty, price):\n        if self.daily_orders >= self.MAX_DAILY_ORDERS:\n            self.log.error("KILL SWITCH: max daily orders reached")\n            return False\n        if abs(qty) > self.MAX_ORDER_SHARES:\n            self.log.error(f"Order too large: {qty} shares")\n            return False\n        if abs(qty) * price > self.MAX_POSITION_VALUE:\n            self.log.error(f"Position too large: ${qty*price:,.0f}")\n            return False\n        if not self.ib.isConnected():\n            self.log.error("IBKR not connected")\n            return False\n        return True\n\n    def place_limit_order(self, symbol, action, qty, limit_price):\n        if not self._pre_trade_checks(symbol, qty, limit_price):\n            return {"status": "rejected"}\n        contract = Stock(symbol, "SMART", "USD")\n        order    = LimitOrder(action, abs(qty),\n                              round(limit_price, 2),\n                              tif="DAY", outsideRth=False)\n        trade = self.ib.placeOrder(contract, order)\n        self.daily_orders += 1\n        self.log.info(f"PLACED: {action} {qty} {symbol} @ ${limit_price:.2f}")\n        return {"status": "placed", "order_id": trade.order.orderId}',
    note:'outsideRth=False prevents accidental pre/post-market fills at terrible prices — always set this' },
  { type:'bullets', icon:'⚡', heading:'Critical Safety Rules',
    items:['Always use limit orders — market orders in pre/post market can fill at catastrophic prices','Set tif="DAY": orders automatically cancel at close — no overnight open orders','Pre-trade checks must be synchronous — never async in the order path — timing matters','Log every order with full parameters before placing — if it silently fails, you need the log'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Pre-trade checks are not optional — position limits and kill switches must run on every order','Always use limit orders with tif=DAY in automated systems — market orders are too dangerous','Log every order attempt before it executes — if there is a bug, you need the pre-execution log','Set MAX_DAILY_ORDERS as a kill switch — 10 unexpected orders means something is very wrong'] }
],

'9.4': [
  { type:'title', badge:'MODULE 9', icon:'📡', heading:'Real-Time Data Pipeline',
    sub:'Lesson 9.4 · Market Data Infrastructure',
    note:'Build the data infrastructure that feeds your live models with clean, validated market data' },
  { type:'bullets', icon:'🔄', heading:'Real-Time Data Requirements',
    items:['Latency: ML equity signals need EOD data — intraday is needed only for options strategies','Reliability: data gaps or bad ticks cause feature corruption which leads to wrong signals','Validation: always check for obvious data errors: price spikes, zero volume, stale timestamps','Caching: cache all fetched data locally — API rate limits and outages are real problems'] },
  { type:'code', icon:'💻', heading:'Reliable Data Pipeline with Validation',
    code:'import yfinance as yf\nimport pandas as pd\nfrom pathlib import Path\nimport logging\n\nDATA_DIR = Path("data/market")\nDATA_DIR.mkdir(parents=True, exist_ok=True)\nlog = logging.getLogger("DataPipeline")\n\ndef fetch_and_validate(ticker, period="2y"):\n    cache_path = DATA_DIR / f"{ticker}.parquet"\n\n    # Load from cache if already fresh today\n    if cache_path.exists():\n        cached    = pd.read_parquet(cache_path)\n        last_date = cached.index[-1].date()\n        from datetime import date\n        if last_date >= date.today():\n            return cached\n\n    df = yf.Ticker(ticker).history(period=period)\n    if df.empty:\n        raise ValueError(f"No data returned for {ticker}")\n\n    # Validation checks\n    issues = []\n    if df["Close"].isnull().any():\n        issues.append("null closes")\n    price_chg = df["Close"].pct_change().abs()\n    if (price_chg > 0.25).any():\n        issues.append(f"suspicious spike: {price_chg.max():.1%}")\n    if (df["Volume"] == 0).sum() > len(df) * 0.01:\n        issues.append("excessive zero volume")\n    if issues:\n        log.warning(f"{ticker} data quality issues: {issues}")\n\n    df.to_parquet(cache_path)\n    log.info(f"{ticker}: {len(df)} rows cached")\n    return df',
    note:'A 25% single-day price change is almost always a data error — validate before it corrupts your feature pipeline' },
  { type:'bullets', icon:'📊', heading:'Data Quality Rules for Production',
    items:['Spike filter: |daily return| > 20% means flag as suspicious and require manual confirmation','Stale check: if last bar timestamp is > 30 minutes old at 9:35am means alert and do not trade','Forward fill: use ffill() only for known holidays, not for genuine missing data — they are different','Daily data hash: compute checksum of daily data — alert if same hash appears two days in a row'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Always validate fetched data before feeding it into the feature pipeline — garbage in, garbage out','Cache all fetched data with timestamps — reduces API calls and provides a fallback during outages','A 25%+ single-day move is almost always a data error — validate before accepting it','Monitor data pipeline health separately from model health — silent data failures are common'] }
],

'9.5': [
  { type:'title', badge:'MODULE 9', icon:'🛡️', heading:'Risk Management Module',
    sub:'Lesson 9.5 · Protecting Capital in Live Trading',
    note:'Risk management is not an add-on — it is the most important component of any live system' },
  { type:'bullets', icon:'⚠️', heading:'The Core Risk Rules',
    items:['Maximum loss per trade: if a position loses more than 2% of portfolio, exit unconditionally','Daily loss limit: if portfolio drops more than 3% in one day, stop all trading for the rest of the day','Maximum position concentration: no single ticker > 15% of portfolio regardless of signal strength','Drawdown-based position reduction: if portfolio is 10% below peak, cut all sizes by 50%'] },
  { type:'code', icon:'💻', heading:'Real-Time Risk Monitor',
    code:'import logging\n\nclass RiskMonitor:\n    def __init__(self, ibkr, max_daily_loss=0.03,\n                 max_position_pct=0.15, max_drawdown_scale=0.10):\n        self.ib               = ibkr\n        self.max_daily_loss   = max_daily_loss\n        self.max_position_pct = max_position_pct\n        self.max_dd_scale     = max_drawdown_scale\n        self._peak_nav        = None\n        self.log = logging.getLogger("RiskMonitor")\n\n    def check_all(self):\n        # Run all risk checks — returns status and any violations\n        acct      = self.ib.get_account_summary()\n        nav       = acct["net_liq"]\n        daily_pnl = acct["daily_pnl"]\n\n        if self._peak_nav is None or nav > self._peak_nav:\n            self._peak_nav = nav\n\n        drawdown   = (nav - self._peak_nav) / self._peak_nav\n        violations = []\n        size_scale = 1.0\n\n        if daily_pnl / nav < -self.max_daily_loss:\n            violations.append(f"DAILY_LOSS_LIMIT: {daily_pnl/nav:.1%}")\n\n        if drawdown < -self.max_dd_scale:\n            size_scale = 0.5\n            violations.append(f"DRAWDOWN_SCALING_0.5: {drawdown:.1%}")\n        if drawdown < -2*self.max_dd_scale:\n            size_scale = 0.0\n            violations.append(f"HALT_ALL_TRADING: {drawdown:.1%}")\n\n        if violations:\n            self.log.error(f"RISK VIOLATIONS: {violations}")\n\n        return {"nav": nav, "drawdown": drawdown,\n                "size_scale": size_scale, "violations": violations}',
    note:'size_scale is passed to every order — when drawdown is 20%+ below peak, all positions halve automatically' },
  { type:'bullets', icon:'🔑', heading:'Risk Architecture Principles',
    items:['Risk checks run before every order — position size output from ML times size_scale from risk module','Daily loss limit must persist across restarts — store in a file, not just in memory','Alert immediately on any violation — SMS is better than email for time-sensitive risk events','Post-incident review: after every stop, document what triggered it and whether the signal was wrong'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Risk limits are code, not intentions — enforce them programmatically on every single order','Daily loss limit plus drawdown scaling together protect capital during model failure or regime change','Store risk state in a file, not memory — process restarts are common and you cannot lose risk state','Alert on violations immediately: delayed risk alerts during a drawdown are useless'] }
],

'9.6': [
  { type:'title', badge:'MODULE 9', icon:'📡', heading:'Performance Monitoring',
    sub:'Lesson 9.6 · Live System Observability',
    note:'If you cannot see what your system is doing in real time, you are flying blind' },
  { type:'bullets', icon:'👁️', heading:'What to Monitor in a Live System',
    items:['Signal accuracy: is live model accuracy tracking the backtest out-of-sample accuracy?','Execution quality: are limit orders filling, or are fills consistently missing by > 2bps?','P&L attribution: how much of today\'s P&L is from alpha vs beta vs bid-ask costs?','Data pipeline health: did all 10 tickers update successfully before the model ran today?'] },
  { type:'code', icon:'💻', heading:'Daily Performance Logger',
    code:'import sqlite3\n\nclass PerformanceLogger:\n    def __init__(self, db_path="data/performance.db"):\n        self.conn = sqlite3.connect(db_path)\n        self._init_schema()\n\n    def _init_schema(self):\n        self.conn.execute("""CREATE TABLE IF NOT EXISTS daily_log (\n            date TEXT, ticker TEXT, signal TEXT, prob REAL,\n            entry_price REAL, exit_price REAL, pnl REAL,\n            transaction_cost REAL, net_pnl REAL,\n            signal_correct INTEGER, notes TEXT\n        )""")\n        self.conn.commit()\n\n    def log_trade(self, trade: dict):\n        cols = ["date","ticker","signal","prob","entry_price",\n                "exit_price","pnl","transaction_cost","net_pnl",\n                "signal_correct","notes"]\n        vals = [trade.get(c) for c in cols]\n        placeholders = ",".join(["?"] * len(cols))\n        self.conn.execute(f"INSERT INTO daily_log VALUES ({placeholders})", vals)\n        self.conn.commit()\n\n    def get_rolling_accuracy(self, days=30) -> float:\n        cur = self.conn.execute(\n            "SELECT AVG(signal_correct) FROM daily_log "\n            "WHERE date >= date(\'now\', ?) AND signal != \'FLAT\'",\n            (f"-{days} days",))\n        result = cur.fetchone()[0]\n        return round(result, 3) if result is not None else 0.0',
    note:'If rolling 30-day accuracy drops below 50%, the model has likely entered a bad regime — reduce position sizes' },
  { type:'bullets', icon:'📊', heading:'Monitoring Dashboard Metrics',
    items:['Rolling 30-day accuracy: < 50% on directional signals means model edge has deteriorated','Average fill slippage: > 5bps consistently means your limit prices need adjustment','Daily signal distribution: if all signals are FLAT for > 5 days, check data pipeline, not model','P&L vs SPY: negative alpha for 10+ consecutive days = time to retrain or pause the system'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Log every trade to SQLite — raw data lets you compute any metric retroactively','Rolling 30-day accuracy is your primary model health signal — trend matters more than level','Execution quality monitoring catches slippage problems before they become major cost drags','Build a simple daily email report — 5 key numbers every morning keeps you informed without effort'] }
],

'9.7': [
  { type:'title', badge:'MODULE 9', icon:'⚡', heading:'Gap & Emergency Handling',
    sub:'Lesson 9.7 · When Things Go Wrong',
    note:'Every live trading system will face emergencies — prepare your responses in advance' },
  { type:'bullets', icon:'🚨', heading:'Common Live Trading Failures',
    items:['Data outage: yfinance returns empty data or stale prices — features become NaN — model signals garbage','IBKR disconnect: connection drops silently — pending orders not monitored — fills missed','Runaway loop bug: a code error causes repeated order submission — position grows unexpectedly','Extreme market event: 5%+ gap down — all limits trigger simultaneously — need calm manual response'] },
  { type:'code', icon:'💻', heading:'Emergency Response System',
    code:'import signal as sig\nimport sys\nfrom pathlib import Path\n\nclass EmergencyHandler:\n    def __init__(self, order_manager, ibkr):\n        self.om        = order_manager\n        self.ib        = ibkr\n        self.halt_file = Path("HALT_TRADING")\n\n        # Register SIGINT/SIGTERM handlers\n        sig.signal(sig.SIGINT,  self._graceful_shutdown)\n        sig.signal(sig.SIGTERM, self._graceful_shutdown)\n\n    def is_halted(self) -> bool:\n        # Check for manual halt flag file — create file to halt instantly\n        return self.halt_file.exists()\n\n    def _graceful_shutdown(self, signum, frame):\n        print("\\nEmergency shutdown — cancelling all open orders")\n        self.ib.ib.reqGlobalCancel()  # cancel ALL open orders\n        self.ib.disconnect()\n        sys.exit(0)\n\n    def flatten_all_positions(self, reason="emergency"):\n        # Market-close all open positions — use only in genuine emergency\n        from ib_insync import Stock, MarketOrder\n        positions = self.ib.get_positions()\n        for pos in positions:\n            if pos["qty"] == 0: continue\n            action   = "SELL" if pos["qty"] > 0 else "BUY"\n            contract = Stock(pos["symbol"], "SMART", "USD")\n            order    = MarketOrder(action, abs(pos["qty"]))\n            self.ib.ib.placeOrder(contract, order)\n        import logging\n        logging.getLogger("Emergency").critical(\n            f"FLATTENED ALL POSITIONS: reason={reason}")',
    note:'Create a file named HALT_TRADING in the working directory to immediately stop all order submissions' },
  { type:'bullets', icon:'🔑', heading:'Emergency Preparedness Checklist',
    items:['Test reqGlobalCancel() in paper trading before going live — know it works before you need it','Document your manual emergency steps: print them and keep them visible at your desk','Practice the HALT_TRADING file mechanism monthly — verify it works in 10 seconds or less','After any emergency: conduct a post-mortem within 24 hours — document root cause and fix'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Every live system will face an emergency — your response plan must exist before deployment','HALT file check on every loop iteration is the simplest and most reliable kill switch','reqGlobalCancel() cancels ALL open orders immediately — test it in paper trading first','After every emergency: post-mortem within 24 hours — undocumented failures repeat themselves'] }
],

'9.8': [
  { type:'title', badge:'MODULE 9', icon:'📊', heading:'Multi-Asset Portfolio System',
    sub:'Lesson 9.8 · Scaling to a Live Portfolio',
    note:'Run signals for 10-20 assets simultaneously with intelligent capital allocation' },
  { type:'bullets', icon:'🌐', heading:'Portfolio-Level Considerations',
    items:['Correlation management: do not be long SPY, QQQ, and XLK simultaneously — it is one position','Volatility parity: allocate capital inversely to volatility — equal risk, not equal dollars','Sector exposure limits: no more than 40% net exposure to any single GICS sector','Rebalancing frequency: weekly rebalancing reduces costs significantly vs daily with similar Sharpe'] },
  { type:'code', icon:'💻', heading:'Volatility-Parity Position Sizer',
    code:'import numpy as np\n\ndef compute_vol_parity_sizes(\n        signals, prices, vols,\n        total_capital,\n        target_vol=0.15,\n        max_pos_pct=0.20):\n    # Allocate capital using volatility parity with signal scaling\n    results = {}\n    for ticker, prob in signals.items():\n        # Only trade on high-conviction signals\n        if abs(prob - 0.5) < 0.10:\n            results[ticker] = {"shares": 0, "direction": "FLAT"}\n            continue\n\n        direction       = 1 if prob > 0.5 else -1\n        signal_strength = abs(prob - 0.5) * 2  # 0 to 1 scale\n\n        # Volatility-parity sizing\n        vol        = vols.get(ticker, 0.20)\n        base_alloc = total_capital * (target_vol / vol)\n        alloc      = min(base_alloc * signal_strength,\n                         total_capital * max_pos_pct)\n        shares     = int(alloc / prices[ticker])\n\n        results[ticker] = {\n            "shares"    : shares * direction,\n            "alloc_usd" : shares * prices[ticker],\n            "direction" : "LONG" if direction > 0 else "SHORT",\n        }\n    return results',
    note:'Vol parity: a 30-vol stock gets half the capital of a 15-vol stock — risk is equalized across all positions' },
  { type:'bullets', icon:'💡', heading:'Portfolio Risk Aggregation',
    items:['Compute portfolio-level daily VaR: sum of position_size times daily_vol — must stay below risk budget','Net sector exposure: long tech plus short tech is nearly hedged; two long tech positions is concentrated','Max correlated exposure: cluster assets by correlation matrix — limit each cluster to 30% of portfolio','Monthly rebalancing report: attribution by asset, sector, and regime — track alpha vs beta'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['Volatility parity allocates equal risk to each asset — not equal capital — always use this approach','Correlation clustering prevents inadvertent concentration in correlated assets','Portfolio VaR monitoring catches aggregate risk that individual position limits miss','Weekly rebalancing with smart batching reduces transaction costs by 60-70% vs daily rebalancing'] }
],

'9.9': [
  { type:'title', badge:'MODULE 9', icon:'⚖️', heading:'Regulatory & Compliance',
    sub:'Lesson 9.9 · Rules Every Algorithmic Trader Must Know',
    note:'Ignoring these rules can result in account suspension or trading restrictions — know them before going live' },
  { type:'bullets', icon:'📋', heading:'Key Regulations for Retail Algorithmic Traders',
    items:['Pattern Day Trader (PDT) rule: < $25K account + 4+ round trips in 5 days = 90-day restriction','Wash sale rule: selling at a loss then rebuying within 30 days disqualifies the tax loss','Market manipulation: algorithmic spoofing, layering, and marking the close are federal offenses','Reg NMS: your broker must route to best available price — relevant when optimizing limit orders'] },
  { type:'code', icon:'💻', heading:'PDT and Wash Sale Tracker',
    code:'from datetime import date, timedelta\nfrom collections import deque\n\nclass ComplianceTracker:\n    def __init__(self, account_value: float):\n        self.account_value = account_value\n        self.day_trades    = deque(maxlen=5)  # rolling 5-day window\n        self.recent_sells  = {}               # {ticker: (date, pnl)}\n\n    def log_round_trip(self, ticker, open_dt, close_dt, pnl):\n        warnings = []\n\n        # PDT check (applies only if account < $25K)\n        if self.account_value < 25_000 and open_dt == close_dt:\n            self.day_trades.append(close_dt)\n            recent = [d for d in self.day_trades\n                      if d >= date.today() - timedelta(days=4)]\n            if len(recent) >= 4:\n                warnings.append(f"PDT WARNING: {len(recent)} day trades in 5 days")\n\n        # Wash sale check\n        if pnl < 0:\n            self.recent_sells[ticker] = (close_dt, pnl)\n        elif ticker in self.recent_sells:\n            sell_dt, sell_loss = self.recent_sells[ticker]\n            if abs((close_dt - sell_dt).days) <= 30:\n                warnings.append(\n                    f"WASH SALE: repurchased {ticker} within 30d of "\n                    f"loss ${sell_loss:.0f} on {sell_dt}")\n\n        return {"ticker": ticker, "pnl": pnl, "warnings": warnings}',
    note:'The PDT rule catches more retail algorithmic traders off guard than any other regulation — check your account value' },
  { type:'bullets', icon:'🔑', heading:'Tax Efficiency for Algorithmic Trading',
    items:['Short-term gains (< 1 year) taxed as ordinary income (up to 37%) — this is most algo trades','Tax-loss harvesting: realize losses before Dec 31 to offset gains — but watch wash sale rule','Section 475 mark-to-market election: traders can elect ordinary income treatment — avoids wash sale','Keep detailed records: broker statement plus your own trade log — required for accurate tax filing'] },
  { type:'summary', icon:'✅', heading:'Key Takeaways',
    items:['PDT rule restricts < $25K accounts to 3 round trips per 5 days — design signal frequency accordingly','Wash sale rule can disallow tax losses if you repurchase within 30 days — track this in code','All trading income is taxable — short-term gains are taxed as ordinary income for most algo traders','Keep your own trade log independently from broker statements — the IRS may ask for both'] }
],

'9.10': [
  { type:'title', badge:'MODULE 9', icon:'🏆', heading:'Capstone: Full Live System',
    sub:'Lesson 9.10 · Module 9 & Pro Tier Capstone',
    note:'You have built a complete, professional-grade algorithmic trading system — this is the final assembly' },
  { type:'bullets', icon:'🎯', heading:'The Complete Pro Tier System',
    items:['60-feature engineering pipeline (Module 5) feeding XGBoost plus NLP signals (Module 6)','Advanced backtesting with Monte Carlo confidence intervals (Module 7)','Options ML: GEX, IV prediction, 0DTE signal, and delta-neutral strategies (Module 8)','Live execution: IBKR API, risk management, monitoring, and compliance (Module 9)'] },
  { type:'code', icon:'💻', heading:'Full System Daily Runner',
    code:'def daily_run():\n    # Main daily execution — runs at 9:00am EST before market open\n\n    # 0. Safety check\n    if emergency.is_halted():\n        alert("System halted — HALT_TRADING file exists"); return\n\n    # 1. Data pipeline\n    data = {t: fetch_and_validate(t, period="2y") for t in UNIVERSE}\n\n    # 2. Feature engineering (Module 5 + 6)\n    features = {}\n    for ticker, df in data.items():\n        df = pipeline.transform(df)          # price features\n        df = nlp_pipeline.transform(df, ticker)  # NLP features\n        features[ticker] = df\n\n    # 3. Signals (price + options ML)\n    signals = {}\n    for ticker in UNIVERSE:\n        px_sig  = load_and_predict(f"models/{ticker}_v2.pkl",\n                                    features[ticker])\n        opt_sig = daily_options_signal(ticker)\n        # Combine: both must agree for high-conviction trade\n        signals[ticker] = (0.6 * px_sig["prob_up"] +\n                           0.4 * opt_sig["prob_long_gamma"])\n\n    # 4. Risk check\n    risk = risk_monitor.check_all()\n    if risk["violations"]: return  # halt on any violation\n\n    # 5. Position sizing + orders\n    sizes = compute_vol_parity_sizes(\n        signals, prices, vols,\n        capital * risk["size_scale"])\n    for ticker, size in sizes.items():\n        if size["shares"] != 0:\n            action = "BUY" if size["shares"] > 0 else "SELL"\n            order_manager.place_limit_order(\n                ticker, action, abs(size["shares"]), prices[ticker])\n\n    # 6. Log and send morning report\n    perf_logger.log_daily_run(signals, sizes, risk)\n    send_morning_report(signals, sizes, risk)',
    note:'The complete system: 6 steps, each independently testable, runs in under 60 seconds every morning' },
  { type:'summary', icon:'✅', heading:'Congratulations — You Are a Pro',
    items:['You have built a complete institutional-grade algorithmic trading system from scratch','Features, models, backtests, options analysis, risk management, and live execution — all working together','The same architecture is used by multi-billion-dollar quantitative hedge funds — you now understand it deeply','Next steps: paper trade for 60 days, then graduate to small live allocation, then scale gradually'] }
]


}; // end window.SLIDE_DATA
