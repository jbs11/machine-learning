// gen-tour-guy.js — regenerate all 24 tour audio clips using en-US-GuyNeural
// Segments 01-22 rewritten with deeper descriptions matching each visual.
// Segments 23-24 are new: Algorithms & Bots, and Asset Algos.
// SSML rate="-10%" gives a measured, deliberate pace with natural breathing room.
//
// Run:  node gen-tour-guy.js
// Output: public/audio/tour-01.mp3 ... tour-24.mp3
//
// After running, execute: node calc-tour-durations.js
// Copy the printed frame values into DashboardTour.jsx TOUR_CLIPS[]
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs   = require("fs");
const path = require("path");

const VOICE  = "en-US-GuyNeural";
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;

// Output to public/audio so Remotion's staticFile() can find them
const OUT = path.join(__dirname, "public", "audio");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Edge TTS via toStream() with rate option — SSML break tags are not supported
// and cause silent 0-byte responses. Natural pauses come from punctuation and
// the -10% rate which gives a slower, more deliberate delivery.
const S   = (text) => text;   // passthrough — toStream wraps prosody automatically
const BR  = "";                // clause boundary: rely on surrounding punctuation
const BRM = " ";               // sentence boundary: space before next sentence
const BRL = " ";               // section change: same, let period do the work

