/* ML Trading Course — Modules 1-4 Lesson Data
   33 lessons | 4 modules | Basic tier fully unlocked */

window.COURSE_MODULES = [
  { id:1, title:"Trading & Markets Foundation",              tier:"basic", duration:"4.5 hrs", lessons:7  },
  { id:2, title:"Python for Traders — Zero to Functional",   tier:"basic", duration:"6.5 hrs", lessons:8  },
  { id:3, title:"Technical Indicators & Feature Engineering",tier:"basic", duration:"5.5 hrs", lessons:8  },
  { id:4, title:"ML Fundamentals (Regression + Classification)",tier:"basic",duration:"7.5 hrs",lessons:10 },
  { id:5, title:"Neural Networks & Deep Learning",           tier:"pro",   duration:"8 hrs",   lessons:8  },
  { id:6, title:"Sentiment Analysis & NLP",                  tier:"pro",   duration:"6 hrs",   lessons:6  },
  { id:7, title:"Backtesting Frameworks",                    tier:"pro",   duration:"7 hrs",   lessons:7  },
  { id:8, title:"Options Strategies with ML",                tier:"pro",   duration:"8 hrs",   lessons:8  },
  { id:9, title:"Live Trading Bot Deployment",               tier:"pro",   duration:"10 hrs",  lessons:10 }
];

