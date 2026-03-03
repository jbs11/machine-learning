import {
  AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, staticFile
} from "remotion";

// ── Audio helper ─────────────────────────────────────────────────────────────
const Html5Audio = ({ src, startFrom = 0 }) => (
  <audio src={src} autoPlay style={{ display: "none" }}>
    <source src={src} />
  </audio>
);

// ── Constants ────────────────────────────────────────────────────────────────
export const LIVE_DURATION = 14058;

const ACCENT  = "#10b981";   // emerald green
const ACCENT2 = "#34d399";
const BG      = "#0a0f1a";
const SURFACE = "#0f172a";
const BORDER  = "#1e293b";
const TEXT     = "#f1f5f9";
const MUTED   = "#64748b";

const T = {
  titleIn:      0,
  brokerIn:     806,
  pipelineIn:   1987,
  candlestickIn:3032,
  stockSignalIn:4110,
  optionsLiveIn:5405,
  futuresLiveIn:6600,
  dashboardIn:  7962,
  slippageIn:   9043,
  journalIn:    10251,
  mistakesIn:   11409,
  summaryIn:    12741,
};

const LIVE_CLIPS = [
  { id: "live-01", start: 0,     dur: 776  },
  { id: "live-02", start: 806,   dur: 1151 },
  { id: "live-03", start: 1987,  dur: 1015 },
  { id: "live-04", start: 3032,  dur: 1048 },
  { id: "live-05", start: 4110,  dur: 1265 },
  { id: "live-06", start: 5405,  dur: 1165 },
  { id: "live-07", start: 6600,  dur: 1332 },
  { id: "live-08", start: 7962,  dur: 1051 },
  { id: "live-09", start: 9043,  dur: 1178 },
  { id: "live-10", start: 10251, dur: 1128 },
  { id: "live-11", start: 11409, dur: 1302 },
  { id: "live-12", start: 12741, dur: 1227 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const ci = (f, [in0, in1], [out0, out1]) =>
  interpolate(f, [in0, in1], [out0, out1], {
    extrapolateLeft:  "clamp",
    extrapolateRight: "clamp",
  });

const fadeInOut = (frame, sceneStart, sceneEnd) => {
  const fadeIn  = ci(frame, [sceneStart, sceneStart + 20], [0, 1]);
  const fadeOut = sceneEnd ? ci(frame, [sceneEnd - 20, sceneEnd], [1, 0]) : 1;
  return Math.min(fadeIn, fadeOut);
};

const sp = (frame, sceneStart, delay = 0) =>
  spring({ frame: frame - sceneStart - delay, fps: 30,
           config: { damping: 18, stiffness: 90, mass: 0.6 } });

// ── Brand Bar ────────────────────────────────────────────────────────────────
const BrandBar = () => (
  <div style={{
    position: "absolute", bottom: 0, left: 0, right: 0, height: 48,
    background: "linear-gradient(90deg,#0a0f1a 0%,#0f172a 100%)",
    borderTop: `2px solid ${ACCENT}`,
    display: "flex", alignItems: "center",
    padding: "0 40px", justifyContent: "space-between",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <img src={staticFile("images/steve.jpg")}
           style={{ width: 30, height: 30, borderRadius: "50%",
                    border: `1.5px solid ${ACCENT}` }} />
      <span style={{ color: MUTED, fontSize: 13, fontWeight: 600 }}>
        Artificial Intelligence Solutions, Inc.
      </span>
    </div>
    <span style={{ color: ACCENT, fontSize: 12, fontWeight: 700,
                   letterSpacing: "0.08em" }}>
      LIVE ML TRADING SYSTEM
    </span>
  </div>
);

// ── Candlestick component (drawn in SVG) ─────────────────────────────────────
const CandleChart = ({ frame, sceneStart }) => {
  // Synthetic AAPL-like 4H data for illustration
  const candles = [
    { o:184.2, h:185.8, l:183.6, c:185.1 },
    { o:185.1, h:185.9, l:184.0, c:184.3 },
    { o:184.3, h:186.2, l:183.8, c:186.0 },
    { o:186.0, h:187.4, l:185.5, c:186.8 },
    { o:186.8, h:188.1, l:186.3, c:187.5 },
    { o:187.5, h:188.6, l:186.9, c:186.2 },
    { o:186.2, h:186.9, l:184.8, c:185.0 },
    { o:185.0, h:186.4, l:184.7, c:186.1 },
    { o:186.1, h:187.9, l:185.8, c:187.6 },
    { o:187.6, h:189.2, l:187.0, c:188.9 },
    { o:188.9, h:190.1, l:188.3, c:189.7 },
    { o:189.7, h:190.5, l:188.8, c:188.4 },
  ];
  const priceMin = 183, priceMax = 191;
  const w = 600, h = 220;
  const candleW = 36, gap = 12;
  const pxPerPrice = h / (priceMax - priceMin);
  const py = p => h - (p - priceMin) * pxPerPrice;

  const progress = ci(frame, [sceneStart, sceneStart + 40], [0, 1]);
  const visCount = Math.floor(progress * candles.length);

  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      {/* grid lines */}
      {[184, 186, 188, 190].map(p => (
        <g key={p}>
          <line x1={0} y1={py(p)} x2={w} y2={py(p)}
                stroke={BORDER} strokeWidth={1} />
          <text x={-8} y={py(p)+4} fill={MUTED} fontSize={11} textAnchor="end">${p}</text>
        </g>
      ))}
      {candles.slice(0, visCount).map((c, i) => {
        const x = i * (candleW + gap) + gap;
        const bull = c.c >= c.o;
        const color = bull ? "#4ade80" : "#f87171";
        const top = Math.min(py(c.o), py(c.c));
        const bodyH = Math.max(2, Math.abs(py(c.o) - py(c.c)));
        return (
          <g key={i}>
            {/* wick */}
            <line x1={x + candleW/2} y1={py(c.h)} x2={x + candleW/2} y2={py(c.l)}
                  stroke={color} strokeWidth={1.5} />
            {/* body */}
            <rect x={x} y={top} width={candleW} height={bodyH}
                  fill={color} rx={1} />
          </g>
        );
      })}
    </svg>
  );
};

// ── Scene 1 — Title ──────────────────────────────────────────────────────────
const TitleScene = ({ frame }) => {
  const f = frame - T.titleIn;
  const opacity = fadeInOut(frame, T.titleIn, T.brokerIn);
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      {/* green accent bar top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0,
                    height: 4, background: ACCENT }} />
      <div style={{ position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    textAlign: "center", width: 900 }}>
        {/* badge */}
        <div style={{
          display: "inline-block",
          background: "rgba(16,185,129,.15)",
          border: `1px solid ${ACCENT}`,
          color: ACCENT, fontSize: 13, fontWeight: 700,
          letterSpacing: "0.1em", padding: "5px 18px", borderRadius: 4,
          marginBottom: 28, opacity: sp(f, 0),
        }}>
          🟢 MODULE 7 · LIVE TRADING SYSTEM
        </div>
        <div style={{
          fontSize: 62, fontWeight: 900, color: TEXT,
          lineHeight: 1.1,
          opacity: sp(f, 5),
          transform: `translateY(${ci(f, [5, 25], [30, 0])}px)`,
        }}>
          Live ML Trading
        </div>
        <div style={{
          fontSize: 62, fontWeight: 900, color: ACCENT,
          lineHeight: 1.1, marginTop: 4,
          opacity: sp(f, 10),
          transform: `translateY(${ci(f, [10, 30], [30, 0])}px)`,
        }}>
          Dashboard
        </div>
        <div style={{
          fontSize: 22, color: MUTED, marginTop: 24, lineHeight: 1.5,
          opacity: sp(f, 20),
        }}>
          4-Hour Candlestick Charts + XGBoost ML Signals for
          Stocks, Options &amp; Futures
        </div>
        {/* key stats */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 40, marginTop: 48,
          opacity: sp(f, 30),
        }}>
          {[
            ["61.8%",  "ES direction accuracy"],
            ["1.72",   "Portfolio Sharpe ratio"],
            ["3 mkts", "Stocks · Options · Futures"],
            ["IBKR",   "Recommended live broker"],
          ].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: ACCENT }}>{v}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 2 — Broker Selection ───────────────────────────────────────────────
const BrokerScene = ({ frame }) => {
  const f = frame - T.brokerIn;
  const opacity = fadeInOut(frame, T.brokerIn, T.pipelineIn);
  const brokers = [
    {
      name: "Interactive Brokers", badge: "★ RECOMMENDED",
      accentColor: ACCENT,
      covers: ["Stocks ✓", "Options ✓", "Futures ✓"],
      lib: "ib_async", install: "pip install ib_async",
      note: "Free with funded account\nTWS / IB Gateway on port 7497",
    },
    {
      name: "Charles Schwab API", badge: "ALL THREE",
      accentColor: "#38bdf8",
      covers: ["Stocks ✓", "Options ✓", "Futures ✓"],
      lib: "schwab-py", install: "pip install schwab-py",
      note: "Free with Schwab account\nReplaced TD Ameritrade API",
    },
    {
      name: "Alpaca", badge: "STOCKS + OPTIONS",
      accentColor: "#a78bfa",
      covers: ["Stocks ✓", "Options ✓", "Futures ✗"],
      lib: "alpaca-py", install: "pip install alpaca-py",
      note: "Paper trading free\nReal-time ~$99/month",
    },
  ];
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 70, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 8,
                      opacity: sp(f, 0) }}>
          🏦 Best Broker for Live ML Data
        </div>
        <div style={{ fontSize: 17, color: MUTED, marginBottom: 36,
                      opacity: sp(f, 5) }}>
          Stocks + Options + Futures in one Python API — choose your data source
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {brokers.map((b, i) => (
            <div key={b.name} style={{
              flex: 1,
              background: SURFACE,
              border: `1px solid ${i === 0 ? b.accentColor : BORDER}`,
              borderRadius: 12, padding: "20px 22px",
              opacity: sp(f, 10 + i * 8),
              transform: `translateY(${ci(f, [10+i*8, 30+i*8], [30,0])}px)`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: b.accentColor,
                            letterSpacing: "0.1em", marginBottom: 8 }}>
                {b.badge}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: TEXT,
                            marginBottom: 12 }}>{b.name}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap",
                            marginBottom: 14 }}>
                {b.covers.map(c => (
                  <span key={c} style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 4,
                    fontWeight: 700,
                    background: c.includes("✓")
                      ? "rgba(74,222,128,.12)" : "rgba(248,113,113,.1)",
                    color: c.includes("✓") ? "#4ade80" : "#f87171",
                  }}>{c}</span>
                ))}
              </div>
              <div style={{ background: "rgba(255,255,255,.04)",
                            borderRadius: 6, padding: "8px 12px",
                            fontFamily: "monospace", fontSize: 12,
                            color: b.accentColor, marginBottom: 10 }}>
                {b.lib}
              </div>
              <div style={{ fontSize: 11, color: MUTED, fontFamily: "monospace",
                            marginBottom: 8 }}>{b.install}</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5,
                            whiteSpace: "pre-line" }}>{b.note}</div>
            </div>
          ))}
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 3 — Pipeline ───────────────────────────────────────────────────────
const PipelineScene = ({ frame }) => {
  const f = frame - T.pipelineIn;
  const opacity = fadeInOut(frame, T.pipelineIn, T.candlestickIn);
  const steps = [
    { label: "Market Data",   sub: "IBKR / yfinance",   color: ACCENT },
    { label: "1H OHLCV",      sub: "Raw hourly bars",   color: "#38bdf8" },
    { label: "Resample 4H",   sub: "pandas resample",   color: "#a78bfa" },
    { label: "14 Features",   sub: "RSI, ATR, MACD…",  color: "#fbbf24" },
    { label: "GBM Model",     sub: "Direction + Mag.",  color: "#f87171" },
    { label: "Signal JSON",   sub: "→ Dashboard",       color: ACCENT },
  ];
  const code = `raw = yf.download('AAPL', period='90d', interval='1h')
df_4h = raw.resample('4h').agg({
    'Open':   'first',
    'High':   'max',
    'Low':    'min',
    'Close':  'last',
    'Volume': 'sum'
}).dropna()
# 14 features → GBM classifier + regressor → signal`;
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 8, opacity: sp(f, 0) }}>
          🔄 4-Hour Candle Data Pipeline
        </div>
        <div style={{ fontSize: 16, color: MUTED, marginBottom: 36,
                      opacity: sp(f, 5) }}>
          From raw market data to ML signal in 6 steps
        </div>

        {/* Pipeline steps */}
        <div style={{ display: "flex", alignItems: "center", gap: 0,
                      marginBottom: 40 }}>
          {steps.map((s, i) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                background: SURFACE, border: `1px solid ${s.color}`,
                borderRadius: 8, padding: "12px 16px", textAlign: "center",
                minWidth: 110,
                opacity: sp(f, i * 6),
                transform: `scale(${ci(f, [i*6, i*6+12], [0.7, 1])})`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
                  {s.sub}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ color: MUTED, fontSize: 18, padding: "0 4px",
                              opacity: sp(f, i * 6 + 3) }}>→</div>
              )}
            </div>
          ))}
        </div>

        {/* Code block */}
        <div style={{
          background: "#020817", border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: "18px 22px",
          opacity: sp(f, 36),
        }}>
          <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700,
                        letterSpacing: "0.1em", marginBottom: 10 }}>
            PYTHON — RESAMPLE 1H → 4H
          </div>
          <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 13,
                        color: "#94a3b8", lineHeight: 1.7 }}>
            {code}
          </pre>
        </div>

        {/* Note */}
        <div style={{ marginTop: 20, fontSize: 14, color: MUTED,
                      opacity: sp(f, 40) }}>
          Each 4H bar = 4 hours of price action ≈ 6 bars per trading day ·
          90-day window = ~360 bars for model training
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 4 — Candlestick Reading ────────────────────────────────────────────
const CandlestickScene = ({ frame }) => {
  const f = frame - T.candlestickIn;
  const opacity = fadeInOut(frame, T.candlestickIn, T.stockSignalIn);
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 30, opacity: sp(f, 0) }}>
          📊 Reading 4-Hour Candlesticks
        </div>

        <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
          {/* Chart */}
          <div style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: "20px 24px",
            opacity: sp(f, 5), flex: "0 0 auto",
          }}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 14,
                          fontWeight: 700, letterSpacing: "0.08em" }}>
              AAPL — 4H CHART (LIVE ILLUSTRATION)
            </div>
            <CandleChart frame={frame} sceneStart={T.candlestickIn} />
          </div>

          {/* Labels */}
          <div style={{ flex: 1 }}>
            {[
              { color: "#4ade80", label: "Bullish candle", desc: "Close > Open. Buyers dominated. Strong closes near the high signal conviction." },
              { color: "#f87171", label: "Bearish candle", desc: "Close < Open. Sellers dominated. Close near the low signals further weakness." },
              { color: "#fbbf24", label: "Upper wick", desc: "Price pushed higher but was rejected. A long upper wick warns buyers are fading." },
              { color: "#38bdf8", label: "Lower wick", desc: "Price dipped but recovered. Long lower wicks often signal buyers stepping in." },
              { color: ACCENT,    label: "High volume bar", desc: "Volume 20%+ above the 20-bar average confirms institutional participation in the move." },
            ].map((item, i) => (
              <div key={item.label} style={{
                display: "flex", gap: 14, marginBottom: 18,
                opacity: sp(f, 10 + i * 6),
                transform: `translateX(${ci(f, [10+i*6, 25+i*6], [20,0])}px)`,
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 2,
                  background: item.color, flexShrink: 0, marginTop: 4,
                }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: item.color,
                                marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 5 — Stock Signal ───────────────────────────────────────────────────
const StockSignalScene = ({ frame }) => {
  const f = frame - T.stockSignalIn;
  const opacity = fadeInOut(frame, T.stockSignalIn, T.optionsLiveIn);
  const probUp = ci(f, [0, 40], [0, 72]);
  const barW   = ci(f, [0, 40], [0, 72]);

  const features = [
    ["RSI recovery", 0.24], ["MACD positive", 0.18], ["Price/SMA20", 0.14],
    ["Volume ratio", 0.12], ["ATR%", 0.09], ["BB position", 0.08],
  ];
  const maxFeat = 0.24;

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 28, opacity: sp(f, 0) }}>
          📈 Live Stock Signal — AAPL
        </div>

        <div style={{ display: "flex", gap: 28 }}>
          {/* Direction card */}
          <div style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: "20px 24px", flex: 1,
            opacity: sp(f, 5),
          }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700,
                          letterSpacing: "0.1em", marginBottom: 12 }}>
              ML DIRECTION SIGNAL
            </div>
            <div style={{
              background: "rgba(74,222,128,.12)",
              border: "1px solid #4ade80", borderRadius: 6,
              padding: "8px 16px", display: "inline-block",
              fontSize: 22, fontWeight: 800, color: "#4ade80",
              marginBottom: 16,
            }}>
              ▲ BUY
            </div>
            {/* Gauge */}
            <div style={{ fontSize: 12, color: MUTED, display: "flex",
                          justifyContent: "space-between", marginBottom: 6 }}>
              <span>P(DOWN) {(100 - probUp).toFixed(1)}%</span>
              <span>P(UP) {probUp.toFixed(1)}%</span>
            </div>
            <div style={{ height: 10, background: "rgba(255,255,255,.08)",
                          borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${barW}%`, borderRadius: 5,
                            background: "linear-gradient(90deg,#f87171,#fbbf24 50%,#4ade80)" }} />
            </div>
            <div style={{ marginTop: 16 }}>
              {[
                ["Price (AAPL)", "$186.20"],
                ["Magnitude forecast", "+1.4%"],
                ["ATR (4H)", "$1.60"],
                ["60-bar accuracy", "62.4%"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between",
                                       padding: "8px 0",
                                       borderBottom: `1px solid ${BORDER}`,
                                       fontSize: 14 }}>
                  <span style={{ color: MUTED }}>{k}</span>
                  <span style={{ fontWeight: 700, color: TEXT }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trade setup + features */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Trade setup */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "18px 22px",
              opacity: sp(f, 10),
            }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700,
                            letterSpacing: "0.1em", marginBottom: 14 }}>
                TRADE PARAMETERS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["Entry", "$186.20", TEXT],
                  ["Stop (1.5×ATR)", "$183.80", "#f87171"],
                  ["Target (+1.4%)", "$188.80", "#4ade80"],
                  ["R:R Ratio", "1:1.08", ACCENT],
                ].map(([k, v, c]) => (
                  <div key={k} style={{
                    background: "rgba(255,255,255,.03)",
                    borderRadius: 6, padding: "10px 14px",
                  }}>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature importance */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "18px 22px",
              opacity: sp(f, 15),
            }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700,
                            letterSpacing: "0.1em", marginBottom: 14 }}>
                TOP FEATURE DRIVERS
              </div>
              {features.map(([name, val], i) => (
                <div key={name} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 8,
                  opacity: sp(f, 20 + i * 4),
                }}>
                  <div style={{ width: 100, fontSize: 11, color: MUTED }}>{name}</div>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,.07)",
                                borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3,
                                  width: `${(val/maxFeat)*100}%`,
                                  background: ACCENT,
                                  transition: "width .5s" }} />
                  </div>
                  <div style={{ width: 36, fontSize: 11, color: MUTED,
                                textAlign: "right" }}>
                    {(val*100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 6 — Options Live ───────────────────────────────────────────────────
const OptionsLiveScene = ({ frame }) => {
  const f = frame - T.optionsLiveIn;
  const opacity = fadeInOut(frame, T.optionsLiveIn, T.futuresLiveIn);
  const ivProgress = ci(f, [10, 40], [0, 35]);

  const strategies = [
    { dir: "P(UP) ≥ 0.65", iv: "IV Rank < 30",  strat: "Bull Call Spread",  color: "#4ade80" },
    { dir: "P(UP) ≥ 0.65", iv: "IV Rank > 60",  strat: "Sell Bull Put Spread", color: "#4ade80" },
    { dir: "Neutral",       iv: "IV Rank > 60",  strat: "Iron Condor",       color: "#fbbf24" },
    { dir: "P(DN) ≤ 0.35",  iv: "IV Rank < 30",  strat: "Bear Put Spread",   color: "#f87171" },
    { dir: "Uncertain",     iv: "IV Expanding",  strat: "Long Straddle",     color: "#a78bfa" },
  ];

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 28, opacity: sp(f, 0) }}>
          🎯 Options Live Signal
        </div>

        <div style={{ display: "flex", gap: 28 }}>
          {/* Left — IV gauge */}
          <div style={{ flex: "0 0 280px" }}>
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "20px 22px", marginBottom: 20,
              opacity: sp(f, 5),
            }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700,
                            letterSpacing: "0.1em", marginBottom: 14 }}>
                IV RANK GAUGE
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, color: "#fbbf24",
                            marginBottom: 4 }}>
                {ivProgress.toFixed(0)}%
              </div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
                Current IV Rank (below 30 = cheap options)
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,.08)",
                            borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 5,
                  width: `${ivProgress}%`,
                  background: ivProgress < 30
                    ? "linear-gradient(90deg,#4ade80,#86efac)"
                    : ivProgress > 60
                    ? "linear-gradient(90deg,#f87171,#fca5a5)"
                    : "linear-gradient(90deg,#fbbf24,#fde68a)",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between",
                            fontSize: 10, color: MUTED, marginTop: 6 }}>
                <span>0</span><span>30 buy</span><span>60 sell</span><span>100</span>
              </div>
            </div>

            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "18px 22px",
              opacity: sp(f, 10),
            }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700,
                            letterSpacing: "0.1em", marginBottom: 14 }}>
                TODAY'S SIGNAL
              </div>
              {[
                ["Direction", "P(UP) = 72%", "#4ade80"],
                ["Magnitude", "+1.4%", "#4ade80"],
                ["IV Rank", "35%", "#fbbf24"],
                ["Strategy", "Bull Call Spread", ACCENT],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between",
                                       padding: "7px 0",
                                       borderBottom: `1px solid ${BORDER}`,
                                       fontSize: 13 }}>
                  <span style={{ color: MUTED }}>{k}</span>
                  <span style={{ fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — strategy matrix */}
          <div style={{ flex: 1 }}>
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, overflow: "hidden",
              opacity: sp(f, 6),
            }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`,
                            fontSize: 11, color: MUTED, fontWeight: 700,
                            letterSpacing: "0.1em" }}>
                ML STRATEGY SELECTION MATRIX
              </div>
              <div style={{ display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            borderBottom: `1px solid ${BORDER}` }}>
                {["Direction Signal", "IV Condition", "Strategy"].map(h => (
                  <div key={h} style={{ padding: "10px 16px", fontSize: 11,
                                        fontWeight: 700, color: MUTED,
                                        background: "rgba(255,255,255,.03)" }}>
                    {h}
                  </div>
                ))}
              </div>
              {strategies.map((row, i) => (
                <div key={row.strat} style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  borderBottom: i < strategies.length-1 ? `1px solid ${BORDER}` : "none",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,.02)",
                  opacity: sp(f, 12 + i * 5),
                }}>
                  <div style={{ padding: "10px 16px", fontSize: 13, color: MUTED }}>{row.dir}</div>
                  <div style={{ padding: "10px 16px", fontSize: 13, color: MUTED }}>{row.iv}</div>
                  <div style={{ padding: "10px 16px", fontSize: 13,
                                fontWeight: 700, color: row.color }}>{row.strat}</div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 16, fontSize: 13, color: MUTED, lineHeight: 1.6,
              opacity: sp(f, 40),
            }}>
              Strike selection: the spread's break-even must fall inside the
              predicted magnitude. AAPL bull call spread 185/188 break-even
              at +0.8% vs. +1.4% forecast = positive expected value. ✓
            </div>
          </div>
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 7 — Futures Live ───────────────────────────────────────────────────
const FuturesLiveScene = ({ frame }) => {
  const f = frame - T.futuresLiveIn;
  const opacity = fadeInOut(frame, T.futuresLiveIn, T.dashboardIn);
  const prob = ci(f, [5, 40], [0.5, 0.68]);

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 28, opacity: sp(f, 0) }}>
          ⚡ Futures Live Signal — ES
        </div>

        <div style={{ display: "flex", gap: 28 }}>
          {/* Signal card */}
          <div style={{
            flex: "0 0 300px", background: SURFACE,
            border: `1px solid #f59e0b`, borderRadius: 12, padding: "20px 22px",
            opacity: sp(f, 5),
          }}>
            <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700,
                          letterSpacing: "0.1em", marginBottom: 12 }}>
              E-MINI S&P 500 (ES)
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, color: TEXT,
                          marginBottom: 4 }}>4,900</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
              Current price · $50/point multiplier
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                            fontSize: 12, color: MUTED, marginBottom: 6 }}>
                <span>P(DOWN) {((1-prob)*100).toFixed(1)}%</span>
                <span>P(UP) {(prob*100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,.08)",
                            borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${prob*100}%`, borderRadius: 5,
                              background: "linear-gradient(90deg,#f87171,#fbbf24 50%,#4ade80)" }} />
              </div>
            </div>

            {[
              ["Signal",    "▲ BUY", "#4ade80"],
              ["Magnitude", "+41 pts", "#4ade80"],
              ["ATR (4H)",  "28 pts", TEXT],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                                     padding: "8px 0",
                                     borderBottom: `1px solid ${BORDER}`,
                                     fontSize: 14 }}>
                <span style={{ color: MUTED }}>{k}</span>
                <span style={{ fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Leverage math */}
          <div style={{ flex: 1 }}>
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "20px 22px", marginBottom: 20,
              opacity: sp(f, 8),
            }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700,
                            letterSpacing: "0.1em", marginBottom: 16 }}>
                LEVERAGE MATH
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  ["Notional value", "$245,000", TEXT, "4,900 pts × $50/pt"],
                  ["Initial margin", "$12,000",  TEXT, "6× capital required"],
                  ["Target profit",  "+$2,050",  "#4ade80", "41 pts × $50"],
                  ["Max risk",       "−$2,100",  "#f87171", "42 pts × $50 (stop)"],
                  ["R:R ratio",      "0.98:1",   ACCENT, "Positive EV at 61.8%"],
                  ["Leverage",       "20.4×",    "#fbbf24", "Notional / margin"],
                ].map(([k, v, c, note]) => (
                  <div key={k} style={{
                    background: "rgba(255,255,255,.03)",
                    borderRadius: 6, padding: "10px 14px",
                  }}>
                    <div style={{ fontSize: 11, color: MUTED }}>{k}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c,
                                  margin: "4px 0" }}>{v}</div>
                    <div style={{ fontSize: 10, color: MUTED }}>{note}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: "rgba(16,185,129,.08)",
              border: `1px solid ${ACCENT}`,
              borderRadius: 10, padding: "14px 18px",
              fontSize: 14, color: TEXT, lineHeight: 1.6,
              opacity: sp(f, 40),
            }}>
              <strong style={{ color: ACCENT }}>Expected value per trade:</strong>
              &nbsp;0.618 × $2,050 − 0.382 × $2,100 = <strong>+$464/contract</strong><br />
              100 trades × $464 = <strong style={{ color: ACCENT }}>$46,400 per year</strong> on $12,000 margin
            </div>
          </div>
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 8 — Dashboard ──────────────────────────────────────────────────────
const DashboardScene = ({ frame }) => {
  const f = frame - T.dashboardIn;
  const opacity = fadeInOut(frame, T.dashboardIn, T.slippageIn);

  const panels = [
    { label: "Probability Gauge", desc: "0→1 needle with color gradient (red / yellow / green)", icon: "📊" },
    { label: "Magnitude Forecast", desc: "% move and absolute dollar amount at current price", icon: "📐" },
    { label: "Entry / Stop / Target", desc: "ATR-calculated prices with 1.5× stop and magnitude target", icon: "🎯" },
    { label: "Feature Importance", desc: "Top 6 model drivers shown as ranked mini bar chart", icon: "🔢" },
    { label: "Signal Checklist", desc: "6 green/red conditions — all must pass for high-quality signal", icon: "✅" },
    { label: "Market Explanation", desc: "Plain-English trade rationale generated from ML outputs", icon: "📝" },
  ];

  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 8, opacity: sp(f, 0) }}>
          🖥 Dashboard Walkthrough
        </div>
        <div style={{ fontSize: 16, color: MUTED, marginBottom: 28,
                      opacity: sp(f, 5) }}>
          Click any symbol tab to instantly switch market — panels update automatically
        </div>

        {/* Simulated asset tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28,
                      opacity: sp(f, 5) }}>
          {[
            { sym: "AAPL",  type: "stock",   color: "#38bdf8", active: true },
            { sym: "NVDA",  type: "stock",   color: "#38bdf8" },
            { sym: "ES=F",  type: "futures", color: "#f59e0b" },
            { sym: "CL=F",  type: "futures", color: "#f59e0b" },
            { sym: "GC=F",  type: "futures", color: "#fbbf24" },
            { sym: "Options", type: "opts",  color: "#a78bfa" },
          ].map((btn) => (
            <div key={btn.sym} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 700,
              background: btn.active ? btn.color : SURFACE,
              border: `1px solid ${btn.active ? btn.color : BORDER}`,
              color: btn.active ? "#000" : MUTED,
            }}>
              {btn.sym}
            </div>
          ))}
        </div>

        {/* Panel grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {panels.map((p, i) => (
            <div key={p.label} style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "16px 18px",
              opacity: sp(f, 10 + i * 5),
              transform: `translateY(${ci(f, [10+i*5, 25+i*5], [20,0])}px)`,
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{p.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT,
                            marginBottom: 6 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 20, fontSize: 13, color: MUTED,
          opacity: sp(f, 45),
        }}>
          Auto-refreshes every 4 minutes as new 4H bars close ·
          No manual action required during a trading session
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 9 — Slippage ───────────────────────────────────────────────────────
const SlippageScene = ({ frame }) => {
  const f = frame - T.slippageIn;
  const opacity = fadeInOut(frame, T.slippageIn, T.journalIn);
  const rows = [
    { item: "Entry price",   backtest: "Signal price (exact)",  live: "Signal + 5 bps",  impact: "Slightly higher cost" },
    { item: "Exit / target", backtest: "Target price (exact)",  live: "Target − 5 bps",  impact: "Slightly less profit" },
    { item: "Stop fill",     backtest: "Stop price (exact)",    live: "Stop ± gap risk",  impact: "Use limit stops" },
    { item: "Position size", backtest: "Full Kelly",            live: "Kelly × 0.90",     impact: "10% size reduction" },
  ];
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 8, opacity: sp(f, 0) }}>
          ⚠️ Slippage — Backtest vs. Live
        </div>
        <div style={{ fontSize: 16, color: MUTED, marginBottom: 32,
                      opacity: sp(f, 5) }}>
          Apply these 4 adjustments to align live results with backtest expectations
        </div>

        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 12, overflow: "hidden",
          opacity: sp(f, 5),
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr 1fr",
                        background: "rgba(255,255,255,.04)" }}>
            {["Adjustment", "Backtest Assumes", "Live Execution", "Impact"].map(h => (
              <div key={h} style={{ padding: "12px 16px", fontSize: 11,
                                    fontWeight: 700, color: MUTED,
                                    letterSpacing: "0.07em", borderBottom: `1px solid ${BORDER}` }}>
                {h}
              </div>
            ))}
          </div>
          {rows.map((r, i) => (
            <div key={r.item} style={{
              display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr 1fr",
              borderBottom: i < rows.length-1 ? `1px solid ${BORDER}` : "none",
              background: i%2===0 ? "transparent" : "rgba(255,255,255,.02)",
              opacity: sp(f, 12 + i * 6),
            }}>
              <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700,
                            color: TEXT }}>{r.item}</div>
              <div style={{ padding: "12px 16px", fontSize: 13, color: MUTED }}>{r.backtest}</div>
              <div style={{ padding: "12px 16px", fontSize: 13, color: ACCENT,
                            fontWeight: 600 }}>{r.live}</div>
              <div style={{ padding: "12px 16px", fontSize: 12, color: MUTED }}>{r.impact}</div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 28,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
          opacity: sp(f, 40),
        }}>
          {[
            ["Net edge reduction", "~2–3% off gross return", "#fbbf24"],
            ["Benefit", "Live results match backtest more closely", ACCENT],
          ].map(([k, v, c]) => (
            <div key={k} style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: "14px 18px",
            }}>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 10 — Journal ───────────────────────────────────────────────────────
const JournalScene = ({ frame }) => {
  const f = frame - T.journalIn;
  const opacity = fadeInOut(frame, T.journalIn, T.mistakesIn);
  const trades = [
    { sym: "AAPL", prob: "72%", pred: "+1.4%", actual: "+1.6%", result: "W" },
    { sym: "ES=F", prob: "68%", pred: "+41pts", actual: "+38pts", result: "W" },
    { sym: "NVDA", prob: "71%", pred: "+2.1%", actual: "+1.8%", result: "W" },
    { sym: "CL=F", prob: "36%", pred: "-1.2%", actual: "+0.4%", result: "L" },
    { sym: "GC=F", prob: "69%", pred: "+1.8%", actual: "+2.2%", result: "W" },
  ];
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 8, opacity: sp(f, 0) }}>
          📓 Trade Journal — Model Health
        </div>
        <div style={{ fontSize: 16, color: MUTED, marginBottom: 32,
                      opacity: sp(f, 5) }}>
          Log every trade to compare model predictions vs. actual results
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, overflow: "hidden", opacity: sp(f, 5),
            }}>
              <div style={{ display: "grid",
                            gridTemplateColumns: ".7fr .7fr 1fr 1fr .5fr",
                            background: "rgba(255,255,255,.04)" }}>
                {["Symbol", "P(signal)", "Forecast", "Actual", "Result"].map(h => (
                  <div key={h} style={{ padding: "10px 14px", fontSize: 11,
                                        fontWeight: 700, color: MUTED,
                                        letterSpacing: "0.07em",
                                        borderBottom: `1px solid ${BORDER}` }}>
                    {h}
                  </div>
                ))}
              </div>
              {trades.map((t, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: ".7fr .7fr 1fr 1fr .5fr",
                  borderBottom: i < trades.length-1 ? `1px solid ${BORDER}` : "none",
                  background: i%2===0 ? "transparent" : "rgba(255,255,255,.02)",
                  opacity: sp(f, 12 + i * 5),
                }}>
                  <div style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700,
                                color: TEXT }}>{t.sym}</div>
                  <div style={{ padding: "10px 14px", fontSize: 13, color: MUTED }}>{t.prob}</div>
                  <div style={{ padding: "10px 14px", fontSize: 13, color: MUTED }}>{t.pred}</div>
                  <div style={{ padding: "10px 14px", fontSize: 13, color: ACCENT,
                                fontWeight: 600 }}>{t.actual}</div>
                  <div style={{ padding: "10px 14px", fontSize: 14, fontWeight: 800,
                                color: t.result === "W" ? "#4ade80" : "#f87171" }}>
                    {t.result}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: "0 0 280px" }}>
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "20px 22px",
              opacity: sp(f, 10),
            }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 700,
                            letterSpacing: "0.1em", marginBottom: 16 }}>
                MODEL HEALTH CHECK
              </div>
              {[
                ["Predicted win rate", "68%"],
                ["Actual win rate",    "80%", "#4ade80"],
                ["Magnitude MAE",      "0.3%"],
                ["Drift warning",      "None ✓", ACCENT],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between",
                                       padding: "8px 0",
                                       borderBottom: `1px solid ${BORDER}`,
                                       fontSize: 13 }}>
                  <span style={{ color: MUTED }}>{k}</span>
                  <span style={{ fontWeight: 700, color: c || TEXT }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 16, background: "rgba(16,185,129,.08)",
              border: `1px solid ${ACCENT}`, borderRadius: 8,
              padding: "12px 16px", fontSize: 13, color: MUTED,
              lineHeight: 1.5, opacity: sp(f, 20),
            }}>
              <strong style={{ color: ACCENT }}>Drift alert threshold:</strong><br />
              Retrain model if actual win rate falls more than 5 pts below
              predicted over 100 trades.
            </div>
          </div>
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 11 — Mistakes ──────────────────────────────────────────────────────
const MistakesScene = ({ frame }) => {
  const f = frame - T.mistakesIn;
  const opacity = fadeInOut(frame, T.mistakesIn, T.summaryIn);
  const mistakes = [
    {
      num: "01",
      title: "Trading Below Confidence Threshold",
      desc: "P(UP) = 0.62 is NOT a buy signal. It is a hold. Every trade below 0.65 destroys the edge by mixing low-probability setups into the strategy's statistics.",
      fix: "Wait for ≥ 0.65 (buy) or ≤ 0.35 (sell). No exceptions.",
    },
    {
      num: "02",
      title: "Holding Through Macro Events",
      desc: "The ML model has no edge during Fed announcements, NFP releases, or CPI prints. These events cause gap moves that the 4H model was not trained to handle.",
      fix: "Close all positions before scheduled macro releases.",
    },
    {
      num: "03",
      title: "Moving the Stop Loss",
      desc: "The stop at 1.5× ATR is where the model's edge expires. Moving it further away does not save the trade — it turns a controlled loss into a catastrophic one.",
      fix: "Pre-define stop before entry. Execute mechanically. Never adjust.",
    },
  ];
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 32, opacity: sp(f, 0) }}>
          ⚠️ Three Critical Live Trading Mistakes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {mistakes.map((m, i) => (
            <div key={m.num} style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "20px 24px",
              display: "flex", gap: 20, alignItems: "flex-start",
              opacity: sp(f, i * 10),
              transform: `translateX(${ci(f, [i*10, i*10+20], [-30,0])}px)`,
            }}>
              <div style={{
                fontSize: 32, fontWeight: 900, color: "#f87171",
                opacity: 0.3, flexShrink: 0, width: 48,
              }}>
                {m.num}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#f87171",
                              marginBottom: 6 }}>{m.title}</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5,
                              marginBottom: 10 }}>{m.desc}</div>
                <div style={{ fontSize: 13, color: ACCENT, fontWeight: 600 }}>
                  ✓ Fix: {m.fix}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Scene 12 — Summary ───────────────────────────────────────────────────────
const SummaryScene = ({ frame }) => {
  const f = frame - T.summaryIn;
  const opacity = fadeInOut(frame, T.summaryIn, null);
  const markets = [
    { sym: "AAPL / Stocks", win: "62.4%", sharpe: "1.71", dd: "−11.2%", status: "LIVE" },
    { sym: "Options (SPY)", win: "64.9%", sharpe: "1.68", dd: "−12.4%", status: "LIVE" },
    { sym: "ES / Futures",  win: "61.8%", sharpe: "1.82", dd: "−14.1%", status: "LIVE" },
  ];
  return (
    <AbsoluteFill style={{ background: BG, opacity }}>
      <div style={{ position: "absolute", top: 60, left: 80, right: 80 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: TEXT,
                      marginBottom: 8, opacity: sp(f, 0) }}>
          🟢 System Ready — Start Live Trading
        </div>
        <div style={{ fontSize: 16, color: MUTED, marginBottom: 32,
                      opacity: sp(f, 5) }}>
          Your complete live ML trading infrastructure is deployed
        </div>

        {/* 3-market table */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 12, overflow: "hidden", marginBottom: 28,
          opacity: sp(f, 5),
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr",
                        background: "rgba(255,255,255,.04)" }}>
            {["Market", "Win Rate", "Sharpe", "Max DD", "Status"].map(h => (
              <div key={h} style={{ padding: "12px 16px", fontSize: 11,
                                    fontWeight: 700, color: MUTED,
                                    letterSpacing: "0.07em",
                                    borderBottom: `1px solid ${BORDER}` }}>
                {h}
              </div>
            ))}
          </div>
          {markets.map((m, i) => (
            <div key={m.sym} style={{
              display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr",
              borderBottom: i < markets.length-1 ? `1px solid ${BORDER}` : "none",
              background: i%2===0 ? "transparent" : "rgba(255,255,255,.02)",
              opacity: sp(f, 12 + i * 6),
            }}>
              <div style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700,
                            color: TEXT }}>{m.sym}</div>
              <div style={{ padding: "12px 16px", fontSize: 14, color: "#4ade80",
                            fontWeight: 700 }}>{m.win}</div>
              <div style={{ padding: "12px 16px", fontSize: 14, color: "#4ade80",
                            fontWeight: 700 }}>{m.sharpe}</div>
              <div style={{ padding: "12px 16px", fontSize: 14,
                            color: "#f87171" }}>{m.dd}</div>
              <div style={{ padding: "12px 16px" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 8px",
                  borderRadius: 4, background: "rgba(16,185,129,.15)",
                  color: ACCENT, border: `1px solid ${ACCENT}`,
                }}>{m.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Stack summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16,
                      opacity: sp(f, 28) }}>
          {[
            ["IBKR / yfinance", "Data source (swap for live)"],
            ["Flask + sklearn",  "Python ML server"],
            ["Lightweight Charts", "Browser candlestick charts"],
            ["4H refresh cycle", "Auto-update every bar close"],
          ].map(([k, v]) => (
            <div key={k} style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT,
                            marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, textAlign: "center",
                      opacity: sp(f, 36) }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>
            Run <span style={{ color: ACCENT, fontFamily: "monospace" }}>python live-server.py</span>
            &nbsp;→ open <span style={{ color: ACCENT, fontFamily: "monospace" }}>live-trading.html</span>
            &nbsp;→ trade with ML edge
          </div>
        </div>
      </div>
      <BrandBar />
    </AbsoluteFill>
  );
};

// ── Root Composition ─────────────────────────────────────────────────────────
export const LiveTrading = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      {/* Audio */}
      {LIVE_CLIPS.map(c => (
        <Sequence key={c.id} from={c.start} durationInFrames={c.dur + 30}>
          <Html5Audio src={staticFile(`audio/${c.id}.mp3`)} />
        </Sequence>
      ))}

      {/* Scenes */}
      <Sequence from={T.titleIn}       durationInFrames={T.brokerIn      - T.titleIn      + 30}><TitleScene      frame={frame} /></Sequence>
      <Sequence from={T.brokerIn}      durationInFrames={T.pipelineIn    - T.brokerIn     + 30}><BrokerScene     frame={frame} /></Sequence>
      <Sequence from={T.pipelineIn}    durationInFrames={T.candlestickIn - T.pipelineIn   + 30}><PipelineScene   frame={frame} /></Sequence>
      <Sequence from={T.candlestickIn} durationInFrames={T.stockSignalIn - T.candlestickIn+ 30}><CandlestickScene frame={frame}/></Sequence>
      <Sequence from={T.stockSignalIn} durationInFrames={T.optionsLiveIn - T.stockSignalIn+ 30}><StockSignalScene frame={frame}/></Sequence>
      <Sequence from={T.optionsLiveIn} durationInFrames={T.futuresLiveIn - T.optionsLiveIn+ 30}><OptionsLiveScene frame={frame}/></Sequence>
      <Sequence from={T.futuresLiveIn} durationInFrames={T.dashboardIn   - T.futuresLiveIn+ 30}><FuturesLiveScene frame={frame}/></Sequence>
      <Sequence from={T.dashboardIn}   durationInFrames={T.slippageIn    - T.dashboardIn  + 30}><DashboardScene  frame={frame} /></Sequence>
      <Sequence from={T.slippageIn}    durationInFrames={T.journalIn     - T.slippageIn   + 30}><SlippageScene   frame={frame} /></Sequence>
      <Sequence from={T.journalIn}     durationInFrames={T.mistakesIn    - T.journalIn    + 30}><JournalScene    frame={frame} /></Sequence>
      <Sequence from={T.mistakesIn}    durationInFrames={T.summaryIn     - T.mistakesIn   + 30}><MistakesScene   frame={frame} /></Sequence>
      <Sequence from={T.summaryIn}     durationInFrames={LIVE_DURATION   - T.summaryIn       }><SummaryScene    frame={frame} /></Sequence>
    </AbsoluteFill>
  );
};