const clips = [

  // ── 01 · Dashboard Overview ────────────────────────────────────────────────
  // Vis01: node graph — Market Data at top, ML Engine + Options Data middle,
  // Signal Panel + GEX Chart + Flows + Fundamentals, Trade Decision at bottom.
  {
    id: "tour-01",
    text: S(
      `Welcome to the ML Trading Dashboard. ${BRL}` +
      `What you see on the right is the data architecture that powers everything you will learn in this tour. ${BR}` +
      `At the top, ${BR} raw market data streams in from live price feeds, ${BR} capturing every tick, ${BR} every bar, ${BR} and every volume reading across twenty-two of the most actively traded assets in the world. ${BRM}` +
      `That data splits into two parallel processing paths. ${BR}` +
      `On the left, ${BR} the Machine Learning Engine ingests historical price action, ${BR} computes dozens of technical features, ${BR} and runs an XGBoost ensemble model to generate a directional signal — ${BR} BUY, ${BR} SELL, ${BR} or HOLD — along with a probability score and a magnitude estimate. ${BRM}` +
      `On the right, ${BR} the Options Data pipeline pulls live gamma exposure readings, ${BR} real-time options flow, ${BR} and unusual institutional activity. ${BRM}` +
      `These two streams then converge into five analytical layers: ${BR} the Signal Panel, ${BR} the Gamma Exposure chart, ${BR} Option Flows, ${BR} Fundamental data, ${BR} and the Pre-Market Intelligence Hub. ${BRM}` +
      `All five flow into a single Trade Decision — ${BR} the point where machine learning, ${BR} options market structure, ${BR} and fundamental quality all align to give you the highest-probability setup the system can generate. ${BRL}` +
      `This tour will walk you through every one of those layers, ${BR} explain every chart, ${BR} and define every term. ${BR} Let's begin.`
    ),
  },

  // ── 02 · Live Trading — Asset Selector ────────────────────────────────────
  // Vis02: four animated group tabs — Index ETFs (cyan), Mag7 (green),
  // Futures (amber), Options Vehicles (purple) with asset chips inside.
  {
    id: "tour-02",
    text: S(
      `The Live Trading page is your primary command center, ${BR} and the asset selector at the top organizes every instrument the dashboard tracks into four color-coded groups. ${BRM}` +
      `The cyan group contains the Index ETFs: ${BR} SPY, ${BR} QQQ, ${BR} DIA, ${BR} and IWM. ${BR}` +
      `These four products represent the entire US equity market, ${BR} from the broad S-and-P 500 to the small-cap Russell 2000. ${BR}` +
      `When you want to read the macro environment before selecting an individual stock, ${BR} start here. ${BRM}` +
      `The green group is the Magnificent Seven, ${BR} the seven mega-cap technology companies that together represent more than thirty percent of the S-and-P 500 by weight: ${BR} Apple, ${BR} Microsoft, ${BR} NVIDIA, ${BR} Tesla, ${BR} Amazon, ${BR} Alphabet, ${BR} and Meta. ${BR}` +
      `These are the most actively traded and most heavily options-loaded stocks in the world, ${BR} making their GEX signals especially powerful. ${BRM}` +
      `The amber group covers Futures contracts — ${BR} ES and NQ, ${BR} the E-mini S-and-P 500 and NASDAQ 100 futures. ${BR}` +
      `These trade nearly twenty-four hours a day and are the first market to react to breaking news, ${BR} geopolitical events, ${BR} and after-hours earnings. ${BRM}` +
      `Click any group tab to filter the charts and signals to that category alone. ${BR}` +
      `Each group uses consistent color coding throughout every page of the dashboard, ${BR} so once you learn the color system, ${BR} you can navigate the entire platform at a glance.`
    ),
  },

  // ── 03 · Candlestick Chart ─────────────────────────────────────────────────
  // Vis03: animated candlestick with HIGH/BODY/LOW annotation callouts,
  // timeframe selector row at bottom (15m/1H/4H/1D/1W with 4H active).
  {
    id: "tour-03",
    text: S(
      `The candlestick chart is the foundation of technical analysis, ${BR} and every asset page in the dashboard is built around one. ${BRM}` +
      `As the candles draw in on the right, ${BR} notice the anatomy of each bar. ${BR}` +
      `The thick rectangle — called the body — shows the difference between the opening price and the closing price for that time period. ${BR}` +
      `A green body means the price closed higher than it opened — buyers were in control. ${BR}` +
      `A red body means the price closed lower — sellers were in control. ${BRM}` +
      `The thin vertical lines extending above and below the body are called wicks, or shadows. ${BR}` +
      `The upper wick shows the highest price reached during that period. ${BR}` +
      `The lower wick shows the lowest price reached. ${BR}` +
      `A long upper wick on a bearish candle, ${BR} for example, ${BR} tells you buyers pushed the price up during the period but sellers rejected that move and pushed it back down before the close — ${BR} a classic sign of selling pressure at resistance. ${BRM}` +
      `Below the chart you can see the timeframe selector row, ${BR} showing fifteen-minute, ${BR} one-hour, ${BR} four-hour, ${BR} daily, ${BR} and weekly options. ${BR}` +
      `The four-hour timeframe is highlighted as the default, ${BR} and it is generally the best starting point for swing trades. ${BR}` +
      `Use the fifteen-minute chart for intraday entries, ${BR} the daily chart to confirm the macro trend, ${BR} and always check that all three timeframes agree before entering a position.`
    ),
  },

  // ── 04 · ML Signal Panel ──────────────────────────────────────────────────
  // Vis04: ML pipeline strip (OHLCV → Feature Eng → XGBoost → Signal Output)
  // + three large cards: BUY (▲ green), SELL (▼ red), HOLD (◆ amber)
  {
    id: "tour-04",
    text: S(
      `To the right of every candlestick chart sits the ML Signal Panel — ${BR} the core output of the machine learning model. ${BRM}` +
      `At the top of the right panel, ${BR} you can see the full processing pipeline. ${BR}` +
      `Raw OHLCV data — ${BR} open, ${BR} high, ${BR} low, ${BR} close, ${BR} and volume — ${BR} flows into the Feature Engineering step, ${BR} where twenty-three technical indicators are computed, ${BR} including RSI, ${BR} MACD, ${BR} Average True Range, ${BR} Bollinger Band position, ${BR} and volume ratios. ${BRM}` +
      `Those features feed into the XGBoost model — ${BR} a gradient boosted decision tree algorithm trained on years of historical data. ${BR}` +
      `The model outputs one of three classifications, ${BR} shown as the three large signal cards below the pipeline. ${BRM}` +
      `BUY — shown in green — means the model's probability estimate for an upward move exceeds the confidence threshold. ${BR}` +
      `Act on BUY signals by looking for long entries, ${BR} call options, ${BR} or bullish spreads. ${BRM}` +
      `SELL — shown in red — means the model predicts a higher probability of a downward move. ${BR}` +
      `Act on SELL signals with short entries, ${BR} put options, ${BR} or bearish spreads. ${BRM}` +
      `HOLD — shown in amber — means the model sees conflicting or insufficient evidence. ${BR}` +
      `HOLD is not a failure — ${BR} it is the model telling you the risk-reward ratio does not meet the threshold for a high-quality trade. ${BR}` +
      `Respecting HOLD signals and staying out of low-conviction setups is one of the most important aspects of disciplined trading.`
    ),
  },

  // ── 05 · Probability Gauge ─────────────────────────────────────────────────
  // Vis05: gradient gauge bar animating from 0→78%, labeled (0% Low /
  // 65% Threshold / 100% High), + 6 stat tiles (Signal, Probability,
  // Magnitude, RSI, MACD, Conviction)
  {
    id: "tour-05",
    text: S(
      `Watch the confidence score gauge on the right as it fills from zero to seventy-eight percent. ${BRM}` +
      `Every signal from the ML model comes with this probability score — ${BR} a number from zero to one hundred representing how confident the algorithm is that the price will move in the predicted direction during the next period. ${BRM}` +
      `The gradient bar runs from red on the left, ${BR} through amber in the middle, ${BR} to green on the right. ${BR}` +
      `A white vertical line at sixty-five percent marks the conviction threshold. ${BR}` +
      `Signals above sixty-five percent are classified as high-conviction and are the most actionable. ${BR}` +
      `Signals between forty-five and sixty-five percent are moderate and should be confirmed with additional evidence from GEX and options flows before acting. ${BR}` +
      `Signals below forty-five percent suggest low model confidence and are generally best avoided. ${BRM}` +
      `Below the gauge, ${BR} the stat tiles show key supporting data. ${BR}` +
      `Probability shows the exact percentage. ${BR}` +
      `Magnitude shows the model's estimate of the expected price move size, ${BR} expressed as a percentage. ${BR}` +
      `A magnitude reading of plus two-point-four percent, for example, ${BR} means the model predicts a meaningful move — ${BR} large enough to be worth structuring a trade around. ${BRM}` +
      `RSI and MACD values are shown directly, ${BR} so you can see the technical inputs that are driving the current signal. ${BR}` +
      `And the Conviction label summarizes all of this into a simple HIGH, ${BR} MEDIUM, ${BR} or LOW classification, ${BR} making it fast to scan multiple assets at once.`
    ),
  },

  // ── 06 · Feature Drivers ──────────────────────────────────────────────────
  // Vis06: 8 animated horizontal bars — RSI(14), MACD, ATR, Bollinger Bands,
  // Volume Ratio, Trend Score, EMA Cross, Price Momentum — each with value label
  {
    id: "tour-06",
    text: S(
      `The Feature Drivers section reveals the inner workings of the machine learning model, ${BR} showing exactly which technical indicators are contributing most to the current signal. ${BRM}` +
      `Watch the bars animate in from left to right — ${BR} each bar's width represents the relative importance weight that the XGBoost model assigned to that feature for this asset at this moment in time. ${BRM}` +
      `RSI, ${BR} the Relative Strength Index, ${BR} leads the list at eighty-two percent weight. ${BR}` +
      `RSI measures price momentum on a scale of zero to one hundred. ${BR}` +
      `A reading above seventy signals overbought conditions, ${BR} while below thirty signals oversold. ${BR}` +
      `The current RSI of sixty-one-point-two is in the upper neutral zone — ${BR} bullish but not yet stretched. ${BRM}` +
      `MACD — Moving Average Convergence Divergence — is the second most influential feature, ${BR} showing a bullish crossover at seventy-four percent weight. ${BRM}` +
      `ATR, ${BR} the Average True Range, ${BR} measures current volatility. ${BR}` +
      `The model uses ATR both as a directional input and as a position-sizing guide — ${BR} higher ATR means larger expected moves and suggests smaller position sizes. ${BRM}` +
      `Bollinger Band position tells the model whether price is near the upper or lower band, ${BR} helping it identify mean-reversion versus breakout setups. ${BRM}` +
      `Volume Ratio, ${BR} Trend Score, ${BR} EMA Cross, ${BR} and Price Momentum fill out the remaining features. ${BR}` +
      `Together these eight indicators create a rich, ${BR} multi-dimensional view of price action that no single indicator alone could provide.`
    ),
  },

  // ── 07 · Signal Quality Checklist ─────────────────────────────────────────
  // Vis07: 8 checklist rows (7 green ✓, 1 red ✗ "No conflicting macro events")
  // + score card (7/8, HIGH QUALITY)
  {
    id: "tour-07",
    text: S(
      `Before entering any trade, ${BR} the Signal Quality Checklist gives you a rapid multi-factor readiness assessment. ${BRM}` +
      `Each row evaluates one independent dimension of the current trade setup. ${BR}` +
      `Watch them animate in one by one. ${BRM}` +
      `Trend aligned across timeframes — ${BR} green checkmark. ${BR}` +
      `This confirms that the fifteen-minute, ${BR} one-hour, ${BR} and four-hour charts all agree on direction. ${BRM}` +
      `Volume confirming the move — ${BR} green. ${BR}` +
      `Volume should always expand in the direction of a breakout. ${BR}` +
      `Without volume confirmation, ${BR} a price move is more likely to be a false breakout. ${BRM}` +
      `Options flows support direction — ${BR} green. ${BR}` +
      `This checks whether call or put volume is aligned with the ML signal direction. ${BRM}` +
      `Volatility within normal range — ${BR} green. ${BR}` +
      `Extremely high volatility can distort signals and increase the risk of whipsaw moves. ${BRM}` +
      `No conflicting macro events — ${BR} red X. ${BR}` +
      `This item is flagged because there is a Federal Reserve speech scheduled during the session, ${BR} which could override technical signals with macro volatility. ${BR}` +
      `The checklist is specifically designed to surface risks like this before you commit capital. ${BRM}` +
      `RSI not in extreme zone, ${BR} MACD crossover confirmed, ${BR} and price above the twenty-day moving average — ${BR} all green. ${BRM}` +
      `The score card on the right shows seven out of eight. ${BR}` +
      `A score this high represents a high-quality, ${BR} high-conviction setup. ${BR}` +
      `When you see a setup with six or more green checks and a strong ML probability, ${BR} that is the time to size your position with confidence.`
    ),
  },

  // ── 08 · Market Summary ────────────────────────────────────────────────────
  // Vis08: BULLISH badge, breadth gauge animating to 68%, four index tiles
  // (S&P 500 +1.2%, NASDAQ +1.8%, DOW +0.7%, VIX -1.1)
  {
    id: "tour-08",
    text: S(
      `The Market Summary page gives you a macro-level view of the entire market before you zoom into individual assets. ${BRM}` +
      `At the top left of the right panel, ${BR} the Market Direction badge reads BULLISH. ${BR}` +
      `This is the aggregated machine learning consensus across all twenty-two tracked assets. ${BR}` +
      `When the majority of the model's signals are pointing upward, ${BR} the dashboard declares BULLISH. ${BR}` +
      `When the majority are pointing downward, ${BR} it reads BEARISH. ${BR}` +
      `When the signals are evenly split, ${BR} it reads NEUTRAL — ${BR} signaling a rotational or indecisive market environment. ${BRM}` +
      `To the right of the badge, ${BR} the Market Breadth gauge is filling to sixty-eight percent. ${BR}` +
      `Breadth measures the percentage of tracked assets generating bullish signals. ${BR}` +
      `Sixty-eight percent bullish means that more than two-thirds of the portfolio universe is showing upward momentum — ${BR} a strong broad-based rally, ${BR} not a narrow one driven by just two or three names. ${BRM}` +
      `Broad participation is one of the most reliable signs of a healthy, ${BR} sustainable trend. ${BR}` +
      `When breadth contracts to below fifty percent even while major indexes are rising, ${BR} it is often a warning that the rally is narrowing and may be vulnerable to reversal. ${BRM}` +
      `Below the gauge, ${BR} the four index tiles show live readings for the S-and-P 500, ${BR} the NASDAQ, ${BR} the Dow Jones, ${BR} and the VIX. ${BR}` +
      `A falling VIX alongside rising indexes confirms the bullish picture — ${BR} volatility is declining as confidence builds.`
    ),
  },

  // ── 09 · ML Rankings Table ────────────────────────────────────────────────
  // Vis09: 8-row ranked table (NVDA 89% BUY +4.1%, TSLA 82% BUY +3.2%,
  // QQQ 76%, SPY 71%, AAPL 54% HOLD, BAC 48% HOLD, XOM 28% SELL, UNH 22%)
  {
    id: "tour-09",
    text: S(
      `The ML Rankings table, ${BR} shown on the right, ${BR} sorts every tracked asset from highest to lowest probability of an upward move, ${BR} giving you an instant prioritized list of where the best opportunities are right now. ${BRM}` +
      `Watch the rows populate and animate in from the top. ${BRM}` +
      `NVIDIA leads at eighty-nine percent probability — ${BR} a BUY signal with a predicted magnitude of plus four-point-one percent. ${BR}` +
      `That combination of extreme confidence and large expected move makes NVIDIA the highest-priority asset in the dashboard today. ${BRM}` +
      `Tesla follows at eighty-two percent, ${BR} also a BUY with plus three-point-two percent expected magnitude. ${BRM}` +
      `QQQ and SPY both carry strong BUY signals at seventy-six and seventy-one percent respectively, ${BR} confirming that the technology sector and the broad market are aligned. ${BRM}` +
      `Apple drops to fifty-four percent — ${BR} a HOLD. ${BR}` +
      `The model sees some upward probability but not enough to meet the high-conviction threshold. ${BR}` +
      `In a situation like this, ${BR} Apple is best passed over in favor of higher-conviction names. ${BRM}` +
      `At the bottom of the table, ${BR} ExxonMobil and UnitedHealth are both generating SELL signals at twenty-eight and twenty-two percent respectively. ${BR}` +
      `These assets are showing the weakest upward probability — ${BR} either consider avoiding long exposure or look at put strategies for defined-risk downside plays. ${BRM}` +
      `The color coding makes the table easy to scan at a glance — ${BR} green rows for BUY, ${BR} amber for HOLD, ${BR} and red for SELL.`
    ),
  },

  // ── 10 · Gamma Exposure — Concept ────────────────────────────────────────
  // Vis10: two side-by-side panels — Positive Gamma (green: dealers buy dips/
  // sell rallies → suppressed vol) and Negative Gamma (red: dealers amplify moves)
  {
    id: "tour-10",
    text: S(
      `The Gamma Exposure page introduces one of the most powerful — and least understood — forces in modern market structure. ${BRM}` +
      `Options market makers, ${BR} also called dealers, ${BR} are required to remain delta-neutral. ${BR}` +
      `That means they continuously buy or sell the underlying stock to offset the directional risk of the options they have sold. ${BR}` +
      `The rate at which they must adjust those hedges when price moves is called gamma. ${BRM}` +
      `Look at the two panels on the right. ${BR}` +
      `When dealers are in Positive Gamma, ${BR} shown on the left, ${BR} their hedging behavior actually creates a stabilizing force in the market. ${BR}` +
      `When the price drops, ${BR} they must buy the underlying to rebalance — ${BR} that buying cushions the fall. ${BR}` +
      `When the price rises, ${BR} they must sell — ${BR} that selling dampens the rally. ${BR}` +
      `The net effect is that price gets pinned in a range and volatility is suppressed. ${BRM}` +
      `Positive gamma environments are ideal for range-bound strategies like iron condors and covered calls. ${BRM}` +
      `When dealers flip into Negative Gamma, ${BR} shown on the right, ${BR} their hedging behavior does the opposite — ${BR} it amplifies price moves in both directions. ${BR}` +
      `When price drops, ${BR} dealers must sell more, ${BR} pushing it further down. ${BR}` +
      `When price rises, ${BR} dealers must buy more, ${BR} pushing it further up. ${BR}` +
      `This is when you see sharp, ${BR} fast moves and elevated volatility. ${BRM}` +
      `Knowing which gamma regime you are in before placing a trade can fundamentally change how you size your position and which strategy you select.`
    ),
  },

  // ── 11 · GEX Bar Chart ────────────────────────────────────────────────────
  // Vis11: animated SPY GEX bars, then SPOT/GAMMA WALL/FLIP LEVEL/PUT WALL
  // annotations appearing progressively
  {
    id: "tour-11",
    text: S(
      `Now you are looking at the GEX bar chart for SPY — ${BR} one of the most information-dense visuals on the entire dashboard. ${BRM}` +
      `Each bar on the horizontal axis represents a strike price, ${BR} ranging from five-seventy-five to six-oh-five. ${BR}` +
      `Green bars above the zero line indicate strikes where dealers hold net positive gamma — ${BR} their hedging will suppress price movement at those levels. ${BRM}` +
      `Red bars below the zero line indicate strikes where dealers are short gamma — ${BR} their hedging will amplify any move through those strikes. ${BRM}` +
      `Watch the four key annotations appear one by one. ${BRM}` +
      `First, ${BR} the dashed cyan vertical line marks the current spot price at five-ninety-one. ${BR}` +
      `Spot is where the market is trading right now — every other level is defined relative to it. ${BRM}` +
      `Next, ${BR} the Gamma Wall label appears at the five-ninety strike, ${BR} which carries the tallest green bar in the chart. ${BR}` +
      `This is the strike with the largest concentration of long dealer gamma. ${BR}` +
      `Price is magnetically attracted to the Gamma Wall in a low-volatility environment. ${BR}` +
      `Think of it as the ceiling — the level the market will struggle to break through without a catalyst. ${BRM}` +
      `The amber dashed line marks the Flip Level at five-eighty. ${BR}` +
      `This is the point where net dealer gamma crosses zero. ${BR}` +
      `Above the flip, ${BR} you are in positive gamma — calm, range-bound conditions. ${BR}` +
      `Below the flip, ${BR} you enter negative gamma territory — accelerating, volatile conditions. ${BRM}` +
      `Finally, ${BR} the Put Wall appears at the five-seventy-eight strike. ${BR}` +
      `This is where the largest concentration of put open interest sits, ${BR} and dealers must hedge aggressively there, ${BR} creating a natural price floor or support level.`
    ),
  },

  // ── 12 · Regime Badges & PCR ──────────────────────────────────────────────
  // Vis12: three animated regime cards (PINNED/TRENDING/BREAKOUT) +
  // PCR gauge animating to 1.18 with three labeled zones
  {
    id: "tour-12",
    text: S(
      `Every asset on the GEX page carries a Regime Badge — ${BR} a classification that tells you instantly what kind of market environment you are trading in right now. ${BRM}` +
      `Watch the three regime cards animate in on the right. ${BRM}` +
      `PINNED — marked with the pin emoji and outlined in cyan — means price is trapped between strong gamma walls. ${BR}` +
      `In a pinned regime, ${BR} expect tight intraday ranges, ${BR} repeated rejection at the walls, ${BR} and mean reversion to the center of the range. ${BR}` +
      `Iron condors, ${BR} butterflies, ${BR} and credit spreads perform best in pinned conditions. ${BRM}` +
      `TRENDING — shown in green — means the gamma structure is supporting continued directional momentum. ${BR}` +
      `Dealers are not fighting the move — ${BR} their hedging is accommodating it, ${BR} allowing trends to extend further than in a pinned regime. ${BR}` +
      `This is the environment for momentum strategies, ${BR} directional call spreads, ${BR} and trailing stop entries. ${BRM}` +
      `BREAKOUT — shown in red — means price has crossed the flip level into negative gamma territory. ${BR}` +
      `In a breakout regime, ${BR} dealer hedging is amplifying every move. ${BR}` +
      `Volatility is elevated, ${BR} moves are sharp, ${BR} and risk management becomes critical. ${BR}` +
      `Long straddles and strangles, ${BR} or defined-risk directional spreads, ${BR} work best here. ${BRM}` +
      `Below the regime cards, ${BR} the Put-Call Ratio gauge is filling to one-point-eighteen. ${BR}` +
      `The PCR compares total put open interest to total call open interest. ${BR}` +
      `A reading below zero-point-eight indicates complacent bullish positioning. ${BR}` +
      `Between zero-point-eight and one-point-two is neutral. ${BR}` +
      `Above one-point-two signals elevated defensive positioning — ${BR} a reading that often occurs near short-term market tops or when institutions are hedging large equity portfolios.`
    ),
  },

  // ── 13 · Option Flows — Tornado Chart ────────────────────────────────────
  // Vis13: tornado chart SPY — calls (green) extend left, puts (red) extend
  // right at each strike, with summary labels (Calls 24.8M, Puts 18.4M, BULLISH)
  {
    id: "tour-13",
    text: S(
      `The Tornado chart is the signature visualization of the Option Flows page, ${BR} and it gives you a powerful read on where real money is positioned right now. ${BRM}` +
      `Watch the bars build from the top strike down to the bottom. ${BR}` +
      `Green bars extending to the left represent call volume at each strike price. ${BR}` +
      `The longer the green bar, ${BR} the more call contracts were traded at that level. ${BRM}` +
      `Red bars extending to the right represent put volume at each strike. ${BRM}` +
      `The chart for SPY shows the heaviest call volume concentrated near the five-ninety to five-ninety-five range — ${BR} right where the Gamma Wall sits from the GEX page. ${BR}` +
      `When call buying clusters at and above the Gamma Wall, ${BR} it tells you that institutions are positioning for a move through that level — ${BR} not just expecting it to hold as resistance. ${BRM}` +
      `Put volume is heavier in the five-eighty to five-eighty-five range, ${BR} right near the Flip Level and Put Wall. ${BR}` +
      `This is where the market's collective insurance is concentrated — ${BR} institutions protecting against a move below that zone. ${BRM}` +
      `The summary labels at the bottom confirm the flow picture. ${BR}` +
      `Total calls at twenty-four-point-eight million contracts clearly outweigh puts at eighteen-point-four million. ${BR}` +
      `The resulting flow bias label reads BULLISH — ${BR} meaning more premium dollars are flowing into calls than puts today. ${BRM}` +
      `When GEX structure, ${BR} ML signal, ${BR} and option flow bias all point in the same direction, ${BR} that is the convergence signal you are looking for before entering a high-conviction trade.`
    ),
  },

  // ── 14 · Premium & Dealer Metrics ─────────────────────────────────────────
  // Vis14: Call Premium animating to $284M, Put Premium to $167M,
  // Net Dealer Delta to -$42M, Max Pain tile (590)
  {
    id: "tour-14",
    text: S(
      `Below the tornado chart, ${BR} three institutional-grade metrics reveal exactly where the real money is moving — ${BR} and why it matters for your trade. ${BRM}` +
      `Watch the Call Premium tile count up to two-hundred-eighty-four million dollars. ${BR}` +
      `This is the total dollar value of all call options purchased today. ${BR}` +
      `When institutions are paying two-hundred-plus million dollars for call exposure, ${BR} it signals strong conviction that the upside scenario is worth protecting. ${BR}` +
      `The note that appears — ${BR} "Institutions buying upside" — appears precisely because call premium far exceeds put premium. ${BRM}` +
      `The Put Premium tile shows one-hundred-sixty-seven million dollars — ${BR} representing the total cost of put protection purchased today. ${BR}` +
      `While puts are always present as hedges in a healthy market, ${BR} the ratio of calls to puts at one-point-seven to one confirms the flow is net bullish. ${BRM}` +
      `The Net Dealer Delta tile is the most sophisticated of the three. ${BR}` +
      `A reading of negative forty-two million means options dealers in aggregate hold a net short delta position. ${BR}` +
      `To hedge that short delta exposure, ${BR} dealers must continuously buy the underlying stock — ${BR} creating a persistent, structural bid underneath the market. ${BR}` +
      `This dealer buying pressure acts as a natural support mechanism and is one of the reasons SPY has been able to hold elevated levels. ${BRM}` +
      `Finally, ${BR} the Max Pain tile shows five-ninety. ${BR}` +
      `Max Pain is the strike price at which the maximum number of options across all strikes expire worthless. ${BR}` +
      `It represents a gravitational pull on price — ${BR} especially in the final hours before expiration — ${BR} as the options market naturally gravitates toward minimizing payouts to options buyers.`
    ),
  },

  // ── 15 · Unusual Activity ─────────────────────────────────────────────────
  // Vis15: 6-row table (SPY Mar21 CALL 595 12,400 $8.2M, QQQ CALL, NVDA CALL,
  // SPX PUT, AAPL CALL, META CALL) + "Call Sweep" definition banner
  {
    id: "tour-15",
    text: S(
      `The Unusual Activity section is where you find the clearest signals of institutional positioning — ${BR} the large trades that move far beyond what retail flow can generate. ${BRM}` +
      `Watch the rows appear one by one. ${BR}` +
      `Each trade shows the symbol, ${BR} expiration date, ${BR} type, ${BR} strike, ${BR} number of contracts, ${BR} and total premium paid. ${BRM}` +
      `The top row is a SPY March twenty-first Call at the five-ninety-five strike — ${BR} twelve-thousand-four-hundred contracts for a total premium of eight-point-two million dollars. ${BR}` +
      `A trade of this size, ${BR} buying calls four strikes out of the money with three weeks to expiration, ${BR} is almost certainly institutional. ${BR}` +
      `Retail traders rarely place single options orders worth eight million dollars. ${BRM}` +
      `Below that, ${BR} you see a QQQ call sweep, ${BR} an NVIDIA call, ${BR} and a Meta call — ${BR} all green, ${BR} all bullish, ${BR} all placed in the same session. ${BR}` +
      `This cluster of large call buying across multiple tech-linked products creates a strong directional signal. ${BRM}` +
      `There is one SPX put entry for five-hundred-seventy-five thousand contracts — ${BR} this is portfolio protection being purchased, ${BR} not a directional bet. ${BR}` +
      `Institutions buying their S-and-P 500 exposure while simultaneously protecting with SPX puts is a classic hedge fund structure — ${BR} aggressively long but risk-managed. ${BRM}` +
      `The purple banner at the bottom defines a Call Sweep: ${BR} thousands of call contracts bought rapidly across multiple exchanges simultaneously. ${BR}` +
      `Sweeps tell you an institution needed to get filled fast — ${BR} they were willing to pay up across multiple venues rather than wait for a single fill. ${BR}` +
      `That urgency is itself a signal. ${BR}` +
      `When you see unusual activity aligning with your ML signal and GEX regime, ${BR} you have the most powerful combination of evidence the dashboard can generate.`
    ),
  },

  // ── 16 · Options Strategy ─────────────────────────────────────────────────
  // Vis16: 2×2 grid of strategy cards — Bull Call Spread (green),
  // Bear Put Spread (red), Iron Condor (amber), Cash-Secured Put (cyan)
  {
    id: "tour-16",
    text: S(
      `The Options Strategy page recommends a specific trade structure for each asset based on the current ML signal, ${BR} the volatility environment, ${BR} and the GEX regime — ${BR} so you always have a defined-risk setup ready to execute. ${BRM}` +
      `Watch the four strategy cards animate in on the right. ${BRM}` +
      `The Bull Call Spread is the primary bullish strategy in the dashboard. ${BR}` +
      `You buy a call at a lower strike and sell a call at a higher strike. ${BR}` +
      `The sold call partially pays for the bought call, ${BR} reducing your net cost and defining your maximum risk. ${BR}` +
      `The tradeoff is that your profit is capped at the higher strike, ${BR} making this ideal for moderate upside moves — ${BR} exactly what the magnitude regressor predicts most of the time. ${BRM}` +
      `The Bear Put Spread is the mirror image for bearish trades — ${BR} buy a put at a higher strike, ${BR} sell a put at a lower strike. ${BR}` +
      `Same defined-risk structure, ${BR} same logic, ${BR} just reversed for downside targets. ${BRM}` +
      `The Iron Condor is the go-to strategy for a PINNED gamma regime. ${BR}` +
      `You sell both a call spread above the current price and a put spread below it. ${BR}` +
      `You collect premium from both sides, ${BR} and as long as price stays within the defined range at expiration, ${BR} both spreads expire worthless and you keep the full credit. ${BRM}` +
      `The Cash-Secured Put is a bullish income strategy. ${BR}` +
      `You sell a put below the current price and hold enough cash to buy the shares if assigned. ${BR}` +
      `If the stock stays above the put strike, ${BR} the option expires worthless and you keep the premium. ${BR}` +
      `If it drops below, ${BR} you buy shares at an effective discount equal to the strike minus the premium received. ${BR}` +
      `It is an elegant way to express a bullish view while getting paid to wait.`
    ),
  },

  // ── 17 · Zero DTE ─────────────────────────────────────────────────────────
  // Vis17: warning banner + 5-row table (SPX 94, SPY 88, QQQ 72, NVDA 61,
  // TSLA 44) with call vol, put vol, PCR, animated score bars
  {
    id: "tour-17",
    text: S(
      `Zero DTE options — ${BR} zero days to expiration — are the most volatile, ${BR} highest-risk instruments in the market, ${BR} but also the ones with the fastest potential payoff. ${BR}` +
      `These options expire at market close today. ${BRM}` +
      `The red warning banner at the top is there for a reason: ${BR}` +
      `zero DTE options can lose their entire value within minutes. ${BR}` +
      `A position that is deeply profitable at noon can be worth zero by two o'clock. ${BR}` +
      `Strict position sizing, ${BR} pre-defined stop levels, ${BR} and fast execution are non-negotiable for zero DTE trading. ${BRM}` +
      `The table below ranks assets by their activity score — ${BR} a composite number incorporating call-to-put volume ratio, ${BR} total option volume, ${BR} the put-call ratio, ${BR} and expected intraday price range. ${BRM}` +
      `SPX leads at ninety-four, ${BR} with a call volume of one-hundred-forty-two thousand contracts versus ninety-eight thousand puts — ${BR} a put-call ratio of zero-point-sixty-nine, ${BR} clearly bullish. ${BRM}` +
      `SPY follows at eighty-eight, ${BR} also with a bullish bias and high absolute volume. ${BRM}` +
      `NVDA at sixty-one is bullish as well, ${BR} though with lower total volume than the index products. ${BRM}` +
      `Tesla at forty-four carries a bearish bias — ${BR} put volume significantly exceeds call volume with a put-call ratio of one-point-five-five. ${BR}` +
      `A bearish zero DTE bias in TSLA, ${BR} combined with a SELL signal from the ML model, ${BR} could support a short-dated put play — ${BR} but only with careful risk management given the instrument's potential for sharp reversals. ${BRM}` +
      `The zero DTE page is best used as a confirmation tool — ${BR} it should amplify signals you already see elsewhere in the dashboard, ${BR} not generate trade ideas on its own.`
    ),
  },

  // ── 18 · Fundamentals — Score & Valuation ─────────────────────────────────
  // Vis18: donut gauge animating to 84 (STRONG), AAPL valuation panel
  // (Forward P/E 28.4×, Analyst Target $245, Upside +14.2%, etc.)
  {
    id: "tour-18",
    text: S(
      `The Fundamentals page adds the most important layer that pure technical and options analysis cannot provide — ${BR} the quality of the underlying business. ${BRM}` +
      `Watch the circular score gauge fill to eighty-four on the left. ${BR}` +
      `The Fundamental Score is a composite zero-to-one-hundred rating derived from four pillars: ${BR} valuation, ${BR} growth, ${BR} profitability, ${BR} and financial health. ${BR}` +
      `An eighty-four out of one hundred is classified as STRONG — ${BR} meaning the underlying business quality supports trading the ML signal rather than working against it. ${BRM}` +
      `On the right, ${BR} the valuation section shows Apple's key metrics. ${BRM}` +
      `Forward P/E of twenty-eight-point-four times means you are paying twenty-eight dollars and forty cents for every one dollar of projected next-year earnings. ${BR}` +
      `For context, ${BR} the S-and-P 500 as a whole trades near twenty-one times forward earnings. ${BR}` +
      `Apple's premium is justified by its Services segment growth, ${BR} its recurring revenue model, ${BR} and its extraordinary capital return program — ${BR} but it does mean there is limited room for disappointment. ${BRM}` +
      `The Analyst Target of two-hundred-forty-five dollars represents the twelve-month consensus price target from Wall Street research. ${BR}` +
      `With the current price near two-hundred-fourteen, ${BR} the upside to the analyst target is plus fourteen-point-two percent. ${BRM}` +
      `A stock with a strong fundamental score, ${BR} a bullish ML signal, ${BR} positive options flow, ${BR} and meaningful analyst upside is exactly the kind of multi-layer convergence trade this dashboard is designed to surface.`
    ),
  },

  // ── 19 · Growth & Financial Health ───────────────────────────────────────
  // Vis19: three sections with animated bars — Growth (Revenue +11.4%,
  // EPS +13.8%), Profitability (Net Margin 26.4%, ROE 171%),
  // Financial Health (D/E 1.87, Current Ratio 0.92)
  {
    id: "tour-19",
    text: S(
      `Scrolling down the Fundamentals page reveals three detailed sections covering the second, ${BR} third, ${BR} and fourth pillars of the fundamental score — ${BR} growth, ${BR} profitability, ${BR} and financial health. ${BRM}` +
      `In the Growth section, ${BR} Revenue Growth of plus eleven-point-four percent year-over-year confirms that sales are expanding at a healthy clip. ${BR}` +
      `EPS Growth of plus thirteen-point-eight percent tells you that not only are revenues growing, ${BR} but margins are expanding as well — ${BR} the company is becoming more profitable per dollar of revenue, ${BR} not less. ${BRM}` +
      `In the Profitability section, ${BR} Net Margin at twenty-six-point-four percent means that for every one hundred dollars of iPhone and services revenue Apple collects, ${BR} twenty-six dollars and forty cents flows through to net profit. ${BR}` +
      `For a company at Apple's scale, ${BR} this is an extraordinary achievement. ${BRM}` +
      `Return on Equity at one-hundred-seventy-one percent is exceptional — ${BR} though it is partially inflated by Apple's aggressive share buyback program, ${BR} which reduces the equity denominator while increasing earnings per share. ${BRM}` +
      `In the Financial Health section, ${BR} Debt-to-Equity at one-point-eight-seven indicates Apple carries more debt than equity on its balance sheet. ${BR}` +
      `This is by design — ${BR} Apple has deliberately leveraged its balance sheet to fund buybacks at low interest rates. ${BR}` +
      `The risk is manageable given Apple's two-hundred-plus billion dollar annual free cash flow. ${BRM}` +
      `The Current Ratio at zero-point-nine-two is slightly below one, ${BR} meaning current liabilities marginally exceed current assets — ${BR} a minor yellow flag worth monitoring, ${BR} though common among capital-efficient mega-cap companies. ${BRM}` +
      `Together, ${BR} these metrics paint a complete picture of a financially powerful but richly valued company — ${BR} one where the ML signal and options flow deserve high weight in the trading decision.`
    ),
  },

  // ── 20 · Market Preparation Hub ──────────────────────────────────────────
  // Vis20: amber banner (open before 9:30AM ET) + 6 animated prep cards:
  // ML Rankings, Economic Calendar, Overnight Futures, Pre-Market News,
  // GEX Key Levels, Support & Resistance
  {
    id: "tour-20",
    text: S(
      `The Market Preparation Hub is your morning command center, ${BR} and the amber banner at the top says it all: ${BR} open this page every morning before the nine-thirty bell. ${BRM}` +
      `What you see on the right are the six essential briefing modules that should form your pre-market routine. ${BRM}` +
      `ML Rankings gives you the morning signal picture — ${BR} which assets are entering the session with the strongest bullish or bearish probability scores from the model. ${BR}` +
      `These rankings set your priority list before the open. ${BRM}` +
      `Economic Calendar shows every scheduled market-moving event for the day — ${BR} Federal Reserve meetings, ${BR} Consumer Price Index releases, ${BR} earnings announcements, ${BR} and Fed speaker events. ${BR}` +
      `Knowing what is on the calendar prevents you from being blindsided by macro volatility that can override any technical signal. ${BRM}` +
      `Overnight Futures shows the ES and NQ pre-market direction — ${BR} how futures have moved since the prior close and whether there is a meaningful gap to manage at the open. ${BR}` +
      `A large overnight gap, ${BR} especially one without news, ${BR} often gets partially filled in the first thirty minutes of trading. ${BRM}` +
      `Pre-Market News aggregates the key headlines and catalysts that have hit since yesterday's close — ${BR} earnings beats or misses, ${BR} analyst upgrades, ${BR} geopolitical developments, ${BR} or regulatory news. ${BRM}` +
      `GEX Key Levels shows today's gamma wall, ${BR} put wall, ${BR} and flip level — ${BR} the three most important price boundaries for the session. ${BR}` +
      `And Support and Resistance derives the technical levels from GEX analysis, ${BR} giving you specific price targets to watch throughout the trading day. ${BRM}` +
      `Running through these six modules takes approximately five minutes. ${BR}` +
      `That five minutes is the highest-return investment you can make before placing a single trade.`
    ),
  },

  // ── 21 · Asset Details Page ───────────────────────────────────────────────
  // Vis21: AAPL live price ($214.50→$218.70 animating), chart with BUY marker,
  // three metric cards (P/E, Target, Analyst), news feed
  {
    id: "tour-21",
    text: S(
      `Every asset has its own dedicated details page, ${BR} and the mockup on the right shows Apple's page to illustrate the complete layout. ${BRM}` +
      `At the very top, ${BR} watch the live price ticker animate from two-hundred-fourteen-fifty to two-hundred-eighteen-seventy — ${BR} a four-dollar-twenty-two gain, ${BR} or one-point-nine-seven percent on the session. ${BR}` +
      `Price data refreshes every thirty seconds from our market data feed, ${BR} giving you a near-real-time pulse on the stock during market hours. ${BRM}` +
      `The BUY badge in the upper right shows the current ML signal at eighty-two percent confidence — ${BR} high conviction, ${BR} actionable. ${BRM}` +
      `Below the header, ${BR} the chart panel on the left shows recent price history as a continuous line, ${BR} with the green BUY arrow marker appearing at the latest signal point. ${BR}` +
      `On the actual live asset page, ${BR} this is a full interactive candlestick chart with the ML overlay drawn directly on the price data, ${BR} so you can see exactly when past signals fired relative to subsequent price action. ${BRM}` +
      `The three metric cards on the right of the chart are the most important fundamental data points in a compact format — ${BR} Forward P/E at twenty-eight-point-four times, ${BR} the Analyst Target at two-hundred-forty-five dollars, ${BR} and the Analyst consensus rating of BUY. ${BRM}` +
      `At the bottom, ${BR} the Latest News section pulls real-time headlines from our news feed — ${BR} earnings beats, ${BR} product launches, ${BR} analyst upgrades, ${BR} and any other breaking news that might be driving today's price action. ${BRM}` +
      `The asset details page is where you make your final pre-trade checklist: ${BR} signal strong, ${BR} fundamentals solid, ${BR} news clean. ${BR}` +
      `When all three confirm, ${BR} move to the Options Strategy page to structure your entry.`
    ),
  },

  // ── 22 · 6-Step Trading Sequence ─────────────────────────────────────────
  // Vis22: 6 numbered steps animating in, concluding with "when all six
  // layers align" green callout box
  {
    id: "tour-22",
    text: S(
      `Everything this tour has covered converges in the six-step trading sequence — ${BR} the structured process you should follow before placing every trade on this dashboard. ${BRM}` +
      `Watch the steps animate in from top to bottom. ${BRM}` +
      `Step one: ${BR} Open the Market Preparation Hub before the nine-thirty bell. ${BR}` +
      `Check ML rankings, ${BR} review the economic calendar, ${BR} note the overnight futures direction, ${BR} and read the key gamma levels for the day. ${BR}` +
      `This sets the macro context. ${BRM}` +
      `Step two: ${BR} Open the Market Summary page and check market breadth. ${BR}` +
      `If breadth is above sixty percent bullish and the ML consensus is BULLISH, ${BR} you have a favorable macro backdrop. ${BRM}` +
      `Step three: ${BR} Open the Gamma Exposure page. ${BR}` +
      `Identify the gamma wall, ${BR} put wall, ${BR} and flip level for your target asset. ${BR}` +
      `Confirm the regime — pinned, ${BR} trending, ${BR} or breakout — and plan your price targets accordingly. ${BRM}` +
      `Step four: ${BR} Open the Option Flows page. ${BR}` +
      `Check the tornado chart direction and confirm that call or put premium aligns with the ML signal. ${BR}` +
      `Look for unusual institutional activity in the asset you plan to trade. ${BRM}` +
      `Step five: ${BR} Open the Live Trading page and select your target asset. ${BR}` +
      `Review the ML signal, ${BR} probability score, ${BR} feature drivers, ${BR} and the signal quality checklist. ${BR}` +
      `The checklist score should be six or higher before you consider entering. ${BRM}` +
      `Step six: ${BR} Open the Fundamentals page and verify that the business quality supports the direction. ${BR}` +
      `A strong fundamental score reinforces the trade thesis. ${BR}` +
      `A weak score is a caution flag — ${BR} reduce your position size. ${BRM}` +
      `When all six layers — ${BR} market prep, ${BR} market summary, ${BR} GEX, ${BR} option flows, ${BR} live signal, ${BR} and fundamentals — all point in the same direction, ${BR} you are looking at the highest-probability setup this platform can generate. ${BRM}` +
      `Trade with discipline. ${BR} Manage your risk. ${BR} And let the machine learning models work for you.`
    ),
  },

  // ── 23 · Algorithms & Bots ────────────────────────────────────────────────
  // Vis23 (new): grid of algorithm categories with performance metrics
  {
    id: "tour-23",
    text: S(
      `The Algorithms and Bots page is where the academic theory of machine learning meets practical trading strategy — ${BR} presenting twenty distinct algorithmic approaches ranging from classical technical systems to cutting-edge deep learning architectures. ${BRM}` +
      `Each algorithm on the page is described across four critical dimensions: ${BR} its core methodology, ${BR} the market conditions where it performs best, ${BR} its primary risk factors, ${BR} and its recommended use case within the dashboard's trading framework. ${BRM}` +
      `The page is organized into five algorithm families. ${BRM}` +
      `Trend-following algorithms, ${BR} including linear models and momentum strategies, ${BR} perform best in strong directional markets where the TRENDING regime badge is active. ${BR}` +
      `They thrive in positive momentum environments but suffer during choppy, ${BR} range-bound sessions. ${BRM}` +
      `Mean-reversion algorithms detect when an asset has moved too far too fast and position for the return to equilibrium. ${BR}` +
      `These are most effective in PINNED gamma regimes, ${BR} where the gamma wall and put wall define a clear trading range. ${BRM}` +
      `Machine learning classifiers — ${BR} including Random Forest, ${BR} Support Vector Machines, ${BR} and the XGBoost ensemble that powers the dashboard's primary signals — ${BR} combine dozens of features simultaneously to predict direction without assuming a linear relationship between inputs and outputs. ${BRM}` +
      `Deep learning architectures, ${BR} including LSTM networks and Transformer models, ${BR} excel at capturing long-range sequential dependencies in price data — ${BR} patterns that span hundreds of candles across multiple timeframes. ${BRM}` +
      `Reinforcement learning agents learn optimal trading policies by interacting with a simulated market environment — ${BR} rewarded for profitable decisions and penalized for losses — ${BR} making them especially powerful for dynamic position sizing and exit timing. ${BRM}` +
      `After reviewing the Algorithms page, ${BR} the logical next step is the Asset Algorithms page, ${BR} where the XGBoost ensemble is deployed individually for each of the twenty-two tracked assets, ${BR} with live charts and real-time signals.`
    ),
  },

  // ── 24 · Asset Algorithms ─────────────────────────────────────────────────
  // Vis24 (new): XGBoost pipeline diagram + sample candlestick with
  // SMA20/SMA50/Bollinger Bands + GEX price lines + BUY signal marker
  {
    id: "tour-24",
    text: S(
      `The Asset Algorithms page is the most technically sophisticated page on the dashboard — ${BR} and the one that most directly bridges machine learning theory with live market analysis. ${BRM}` +
      `On the right, ${BR} you can see the architecture that runs independently for each of the twenty-two tracked assets. ${BRM}` +
      `The XGBoost ensemble consists of two complementary models trained in tandem. ${BR}` +
      `The Gradient Boosting Classifier predicts direction — ${BR} whether the next period is more likely to close higher or lower. ${BR}` +
      `The Gradient Boosting Regressor predicts magnitude — ${BR} how large that move is expected to be in percentage terms. ${BR}` +
      `Both models are validated using five-fold time-series cross-validation, ${BR} which prevents lookahead bias by always training on past data and testing on future data — ${BR} the same condition the model will face in live trading. ${BRM}` +
      `The candlestick chart below the pipeline shows the live price action for SPY on the four-hour timeframe, ${BR} with three layers of technical indicators overlaid directly on the price. ${BRM}` +
      `The green line is the twenty-period simple moving average — ${BR} the short-term trend. ${BR}` +
      `The blue line is the fifty-period simple moving average — ${BR} the medium-term trend. ${BR}` +
      `When the twenty-period crosses above the fifty-period, ${BR} it generates a golden cross — ${BR} a classically bullish signal that carries significant weight in the XGBoost model's feature set. ${BRM}` +
      `The amber dashed lines above and below price are the Bollinger Bands — ${BR} a twenty-period moving average plus and minus two standard deviations. ${BR}` +
      `When price touches the upper band, ${BR} it can signal overbought conditions. ${BR}` +
      `When it touches the lower band, ${BR} it can signal oversold. ${BRM}` +
      `The four dashed horizontal lines are the live GEX levels: ${BR} Call Wall in cyan at the top, ${BR} Put Wall in red at the bottom, ${BR} Flip Level in amber, ${BR} and Spot price in white. ${BR}` +
      `These gamma levels update as options positions change throughout the session. ${BRM}` +
      `Use the timeframe buttons — four-hour, ${BR} one-hour, ${BR} thirty-minute, ${BR} fifteen-minute, ${BR} and five-minute — to switch each individual asset's chart without affecting any other. ${BRM}` +
      `The Asset Algorithms page is the ultimate convergence view: ${BR} machine learning signals, ${BR} technical indicators, ${BR} and options gamma structure, ${BR} all in one scrollable dashboard.`
    ),
  },
];