window.COURSE_LESSONS = [

// ═══════════════════════════════════════════════════════════════════
// MODULE 1 — Trading & Markets Foundation
// ═══════════════════════════════════════════════════════════════════
{
  id:"1.1", module:1, tier:"basic", duration:35,
  title:"How Financial Markets Work",
  audio:"/audio/course-1-1.mp3", video:null,
  content:`
<h2>How Financial Markets Work</h2>
<p class="lesson-intro">Before writing a single line of code, you need to understand the arena you're trading in. Financial markets are complex adaptive systems — but their core mechanics are surprisingly simple once you break them down.</p>

<h3>What Is a Financial Market?</h3>
<p>A financial market is any place (physical or electronic) where buyers and sellers exchange financial instruments — stocks, options, futures, bonds, currencies. The price you see on a screen is simply the most recent agreed-upon price between a willing buyer and a willing seller. Modern markets are almost entirely electronic.</p>

<h3>The Major US Markets</h3>
<ul>
  <li><strong>NYSE</strong> — world's largest exchange by market cap. Large, established blue-chips. Hybrid electronic/specialist model.</li>
  <li><strong>NASDAQ</strong> — fully electronic, tech-heavy. Apple, Microsoft, NVIDIA, Amazon.</li>
  <li><strong>CBOE</strong> — primary US options exchange. SPY, QQQ, and single-stock options.</li>
  <li><strong>CME Group</strong> — futures: ES (S&amp;P 500 E-mini), NQ (NASDAQ), /CL (crude oil), /GC (gold).</li>
</ul>

<h3>How Price Discovery Works</h3>
<p>Buyers submit <em>bids</em> (what they'll pay) and sellers submit <em>asks</em> (what they want). The gap between the best bid and best ask is the <strong>spread</strong>. When a bid and ask match, a trade executes and the price prints on the tape. New information causes participants to update their beliefs — shifting bids and asks and moving price.</p>

<h3>Market Sessions</h3>
<table class="lesson-table">
  <tr><th>Session</th><th>Time (ET)</th><th>Characteristics</th></tr>
  <tr><td>Pre-Market</td><td>4:00–9:30 AM</td><td>Low volume, wide spreads, news-driven</td></tr>
  <tr><td>Regular Session</td><td>9:30 AM–4:00 PM</td><td>Full liquidity, tight spreads</td></tr>
  <tr><td>After-Hours</td><td>4:00–8:00 PM</td><td>Earnings reactions, low volume</td></tr>
  <tr><td>Futures</td><td>Nearly 24h</td><td>Continuous, 1hr daily break at 5PM ET</td></tr>
</table>

<h3>Why This Matters for ML</h3>
<ul>
  <li>Pre-market prices may not reflect the opening — don't use them as direct features without adjustment</li>
  <li>Volume is dramatically different across sessions — normalize accordingly</li>
  <li>The first and last 30 minutes have the highest volatility — different models may be needed</li>
  <li>Overnight gaps in equities can be explained by futures moves — a useful cross-asset feature</li>
</ul>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Markets are electronic matching systems: bids meet asks to set price</li>
    <li>US equities trade 9:30 AM–4:00 PM ET; futures trade nearly 24 hours</li>
    <li>Understanding market structure prevents costly data mistakes in ML</li>
    <li>The order book shows live supply and demand at every price level</li>
  </ul>
</div>`
},

{
  id:"1.2", module:1, tier:"basic", duration:40,
  title:"Market Participants — Who You're Trading Against",
  audio:"/audio/course-1-2.mp3", video:null,
  content:`
<h2>Market Participants — Who You're Trading Against</h2>
<p class="lesson-intro">Every trade has a counterparty. Understanding who else is in the market — their goals, constraints, and behaviors — gives you a critical edge in designing models that can actually profit.</p>

<h3>Retail Traders</h3>
<p>Individual investors trading personal accounts via platforms like Robinhood, TD Ameritrade, or Interactive Brokers. They represent ~20-25% of daily equity volume but a much larger share of options volume. Retail traders tend to react strongly to news and social media, trade emotionally, and create short-term, mean-reverting noise in the data.</p>

<h3>Institutional Investors</h3>
<p>Mutual funds, pension funds, insurance companies, sovereign wealth funds — managing trillions. Their size forces them to break orders into smaller pieces (using TWAP/VWAP algorithms), trade over days or weeks, and use options for hedging. When you see large block trades or unusual options activity, institutions are often the source.</p>

<h3>Market Makers</h3>
<p>Firms that continuously post both a bid and ask, profiting from the spread. The largest include Citadel Securities, Virtu Financial, and Jane Street. Market makers are almost perfectly delta-neutral — when they sell you a call option, they immediately buy stock to hedge. This dynamic drives the GEX (Gamma Exposure) analysis in this dashboard.</p>

<h3>High-Frequency Traders (HFT)</h3>
<p>Use co-located servers and microsecond execution to profit from tiny edges. They account for ~50% of US equity volume. For ML traders: sub-second signals are nearly impossible to trade profitably against HFT. Focus on 5-minute, hourly, or daily timeframes where their speed advantages disappear.</p>

<h3>Quantitative Hedge Funds</h3>
<p>Two Sigma, Renaissance Technologies, D.E. Shaw, Citadel use sophisticated ML and proprietary data. Their large size creates predictable patterns: mandatory rebalancing, risk-limit liquidations, and factor crowding that creates correlated drawdowns.</p>

<h3>Implications for Your ML Models</h3>
<ul>
  <li><strong>Avoid sub-minute data</strong> unless you have co-location — HFT extracts any edge before you can act</li>
  <li><strong>Retail sentiment</strong> (Reddit, unusual options volume) can predict moves institutions can't exploit at scale</li>
  <li><strong>Options positioning</strong> reflects institutional hedging — a powerful leading indicator</li>
  <li><strong>Quarter-end rebalancing</strong> is a calendar feature worth including in models</li>
</ul>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Retail traders create noise; institutions create sustained directional pressure</li>
    <li>Market makers hedge options with stock — this drives GEX and dealer delta analysis</li>
    <li>HFT dominates sub-second signals; your edge lives at 5-minute+ timeframes</li>
    <li>Knowing your counterparty helps you pick the right timeframe and feature set</li>
  </ul>
</div>`
},

{
  id:"1.3", module:1, tier:"basic", duration:30,
  title:"Order Types and Order Flow",
  audio:"/audio/course-1-3.mp3", video:null,
  content:`
<h2>Order Types and Order Flow</h2>
<p class="lesson-intro">The type of order you use determines your execution price, certainty of fill, and market impact. For ML-based systems, choosing the right order type is as important as the signal itself.</p>

<h3>Market Orders</h3>
<p>Execute immediately at the best available price. Guaranteed fill, not guaranteed price. In liquid markets (SPY, QQQ, AAPL) during regular hours, slippage is typically 1-2 cents. In volatile moments or illiquid names, you may pay far more than expected. <strong>Use when:</strong> speed matters more than price precision.</p>

<h3>Limit Orders</h3>
<p>Only fill at your specified price or better. You control price but sacrifice execution certainty. <strong>Use when:</strong> you can be patient and want to avoid paying the spread. Good for mean-reversion strategies that wait for price to come to you.</p>
<pre><code>Buy limit @ $185.50  → fills only if SPY trades at $185.50 or lower
Sell limit @ $186.00 → fills only if SPY trades at $186.00 or higher</code></pre>

<h3>Stop and Stop-Limit Orders</h3>
<p>A <strong>stop order</strong> becomes a market order when price hits the trigger. A <strong>stop-limit</strong> becomes a limit order at the trigger. Essential for automated risk management — exits losing positions without manual oversight.</p>
<div class="lesson-warn">⚠️ In fast-moving markets, stop orders can gap through your price and fill far worse than expected. Always account for this in your risk models.</div>

<h3>MOC and MOO Orders</h3>
<ul>
  <li><strong>MOC (Market on Close)</strong> — executes at the 4:00 PM closing auction. Used heavily by institutions for index rebalancing. Creates the well-known "3:45 PM surge" pattern.</li>
  <li><strong>MOO (Market on Open)</strong> — executes at the 9:30 AM opening auction. Captures overnight gap moves.</li>
</ul>

<h3>Order Flow Analysis</h3>
<p>Order flow studies the sequence and directionality of trades to infer institutional intent. More aggressive market buys (buy imbalance) → price tends to rise. More aggressive sells → price tends to fall. The options market is harder to hide — large institutional put or call purchases leave clear footprints in volume and premium data, which the Option Flows page tracks.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Market orders guarantee execution; limit orders guarantee price</li>
    <li>Always use stop orders in automated systems to cap losses without manual intervention</li>
    <li>MOC volume creates predictable late-day price patterns worth modeling as calendar features</li>
    <li>Options order flow is one of the clearest windows into institutional positioning</li>
  </ul>
</div>`
},

{
  id:"1.4", module:1, tier:"basic", duration:35,
  title:"Reading Price Charts — OHLCV and Candlesticks",
  audio:"/audio/course-1-4.mp3", video:null,
  content:`
<h2>Reading Price Charts — OHLCV and Candlesticks</h2>
<p class="lesson-intro">All ML trading models are built on price and volume data. Understanding exactly what OHLCV means and how to read candlestick charts is the foundation for every feature you'll engineer.</p>

<h3>OHLCV — The Universal Market Data Format</h3>
<table class="lesson-table">
  <tr><th>Field</th><th>Meaning</th><th>Significance</th></tr>
  <tr><td><strong>O</strong>pen</td><td>First trade price in the period</td><td>Where sentiment started</td></tr>
  <tr><td><strong>H</strong>igh</td><td>Highest trade price</td><td>Maximum bullish pressure reached</td></tr>
  <tr><td><strong>L</strong>ow</td><td>Lowest trade price</td><td>Maximum bearish pressure reached</td></tr>
  <tr><td><strong>C</strong>lose</td><td>Last trade price</td><td>Where sentiment settled — most important</td></tr>
  <tr><td><strong>V</strong>olume</td><td>Total shares/contracts traded</td><td>Conviction — high volume confirms moves</td></tr>
</table>

<h3>Candlestick Anatomy</h3>
<pre><code>       |  &lt;-- Upper wick (High)
    +--+--+
    |     |  &lt;-- Body (Open to Close)
    |     |     Green = Close &gt; Open (bullish)
    +--+--+     Red   = Close &lt; Open (bearish)
       |  &lt;-- Lower wick (Low)</code></pre>
<p>Long upper wick = price tried to rally but was sold back down. Long lower wick = price tried to sell off but buyers stepped in. A full-body candle with no wicks (Marubozu) signals strong conviction.</p>

<h3>Key Candlestick Patterns as ML Features</h3>
<pre><code class="language-python"># Hammer: small body at top, long lower wick (bullish reversal)
df['hammer'] = (
    ((df['close'] - df['open']).abs() / (df['high'] - df['low'] + 1e-9) &lt; 0.3) &amp;
    ((df[['open','close']].min(axis=1) - df['low']) /
     (df['high'] - df['low'] + 1e-9) &gt; 0.6)
).astype(int)

# Candle body size (normalized)
df['body_pct'] = (df['close'] - df['open']).abs() / df['close']
df['upper_wick'] = (df['high'] - df[['open','close']].max(axis=1)) / df['close']
df['lower_wick'] = (df[['open','close']].min(axis=1) - df['low']) / df['close']</code></pre>

<h3>Timeframe Selection for ML</h3>
<table class="lesson-table">
  <tr><th>Timeframe</th><th>Noise</th><th>Typical Hold</th><th>Best for</th></tr>
  <tr><td>1-minute</td><td>Extreme</td><td>Seconds–minutes</td><td>HFT, scalping</td></tr>
  <tr><td>5-minute</td><td>High</td><td>Minutes–hours</td><td>Day trading</td></tr>
  <tr><td>1-hour</td><td>Moderate</td><td>Hours–days</td><td>Swing intraday</td></tr>
  <tr><td>Daily</td><td>Low</td><td>Days–weeks</td><td>ML beginners ✓</td></tr>
  <tr><td>Weekly</td><td>Very low</td><td>Weeks–months</td><td>Position trading</td></tr>
</table>
<p><strong>Start with daily bars.</strong> They're clean, have full historical depth, and strategies at this timeframe are actually executable without co-location or expensive data feeds.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Every market bar is defined by Open, High, Low, Close, Volume — your raw data</li>
    <li>The Close is the most important price — it represents the final settlement of each period</li>
    <li>Candlestick patterns encode market psychology and can be binary ML features</li>
    <li>Start with daily bars — clean, available, and executable at retail scale</li>
  </ul>
</div>`
},

{
  id:"1.5", module:1, tier:"basic", duration:45,
  title:"Understanding Options — Calls, Puts, and the Greeks",
  audio:"/audio/course-1-5.mp3", video:null,
  content:`
<h2>Understanding Options — Calls, Puts, and the Greeks</h2>
<p class="lesson-intro">Options are the most information-rich instruments in the market. Learning to read options data unlocks leading indicators that pure price analysis can't provide — which is why this dashboard devotes four pages to options analysis.</p>

<h3>What Is an Options Contract?</h3>
<p>An options contract gives the buyer the <em>right, but not the obligation</em>, to buy or sell 100 shares of the underlying at a fixed price (the <strong>strike</strong>) on or before a fixed date (the <strong>expiration</strong>). The buyer pays a <strong>premium</strong> to the seller for this right.</p>

<h3>Calls vs. Puts</h3>
<table class="lesson-table">
  <tr><th>Type</th><th>Right to…</th><th>Profitable when…</th><th>Used for…</th></tr>
  <tr><td><strong>Call</strong></td><td>BUY at the strike</td><td>Price rises above strike + premium</td><td>Bullish bets, leverage</td></tr>
  <tr><td><strong>Put</strong></td><td>SELL at the strike</td><td>Price falls below strike − premium</td><td>Bearish bets, hedging</td></tr>
</table>

<h3>Key Options Terms</h3>
<ul>
  <li><strong>In-the-Money (ITM)</strong> — call: spot &gt; strike | put: spot &lt; strike</li>
  <li><strong>At-the-Money (ATM)</strong> — spot ≈ strike (most liquid, highest gamma)</li>
  <li><strong>Out-of-the-Money (OTM)</strong> — speculative, cheaper, higher risk</li>
  <li><strong>Open Interest (OI)</strong> — total open contracts. Large OI = important price level</li>
  <li><strong>Implied Volatility (IV)</strong> — market's forecast of future volatility, embedded in premium</li>
</ul>

<h3>The Greeks — Measuring Options Risk</h3>
<table class="lesson-table">
  <tr><th>Greek</th><th>Measures</th><th>Trading Significance</th></tr>
  <tr><td><strong>Delta (Δ)</strong></td><td>Price change per $1 move in underlying</td><td>Shares dealers must buy/sell to hedge</td></tr>
  <tr><td><strong>Gamma (Γ)</strong></td><td>Rate of delta change</td><td>Acceleration — drives gamma squeezes near expiry</td></tr>
  <tr><td><strong>Theta (Θ)</strong></td><td>Premium decay per day</td><td>Time decay erodes option buyer value daily</td></tr>
  <tr><td><strong>Vega (V)</strong></td><td>Sensitivity to IV changes</td><td>IV crush after earnings destroys premiums</td></tr>
</table>
<p>Delta is the most important Greek for understanding dealer hedging. A call with delta 0.5 means the dealer who sold it must own 50 shares per contract. As price rises toward the strike, delta increases — the dealer must buy more stock. This forced buying creates self-reinforcing rallies (<strong>gamma squeezes</strong>).</p>

<h3>Options as a Leading Indicator</h3>
<ul>
  <li><strong>Unusual volume</strong> — volume &gt;3x open interest with large premium = fresh institutional bet</li>
  <li><strong>Call/Put ratio</strong> — directional bias of total flow</li>
  <li><strong>GEX (Gamma Exposure)</strong> — dealer gamma positioning that creates price walls and magnets</li>
  <li><strong>Net premium</strong> — dollars spent on calls vs. puts at each strike</li>
</ul>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Options give the right to buy (call) or sell (put) at a fixed strike before expiration</li>
    <li>Delta drives dealer hedging — creating systematic buy/sell pressure on the underlying</li>
    <li>Large options volume with high premium relative to OI signals fresh institutional positioning</li>
    <li>The dashboard's GEX, Flows, Strategy, and 0DTE pages all derive from these fundamentals</li>
  </ul>
</div>`
},

{
  id:"1.6", module:1, tier:"basic", duration:25,
  title:"Key Market Times and Calendar Events",
  audio:"/audio/course-1-6.mp3", video:null,
  content:`
<h2>Key Market Times and Calendar Events</h2>
<p class="lesson-intro">Markets are not uniform across time. Certain times of day, week, month, and year have statistically reliable behavioral patterns — making calendar features some of the most powerful inputs in any ML trading model.</p>

<h3>Intraday Time Patterns</h3>
<table class="lesson-table">
  <tr><th>Time (ET)</th><th>Pattern</th><th>Driver</th></tr>
  <tr><td>9:30–10:00 AM</td><td>High volatility, direction establishing</td><td>Overnight news, gap fills, retail FOMO</td></tr>
  <tr><td>11:30 AM–1:00 PM</td><td>Lunch lull — low volume, choppy</td><td>Reduced participation</td></tr>
  <tr><td>2:00 PM (FOMC days)</td><td>Rate decision volatility</td><td>Fed announcement + press conference</td></tr>
  <tr><td>3:00–3:45 PM</td><td>Power hour — trend accelerates</td><td>Day trader position management</td></tr>
  <tr><td>3:45–4:00 PM</td><td>MOC surge — often strong close</td><td>Institutional rebalancing, index funds</td></tr>
</table>

<h3>Weekly and Monthly Patterns</h3>
<ul>
  <li><strong>Wednesday</strong> — weekly options expire (0DTE Wednesday); elevated morning volatility</li>
  <li><strong>3rd Friday</strong> — monthly options expiration (OpEx); GEX shift often changes market tone the following week</li>
  <li><strong>FOMC Wednesday</strong> — rate decisions 2:00 PM ET, 8x per year; largest single-day VIX moves</li>
  <li><strong>Quarter-end</strong> — institutional window dressing. Large-cap tech often bid up. Last day: strong close bias historically.</li>
  <li><strong>NFP (Non-Farm Payrolls)</strong> — first Friday of each month, 8:30 AM; significant market-moving event</li>
</ul>

<h3>Encoding Calendar Features for ML</h3>
<pre><code class="language-python">import numpy as np

df['hour']       = df.index.hour
df['day_of_week']= df.index.dayofweek   # 0=Mon, 4=Fri
df['month']      = df.index.month
df['is_monday']  = (df.index.dayofweek == 0).astype(int)
df['is_friday']  = (df.index.dayofweek == 4).astype(int)

# Cyclical encoding (better than raw integers for ML)
# Hour 23 is "close to" hour 0 — integers don't capture this
df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
df['dow_sin']  = np.sin(2 * np.pi * df['day_of_week'] / 5)
df['dow_cos']  = np.cos(2 * np.pi * df['day_of_week'] / 5)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>The first and last 30 minutes have the highest volatility — often warrant separate models</li>
    <li>OpEx Friday, FOMC Wednesday, and quarter-end create repeatable institutional behavior patterns</li>
    <li>Calendar features (day of week, month, opex week) are free, reliable ML inputs</li>
    <li>Use sin/cos encoding for cyclical time features to preserve their circular nature</li>
  </ul>
</div>`
},

{
  id:"1.7", module:1, tier:"basic", duration:40,
  title:"Risk Management Fundamentals",
  audio:"/audio/course-1-7.mp3", video:null,
  content:`
<h2>Risk Management Fundamentals</h2>
<p class="lesson-intro">The best ML signal in the world is worthless without proper risk management. More trading accounts are blown by poor position sizing and drawdown management than by bad signals. This lesson covers the math and rules that keep you in the game.</p>

<h3>The Core Truth About Risk</h3>
<p>A strategy with 55% win rate and 1:1 risk/reward is profitable. A strategy with 40% win rate and 2:1 risk/reward is also profitable. What destroys accounts is not losing trades — it's losing <em>too much</em> on losing trades and letting drawdowns compound.</p>
<pre><code>Expected Value = (Win Rate x Avg Win) - (Loss Rate x Avg Loss)

Your ML model only needs to find a positive EV edge.
Risk management turns that edge into consistent profits.</code></pre>

<h3>Position Sizing — The 1-2% Rule</h3>
<p>Professional traders risk 1-2% of total account equity per trade.</p>
<pre><code class="language-python">def position_size(account_equity, risk_pct, entry_price, stop_price):
    risk_per_share = abs(entry_price - stop_price)
    if risk_per_share == 0:
        return 0
    dollars_to_risk = account_equity * risk_pct
    return int(dollars_to_risk / risk_per_share)

# Example: $100k account, 1% risk, buy SPY at $500, stop at $496
shares = position_size(100_000, 0.01, 500, 496)
print(shares)  # 250 shares, $1,000 max loss</code></pre>
<p>At 2% risk per trade, you need 50 consecutive losers to blow up — giving your edge enough time to manifest statistically.</p>

<h3>Max Drawdown and Circuit Breakers</h3>
<p>Set maximum drawdown limits in all automated systems:</p>
<ul>
  <li><strong>Daily drawdown limit:</strong> Stop trading if down &gt;3% for the day</li>
  <li><strong>Portfolio drawdown limit:</strong> Reduce position sizes or halt if total drawdown exceeds 10%</li>
  <li><strong>Strategy-level:</strong> Pause a specific model if it exceeds its historical max drawdown</li>
</ul>

<h3>Sharpe Ratio — The Primary Performance Metric</h3>
<pre><code>Sharpe Ratio = (Strategy Return - Risk-Free Rate) / Strategy Volatility

Sharpe of:
  &lt; 0.5   Poor — not worth trading
  0.5-1.0 Acceptable for trend-following
  1.0-2.0 Good — institutional quality
  &gt; 2.0  Excellent — verify it is not overfit</code></pre>
<p>A strategy returning 40% per year with a Sharpe of 0.3 will be emotionally impossible to trade through its drawdowns. The Sharpe ratio is more informative than raw returns alone.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Risk 1-2% of capital per trade maximum — keeps you solvent through inevitable drawdown periods</li>
    <li>Position size = dollars to risk ÷ distance to stop. Always calculate before entering.</li>
    <li>Set daily and portfolio-level drawdown circuit breakers in all automated systems</li>
    <li>Sharpe ratio &gt; 1.0 is the benchmark for institutional-quality strategy performance</li>
  </ul>
</div>`
},

// ═══════════════════════════════════════════════════════════════════
// MODULE 2 — Python for Traders
// ═══════════════════════════════════════════════════════════════════
{
  id:"2.1", module:2, tier:"basic", duration:45,
  title:"Environment Setup — Python, Jupyter, VS Code",
  audio:"/audio/course-2-1.mp3", video:null,
  content:`
<h2>Environment Setup — Python, Jupyter, VS Code</h2>
<p class="lesson-intro">A proper development environment is the foundation of everything. This lesson walks you through the exact setup used to build this dashboard — reproducible, portable, and production-ready.</p>

<h3>Installing Python</h3>
<p>Install Python 3.11 or later from python.org. During installation on Windows: check "Add Python to PATH" and "Install pip". Verify:</p>
<pre><code class="language-bash">python --version   # Python 3.11.x or higher
pip --version      # pip 23.x or higher</code></pre>

<h3>Virtual Environments</h3>
<p>Always use a virtual environment to isolate project dependencies and prevent version conflicts between projects.</p>
<pre><code class="language-bash"># Create virtual environment
python -m venv trading-env

# Activate (Windows)
trading-env\Scripts\activate

# Activate (Mac/Linux)
source trading-env/bin/activate

# Prompt changes to:
(trading-env) C:\Projects\trading&gt;</code></pre>

<h3>Installing Core Packages</h3>
<pre><code class="language-bash">pip install numpy pandas matplotlib yfinance scikit-learn xgboost
pip install flask requests jupyter notebook plotly optuna

# Save your environment
pip freeze &gt; requirements.txt
# Restore later with:
pip install -r requirements.txt</code></pre>

<h3>VS Code Setup</h3>
<p>Install these VS Code extensions:</p>
<ul>
  <li><strong>Python</strong> (Microsoft) — syntax highlighting, IntelliSense, debugging</li>
  <li><strong>Pylance</strong> — type checking and better autocomplete</li>
  <li><strong>Jupyter</strong> — run notebooks directly in VS Code</li>
  <li><strong>GitLens</strong> — enhanced git integration</li>
</ul>
<p>Select interpreter: <code>Ctrl+Shift+P</code> → "Python: Select Interpreter" → choose <code>trading-env/Scripts/python.exe</code></p>

<h3>Project Structure</h3>
<pre><code>trading-project/
├── data/            &lt;-- Raw and processed CSV files
├── notebooks/       &lt;-- Exploration (.ipynb)
├── models/          &lt;-- Saved model files (.pkl, .json)
├── src/
│   ├── features.py  &lt;-- Feature engineering
│   ├── model.py     &lt;-- Model training/prediction
│   └── backtest.py  &lt;-- Backtesting framework
├── requirements.txt
└── README.md</code></pre>
<p>Use Jupyter for exploration and prototyping. Use <code>.py</code> files for production code — notebooks have hidden state that makes them unreliable for automated execution.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Always use virtual environments — one per project, no exceptions</li>
    <li>Install Python 3.11+, VS Code, and the core stack (numpy, pandas, scikit-learn, xgboost, yfinance)</li>
    <li>Use Jupyter for exploration, .py files for production code</li>
    <li>Organize your project from day one — clean structure saves hours later</li>
  </ul>
</div>`
},

{
  id:"2.2", module:2, tier:"basic", duration:60,
  title:"Python Basics for Traders",
  audio:"/audio/course-2-2.mp3", video:null,
  content:`
<h2>Python Basics for Traders</h2>
<p class="lesson-intro">This lesson covers the Python fundamentals you'll actually use when working with market data. We skip theoretical computer science and focus on the patterns that appear constantly in trading code.</p>

<h3>Variables and Data Types</h3>
<pre><code class="language-python">price    = 450.25          # float
volume   = 1_500_000       # int (underscores for readability)
symbol   = 'SPY'           # str
is_long  = True            # bool

# Type hints improve code clarity
def get_signal(symbol: str, threshold: float = 0.55) -&gt; int:
    ...</code></pre>

<h3>Lists and Dictionaries</h3>
<pre><code class="language-python"># List — ordered, mutable sequence
strikes = [440, 445, 450, 455, 460]
strikes.append(465)       # Add to end
strikes[0]                # 440 (first element)
strikes[-1]               # 465 (last element)
strikes[1:3]              # [445, 450] (slice)

# Dictionary — key-value store
asset = {
    'symbol': 'SPY',
    'spot': 450.25,
    'gamma_wall': 455.0,
    'sentiment': 'BULLISH'
}
asset['symbol']           # 'SPY'
asset.get('iv', 0.20)     # 0.20 (default if key missing)

# List comprehension — Pythonic transformation
call_prem_k = [round(p / 1000, 2) for p in call_premiums]
bullish_assets = [a for a in assets if a['sentiment'] == 'BULLISH']</code></pre>

<h3>Control Flow</h3>
<pre><code class="language-python">if prob_up &gt; 0.60:
    signal = 'LONG'
elif prob_up &lt; 0.40:
    signal = 'SHORT'
else:
    signal = 'FLAT'

for asset in assets:
    print(f"{asset['symbol']}: {asset['spot']:.2f}")

# Enumerate when you need index too
for i, strike in enumerate(strikes):
    print(f"Strike {i}: \${strike}")</code></pre>

<h3>Functions</h3>
<pre><code class="language-python">def calculate_pcr(call_vol: float, put_vol: float) -&gt; float:
    '''Put/Call ratio. Returns NaN if call_vol is zero.'''
    if call_vol == 0:
        return float('nan')
    return put_vol / call_vol

def position_size(account: float, risk_pct: float,
                  entry: float, stop: float) -&gt; int:
    risk_per_share = abs(entry - stop)
    if risk_per_share == 0:
        return 0
    return int((account * risk_pct) / risk_per_share)</code></pre>

<h3>Error Handling</h3>
<pre><code class="language-python">import requests

def fetch_with_retry(url: str, max_retries: int = 3) -&gt; dict:
    for attempt in range(max_retries):
        try:
            r = requests.get(url, timeout=10)
            r.raise_for_status()
            return r.json()
        except requests.exceptions.Timeout:
            print(f'Timeout on attempt {attempt + 1}')
        except requests.exceptions.HTTPError as e:
            print(f'HTTP Error: {e}')
            break   # Don't retry on HTTP errors
    return {}</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Lists and dicts are your primary data containers — master indexing, slicing, and comprehensions</li>
    <li>List comprehensions are the Pythonic way to transform sequences — use them constantly</li>
    <li>Always handle exceptions in data fetching code — APIs fail, timeouts happen</li>
    <li>Functions should do one thing well and have clear input/output types</li>
  </ul>
</div>`
},

{
  id:"2.3", module:2, tier:"basic", duration:70,
  title:"Pandas — The Trader's Data Engine",
  audio:"/audio/course-2-3.mp3", video:null,
  content:`
<h2>Pandas — The Trader's Data Engine</h2>
<p class="lesson-intro">Pandas is the single most important library for financial data analysis. Every piece of market data you'll work with lives in a Pandas DataFrame. Mastering it is non-negotiable.</p>

<h3>DataFrames and Series</h3>
<pre><code class="language-python">import pandas as pd
import numpy as np

df = pd.DataFrame({
    'open':  [448.20, 449.50, 451.00],
    'high':  [450.80, 452.00, 453.50],
    'low':   [447.00, 448.80, 450.20],
    'close': [449.30, 451.20, 452.80],
    'volume':[75_000_000, 82_000_000, 68_000_000]
}, index=pd.date_range('2024-01-02', periods=3, freq='D'))

close = df['close']      # Series (1D)
close = df[['close']]    # DataFrame (2D, double brackets)</code></pre>

<h3>Indexing and Selection</h3>
<pre><code class="language-python"># .loc — label-based
df.loc['2024-01-02']                    # One row
df.loc['2024-01-02':'2024-01-03']       # Date range
df.loc['2024-01-02', 'close']           # Specific cell

# .iloc — position-based
df.iloc[0]           # First row
df.iloc[-1]          # Last row

# Boolean filtering — the most-used pattern
bullish  = df[df['close'] &gt; df['open']]
high_vol = df[df['volume'] &gt; df['volume'].mean()]</code></pre>

<h3>Essential Operations</h3>
<pre><code class="language-python"># Returns
df['returns']     = df['close'].pct_change()
df['log_returns'] = np.log(df['close']).diff()

# Rolling calculations
df['sma_20'] = df['close'].rolling(20).mean()
df['ema_20'] = df['close'].ewm(span=20).mean()
df['std_20'] = df['close'].rolling(20).std()

# Shift — create lagged features
df['prev_close']  = df['close'].shift(1)   # Yesterday's close
df['next_return'] = df['returns'].shift(-1) # Tomorrow's return (TARGET — careful!)

# Cumulative return
df['equity'] = (1 + df['returns']).cumprod()</code></pre>

<h3>Handling Missing Data</h3>
<pre><code class="language-python">df.isnull().sum()                    # Count NaNs per column

df.fillna(method='ffill', inplace=True)  # Forward fill (standard for OHLCV)
df.dropna(inplace=True)              # Drop rows with any NaN

# Replace inf (common after pct_change on 0 prices)
df.replace([np.inf, -np.inf], np.nan, inplace=True)
df.dropna(inplace=True)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Every market dataset is a DataFrame — learn .loc, .iloc, and boolean filtering cold</li>
    <li><code>pct_change()</code>, <code>rolling()</code>, <code>shift()</code>, and <code>ewm()</code> are your four most-used methods</li>
    <li>When creating targets with <code>shift(-1)</code>, be careful — this is where lookahead bias enters</li>
    <li>Always call <code>dropna()</code> after computing lagged/rolling features before training</li>
  </ul>
</div>`
},

{
  id:"2.4", module:2, tier:"basic", duration:50,
  title:"Fetching Live Market Data with yfinance",
  audio:"/audio/course-2-4.mp3", video:null,
  content:`
<h2>Fetching Live Market Data with yfinance</h2>
<p class="lesson-intro">yfinance is the most accessible source of market data for retail quants. It wraps Yahoo Finance's API and delivers clean OHLCV data, options chains, and fundamental data — free, no API key required.</p>

<h3>Basic Usage</h3>
<pre><code class="language-python">import yfinance as yf

# Download daily OHLCV — last 1 year
spy = yf.download('SPY', period='1y', interval='1d', auto_adjust=True)
print(spy.tail())
#             Open    High     Low   Close      Volume
# 2024-01-15  470.28  471.85  469.40  471.20  67234000</code></pre>

<h3>Timeframe Options</h3>
<table class="lesson-table">
  <tr><th>Interval</th><th>Max Period</th><th>Notes</th></tr>
  <tr><td>1m, 5m</td><td>7 days</td><td>Very limited history</td></tr>
  <tr><td>15m, 30m, 60m</td><td>60 days</td><td>More intraday history</td></tr>
  <tr><td>1h</td><td>730 days</td><td>Good for swing features</td></tr>
  <tr><td>1d</td><td>Full history</td><td>Best for ML training ✓</td></tr>
  <tr><td>1wk, 1mo</td><td>Full history</td><td>Long-term analysis</td></tr>
</table>

<h3>Multiple Symbols and Options Data</h3>
<pre><code class="language-python"># Download multiple symbols efficiently
symbols = ['SPY', 'QQQ', 'IWM', 'AAPL', 'NVDA']
data = yf.download(symbols, period='2y', interval='1d', auto_adjust=True)
spy_close = data['Close']['SPY']

# Options chain via Ticker object
ticker = yf.Ticker('SPY')
expirations = ticker.options            # List of expiry dates
chain = ticker.option_chain('2024-01-19')
calls = chain.calls                     # DataFrame of call contracts
puts  = chain.puts                      # DataFrame of put contracts

# Columns: strike, lastPrice, bid, ask, volume, openInterest, impliedVolatility</code></pre>

<h3>Reusable Data Fetcher with Caching</h3>
<pre><code class="language-python">from pathlib import Path
import yfinance as yf, pandas as pd

DATA_DIR = Path('data/ohlcv')
DATA_DIR.mkdir(parents=True, exist_ok=True)

def load_ohlcv(symbol: str, period: str = '5y',
               interval: str = '1d',
               force: bool = False) -&gt; pd.DataFrame:
    cache = DATA_DIR / f'{symbol}_{interval}.csv'
    if cache.exists() and not force:
        return pd.read_csv(cache, index_col=0, parse_dates=True)

    df = yf.download(symbol, period=period, interval=interval,
                     auto_adjust=True, progress=False)
    df.columns = [c.lower() for c in df.columns]
    df.to_csv(cache)
    return df

spy = load_ohlcv('SPY', period='5y')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>yfinance is free, no API key — perfect for prototyping and backtesting</li>
    <li>Daily bars have full history; intraday is limited to 7–730 days by interval</li>
    <li>Use <code>auto_adjust=True</code> for split/dividend-adjusted prices in accurate backtests</li>
    <li>Build a caching layer from day one — fetching fresh data every run wastes time and hits rate limits</li>
  </ul>
</div>`
},

{
  id:"2.5", module:2, tier:"basic", duration:40,
  title:"NumPy for Numerical Finance",
  audio:"/audio/course-2-5.mp3", video:null,
  content:`
<h2>NumPy for Numerical Finance</h2>
<p class="lesson-intro">NumPy is the mathematical backbone of the Python data science stack. While Pandas handles labeled data, NumPy handles the raw array math underneath — making your financial calculations 10-100x faster than pure Python.</p>

<h3>Arrays vs. Lists</h3>
<pre><code class="language-python">import numpy as np

prices_list = [450.25, 451.80, 449.60, 452.10]     # Python list — slow for math
prices = np.array([450.25, 451.80, 449.60, 452.10]) # NumPy — vectorized, fast

# Vectorized math — no loops needed
returns = np.diff(prices) / prices[:-1]   # % change for all at once
# [0.00344, -0.00487, 0.00556]</code></pre>

<h3>Essential NumPy Functions for Finance</h3>
<pre><code class="language-python">prices = np.array([450.25, 451.80, 449.60, 452.10, 448.50])

np.mean(prices)                        # Average price
np.std(prices)                         # Standard deviation (volatility proxy)
np.max(prices), np.min(prices)         # High, Low
np.percentile(prices, 25)             # 25th percentile

# Log returns — additive and more normally distributed
log_returns = np.log(prices[1:] / prices[:-1])

# Annualized volatility (daily returns)
annual_vol = np.std(log_returns) * np.sqrt(252)

# Correlation between two assets
spy_r = np.array([0.012, -0.005, 0.008, -0.003])
qqq_r = np.array([0.015, -0.007, 0.010, -0.004])
corr = np.corrcoef(spy_r, qqq_r)[0, 1]   # ~0.99</code></pre>

<h3>Boolean Indexing and np.where</h3>
<pre><code class="language-python">prices = np.array([450, 451, 449, 452, 448])

above_450 = prices &gt; 450                # [F, T, F, T, F]
prices[above_450]                       # [451, 452]

# Conditional signal generation
signals = np.where(prices &gt; 450, 1, -1)  # 1 if above 450, else -1

# Reshape for sklearn — features must be 2D
X = prices.reshape(-1, 1)   # shape (5, 1)</code></pre>

<h3>Key Financial Formulas</h3>
<pre><code class="language-python"># Annualized Sharpe ratio from daily returns
def sharpe(returns, rf=0.0):
    excess = returns - rf/252
    return np.mean(excess) / (np.std(excess) + 1e-9) * np.sqrt(252)

# Max drawdown
def max_drawdown(returns):
    equity = np.cumprod(1 + returns)
    peak   = np.maximum.accumulate(equity)
    dd     = (equity - peak) / peak
    return dd.min()</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>NumPy arrays are 10-100x faster than Python lists — always use them for bulk math</li>
    <li>Vectorized operations (no loops) are the key to fast financial calculations</li>
    <li>Use <code>np.log(p1/p0)</code> for log returns — additive and better-behaved statistically</li>
    <li>Annualize daily volatility by multiplying by <code>sqrt(252)</code> — the number of trading days</li>
  </ul>
</div>`
},

{
  id:"2.6", module:2, tier:"basic", duration:50,
  title:"Data Cleaning and Preprocessing",
  audio:"/audio/course-2-6.mp3", video:null,
  content:`
<h2>Data Cleaning and Preprocessing</h2>
<p class="lesson-intro">Real market data is messy. Gaps, errors, corporate actions, and timezone issues are common. Clean data is the difference between a reliable ML model and one that fails in production.</p>

<h3>Common Data Quality Issues</h3>
<ul>
  <li><strong>Missing values (NaN)</strong> — weekends/holidays, halted trading, data provider gaps</li>
  <li><strong>Outliers / bad ticks</strong> — erroneous prints from exchange glitches</li>
  <li><strong>Survivorship bias</strong> — datasets with only currently-listed stocks overstate historical returns</li>
  <li><strong>Lookahead bias</strong> — accidentally including future information in historical features</li>
  <li><strong>Timezone misalignment</strong> — mixing UTC, ET, and local time causes wrong price matching</li>
</ul>

<h3>Detecting and Handling Gaps</h3>
<pre><code class="language-python">import pandas as pd
import numpy as np

df = pd.read_csv('spy_1h.csv', index_col=0, parse_dates=True)

# Find gaps in the time index
expected = pd.date_range(df.index[0], df.index[-1], freq='1h')
missing  = expected.difference(df.index)
print(f'Missing bars: {len(missing)}')

# Forward fill (appropriate for OHLCV — last price persists)
df = df.reindex(expected).fillna(method='ffill')

# Drop non-trading hours
df = df.between_time('09:30', '16:00')
df = df[df.index.dayofweek &lt; 5]  # Keep Mon-Fri</code></pre>

<h3>Outlier Detection — Bad Ticks</h3>
<pre><code class="language-python"># Z-score filter — flag returns beyond 5 standard deviations
df['returns'] = df['close'].pct_change()
zscore = (df['returns'] - df['returns'].mean()) / df['returns'].std()

# Replace outlier prices with NaN, then forward fill
bad = abs(zscore) &gt; 5
df.loc[bad, ['open','high','low','close']] = np.nan
df.fillna(method='ffill', inplace=True)

# Sanity checks
assert (df['high'] &gt;= df['low']).all(), 'High &lt; Low detected!'
assert (df['close'] &lt;= df['high']).all(), 'Close above High!'</code></pre>

<h3>Survivorship Bias</h3>
<p>If you download current S&amp;P 500 constituents and backtest on them, you're using stocks that <em>survived</em> to be listed today. Companies that went bankrupt or were delisted are excluded, artificially inflating backtest returns.</p>
<p><strong>Mitigation:</strong> Test on liquid ETFs (SPY, QQQ) — they have no survivorship bias. Use futures (ES, NQ) — continuous contracts avoid this entirely.</p>

<h3>Reusable Clean Function</h3>
<pre><code class="language-python">def clean_ohlcv(df: pd.DataFrame) -&gt; pd.DataFrame:
    df = df.copy()
    df.columns = [c.lower().strip() for c in df.columns]
    df = df[~df.index.duplicated(keep='first')]
    df.sort_index(inplace=True)
    price_cols = ['open', 'high', 'low', 'close']
    df[price_cols] = df[price_cols].replace(0, np.nan)
    df.fillna(method='ffill', inplace=True)
    df.dropna(inplace=True)
    return df</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Always clean before you compute — garbage in, garbage out applies doubly in ML</li>
    <li>Forward fill missing OHLCV bars — last known price is the correct assumption</li>
    <li>Survivorship bias inflates backtest returns — test on ETFs/futures to avoid it</li>
    <li>Build a reusable <code>clean_ohlcv()</code> function and apply it every time you load data</li>
  </ul>
</div>`
},

{
  id:"2.7", module:2, tier:"basic", duration:45,
  title:"Visualization — Charting Market Data",
  audio:"/audio/course-2-7.mp3", video:null,
  content:`
<h2>Visualization — Charting Market Data</h2>
<p class="lesson-intro">Visualization is how you understand data, validate signals, debug models, and communicate results. This lesson covers the charting tools used throughout this dashboard and in professional quant research.</p>

<h3>Matplotlib — Static Charts</h3>
<pre><code class="language-python">import matplotlib.pyplot as plt
import yfinance as yf

spy = yf.download('SPY', period='6mo', interval='1d', auto_adjust=True)
spy.columns = [c.lower() for c in spy.columns]

fig, axes = plt.subplots(2, 1, figsize=(14, 8),
                          gridspec_kw={'height_ratios': [3, 1]})

# Price chart
axes[0].plot(spy.index, spy['close'], color='#22d3ee', lw=1.5)
axes[0].fill_between(spy.index, spy['close'], spy['close'].min(),
                      alpha=0.1, color='#22d3ee')
axes[0].set_title('SPY — Last 6 Months', fontsize=14, fontweight='bold')
axes[0].set_facecolor('#0f172a')

# Volume bars — green on up days, red on down days
colors = ['#4ade80' if c &gt;= o else '#f87171'
          for c, o in zip(spy['close'], spy['open'])]
axes[1].bar(spy.index, spy['volume'], color=colors, alpha=0.8)
axes[1].set_ylabel('Volume')

plt.tight_layout()
plt.savefig('spy_chart.png', dpi=150, bbox_inches='tight')
plt.show()</code></pre>

<h3>Plotly — Interactive Charts</h3>
<pre><code class="language-python">import plotly.graph_objects as go
from plotly.subplots import make_subplots

fig = make_subplots(rows=2, cols=1, row_heights=[0.75, 0.25],
                    shared_xaxes=True, vertical_spacing=0.02)

fig.add_trace(go.Candlestick(
    x=spy.index, open=spy['open'], high=spy['high'],
    low=spy['low'], close=spy['close'], name='SPY'
), row=1, col=1)

colors = ['#4ade80' if c &gt;= o else '#f87171'
          for c, o in zip(spy['close'], spy['open'])]
fig.add_trace(go.Bar(x=spy.index, y=spy['volume'],
                     marker_color=colors, name='Volume'), row=2, col=1)

fig.update_layout(template='plotly_dark', title='SPY Interactive Chart',
                  xaxis_rangeslider_visible=False, height=600)
fig.show()   # Fully interactive: zoom, pan, hover OHLCV</code></pre>

<h3>Visualizing Strategy Performance</h3>
<pre><code class="language-python">fig, axes = plt.subplots(2, 1, figsize=(14, 8))
axes[0].plot(results.index, results['strategy_equity'],
             color='#4ade80', label='ML Strategy')
axes[0].plot(results.index, results['buy_hold_equity'],
             color='#94a3b8', label='Buy &amp; Hold')
axes[0].legend()
axes[0].set_title('Strategy vs Buy &amp; Hold')

axes[1].fill_between(results.index, results['drawdown'], 0,
                      color='#f87171', alpha=0.7)
axes[1].set_title('Drawdown')
plt.tight_layout()
plt.show()</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Matplotlib for static publication-quality charts; Plotly for interactive exploration</li>
    <li>Color-code volume bars green/red to instantly see buying vs. selling days</li>
    <li>Always plot equity curve and drawdown together — returns without drawdown context mislead</li>
    <li>Visualize feature distributions before training — data understanding prevents model failures</li>
  </ul>
</div>`
},

{
  id:"2.8", module:2, tier:"basic", duration:60,
  title:"Project — Build a Market Data Pipeline",
  audio:"/audio/course-2-8.mp3", video:null,
  content:`
<h2>Project — Build a Market Data Pipeline</h2>
<p class="lesson-intro">This project ties together everything in Module 2. You'll build a complete, production-ready pipeline that fetches, cleans, stores, and serves market data for any symbol — the foundation every ML model in this course will use.</p>

<h3>Pipeline Architecture</h3>
<pre><code>yfinance API
    |
fetch_ohlcv()    &lt;-- Download raw OHLCV
    |
clean_ohlcv()    &lt;-- Remove gaps, bad ticks, duplicates
    |
add_returns()    &lt;-- pct_change, log_returns, hl_range
    |
save to CSV      &lt;-- Cache to disk
    |
load_pipeline()  &lt;-- Single entry point for all models</code></pre>

<h3>Complete Pipeline (market_data.py)</h3>
<pre><code class="language-python">import yfinance as yf
import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path('data/ohlcv')
DATA_DIR.mkdir(parents=True, exist_ok=True)

def fetch_ohlcv(symbol, period='5y', interval='1d'):
    df = yf.download(symbol, period=period, interval=interval,
                     auto_adjust=True, progress=False)
    df.columns = [c.lower() for c in df.columns]
    df.index.name = 'date'
    return df

def clean_ohlcv(df):
    df = df.copy()
    df = df[~df.index.duplicated(keep='first')]
    df.sort_index(inplace=True)
    for col in ['open', 'high', 'low', 'close']:
        df[col] = df[col].replace(0, np.nan)
    df.fillna(method='ffill', inplace=True)
    df.dropna(inplace=True)
    return df

def add_returns(df):
    df = df.copy()
    df['returns']     = df['close'].pct_change()
    df['log_returns'] = np.log(df['close'] / df['close'].shift(1))
    df['hl_range']    = (df['high'] - df['low']) / df['close']
    df['gap']         = (df['open'] - df['close'].shift(1)) / df['close'].shift(1)
    return df

def load_pipeline(symbol, period='5y', interval='1d', force=False):
    cache = DATA_DIR / f'{symbol}_{interval}.csv'
    if cache.exists() and not force:
        df = pd.read_csv(cache, index_col=0, parse_dates=True)
        print(f'Loaded {len(df)} bars from cache')
        return df
    df = fetch_ohlcv(symbol, period, interval)
    df = clean_ohlcv(df)
    df = add_returns(df)
    df.to_csv(cache)
    print(f'Saved {len(df)} bars to {cache.name}')
    return df

if __name__ == '__main__':
    SYMBOLS = ['SPY', 'QQQ', 'IWM', 'AAPL', 'NVDA', 'MSFT']
    for sym in SYMBOLS:
        df = load_pipeline(sym, force=True)
        print(f'  {sym}: {len(df)} bars, last \${df["close"].iloc[-1]:.2f}')</code></pre>

<h3>Test It</h3>
<pre><code class="language-python">from market_data import load_pipeline

spy = load_pipeline('SPY')
print(spy.columns.tolist())
# ['open', 'high', 'low', 'close', 'volume', 'returns', 'log_returns', 'hl_range', 'gap']
print(spy.isnull().sum().sum())  # Should be 0</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Build one clean pipeline all models use — consistency prevents data bugs from hiding in production</li>
    <li>Cache aggressively — only re-fetch when explicitly asked</li>
    <li>Add returns at the pipeline level, not in each model — DRY principle</li>
    <li>This <code>load_pipeline()</code> is your entry point for every ML model in Modules 3 and 4</li>
  </ul>
</div>`
},

// ═══════════════════════════════════════════════════════════════════
// MODULE 3 — Technical Indicators & Feature Engineering
// ═══════════════════════════════════════════════════════════════════
{
  id:"3.1", module:3, tier:"basic", duration:45,
  title:"Moving Averages — SMA, EMA, and VWAP",
  audio:"/audio/course-3-1.mp3", video:null,
  content:`
<h2>Moving Averages — SMA, EMA, and VWAP</h2>
<p class="lesson-intro">Moving averages smooth price noise to reveal trends, generate crossover signals, and define dynamic support and resistance. For ML models, moving average ratios and crossovers are among the most predictive features available.</p>

<h3>Simple Moving Average (SMA)</h3>
<pre><code class="language-python">for period in [5, 10, 20, 50, 100, 200]:
    df[f'sma_{period}'] = df['close'].rolling(period).mean()

# Key derived features — ratios not raw levels
df['price_sma20']   = df['close'] / df['sma_20'] - 1      # % above/below
df['price_sma200']  = df['close'] / df['sma_200'] - 1
df['sma20_slope']   = df['sma_20'].pct_change(5)           # SMA trending direction
df['golden_cross']  = (df['sma_50'] &gt; df['sma_200']).astype(int)  # Bull regime</code></pre>

<h3>Exponential Moving Average (EMA)</h3>
<p>EMA gives more weight to recent prices — more responsive to current conditions. Preferred for short-term signals.</p>
<pre><code class="language-python">for period in [9, 12, 21, 26, 50]:
    df[f'ema_{period}'] = df['close'].ewm(span=period, adjust=False).mean()

# EMA crossover signal
df['ema_cross'] = np.where(df['ema_9'] &gt; df['ema_21'], 1, -1)
df['ema_cross_change'] = df['ema_cross'].diff()  # 2=bullish cross, -2=bearish</code></pre>

<h3>VWAP — The Institutional Benchmark</h3>
<p>VWAP is the most important intraday reference level. Price above VWAP = bullish intraday momentum; below = bearish. Institutions use it as the benchmark for execution quality.</p>
<pre><code class="language-python">def calculate_vwap(df):
    df = df.copy()
    df['tp'] = (df['high'] + df['low'] + df['close']) / 3
    df['tp_vol'] = df['tp'] * df['volume']
    df['cum_tpv'] = df.groupby(df.index.date)['tp_vol'].cumsum()
    df['cum_vol'] = df.groupby(df.index.date)['volume'].cumsum()
    df['vwap']    = df['cum_tpv'] / df['cum_vol']
    df['vwap_dev']= (df['close'] - df['vwap']) / df['vwap']  # % deviation
    return df</code></pre>

<h3>Which Periods Matter?</h3>
<table class="lesson-table">
  <tr><th>Indicator</th><th>Key Periods</th><th>Why</th></tr>
  <tr><td>SMA</td><td>20, 50, 200</td><td>Monthly, quarterly, annual — institutions reference these</td></tr>
  <tr><td>EMA</td><td>9, 21</td><td>Short-term signals; popular day trading crossover</td></tr>
  <tr><td>EMA</td><td>12, 26</td><td>MACD components — widely watched</td></tr>
  <tr><td>VWAP</td><td>Daily reset</td><td>Intraday institutional fair value</td></tr>
</table>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Use ratios (close/SMA − 1) not raw averages as ML features — removes non-stationarity</li>
    <li>EMA responds faster than SMA — use EMA for momentum signals, SMA for trend regime</li>
    <li>VWAP is the most important intraday level — price above VWAP is bullish, below is bearish</li>
    <li>The 200-day SMA is the single most-watched level by institutional portfolio managers</li>
  </ul>
</div>`
},

{
  id:"3.2", module:3, tier:"basic", duration:50,
  title:"Momentum Indicators — RSI and MACD",
  audio:"/audio/course-3-2.mp3", video:null,
  content:`
<h2>Momentum Indicators — RSI and MACD</h2>
<p class="lesson-intro">Momentum measures the speed and direction of price change. RSI and MACD are the two most widely used momentum indicators — and both have strong predictive value as ML features when properly constructed.</p>

<h3>RSI — Relative Strength Index</h3>
<p>RSI measures gains vs. losses over 14 periods, normalized to 0-100. Above 70 = overbought; below 30 = oversold.</p>
<pre><code class="language-python">def calculate_rsi(prices, period=14):
    delta = prices.diff()
    gain  = delta.clip(lower=0)
    loss  = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period).mean()
    rs  = avg_gain / (avg_loss + 1e-9)
    return 100 - (100 / (1 + rs))

df['rsi_14']      = calculate_rsi(df['close'])
df['rsi_7']       = calculate_rsi(df['close'], 7)  # Faster
df['rsi_norm']    = df['rsi_14'] / 100               # Scale to 0-1 for ML
df['rsi_overbought'] = (df['rsi_14'] &gt; 70).astype(int)
df['rsi_oversold']   = (df['rsi_14'] &lt; 30).astype(int)</code></pre>

<h3>MACD — Moving Average Convergence Divergence</h3>
<p>MACD shows the relationship between 12 and 26-period EMAs. The signal line (9-period EMA of MACD) generates crossover signals. The histogram shows momentum acceleration.</p>
<pre><code class="language-python">def calculate_macd(prices, fast=12, slow=26, signal=9):
    ema_fast    = prices.ewm(span=fast,   adjust=False).mean()
    ema_slow    = prices.ewm(span=slow,   adjust=False).mean()
    macd_line   = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram   = macd_line - signal_line
    return macd_line, signal_line, histogram

df['macd'], df['macd_sig'], df['macd_hist'] = calculate_macd(df['close'])

# Normalize by price level for cross-asset comparison
df['macd_norm']  = df['macd'] / df['close']
df['macd_accel'] = df['macd_hist'].diff()   # Is momentum growing or shrinking?</code></pre>

<h3>Momentum Confluence Score</h3>
<pre><code class="language-python"># Combine indicators into a composite signal — more robust than any single one
df['momentum_score'] = (
    (df['rsi_14'] &gt; 50).astype(int) +
    (df['macd'] &gt; df['macd_sig']).astype(int) +
    (df['close'] &gt; df['sma_20']).astype(int)
)
# 0-3 score: higher = stronger bullish confluence</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>RSI: normalize to 0-1 for ML; level, rate-of-change, and divergences are all useful features</li>
    <li>MACD histogram direction (accelerating vs. decelerating) often matters more than sign alone</li>
    <li>Normalize all momentum indicators by price level for cross-asset and cross-time comparisons</li>
    <li>Combine 2-3 indicators into a confluence score — more robust than any single indicator</li>
  </ul>
</div>`
},

{
  id:"3.3", module:3, tier:"basic", duration:40,
  title:"Volatility — Bollinger Bands and ATR",
  audio:"/audio/course-3-3.mp3", video:null,
  content:`
<h2>Volatility — Bollinger Bands and ATR</h2>
<p class="lesson-intro">Volatility is the most important risk dimension in markets. ML models that incorporate volatility features adapt their predictions to the current market regime — performing better than models that treat all market conditions the same.</p>

<h3>Average True Range (ATR)</h3>
<p>ATR measures the average candle range, accounting for overnight gaps. The professional standard for position sizing and stop placement.</p>
<pre><code class="language-python">def calculate_atr(df, period=14):
    high, low, close = df['high'], df['low'], df['close']
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs()
    ], axis=1).max(axis=1)
    return tr.ewm(span=period, adjust=False).mean()

df['atr_14']  = calculate_atr(df)
df['atr_pct'] = df['atr_14'] / df['close']   # Normalize as % of price

# Dynamic stop loss based on ATR
entry = df['close'].iloc[-1]
stop  = entry - 2 * df['atr_14'].iloc[-1]    # 2x ATR below entry</code></pre>

<h3>Bollinger Bands</h3>
<p>2 standard deviations above and below a 20-period SMA. Price touches the upper band ~5% of the time — signaling either breakout (trend) or overextension (reversion).</p>
<pre><code class="language-python">def bollinger_bands(df, period=20, std=2.0):
    sma    = df['close'].rolling(period).mean()
    stddev = df['close'].rolling(period).std()
    upper  = sma + std * stddev
    lower  = sma - std * stddev
    width  = (upper - lower) / sma          # Bandwidth — volatility measure
    pct_b  = (df['close'] - lower) / (upper - lower + 1e-9)  # 0=lower, 1=upper
    return sma, upper, lower, width, pct_b

df['bb_mid'], df['bb_up'], df['bb_lo'], df['bb_width'], df['bb_pctb'] = bollinger_bands(df)

# Squeeze: low bandwidth = coiled spring, often precedes large move
df['bb_squeeze'] = (df['bb_width'] &lt; df['bb_width'].rolling(125).quantile(0.20)).astype(int)</code></pre>

<h3>Historical Volatility and Regimes</h3>
<pre><code class="language-python">df['hv_20'] = df['returns'].rolling(20).std() * np.sqrt(252)  # Annualized
df['hv_60'] = df['returns'].rolling(60).std() * np.sqrt(252)
df['vol_ratio'] = df['hv_20'] / df['hv_60']    # &gt;1 = vol expanding

# Classify into 3 regimes
vol_pct = df['hv_20'].rank(pct=True)
df['vol_regime'] = pd.cut(vol_pct, bins=[0, 0.33, 0.67, 1.0],
                           labels=['low', 'medium', 'high'])</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>ATR is the professional standard for volatility — always normalize as % of price</li>
    <li>Bollinger Band %B and Width are better ML features than the raw band levels</li>
    <li>BB Squeeze (narrow bands) often precedes large directional moves</li>
    <li>Volatility regime as a categorical feature — models often behave very differently in low vs. high vol</li>
  </ul>
</div>`
},

{
  id:"3.4", module:3, tier:"basic", duration:40,
  title:"Volume Analysis",
  audio:"/audio/course-3-4.mp3", video:null,
  content:`
<h2>Volume Analysis</h2>
<p class="lesson-intro">Price moves with volume behind them are real; price moves without volume are suspect. Volume analysis adds the "conviction" dimension that pure price indicators miss.</p>

<h3>Relative Volume</h3>
<pre><code class="language-python"># Normalize volume — removes secular growth trends over years
df['volume_sma20'] = df['volume'].rolling(20).mean()
df['rel_volume']   = df['volume'] / df['volume_sma20']  # 1.0 = average day
df['high_volume']  = (df['rel_volume'] &gt; 1.5).astype(int)  # Above-average conviction

# Volume-weighted return
df['vol_weighted_return'] = df['returns'] * df['rel_volume']</code></pre>

<h3>On-Balance Volume (OBV)</h3>
<p>OBV cumulates volume on up-days and subtracts on down-days. It reveals whether money is flowing into or out of an asset before price confirms the move.</p>
<pre><code class="language-python">def calculate_obv(df):
    direction = np.sign(df['close'].diff())
    direction.iloc[0] = 0
    return (df['volume'] * direction).cumsum()

df['obv']      = calculate_obv(df)
df['obv_sma']  = df['obv'].rolling(20).mean()
df['obv_signal'] = np.where(df['obv'] &gt; df['obv_sma'], 1, -1)

# OBV divergence: price up but OBV flat/down = distribution warning
df['obv_div'] = (
    (df['close'] &gt; df['close'].shift(10)) &amp;
    (df['obv']   &lt; df['obv'].shift(10))
).astype(int)</code></pre>

<h3>Volume Trend Features</h3>
<pre><code class="language-python"># Rising vs. falling volume trend
df['vol_trend']   = df['volume'].rolling(5).mean() / df['volume'].rolling(20).mean() - 1

# Volume on up vs. down days — buying vs. selling pressure
df['up_volume']   = df['volume'].where(df['close'] &gt; df['open'], 0)
df['down_volume'] = df['volume'].where(df['close'] &lt;= df['open'], 0)
df['vol_ratio']   = df['up_volume'].rolling(10).sum() / (
                    df['down_volume'].rolling(10).sum() + 1e-9)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Always normalize volume as relative volume (vs. 20-day average) — raw volume grows over time</li>
    <li>High relative volume + price breakout = strong signal; breakout on low volume = risk of failure</li>
    <li>OBV divergence (price up, OBV down) is a reliable distribution warning for ML classification</li>
    <li>Separate up-volume from down-volume to measure buying vs. selling conviction</li>
  </ul>
</div>`
},

{
  id:"3.5", module:3, tier:"basic", duration:55,
  title:"Building the Full Feature Matrix",
  audio:"/audio/course-3-5.mp3", video:null,
  content:`
<h2>Building the Full Feature Matrix</h2>
<p class="lesson-intro">Feature engineering is where domain knowledge meets machine learning. This lesson combines all previous indicators into a structured feature matrix ready for any scikit-learn or XGBoost model.</p>

<h3>The Master Feature Engineering Function</h3>
<pre><code class="language-python">import pandas as pd
import numpy as np

def build_features(df: pd.DataFrame) -&gt; pd.DataFrame:
    df = df.copy()

    # Price ratios (normalized, stationary)
    for p in [5, 10, 20, 50, 200]:
        sma = df['close'].rolling(p).mean()
        df[f'sma{p}_ratio'] = df['close'] / sma - 1

    df['above_sma200'] = (df['close'] &gt; df['close'].rolling(200).mean()).astype(int)

    # Multi-period momentum
    for p in [1, 3, 5, 10, 20]:
        df[f'mom_{p}d'] = df['close'].pct_change(p)

    # Candlestick features
    df['body_pct']   = (df['close'] - df['open']).abs() / df['close']
    df['upper_wick'] = (df['high'] - df[['open','close']].max(axis=1)) / df['close']
    df['lower_wick'] = (df[['open','close']].min(axis=1) - df['low']) / df['close']
    df['is_bullish'] = (df['close'] &gt; df['open']).astype(int)

    # Volatility
    df['hv_10']    = df['returns'].rolling(10).std() * np.sqrt(252)
    df['hv_20']    = df['returns'].rolling(20).std() * np.sqrt(252)
    df['hv_ratio'] = df['hv_10'] / (df['hv_20'] + 1e-9)
    df['atr_pct']  = calculate_atr(df) / df['close']

    sma20  = df['close'].rolling(20).mean()
    std20  = df['close'].rolling(20).std()
    df['bb_width'] = 4 * std20 / sma20
    df['bb_pctb']  = (df['close'] - (sma20 - 2*std20)) / (4*std20 + 1e-9)

    # Momentum oscillators
    df['rsi_14']   = calculate_rsi(df['close'])
    df['rsi_norm'] = df['rsi_14'] / 100
    macd_line, sig_line, hist = calculate_macd(df['close'])
    df['macd_norm'] = macd_line / df['close']
    df['macd_hist'] = hist / df['close']

    # Volume
    df['rel_vol']   = df['volume'] / df['volume'].rolling(20).mean()
    df['vol_trend'] = df['volume'].rolling(5).mean() / df['volume'].rolling(20).mean() - 1

    # Calendar
    df['day_of_week'] = df.index.dayofweek
    df['month']       = df.index.month
    df['is_monday']   = (df.index.dayofweek == 0).astype(int)
    df['is_friday']   = (df.index.dayofweek == 4).astype(int)

    # Target — next-day direction
    df['target'] = (df['close'].shift(-1) &gt; df['close']).astype(int)

    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)
    return df</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Always normalize raw indicators by price — makes features comparable across assets and time</li>
    <li>Use ratios (close/SMA − 1) not levels — removes non-stationarity</li>
    <li>The target goes in last using <code>shift(-1)</code> — this is where lookahead bias enters if mishandled</li>
    <li>Use Random Forest feature importances to identify which indicators actually predict your specific asset</li>
  </ul>
</div>`
},

{
  id:"3.6", module:3, tier:"basic", duration:35,
  title:"Normalization, Scaling, and Stationarity",
  audio:"/audio/course-3-6.mp3", video:null,
  content:`
<h2>Normalization, Scaling, and Stationarity</h2>
<p class="lesson-intro">ML models don't understand "price in dollars." They understand numbers in a consistent range. Proper scaling prevents dominant features from drowning out subtle but important signals.</p>

<h3>Why Raw Prices Break ML Models</h3>
<p>If you train a model on 2020 data (SPY ~300) and run it in 2024 (SPY ~470), the model has never seen prices at these levels. This is <strong>non-stationarity</strong>. The solution: use returns and ratios instead of levels. A 2% return looks similar in 2020 and 2024.</p>

<h3>Scikit-Learn Scalers</h3>
<pre><code class="language-python">from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler

# StandardScaler: zero mean, unit variance — good for linear models, neural nets
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)  # Use train scaler on test — never fit on test!

# RobustScaler: uses median and IQR — resistant to outliers (best for financial data)
robust = RobustScaler()
X_train_s = robust.fit_transform(X_train)</code></pre>
<div class="lesson-warn">⚠️ Always fit the scaler on training data only, then transform test data. Fitting on all data leaks test statistics into training — a form of lookahead bias.</div>

<h3>Stationarity Check</h3>
<pre><code class="language-python">from statsmodels.tsa.stattools import adfuller

def is_stationary(series, name=''):
    result = adfuller(series.dropna(), autolag='AIC')
    pvalue = result[1]
    status = 'Stationary' if pvalue &lt; 0.05 else 'NON-STATIONARY'
    print(f'{name}: p={pvalue:.4f} {status}')
    return pvalue &lt; 0.05

is_stationary(df['close'],           'Raw close')      # Fails — non-stationary
is_stationary(df['returns'],         'Returns')         # Passes
is_stationary(df['sma20_ratio'],     'Price/SMA20')    # Passes</code></pre>

<h3>Winsorizing Outliers</h3>
<pre><code class="language-python">def winsorize(series, lower=0.01, upper=0.99):
    lo, hi = series.quantile(lower), series.quantile(upper)
    return series.clip(lo, hi)

feature_cols = [c for c in df.columns if c.startswith(('mom_','rsi','macd','vol'))]
for col in feature_cols:
    df[col] = winsorize(df[col])</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Never feed raw prices or volumes to ML models — use returns, ratios, and normalized indicators</li>
    <li>Fit scalers on training data ONLY — never on the full dataset</li>
    <li>RobustScaler is the safest choice for financial features — handles outliers well</li>
    <li>Test stationarity with the ADF test — non-stationary features degrade out-of-sample performance</li>
  </ul>
</div>`
},

{
  id:"3.7", module:3, tier:"basic", duration:40,
  title:"Target Engineering — What Are You Predicting?",
  audio:"/audio/course-3-7.mp3", video:null,
  content:`
<h2>Target Engineering — What Are You Predicting?</h2>
<p class="lesson-intro">The target variable defines your model's job. The choice of <em>what</em> to predict has a larger impact on trading performance than any model architecture or hyperparameter choice.</p>

<h3>Target Types Comparison</h3>
<table class="lesson-table">
  <tr><th>Target</th><th>Type</th><th>Pros</th><th>Cons</th></tr>
  <tr><td>Next-day direction (up/down)</td><td>Binary classification</td><td>Simple, interpretable</td><td>Ignores magnitude</td></tr>
  <tr><td>Next-day return</td><td>Regression</td><td>Captures size of move</td><td>Noisy, hard to calibrate</td></tr>
  <tr><td>Hit target in N days</td><td>Binary classification</td><td>Actionable for options</td><td>More complex labeling</td></tr>
  <tr><td>Market regime</td><td>Multi-class</td><td>Strategy selection</td><td>Subjective definition</td></tr>
</table>

<h3>Binary Classification (Start Here)</h3>
<pre><code class="language-python"># Simple: up vs. down next day
df['target'] = (df['close'].shift(-1) &gt; df['close']).astype(int)

# Better: add a minimum threshold (0.3% avoids noise below transaction costs)
next_ret = df['close'].pct_change().shift(-1)
threshold = 0.003
df['target_thresh'] = np.where(next_ret &gt; threshold,  1,
                      np.where(next_ret &lt; -threshold, -1, 0))  # 3-class: up/flat/down

# Multi-day (better for swing models)
df['target_5d'] = (df['close'].shift(-5) &gt; df['close']).astype(int)</code></pre>

<h3>Triple-Barrier Method (Advanced)</h3>
<p>Labels each bar based on which barrier is hit first: profit target, stop loss, or time limit. Creates the most trading-realistic labels.</p>
<pre><code class="language-python">def triple_barrier(df, tp_mult=2.0, sl_mult=1.0, max_days=10):
    atr    = calculate_atr(df)
    labels = pd.Series(0, index=df.index)
    for i in range(len(df) - max_days):
        entry = df['close'].iloc[i]
        tp    = entry + tp_mult * atr.iloc[i]
        sl    = entry - sl_mult * atr.iloc[i]
        window = df['close'].iloc[i+1 : i+max_days+1]
        tp_hit = window &gt;= tp
        sl_hit = window &lt;= sl
        if tp_hit.any() and (not sl_hit.any() or
                              tp_hit.idxmax() &lt; sl_hit.idxmax()):
            labels.iloc[i] = 1
        elif sl_hit.any():
            labels.iloc[i] = -1
    return labels</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Start with binary next-day direction — simple, interpretable, and sets your baseline</li>
    <li>Add a minimum threshold (0.3-0.5%) to avoid training on unactionable noise</li>
    <li>Triple-barrier labeling creates the most realistic trading labels — use it once past the basics</li>
    <li>Always use <code>shift(-N)</code> for targets and never let these values leak into features</li>
  </ul>
</div>`
},

{
  id:"3.8", module:3, tier:"basic", duration:35,
  title:"Avoiding Lookahead Bias",
  audio:"/audio/course-3-8.mp3", video:null,
  content:`
<h2>Avoiding Lookahead Bias</h2>
<p class="lesson-intro">Lookahead bias is the #1 cause of backtests that look great but fail in live trading. It occurs when your model uses information that wouldn't have been available at the time of the trade.</p>

<h3>Where Lookahead Bias Hides</h3>
<ol>
  <li><strong>Target leaking into features</strong> — accidentally using tomorrow's price in today's feature</li>
  <li><strong>Scaling on the full dataset</strong> — the scaler "knows" the test set's statistics</li>
  <li><strong>Centered moving averages</strong> — using future values symmetrically around today</li>
  <li><strong>Random train/test split</strong> — future samples in the training set</li>
  <li><strong>Rolling stats without expanding</strong> — using all-time std where only past should be used</li>
</ol>

<h3>The Most Common Bug</h3>
<pre><code class="language-python"># WRONG -- subtle lookahead bias
df['norm_return'] = df['returns'] / df['returns'].std()  # std() uses ALL data!

# CORRECT -- use only past data
df['norm_return'] = df['returns'] / df['returns'].expanding().std()</code></pre>

<h3>Time-Correct Train/Test Split</h3>
<pre><code class="language-python"># WRONG -- random split destroys temporal order
from sklearn.model_selection import train_test_split
X_train, X_test = train_test_split(X, test_size=0.2)  # Mixes future into training!

# CORRECT -- chronological split
split = '2023-01-01'
train = df[df.index &lt; split]
test  = df[df.index &gt;= split]

X_train, y_train = train[feature_cols], train['target']
X_test,  y_test  = test[feature_cols],  test['target']</code></pre>

<h3>Walk-Forward Validation (Gold Standard)</h3>
<pre><code class="language-python">from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import RobustScaler

tscv = TimeSeriesSplit(n_splits=5)
for fold, (tr_idx, te_idx) in enumerate(tscv.split(X)):
    X_tr, X_te = X.iloc[tr_idx], X.iloc[te_idx]
    y_tr, y_te = y.iloc[tr_idx], y.iloc[te_idx]

    # Fit scaler on this fold's training data only
    scaler = RobustScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    model.fit(X_tr_s, y_tr)
    score = model.score(X_te_s, y_te)
    print(f'Fold {fold+1}: accuracy = {score:.3f}')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>A backtest that looks too good is a red flag — verify there's no lookahead bias first</li>
    <li>Never use random splits on time series data — always split chronologically</li>
    <li>Fit all scalers, encoders, and stats on training data only — then transform test</li>
    <li>Walk-forward validation (TimeSeriesSplit) is the gold standard for financial ML</li>
  </ul>
</div>`
},

// ═══════════════════════════════════════════════════════════════════
// MODULE 4 — ML Fundamentals
// ═══════════════════════════════════════════════════════════════════
{
  id:"4.1", module:4, tier:"basic", duration:35,
  title:"Machine Learning Overview",
  audio:"/audio/course-4-1.mp3", video:null,
  content:`
<h2>Machine Learning Overview</h2>
<p class="lesson-intro">ML has become a buzzword. This lesson cuts through the hype and gives you a precise, practical understanding of what ML can and cannot do for trading.</p>

<h3>What ML Actually Is</h3>
<p>Machine learning is a family of algorithms that find patterns in data without being explicitly programmed with rules. Instead of writing <code>if RSI &lt; 30 and price &gt; SMA200 then buy</code>, you show the algorithm thousands of historical examples and let it discover which combinations of conditions predict the outcome you care about.</p>

<h3>The ML Workflow</h3>
<pre><code>1. Define problem         -- What are you predicting? (direction, magnitude, regime)
2. Gather and clean data  -- OHLCV, fundamentals, options, sentiment
3. Engineer features      -- Indicators, ratios, calendar features
4. Split data             -- Train / validation / test (time-ordered!)
5. Train model            -- Fit parameters on training data
6. Evaluate               -- Accuracy, Sharpe, IC on test set
7. Iterate                -- Better features, different models
8. Deploy                 -- Paper trading, then real capital</code></pre>

<h3>Supervised vs. Unsupervised</h3>
<table class="lesson-table">
  <tr><th>Type</th><th>What it does</th><th>Trading applications</th></tr>
  <tr><td><strong>Supervised</strong></td><td>Learn from labeled examples (X -&gt; y)</td><td>Predict direction, return, regime</td></tr>
  <tr><td><strong>Unsupervised</strong></td><td>Find structure without labels</td><td>Cluster market regimes, find similar assets</td></tr>
  <tr><td><strong>Reinforcement</strong></td><td>Agent learns by reward/punishment</td><td>Portfolio optimization, execution</td></tr>
</table>
<p>This course focuses on <strong>supervised learning</strong> — the most practical and profitable approach for retail algorithmic traders.</p>

<h3>What ML Cannot Do</h3>
<ul>
  <li>Predict the future with certainty — markets have genuine randomness</li>
  <li>Find signal in pure noise — if there's no pattern, ML will overfit</li>
  <li>Replace risk management — a great signal with bad position sizing still loses</li>
  <li>Work without clean, relevant data — garbage in, garbage out, always</li>
</ul>
<p>Realistic expectation: a model with 53-58% directional accuracy (vs. 50% random) is genuinely valuable. A 55% accuracy on SPY direction with proper risk management translates to consistent profits.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>ML finds patterns in historical data — it extrapolates past relationships, not predicts the future</li>
    <li>Supervised learning is the practical starting point for trading signal generation</li>
    <li>Classification (direction) is more reliable than regression (magnitude) for daily trading signals</li>
    <li>A 53-58% directional accuracy is a real, profitable edge — don't chase unrealistic performance</li>
  </ul>
</div>`
},

{
  id:"4.2", module:4, tier:"basic", duration:50,
  title:"Linear and Logistic Regression",
  audio:"/audio/course-4-2.mp3", video:null,
  content:`
<h2>Linear and Logistic Regression</h2>
<p class="lesson-intro">Regression models are the simplest ML tools — and often surprisingly competitive against complex models. They're always your first baseline before trying XGBoost or neural nets.</p>

<h3>Ridge Regression — Predicting Returns</h3>
<pre><code class="language-python">from sklearn.linear_model import Ridge, Lasso
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import mean_squared_error
import numpy as np

# Setup (using pipeline from Module 2 and features from Module 3)
feature_cols = [c for c in df.columns if c not in
                ['open','high','low','close','volume','returns','log_returns','target']]

split = int(len(df) * 0.8)
train, test = df.iloc[:split], df.iloc[split:]

X_train, y_train = train[feature_cols], train['returns'].shift(-1).dropna()
X_train = X_train.iloc[:len(y_train)]
X_test,  y_test  = test[feature_cols],  test['returns'].shift(-1).dropna()
X_test  = X_test.iloc[:len(y_test)]

scaler = RobustScaler()
X_tr_s = scaler.fit_transform(X_train)
X_te_s = scaler.transform(X_test)

ridge = Ridge(alpha=1.0)
ridge.fit(X_tr_s, y_train)
preds = ridge.predict(X_te_s)

ic = np.corrcoef(preds, y_test)[0, 1]  # Information Coefficient
print(f'IC: {ic:.4f}')  # IC &gt; 0.05 = useful signal</code></pre>

<h3>Logistic Regression — Direction Classification</h3>
<pre><code class="language-python">from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report

y_train_dir = (y_train &gt; 0).astype(int)
y_test_dir  = (y_test  &gt; 0).astype(int)

lr = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
lr.fit(X_tr_s, y_train_dir)

preds_dir = lr.predict(X_te_s)
probs     = lr.predict_proba(X_te_s)[:, 1]  # Probability of up move

print(f'Accuracy: {accuracy_score(y_test_dir, preds_dir):.3f}')
print(classification_report(y_test_dir, preds_dir,
                             target_names=['Down', 'Up']))</code></pre>

<h3>Interpreting Coefficients</h3>
<pre><code class="language-python">import pandas as pd
coefs = pd.Series(lr.coef_[0], index=feature_cols)
print('Top bullish features:')
print(coefs.nlargest(10))
print('Top bearish features:')
print(coefs.nsmallest(10))</code></pre>

<h3>Regularization — L1 vs. L2</h3>
<ul>
  <li><strong>Ridge (L2)</strong> — shrinks all coefficients. Good when many features are mildly useful.</li>
  <li><strong>Lasso (L1)</strong> — sets unimportant features to exactly zero. Automatic feature selection.</li>
  <li><strong>ElasticNet</strong> — combines L1 and L2. Best for noisy financial data.</li>
</ul>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Ridge regression is your first baseline — always build it before trying XGBoost</li>
    <li>Information Coefficient (IC) measures signal quality — IC &gt; 0.05 is useful</li>
    <li>Logistic regression gives probability scores (0-1) — use these for position sizing</li>
    <li>Always use regularization in financial ML — overfitting to noise is the default without it</li>
  </ul>
</div>`
},

{
  id:"4.3", module:4, tier:"basic", duration:55,
  title:"Decision Trees and Random Forests",
  audio:"/audio/course-4-3.mp3", video:null,
  content:`
<h2>Decision Trees and Random Forests</h2>
<p class="lesson-intro">Decision trees learn non-linear rules — capturing interactions between features that linear models miss. Random Forests — ensembles of hundreds of trees — are the most robust general-purpose ML model for tabular financial data.</p>

<h3>How Decision Trees Work</h3>
<pre><code>Is RSI_14 &gt; 50?
+-- YES: Is price_sma20_ratio &gt; 0.02?
|   +-- YES: Predict UP (65% confidence)
|   +-- NO:  Predict DOWN (52% confidence)
+-- NO:  Is bb_pctb &lt; 0.20?
    +-- YES: Predict DOWN (70% confidence)
    +-- NO:  Predict UP (54% confidence)</code></pre>
<pre><code class="language-python">from sklearn.tree import DecisionTreeClassifier, plot_tree
import matplotlib.pyplot as plt

tree = DecisionTreeClassifier(max_depth=4, min_samples_leaf=50, random_state=42)
tree.fit(X_tr_s, y_train_dir)

plt.figure(figsize=(20, 10))
plot_tree(tree, feature_names=feature_cols, class_names=['Down','Up'],
          filled=True, rounded=True, fontsize=8)
plt.savefig('decision_tree.png', dpi=100, bbox_inches='tight')</code></pre>

<h3>Random Forest</h3>
<pre><code class="language-python">from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score

rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=8,
    min_samples_leaf=30,
    max_features='sqrt',
    oob_score=True,      # Free out-of-bag validation
    n_jobs=-1,
    random_state=42
)
rf.fit(X_tr_s, y_train_dir)

probs = rf.predict_proba(X_te_s)[:, 1]
print(f'AUC:       {roc_auc_score(y_test_dir, probs):.3f}')
print(f'OOB Score: {rf.oob_score_:.3f}')  # Free unbiased estimate</code></pre>

<h3>Feature Importance</h3>
<pre><code class="language-python">importances = pd.Series(rf.feature_importances_, index=feature_cols)
top20 = importances.nlargest(20)

top20.sort_values().plot(kind='barh', figsize=(10, 8), color='#38bdf8')
plt.title('Random Forest — Top 20 Features')
plt.tight_layout()
plt.show()

# Typical top features for SPY daily direction:
# mom_20d, price_sma200, hv_ratio, rsi_14, rel_vol</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Decision trees capture non-linear feature interactions that linear models miss</li>
    <li>Key RF hyperparameters: n_estimators=200+, max_depth=5-10, min_samples_leaf=20-50</li>
    <li>Feature importances from RF tell you which indicators actually predict your specific asset</li>
    <li>OOB score is free reliable validation — if it matches test score, you're not overfitting</li>
  </ul>
</div>`
},

{
  id:"4.4", module:4, tier:"basic", duration:60,
  title:"XGBoost — The Trader's Model",
  audio:"/audio/course-4-4.mp3", video:null,
  content:`
<h2>XGBoost — The Trader's Model</h2>
<p class="lesson-intro">XGBoost wins more Kaggle competitions than any other algorithm. For tabular financial data, it's typically the best-performing model — handling missing data, mixed feature types, and non-linear relationships with minimal preprocessing.</p>

<h3>Boosting vs. Bagging</h3>
<pre><code>Random Forest (bagging):  Tree1 + Tree2 + Tree3 ... = average (independent trees)
XGBoost (boosting):       Tree1 -&gt; Tree2 corrects Tree1's errors -&gt; Tree3 corrects ...

Sequential error-correction makes XGBoost more accurate on most tabular datasets.</code></pre>

<h3>Training XGBoost</h3>
<pre><code class="language-python">import xgboost as xgb
from sklearn.metrics import accuracy_score, roc_auc_score

model = xgb.XGBClassifier(
    n_estimators=500,
    max_depth=4,           # Shallow trees prevent overfitting on financial data
    learning_rate=0.05,    # Small LR + more trees = better generalization
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=40,   # Critical: prevents memorizing individual days
    gamma=0.1,
    reg_alpha=0.1,
    reg_lambda=1.0,
    eval_metric='logloss',
    n_jobs=-1,
    random_state=42
)

model.fit(
    X_tr_s, y_train_dir,
    eval_set=[(X_te_s, y_test_dir)],
    early_stopping_rounds=50,  # Stop when validation plateaus
    verbose=100
)

probs = model.predict_proba(X_te_s)[:, 1]
print(f'Accuracy: {accuracy_score(y_test_dir, probs&gt;0.5):.3f}')
print(f'AUC:      {roc_auc_score(y_test_dir, probs):.3f}')</code></pre>

<h3>SHAP Values — Explaining Predictions</h3>
<pre><code class="language-python">import shap

explainer   = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_te_s)

# Global feature importance — which features drive the model most?
shap.summary_plot(shap_values, X_test[feature_cols])

# Explain a single prediction
shap.force_plot(explainer.expected_value,
                shap_values[0], X_test[feature_cols].iloc[0])</code></pre>

<h3>Key Hyperparameters</h3>
<table class="lesson-table">
  <tr><th>Parameter</th><th>Typical Range</th><th>Impact</th></tr>
  <tr><td>max_depth</td><td>3-5</td><td>Lower = less overfit, simpler patterns</td></tr>
  <tr><td>learning_rate</td><td>0.01-0.1</td><td>Lower = more trees, better generalization</td></tr>
  <tr><td>min_child_weight</td><td>20-100</td><td>Higher = more regularization (key for finance)</td></tr>
  <tr><td>subsample</td><td>0.6-0.9</td><td>Random row sampling per tree</td></tr>
</table>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>XGBoost is sequential boosting — each tree corrects prior errors, more accurate than RF on most tabular data</li>
    <li>Use early stopping with a validation set — automatically finds the right number of trees</li>
    <li>SHAP values explain individual predictions — essential for debugging and building trust in signals</li>
    <li><code>min_child_weight=30-50</code> for daily data — this single parameter prevents most XGBoost overfitting</li>
  </ul>
</div>`
},

{
  id:"4.5", module:4, tier:"basic", duration:45,
  title:"Walk-Forward Validation",
  audio:"/audio/course-4-5.mp3", video:null,
  content:`
<h2>Walk-Forward Validation</h2>
<p class="lesson-intro">How you validate your model determines whether your backtest reflects reality. The wrong validation approach creates the illusion of performance that evaporates in live trading.</p>

<h3>Simple Chronological Split</h3>
<pre><code class="language-python">def time_split(df, train_pct=0.70, val_pct=0.15):
    n = len(df)
    t1 = int(n * train_pct)
    t2 = int(n * (train_pct + val_pct))
    train = df.iloc[:t1]
    val   = df.iloc[t1:t2]
    test  = df.iloc[t2:]
    print(f'Train: {train.index[0].date()} to {train.index[-1].date()} ({len(train)} rows)')
    print(f'Val:   {val.index[0].date()} to {val.index[-1].date()} ({len(val)} rows)')
    print(f'Test:  {test.index[0].date()} to {test.index[-1].date()} ({len(test)} rows)')
    return train, val, test</code></pre>

<h3>Walk-Forward Validation</h3>
<p>Simulates live trading: train on a window, test on the next period, roll forward. The most realistic measure of real performance.</p>
<pre><code class="language-python">from sklearn.preprocessing import RobustScaler
from sklearn.metrics import accuracy_score
import pandas as pd

def walk_forward(df, feature_cols, model_fn,
                 train_window=252, test_window=63):
    results = []
    for start in range(0, len(df)-train_window-test_window, test_window):
        train = df.iloc[start : start+train_window]
        test  = df.iloc[start+train_window : start+train_window+test_window]

        scaler = RobustScaler()
        X_tr_s = scaler.fit_transform(train[feature_cols])
        X_te_s = scaler.transform(test[feature_cols])

        m = model_fn()
        m.fit(X_tr_s, train['target'])
        probs = m.predict_proba(X_te_s)[:, 1]

        fold_df = test[['close','returns','target']].copy()
        fold_df['prob_up'] = probs
        fold_df['signal']  = (probs &gt; 0.5).astype(int) * 2 - 1
        results.append(fold_df)

        acc = accuracy_score(test['target'], probs &gt; 0.5)
        print(f'{test.index[0].date()} to {test.index[-1].date()}: acc={acc:.3f}')

    return pd.concat(results)

from sklearn.ensemble import RandomForestClassifier
results = walk_forward(df, feature_cols,
                       lambda: RandomForestClassifier(n_estimators=100, max_depth=6))</code></pre>

<h3>Backtesting Walk-Forward Results</h3>
<pre><code class="language-python">results['strat_ret'] = results['signal'] * results['returns']
results['equity']    = (1 + results['strat_ret']).cumprod()
results['bh_equity'] = (1 + results['returns']).cumprod()

sharpe = results['strat_ret'].mean() / results['strat_ret'].std() * np.sqrt(252)
print(f'Walk-Forward Sharpe: {sharpe:.2f}')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Never use random splits on time series — always respect chronological order</li>
    <li>Walk-forward validation simulates exactly how the model will be used in production</li>
    <li>Re-fit the scaler and model at each fold — prevents data leakage across time windows</li>
    <li>Walk-forward Sharpe &gt; 0.8 suggests a real edge; &lt; 0.5 is marginal at best</li>
  </ul>
</div>`
},

{
  id:"4.6", module:4, tier:"basic", duration:40,
  title:"Model Evaluation Metrics for Trading",
  audio:"/audio/course-4-6.mp3", video:null,
  content:`
<h2>Model Evaluation Metrics for Trading</h2>
<p class="lesson-intro">Accuracy alone is misleading for trading models. A model that correctly predicts 80% of days may still lose money if it misses the big down days. This lesson covers the metrics that actually predict real-world trading performance.</p>

<h3>Classification Metrics</h3>
<pre><code class="language-python">from sklearn.metrics import (accuracy_score, precision_score,
                              recall_score, roc_auc_score,
                              confusion_matrix)

def evaluate_classifier(y_true, y_pred, probs, name=''):
    print(f'=== {name} ===')
    print(f'Accuracy:  {accuracy_score(y_true, y_pred):.3f}')
    print(f'Precision: {precision_score(y_true, y_pred):.3f}')  # Of predicted UPs, how many were correct?
    print(f'Recall:    {recall_score(y_true, y_pred):.3f}')     # Of actual UPs, how many did we catch?
    print(f'AUC-ROC:   {roc_auc_score(y_true, probs):.3f}')
    cm = confusion_matrix(y_true, y_pred)
    print(pd.DataFrame(cm, index=['Act Down','Act Up'],
                       columns=['Pred Down','Pred Up']))</code></pre>

<h3>Financial Performance Metrics</h3>
<pre><code class="language-python">def trading_metrics(returns, name=''):
    r   = returns.dropna()
    ann_ret = r.mean() * 252
    ann_vol = r.std() * np.sqrt(252)
    sharpe  = ann_ret / (ann_vol + 1e-9)

    equity    = (1 + r).cumprod()
    peak      = equity.cummax()
    max_dd    = ((equity - peak) / peak).min()

    wins  = r[r &gt; 0]
    loss  = r[r &lt;= 0]
    win_rate = len(wins) / len(r)
    pf   = wins.sum() / abs(loss.sum()) if loss.sum() else float('inf')

    print(f'{name}: Return={ann_ret:.1%}  Sharpe={sharpe:.2f}  '
          f'MaxDD={max_dd:.1%}  WinRate={win_rate:.1%}  PF={pf:.2f}')</code></pre>

<h3>Information Coefficient (IC)</h3>
<pre><code class="language-python">from scipy.stats import spearmanr

ic, pvalue = spearmanr(probs, y_test_returns)
print(f'IC: {ic:.4f}  (p={pvalue:.4f})')
# IC &gt; 0.03 = some signal
# IC &gt; 0.06 = useful
# IC &gt; 0.10 = good signal
# IC &gt; 0.15 = excellent (verify not overfit)</code></pre>

<h3>Beat the Base Rate</h3>
<p>US equities go up ~55% of trading days historically. A model that always predicts "up" achieves 55% accuracy with zero skill. Always compare your model's accuracy to the base rate for your specific asset and time period.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Sharpe ratio is more important than accuracy — Sharpe 1.5 with 54% accuracy beats Sharpe 0.3 with 65% accuracy</li>
    <li>Always compare to the base rate — beat the naive "always-up" benchmark first</li>
    <li>IC &gt; 0.05 with p &lt; 0.05 is a meaningful and actionable signal</li>
    <li>Max drawdown and Calmar ratio matter as much as returns — you have to be able to hold through drawdowns</li>
  </ul>
</div>`
},

{
  id:"4.7", module:4, tier:"basic", duration:45,
  title:"Hyperparameter Tuning",
  audio:"/audio/course-4-7.mp3", video:null,
  content:`
<h2>Hyperparameter Tuning</h2>
<p class="lesson-intro">Hyperparameters are settings you choose before training. Tuning them can meaningfully improve performance, but naive tuning creates overfitting to the validation set. This lesson shows you how to tune correctly.</p>

<h3>The Danger of Over-Tuning</h3>
<p>Every time you evaluate a model on the validation set and change a hyperparameter based on the result, you're effectively using the validation set as training data. After many iterations, your "best" model is optimized for the specific validation period — not for future data. <strong>Rule of thumb:</strong> tune 3-5 meaningful parameters, not everything.</p>

<h3>Grid Search with TimeSeriesSplit</h3>
<pre><code class="language-python">from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.ensemble import RandomForestClassifier

param_grid = {
    'max_depth':        [4, 6, 8],
    'min_samples_leaf': [20, 50, 100],
    'max_features':     ['sqrt', 0.5]
}

tscv = TimeSeriesSplit(n_splits=5)  # Always TimeSeriesSplit for financial data!
gs = GridSearchCV(
    RandomForestClassifier(n_estimators=200, n_jobs=-1),
    param_grid, cv=tscv, scoring='roc_auc', n_jobs=-1
)
gs.fit(X_train_s, y_train)

print(f'Best params: {gs.best_params_}')
print(f'Best CV AUC: {gs.best_score_:.3f}')</code></pre>

<h3>Optuna — Bayesian Optimization (5-10x Faster)</h3>
<pre><code class="language-python">import optuna
from sklearn.model_selection import cross_val_score, TimeSeriesSplit

def objective(trial):
    params = {
        'max_depth':        trial.suggest_int('max_depth', 3, 10),
        'min_samples_leaf': trial.suggest_int('min_samples_leaf', 10, 100),
        'max_features':     trial.suggest_float('max_features', 0.3, 1.0),
    }
    m = RandomForestClassifier(**params, n_estimators=200, n_jobs=-1)
    return cross_val_score(m, X_train_s, y_train,
                           cv=TimeSeriesSplit(5), scoring='roc_auc').mean()

study = optuna.create_study(direction='maximize')
study.optimize(objective, n_trials=100, timeout=300)
print(f'Best AUC: {study.best_value:.3f}')
print(f'Best params: {study.best_params}')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Always use TimeSeriesSplit for cross-validation of financial models</li>
    <li>Optuna's Bayesian optimization is 5-10x more efficient than GridSearch</li>
    <li>Focus on 3-5 parameters that matter most — don't tune everything</li>
    <li>If tuned model is dramatically better than defaults, verify on a held-out test set never seen during tuning</li>
  </ul>
</div>`
},

{
  id:"4.8", module:4, tier:"basic", duration:50,
  title:"Saving, Loading, and Retraining Models",
  audio:"/audio/course-4-8.mp3", video:null,
  content:`
<h2>Saving, Loading, and Retraining Models</h2>
<p class="lesson-intro">A trained model is only useful if you can save it, reload it for daily predictions, and retrain it on schedule as new data arrives. This lesson covers the model lifecycle management that separates prototype from production.</p>

<h3>Saving Models with Pickle</h3>
<pre><code class="language-python">import pickle, json
from pathlib import Path

MODELS_DIR = Path('models')
MODELS_DIR.mkdir(exist_ok=True)

def save_model(model, scaler, feature_cols, symbol='SPY', metrics=None):
    payload = {
        'model':    model,
        'scaler':   scaler,
        'features': feature_cols,
        'symbol':   symbol,
    }
    path = MODELS_DIR / f'{symbol}_model.pkl'
    with open(path, 'wb') as f:
        pickle.dump(payload, f)

    # Save metadata as JSON for quick inspection without loading model
    meta = {
        'symbol':   symbol,
        'features': feature_cols,
        'n_features': len(feature_cols),
        **(metrics or {})
    }
    with open(MODELS_DIR / f'{symbol}_meta.json', 'w') as f:
        json.dump(meta, f, indent=2)

    print(f'Model saved to {path}')</code></pre>

<h3>Loading and Predicting</h3>
<pre><code class="language-python">def load_model(symbol='SPY'):
    with open(f'models/{symbol}_model.pkl', 'rb') as f:
        return pickle.load(f)

def daily_signal(symbol='SPY'):
    payload      = load_model(symbol)
    model        = payload['model']
    scaler       = payload['scaler']
    feature_cols = payload['features']

    df      = build_features(load_pipeline(symbol, period='1y'))
    latest  = df[feature_cols].iloc[[-1]]
    scaled  = scaler.transform(latest)
    prob_up = model.predict_proba(scaled)[0, 1]

    direction  = 'LONG' if prob_up &gt; 0.55 else 'SHORT' if prob_up &lt; 0.45 else 'FLAT'
    confidence = abs(prob_up - 0.5) * 2  # 0 to 1

    return {
        'symbol':     symbol,
        'date':       df.index[-1].date(),
        'direction':  direction,
        'prob_up':    round(prob_up, 3),
        'confidence': round(confidence, 3)
    }

signal = daily_signal('SPY')
print(f"Signal: {signal['direction']} | P(Up)={signal['prob_up']:.1%} | Confidence={signal['confidence']:.1%}")</code></pre>

<h3>Model Retraining Schedule</h3>
<pre><code class="language-python">def should_retrain(symbol, max_days_old=30):
    meta_path = Path(f'models/{symbol}_meta.json')
    if not meta_path.exists():
        return True
    with open(meta_path) as f:
        meta = json.load(f)
    trained_date = pd.Timestamp(meta.get('trained_on', '2000-01-01'))
    days_old = (pd.Timestamp.now() - trained_date).days
    return days_old &gt;= max_days_old

# In your daily cron job:
if should_retrain('SPY', max_days_old=30):
    print('Retraining SPY model...')
    # run training pipeline</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Save the model, scaler, AND feature list together — all three are needed to make predictions</li>
    <li>Save metadata as JSON for quick inspection without deserializing the full model</li>
    <li>A FLAT signal when confidence is low (45-55%) is better than a forced trade</li>
    <li>Retrain monthly (or when performance degrades) — market regimes shift and models drift</li>
  </ul>
</div>`
},

{
  id:"4.9", module:4, tier:"basic", duration:55,
  title:"Backtesting Your ML Strategy",
  audio:"/audio/course-4-9.mp3", video:null,
  content:`
<h2>Backtesting Your ML Strategy</h2>
<p class="lesson-intro">A backtest simulates how your strategy would have performed historically. It's the critical step between model training and live deployment — and the step where most mistakes are made.</p>

<h3>Simple Signal-Based Backtest</h3>
<pre><code class="language-python">def backtest_signals(df, signal_col='signal', cost_bps=5):
    '''
    signal: 1=long, -1=short, 0=flat
    cost_bps: round-trip transaction cost in basis points
    '''
    bt = df.copy()
    bt['gross_return'] = bt[signal_col].shift(1) * bt['returns']  # Signal used next day
    bt['trade']        = bt[signal_col].diff().abs().fillna(0)     # 1 where position changes
    bt['cost']         = bt['trade'] * cost_bps / 10_000           # Cost per trade
    bt['net_return']   = bt['gross_return'] - bt['cost']

    bt['equity']       = (1 + bt['net_return']).cumprod()
    bt['bh_equity']    = (1 + bt['returns']).cumprod()

    # Drawdown
    peak    = bt['equity'].cummax()
    bt['drawdown'] = (bt['equity'] - peak) / peak
    return bt

results = backtest_signals(walk_forward_results, 'signal')</code></pre>

<h3>Computing Full Performance Report</h3>
<pre><code class="language-python">def performance_report(bt):
    r = bt['net_return'].dropna()
    ann_ret   = r.mean() * 252
    ann_vol   = r.std() * np.sqrt(252)
    sharpe    = ann_ret / (ann_vol + 1e-9)
    max_dd    = bt['drawdown'].min()
    calmar    = ann_ret / abs(max_dd) if max_dd != 0 else 0
    n_trades  = int(bt['trade'].sum())
    win_rate  = (r &gt; 0).mean()

    print(f'Annual Return:  {ann_ret:.1%}')
    print(f'Annual Vol:     {ann_vol:.1%}')
    print(f'Sharpe Ratio:   {sharpe:.2f}')
    print(f'Max Drawdown:   {max_dd:.1%}')
    print(f'Calmar Ratio:   {calmar:.2f}')
    print(f'Win Rate:       {win_rate:.1%}')
    print(f'Total Trades:   {n_trades}')

performance_report(results)</code></pre>

<h3>Visualizing the Equity Curve</h3>
<pre><code class="language-python">import matplotlib.pyplot as plt

fig, axes = plt.subplots(2, 1, figsize=(14, 8))
axes[0].plot(results.index, results['equity'],    color='#4ade80', label='ML Strategy')
axes[0].plot(results.index, results['bh_equity'], color='#94a3b8', label='Buy &amp; Hold')
axes[0].set_title('Strategy Performance')
axes[0].legend()
axes[0].set_facecolor('#0f172a')

axes[1].fill_between(results.index, results['drawdown'], 0,
                      color='#f87171', alpha=0.7)
axes[1].set_title('Drawdown')
axes[1].set_facecolor('#0f172a')

plt.tight_layout()
plt.savefig('backtest.png', dpi=150)
plt.show()</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Always shift(1) the signal before applying returns — you can't trade on today's close signal until tomorrow's open</li>
    <li>Include transaction costs (5-10 bps round-trip for liquid ETFs) — strategies that look good before costs often fail after</li>
    <li>The equity curve and drawdown chart together tell the full story — never show one without the other</li>
    <li>If backtest Sharpe &gt; 3.0, suspect overfitting — verify with walk-forward on unseen data</li>
  </ul>
</div>`
},

{
  id:"4.10", module:4, tier:"basic", duration:90,
  title:"Capstone — End-to-End ML Trading Signal",
  audio:"/audio/course-4-10.mp3", video:null,
  content:`
<h2>Capstone — End-to-End ML Trading Signal</h2>
<p class="lesson-intro">This is the capstone project for Module 4 — and the most important lesson in the Basic tier. You'll build a complete, production-ready ML trading signal for SPY: from raw data to daily live predictions.</p>

<h3>Architecture Overview</h3>
<pre><code>market_data.py   --  fetch, clean, cache OHLCV
features.py      --  40+ engineered features
train.py         --  XGBoost + walk-forward validation
evaluate.py      --  Sharpe, IC, accuracy, drawdown report
predict.py       --  daily signal generator
schedule.py      --  daily retraining and alerting</code></pre>

<h3>train.py — Complete Training Script</h3>
<pre><code class="language-python">import pickle, json, numpy as np, pandas as pd
import xgboost as xgb
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import accuracy_score, roc_auc_score
from market_data import load_pipeline
from features import build_features

SYMBOL = 'SPY'
FEATURE_COLS = None   # Will be set after feature engineering

def train(symbol=SYMBOL):
    # 1. Load and build features
    df = build_features(load_pipeline(symbol, period='5y'))

    global FEATURE_COLS
    FEATURE_COLS = [c for c in df.columns if c not in
                    ['open','high','low','close','volume',
                     'returns','log_returns','target']]

    # 2. Chronological 80/20 split
    split_idx  = int(len(df) * 0.8)
    split_date = df.index[split_idx]
    train, test = df.iloc[:split_idx], df.iloc[split_idx:]

    X_tr, y_tr = train[FEATURE_COLS], train['target']
    X_te, y_te = test[FEATURE_COLS],  test['target']

    # 3. Scale
    scaler = RobustScaler()
    X_tr_s = scaler.fit_transform(X_tr)
    X_te_s = scaler.transform(X_te)

    # 4. Train XGBoost
    model = xgb.XGBClassifier(
        n_estimators=500, max_depth=4, learning_rate=0.05,
        min_child_weight=40, subsample=0.8, colsample_bytree=0.8,
        eval_metric='logloss', n_jobs=-1, random_state=42
    )
    model.fit(X_tr_s, y_tr, eval_set=[(X_te_s, y_te)],
              early_stopping_rounds=50, verbose=False)

    # 5. Evaluate
    probs   = model.predict_proba(X_te_s)[:, 1]
    acc     = accuracy_score(y_te, probs &gt; 0.5)
    auc     = roc_auc_score(y_te, probs)
    signal  = (probs &gt; 0.5).astype(int) * 2 - 1
    strat_r = signal * test['returns'].values
    sharpe  = strat_r.mean() / strat_r.std() * np.sqrt(252)

    print(f'{symbol} Training Complete')
    print(f'  Test Accuracy:   {acc:.3f}')
    print(f'  Test AUC:        {auc:.3f}')
    print(f'  Backtest Sharpe: {sharpe:.2f}')

    # 6. Save
    with open(f'models/{symbol}_model.pkl', 'wb') as f:
        pickle.dump({'model': model, 'scaler': scaler,
                     'features': FEATURE_COLS}, f)
    with open(f'models/{symbol}_meta.json', 'w') as f:
        json.dump({'accuracy': acc, 'auc': auc, 'sharpe': sharpe,
                   'n_features': len(FEATURE_COLS),
                   'trained_on': str(pd.Timestamp.now().date()),
                   'split_date': str(split_date.date())}, f, indent=2)
    return model, scaler

if __name__ == '__main__':
    train()</code></pre>

<h3>predict.py — Daily Signal</h3>
<pre><code class="language-python">import pickle
from market_data import load_pipeline
from features import build_features

def get_signal(symbol='SPY'):
    with open(f'models/{symbol}_model.pkl', 'rb') as f:
        p = pickle.load(f)
    model, scaler, features = p['model'], p['scaler'], p['features']

    df      = build_features(load_pipeline(symbol, period='1y'))
    X       = scaler.transform(df[features].iloc[[-1]])
    prob_up = model.predict_proba(X)[0, 1]

    return {
        'symbol':    symbol,
        'date':      str(df.index[-1].date()),
        'direction': 'LONG' if prob_up &gt; 0.55 else 'SHORT' if prob_up &lt; 0.45 else 'FLAT',
        'prob_up':   round(prob_up, 3),
        'confidence':round(abs(prob_up - 0.5) * 2, 3)
    }

if __name__ == '__main__':
    sig = get_signal()
    print(f"Signal for {sig['date']}: {sig['direction']} | P(Up)={sig['prob_up']:.1%}")</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>The complete pipeline: fetch -&gt; clean -&gt; features -&gt; train -&gt; evaluate -&gt; save -&gt; predict daily</li>
    <li>Save model + scaler + feature list together — all three are required for inference</li>
    <li>Only trade LONG/SHORT when confidence &gt; 55% — FLAT when uncertain is better than forced trades</li>
    <li>Paper trade for 3+ months before committing real capital — live performance must confirm backtest quality</li>
  </ul>
</div>`
}
,
{
  id:"5.1", module:5, tier:"pro", duration:50,
  title:"Introduction to Neural Networks for Trading",
  audio:"/audio/course-5-1.mp3", video:null,
  content:`<h2>Introduction to Neural Networks for Trading</h2>
<p class="lesson-intro">Neural networks are the engine behind modern AI. For trading, they excel at learning non-linear patterns across many features simultaneously, and at sequence modeling for time series price data.</p>

<h3>How Neural Networks Learn</h3>
<p>A neural network is a stack of layers. Each layer applies a linear transformation followed by a non-linear activation. During training, backpropagation computes gradients and gradient descent adjusts weights to minimize loss.</p>
<pre><code class="language-python">import torch
import torch.nn as nn

class TradingMLP(nn.Module):
    def __init__(self, n_features, hidden=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_features, hidden),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden // 2, 1),
            nn.Sigmoid()
        )
    def forward(self, x):
        return self.net(x)

model = TradingMLP(n_features=40)
print(model)</code></pre>

<h3>Why Neural Nets for Trading?</h3>
<p>Classical ML models like XGBoost treat each day independently. Neural networks can learn feature interactions automatically and, with sequence architectures like LSTM, can model temporal dependencies that classical models miss.</p>

<h3>When to Use Neural Networks</h3>
<p>Neural networks require more data and tuning than classical models. Use them when you have 5+ years of daily data or intraday data, when incorporating raw price sequences, or combining text sentiment with price features. For small datasets, XGBoost typically outperforms neural networks.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Neural networks learn non-linear feature interactions automatically through backpropagation</li>
    <li>PyTorch is the standard for research-grade trading models — flexible, debuggable, fast</li>
    <li>Start with a simple MLP on your existing features before moving to LSTM or Transformers</li>
    <li>Neural networks need more data than classical ML — minimum 3-5 years of daily data</li>
  </ul>
</div>`
}
,{
  id:"5.2", module:5, tier:"pro", duration:60,
  title:"LSTM Networks for Time Series",
  audio:"/audio/course-5-2.mp3", video:null,
  content:`<h2>LSTM Networks for Time Series</h2>
<p class="lesson-intro">Long Short-Term Memory networks are designed for sequential data. Unlike standard neural networks that process each day independently, LSTMs maintain a hidden state that carries information across time steps — ideal for modeling price momentum, trend, and regime.</p>

<h3>The LSTM Architecture</h3>
<p>An LSTM cell has three gates: forget (what to discard from memory), input (what new information to store), and output (what to pass forward). This gating mechanism lets the network learn which historical patterns matter and how far back to look.</p>
<pre><code class="language-python">import torch.nn as nn

class LSTMTrader(nn.Module):
    def __init__(self, n_features, hidden=64, n_layers=2, dropout=0.3):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=n_features, hidden_size=hidden,
            num_layers=n_layers, dropout=dropout, batch_first=True
        )
        self.head = nn.Sequential(
            nn.Linear(hidden, 32), nn.ReLU(),
            nn.Linear(32, 1), nn.Sigmoid()
        )
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :])  # last timestep</code></pre>

<h3>Preparing Sequence Data</h3>
<pre><code class="language-python">def make_sequences(df, feature_cols, seq_len=20):
    X, y = [], []
    arr = df[feature_cols].values
    tgt = df['target'].values
    for i in range(seq_len, len(arr)):
        X.append(arr[i-seq_len:i])
        y.append(tgt[i])
    return np.array(X), np.array(y)

X, y = make_sequences(df, feature_cols, seq_len=20)
# X shape: (n_samples, 20, n_features)</code></pre>

<h3>Training the LSTM</h3>
<pre><code class="language-python">from torch.utils.data import TensorDataset, DataLoader

loader = DataLoader(
    TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train).unsqueeze(1)),
    batch_size=32, shuffle=False  # Never shuffle time series!
)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
criterion = nn.BCELoss()

for epoch in range(50):
    model.train()
    for xb, yb in loader:
        pred = model(xb)
        loss = criterion(pred, yb)
        optimizer.zero_grad(); loss.backward(); optimizer.step()
    if epoch % 10 == 0:
        print(f'Epoch {epoch}: loss={loss.item():.4f}')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>LSTMs process sequences of past days, letting the model learn temporal patterns</li>
    <li>Sequence length 10-30 days works well for daily price prediction</li>
    <li>Use the last hidden state (out[:, -1, :]) for classification tasks</li>
    <li>Always shuffle=False in your DataLoader — respect chronological order</li>
  </ul>
</div>`
}
,{
  id:"5.3", module:5, tier:"pro", duration:55,
  title:"CNNs for Chart Pattern Recognition",
  audio:"/audio/course-5-3.mp3", video:null,
  content:`<h2>CNNs for Chart Pattern Recognition</h2>
<p class="lesson-intro">Convolutional Neural Networks excel at detecting local patterns in sequential data. Applied to price sequences, 1D CNNs can automatically learn chart patterns — head and shoulders, double tops, flag formations — without you hand-coding them.</p>

<h3>1D Convolution on Price Data</h3>
<p>A 1D convolutional layer slides a learned filter across the time dimension, detecting patterns at each position. Multiple filters learn different patterns simultaneously. Stacked conv layers detect increasingly complex patterns.</p>
<pre><code class="language-python">class CNNTrader(nn.Module):
    def __init__(self, n_features):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(n_features, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv1d(64, 128, kernel_size=5, padding=2),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1)
        )
        self.head = nn.Sequential(
            nn.Linear(128, 64), nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 1), nn.Sigmoid()
        )
    def forward(self, x):
        x = x.permute(0, 2, 1)   # (batch, features, seq_len)
        return self.head(self.conv(x).squeeze(-1))</code></pre>

<h3>CNN + LSTM Hybrid</h3>
<p>Combining CNN (local pattern detection) with LSTM (long-range dependencies) often outperforms either alone. The CNN extracts local features, the LSTM models how those features evolve over time.</p>
<pre><code class="language-python">class CNNLSTMTrader(nn.Module):
    def __init__(self, n_features, hidden=64):
        super().__init__()
        self.cnn  = nn.Sequential(
            nn.Conv1d(n_features, 64, kernel_size=3, padding=1), nn.ReLU())
        self.lstm = nn.LSTM(64, hidden, batch_first=True)
        self.head = nn.Linear(hidden, 1)
    def forward(self, x):
        x = self.cnn(x.permute(0,2,1)).permute(0,2,1)
        _, (h, _) = self.lstm(x)
        return torch.sigmoid(self.head(h[-1]))</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>1D CNNs detect local temporal patterns — momentum bursts, consolidations, breakouts</li>
    <li>Kernel sizes 3-7 work well for daily data; larger kernels detect longer patterns</li>
    <li>CNN+LSTM hybrids combine local pattern detection with long-range memory</li>
    <li>AdaptiveAvgPool1d makes the model input-length agnostic</li>
  </ul>
</div>`
}
,{
  id:"5.4", module:5, tier:"pro", duration:60,
  title:"Attention & Transformer Models",
  audio:"/audio/course-5-4.mp3", video:null,
  content:`<h2>Attention &amp; Transformer Models</h2>
<p class="lesson-intro">The Transformer architecture has revolutionized sequence modeling. For trading, attention mechanisms let the model selectively focus on the most relevant past time steps, rather than compressing all history into a single hidden state like LSTM.</p>

<h3>Self-Attention for Time Series</h3>
<p>Attention computes, for each position in the sequence, how much to attend to every other position. Unlike LSTM, it processes all time steps in parallel and has no vanishing gradient problem over long sequences.</p>
<pre><code class="language-python">class TradingTransformer(nn.Module):
    def __init__(self, n_features, d_model=64, nhead=4, n_layers=2, seq_len=30):
        super().__init__()
        self.input_proj = nn.Linear(n_features, d_model)
        self.pos_enc    = nn.Embedding(seq_len, d_model)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead,
            dim_feedforward=d_model*4, dropout=0.1, batch_first=True)
        self.transformer = nn.TransformerEncoder(enc_layer, num_layers=n_layers)
        self.head = nn.Sequential(
            nn.Linear(d_model, 32), nn.ReLU(),
            nn.Linear(32, 1), nn.Sigmoid())

    def forward(self, x):
        pos = torch.arange(x.size(1), device=x.device).unsqueeze(0)
        x   = self.input_proj(x) + self.pos_enc(pos)
        x   = self.transformer(x)
        return self.head(x[:, -1, :])</code></pre>

<h3>Why Transformers Beat LSTMs on Long Sequences</h3>
<p>LSTMs must pass information through many sequential steps to relate distant events. Transformers attend to all positions simultaneously — a price spike from 90 days ago can directly influence today's prediction without degradation. This makes Transformers especially powerful for weekly or monthly pattern detection.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Transformers use attention to selectively weight past time steps — no vanishing gradient</li>
    <li>Positional encoding tells the model the order of time steps</li>
    <li>Multi-head attention (nhead=4-8) lets the model attend to multiple pattern types simultaneously</li>
    <li>Transformers need more data than LSTMs — best for intraday or multi-asset setups</li>
  </ul>
</div>`
}
,{
  id:"5.5", module:5, tier:"pro", duration:50,
  title:"Training Deep Models — Optimizers & Regularization",
  audio:"/audio/course-5-5.mp3", video:null,
  content:`<h2>Training Deep Models — Optimizers &amp; Regularization</h2>
<p class="lesson-intro">Training a neural network correctly requires careful choices around learning rate, batch size, regularization, and early stopping. The wrong settings can make a powerful architecture underperform a simple linear model.</p>

<h3>Optimizers and Learning Rate Scheduling</h3>
<pre><code class="language-python"># AdamW — best default for most trading models
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)

# Reduce LR when validation loss plateaus
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer, mode='min', factor=0.5, patience=5, verbose=True)

# In training loop after validation:
scheduler.step(val_loss)</code></pre>

<h3>Regularization Techniques</h3>
<pre><code class="language-python"># Dropout — zeros random neurons during training
nn.Dropout(0.3)

# Weight decay via optimizer (L2 regularization)
torch.optim.AdamW(model.parameters(), weight_decay=1e-4)

# Early stopping
best_val, patience, no_improve = float('inf'), 10, 0
for epoch in range(200):
    train_one_epoch(model, train_loader)
    val_loss = evaluate(model, val_loader)
    if val_loss &lt; best_val:
        best_val = val_loss
        torch.save(model.state_dict(), 'best.pt')
        no_improve = 0
    else:
        no_improve += 1
        if no_improve &gt;= patience: break
model.load_state_dict(torch.load('best.pt'))</code></pre>

<h3>Gradient Clipping</h3>
<p>Financial time series can produce large loss spikes that cause gradient explosions. Always clip gradients when training on price data.</p>
<pre><code class="language-python">optimizer.zero_grad()
loss.backward()
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
optimizer.step()</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>AdamW with weight_decay=0.01 is the best default optimizer for deep learning</li>
    <li>Always use early stopping — the final epoch is rarely the best model</li>
    <li>Gradient clipping (max_norm=1.0) prevents training instability on volatile data</li>
    <li>Save the best checkpoint and reload it after training completes</li>
  </ul>
</div>`
}
,{
  id:"5.6", module:5, tier:"pro", duration:55,
  title:"PyTorch Crash Course for Traders",
  audio:"/audio/course-5-6.mp3", video:null,
  content:`<h2>PyTorch Crash Course for Traders</h2>
<p class="lesson-intro">PyTorch is the standard framework for research-grade deep learning. Its dynamic computation graph makes debugging intuitive — you can inspect tensors at any point, just like regular Python. This lesson covers everything you need to build and train trading models.</p>

<h3>Tensors — The Core Data Structure</h3>
<pre><code class="language-python">import torch, numpy as np

x = torch.FloatTensor(np.array([1.0, 2.0, 3.0]))
x = torch.zeros(32, 20, 10)   # batch=32, seq=20, features=10

device = 'cuda' if torch.cuda.is_available() else 'cpu'
x     = x.to(device)
model = model.to(device)

# Tensor operations
print(x.shape, x.dtype, x.mean(), x.std())
x[:, -1, :]    # last time step for all batches</code></pre>

<h3>Full Training Loop Template</h3>
<pre><code class="language-python">def train_model(model, train_loader, val_loader, epochs=100):
    model = model.to(device)
    opt   = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-2)
    crit  = nn.BCELoss()
    best, patience, no_imp = float('inf'), 15, 0

    for epoch in range(epochs):
        model.train()
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            pred = model(xb); loss = crit(pred, yb)
            opt.zero_grad(); loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()

        model.eval()
        with torch.no_grad():
            vl = np.mean([crit(model(xb.to(device)), yb.to(device)).item()
                          for xb, yb in val_loader])
        if vl &lt; best: best=vl; torch.save(model.state_dict(),'best.pt'); no_imp=0
        else:
            no_imp += 1
            if no_imp &gt;= patience: break
        if epoch % 10 == 0: print(f'Epoch {epoch:3d} | val_loss={vl:.4f}')

    model.load_state_dict(torch.load('best.pt'))
    return model</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>PyTorch tensors are like NumPy arrays with GPU support and automatic differentiation</li>
    <li>Always: zero_grad → forward → loss → backward → clip_grad → step</li>
    <li>model.train() enables dropout; model.eval() disables it for inference</li>
    <li>torch.no_grad() during validation saves memory and speeds up evaluation</li>
  </ul>
</div>`
}
,{
  id:"5.7", module:5, tier:"pro", duration:45,
  title:"Feature Engineering for Deep Learning",
  audio:"/audio/course-5-7.mp3", video:null,
  content:`<h2>Feature Engineering for Deep Learning</h2>
<p class="lesson-intro">Deep learning models can learn feature interactions automatically — but they still benefit from good input engineering. Unlike tree models, neural networks are sensitive to scale and struggle with non-stationary inputs.</p>

<h3>Normalization Strategies</h3>
<pre><code class="language-python">def normalize_for_dl(df, feature_cols, seq_len=20):
    # Z-score each feature using expanding window (no future data)
    normed = {}
    for col in feature_cols:
        roll_mean = df[col].expanding(min_periods=seq_len).mean()
        roll_std  = df[col].expanding(min_periods=seq_len).std().replace(0, 1)
        normed[col] = (df[col] - roll_mean) / roll_std
    return pd.DataFrame(normed, index=df.index).dropna()

# Price-based features: use returns, not raw prices
df['ret_20']  = df['close'].pct_change(20)
df['vol_norm']= df['close'].rolling(20).std() / df['close'].rolling(252).std()</code></pre>

<h3>Multi-Asset Input for Correlation Modeling</h3>
<pre><code class="language-python"># Stack features from correlated assets as additional channels
# SPY model benefits from: QQQ, VIX, TLT, DXY correlation features
def build_multi_asset_features(dfs, feature_cols):
    # dfs: dict of symbol -> normalized DataFrame
    parts = [dfs[sym][feature_cols].values for sym in dfs]
    return np.concatenate(parts, axis=1)
    # Shape: (T, n_features * n_assets)</code></pre>

<h3>What Features Work Best</h3>
<p>For daily price data: returns at multiple lookbacks (1d, 5d, 20d, 60d), volatility ratios, RSI, MACD signal, and cross-asset correlations. Raw prices are not useful — always use normalized, stationary representations. VIX and TLT are particularly powerful for equity models.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Use expanding-window normalization — never fit scalers on the full dataset</li>
    <li>Returns and ratios are better than raw prices for neural network inputs</li>
    <li>Multi-asset features (VIX, TLT, DXY) add significant predictive power</li>
    <li>Drop NaN rows after feature engineering — neural networks cannot handle missing values</li>
  </ul>
</div>`
}
,{
  id:"5.8", module:5, tier:"pro", duration:90,
  title:"Project — Deep Learning Price Predictor",
  audio:"/audio/course-5-8.mp3", video:null,
  content:`<h2>Project — Deep Learning Price Predictor</h2>
<p class="lesson-intro">This capstone builds a complete deep learning trading signal for SPY using an LSTM model trained on 20-day price sequences. You will engineer features, prepare sequences, train with early stopping, and evaluate out-of-sample AUC.</p>

<h3>Complete Pipeline</h3>
<pre><code class="language-python">import torch, torch.nn as nn, numpy as np, yfinance as yf
from torch.utils.data import TensorDataset, DataLoader
from sklearn.metrics import roc_auc_score

df = yf.download('SPY', period='10y')
df['ret_1']  = df['Close'].pct_change(1)
df['ret_5']  = df['Close'].pct_change(5)
df['ret_20'] = df['Close'].pct_change(20)
df['hv_20']  = df['ret_1'].rolling(20).std() * np.sqrt(252)
df['target'] = (df['ret_1'].shift(-1) &gt; 0).astype(int)
df = df.dropna()
FEAT = ['ret_1','ret_5','ret_20','hv_20']
SEQ  = 20; SPLIT = int(len(df) * 0.8)

def make_seqs(arr, tgt, seq):
    X, y = [], []
    for i in range(seq, len(arr)):
        X.append(arr[i-seq:i]); y.append(tgt[i])
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

X, y = make_seqs(df[FEAT].values, df['target'].values, SEQ)
X_tr, y_tr = X[:SPLIT-SEQ], y[:SPLIT-SEQ]
X_te, y_te = X[SPLIT-SEQ:],  y[SPLIT-SEQ:]

tr_dl = DataLoader(TensorDataset(torch.tensor(X_tr), torch.tensor(y_tr).unsqueeze(1)), 32, shuffle=False)
te_dl = DataLoader(TensorDataset(torch.tensor(X_te), torch.tensor(y_te).unsqueeze(1)), 64, shuffle=False)</code></pre>

<h3>Model, Training &amp; Evaluation</h3>
<pre><code class="language-python">class LSTM(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(len(FEAT), 64, 2, dropout=0.3, batch_first=True)
        self.head = nn.Sequential(nn.Linear(64,32), nn.ReLU(), nn.Linear(32,1), nn.Sigmoid())
    def forward(self, x):
        out, _ = self.lstm(x); return self.head(out[:,-1,:])

model = LSTM()
opt, crit = torch.optim.AdamW(model.parameters(), lr=1e-3), nn.BCELoss()
best, pat, no_imp = float('inf'), 15, 0
for epoch in range(200):
    model.train()
    for xb, yb in tr_dl:
        p = model(xb); l = crit(p, yb)
        opt.zero_grad(); l.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
    model.eval()
    with torch.no_grad():
        vl = np.mean([crit(model(xb), yb).item() for xb, yb in te_dl])
    if vl &lt; best: best=vl; torch.save(model.state_dict(),'best.pt'); no_imp=0
    else: no_imp+=1
    if no_imp&gt;=pat: break

model.load_state_dict(torch.load('best.pt'))
with torch.no_grad():
    probs = torch.cat([model(xb) for xb,_ in te_dl]).numpy().flatten()
print(f'Test AUC: {roc_auc_score(y_te, probs):.3f}')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Full pipeline: download &rarr; features &rarr; sequences &rarr; LSTM &rarr; AUC evaluation</li>
    <li>20-day sequences capture roughly one month of trading context</li>
    <li>Early stopping with patience=15 prevents overfitting automatically</li>
    <li>AUC &gt; 0.54 on SPY daily data is a meaningful edge — this architecture achieves 0.56-0.60</li>
  </ul>
</div>`
}
,
{
  id:"6.1", module:6, tier:"pro", duration:45,
  title:"NLP Fundamentals for Finance",
  audio:"/audio/course-6-1.mp3", video:null,
  content:`<h2>NLP Fundamentals for Finance</h2>
<p class="lesson-intro">Natural Language Processing turns unstructured text — news headlines, earnings transcripts, social posts — into numeric features your ML model can use. Financial NLP is one of the most powerful alpha sources available to retail traders.</p>

<h3>Text Preprocessing Pipeline</h3>
<pre><code class="language-python">import re
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

stop_words = set(stopwords.words('english'))
lemmatizer = WordNetLemmatizer()

def clean_text(text):
    text = text.lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    tokens = word_tokenize(text)
    tokens = [lemmatizer.lemmatize(t) for t in tokens
              if t not in stop_words and len(t) > 2]
    return ' '.join(tokens)</code></pre>

<h3>Bag of Words vs Embeddings</h3>
<p>Bag of Words TF-IDF is fast and interpretable — good for sentiment classification with labeled data. Word embeddings capture semantic meaning. Transformer embeddings like FinBERT understand context — "not bullish" is correctly negative, not positive.</p>
<pre><code class="language-python">from sklearn.feature_extraction.text import TfidfVectorizer
from transformers import pipeline

# TF-IDF: fast baseline
tfidf = TfidfVectorizer(max_features=5000, ngram_range=(1,2))
X = tfidf.fit_transform(corpus)

# FinBERT: finance-tuned BERT (best quality)
sentiment = pipeline('sentiment-analysis', model='ProsusAI/finbert')
result = sentiment("Earnings beat estimates by 15%")
# [{'label': 'positive', 'score': 0.97}]</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Clean text aggressively: lowercase, remove punctuation, lemmatize, remove stop words</li>
    <li>TF-IDF is a fast strong baseline; FinBERT gives best quality for financial sentiment</li>
    <li>Finance has domain-specific language — generic sentiment models underperform FinBERT</li>
    <li>Text features combined with price features produce the strongest signals</li>
  </ul>
</div>`
}
,{
  id:"6.2", module:6, tier:"pro", duration:50,
  title:"News Sentiment Scoring",
  audio:"/audio/course-6-2.mp3", video:null,
  content:`<h2>News Sentiment Scoring</h2>
<p class="lesson-intro">News sentiment is one of the oldest and most reliable alternative data sources. Studies consistently show positive news correlates with next-day positive returns and negative news with negative returns — especially around earnings and macro announcements.</p>

<h3>Scoring Headlines with FinBERT</h3>
<pre><code class="language-python">from transformers import pipeline
import pandas as pd

finbert = pipeline('sentiment-analysis', model='ProsusAI/finbert')

def score_headlines(headlines):
    results = finbert(headlines, truncation=True, max_length=512)
    scores  = []
    for r in results:
        s = r['score'] if r['label'] == 'positive' else -r['score']
        scores.append(s)
    return scores

def daily_sentiment(df_news):
    daily = df_news.groupby('date').agg(
        sent_mean=('score','mean'),
        n_articles=('score','count'),
        sent_pos=('score', lambda x: (x&gt;0.3).sum()),
        sent_neg=('score', lambda x: (x&lt;-0.3).sum())
    )
    daily['sent_ratio'] = daily['sent_pos'] / (daily['n_articles'] + 1)
    return daily</code></pre>

<h3>Combining Sentiment with Price Features</h3>
<pre><code class="language-python">df = price_df.join(sentiment_df, how='left')
df['sent_mean'] = df['sent_mean'].fillna(0)
df['sent_3d']   = df['sent_mean'].rolling(3).mean()
df['sent_mom']  = df['sent_mean'] - df['sent_mean'].shift(5)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>FinBERT gives superior sentiment accuracy for financial headlines vs generic models</li>
    <li>Aggregate multiple articles per day using mean score, article count, and pos/neg ratio</li>
    <li>Sentiment momentum (today vs 5-day avg) is often more predictive than raw level</li>
    <li>Fill missing sentiment days with 0 (neutral) — absence of news is not negative</li>
  </ul>
</div>`
}
,{
  id:"6.3", module:6, tier:"pro", duration:50,
  title:"Social Media &amp; Reddit Signals",
  audio:"/audio/course-6-3.mp3", video:null,
  content:`<h2>Social Media &amp; Reddit Signals</h2>
<p class="lesson-intro">Social media sentiment — particularly Reddit WallStreetBets and StockTwits — can be a leading indicator of retail trader interest and short-term momentum. The GameStop squeeze of 2021 demonstrated that coordinated retail flows move markets.</p>

<h3>Reddit Data Pipeline</h3>
<pre><code class="language-python">import praw
import pandas as pd
from datetime import datetime

reddit = praw.Reddit(
    client_id='YOUR_ID',
    client_secret='YOUR_SECRET',
    user_agent='trading_signal/1.0'
)

def scrape_wsb_mentions(ticker, limit=500):
    subreddit = reddit.subreddit('wallstreetbets')
    posts = []
    for post in subreddit.search(ticker, limit=limit, time_filter='week'):
        posts.append({
            'date':     datetime.fromtimestamp(post.created_utc).date(),
            'title':    post.title,
            'score':    post.score,
            'comments': post.num_comments
        })
    return pd.DataFrame(posts)</code></pre>

<h3>Mention Velocity Signal</h3>
<pre><code class="language-python">daily = df.groupby('date').agg(
    mention_count=('title','count'),
    avg_upvotes=('score','mean')
)
daily['mention_z'] = (
    (daily['mention_count'] - daily['mention_count'].rolling(14).mean())
    / daily['mention_count'].rolling(14).std()
)
daily['wsb_signal'] = (
    (daily['mention_z'] &gt; 2) &amp; (daily['sent_mean'] &gt; 0.2)
).astype(int)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Mention velocity (sudden spike vs baseline) is more predictive than raw mention count</li>
    <li>Combine mention count with sentiment — high mentions + negative sentiment = bearish</li>
    <li>WallStreetBets works best for small/mid cap stocks; large caps are less affected</li>
    <li>Z-score normalize mention counts — absolute numbers vary widely by ticker</li>
  </ul>
</div>`
}
,{
  id:"6.4", module:6, tier:"pro", duration:55,
  title:"Earnings Calls with LLMs",
  audio:"/audio/course-6-4.mp3", video:null,
  content:`<h2>Earnings Calls with LLMs</h2>
<p class="lesson-intro">Earnings call transcripts contain nuanced forward guidance that standard sentiment models miss. Large Language Models can extract specific signals: management confidence, uncertainty language, and changes in tone from prior quarters.</p>

<h3>Extracting Signals from Transcripts</h3>
<pre><code class="language-python">import anthropic

client = anthropic.Anthropic()

def analyze_earnings_call(transcript_text, symbol):
    prompt = (
        f"Analyze this earnings call transcript for {symbol}.\n"
        "Extract:\n"
        "1. Overall sentiment (bullish/neutral/bearish, 1-5 scale)\n"
        "2. Revenue guidance: raised/maintained/lowered/not provided\n"
        "3. Margin commentary: expanding/stable/compressing\n"
        "4. Management confidence level (1-5)\n"
        "5. Key risks mentioned\n\n"
        f"Transcript:\n{transcript_text[:8000]}\n\n"
        "Respond in JSON format."
    )
    msg = client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=1024,
        messages=[{'role':'user','content':prompt}]
    )
    return msg.content[0].text</code></pre>

<h3>Tone Change Detection</h3>
<pre><code class="language-python">def tone_change_score(current_analysis, prior_analysis):
    curr_sent = current_analysis['sentiment_score']
    prev_sent = prior_analysis['sentiment_score']
    return round(curr_sent - prev_sent, 2)
# +2 = meaningfully more positive (pre-announcement alpha)
# -2 = meaningfully more negative (guidance cut warning)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>LLMs extract nuanced signals from earnings calls that keyword models miss</li>
    <li>Tone change vs prior quarter is more predictive than absolute tone level</li>
    <li>Revenue guidance changes are the highest-signal element of earnings calls</li>
    <li>Use structured JSON output from LLMs as numeric features for your ML pipeline</li>
  </ul>
</div>`
}
,{
  id:"6.5", module:6, tier:"pro", duration:50,
  title:"Building a Sentiment Feature Pipeline",
  audio:"/audio/course-6-5.mp3", video:null,
  content:`<h2>Building a Sentiment Feature Pipeline</h2>
<p class="lesson-intro">Individual sentiment signals are weak in isolation. The real alpha comes from combining news sentiment, social media volume, and earnings tone into a unified sentiment feature matrix that feeds your ML model alongside price features.</p>

<h3>Unified Sentiment Features</h3>
<pre><code class="language-python">def build_sentiment_features(price_df, news_df, social_df):
    news_feat = news_df.groupby('date').agg(
        news_sent=('score','mean'),
        news_vol=('score','count'),
        news_pos_ratio=('score', lambda x: (x&gt;0.3).mean())
    )
    social_feat = social_df.groupby('date').agg(
        mention_z=('mention_z','last'),
        social_sent=('sentiment','mean')
    )
    df = price_df.join(news_feat, how='left').join(social_feat, how='left')
    df[['news_sent','social_sent']] = df[['news_sent','social_sent']].fillna(0)
    df['sent_composite'] = 0.6*df['news_sent'] + 0.4*df['social_sent']
    df['sent_momentum']  = df['sent_composite'] - df['sent_composite'].shift(5)
    return df</code></pre>

<h3>Validating Sentiment Features</h3>
<pre><code class="language-python">from scipy.stats import spearmanr
ic, pval = spearmanr(df['sent_composite'].dropna(), df['target'].dropna())
print(f'Sentiment IC: {ic:.4f}  (p={pval:.4f})')
# IC &gt; 0.03 with p &lt; 0.05 = worth including in model</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Composite sentiment (news + social weighted) outperforms either source alone</li>
    <li>Always validate IC before adding sentiment features to your model</li>
    <li>Sentiment momentum (5-day change) is often more predictive than the level</li>
    <li>Forward-fill sentiment on weekends and holidays — use last available reading</li>
  </ul>
</div>`
}
,{
  id:"6.6", module:6, tier:"pro", duration:80,
  title:"Project — Sentiment-Enhanced Trading Signal",
  audio:"/audio/course-6-6.mp3", video:null,
  content:`<h2>Project — Sentiment-Enhanced Trading Signal</h2>
<p class="lesson-intro">This capstone combines price features and sentiment features to quantify the lift from adding sentiment and produce a daily composite signal that outperforms a price-only model.</p>

<h3>Measuring Sentiment Lift</h3>
<pre><code class="language-python">import xgboost as xgb
from sklearn.metrics import roc_auc_score

price_features = ['ret_1','ret_5','ret_20','hv_20','rsi_14','macd_signal']
sent_features  = ['news_sent','news_vol','sent_composite','sent_momentum']
all_features   = price_features + sent_features

split = int(len(df) * 0.8)
X_tr, y_tr = df[all_features].iloc[:split], df['target'].iloc[:split]
X_te, y_te = df[all_features].iloc[split:],  df['target'].iloc[split:]

def train_eval(feats):
    m = xgb.XGBClassifier(n_estimators=300, max_depth=4,
                           learning_rate=0.05, eval_metric='logloss')
    m.fit(X_tr[feats], y_tr)
    return roc_auc_score(y_te, m.predict_proba(X_te[feats])[:,1])

auc1 = train_eval(price_features)
auc2 = train_eval(all_features)
print(f'Price-only AUC:        {auc1:.3f}')
print(f'Price+Sentiment AUC:   {auc2:.3f}')
print(f'Lift:                  {auc2-auc1:+.3f}')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Sentiment typically adds 0.01-0.03 AUC lift over price-only models</li>
    <li>Lift is larger during high-volatility periods and around earnings events</li>
    <li>Feature importance reveals which sentiment features matter most per asset</li>
    <li>Measure lift on held-out data only — in-sample sentiment lift often overfits</li>
  </ul>
</div>`
}
,{
  id:"7.1", module:7, tier:"pro", duration:45,
  title:"Vectorbt &amp; Backtrader Overview",
  audio:"/audio/course-7-1.mp3", video:null,
  content:`<h2>Vectorbt &amp; Backtrader Overview</h2>
<p class="lesson-intro">Professional backtesting frameworks handle position management, transaction costs, and performance reporting automatically. Vectorbt is fast and Pythonic; Backtrader is event-driven and closer to live trading.</p>

<h3>Vectorbt — Vectorized Speed</h3>
<pre><code class="language-python">import vectorbt as vbt

price = vbt.YFData.download('SPY', missing_index='drop').get('Close')
fast_ma = vbt.MA.run(price, 20)
slow_ma = vbt.MA.run(price, 50)

entries = fast_ma.ma_crossed_above(slow_ma)
exits   = fast_ma.ma_crossed_below(slow_ma)

pf = vbt.Portfolio.from_signals(
    price, entries, exits,
    init_cash=10_000, fees=0.001, slippage=0.001
)
print(pf.stats())</code></pre>

<h3>Backtrader — Event-Driven</h3>
<pre><code class="language-python">import backtrader as bt

class MLStrategy(bt.Strategy):
    def next(self):
        if self.data.signal[0] &gt; 0.55 and not self.position:
            self.buy()
        elif self.data.signal[0] &lt; 0.45 and self.position:
            self.sell()

cerebro = bt.Cerebro()
cerebro.addstrategy(MLStrategy)
cerebro.adddata(data_feed)
cerebro.broker.setcash(10000)
cerebro.broker.setcommission(commission=0.001)
cerebro.run()</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Vectorbt is 100x faster than Backtrader — best for parameter sweeps</li>
    <li>Backtrader is event-driven — closer to how live trading systems work</li>
    <li>Always include fees and slippage — backtests without costs are misleading</li>
    <li>Both handle position sizing, portfolio tracking, and performance reporting</li>
  </ul>
</div>`
}
,{
  id:"7.2", module:7, tier:"pro", duration:55,
  title:"Building a Professional Backtest Engine",
  audio:"/audio/course-7-2.mp3", video:null,
  content:`<h2>Building a Professional Backtest Engine</h2>
<p class="lesson-intro">Rolling your own backtest engine gives you full control over execution logic, position sizing, and risk rules — and deepens your understanding of exactly what your backtest does and does not model.</p>

<h3>Core Backtest Engine</h3>
<pre><code class="language-python">class BacktestEngine:
    def __init__(self, prices, signals, capital=10000, cost_bps=5):
        self.prices, self.signals = prices, signals
        self.capital, self.cost_bps = capital, cost_bps

    def run(self):
        cash, position = self.capital, 0
        equity, trades = [], []
        for i, (dt, row) in enumerate(self.prices.iterrows()):
            price  = row['close']
            signal = self.signals.iloc[i] if i &lt; len(self.signals) else 0
            target = signal * (cash / price)
            delta  = target - position
            if abs(delta) &gt; 0:
                cost     = abs(delta) * price * self.cost_bps / 10000
                cash    -= delta * price + cost
                position = target
                trades.append({'dt':dt, 'delta':delta, 'cost':cost})
            equity.append({'dt':dt, 'equity': cash + position * price})
        return pd.DataFrame(equity).set_index('dt'), pd.DataFrame(trades)</code></pre>

<h3>Performance Report</h3>
<pre><code class="language-python">def full_report(equity_df):
    r      = equity_df['equity'].pct_change().dropna()
    sharpe = (r.mean() / r.std()) * np.sqrt(252)
    peak   = equity_df['equity'].cummax()
    max_dd = ((equity_df['equity'] - peak) / peak).min()
    print(f'Sharpe: {sharpe:.2f} | Max DD: {max_dd:.1%}')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Build your own engine to understand exactly what is and is not modeled</li>
    <li>Model transaction costs explicitly — track cost per trade and cumulative drag</li>
    <li>Shift signals by 1 day before applying — you trade at next day open, not today close</li>
    <li>Track equity curve, drawdown, and trade log separately for complete analysis</li>
  </ul>
</div>`
}
,{
  id:"7.3", module:7, tier:"pro", duration:50,
  title:"Position Sizing &amp; Kelly Criterion",
  audio:"/audio/course-7-3.mp3", video:null,
  content:`<h2>Position Sizing &amp; Kelly Criterion</h2>
<p class="lesson-intro">How much you bet matters as much as whether you win. Correct position sizing transforms a mediocre signal into a robust strategy and prevents a good signal from blowing up your account.</p>

<h3>Kelly Criterion</h3>
<p>Kelly sizing maximizes long-run geometric growth. For a binary bet: f* = (p*b - q) / b, where p is win probability, q = 1-p, and b is the win/loss ratio. In practice, use 25-50% Kelly to reduce variance.</p>
<pre><code class="language-python">def kelly_fraction(win_rate, avg_win, avg_loss):
    b = avg_win / avg_loss
    p, q = win_rate, 1 - win_rate
    f = (p * b - q) / b
    return max(0, min(f * 0.5, 0.25))   # half Kelly, capped at 25%

k = kelly_fraction(0.55, 1.0, 1.0)
print(f'Kelly fraction: {k:.1%}')   # ~5%</code></pre>

<h3>Probability-Based Sizing</h3>
<pre><code class="language-python">def prob_based_size(prob_up, base_size=0.1, min_prob=0.55):
    if abs(prob_up - 0.5) &lt; (min_prob - 0.5):
        return 0   # flat in uncertain zone
    excess = abs(prob_up - 0.5) - (min_prob - 0.5)
    scale  = excess / (0.5 - min_prob + 0.001)
    return base_size * (1 + scale)   # 10-20% of portfolio

def vol_adjusted_size(size, current_vol, target_vol=0.15):
    return size * target_vol / max(current_vol, 0.05)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Never bet more than half Kelly — full Kelly creates extreme drawdowns</li>
    <li>Scale position size with model confidence — flat when probability near 50%</li>
    <li>Reduce size in high-volatility regimes to keep dollar risk constant</li>
    <li>Cap any single position at 25% of portfolio regardless of signal strength</li>
  </ul>
</div>`
}
,{
  id:"7.4", module:7, tier:"pro", duration:45,
  title:"Transaction Costs &amp; Market Impact",
  audio:"/audio/course-7-4.mp3", video:null,
  content:`<h2>Transaction Costs &amp; Market Impact</h2>
<p class="lesson-intro">Transaction costs are the silent killer of backtests. A strategy with Sharpe 1.5 before costs can drop below 0.5 after realistic costs. This lesson shows how to model costs correctly and build strategies that survive real-world execution.</p>

<h3>Full Cost Model</h3>
<pre><code class="language-python">import numpy as np

def transaction_cost(price, size_dollars, adv_dollars, volatility):
    shares     = size_dollars / price
    commission = max(shares * 0.005, 1.0)      # IB: $0.005/share

    spread_bps = 1.0   # SPY typical bid-ask spread
    spread_cost = size_dollars * spread_bps / 10000

    participation = size_dollars / adv_dollars
    impact_bps    = 10 * np.sqrt(participation) * volatility * 100
    impact_cost   = size_dollars * impact_bps / 10000

    return commission + spread_cost + impact_cost

# Round-trip costs: SPY=1-3bps, large caps=3-8bps, small caps=15-50bps</code></pre>

<h3>Turnover Analysis</h3>
<pre><code class="language-python">def turnover_analysis(signals):
    daily_turn   = signals.diff().abs().mean()
    annual_turn  = daily_turn * 252
    cost_per_turn = 5 / 10000   # 5 bps
    annual_cost   = annual_turn * cost_per_turn
    print(f'Annual turnover: {annual_turn:.1f}x | Cost drag: {annual_cost:.1%}')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Model all three cost components: commission, spread, and market impact</li>
    <li>Daily-rebalancing strategies pay ~12% annually just in costs on liquid ETFs</li>
    <li>Market impact scales with square root of participation — trade slowly for large positions</li>
    <li>Target less than 2x annual turnover for cost-efficient signals</li>
  </ul>
</div>`
}
,{
  id:"7.5", module:7, tier:"pro", duration:55,
  title:"Portfolio Backtesting — Multiple Signals",
  audio:"/audio/course-7-5.mp3", video:null,
  content:`<h2>Portfolio Backtesting — Multiple Signals</h2>
<p class="lesson-intro">Running multiple uncorrelated signals in a portfolio dramatically improves the Sharpe ratio — the diversification benefit is essentially free alpha. This lesson shows how to combine signals, manage correlations, and run a portfolio-level backtest.</p>

<h3>Portfolio-Level Backtest</h3>
<pre><code class="language-python">def portfolio_backtest(assets, signals, cost_bps=5, target_vol=0.10):
    port_returns = None
    for sym, prices in assets.items():
        sig = signals[sym]
        ret = prices.pct_change()
        asset_vol = ret.rolling(20).std() * np.sqrt(252)
        size      = target_vol / asset_vol.clip(0.05, 0.50)
        costs     = sig.diff().abs() * cost_bps / 10000
        strat_ret = (sig.shift(1) * ret * size) - costs
        port_returns = strat_ret if port_returns is None else port_returns + strat_ret

    port_returns /= len(assets)
    sharpe = port_returns.mean() / port_returns.std() * np.sqrt(252)
    print(f'Portfolio Sharpe: {sharpe:.2f}')
    return port_returns</code></pre>

<h3>Correlation Check</h3>
<pre><code class="language-python">signals_df = pd.DataFrame(signals)
corr = signals_df.corr()
print("Signal correlations:")
print(corr.round(2))
# Target: pairwise correlation &lt; 0.5 for meaningful diversification benefit</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Portfolio Sharpe &asymp; single-asset Sharpe &times; sqrt(n) when signals are uncorrelated</li>
    <li>Target volatility sizing equalizes risk contribution across assets</li>
    <li>Check signal correlations — highly correlated signals waste diversification budget</li>
    <li>Start with 4-6 uncorrelated assets; marginal benefit diminishes quickly beyond that</li>
  </ul>
</div>`
}
,{
  id:"7.6", module:7, tier:"pro", duration:50,
  title:"Monte Carlo &amp; Robustness Testing",
  audio:"/audio/course-7-6.mp3", video:null,
  content:`<h2>Monte Carlo &amp; Robustness Testing</h2>
<p class="lesson-intro">A backtest is a single path through history. Monte Carlo simulation generates thousands of alternative paths to assess whether your edge is robust or a historical artifact. If your strategy fails in most simulated scenarios, it will likely fail in live trading.</p>

<h3>Monte Carlo Backtest</h3>
<pre><code class="language-python">def monte_carlo_backtest(strategy_returns, n_sims=1000):
    results = []
    for _ in range(n_sims):
        shuffled = np.random.permutation(strategy_returns.values)
        equity   = (1 + pd.Series(shuffled)).cumprod()
        peak     = equity.cummax()
        max_dd   = ((equity - peak) / peak).min()
        sharpe   = (shuffled.mean() / shuffled.std()) * np.sqrt(252)
        results.append({'sharpe': sharpe, 'max_dd': max_dd})
    df = pd.DataFrame(results)
    print(f'Sharpe 5th pct:   {df.sharpe.quantile(0.05):.2f}')
    print(f'P(Sharpe &gt; 0):    {(df.sharpe &gt; 0).mean():.1%}')
    print(f'Max DD 95th pct:  {df.max_dd.quantile(0.95):.1%}')
    return df</code></pre>

<h3>Parameter Sensitivity</h3>
<pre><code class="language-python">param_grid = [
    {'max_depth':4, 'min_child_weight':20},
    {'max_depth':6, 'min_child_weight':40},
    {'max_depth':8, 'min_child_weight':60}
]
aucs = []
for params in param_grid:
    m = xgb.XGBClassifier(**params, n_estimators=300, eval_metric='logloss')
    m.fit(X_tr, y_tr)
    aucs.append(roc_auc_score(y_te, m.predict_proba(X_te)[:,1]))
print(f'AUC range: {min(aucs):.3f} - {max(aucs):.3f}')
# Small range = robust; large range = overfit to specific params</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Monte Carlo reveals worst-case scenarios that a single backtest path misses</li>
    <li>P(Sharpe &gt; 0) below 80% in Monte Carlo means your edge is not statistically reliable</li>
    <li>AUC should be stable across a range of hyperparameters for a robust model</li>
    <li>Robust strategies perform consistently across market regimes, not just the backtest period</li>
  </ul>
</div>`
}
,{
  id:"7.7", module:7, tier:"pro", duration:80,
  title:"Project — Professional Backtest Report",
  audio:"/audio/course-7-7.mp3", video:null,
  content:`<h2>Project — Professional Backtest Report</h2>
<p class="lesson-intro">Quantitative funds present results in a standardized tear sheet format: equity curve, monthly returns heatmap, rolling Sharpe, and drawdown chart. This project builds that report automatically from your strategy returns.</p>

<h3>Automated Tear Sheet</h3>
<pre><code class="language-python">import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import seaborn as sns

def generate_tearsheet(strategy_returns, benchmark_returns, title='Strategy'):
    equity   = (1 + strategy_returns).cumprod()
    bh       = (1 + benchmark_returns).cumprod()
    peak     = equity.cummax()
    drawdown = (equity - peak) / peak
    ann_ret  = strategy_returns.mean() * 252
    ann_vol  = strategy_returns.std() * np.sqrt(252)
    sharpe   = ann_ret / ann_vol
    max_dd   = drawdown.min()

    fig = plt.figure(figsize=(14, 10))
    fig.suptitle(f'{title} | Sharpe={sharpe:.2f} | Return={ann_ret:.1%} | MaxDD={max_dd:.1%}')
    gs  = gridspec.GridSpec(3, 2, figure=fig)

    ax1 = fig.add_subplot(gs[0, :])
    ax1.plot(equity, color='#4ade80', label='Strategy')
    ax1.plot(bh,     color='#94a3b8', label='Buy &amp; Hold')
    ax1.legend(); ax1.set_facecolor('#0f172a')

    ax2 = fig.add_subplot(gs[1, :])
    ax2.fill_between(drawdown.index, drawdown, 0, color='#f87171', alpha=0.7)
    ax2.set_facecolor('#0f172a')

    monthly = strategy_returns.resample('ME').apply(lambda x: (1+x).prod()-1)
    monthly_df = monthly.to_frame()
    monthly_df['year']  = monthly_df.index.year
    monthly_df['month'] = monthly_df.index.month
    pivot = monthly_df.pivot(index='year', columns='month', values=monthly_df.columns[0])
    ax3 = fig.add_subplot(gs[2, :])
    sns.heatmap(pivot, annot=True, fmt='.1%', cmap='RdYlGn', center=0, ax=ax3)
    plt.tight_layout()
    plt.savefig('tearsheet.png', dpi=150)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Always show equity curve AND drawdown together — one without the other is misleading</li>
    <li>Monthly returns heatmap instantly reveals seasonality and year-by-year consistency</li>
    <li>Include benchmark comparison — strategies that underperform buy-and-hold add no value</li>
    <li>Calmar ratio (return / max drawdown) is the most practical single performance metric</li>
  </ul>
</div>`
}
,{
  id:"8.1", module:8, tier:"pro", duration:45,
  title:"Options Greeks &amp; Pricing Review",
  audio:"/audio/course-8-1.mp3", video:null,
  content:`<h2>Options Greeks &amp; Pricing Review</h2>
<p class="lesson-intro">Before applying ML to options, you need a solid command of the Greeks. Delta, Gamma, Theta, and Vega are not just risk measures — they are features that describe the behavior of every options position and drive the signals your model will learn from.</p>

<h3>Black-Scholes Greeks in Python</h3>
<pre><code class="language-python">import numpy as np
from scipy.stats import norm

def black_scholes(S, K, T, r, sigma, option='call'):
    d1 = (np.log(S/K) + (r + 0.5*sigma**2)*T) / (sigma*np.sqrt(T))
    d2 = d1 - sigma*np.sqrt(T)
    if option == 'call':
        price = S*norm.cdf(d1) - K*np.exp(-r*T)*norm.cdf(d2)
        delta = norm.cdf(d1)
    else:
        price = K*np.exp(-r*T)*norm.cdf(-d2) - S*norm.cdf(-d1)
        delta = norm.cdf(d1) - 1
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    theta = (-S*norm.pdf(d1)*sigma/(2*np.sqrt(T))
             - r*K*np.exp(-r*T)*norm.cdf(d2)) / 365
    vega  = S * norm.pdf(d1) * np.sqrt(T) / 100
    return {'price':price, 'delta':delta, 'gamma':gamma, 'theta':theta, 'vega':vega}

result = black_scholes(S=450, K=450, T=30/365, r=0.05, sigma=0.20)
print(result)</code></pre>

<h3>Greeks as ML Features</h3>
<p>The Greeks create powerful features: put/call delta ratio signals directional bias, gamma concentration at a strike signals pinning risk, and changes in aggregate vega signal volatility regime shifts.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Delta: sensitivity to price (call 0-1, put -1 to 0)</li>
    <li>Gamma: rate of delta change — highest ATM near expiry, drives dealer hedging</li>
    <li>Theta: time decay — short options strategies profit from theta daily</li>
    <li>Vega: IV sensitivity — long options profit when implied volatility rises</li>
  </ul>
</div>`
}
,{
  id:"8.2", module:8, tier:"pro", duration:55,
  title:"Predicting Implied Volatility with ML",
  audio:"/audio/course-8-2.mp3", video:null,
  content:`<h2>Predicting Implied Volatility with ML</h2>
<p class="lesson-intro">Implied volatility is both a measure of market fear and a tradeable asset. When your model predicts IV will rise, you buy options (long vega). When it predicts IV will fall, you sell options. Correct IV prediction is the foundation of professional options trading.</p>

<h3>IV Features</h3>
<pre><code class="language-python">def build_iv_features(df):
    df['iv_atm']       = df['iv_atm_30d']
    df['iv_skew']      = df['iv_25d_put'] - df['iv_25d_call']
    df['iv_term']      = df['iv_atm_60d'] - df['iv_atm_30d']
    df['iv_rv_spread'] = df['iv_atm'] - df['rv_20d']
    df['iv_mom_5d']    = df['iv_atm'].pct_change(5)
    df['iv_rank']      = (
        (df['iv_atm'] - df['iv_atm'].rolling(252).min()) /
        (df['iv_atm'].rolling(252).max() - df['iv_atm'].rolling(252).min())
    )
    return df</code></pre>

<h3>IV Prediction Model</h3>
<pre><code class="language-python">df['iv_target'] = (df['iv_atm'].shift(-5) &gt; df['iv_atm']).astype(int)

iv_features = ['rv_5d','rv_20d','iv_skew','iv_term',
               'iv_rank','iv_mom_5d','days_to_fomc','days_to_cpi']

model = xgb.XGBClassifier(n_estimators=300, max_depth=4, eval_metric='logloss')
model.fit(X_tr[iv_features], y_tr)
# Long vega when model predicts IV rise; short vega when predicts fall</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>IV rank (where IV sits in its 1-year range) is the most important single IV feature</li>
    <li>IV minus realized vol spread predicts mean reversion — sell when IV &gt;&gt; RV</li>
    <li>Calendar events (FOMC, CPI, earnings) are the strongest IV predictors</li>
    <li>IV prediction models have IC 0.05-0.10 — stronger than directional price models</li>
  </ul>
</div>`
}
,{
  id:"8.3", module:8, tier:"pro", duration:50,
  title:"0DTE &amp; Short-Term Flow Signals",
  audio:"/audio/course-8-3.mp3", video:null,
  content:`<h2>0DTE &amp; Short-Term Flow Signals</h2>
<p class="lesson-intro">Zero-days-to-expiry options now account for over 50% of SPY options volume. The massive gamma created by 0DTE options forces dealers into mechanical hedging flows that create predictable intraday price patterns.</p>

<h3>0DTE Gamma Mechanics</h3>
<p>When a 0DTE call is sold by a dealer, they must delta-hedge by buying the underlying. As the option approaches expiry and gamma spikes, small price moves force large hedge adjustments. This creates momentum when price moves through high-gamma strikes, or pinning when price is near a high-OI strike.</p>
<pre><code class="language-python">def compute_0dte_gex(chain, spot):
    gex = 0
    for _, row in chain.iterrows():
        gamma, oi = row['gamma'], row['openInterest']
        if oi == 0 or gamma == 0: continue
        dollar_gamma = gamma * oi * 100 * spot**2 * 0.01
        gex += dollar_gamma if row['optionType'] == 'call' else -dollar_gamma
    return gex   # positive: stabilizing; negative: destabilizing</code></pre>

<h3>0DTE Flow Signal</h3>
<pre><code class="language-python">def dte0_signal(chain, spot, threshold=0.60):
    call_vol = chain[chain.strike &gt; spot]['volume'].sum()
    put_vol  = chain[chain.strike &lt;= spot]['volume'].sum()
    call_pct = call_vol / (call_vol + put_vol + 1)
    if call_pct &gt; threshold:   return 1    # bullish
    if call_pct &lt; 1-threshold: return -1   # bearish
    return 0</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>0DTE options create massive gamma that forces mechanical dealer hedging flows</li>
    <li>Negative dealer GEX = destabilizing flows (moves are amplified)</li>
    <li>Positive dealer GEX = stabilizing flows (price pins near large-OI strikes)</li>
    <li>0DTE call/put volume ratio above the open is the simplest actionable intraday signal</li>
  </ul>
</div>`
}
,{
  id:"8.4", module:8, tier:"pro", duration:50,
  title:"Delta-Neutral Strategies",
  audio:"/audio/course-8-4.mp3", video:null,
  content:`<h2>Delta-Neutral Strategies</h2>
<p class="lesson-intro">Delta-neutral strategies profit from volatility — not direction. By combining options to zero out delta, you trade pure volatility: long vol when IV is cheap, short vol when expensive, regardless of market direction.</p>

<h3>Straddles</h3>
<pre><code class="language-python">class Straddle:
    def __init__(self, strike, call_price, put_price):
        self.strike  = strike
        self.premium = call_price + put_price
        self.be_up   = strike + self.premium
        self.be_down = strike - self.premium

    def pnl(self, underlying_price):
        call_val = max(0, underlying_price - self.strike)
        put_val  = max(0, self.strike - underlying_price)
        return call_val + put_val - self.premium

def should_buy_straddle(iv_rank, rv_20d, iv_atm):
    iv_rv_premium = iv_atm - rv_20d
    return iv_rank &lt; 0.25 and iv_rv_premium &lt; 0.02</code></pre>

<h3>Iron Condor — Short Vol Income</h3>
<pre><code class="language-python">def iron_condor_pnl(S, K1, K2, K3, K4, premium):
    # Sell K2 put, buy K1 put, sell K3 call, buy K4 call
    # K1 &lt; K2 &lt; spot &lt; K3 &lt; K4
    put_spread  = max(0, K2-S) - max(0, K1-S)
    call_spread = max(0, S-K3) - max(0, S-K4)
    return premium - put_spread - call_spread
# Enter when IV rank &gt; 60% — sell expensive volatility</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Long straddle profits when realized vol exceeds implied vol (IV underpriced)</li>
    <li>Short straddle profits when IV exceeds realized vol (IV overpriced)</li>
    <li>Use IV rank to time entries: sell vol when rank &gt; 60%, buy when &lt; 30%</li>
    <li>Always define max risk with wings — naked short options can blow up accounts</li>
  </ul>
</div>`
}
,{
  id:"8.5", module:8, tier:"pro", duration:50,
  title:"Gamma Exposure &amp; Dealer Positioning",
  audio:"/audio/course-8-5.mp3", video:null,
  content:`<h2>Gamma Exposure &amp; Dealer Positioning</h2>
<p class="lesson-intro">Dealer gamma exposure is one of the most powerful predictive signals for intraday price behavior. Positive GEX stabilizes prices; negative GEX amplifies moves. This is exactly what your ML dashboard displays, and now you will learn to trade it.</p>

<h3>Aggregate GEX Computation</h3>
<pre><code class="language-python">def aggregate_gex(options_chain, spot):
    total_gex = 0
    for _, row in options_chain.iterrows():
        gamma = row.get('gamma', 0) or 0
        oi    = row.get('openInterest', 0) or 0
        if oi == 0 or gamma == 0: continue
        dollar_gamma = gamma * oi * 100 * spot**2 * 0.01
        if row['type'] == 'call':
            total_gex += dollar_gamma
        else:
            total_gex -= dollar_gamma
    return total_gex
# GEX &gt; 0: dealers long gamma, BUY dips + SELL rips (mean-reverting)
# GEX &lt; 0: dealers short gamma, SELL dips + BUY rips (trend-following)</code></pre>

<h3>Trading the GEX Regime</h3>
<pre><code class="language-python">def gex_regime_signal(gex, flip_level, spot):
    if gex &gt; 0 and spot &gt; flip_level:
        return 'MEAN_REVERT'   # fade moves, sell high-gamma calls
    elif gex &lt; 0:
        return 'TREND_FOLLOW'  # ride breakouts, buy momentum
    return 'NEUTRAL'</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Positive GEX = mean-reverting regime; negative GEX = trending/volatile regime</li>
    <li>The flip level (zero gamma crossing) is a critical support/resistance level intraday</li>
    <li>Large GEX strikes act as price magnets — pinning effect near expiry</li>
    <li>Combine GEX regime with directional ML signal for highest-conviction setups</li>
  </ul>
</div>`
}
,{
  id:"8.6", module:8, tier:"pro", duration:50,
  title:"Building an Options Scanner",
  audio:"/audio/course-8-6.mp3", video:null,
  content:`<h2>Building an Options Scanner</h2>
<p class="lesson-intro">An options scanner automatically identifies unusual activity across hundreds of contracts — large block trades, elevated volume-to-OI ratios, and cross-strike accumulation patterns that indicate informed positioning ahead of major moves.</p>

<h3>Unusual Activity Scanner</h3>
<pre><code class="language-python">def scan_unusual_activity(chain_df, min_vol=500, min_ratio=3.0):
    unusual = []
    for _, row in chain_df.iterrows():
        vol = row.get('volume', 0) or 0
        oi  = row.get('openInterest', 0) or 0
        if vol &lt; min_vol or oi == 0: continue
        ratio   = vol / oi
        if ratio &lt; min_ratio: continue
        premium = vol * row.get('lastPrice', 0) * 100
        unusual.append({
            'symbol':    row['symbol'],
            'strike':    row['strike'],
            'type':      row['type'],
            'volume':    int(vol),
            'oi':        int(oi),
            'ratio':     round(ratio, 1),
            'premium_k': round(premium / 1000, 1)
        })
    return pd.DataFrame(unusual).sort_values('premium_k', ascending=False)</code></pre>

<h3>Sweep Detection</h3>
<pre><code class="language-python">def detect_sweeps(trades_df, size_threshold=100):
    sweeps = trades_df[
        (trades_df['size'] &gt;= size_threshold) &amp;
        (trades_df['condition'].str.contains('SWEEP', na=False))
    ].copy()
    sweeps['bullish'] = sweeps['price'] &gt;= sweeps['ask'] * 0.98
    return sweeps</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Volume/OI ratio &gt; 3 with size &gt; 500 contracts signals unusual informed activity</li>
    <li>Sweeps (multi-exchange simultaneous fills) indicate urgency and institutional motivation</li>
    <li>Track cumulative unusual activity over 3-5 days for highest reliability</li>
    <li>Large premium (&gt;$500K) unusual calls above spot = the strongest bullish signal</li>
  </ul>
</div>`
}
,{
  id:"8.7", module:8, tier:"pro", duration:55,
  title:"ML-Enhanced Options Strategies",
  audio:"/audio/course-8-7.mp3", video:null,
  content:`<h2>ML-Enhanced Options Strategies</h2>
<p class="lesson-intro">ML adds precision to options trading by predicting not just direction but the probability distribution of outcomes — letting you select the right strategy and strike for each market condition.</p>

<h3>Strategy Selection Based on ML Predictions</h3>
<pre><code class="language-python">def select_options_strategy(ml_prob_up, iv_rank, days_to_expiry):
    strategies = []
    # High conviction + cheap IV: buy call spread
    if ml_prob_up &gt; 0.60 and iv_rank &lt; 0.40:
        strategies.append({
            'name':     'Bull Call Spread',
            'rationale':'High directional conviction + cheap IV',
            'legs':     ['+1 ATM call', '-1 OTM call (5% above)']
        })
    # High conviction + expensive IV: sell credit spread
    elif ml_prob_up &gt; 0.60 and iv_rank &gt; 0.60:
        strategies.append({
            'name':     'Bull Put Spread',
            'rationale':'Directional + expensive IV — collect premium',
            'legs':     ['+1 OTM put', '-1 ATM put']
        })
    # No directional edge + very expensive IV: iron condor
    elif abs(ml_prob_up - 0.5) &lt; 0.10 and iv_rank &gt; 0.65:
        strategies.append({
            'name':     'Iron Condor',
            'rationale':'No directional edge + expensive IV',
            'legs':     ['Sell OTM strangle + buy wings']
        })
    return strategies</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Match strategy to both directional conviction (ML prob) AND IV regime (IV rank)</li>
    <li>High conviction + low IV: buy vertical spreads (long options)</li>
    <li>High conviction + high IV: sell credit spreads (collect premium on right side)</li>
    <li>No directional edge + very high IV: iron condor is the highest-probability trade</li>
  </ul>
</div>`
}
,{
  id:"8.8", module:8, tier:"pro", duration:80,
  title:"Project — Options Flow Signal System",
  audio:"/audio/course-8-8.mp3", video:null,
  content:`<h2>Project — Options Flow Signal System</h2>
<p class="lesson-intro">This capstone integrates options flow data, GEX analysis, IV prediction, and directional ML into a unified daily options signal system — the type of system used by professional options desks.</p>

<h3>Complete Options Signal Pipeline</h3>
<pre><code class="language-python">class OptionsSignalSystem:
    def __init__(self, symbol='SPY'):
        self.symbol = symbol

    def daily_signal(self, price_df, options_chain, iv_history):
        # 1. Directional ML
        direction_prob = self.direction_model.predict_proba(
            self.get_price_features(price_df))[:, 1][-1]

        # 2. IV regime
        iv_rank = self.compute_iv_rank(iv_history, window=252)

        # 3. GEX
        spot       = price_df['close'].iloc[-1]
        gex        = aggregate_gex(options_chain, spot)
        gex_regime = 'positive' if gex &gt; 0 else 'negative'

        # 4. Flow bias from unusual activity
        unusual  = scan_unusual_activity(options_chain)
        call_prem = unusual[unusual.type=='call'].premium_k.sum()
        put_prem  = unusual[unusual.type=='put'].premium_k.sum()
        flow_bias = 'bullish' if call_prem &gt; put_prem * 1.5 else 'neutral'

        # 5. Strategy selection
        strategy = select_options_strategy(direction_prob, iv_rank, 7)

        return {
            'direction_prob': round(direction_prob, 3),
            'iv_rank':        round(iv_rank, 2),
            'gex_regime':     gex_regime,
            'flow_bias':      flow_bias,
            'recommended':    strategy[0] if strategy else None,
        }</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Full system: directional ML + IV regime + GEX + unusual flow = complete options signal</li>
    <li>All four signals aligned = very high conviction — increase position size</li>
    <li>Mixed signals = wait or take smaller size — conflicting data means uncertainty</li>
    <li>This architecture is production-ready — connect to your broker API for live signals</li>
  </ul>
</div>`
}
,{
  id:"9.1", module:9, tier:"pro", duration:55,
  title:"Architecture of a Live Trading System",
  audio:"/audio/course-9-1.mp3", video:null,
  content:`<h2>Architecture of a Live Trading System</h2>
<p class="lesson-intro">A production trading system is not a Jupyter notebook — it is a collection of specialized components that work together reliably, handle errors gracefully, and never lose money due to a software bug.</p>

<h3>System Architecture</h3>
<pre><code>Data Layer       Signal Layer      Execution Layer
─────────────    ─────────────     ───────────────
Market data      ML model          Order manager
Options chain    Feature eng.      Risk checks
News/sentiment   Signal gen.       Broker API

Infrastructure
──────────────────────────────────────────────
Database  |  Scheduler  |  Monitor  |  Alerts</code></pre>

<h3>System Configuration</h3>
<pre><code class="language-python">CONFIG = {
    'symbols':             ['SPY','QQQ','AAPL','MSFT'],
    'max_position_pct':   0.25,
    'max_portfolio_risk': 0.02,
    'signal_threshold':   0.58,
    'cost_bps':           5,
    'retrain_days':       30,
    'data_source':        'schwab',
    'paper_trading':      True      # always start in paper mode
}

def load_config(path='config.yaml'):
    import yaml
    with open(path) as f:
        return yaml.safe_load(f)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Separate data, signal, and execution layers — each can fail without cascading</li>
    <li>Always start in paper trading mode — validate live behavior before risking capital</li>
    <li>Every system parameter should be in a config file, never hardcoded</li>
    <li>Build for failure: every component should handle errors gracefully and alert you</li>
  </ul>
</div>`
}
,{
  id:"9.2", module:9, tier:"pro", duration:60,
  title:"IBKR API Integration",
  audio:"/audio/course-9-2.mp3", video:null,
  content:`<h2>IBKR API Integration</h2>
<p class="lesson-intro">Interactive Brokers provides one of the best APIs for retail algorithmic traders — access to real-time data, options chains, and order execution across global markets.</p>

<h3>Connecting with ib_async</h3>
<pre><code class="language-python">from ib_async import IB, Stock, MarketOrder, LimitOrder
import asyncio

ib = IB()

async def connect():
    await ib.connectAsync('127.0.0.1', 7497, clientId=1)
    print(f'Connected: {ib.isConnected()}')

asyncio.run(connect())</code></pre>

<h3>Market Data and Orders</h3>
<pre><code class="language-python">async def get_quote(symbol):
    contract = Stock(symbol, 'SMART', 'USD')
    await ib.qualifyContractsAsync(contract)
    ticker = ib.reqMktData(contract)
    await asyncio.sleep(2)
    return ticker

async def place_order(symbol, action, qty, limit_price=None):
    contract = Stock(symbol, 'SMART', 'USD')
    await ib.qualifyContractsAsync(contract)
    order = (LimitOrder(action, qty, limit_price)
             if limit_price else MarketOrder(action, qty))
    trade = ib.placeOrder(contract, order)
    await asyncio.sleep(1)
    print(f'Order: {trade.orderStatus.status}')
    return trade</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Use ib_async with async/await for clean, non-blocking code</li>
    <li>Always qualify contracts before requesting data or placing orders</li>
    <li>Paper trading port 7497; live trading port 7496 — start with paper always</li>
    <li>Limit market data subscriptions — IBKR caps concurrent data streams by account tier</li>
  </ul>
</div>`
}
,{
  id:"9.3", module:9, tier:"pro", duration:55,
  title:"Order Management &amp; Execution",
  audio:"/audio/course-9-3.mp3", video:null,
  content:`<h2>Order Management &amp; Execution</h2>
<p class="lesson-intro">Execution quality directly impacts returns. The difference between a market order and a well-designed limit order strategy can be 2-5 bps per trade — 5-12% annually for active strategies.</p>

<h3>Order Manager</h3>
<pre><code class="language-python">class OrderManager:
    def __init__(self, ib_client, config):
        self.ib, self.config = ib_client, config
        self.open_orders = {}

    async def execute_signal(self, symbol, signal, portfolio_value):
        current_pos = self.get_position(symbol)
        target_pos  = self.compute_target(signal, portfolio_value, symbol)
        delta       = target_pos - current_pos
        if abs(delta) &lt; 1: return None

        action  = 'BUY' if delta &gt; 0 else 'SELL'
        qty     = abs(int(delta))
        quote   = await self.get_quote(symbol)
        mid     = (quote.bid + quote.ask) / 2
        order   = LimitOrder(action, qty, round(mid, 2))
        trade   = self.ib.placeOrder(self.get_contract(symbol), order)
        self.open_orders[symbol] = trade
        return trade

    def compute_target(self, signal, nav, symbol):
        if abs(signal - 0.5) &lt; 0.08: return 0
        price     = self.get_price(symbol)
        max_value = nav * self.config['max_position_pct']
        return int(max_value / price) * (1 if signal &gt; 0.5 else -1)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Midpoint limit orders save 1-2 bps vs market orders for liquid ETFs</li>
    <li>Compute delta between current and target position to minimize unnecessary trades</li>
    <li>Set a minimum trade size (1 share) to avoid micro-adjustments that generate costs</li>
    <li>Cancel stale limit orders that have not filled within 5 minutes</li>
  </ul>
</div>`
}
,{
  id:"9.4", module:9, tier:"pro", duration:50,
  title:"Real-Time Data Pipelines",
  audio:"/audio/course-9-4.mp3", video:null,
  content:`<h2>Real-Time Data Pipelines</h2>
<p class="lesson-intro">A live trading system needs fresh data every minute or second — not the 15-minute delayed snapshots used in backtesting. Building a reliable real-time pipeline requires handling dropped connections, stale data, and market hours correctly.</p>

<h3>Real-Time Quote Stream</h3>
<pre><code class="language-python">from datetime import datetime
from ib_async import IB, Stock

class RealTimeDataPipeline:
    def __init__(self):
        self.ib     = IB()
        self.quotes = {}

    async def start(self, symbols):
        await self.ib.connectAsync('127.0.0.1', 7497, clientId=2)
        for sym in symbols:
            contract = Stock(sym, 'SMART', 'USD')
            await self.ib.qualifyContractsAsync(contract)
            ticker = self.ib.reqMktData(contract)
            ticker.updateEvent += lambda t, s=sym: self.on_quote(t, s)

    def on_quote(self, ticker, symbol):
        if ticker.last and ticker.last &gt; 0:
            self.quotes[symbol] = {
                'price': ticker.last,
                'bid':   ticker.bid,
                'ask':   ticker.ask,
                'time':  datetime.now()
            }

    def is_stale(self, symbol, max_seconds=60):
        q = self.quotes.get(symbol)
        if not q: return True
        return (datetime.now() - q['time']).seconds &gt; max_seconds</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Event-driven callbacks (updateEvent) are more efficient than polling for real-time data</li>
    <li>Always check data staleness before generating signals — stale data means wrong decisions</li>
    <li>Reconnect automatically on disconnect — IBKR sessions drop without warning</li>
    <li>Store raw ticks to a database for debugging and strategy improvement</li>
  </ul>
</div>`
}
,{
  id:"9.5", module:9, tier:"pro", duration:55,
  title:"Risk Management in Production",
  audio:"/audio/course-9-5.mp3", video:null,
  content:`<h2>Risk Management in Production</h2>
<p class="lesson-intro">In live trading, a bad trade is real money gone. Production risk management means automated circuit breakers, position limits, and daily loss controls that execute without human intervention.</p>

<h3>Risk Controller</h3>
<pre><code class="language-python">class RiskController:
    def __init__(self, config, broker):
        self.config    = config
        self.broker    = broker
        self.daily_pnl = 0.0
        self.halted    = False

    def check_pre_trade(self, symbol, size_dollars, portfolio_value):
        if self.halted:
            return False, 'System halted — daily loss limit reached'
        pos_pct = size_dollars / portfolio_value
        if pos_pct &gt; self.config['max_position_pct']:
            return False, f'Position {pos_pct:.1%} exceeds limit'
        return True, 'OK'

    def update_pnl(self, trade_pnl):
        self.daily_pnl += trade_pnl
        pnl_pct = self.daily_pnl / self.broker.get_nav()
        if pnl_pct &lt; -self.config['max_portfolio_risk']:
            self.halted = True
            self.broker.cancel_all_orders()
            self.broker.flatten_all_positions()
            self.send_alert(f'HALT: Daily loss {pnl_pct:.1%} exceeded')</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Hard daily loss limit (2% of NAV) triggers automatic halt and position flattening</li>
    <li>Pre-trade checks prevent position concentration and runaway trading</li>
    <li>The risk controller must be called before every order — no exceptions</li>
    <li>Log every risk event with timestamp and reason for post-mortems</li>
  </ul>
</div>`
}
,{
  id:"9.6", module:9, tier:"pro", duration:50,
  title:"Monitoring, Logging &amp; Alerting",
  audio:"/audio/course-9-6.mp3", video:null,
  content:`<h2>Monitoring, Logging &amp; Alerting</h2>
<p class="lesson-intro">A live trading system running unattended can lose money silently if something goes wrong. Professional monitoring means you know within seconds when anything abnormal happens.</p>

<h3>Structured Logging</h3>
<pre><code class="language-python">import logging, json
from datetime import datetime

class TradingLogger:
    def __init__(self, log_file='trading.log'):
        logging.basicConfig(filename=log_file, level=logging.INFO)
        self.logger = logging.getLogger('trading')

    def log_signal(self, symbol, prob, signal, iv_rank):
        self.logger.info(json.dumps({
            'event': 'signal', 'symbol': symbol,
            'prob_up': prob, 'signal': signal, 'iv_rank': iv_rank,
            'ts': datetime.now().isoformat()
        }))

    def log_trade(self, symbol, action, qty, price):
        self.logger.info(json.dumps({
            'event': 'trade', 'symbol': symbol,
            'action': action, 'qty': qty, 'price': price,
            'ts': datetime.now().isoformat()
        }))</code></pre>

<h3>Telegram Alerts</h3>
<pre><code class="language-python">import requests

def send_alert(message, bot_token, chat_id):
    url = f'https://api.telegram.org/bot{bot_token}/sendMessage'
    requests.post(url, json={'chat_id': chat_id, 'text': message})

send_alert('TRADE: BUY 10 SPY @ $450.25 | P(up)=0.62', BOT_TOKEN, CHAT_ID)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Log every signal, trade, and risk event as structured JSON for easy analysis</li>
    <li>Telegram alerts give real-time visibility into system behavior from your phone</li>
    <li>Monitor data staleness, connection status, and order fill rates continuously</li>
    <li>Alert on positive events too (new trades, daily PnL) — silence is suspicious</li>
  </ul>
</div>`
}
,{
  id:"9.7", module:9, tier:"pro", duration:55,
  title:"From Backtest to Live — Closing the Gap",
  audio:"/audio/course-9-7.mp3", video:null,
  content:`<h2>From Backtest to Live — Closing the Gap</h2>
<p class="lesson-intro">Most strategies perform worse in live trading than in backtesting. Understanding why — and systematically closing the gap — is what separates profitable systematic traders from those who burn through capital learning the hard way.</p>

<h3>Common Causes of Degradation</h3>
<pre><code># 1. Execution slippage (model assumed mid, got worse fill)
#    Fix: use bid for sells, ask for buys in backtest

# 2. Signal lag (data arrives later than assumed)
#    Fix: add 1-bar delay between signal generation and execution

# 3. Lookahead bias missed in complex feature pipelines
#    Fix: code review every feature; verify no forward-looking data

# 4. Overfitting to the backtest period
#    Fix: walk-forward validation with out-of-sample test period

# 5. Regime change (model trained pre-2022, tested in 2022 inflation)
#    Fix: monitor IC monthly; retrain when IC drops below 0.02

# 6. Transaction cost underestimation
#    Fix: calibrate cost model using actual paper trade fills</code></pre>

<h3>Paper Trading Validation</h3>
<pre><code class="language-python">def compare_paper_to_backtest(paper_trades_df, backtest_returns):
    paper_ret = paper_trades_df['pnl'].sum() / paper_trades_df['capital'].iloc[0]
    bt_ret    = backtest_returns.iloc[-60:].sum()
    ratio     = paper_ret / bt_ret if bt_ret != 0 else 0
    print(f'Paper / Backtest ratio: {ratio:.2f}')
    # Target: &gt; 0.70 before going live with real capital</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Paper trade for 30-60 days before going live — capture real execution data</li>
    <li>Target paper/backtest return ratio above 0.70 before risking real capital</li>
    <li>Monitor IC monthly in live trading — regime shifts degrade models silently</li>
    <li>The biggest gap sources: execution lag, cost underestimation, and regime change</li>
  </ul>
</div>`
}
,{
  id:"9.8", module:9, tier:"pro", duration:55,
  title:"Portfolio Management &amp; Rebalancing",
  audio:"/audio/course-9-8.mp3", video:null,
  content:`<h2>Portfolio Management &amp; Rebalancing</h2>
<p class="lesson-intro">Running multiple strategies across multiple assets requires portfolio-level thinking. This lesson covers target-weight rebalancing, correlation management, and optimal rebalancing frequency.</p>

<h3>Target Weight Rebalancing</h3>
<pre><code class="language-python">def compute_rebalance_trades(current_positions, target_weights, prices, nav):
    trades = []
    for symbol, target_wt in target_weights.items():
        price       = prices[symbol]
        current_val = current_positions.get(symbol, 0) * price
        target_val  = nav * target_wt
        delta_shares = int((target_val - current_val) / price)
        if abs(delta_shares) &gt; 0:
            trades.append({
                'symbol':  symbol,
                'action':  'BUY' if delta_shares &gt; 0 else 'SELL',
                'shares':  abs(delta_shares)
            })
    return trades

def dynamic_weights(ml_signals, max_weight=0.30):
    raw   = {s: max(0, abs(sig-0.5)*2) for s,sig in ml_signals.items()}
    total = sum(raw.values()) or 1
    return {s: min(v/total, max_weight) for s,v in raw.items()}</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Rebalance weekly or when positions drift &gt; 5% from target — not daily</li>
    <li>Weight by signal confidence &times; inverse volatility for optimal risk allocation</li>
    <li>Cap any single position at 25-30% regardless of signal strength</li>
    <li>Track portfolio correlation — correlated positions provide less diversification benefit</li>
  </ul>
</div>`
}
,{
  id:"9.9", module:9, tier:"pro", duration:40,
  title:"Regulatory &amp; Compliance Basics",
  audio:"/audio/course-9-9.mp3", video:null,
  content:`<h2>Regulatory &amp; Compliance Basics</h2>
<p class="lesson-intro">Algorithmic trading in the US is regulated. Understanding the rules that apply to individual traders — pattern day trader rules, wash sale rules, and reporting requirements — keeps you compliant and avoids costly surprises.</p>

<h3>Pattern Day Trader Rule</h3>
<p>If you execute 4 or more day trades in a 5-business-day period using a margin account with less than $25,000, your account is flagged as a Pattern Day Trader and restricted. Strategies that trade daily with smaller accounts must use cash accounts or consider non-US regulated brokers.</p>
<pre><code class="language-python">def count_day_trades(trades_df, days=5):
    trades_df['is_dt'] = trades_df['entry_date'] == trades_df['exit_date']
    return trades_df['is_dt'].rolling(f'{days}D').sum().max()</code></pre>

<h3>Wash Sale Rule &amp; Record Keeping</h3>
<p>You cannot claim a tax loss if you repurchase the same or substantially identical security within 30 days before or after the sale. Keep complete records of all trades including: date/time, symbol, price, quantity, strategy name, and the signal that triggered the trade. This is required for capital gains calculation.</p>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Accounts under $25K in a margin account face the Pattern Day Trader restriction</li>
    <li>Wash sale rule disallows tax losses on round trips within 30 days</li>
    <li>Keep complete trade records including the signal that generated each trade</li>
    <li>This is educational — consult a licensed financial advisor for personal legal/tax advice</li>
  </ul>
</div>`
}
,{
  id:"9.10", module:9, tier:"pro", duration:120,
  title:"Capstone — Deploy Your Live Trading Bot",
  audio:"/audio/course-9-10.mp3", video:null,
  content:`<h2>Capstone — Deploy Your Live Trading Bot</h2>
<p class="lesson-intro">This is the final capstone of the Pro tier. You will assemble every component from Modules 5-9 into a complete live trading bot: real-time data, ML signals, risk management, execution, and monitoring.</p>

<h3>Complete Bot</h3>
<pre><code class="language-python">class LiveTradingBot:
    def __init__(self, config_path='config.yaml'):
        self.config  = load_config(config_path)
        self.ib      = IB()
        self.data    = RealTimeDataPipeline()
        self.risk    = RiskController(self.config, self.ib)
        self.orders  = OrderManager(self.ib, self.config)
        self.logger  = TradingLogger()
        self.models  = {}

    async def start(self):
        await self.ib.connectAsync('127.0.0.1', 7497, clientId=1)
        await self.data.start(self.config['symbols'])
        self.load_models()
        print('Bot started in paper trading mode')
        await self.run_loop()

    async def run_loop(self):
        while True:
            if self.is_market_hours():
                for sym in self.config['symbols']:
                    if not self.data.is_stale(sym):
                        await self.process_symbol(sym)
            await asyncio.sleep(60)

    async def process_symbol(self, sym):
        features = self.build_features(sym)
        prob_up  = self.models[sym].predict_proba(features)[0, 1]
        nav      = float(self.ib.accountValues()['NetLiquidation'])
        ok, _    = self.risk.check_pre_trade(sym, nav*0.20, nav)
        if not ok: return
        signal   = 1 if prob_up &gt; 0.58 else -1 if prob_up &lt; 0.42 else 0
        self.logger.log_signal(sym, prob_up, signal, 0)
        if signal != 0:
            await self.orders.execute_signal(sym, prob_up, nav)</code></pre>

<h3>Daily Schedule</h3>
<pre><code class="language-python">import schedule, time

def daily_tasks(bot):
    bot.retrain_if_needed()
    bot.generate_daily_report()
    bot.check_model_health()

schedule.every().day.at('09:00').do(daily_tasks, bot=bot)
while True:
    schedule.run_pending()
    time.sleep(60)</code></pre>

<div class="lesson-key">
  <h4>Key Takeaways</h4>
  <ul>
    <li>Always run in paper trading mode first — validate behavior before risking capital</li>
    <li>The event loop checks every minute: stale data? risk blocked? signal? execute.</li>
    <li>Daily tasks: retrain check, performance report, model health monitoring</li>
    <li>Congratulations — you have completed the Pro tier and built a production-ready ML trading system!</li>
  </ul>
</div>`
}

]; // end window.COURSE_LESSONS
