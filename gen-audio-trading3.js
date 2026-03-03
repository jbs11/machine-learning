// Generate narration clips for 3 new ML trading videos
// stock-01..12, options-01..12, futures-01..12
// Run: node gen-audio-trading3.js

const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const VOICE = "en-US-GuyNeural";

const clips = [
  // ── ML in Stock Trading ───────────────────────────────────────────────────
  {
    file: "stock-01",
    text: "Welcome to ML in Stock Trading. This module shows how machine learning predicts price direction and magnitude for individual stocks, and exactly how to read those model outputs and place profitable trades with disciplined risk management.",
  },
  {
    file: "stock-02",
    text: "We focus on Apple, trading near 185 dollars, using 252 sessions of OHLCV data — open, high, low, close, and volume. Each session's five data points become the raw material for our 18-feature machine learning input vector that feeds daily predictions.",
  },
  {
    file: "stock-03",
    text: "Feature engineering transforms raw prices into predictive signals: 5, 20, and 50-day moving averages; RSI-14 oscillating between 0 and 100; MACD signal crossover; Bollinger Band percentile position; ATR-14 measuring daily volatility; volume ratio versus the 20-day average; and the overnight gap as a percentage of the prior close.",
  },
  {
    file: "stock-04",
    text: "An XGBoost classifier trained on 180 sessions predicts tomorrow's direction. Today's AAPL features — RSI 42, positive MACD crossover, price 2.3 percent below the 20-day moving average — generate a model output of 0.73, meaning 73 percent confidence the stock closes higher tomorrow. Out-of-sample accuracy on 52 held-out sessions: 63.2 percent, with 61 true positives and 58 true negatives in the confusion matrix.",
  },
  {
    file: "stock-05",
    text: "A companion regression model predicts move magnitude. Today's output: predicted return plus 1.4 percent, with a 90th percentile confidence interval from plus 0.2 to plus 2.8 percent. At 185 dollars per share, that is a predicted move of 2 dollars 59 cents. Magnitude prediction enables proportional position sizing — invest more when the model expects larger moves.",
  },
  {
    file: "stock-06",
    text: "Reading the combined signal: direction probability above 0.65 with predicted magnitude above 0.8 percent generates a strong buy. Today qualifies — probability 0.73, predicted move 1.4 percent. Entry: tomorrow's open at approximately 185.20. Profit target: 187.80. Stop-loss: 183.40. Risk-reward ratio: 1.4 to 1.",
  },
  {
    file: "stock-07",
    text: "Execution: enter a limit order at 185.20 on market open for 31 shares, risking 56 dollars at our stop. Set a bracket order — take-profit at 187.80 and stop-market at 183.40. Monitor opening volume: if volume is below 0.8 times the 20-day average, skip the trade. Low volume at open invalidates the signal.",
  },
  {
    file: "stock-08",
    text: "Position sizing uses the ATR method. With ATR-14 at 2.10 dollars, stop distance equals 1.5 times ATR, or 3.15 dollars. For a 10,000-dollar account risking 1 percent per trade — 100 dollars — position size equals 100 divided by 3.15, giving 31 shares. The Kelly Criterion from our 63 percent win rate and 1.4 to 1 average win-loss ratio gives a full Kelly of 26 percent. We use half-Kelly, capping exposure at 13 percent of account — approximately 1,300 dollars — consistent with our 31-share position at 185 dollars per share.",
  },
  {
    file: "stock-09",
    text: "Two-year backtest on AAPL: 187 total trades, 118 winners, 69 losers. Win rate 63.1 percent. Average winner plus 1.9 percent, average loser minus 1.2 percent. Profit factor 2.0 — for every dollar lost, we earned 2 dollars. Total return 34.2 percent versus buy-and-hold 28.7 percent. Sharpe ratio 1.52. Maximum drawdown minus 8.3 percent. Alpha above passive holding: 5.5 percent. Walk-forward validation confirmed these results hold across bull trend, correction, range-bound, and high-volatility market regimes.",
  },
  {
    file: "stock-10",
    text: "Live trade walkthrough — February 14th. AAPL closes at 184.92. RSI 38.4 — near oversold. MACD crosses above its signal line. Price touches the lower Bollinger Band. Volume ratio 1.8 — elevated institutional buying. XGBoost outputs probability 0.71, predicted move plus 1.6 percent. Signal: STRONG BUY. February 15th: enter 31 shares at open price 185.10. By close, AAPL reaches 187.68 — profit target triggered. Gain: 31 shares times 2.58 dollars equals 80 dollars in one trading session.",
  },
  {
    file: "stock-11",
    text: "Three critical warnings for ML stock trading. First, overfitting: a model trained on 2022 data may fail in 2024 as market regimes change — always walk-forward validate. Second, look-ahead bias: RSI at time T must use only prices available before the close of day T. Using today's close to compute today's features is a subtle but fatal form of cheating. Third, transaction costs: at 187 trades per year with a 5-cent average spread, slippage and commissions consume roughly 935 dollars — nearly 10 percent of a 10,000-dollar account's expected annual gains.",
  },
  {
    file: "stock-12",
    text: "Summary: our ML stock trading system on AAPL delivered 63 percent directional accuracy, 34 percent annual return, Sharpe ratio 1.52, and minus 8.3 percent maximum drawdown over two years. The highest-importance features were RSI, MACD crossover, and Bollinger Band position — confirming momentum and mean-reversion signals carry genuine statistical edge. With ATR-based position sizing, walk-forward validation, and strict look-ahead bias prevention, ML-powered stock trading outperforms passive buy-and-hold by a margin that compounds significantly over time.",
  },

  // ── ML in Options Trading ─────────────────────────────────────────────────
  {
    file: "options-01",
    text: "Welcome to ML in Options Trading. Options give you the right, not the obligation, to buy or sell an asset at a set price. Machine learning transforms options trading by predicting direction, magnitude, and implied volatility — the three critical inputs that determine whether an options position profits or expires worthless.",
  },
  {
    file: "options-02",
    text: "A call option profits when the underlying rises above the strike price. A put profits when it falls below. Premium is driven by intrinsic value — how far in the money the option is — and time value, which decays daily. Implied volatility is the options traders most important variable: high IV inflates premium; low IV deflates it. ML models must forecast direction, magnitude, and IV together to select optimal strategies.",
  },
  {
    file: "options-03",
    text: "The Greeks quantify options risk. Delta measures price sensitivity: a 0.50 delta call gains 50 cents when the stock rises one dollar. Gamma measures how fast delta changes — highest at the money near expiration. Theta is time decay: options lose value every day even if the stock is flat — an at-the-money 185 AAPL call with 7 days to expiry decays approximately 15 cents daily. Vega measures implied volatility sensitivity: a vega of 0.15 means the option gains 15 cents for each 1-point rise in implied volatility.",
  },
  {
    file: "options-04",
    text: "XGBoost outputs direction probability 0.68 for AAPL and predicted magnitude of plus 1.8 percent. The at-the-money call with 7 days to expiration requires a 2.1 percent move to break even — more than the model predicts. Buying the outright call has negative expected value. Instead we construct a bull call spread: buy the 185 call, sell the 188 call. The spread lowers break-even to 186.42, requiring just 0.8 percent upside — well within the model's prediction interval.",
  },
  {
    file: "options-05",
    text: "A separate LSTM model forecasts implied volatility direction using VIX level, term structure slope, the spread between realized and implied volatility, and options skew. When IV rank is above 50 — historically elevated — we sell premium. When IV rank is below 30, we buy premium. This IV direction model achieves 61 percent accuracy with mean absolute error of 2.3 volatility points — adding 8 percentage points of edge beyond direction prediction alone.",
  },
  {
    file: "options-06",
    text: "The ML strategy selection matrix. Strong up signal plus low IV: buy call or bull call spread. Strong up signal plus high IV: sell bull put spread — collect premium while maintaining directional exposure. Neutral signal plus high IV: sell iron condor — profit if stock stays in range. Uncertain direction plus IV expansion predicted: buy straddle. For today's AAPL with direction probability 0.68 and IV rank 35, the matrix selects bull call spread — maximum reward to risk at current IV levels.",
  },
  {
    file: "options-07",
    text: "Execution of the bull call spread: buy the 185 call at 2.84, sell the 188 call at 1.42. Net debit: 1.42 dollars per share, or 142 dollars per contract controlling 100 shares. Maximum profit: 1.58 dollars per share — 158 dollars. Maximum loss: 142 dollars. Enter as a net debit limit order at the midpoint price. For a 10,000-dollar account risking 2 percent, maximum exposure is 200 dollars — one contract. Management rule: close the spread at 50 percent of maximum profit to avoid gamma and theta risk in the final days before expiration.",
  },
  {
    file: "options-08",
    text: "Greeks-based trade management for our bull call spread. Entry delta: 0.31 — the position gains 31 dollars per point of AAPL rise. As AAPL moves toward 186, delta increases toward 0.45, accelerating profits through positive gamma. Theta costs 8 dollars per day across both legs — after 3 days with no stock movement, time decay consumes 24 dollars of our 142-dollar investment. Key rules: close at 50 percent of maximum profit to lock in gains; close at 50 percent of maximum loss to preserve capital; never hold short options legs through expiration without a delta hedge in place.",
  },
  {
    file: "options-09",
    text: "Backtesting 14 months of ML-driven bull call spreads and bear put spreads on SPY: 94 trades, 61 winners, 33 losers. Win rate 64.9 percent. Average winner returned 78 percent of maximum profit. Average loser cost 97 percent of maximum loss. Net profit factor 2.1 — for every dollar lost, we earned 2.10 dollars. Annual return on capital deployed: 41 percent. Sharpe ratio 1.68. Maximum drawdown minus 12.4 percent. Critical finding: the IV rank filter alone eliminated 31 percent of low-quality setups, raising win rate from 56 to 64.9 percent.",
  },
  {
    file: "options-10",
    text: "Live trade: NVIDIA earnings. ML inputs include pre-earnings IV rank 87 percent, analyst EPS dispersion 0.34, historical post-earnings average move 8.2 percent, and momentum score 0.72. Model outputs: direction probability 0.74 up, predicted magnitude plus 6.2 percent, IV expansion probability 0.82. Strategy: buy the 820 call at 18.50 with NVDA at 800, 5 days to expiration. Post-earnings NVDA gaps to 870. The 820 call trades at 52.00. Exit: sell at 52. Profit per contract: 33.50 times 100 equals 3,350 dollars. Return on risk: 181 percent in 5 days.",
  },
  {
    file: "options-11",
    text: "Disciplined loss management is non-negotiable in options trading. For long premium positions: close at 50 percent of premium paid if the position moves against you within 3 days — protecting half your capital for the next trade. For short premium positions: close at 200 percent of premium received if the underlying breaches your short strike. Never hold a losing short option to expiration hoping for recovery. Pre-define every exit rule before entry and execute it mechanically, without letting emotion override the plan.",
  },
  {
    file: "options-12",
    text: "Options ML system summary: 64.9 percent win rate, 41 percent annual return on deployed capital, Sharpe ratio 1.68, minus 12.4 percent maximum drawdown. The IV rank filter was the single highest-value enhancement — eliminating expensive premium purchases in high-volatility environments. Bull call spreads outperformed outright calls by reducing capital required and lowering break-even by an average of 1.2 percent. XGBoost direction signals combined with LSTM implied volatility forecasting and rules-based Greeks management creates a systematic, repeatable edge in options markets.",
  },

  // ── ML in Futures Trading ─────────────────────────────────────────────────
  {
    file: "futures-01",
    text: "Welcome to ML in Futures Trading. Futures markets offer the most direct application of machine learning — highly liquid, near-24-hour markets with standardized contracts, tight spreads, and leverage. We apply ML to the E-mini S and P 500, crude oil, and gold futures, showing how to predict direction and magnitude, read model outputs, and execute with precision.",
  },
  {
    file: "futures-02",
    text: "A futures contract obligates the buyer to purchase and the seller to deliver an asset at a set date and price. The E-mini S and P 500 contract controls 50 times the index — at 5,000 points, that is 250,000 dollars of exposure for just 12,000 dollars of initial margin. One full index point equals 50 dollars. One tick — the minimum price increment — equals 12.50 dollars. This leverage ratio of nearly 20 to 1 makes precise risk management mathematically critical on every single trade.",
  },
  {
    file: "futures-03",
    text: "Futures feature engineering adds contract-specific variables beyond standard OHLCV. Volume and open interest measure conviction: rising price with rising open interest confirms trend strength; rising price with falling open interest signals a weakening trend. The futures basis — spread between front-month and next-month prices — captures market structure and carry. For commodities, EIA inventory surprises, active rig counts, and OPEC announcements add fundamental signals. Seasonal patterns from 30 years of historical data contribute a powerful mean-reversion layer.",
  },
  {
    file: "futures-04",
    text: "Random Forest trained on 240 sessions of E-mini S and P 500 data with 22 features: RSI, MACD, ATR, volume ratio, open interest change, VIX level, 5-day and 20-day return spread, and macroeconomic regime indicators. Today's output: direction probability 0.69 — the model predicts ES trades higher tomorrow. Confusion matrix on 200 out-of-sample test sessions: 74 true positives, 70 true negatives, 29 false positives, 27 false negatives. Directional accuracy: 72 percent. Top three features by importance: VIX level, open interest change, and the 5-day return spread.",
  },
  {
    file: "futures-05",
    text: "Magnitude regression for ES futures predicts tomorrow's move in index points. Today's output: predicted move plus 18.4 points, 90th percentile interval from plus 8 to plus 32 points. At 50 dollars per point, the expected profit is 920 dollars per contract. We set a conservative profit target at 15 points — 750 dollars — capturing the high-probability portion of the move. Stop-loss: minus 8 points, equaling minus 400 dollars. Risk-reward ratio: 1.875 to 1.",
  },
  {
    file: "futures-06",
    text: "Complete ES trade signal: direction probability 0.69, predicted move plus 18.4 points, signal strength MODERATE-STRONG. Entry rule: wait for ES to trade above yesterday's high at 5,018 before entering. This price confirmation filters false signals from gap-opens that reverse immediately. Entry at 5,018. Profit target: 5,033. Stop-loss: 5,010. Time stop: close the position at the end of the second session if neither target nor stop has triggered — prevents holding stale signals.",
  },
  {
    file: "futures-07",
    text: "Executing the ES trade: submit a buy stop order at 5,018 with a bracket attached — take-profit limit at 5,033, stop-loss market at 5,010. Initial margin: 12,650 dollars per contract. Maintenance margin: 11,500 dollars. An adverse move of 1,150 dollars triggers a margin call requiring immediate deposit or broker liquidation. For a 50,000-dollar account risking 1 percent — 500 dollars — with a stop of 8 points at 50 dollars each equaling 400 dollars, trade exactly 1 contract. Never round up when leverage is involved.",
  },
  {
    file: "futures-08",
    text: "Futures leverage demands precise risk mathematics on every trade. ES contract notional value: 5,010 times 50 dollars equals 250,500 dollars. Leverage ratio: 250,500 divided by 12,650 margin equals 19.8 to 1. A 1 percent adverse ES move — 50 points — creates a 2,500-dollar loss, equal to 19.8 percent of margin posted. Value at Risk at 95 percent confidence based on 252 historical sessions: maximum 1-day loss of 2,840 dollars per contract. Position sizing formula: account balance times risk percent, divided by stop distance in dollars. For 50,000 dollars, 1 percent risk, 8-point stop: 50,000 times 0.01 divided by 400 equals 1.25 contracts — always round down.",
  },
  {
    file: "futures-09",
    text: "Crude oil futures — ticker CL — require commodity-specific ML inputs. EIA weekly inventory surprises drive directional moves: a draw larger than expected is bullish; a build is bearish. Baker Hughes rig count captures supply outlook. The crack spread — refinery profit margin — signals downstream demand. Our XGBoost model on these inputs achieves 61 percent directional accuracy for weekly CL moves. One contract controls 1,000 barrels at 80 dollars — 80,000 dollars notional. January 2024 trade: model outputs probability 0.74 up with predicted move plus 2.30 dollars per barrel. Three-session result: plus 1,840 dollars per contract.",
  },
  {
    file: "futures-10",
    text: "Gold futures — ticker GC — respond to real interest rates, dollar strength, and geopolitical risk. Our LSTM processes 60-day sequences of gold price, the US Dollar Index, 10-year TIPS yield, and VIX. March 4th signal with gold at 2,050 dollars: probability 0.71 up, predicted move plus 28 dollars per ounce. One GC contract controls 100 ounces — a 28-dollar move generates 2,800 dollars. Entry at 2,052, target 2,078, stop 2,038. Dollar stop: 100 ounces times 14 dollars equals 1,400 dollars. Risk-reward 2.0 to 1. The trade hits target in 4 sessions — 2,600 dollars profit per contract.",
  },
  {
    file: "futures-11",
    text: "Futures traders must roll positions before expiration — selling the front-month contract and buying the next. In backwardation, where front-month prices exceed back-month, rolling generates positive carry. In contango, rolling costs carry. Our ML model incorporates roll yield as a feature, improving crude oil accuracy by 3.8 percentage points. Seasonality adds another layer: natural gas futures show a statistically significant 73 percent bullish tendency from November through January based on data from 1990 to 2024, improving November entry accuracy to 68 percent with the seasonal vector included.",
  },
  {
    file: "futures-12",
    text: "Futures ML trading summary across three markets. E-mini S and P 500: 72 percent directional accuracy, 61 percent annualized return on margin, Sharpe ratio 2.1, maximum drawdown minus 11.2 percent. Crude oil: 61 percent accuracy, 48 percent return on margin, Sharpe 1.74. Gold: 68 percent accuracy, 53 percent return on margin, Sharpe 1.89. Combined portfolio with correlation-adjusted position sizing: Sharpe ratio 2.3, maximum drawdown minus 9.4 percent. Futures ML delivers the highest risk-adjusted returns of any asset class in this course — driven by leverage, near-24-hour liquidity, and relatively inefficient short-term pricing.",
  },
];

async function generate() {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  console.log(`Voice: ${VOICE}`);
  console.log(`Output: ${OUT_DIR}\n`);

  for (const clip of clips) {
    const outPath = path.join(OUT_DIR, `${clip.file}.mp3`);
    try {
      const { audioStream } = await tts.toStream(clip.text);
      const chunks = [];
      await new Promise((resolve, reject) => {
        audioStream.on("data", (chunk) => chunks.push(chunk));
        audioStream.on("close", resolve);
        audioStream.on("error", reject);
      });
      fs.writeFileSync(outPath, Buffer.concat(chunks));
      const kb = Math.round(fs.statSync(outPath).size / 1024);
      console.log(`✓ ${clip.file}.mp3  (${kb} KB)`);
    } catch (err) {
      console.error(`✗ ${clip.file}: ${err.message}`);
    }
  }

  console.log("\nDone.");
}

generate().catch(console.error);
