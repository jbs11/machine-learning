import {
  AbsoluteFill, Html5Audio, Img, Sequence, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

const ORG = "Artificial Intelligence Solutions, Inc.";

// ── Video Duration & Scene Timing ─────────────────────────────────────────────
export const FUTURES_DURATION = 14953;

const T = {
  titleIn:      0,
  fundamentalsIn: 717,
  featuresIn:   1729,
  esDirectionIn:2811,
  magnitudeIn:  4095,
  signalIn:     5173,
  execIn:       6319,
  riskMathIn:   7559,
  crudeIn:      9249,
  goldIn:       10700,
  rollIn:       12218,
  summaryIn:    13427,
};

const FUTURES_CLIPS = [
  { file: "futures-01", start: 0,     dur: 687  }, // ends 687
  { file: "futures-02", start: 717,   dur: 982  }, // ends 1699
  { file: "futures-03", start: 1729,  dur: 1052 }, // ends 2781
  { file: "futures-04", start: 2811,  dur: 1254 }, // ends 4065
  { file: "futures-05", start: 4095,  dur: 1048 }, // ends 5143
  { file: "futures-06", start: 5173,  dur: 1116 }, // ends 6289
  { file: "futures-07", start: 6319,  dur: 1210 }, // ends 7529
  { file: "futures-08", start: 7559,  dur: 1660 }, // ends 9219
  { file: "futures-09", start: 9249,  dur: 1421 }, // ends 10670
  { file: "futures-10", start: 10700, dur: 1488 }, // ends 12188
  { file: "futures-11", start: 12218, dur: 1179 }, // ends 13397
  { file: "futures-12", start: 13427, dur: 1436 }, // ends 14863
];

// ── Seeded PRNG ───────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// ── ES futures synthetic data ─────────────────────────────────────────────────
function generateESData() {
  const rng = seededRng(20240201);
  const data = [];
  let price = 4900;
  for (let i = 0; i < 60; i++) {
    const trend = i < 20 ? 0.0012 : i < 35 ? -0.0015 : 0.0018;
    const noise = (rng() - 0.5) * 0.018;
    price = price * (1 + trend + noise);
    data.push(Math.round(price));
  }
  return data;
}
const ES_DATA = generateESData();

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
    <div style={{ position: "absolute", bottom: 18, right: 20, display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.62)", borderRadius: 30, padding: "6px 14px 6px 8px", opacity: op }}>
      <Img src={staticFile("images/steve.jpg")} style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #f59e0b", objectFit: "cover" }} />
      <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, fontFamily: "Arial,sans-serif" }}>{ORG}</span>
    </div>
  );
}

// ── Scene 1: Title ────────────────────────────────────────────────────────────
function TitleScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.titleIn, T.fundamentalsIn);
  const scale = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const sub = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a 0%,#1c1407 60%,#0c1a00 100%)", opacity: op, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, color: "#f59e0b", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>Module 6 · Applied ML</div>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 72, color: "#f1f5f9", fontWeight: 700, lineHeight: 1.1, marginBottom: 20 }}>ML in<br /><span style={{ color: "#f59e0b" }}>Futures Trading</span></div>
        <div style={{ width: 80, height: 4, background: "linear-gradient(90deg,#f59e0b,#ef4444)", borderRadius: 2, margin: "0 auto 28px" }} />
      </div>
      <div style={{ opacity: sub, textAlign: "center" }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, color: "#94a3b8" }}>ES · CL · GC · Leverage Math · Margin · 72% Direction Accuracy</div>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 17, color: "#64748b", marginTop: 10 }}>{ORG}</div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 2: Fundamentals ─────────────────────────────────────────────────────
function FundamentalsScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.fundamentalsIn, T.featuresIn);
  const lf = frame - T.fundamentalsIn;

  const contracts = [
    { ticker: "ES", name: "E-mini S&P 500", mult: "$50/point", margin: "$12,650", tick: "$12.50", note: "Most liquid equity index futures in the world" },
    { ticker: "CL", name: "Crude Oil",      mult: "$1,000/barrel", margin: "$5,800", tick: "$10.00", note: "1,000 barrels per contract — 80% global benchmark" },
    { ticker: "GC", name: "Gold",           mult: "$100/troy oz", margin: "$9,500", tick: "$10.00", note: "100 troy ounces — safe haven and inflation hedge" },
    { ticker: "NQ", name: "E-mini Nasdaq",  mult: "$20/point", margin: "$17,600", tick: "$5.00",  note: "Tech-heavy index — higher volatility than ES" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Futures Fundamentals</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>Key Contracts, Tick Values & Margin Requirements</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {contracts.map((c, i) => {
          const rowOp = ci(lf, [i * 12, i * 12 + 30], [0, 1]);
          const rowX = ci(lf, [i * 12, i * 12 + 30], [-24, 0]);
          return (
            <div key={c.ticker} style={{ opacity: rowOp, transform: `translateX(${rowX}px)`, display: "grid", gridTemplateColumns: "80px 180px 1fr 1fr 1fr", gap: 16, padding: "14px 20px", background: "rgba(255,255,255,0.05)", borderRadius: 10, alignItems: "center" }}>
              <div style={{ color: "#f59e0b", fontSize: 22, fontWeight: 800 }}>{c.ticker}</div>
              <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>{c.name}</div>
              <div>
                <div style={{ color: "#64748b", fontSize: 11 }}>Point value</div>
                <div style={{ color: "#38bdf8", fontSize: 15, fontWeight: 700 }}>{c.mult}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 11 }}>Init. margin</div>
                <div style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700 }}>{c.margin}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: 11 }}>Min tick</div>
                <div style={{ color: "#a78bfa", fontSize: 15, fontWeight: 700 }}>{c.tick}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: ci(lf, [55, 75], [0, 1]), marginTop: 20, padding: "14px 20px", background: "rgba(245,158,11,0.1)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)" }}>
        <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 14 }}>ES example: </span>
        <span style={{ color: "#94a3b8", fontSize: 14 }}>5,000 index points × $50/point = $250,000 notional for $12,650 margin → 19.8× leverage</span>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 3: Feature Engineering ─────────────────────────────────────────────
function FuturesFeaturesScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.featuresIn, T.esDirectionIn);
  const lf = frame - T.featuresIn;

  const featureGroups = [
    {
      category: "Price / Technical",
      color: "#38bdf8",
      features: ["RSI-14", "MACD signal line", "ATR-14 (volatility)", "5-day vs. 20-day return spread"],
    },
    {
      category: "Open Interest & Volume",
      color: "#22c55e",
      features: ["Daily OI change", "OI × price direction (conviction)", "Volume ratio vs. 20-day avg", "Put/call ratio (options market)"],
    },
    {
      category: "Macro & Regime",
      color: "#a78bfa",
      features: ["VIX level", "Fed funds rate direction", "10-yr yield vs. 3-mo spread", "USD Index daily return"],
    },
    {
      category: "Commodity-Specific (CL/GC)",
      color: "#f59e0b",
      features: ["EIA inventory surprise", "Baker Hughes rig count", "Crack spread (CL)", "Real rates — TIPS yield (GC)"],
    },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Feature Engineering</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>22-Variable Futures Feature Vector</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {featureGroups.map((g, i) => {
          const cardOp = ci(lf, [i * 12, i * 12 + 30], [0, 1]);
          return (
            <div key={g.category} style={{ opacity: cardOp, padding: "16px 20px", background: "rgba(255,255,255,0.05)", borderRadius: 12, borderLeft: `4px solid ${g.color}` }}>
              <div style={{ color: g.color, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{g.category}</div>
              {g.features.map((f, j) => (
                <div key={f} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                  <span style={{ color: g.color, fontSize: 14 }}>•</span>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{f}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ opacity: ci(lf, [60, 80], [0, 1]), marginTop: 16, padding: "12px 20px", background: "rgba(56,189,248,0.08)", borderRadius: 10 }}>
        <span style={{ color: "#38bdf8", fontWeight: 700, fontSize: 13 }}>Top features by importance: </span>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>VIX level, OI change, 5-day return spread — these three alone drive 38% of model prediction weight</span>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 4: ES Direction ─────────────────────────────────────────────────────
function ESDirectionScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.esDirectionIn, T.magnitudeIn);
  const lf = frame - T.esDirectionIn;

  const chartW = 480, chartH = 180;
  const prices = ES_DATA;
  const minP = Math.min(...prices) - 20, maxP = Math.max(...prices) + 20;
  const px = (i) => (i / (prices.length - 1)) * chartW;
  const py = (v) => chartH - ((v - minP) / (maxP - minP)) * chartH;
  const visCount = Math.min(prices.length, Math.floor(ci(lf, [0, 50], [0, prices.length])));
  const pts = prices.slice(0, visCount).map((v, i) => `${px(i)},${py(v)}`).join(" ");

  const probW = ci(lf, [30, 70], [0, 69]);

  const matrix = [
    { label: "TP",  val: 74, desc: "Predicted UP → UP",   color: "#22c55e" },
    { label: "TN",  val: 70, desc: "Predicted DOWN → DOWN", color: "#38bdf8" },
    { label: "FP",  val: 29, desc: "Predicted UP → DOWN", color: "#f87171" },
    { label: "FN",  val: 27, desc: "Predicted DOWN → UP", color: "#fbbf24" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>ES Direction Prediction</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 20 }}>Random Forest — 72% Accuracy on 200 Test Sessions</div>
      <div style={{ display: "flex", gap: 28 }}>
        {/* Chart + prob */}
        <div style={{ flex: 1 }}>
          <svg width={chartW} height={chartH + 8} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 14 }}>
            {[0.25, 0.5, 0.75].map(t => <line key={t} x1={0} y1={t * chartH} x2={chartW} y2={t * chartH} stroke="#334155" strokeWidth={1} />)}
            {visCount > 1 && <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth={2} />}
          </svg>
          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>ES Futures — 60-session price history (points)</div>
          <div style={{ padding: "14px", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>Today's direction probability (UP)</div>
            <div style={{ background: "#1e293b", borderRadius: 6, height: 24, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${probW}%`, height: "100%", background: "linear-gradient(90deg,#f59e0b,#22c55e)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>0.0</span>
              <span style={{ color: "#22c55e", fontSize: 26, fontWeight: 800 }}>0.69</span>
              <span style={{ color: "#64748b", fontSize: 12 }}>1.0</span>
            </div>
          </div>
        </div>
        {/* Confusion matrix */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Out-of-sample confusion matrix (200 sessions)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {matrix.map((m, i) => {
              const cardOp = ci(lf, [35 + i * 8, 60 + i * 8], [0, 1]);
              return (
                <div key={m.label} style={{ opacity: cardOp, padding: "14px 16px", background: `${m.color}18`, borderRadius: 10, border: `1px solid ${m.color}44` }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: m.color, fontSize: 11, fontWeight: 700 }}>{m.label}</span>
                    <span style={{ color: m.color, fontSize: 26, fontWeight: 800 }}>{m.val}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.1)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)" }}>
            <div style={{ color: "#f59e0b", fontSize: 16, fontWeight: 700 }}>Accuracy: 72%</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>74+70 correct out of 200 = 72%</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 5: Magnitude ────────────────────────────────────────────────────────
function MagnitudeScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.magnitudeIn, T.signalIn);
  const lf = frame - T.magnitudeIn;

  const barProgress = ci(lf, [20, 65], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Magnitude Prediction</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 28 }}>ES Futures — Points Prediction → Dollar P&L</div>
      <div style={{ display: "flex", gap: 28 }}>
        <div style={{ flex: 1.2, padding: 22, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Gradient Boost Regressor Output — Today's ES</div>
          <div style={{ position: "relative", height: 70, background: "#1e293b", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "20%", top: 0, width: 2, height: "100%", background: "#475569" }} />
            <div style={{ position: "absolute", left: `${20 + (8 / 40) * 55 * barProgress}%`, top: "20%", height: "60%", width: `${((32 - 8) / 40) * 55 * barProgress}%`, background: "rgba(245,158,11,0.3)", border: "1px solid rgba(245,158,11,0.5)", borderRadius: 4 }} />
            <div style={{ position: "absolute", left: `${20 + (18.4 / 40) * 55 * barProgress}%`, top: "10%", height: "80%", width: 3, background: "#22c55e", borderRadius: 2 }} />
            <div style={{ position: "absolute", top: 4, left: "19%", color: "#64748b", fontSize: 11 }}>0</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>
            <span>Low: <strong style={{ color: "#f59e0b" }}>+8 pts</strong></span>
            <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 18 }}>Predicted: +18.4 pts</span>
            <span>High: <strong style={{ color: "#f59e0b" }}>+32 pts</strong></span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Predicted move", "+18.4 pts", "#22c55e"], ["Dollar value", "+$920/contract", "#f59e0b"], ["Conservative target", "15 pts = +$750", "#38bdf8"], ["Stop distance", "8 pts = −$400", "#f87171"]].map(([k, v, c]) => (
              <div key={k} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontSize: 11 }}>{k}</div>
                <div style={{ color: c, fontSize: 17, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Trade Economics</div>
          {[
            ["ES current price", "5,010 pts", "#f1f5f9"],
            ["Entry (prior high)", "5,018 pts", "#f59e0b"],
            ["Profit target", "5,033 pts", "#22c55e"],
            ["Stop-loss", "5,010 pts", "#f87171"],
            ["Target $", "+$750/contract", "#22c55e"],
            ["Risk $", "-$400/contract", "#f87171"],
            ["Risk:Reward", "1.875 : 1", "#a78bfa"],
          ].map(([k, v, c], i) => {
            const rowOp = ci(lf, [30 + i * 6, 55 + i * 6], [0, 1]);
            return (
              <div key={k} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "#64748b", fontSize: 13 }}>{k}</span>
                <span style={{ color: c, fontSize: 13, fontWeight: 700 }}>{v}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 6: Signal & Entry Rules ─────────────────────────────────────────────
function SignalScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.signalIn, T.execIn);
  const lf = frame - T.signalIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Entry Signal</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 24 }}>Reading the ES Trade Signal — Complete Process</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {/* Signal components */}
        <div>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Model Components</div>
          {[
            { label: "Direction probability", val: "0.69", threshold: "≥0.65 → enter", color: "#22c55e", pass: true },
            { label: "Predicted magnitude", val: "+18.4 pts", threshold: "≥10 pts → enter", color: "#22c55e", pass: true },
            { label: "Signal strength", val: "MODERATE-STRONG", threshold: "Any qualifying", color: "#f59e0b", pass: true },
            { label: "VIX filter", val: "VIX=18.4", threshold: "< 30 → enter", color: "#22c55e", pass: true },
          ].map((r, i) => {
            const rowOp = ci(lf, [i * 10, i * 10 + 28], [0, 1]);
            return (
              <div key={r.label} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: r.pass ? "rgba(34,197,94,0.08)" : "rgba(248,113,113,0.08)", borderRadius: 8, marginBottom: 8, border: `1px solid ${r.pass ? "rgba(34,197,94,0.3)" : "rgba(248,113,113,0.3)"}` }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{r.label}</div>
                  <div style={{ color: r.color, fontSize: 16, fontWeight: 700 }}>{r.val}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#64748b", fontSize: 11 }}>{r.threshold}</div>
                  <div style={{ color: r.pass ? "#22c55e" : "#f87171", fontSize: 14, fontWeight: 700 }}>{r.pass ? "✓ PASS" : "✗ FAIL"}</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Entry checklist */}
        <div>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Entry Checklist</div>
          {[
            { step: "1. Model runs at market close", detail: "Use prior session's close data — no look-ahead", color: "#38bdf8" },
            { step: "2. Wait for price confirmation", detail: "ES must trade above 5,018 (prior day high) before entering", color: "#f59e0b" },
            { step: "3. Place buy stop at 5,018", detail: "Stop order triggers automatically on breakout", color: "#22c55e" },
            { step: "4. Set time stop", detail: "Close if not triggered by end of session 2", color: "#a78bfa" },
          ].map((s, i) => {
            const rowOp = ci(lf, [30 + i * 12, 55 + i * 12], [0, 1]);
            return (
              <div key={s.step} style={{ opacity: rowOp, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 10, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ color: s.color, fontSize: 13, fontWeight: 700 }}>{s.step}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{s.detail}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 7: Execution ────────────────────────────────────────────────────────
function ExecScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.execIn, T.riskMathIn);
  const lf = frame - T.execIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Execution</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 24 }}>Placing the ES Futures Trade</div>
      <div style={{ display: "flex", gap: 28 }}>
        {/* Order ticket */}
        <div style={{ flex: 1.1, padding: 22, background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 16, textTransform: "uppercase", letterSpacing: 2 }}>Order Ticket</div>
          {[
            ["Instrument", "ES (E-mini S&P 500)", "#f1f5f9"],
            ["Side", "BUY", "#22c55e"],
            ["Quantity", "1 contract", "#f1f5f9"],
            ["Order type", "BUY STOP", "#f59e0b"],
            ["Stop price", "5,018.00", "#f1f5f9"],
            ["Take-profit", "5,033.00 (limit)", "#22c55e"],
            ["Stop-loss", "5,010.00 (market)", "#f87171"],
            ["Time stop", "EOD session 2", "#a78bfa"],
          ].map(([k, v, c], i) => {
            const rowOp = ci(lf, [i * 6, i * 6 + 22], [0, 1]);
            return (
              <div key={k} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ color: "#64748b", fontSize: 14 }}>{k}</span>
                <span style={{ color: c, fontSize: 14, fontWeight: 600 }}>{v}</span>
              </div>
            );
          })}
        </div>
        {/* Margin breakdown */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 16, textTransform: "uppercase", letterSpacing: 2 }}>Margin Requirements</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { k: "Initial margin", v: "$12,650", detail: "Required to open the position", color: "#f59e0b" },
              { k: "Maintenance margin", v: "$11,500", detail: "Minimum to hold overnight", color: "#f87171" },
              { k: "Margin call trigger", v: "−$1,150 loss", detail: "Broker liquidates if not topped up", color: "#f87171" },
              { k: "Day trading margin", v: "$1,000–$2,500", detail: "Intraday reduced margin (broker dependent)", color: "#38bdf8" },
            ].map((m, i) => {
              const rowOp = ci(lf, [30 + i * 10, 55 + i * 10], [0, 1]);
              return (
                <div key={m.k} style={{ opacity: rowOp, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10, borderLeft: `3px solid ${m.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>{m.k}</span>
                    <span style={{ color: m.color, fontSize: 15, fontWeight: 700 }}>{m.v}</span>
                  </div>
                  <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{m.detail}</div>
                </div>
              );
            })}
          </div>
          <div style={{ opacity: ci(lf, [65, 85], [0, 1]), marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.1)", borderRadius: 8 }}>
            <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700 }}>$50K account: 1 contract, risk $400 = 0.8%</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 8: Risk Mathematics ─────────────────────────────────────────────────
function RiskMathScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.riskMathIn, T.crudeIn);
  const lf = frame - T.riskMathIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Risk Mathematics</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 24 }}>Futures Leverage Math — Every Trade Must Be Sized</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Leverage calc */}
        <div style={{ padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#38bdf8", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>ES Leverage Calculation</div>
          {[
            ["Contract notional", "5,010 × $50", "$250,500"],
            ["Initial margin", "Required deposit", "$12,650"],
            ["Leverage ratio", "250,500 ÷ 12,650", "19.8×"],
            ["1% adverse move", "50 pts × $50", "−$2,500 loss"],
            ["% of margin lost", "2,500 ÷ 12,650", "19.8% of margin"],
          ].map(([k, formula, v], i) => {
            const rowOp = ci(lf, [i * 8, i * 8 + 25], [0, 1]);
            return (
              <div key={k} style={{ opacity: rowOp, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{k}</span>
                  <span style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700 }}>{v}</span>
                </div>
                <div style={{ color: "#475569", fontSize: 11, fontFamily: "monospace" }}>{formula}</div>
              </div>
            );
          })}
        </div>
        {/* Position sizing formula */}
        <div style={{ padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#a78bfa", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Position Sizing Formula</div>
          <div style={{ background: "#1e293b", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontFamily: "monospace", fontSize: 13, color: "#e2e8f0", lineHeight: 1.8 }}>
            contracts = (account × risk%) ÷ stop$<br />
            = (50,000 × 0.01) ÷ 400<br />
            = 500 ÷ 400 = 1.25<br />
            → <span style={{ color: "#22c55e", fontWeight: 700 }}>trade 1 contract (round down)</span>
          </div>
          <div style={{ color: "#38bdf8", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Value at Risk (95% confidence)</div>
          <div style={{ background: "#1e293b", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontFamily: "monospace", fontSize: 13, color: "#94a3b8" }}>
            Based on 252 historical sessions:<br />
            95th percentile 1-day loss = <span style={{ color: "#f87171", fontWeight: 700 }}>$2,840/contract</span>
          </div>
          <div style={{ opacity: ci(lf, [65, 85], [0, 1]), padding: "10px 14px", background: "rgba(245,158,11,0.1)", borderRadius: 8 }}>
            <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700 }}>Rule: ALWAYS round down on contract count</div>
            <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>Never round up when leverage is involved</div>
          </div>
        </div>
      </div>
      {/* VaR summary strip */}
      <div style={{ opacity: ci(lf, [80, 100], [0, 1]), marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[["ES VaR (95%)", "$2,840/day", "#f87171"], ["CL VaR (95%)", "$1,920/day", "#f59e0b"], ["GC VaR (95%)", "$2,140/day", "#f59e0b"], ["Max position size", "1 contract ($50K)", "#22c55e"]].map(([k, v, c]) => (
          <div key={k} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, textAlign: "center" }}>
            <div style={{ color: "#64748b", fontSize: 11 }}>{k}</div>
            <div style={{ color: c, fontSize: 15, fontWeight: 700, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 9: Crude Oil ────────────────────────────────────────────────────────
function CrudeScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.crudeIn, T.goldIn);
  const lf = frame - T.crudeIn;

  const features = [
    { name: "EIA inventory surprise", detail: "Draw = bullish · Build = bearish · Every Wed 10:30 AM ET", color: "#22c55e" },
    { name: "Baker Hughes rig count", detail: "Rising rigs = supply increase → bearish long-term signal", color: "#f59e0b" },
    { name: "Crack spread (3:2:1)", detail: "Refinery profit margin — high crack spread = strong demand", color: "#38bdf8" },
    { name: "OPEC announcements", detail: "Production cuts → bullish spike · Quota increases → bearish", color: "#f87171" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Crude Oil Futures</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 8 }}>CL — 61% Accuracy · $1,840 per Contract Example</div>
      <div style={{ color: "#64748b", fontSize: 14, marginBottom: 22 }}>XGBoost trained on commodity-specific ML inputs — 1,000 barrels per contract</div>
      <div style={{ display: "flex", gap: 28 }}>
        <div style={{ flex: 1.2 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Commodity-Specific Feature Set</div>
          {features.map((f, i) => {
            const rowOp = ci(lf, [i * 12, i * 12 + 28], [0, 1]);
            return (
              <div key={f.name} style={{ opacity: rowOp, marginBottom: 12, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10, borderLeft: `3px solid ${f.color}` }}>
                <div style={{ color: f.color, fontSize: 14, fontWeight: 700 }}>{f.name}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{f.detail}</div>
              </div>
            );
          })}
        </div>
        {/* Jan 2024 trade */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>January 2024 Trade Example</div>
          <div style={{ padding: "18px 20px", background: "rgba(245,158,11,0.08)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)" }}>
            {[
              ["ML Signal", "P(UP)=0.74 · magnitude +$2.30/bbl", "#f59e0b"],
              ["Entry", "$79.80/bbl · 1 contract", "#f1f5f9"],
              ["Target", "$82.10 (+$2.30)", "#22c55e"],
              ["Stop", "$78.40 (−$1.40)", "#f87171"],
              ["Sessions held", "3 trading days", "#38bdf8"],
              ["Exit price", "$81.64/bbl", "#22c55e"],
              ["Profit", "$1,840 per contract", "#22c55e"],
              ["Return on margin", "31.7% in 3 days", "#a78bfa"],
            ].map(([k, v, c], i) => {
              const rowOp = ci(lf, [30 + i * 7, 55 + i * 7], [0, 1]);
              return (
                <div key={k} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{k}</span>
                  <span style={{ color: c, fontSize: 13, fontWeight: 700 }}>{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 10: Gold ────────────────────────────────────────────────────────────
function GoldScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.goldIn, T.rollIn);
  const lf = frame - T.goldIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Gold Futures</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 8 }}>GC — 68% Accuracy · LSTM Sequential Pattern Recognition</div>
      <div style={{ color: "#64748b", fontSize: 14, marginBottom: 22 }}>100 troy oz per contract · $2,800 profit per 28-point move</div>
      <div style={{ display: "flex", gap: 28 }}>
        {/* LSTM inputs */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>LSTM 60-Day Input Sequence</div>
          {[
            { name: "Gold price (GC)", role: "Primary price series", color: "#f59e0b" },
            { name: "US Dollar Index (DXY)", role: "Inverse correlation −0.72 with gold", color: "#38bdf8" },
            { name: "10-yr TIPS yield", role: "Real rate proxy — key gold driver", color: "#a78bfa" },
            { name: "VIX", role: "Safe haven demand signal", color: "#f87171" },
          ].map((f, i) => {
            const rowOp = ci(lf, [i * 12, i * 12 + 28], [0, 1]);
            return (
              <div key={f.name} style={{ opacity: rowOp, marginBottom: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, borderLeft: `3px solid ${f.color}` }}>
                <div style={{ color: f.color, fontSize: 14, fontWeight: 700 }}>{f.name}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{f.role}</div>
              </div>
            );
          })}
        </div>
        {/* March 2024 trade */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>March 4 Trade Example</div>
          <div style={{ padding: "18px 20px", background: "rgba(245,158,11,0.08)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", marginBottom: 14 }}>
            {[
              ["Gold price", "$2,050/oz", "#f1f5f9"],
              ["LSTM signal", "P(UP)=0.71 · predicted +$28/oz", "#22c55e"],
              ["Entry", "$2,052/oz", "#f59e0b"],
              ["Target", "$2,078 (+$26/oz)", "#22c55e"],
              ["Stop-loss", "$2,038 (−$14/oz)", "#f87171"],
              ["Dollar stop", "100 oz × $14 = $1,400", "#f87171"],
              ["R:R ratio", "2.0 : 1", "#a78bfa"],
              ["Result (4 sessions)", "+$2,600/contract", "#22c55e"],
            ].map(([k, v, c], i) => {
              const rowOp = ci(lf, [20 + i * 7, 45 + i * 7], [0, 1]);
              return (
                <div key={k} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{k}</span>
                  <span style={{ color: c, fontSize: 13, fontWeight: 700 }}>{v}</span>
                </div>
              );
            })}
          </div>
          <div style={{ opacity: ci(lf, [65, 85], [0, 1]), padding: "10px 14px", background: "rgba(167,139,250,0.1)", borderRadius: 8 }}>
            <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>LSTM captures multi-week dollar weakness trend</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 11: Roll & Seasonality ──────────────────────────────────────────────
function RollScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.rollIn, T.summaryIn);
  const lf = frame - T.rollIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Roll Strategy & Seasonality</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 28 }}>Contract Roll Yield + Seasonal ML Signals</div>
      <div style={{ display: "flex", gap: 24 }}>
        {/* Roll yield */}
        <div style={{ flex: 1, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#38bdf8", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Contract Roll Yield</div>
          {[
            { term: "Backwardation", desc: "Front-month HIGHER than back-month", effect: "Rolling = POSITIVE carry (earn the basis)", example: "CL: $80.50 front vs $79.80 back → +$700 roll income", color: "#22c55e" },
            { term: "Contango",      desc: "Front-month LOWER than back-month",  effect: "Rolling = NEGATIVE carry (pay the basis)", example: "CL: $80.00 front vs $81.20 back → −$1,200 roll cost", color: "#f87171" },
          ].map((r, i) => {
            const rowOp = ci(lf, [i * 22, i * 22 + 40], [0, 1]);
            return (
              <div key={r.term} style={{ opacity: rowOp, marginBottom: 14, padding: "14px 18px", background: `${r.color}12`, borderRadius: 10, border: `1px solid ${r.color}44` }}>
                <div style={{ color: r.color, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{r.term}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 6 }}>{r.desc}</div>
                <div style={{ color: r.color, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{r.effect}</div>
                <div style={{ color: "#475569", fontSize: 11, fontStyle: "italic" }}>{r.example}</div>
              </div>
            );
          })}
          <div style={{ opacity: ci(lf, [50, 70], [0, 1]), padding: "10px 14px", background: "rgba(56,189,248,0.1)", borderRadius: 8 }}>
            <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700 }}>Roll yield as ML feature → +3.8% accuracy in CL</div>
          </div>
        </div>
        {/* Seasonality */}
        <div style={{ flex: 1, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#f59e0b", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Seasonal ML Signals (1990–2024)</div>
          {[
            { months: "Nov–Jan", asset: "Natural Gas (NG)", stat: "73% bullish", detail: "Winter heating demand → consistent seasonal bid", color: "#22c55e" },
            { months: "Apr–Jun", asset: "Gasoline (RB)",    stat: "68% bullish", detail: "Driving season demand ahead of Memorial Day", color: "#f59e0b" },
            { months: "Jun–Aug", asset: "Crude Oil (CL)",   stat: "61% bullish", detail: "Peak driving season, low refinery inventory", color: "#38bdf8" },
            { months: "Sep–Oct", asset: "Gold (GC)",        stat: "65% bullish", detail: "Physical demand from India (Diwali jewelry buying)", color: "#f59e0b" },
          ].map((s, i) => {
            const rowOp = ci(lf, [25 + i * 10, 50 + i * 10], [0, 1]);
            return (
              <div key={s.months} style={{ opacity: rowOp, marginBottom: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{s.months} — {s.asset}</span>
                  <span style={{ color: s.color, fontSize: 13, fontWeight: 700 }}>{s.stat}</span>
                </div>
                <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{s.detail}</div>
              </div>
            );
          })}
        </div>
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

  const markets = [
    { name: "E-mini S&P 500 (ES)", acc: "72%", ret: "61%", sharpe: "2.10", dd: "−11.2%", color: "#38bdf8" },
    { name: "Crude Oil (CL)",       acc: "61%", ret: "48%", sharpe: "1.74", dd: "−13.8%", color: "#f59e0b" },
    { name: "Gold (GC)",            acc: "68%", ret: "53%", sharpe: "1.89", dd: "−9.7%",  color: "#f59e0b" },
    { name: "Combined Portfolio",   acc: "67%", ret: "54%", sharpe: "2.30", dd: "−9.4%",  color: "#22c55e" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1c1407)", opacity: op, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ transform: `scale(${scale})`, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ color: "#f59e0b", fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Performance Summary</div>
          <div style={{ color: "#f1f5f9", fontSize: 42, fontWeight: 800 }}>ML Futures Trading — 3 Markets</div>
          <div style={{ color: "#64748b", fontSize: 16, marginTop: 8 }}>Annualized return on margin · Walk-forward validated</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10, padding: "8px 16px" }}>
            {["Market", "Accuracy", "Return/Margin", "Sharpe", "Max DD"].map(h => (
              <div key={h} style={{ color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
          {markets.map((m, i) => {
            const rowOp = ci(lf, [15 + i * 10, 40 + i * 10], [0, 1]);
            const isCombined = m.name.includes("Combined");
            return (
              <div key={m.name} style={{ opacity: rowOp, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10, padding: "12px 16px", background: isCombined ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 8, border: isCombined ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent" }}>
                <span style={{ color: m.color, fontSize: 15, fontWeight: isCombined ? 800 : 600 }}>{m.name}</span>
                <span style={{ color: "#22c55e", fontSize: 15, fontWeight: 700 }}>{m.acc}</span>
                <span style={{ color: "#22c55e", fontSize: 15, fontWeight: 700 }}>{m.ret}</span>
                <span style={{ color: "#a78bfa", fontSize: 15, fontWeight: 700 }}>{m.sharpe}</span>
                <span style={{ color: "#f87171", fontSize: 15, fontWeight: 700 }}>{m.dd}</span>
              </div>
            );
          })}
        </div>
        <div style={{ opacity: ci(lf, [60, 80], [0, 1]), padding: "14px 20px", background: "rgba(245,158,11,0.08)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)", textAlign: "center" }}>
          <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 14 }}>Futures ML delivers the highest risk-adjusted returns in this course — </span>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>driven by leverage, 23-hour liquidity, and relatively inefficient short-term pricing</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Main Composition ──────────────────────────────────────────────────────────
export function FuturesTrading() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0f172a" }}>
      {FUTURES_CLIPS.map(({ file, start }) => (
        <Sequence key={file} from={start}>
          <Html5Audio src={staticFile(`audio/${file}.mp3`)} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", top: 16, left: 20, fontFamily: "Arial,sans-serif", fontSize: 13, color: "rgba(148,163,184,0.6)", fontWeight: 600, letterSpacing: 1 }}>{ORG}</div>

      {frame >= T.titleIn        && frame < T.fundamentalsIn  + 30 && <TitleScene         frame={frame} />}
      {frame >= T.fundamentalsIn && frame < T.featuresIn      + 30 && <FundamentalsScene  frame={frame} />}
      {frame >= T.featuresIn     && frame < T.esDirectionIn   + 30 && <FuturesFeaturesScene frame={frame} />}
      {frame >= T.esDirectionIn  && frame < T.magnitudeIn     + 30 && <ESDirectionScene   frame={frame} />}
      {frame >= T.magnitudeIn    && frame < T.signalIn        + 30 && <MagnitudeScene     frame={frame} />}
      {frame >= T.signalIn       && frame < T.execIn          + 30 && <SignalScene        frame={frame} />}
      {frame >= T.execIn         && frame < T.riskMathIn      + 30 && <ExecScene          frame={frame} />}
      {frame >= T.riskMathIn     && frame < T.crudeIn         + 30 && <RiskMathScene      frame={frame} />}
      {frame >= T.crudeIn        && frame < T.goldIn          + 30 && <CrudeScene         frame={frame} />}
      {frame >= T.goldIn         && frame < T.rollIn          + 30 && <GoldScene          frame={frame} />}
      {frame >= T.rollIn         && frame < T.summaryIn       + 30 && <RollScene          frame={frame} />}
      {frame >= T.summaryIn      && <SummaryScene frame={frame} />}

      <BrandBar frame={frame} />
    </AbsoluteFill>
  );
}
