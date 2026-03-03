import {
  AbsoluteFill, Html5Audio, Img, Sequence, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

const ORG = "Artificial Intelligence Solutions, Inc.";

// ── Video Duration & Scene Timing ─────────────────────────────────────────────
export const STOCK_DURATION = 11438;

const T = {
  titleIn:     0,
  dataIn:      440,
  featuresIn:  991,
  directionIn: 1648,
  magnitudeIn: 2562,
  signalIn:    3375,
  execIn:      4348,
  riskIn:      5162,
  backtestIn:  6395,
  tradeIn:     7761,
  pitfallsIn:  9173,
  summaryIn:   10311,
};

const STOCK_CLIPS = [
  { file: "stock-01", start: 0,     dur: 410  }, // ends 410
  { file: "stock-02", start: 440,   dur: 521  }, // ends 961
  { file: "stock-03", start: 991,   dur: 627  }, // ends 1618
  { file: "stock-04", start: 1648,  dur: 884  }, // ends 2532
  { file: "stock-05", start: 2562,  dur: 783  }, // ends 3345
  { file: "stock-06", start: 3375,  dur: 943  }, // ends 4318
  { file: "stock-07", start: 4348,  dur: 784  }, // ends 5132
  { file: "stock-08", start: 5162,  dur: 1203 }, // ends 6365
  { file: "stock-09", start: 6395,  dur: 1336 }, // ends 7731
  { file: "stock-10", start: 7761,  dur: 1382 }, // ends 9143
  { file: "stock-11", start: 9173,  dur: 1108 }, // ends 10281
  { file: "stock-12", start: 10311, dur: 1037 }, // ends 11348
];

// ── Seeded PRNG (Xorshift32) ──────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ── AAPL price data (252 sessions) ───────────────────────────────────────────
function generateAAPLData() {
  const rng = seededRng(20240115);
  const data = [];
  let close = 182;
  for (let i = 0; i < 252; i++) {
    const trend = i < 60 ? 0.0007 : i < 90 ? -0.0018 : i < 160 ? 0.0010 : 0.0005;
    const noise = (rng() - 0.5) * 0.022;
    close = close * (1 + trend + noise);
    data.push(Math.max(150, Math.min(220, close)));
  }
  return data;
}
const AAPL_DATA = generateAAPLData();

// ── Helpers ───────────────────────────────────────────────────────────────────
const ci = (f, inp, out, ec = "clamp") => interpolate(f, inp, out, { extrapolateLeft: ec, extrapolateRight: ec });
const fadeInOut = (f, start, end) => {
  const fadeIn  = ci(f, [start, start + 20], [0, 1]);
  const fadeOut = end ? ci(f, [end, end + 20], [1, 0]) : 1;
  return Math.min(fadeIn, fadeOut);
};

// ── Brand Bar ─────────────────────────────────────────────────────────────────
function BrandBar({ frame }) {
  const op = ci(frame, [0, 20], [0, 1]);
  return (
    <div style={{
      position: "absolute", bottom: 18, right: 20,
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(0,0,0,0.62)", borderRadius: 30,
      padding: "6px 14px 6px 8px", opacity: op,
    }}>
      <Img src={staticFile("images/steve.jpg")}
        style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #38bdf8", objectFit: "cover" }} />
      <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, fontFamily: "Arial,sans-serif" }}>{ORG}</span>
    </div>
  );
}

// ── Scene 1: Title ────────────────────────────────────────────────────────────
function TitleScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.titleIn, T.dataIn);
  const scale = spring({ frame: frame - T.titleIn, fps, config: { damping: 14, stiffness: 80 } });
  const sub1 = spring({ frame: frame - T.titleIn - 18, fps, config: { damping: 14 } });
  const sub2 = spring({ frame: frame - T.titleIn - 34, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0c2340 100%)", opacity: op, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, color: "#38bdf8", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>Module 4 · Applied ML</div>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 72, color: "#f1f5f9", fontWeight: 700, lineHeight: 1.1, marginBottom: 20 }}>ML in<br /><span style={{ color: "#38bdf8" }}>Stock Trading</span></div>
        <div style={{ width: 80, height: 4, background: "linear-gradient(90deg,#38bdf8,#6366f1)", borderRadius: 2, margin: "0 auto 28px" }} />
      </div>
      <div style={{ opacity: sub1, textAlign: "center" }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, color: "#94a3b8", marginBottom: 10 }}>AAPL · XGBoost Direction · Magnitude Regression · ATR Sizing</div>
      </div>
      <div style={{ opacity: sub2, marginTop: 8 }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 17, color: "#64748b" }}>{ORG}</div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 2: AAPL Data ────────────────────────────────────────────────────────
function DataScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.dataIn, T.featuresIn);
  const lf = frame - T.dataIn;
  const chartW = 580, chartH = 200;
  const prices = AAPL_DATA;
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const px = (i) => (i / (prices.length - 1)) * chartW;
  const py = (v) => chartH - ((v - minP) / (maxP - minP)) * chartH;
  const visCount = Math.min(prices.length, Math.floor(ci(lf, [0, 60], [0, prices.length])));
  const pts = prices.slice(0, visCount).map((v, i) => `${px(i)},${py(v)}`).join(" ");
  const ma20 = prices.map((_, i) => i >= 19 ? prices.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20 : null);
  const maPts = ma20.slice(0, visCount).map((v, i) => v !== null ? `${px(i)},${py(v)}` : null).filter(Boolean).join(" ");

  const ohlcv = [
    ["Open",  "$184.37"], ["High",  "$186.12"], ["Low",   "$183.51"],
    ["Close", "$185.20"], ["Volume","48.3M"],
  ];
  const cardOp = ci(lf, [40, 65], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Stock Market Data</div>
      <div style={{ color: "#f1f5f9", fontSize: 34, fontWeight: 700, marginBottom: 24 }}>AAPL — 252-Session OHLCV Dataset</div>
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <svg width={chartW} height={chartH + 20} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map(t => (
              <line key={t} x1={0} y1={t * chartH} x2={chartW} y2={t * chartH} stroke="#334155" strokeWidth={1} />
            ))}
            {/* Price line */}
            {visCount > 1 && <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth={2} />}
            {/* MA20 */}
            {visCount > 20 && <polyline points={maPts} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,2" />}
            {/* Current price line */}
            <line x1={px(visCount - 1)} y1={0} x2={px(visCount - 1)} y2={chartH} stroke="#6366f1" strokeWidth={1} strokeDasharray="3,3" />
          </svg>
          <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 12, color: "#64748b" }}>
            <span style={{ color: "#38bdf8" }}>── AAPL Close</span>
            <span style={{ color: "#f59e0b" }}>- - MA(20)</span>
          </div>
        </div>
        <div style={{ opacity: cardOp }}>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10 }}>Latest Session</div>
          {ohlcv.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 32, padding: "7px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 5, borderLeft: "3px solid #38bdf8" }}>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>{k}</span>
              <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(56,189,248,0.1)", borderRadius: 8, border: "1px solid rgba(56,189,248,0.3)" }}>
            <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>Dataset: 252 sessions</div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>Train: 180 · Test: 52 · Held-out: 20</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 3: Feature Engineering ─────────────────────────────────────────────
function FeaturesScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.featuresIn, T.directionIn);
  const lf = frame - T.featuresIn;

  const features = [
    { name: "SMA(5)",      value: "184.61", category: "Trend",    signal: "Neutral" },
    { name: "SMA(20)",     value: "188.92", category: "Trend",    signal: "Bearish" },
    { name: "SMA(50)",     value: "183.40", category: "Trend",    signal: "Bullish" },
    { name: "RSI-14",      value: "42.3",   category: "Momentum", signal: "Oversold" },
    { name: "MACD",        value: "+0.48",  category: "Momentum", signal: "Bullish" },
    { name: "BB Position", value: "18%",    category: "Volatility","signal": "Low" },
    { name: "ATR-14",      value: "$2.10",  category: "Volatility","signal": "Normal" },
    { name: "Volume Ratio",value: "1.83×",  category: "Volume",   signal: "High" },
    { name: "Gap %",       value: "-0.21%", category: "Price",    signal: "Small" },
  ];

  const catColors = { Trend: "#38bdf8", Momentum: "#f59e0b", Volatility: "#a78bfa", Volume: "#34d399", Price: "#f87171" };

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Feature Engineering</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>18-Variable Feature Vector for AAPL</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {features.map((f, i) => {
          const cardOp = ci(lf, [i * 8, i * 8 + 25], [0, 1]);
          const cardY = ci(lf, [i * 8, i * 8 + 25], [20, 0]);
          return (
            <div key={f.name} style={{ opacity: cardOp, transform: `translateY(${cardY}px)`, padding: "12px 16px", background: "rgba(255,255,255,0.05)", borderRadius: 10, borderLeft: `3px solid ${catColors[f.category]}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>{f.name}</span>
                <span style={{ color: catColors[f.category], fontSize: 11, fontWeight: 600, background: `${catColors[f.category]}22`, padding: "2px 8px", borderRadius: 10 }}>{f.category}</span>
              </div>
              <div style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, marginTop: 4 }}>{f.value}</div>
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>Signal: {f.signal}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 4: Direction Prediction ─────────────────────────────────────────────
function DirectionScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.directionIn, T.magnitudeIn);
  const lf = frame - T.directionIn;

  const probBarW = ci(lf, [20, 60], [0, 73]);
  const matrix = [
    { label: "True Positive",  val: 61, sub: "Predicted UP → UP",   color: "#22c55e" },
    { label: "True Negative",  val: 58, sub: "Predicted DOWN → DOWN",color: "#38bdf8" },
    { label: "False Positive", val: 19, sub: "Predicted UP → DOWN",  color: "#f87171" },
    { label: "False Negative", val: 19, sub: "Predicted DOWN → UP",  color: "#fbbf24" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Direction Prediction</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>XGBoost Classifier — 63.2% Accuracy</div>
      <div style={{ display: "flex", gap: 40 }}>
        {/* Probability gauge */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>Model Output — Today's AAPL Signal</div>
          <div style={{ padding: "24px", background: "rgba(255,255,255,0.05)", borderRadius: 12, marginBottom: 20 }}>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>Direction Probability (UP)</div>
            <div style={{ background: "#1e293b", borderRadius: 8, height: 28, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ width: `${probBarW}%`, height: "100%", background: "linear-gradient(90deg,#22c55e,#38bdf8)", borderRadius: 8, transition: "width 0.1s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>0.0</span>
              <span style={{ color: "#22c55e", fontSize: 28, fontWeight: 800 }}>0.73</span>
              <span style={{ color: "#64748b", fontSize: 13 }}>1.0</span>
            </div>
            <div style={{ textAlign: "center", marginTop: 8, padding: "8px 20px", background: "rgba(34,197,94,0.15)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.4)" }}>
              <span style={{ color: "#22c55e", fontSize: 16, fontWeight: 700 }}>STRONG BUY — 73% confidence</span>
            </div>
          </div>
          <div style={{ padding: "16px", background: "rgba(255,255,255,0.04)", borderRadius: 10 }}>
            <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>Key Features Driving Signal</div>
            {[["RSI-14", "42.3 — near oversold", "#f59e0b"], ["MACD crossover", "+0.48 — bullish", "#22c55e"], ["BB Position", "18% — lower band", "#a78bfa"]].map(([k, v, c]) => (
              <div key={k} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: c, fontWeight: 700, width: 110 }}>{k}</span>
                <span style={{ color: "#94a3b8" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Confusion matrix */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>Confusion Matrix (52 test sessions)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {matrix.map((m, i) => {
              const cardOp = ci(lf, [30 + i * 10, 55 + i * 10], [0, 1]);
              return (
                <div key={m.label} style={{ opacity: cardOp, padding: "16px", background: `${m.color}18`, borderRadius: 10, border: `1px solid ${m.color}44` }}>
                  <div style={{ color: m.color, fontSize: 32, fontWeight: 800 }}>{m.val}</div>
                  <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>{m.sub}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(56,189,248,0.08)", borderRadius: 8, border: "1px solid rgba(56,189,248,0.2)" }}>
            <div style={{ color: "#38bdf8", fontSize: 14, fontWeight: 700 }}>Out-of-sample accuracy: 63.2%</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Train: 180 sessions · Test: 52 sessions</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 5: Magnitude Prediction ─────────────────────────────────────────────
function MagnitudeScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.magnitudeIn, T.signalIn);
  const lf = frame - T.magnitudeIn;
  const intervalProgress = ci(lf, [20, 70], [0, 1]);
  const pointProgress = ci(lf, [50, 80], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Magnitude Prediction</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 28 }}>Gradient Boost Regression — Predicted Move Size</div>
      <div style={{ display: "flex", gap: 36, alignItems: "flex-start" }}>
        {/* Prediction interval visualization */}
        <div style={{ flex: 1.2, padding: 24, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>90th Percentile Prediction Interval</div>
          <div style={{ position: "relative", height: 80, background: "#1e293b", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            {/* Zero line */}
            <div style={{ position: "absolute", left: "40%", top: 0, width: 2, height: "100%", background: "#475569" }} />
            {/* Interval bar */}
            <div style={{ position: "absolute", left: `${40 + (0.2 / 3.5) * 30 * intervalProgress}%`, top: "25%", height: "50%", width: `${((2.8 - 0.2) / 3.5) * 30 * intervalProgress}%`, background: "rgba(56,189,248,0.25)", border: "1px solid rgba(56,189,248,0.5)", borderRadius: 4 }} />
            {/* Point estimate */}
            <div style={{ position: "absolute", left: `${40 + (1.4 / 3.5) * 30 * pointProgress}%`, top: "15%", height: "70%", width: 3, background: "#22c55e", borderRadius: 2 }} />
            <div style={{ position: "absolute", top: 4, left: "38%", color: "#64748b", fontSize: 11 }}>0%</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>
            <span>Low: <strong style={{ color: "#38bdf8" }}>+0.2%</strong></span>
            <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 18 }}>Predicted: +1.4%</span>
            <span>High: <strong style={{ color: "#38bdf8" }}>+2.8%</strong></span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Predicted return", "+1.4%", "#22c55e"], ["Dollar move (185×)", "+$2.59", "#f59e0b"], ["Lower bound", "+$0.37", "#38bdf8"], ["Upper bound", "+$5.18", "#38bdf8"]].map(([k, v, c]) => (
              <div key={k} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>{k}</div>
                <div style={{ color: c, fontSize: 20, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Position sizing preview */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 16 }}>Proportional Position Sizing</div>
          {[["Low confidence (<0.5%)", "0.5× position", "#64748b"], ["Normal signal (0.8–1.5%)", "1.0× position", "#38bdf8"], ["Strong signal (>1.5%)", "1.5× position", "#22c55e"]].map(([k, v, c], i) => {
            const rowOp = ci(lf, [40 + i * 15, 65 + i * 15], [0, 1]);
            const active = v === "1.0× position";
            return (
              <div key={k} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: active ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 10, border: active ? "1px solid rgba(56,189,248,0.4)" : "1px solid transparent" }}>
                <div>
                  <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: active ? 700 : 400 }}>{k}</div>
                  {active && <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>↑ Today's signal: +1.4%</div>}
                </div>
                <span style={{ color: c, fontSize: 16, fontWeight: 700 }}>{v}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(34,197,94,0.08)", borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)" }}>
            <div style={{ color: "#22c55e", fontSize: 14, fontWeight: 700 }}>Apply standard position size</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>Predicted +1.4% → normal sizing</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 6: Signal Dashboard ─────────────────────────────────────────────────
function SignalScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.signalIn, T.execIn);
  const lf = frame - T.signalIn;
  const signalOp = ci(lf, [30, 55], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Signal Dashboard</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>Reading the Combined ML Output</div>
      {/* Signal threshold matrix */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {[
          { dir: "≥0.65", mag: "≥0.8%", action: "STRONG BUY",  color: "#22c55e", active: true },
          { dir: "0.55–0.65", mag: "≥0.5%", action: "BUY",  color: "#38bdf8", active: false },
          { dir: "0.45–0.55", mag: "Any",  action: "NO TRADE",  color: "#64748b", active: false },
          { dir: "<0.45",  mag: "≥0.5%", action: "SHORT/PUT", color: "#f87171", active: false },
        ].map((r, i) => {
          const cardOp = ci(lf, [i * 8, i * 8 + 25], [0, 1]);
          return (
            <div key={r.action} style={{ opacity: cardOp, padding: "14px 18px", background: r.active ? `${r.color}18` : "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${r.active ? r.color : "transparent"}44` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>P(UP)</span>
                <span style={{ color: "#64748b", fontSize: 12 }}>Magnitude</span>
                <span style={{ color: "#64748b", fontSize: 12 }}>Action</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#94a3b8", fontSize: 14, fontWeight: r.active ? 700 : 400 }}>{r.dir}</span>
                <span style={{ color: "#94a3b8", fontSize: 14 }}>{r.mag}</span>
                <span style={{ color: r.color, fontSize: 15, fontWeight: 700 }}>{r.action}</span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Today's trade */}
      <div style={{ opacity: signalOp, padding: "20px 24px", background: "rgba(34,197,94,0.1)", borderRadius: 14, border: "1px solid rgba(34,197,94,0.4)" }}>
        <div style={{ color: "#22c55e", fontSize: 18, fontWeight: 800, marginBottom: 14 }}>TODAY'S SIGNAL: STRONG BUY</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[["Entry", "~$185.20", "#f1f5f9"], ["Target", "$187.80", "#22c55e"], ["Stop-Loss", "$183.40", "#f87171"], ["Risk:Reward", "1.4 : 1", "#f59e0b"]].map(([k, v, c]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>{k}</div>
              <div style={{ color: c, fontSize: 20, fontWeight: 700, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 7: Execution ────────────────────────────────────────────────────────
function ExecScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.execIn, T.riskIn);
  const lf = frame - T.execIn;

  const steps = [
    { n: "1", label: "Check opening volume", detail: "Volume > 0.8× 20-day avg → proceed", ok: true },
    { n: "2", label: "Place limit buy order", detail: "185.20 limit · 31 shares · DAY order", ok: true },
    { n: "3", label: "Attach bracket orders", detail: "Take-profit: 187.80 · Stop-market: 183.40", ok: true },
    { n: "4", label: "Monitor first 15 minutes", detail: "If price gaps above 186.50 → skip, wait for pullback", ok: false },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Trade Execution</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>Placing the Stock Trade — AAPL Long</div>
      <div style={{ display: "flex", gap: 36 }}>
        {/* Order ticket */}
        <div style={{ flex: 1.1, padding: 24, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>Order Ticket</div>
          {[["Symbol", "AAPL", "#f1f5f9"], ["Side", "BUY", "#22c55e"], ["Quantity", "31 shares", "#f1f5f9"], ["Order type", "LIMIT", "#38bdf8"], ["Limit price", "$185.20", "#f1f5f9"], ["Time in force", "DAY", "#f1f5f9"], ["Take-profit", "$187.80", "#22c55e"], ["Stop-loss", "$183.40", "#f87171"]].map(([k, v, c], i) => {
            const rowOp = ci(lf, [i * 6, i * 6 + 20], [0, 1]);
            return (
              <div key={k} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "#64748b", fontSize: 14 }}>{k}</span>
                <span style={{ color: c, fontSize: 14, fontWeight: 600 }}>{v}</span>
              </div>
            );
          })}
        </div>
        {/* Steps */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>Execution Steps</div>
          {steps.map((s, i) => {
            const stepOp = ci(lf, [20 + i * 12, 45 + i * 12], [0, 1]);
            return (
              <div key={s.n} style={{ opacity: stepOp, display: "flex", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.ok ? "rgba(34,197,94,0.2)" : "rgba(248,113,113,0.2)", border: `2px solid ${s.ok ? "#22c55e" : "#f87171"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: s.ok ? "#22c55e" : "#f87171", fontSize: 14, fontWeight: 700 }}>{s.n}</span>
                </div>
                <div>
                  <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{s.detail}</div>
                </div>
              </div>
            );
          })}
          <div style={{ opacity: ci(lf, [60, 80], [0, 1]), marginTop: 12, padding: "12px 16px", background: "rgba(251,191,36,0.1)", borderRadius: 10, border: "1px solid rgba(251,191,36,0.3)" }}>
            <div style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>Capital at risk: $56</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>0.56% of $10,000 account</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 8: Risk Management ──────────────────────────────────────────────────
function RiskScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.riskIn, T.backtestIn);
  const lf = frame - T.riskIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Risk Management</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>ATR Position Sizing + Kelly Criterion</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* ATR sizing */}
        <div style={{ padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#38bdf8", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>ATR-Based Position Sizing</div>
          {[
            ["ATR-14", "$2.10", "Average True Range — daily volatility"],
            ["Stop multiplier", "1.5×", "Stop distance = 1.5 × ATR"],
            ["Stop distance", "$3.15", "Hard stop from entry price"],
            ["Account risk (1%)", "$100", "Max loss per trade on $10K account"],
            ["Position size", "31 shares", "$100 ÷ $3.15 = 31.7 → 31"],
            ["Capital deployed", "$5,741", "31 × $185.20 per share"],
          ].map(([k, v, d], i) => {
            const rowOp = ci(lf, [i * 8, i * 8 + 25], [0, 1]);
            return (
              <div key={k} style={{ opacity: rowOp, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{k}</span>
                  <span style={{ color: "#f59e0b", fontSize: 14, fontWeight: 700 }}>{v}</span>
                </div>
                <div style={{ color: "#475569", fontSize: 11 }}>{d}</div>
              </div>
            );
          })}
        </div>
        {/* Kelly criterion */}
        <div style={{ padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#a78bfa", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Kelly Criterion</div>
          <div style={{ background: "#1e293b", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontFamily: "monospace", fontSize: 15, color: "#e2e8f0", textAlign: "center" }}>
            f* = (p · b − q) / b
          </div>
          {[
            ["p = win rate", "0.631", "#22c55e"],
            ["q = 1 − p", "0.369", "#f87171"],
            ["b = avg win/loss", "1.4 : 1", "#f59e0b"],
            ["Full Kelly f*", "26%", "#a78bfa"],
            ["Half-Kelly (used)", "13%", "#38bdf8"],
          ].map(([k, v, c], i) => {
            const rowOp = ci(lf, [30 + i * 8, 55 + i * 8], [0, 1]);
            return (
              <div key={k} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "#64748b", fontSize: 13 }}>{k}</span>
                <span style={{ color: c, fontSize: 14, fontWeight: 700 }}>{v}</span>
              </div>
            );
          })}
          <div style={{ opacity: ci(lf, [70, 90], [0, 1]), marginTop: 14, padding: "10px 14px", background: "rgba(56,189,248,0.1)", borderRadius: 8 }}>
            <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700 }}>Max exposure: 13% = $1,300</div>
            <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>31 shares × $185.20 = $5,741 → within limits</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 9: Backtesting ──────────────────────────────────────────────────────
function BacktestScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.backtestIn, T.tradeIn);
  const lf = frame - T.backtestIn;

  const metrics = [
    { label: "Total Trades",    value: "187",    sub: "2-year backtest on AAPL",         color: "#38bdf8" },
    { label: "Win Rate",        value: "63.1%",  sub: "118 winners · 69 losers",          color: "#22c55e" },
    { label: "Avg Winner",      value: "+1.9%",  sub: "Average profitable trade return",  color: "#22c55e" },
    { label: "Avg Loser",       value: "−1.2%",  sub: "Average losing trade return",      color: "#f87171" },
    { label: "Profit Factor",   value: "2.0×",   sub: "$2 earned per $1 lost",            color: "#f59e0b" },
    { label: "Total Return",    value: "34.2%",  sub: "vs. Buy-and-Hold: 28.7%",          color: "#22c55e" },
    { label: "Sharpe Ratio",    value: "1.52",   sub: ">1.0 = strong risk-adjusted perf", color: "#a78bfa" },
    { label: "Max Drawdown",    value: "−8.3%",  sub: "Worst peak-to-trough loss",        color: "#f87171" },
    { label: "Alpha",           value: "+5.5%",  sub: "Excess return vs. buy-and-hold",  color: "#22c55e" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Backtesting</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>2-Year AAPL Backtest — Walk-Forward Validated</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {metrics.map((m, i) => {
          const cardOp = ci(lf, [i * 6, i * 6 + 25], [0, 1]);
          const cardY = ci(lf, [i * 6, i * 6 + 25], [16, 0]);
          return (
            <div key={m.label} style={{ opacity: cardOp, transform: `translateY(${cardY}px)`, padding: "16px 18px", background: "rgba(255,255,255,0.05)", borderRadius: 10, borderTop: `3px solid ${m.color}` }}>
              <div style={{ color: m.color, fontSize: 28, fontWeight: 800 }}>{m.value}</div>
              <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, marginTop: 4 }}>{m.label}</div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{m.sub}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 10: Live Trade Walkthrough ──────────────────────────────────────────
function TradeScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.tradeIn, T.pitfallsIn);
  const lf = frame - T.tradeIn;

  const events = [
    { day: "Feb 13", price: "184.12", event: "Close — features computed", note: "RSI 38.4 · MACD cross · BB lower",     color: "#64748b" },
    { day: "Feb 14", price: "184.92", event: "EOD — model run", note: "P(UP)=0.71 · magnitude +1.6% → STRONG BUY", color: "#22c55e" },
    { day: "Feb 15 open", price: "185.10", event: "ENTRY — 31 shares bought", note: "Limit at 185.10 · cost $5,738.10",     color: "#38bdf8" },
    { day: "Feb 15 close", price: "187.68", event: "TARGET TRIGGERED — exit", note: "31 × $2.58 = $80.00 profit in 1 day",  color: "#f59e0b" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Live Trade Example</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 28 }}>AAPL — February 2024 Trade Walkthrough</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {events.map((e, i) => {
          const rowOp = ci(lf, [i * 18, i * 18 + 35], [0, 1]);
          const rowX = ci(lf, [i * 18, i * 18 + 35], [-30, 0]);
          return (
            <div key={e.day} style={{ opacity: rowOp, transform: `translateX(${rowX}px)`, display: "flex", gap: 20, alignItems: "center", padding: "16px 20px", background: "rgba(255,255,255,0.05)", borderRadius: 12, borderLeft: `4px solid ${e.color}` }}>
              <div style={{ minWidth: 100 }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>{e.day}</div>
                <div style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800 }}>{e.price}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: e.color, fontSize: 15, fontWeight: 700 }}>{e.event}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{e.note}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: ci(lf, [90, 110], [0, 1]), marginTop: 20, padding: "16px 24px", background: "rgba(34,197,94,0.1)", borderRadius: 12, border: "1px solid rgba(34,197,94,0.4)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#22c55e", fontSize: 18, fontWeight: 800 }}>Trade result: +$80.00</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>+1.39% return on $5,738 deployed · 1 trading day</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700 }}>Prediction: +1.6%</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>Actual: +1.39% — within model interval</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 11: Pitfalls ────────────────────────────────────────────────────────
function PitfallsScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.pitfallsIn, T.summaryIn);
  const lf = frame - T.pitfallsIn;

  const pitfalls = [
    {
      title: "Overfitting",
      icon: "🔄",
      color: "#f87171",
      desc: "Model trained on 2022 data may fail in 2024 as market regimes change.",
      fix: "Always walk-forward validate on unseen data periods.",
    },
    {
      title: "Look-Ahead Bias",
      icon: "⏰",
      color: "#fbbf24",
      desc: "Using today's close to compute today's RSI — this data wasn't available before today's trade.",
      fix: "Use only data available at decision time (prior session's close).",
    },
    {
      title: "Transaction Costs",
      icon: "💸",
      color: "#a78bfa",
      desc: "187 trades/year × $0.05 spread = $935/year in gross costs.",
      fix: "Model costs explicitly. Net alpha must exceed all-in cost.",
    },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a2744)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Critical Warnings</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 28 }}>Three Pitfalls That Destroy ML Strategies</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {pitfalls.map((p, i) => {
          const cardOp = ci(lf, [i * 20, i * 20 + 35], [0, 1]);
          const cardY = ci(lf, [i * 20, i * 20 + 35], [24, 0]);
          return (
            <div key={p.title} style={{ opacity: cardOp, transform: `translateY(${cardY}px)`, display: "flex", gap: 20, padding: "20px 24px", background: "rgba(255,255,255,0.04)", borderRadius: 12, borderLeft: `4px solid ${p.color}` }}>
              <div style={{ fontSize: 32 }}>{p.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: p.color, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{p.title}</div>
                <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>{p.desc}</div>
                <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 600 }}>Fix: {p.fix}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 12: Summary ─────────────────────────────────────────────────────────
function SummaryScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.summaryIn, null);
  const lf = frame - T.summaryIn;
  const scale = spring({ frame: lf, fps, config: { damping: 14, stiffness: 70 } });

  const results = [
    { label: "Directional Accuracy", value: "63%",   color: "#38bdf8" },
    { label: "Annual Return",        value: "34.2%", color: "#22c55e" },
    { label: "Sharpe Ratio",         value: "1.52",  color: "#a78bfa" },
    { label: "Max Drawdown",         value: "−8.3%", color: "#f87171" },
  ];

  const features = [["RSI-14", "#f59e0b"], ["MACD crossover", "#22c55e"], ["Bollinger Band", "#a78bfa"]];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f)", opacity: op, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ transform: `scale(${scale})`, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ color: "#38bdf8", fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Performance Summary</div>
          <div style={{ color: "#f1f5f9", fontSize: 46, fontWeight: 800 }}>ML Stock Trading — AAPL</div>
          <div style={{ color: "#64748b", fontSize: 18, marginTop: 8 }}>2-Year Backtest · Walk-Forward Validated</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {results.map((r, i) => {
            const cardOp = ci(lf, [20 + i * 10, 45 + i * 10], [0, 1]);
            return (
              <div key={r.label} style={{ opacity: cardOp, textAlign: "center", padding: "20px 16px", background: "rgba(255,255,255,0.06)", borderRadius: 12, borderTop: `3px solid ${r.color}` }}>
                <div style={{ color: r.color, fontSize: 36, fontWeight: 800 }}>{r.value}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>{r.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ opacity: ci(lf, [55, 75], [0, 1]), padding: "16px 24px", background: "rgba(56,189,248,0.08)", borderRadius: 12, border: "1px solid rgba(56,189,248,0.2)", textAlign: "center" }}>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 10 }}>Top Predictive Features</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            {features.map(([f, c]) => (
              <span key={f} style={{ color: c, fontSize: 16, fontWeight: 700, background: `${c}22`, padding: "6px 18px", borderRadius: 20 }}>{f}</span>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Main Composition ──────────────────────────────────────────────────────────
export function StockTrading() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0f172a" }}>
      {/* Audio clips */}
      {STOCK_CLIPS.map(({ file, start }) => (
        <Sequence key={file} from={start}>
          <Html5Audio src={staticFile(`audio/${file}.mp3`)} />
        </Sequence>
      ))}

      {/* Top-left org watermark */}
      <div style={{ position: "absolute", top: 16, left: 20, fontFamily: "Arial,sans-serif", fontSize: 13, color: "rgba(148,163,184,0.6)", fontWeight: 600, letterSpacing: 1 }}>{ORG}</div>

      {/* Scenes */}
      {frame >= T.titleIn     && frame < T.dataIn      + 30 && <TitleScene     frame={frame} />}
      {frame >= T.dataIn      && frame < T.featuresIn  + 30 && <DataScene      frame={frame} />}
      {frame >= T.featuresIn  && frame < T.directionIn + 30 && <FeaturesScene  frame={frame} />}
      {frame >= T.directionIn && frame < T.magnitudeIn + 30 && <DirectionScene frame={frame} />}
      {frame >= T.magnitudeIn && frame < T.signalIn    + 30 && <MagnitudeScene frame={frame} />}
      {frame >= T.signalIn    && frame < T.execIn      + 30 && <SignalScene    frame={frame} />}
      {frame >= T.execIn      && frame < T.riskIn      + 30 && <ExecScene      frame={frame} />}
      {frame >= T.riskIn      && frame < T.backtestIn  + 30 && <RiskScene      frame={frame} />}
      {frame >= T.backtestIn  && frame < T.tradeIn     + 30 && <BacktestScene  frame={frame} />}
      {frame >= T.tradeIn     && frame < T.pitfallsIn  + 30 && <TradeScene     frame={frame} />}
      {frame >= T.pitfallsIn  && frame < T.summaryIn   + 30 && <PitfallsScene  frame={frame} />}
      {frame >= T.summaryIn   && <SummaryScene frame={frame} />}

      <BrandBar frame={frame} />
    </AbsoluteFill>
  );
}