// ── SSML fix: replace placeholder BML with BRM ────────────────────────────
// (typo guard — tour-02 used BML which is not defined)
const fixedClips = clips.map(c => ({
  ...c,
  text: c.text.replace(/BML/g, BRM),
}));

async function streamToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data",  c => chunks.push(c));
    readable.on("end",   () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
    readable.resume(); // force flowing mode so data events fire immediately
  });
}

async function generateClip(clip) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, FORMAT);
  // toStream() wraps text in prosody automatically; rate slows delivery by 10%
  const { audioStream } = tts.toStream(clip.text, { rate: "-10%" });
  const buf = await streamToBuffer(audioStream);
  const filePath = path.join(OUT, `${clip.id}.mp3`);
  fs.writeFileSync(filePath, buf);

  const size = buf.length;
  const estSec = (size * 8 / 96000).toFixed(1);
  const estFrames = Math.ceil(parseFloat(estSec) * 30);
  console.log(`  OK ${clip.id}.mp3  (${(size/1024).toFixed(0)}KB, ~${estSec}s, ~${estFrames} frames)`);
}

(async () => {
  console.log(`Generating ${fixedClips.length} tour clips with voice: ${VOICE}`);
  console.log(`Output: ${OUT}\n`);
  for (const clip of fixedClips) {
    await generateClip(clip);
  }
  console.log(`\nDone — all ${fixedClips.length} tour clips generated.`);
  console.log(`Now run: node calc-tour-durations.js`);
  console.log(`Then update TOUR_CLIPS in remotion/DashboardTour.jsx with the printed frame values.`);
})();
