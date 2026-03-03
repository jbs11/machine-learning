// gen-audio-live.js  — generate 12 TTS narration clips for LiveTrading video
// Run: node gen-audio-live.js
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs = require("fs");
const path = require("path");

const VOICE  = "en-US-GuyNeural";
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3;
const OUT    = path.join(__dirname, "public", "audio");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const clips = [
  {
    id: "live-01",
    text: "Welcome to the Live Machine Learning Trading System. This module connects real-time market data to machine learning models, displaying XGBoost direction probabilities and magnitude forecasts directly on four-hour candlestick charts for stocks, options, and futures. You get a complete systematic trading dashboard you can act on every session — no guessing, no discretion, just model output translated into precise entry, stop, and target prices."
  },
  {
    id: "live-02",
    text: "Choosing the right broker is the foundation of any live trading system. Interactive Brokers is the clear choice when you need stocks, options, and futures in a single API. Their Python library ib underscore async — an actively maintained fork of the popular ib underscore insync — streams real-time tick data for all three asset classes at no additional cost with a funded account. For stocks and options only, Alpaca provides a clean Python library called alpaca dash py with free paper trading. Schwab's developer API, using the schwab dash py library, is another all-three solution replacing the discontinued TD Ameritrade API."
  },
  {
    id: "live-03",
    text: "The data pipeline works in three steps. First, one-hour OHLCV bars are downloaded from the market source — either yfinance for delayed data during development, or Interactive Brokers for true real-time. Second, those one-hour bars are resampled into four-hour candles by taking the first open, the highest high, the lowest low, the last close, and the sum of volume across all four bars. Third, fourteen technical features are computed on those four-hour candles — the same feature vector the XGBoost model was trained on — and fed into the classifier to produce today's direction probability."
  },
  {
    id: "live-04",
    text: "Reading a four-hour candlestick: each candle captures half a trading day. The thick body spans from open to close — green when the close is above the open, red when below. The thin wicks above and below show how far price traveled before being rejected. A long upper wick on a green candle means buyers pushed price higher but sellers pushed it back — a warning sign. A green candle closing near its high with no upper wick and heavy volume is the strongest bullish signal the classifier can receive. The chart shows the last sixty days of four-hour candles — approximately three-hundred and sixty bars."
  },
  {
    id: "live-05",
    text: "For stocks, here is a live AAPL signal. The XGBoost direction probability is zero-point-seven-two — above our zero-point-six-five threshold, this is a valid buy signal. The gradient boost magnitude model predicts plus one-point-four percent over the next four-hour bar. AAPL is trading at one-hundred-eighty-six dollars. ATR on the four-hour chart is one dollar and sixty cents. Entry is at one-eighty-six, stop is one-point-five times ATR below at one-eighty-three-sixty, and the profit target is at the magnitude prediction of one-eighty-eight-sixty. The risk-reward ratio is one-to-one-point-seven, and the sixty-bar backtest accuracy for AAPL is sixty-two-point-four percent."
  },
  {
    id: "live-06",
    text: "Options live signals use the same direction and magnitude outputs, but add an implied volatility rank check before selecting the strategy. When the four-hour chart shows P-up above zero-point-six-five and IV rank is below thirty, we enter a bull call spread — buying cheap premium with directional edge. When IV rank is above sixty, we sell a bull put spread instead, collecting elevated premium. The magnitude forecast determines strike selection: the spread's break-even must be inside the model's predicted move. An AAPL bull call spread with a break-even requiring only zero-point-eight percent when the model forecasts plus one-point-four percent has clear positive expected value."
  },
  {
    id: "live-07",
    text: "Futures live signals on the ES four-hour chart combine direction probability with leverage awareness. ES at four-thousand-nine-hundred points: P-up equals zero-point-six-eight, above the threshold. Magnitude forecast: plus forty-one points. Each ES point is worth fifty dollars. Target profit: forty-one times fifty equals two-thousand-fifty dollars per contract. ATR on the four-hour chart is twenty-eight points. Stop is one-point-five times ATR below entry at forty-two points, risk equals forty-two times fifty equals twenty-one hundred dollars. The risk-reward is near one-to-one on a model with sixty-two percent accuracy — positive expected value of plus four-hundred-sixty dollars per trade."
  },
  {
    id: "live-08",
    text: "The live trading dashboard lets you switch between any symbol in the portfolio. Click AAPL to see the stock four-hour candlestick chart with the ML signal overlay. Click E-S equals F to switch instantly to the E-mini S&P futures chart. Each panel shows: the probability gauge from zero to one with a color-coded needle, the magnitude forecast as a percentage and absolute dollar amount, the calculated entry stop and target prices, the ATR-based position size for your account, and a six-condition checklist showing which signal quality gates are currently passing. When all six conditions are green, the system highlights the signal in bold — maximum confidence entry."
  },
  {
    id: "live-09",
    text: "Live trading introduces slippage that backtests do not capture. Your stop-loss order may fill five to ten cents worse than the price you set. Your limit entry may not fill at all if price gaps past it. To adjust for this reality, apply three rules. First, add five basis points to your entry price when calculating expected fill. Second, subtract five basis points from your target — assume you exit slightly early. Third, size down ten percent from your Kelly-calculated position. These three adjustments reduce your theoretical edge slightly but make your actual results match your backtest more closely over time."
  },
  {
    id: "live-10",
    text: "Trade journaling is how you monitor model health over time. After every trade, log the signal probability, the magnitude forecast, the actual entry and exit prices, and the actual return. After one hundred trades, run this comparison: if your actual win rate falls more than five percentage points below the model's predicted probability, the model has likely drifted from current market conditions and needs to be retrained on a longer or more recent lookback window. If your actual average win is consistently smaller than the model's magnitude forecast, your strike or target selection may need adjustment. The journal is your model's performance review."
  },
  {
    id: "live-11",
    text: "Three common mistakes in live ML trading. First: trading signals below the confidence threshold. A probability of zero-point-six-two is not a buy signal — it is a hold. Forcing trades on borderline signals is the fastest way to turn a positive-expectancy system into a losing one. Second: holding positions through major scheduled news releases — Fed announcements, non-farm payrolls, CPI prints. The ML model was not trained on post-announcement gap behavior and has no edge during these windows. Close positions before the release. Third: moving your stop away from the model-calculated level. The stop is not a suggestion — it is where the model's edge expires."
  },
  {
    id: "live-12",
    text: "You now have a complete live trading infrastructure: a Python server pulling four-hour candlestick data from the market, fourteen features feeding gradient boosting classifiers and regressors, and a dashboard displaying direction probability, magnitude forecast, entry stop and target prices, and position sizing for stocks, options, and futures simultaneously. Connect Interactive Brokers with ib underscore async for true real-time data, or run with the included yfinance integration for delayed data during development. The system refreshes every four hours as new bars close. Run it consistently across all three markets, filter for high-confidence signals only, and let the statistical edge compound trade by trade."
  }
];

async function generateClip(clip) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, FORMAT);
  const { audioStream } = tts.toStream(clip.text);
  const filePath = path.join(OUT, `${clip.id}.mp3`);
  const fileStream = fs.createWriteStream(filePath);
  audioStream.pipe(fileStream);
  await new Promise((resolve, reject) => {
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });
  console.log(`  ✓ ${clip.id}.mp3`);
}

(async () => {
  console.log(`Generating ${clips.length} live trading audio clips...`);
  for (const clip of clips) {
    await generateClip(clip);
  }
  console.log("Done — all live audio clips generated.");
})();
