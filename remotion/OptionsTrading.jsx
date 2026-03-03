import {
  AbsoluteFill, Html5Audio, Img, Sequence, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

const ORG = "Artificial Intelligence Solutions, Inc.";

// ── Video Duration & Scene Timing ─────────────────────────────────────────────
export const OPTIONS_DURATION = 13323;

const T = {
  titleIn:      0,
  fundamentalsIn: 619,
  greeksIn:     1482,
  directionIn:  2556,
  ivIn:         3598,
  matrixIn:     4499,
  execIn:       5546,
  managementIn: 6868,
  backtestIn:   8075,
  liveTradeIn:  9497,
  lossesIn:     11122,
  summaryIn:    12100,
};

const OPTIONS_CLIPS = [
  { file: "options-01", start: 0,     dur: 589  }, // ends 589
  { file: "options-02", start: 619,   dur: 833  }, // ends 1452
  { file: "options-03", start: 1482,  dur: 1044 }, // ends 2526
  { file: "options-04", start: 2556,  dur: 1012 }, // ends 3568
  { file: "options-05", start: 3598,  dur: 871  }, // ends 4469
  { file: "options-06", start: 4499,  dur: 1017 }, // ends 5516
  { file: "options-07", start: 5546,  dur: 1292 }, // ends 6838
  { file: "options-08", start: 6868,  dur: 1177 }, // ends 8045
  { file: "options-09", start: 8075,  dur: 1392 }, // ends 9467
  { file: "options-10", start: 9497,  dur: 1595 }, // ends 11092
  { file: "options-11", start: 11122, dur: 948  }, // ends 12070
  { file: "options-12", start: 12100, dur: 1133 }, // ends 13233
];

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
      <Img src={staticFile("images/steve.jpg")} style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #a78bfa", objectFit: "cover" }} />
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
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#0c0c2e 100%)", opacity: op, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, color: "#a78bfa", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>Module 5 · Applied ML</div>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 72, color: "#f1f5f9", fontWeight: 700, lineHeight: 1.1, marginBottom: 20 }}>ML in<br /><span style={{ color: "#a78bfa" }}>Options Trading</span></div>
        <div style={{ width: 80, height: 4, background: "linear-gradient(90deg,#a78bfa,#6366f1)", borderRadius: 2, margin: "0 auto 28px" }} />
      </div>
      <div style={{ opacity: sub, textAlign: "center" }}>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 22, color: "#94a3b8" }}>Delta · Gamma · Theta · Vega · IV Forecasting · Strategy Selection</div>
        <div style={{ fontFamily: "Arial,sans-serif", fontSize: 17, color: "#64748b", marginTop: 10 }}>{ORG}</div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 2: Options Fundamentals ─────────────────────────────────────────────
function FundamentalsScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.fundamentalsIn, T.greeksIn);
  const lf = frame - T.fundamentalsIn;

  const concepts = [
    { icon: "📞", title: "Call Option", desc: "Right to BUY 100 shares at strike price", example: "AAPL 185 Call → profit if AAPL > $185 by expiry", color: "#22c55e" },
    { icon: "📤", title: "Put Option",  desc: "Right to SELL 100 shares at strike price", example: "AAPL 185 Put → profit if AAPL < $185 by expiry",  color: "#f87171" },
    { icon: "💰", title: "Premium",     desc: "Price paid to buy the option contract",     example: "185 Call at $2.84 = $284 per contract (100 shares)", color: "#f59e0b" },
    { icon: "📊", title: "IV",          desc: "Market's forecast of future volatility",   example: "IV Rank 35% → moderate premium levels",           color: "#a78bfa" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Options Fundamentals</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>Calls, Puts, Premium & Implied Volatility</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {concepts.map((c, i) => {
          const cardOp = ci(lf, [i * 12, i * 12 + 30], [0, 1]);
          const cardY = ci(lf, [i * 12, i * 12 + 30], [20, 0]);
          return (
            <div key={c.title} style={{ opacity: cardOp, transform: `translateY(${cardY}px)`, padding: "20px", background: "rgba(255,255,255,0.05)", borderRadius: 12, borderLeft: `4px solid ${c.color}` }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ color: c.color, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>{c.desc}</div>
              <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>{c.example}</div>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: ci(lf, [55, 75], [0, 1]), padding: "14px 20px", background: "rgba(167,139,250,0.08)", borderRadius: 10, border: "1px solid rgba(167,139,250,0.3)" }}>
        <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: 14 }}>ML must predict three things simultaneously: </span>
        <span style={{ color: "#94a3b8", fontSize: 14 }}>direction, magnitude, and implied volatility — to select the optimal options strategy.</span>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 3: The Greeks ───────────────────────────────────────────────────────
function GreeksScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.greeksIn, T.directionIn);
  const lf = frame - T.greeksIn;

  const greeks = [
    { symbol: "Δ", name: "Delta",  range: "0 to 1 (calls) / −1 to 0 (puts)", meaning: "Price sensitivity", example: "Δ=0.50 call gains $50 when stock rises $1", color: "#38bdf8" },
    { symbol: "Γ", name: "Gamma",  range: "Always positive", meaning: "Rate of delta change", example: "Highest ATM near expiration — accelerates P&L", color: "#22c55e" },
    { symbol: "Θ", name: "Theta",  range: "Always negative (long options)", meaning: "Time decay per day", example: "AAPL 185 call, 7 DTE → −$15/day decay", color: "#f87171" },
    { symbol: "ν", name: "Vega",   range: "Always positive (long options)", meaning: "IV sensitivity per 1% change", example: "Vega=0.15 → gains $15 if IV rises 1 point", color: "#a78bfa" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>The Greeks</div>
      <div style={{ color: "#f1f5f9", fontSize: 32, fontWeight: 700, marginBottom: 24 }}>Measuring Options Risk — Delta, Gamma, Theta, Vega</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {greeks.map((g, i) => {
          const rowOp = ci(lf, [i * 15, i * 15 + 30], [0, 1]);
          const rowX = ci(lf, [i * 15, i * 15 + 30], [-24, 0]);
          return (
            <div key={g.name} style={{ opacity: rowOp, transform: `translateX(${rowX}px)`, display: "flex", gap: 20, padding: "16px 20px", background: "rgba(255,255,255,0.05)", borderRadius: 12, alignItems: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${g.color}22`, border: `2px solid ${g.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: g.color, fontSize: 26, fontWeight: 800 }}>{g.symbol}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                  <span style={{ color: g.color, fontSize: 18, fontWeight: 700 }}>{g.name}</span>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{g.meaning}</span>
                </div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Range: {g.range}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{g.example}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 4: Direction + Magnitude for Options ────────────────────────────────
function OptionsDirectionScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.directionIn, T.ivIn);
  const lf = frame - T.directionIn;

  const probW = ci(lf, [20, 60], [0, 68]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>ML for Options</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 24 }}>Direction + Magnitude → Strategy Selection</div>
      <div style={{ display: "flex", gap: 28 }}>
        {/* Model outputs */}
        <div style={{ flex: 1, padding: 20, background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>XGBoost Model Output — AAPL Today</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>Direction Probability (UP)</div>
            <div style={{ background: "#1e293b", borderRadius: 6, height: 24, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${probW}%`, height: "100%", background: "linear-gradient(90deg,#38bdf8,#22c55e)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>0.0</span>
              <span style={{ color: "#22c55e", fontSize: 24, fontWeight: 800 }}>0.68</span>
              <span style={{ color: "#64748b", fontSize: 12 }}>1.0</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Predicted magnitude", "+1.8%", "#f59e0b"], ["IV Rank", "35%", "#a78bfa"], ["Days to expiry", "7 DTE", "#38bdf8"], ["Strike", "ATM $185", "#94a3b8"]].map(([k, v, c]) => (
              <div key={k} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontSize: 11 }}>{k}</div>
                <div style={{ color: c, fontSize: 18, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Strategy comparison */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Strategy Comparison</div>
          {[
            { name: "Buy 185 Call outright", breakeven: "2.1%", cost: "$284", status: "NEG EV", color: "#f87171", note: "Model predicts +1.8% — below break-even" },
            { name: "Bull Call Spread 185/188", breakeven: "0.8%", cost: "$142", status: "SELECTED", color: "#22c55e", note: "Break-even within model's prediction interval" },
          ].map((s, i) => {
            const cardOp = ci(lf, [40 + i * 20, 65 + i * 20], [0, 1]);
            return (
              <div key={s.name} style={{ opacity: cardOp, marginBottom: 14, padding: "16px 20px", background: s.status === "SELECTED" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)", borderRadius: 12, border: `1px solid ${s.status === "SELECTED" ? "rgba(34,197,94,0.4)" : "transparent"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ color: s.color, fontSize: 13, fontWeight: 700, background: `${s.color}22`, padding: "2px 10px", borderRadius: 10 }}>{s.status}</span>
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
                  <span style={{ color: "#64748b" }}>Break-even: <strong style={{ color: "#f1f5f9" }}>{s.breakeven}</strong></span>
                  <span style={{ color: "#64748b" }}>Cost: <strong style={{ color: "#f1f5f9" }}>{s.cost}</strong></span>
                </div>
                <div style={{ color: s.status === "SELECTED" ? "#22c55e" : "#64748b", fontSize: 12, marginTop: 6 }}>{s.note}</div>
              </div>
            );
          })}
          <div style={{ opacity: ci(lf, [75, 95], [0, 1]), padding: "12px 16px", background: "rgba(167,139,250,0.1)", borderRadius: 10, border: "1px solid rgba(167,139,250,0.3)" }}>
            <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>Key insight: Magnitude prediction determines strike selection</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 5: IV Prediction ────────────────────────────────────────────────────
function IVScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.ivIn, T.matrixIn);
  const lf = frame - T.ivIn;

  const ivLevels = [
    { rank: "IV Rank 0–30", label: "LOW IV", action: "BUY premium", examples: "Buy calls, buy puts, long straddle", color: "#22c55e" },
    { rank: "IV Rank 30–60", label: "MODERATE IV", action: "MIXED", examples: "Debit spreads, credit spreads", color: "#f59e0b" },
    { rank: "IV Rank 60–100", label: "HIGH IV", action: "SELL premium", examples: "Iron condors, credit spreads, covered calls", color: "#f87171" },
  ];

  const barH = ci(lf, [20, 60], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Implied Volatility Forecasting</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 24 }}>LSTM IV Model — 61% Accuracy, MAE 2.3 Vol Points</div>
      <div style={{ display: "flex", gap: 28 }}>
        {/* IV gauge */}
        <div style={{ width: 220, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16, fontWeight: 700 }}>Current IV State</div>
          <div style={{ position: "relative", height: 180, background: "#1e293b", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
            {/* IV rank bar */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${35 * barH}%`, background: "linear-gradient(180deg,#f59e0b,#22c55e)" }} />
            <div style={{ position: "absolute", top: 8, left: 8, color: "#64748b", fontSize: 11 }}>100</div>
            <div style={{ position: "absolute", bottom: 8, left: 8, color: "#64748b", fontSize: 11 }}>0</div>
            <div style={{ position: "absolute", bottom: `${35 * barH}%`, right: 8, color: "#f59e0b", fontSize: 20, fontWeight: 800 }}>35</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f59e0b", fontSize: 18, fontWeight: 800 }}>IV Rank: 35%</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>MODERATE — debit spread zone</div>
          </div>
        </div>
        {/* Strategy table */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>IV Rank Strategy Decision Table</div>
          {ivLevels.map((iv, i) => {
            const rowOp = ci(lf, [20 + i * 15, 45 + i * 15], [0, 1]);
            const active = iv.rank.includes("30–60");
            return (
              <div key={iv.rank} style={{ opacity: rowOp, marginBottom: 12, padding: "14px 18px", background: active ? `${iv.color}18` : "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${active ? iv.color : "transparent"}44` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{iv.rank}</span>
                  <span style={{ color: iv.color, fontSize: 14, fontWeight: 700 }}>{iv.label}</span>
                  <span style={{ color: iv.color, fontSize: 13, fontWeight: 600 }}>{iv.action}</span>
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{iv.examples}</div>
              </div>
            );
          })}
          <div style={{ opacity: ci(lf, [60, 80], [0, 1]), padding: "12px 16px", background: "rgba(167,139,250,0.1)", borderRadius: 10, border: "1px solid rgba(167,139,250,0.3)" }}>
            <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>IV signal adds +8% accuracy beyond direction alone</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 6: Strategy Matrix ──────────────────────────────────────────────────
function StrategyMatrixScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.matrixIn, T.execIn);
  const lf = frame - T.matrixIn;

  const strategies = [
    { dir: "Strong UP",    iv: "Low IV",    strategy: "Buy Call / Bull Call Spread", color: "#22c55e", selected: false },
    { dir: "Strong UP",    iv: "High IV",   strategy: "Sell Bull Put Spread",        color: "#22c55e", selected: false },
    { dir: "Neutral",      iv: "High IV",   strategy: "Sell Iron Condor",            color: "#f59e0b", selected: false },
    { dir: "Strong DOWN",  iv: "Low IV",    strategy: "Buy Put / Bear Put Spread",   color: "#f87171", selected: false },
    { dir: "Uncertain",    iv: "IV Expansion", strategy: "Buy Straddle",            color: "#a78bfa", selected: false },
    { dir: "UP P=0.68",    iv: "IV Rank 35", strategy: "Bull Call Spread ← TODAY",  color: "#38bdf8", selected: true },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>ML Strategy Matrix</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 24 }}>Translating ML Output → Options Strategy</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10, padding: "8px 16px" }}>
          {["Direction Signal", "IV Condition", "Optimal Strategy"].map(h => (
            <div key={h} style={{ color: "#475569", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{h}</div>
          ))}
        </div>
        {strategies.map((s, i) => {
          const rowOp = ci(lf, [i * 8, i * 8 + 25], [0, 1]);
          return (
            <div key={i} style={{ opacity: rowOp, display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10, padding: "12px 16px", background: s.selected ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)", borderRadius: 10, border: s.selected ? "1px solid rgba(56,189,248,0.5)" : "1px solid transparent", alignItems: "center" }}>
              <span style={{ color: s.color, fontSize: 14, fontWeight: s.selected ? 700 : 400 }}>{s.dir}</span>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>{s.iv}</span>
              <span style={{ color: s.selected ? "#38bdf8" : "#f1f5f9", fontSize: 14, fontWeight: s.selected ? 800 : 400 }}>{s.strategy}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 7: Execution ────────────────────────────────────────────────────────
function ExecScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.execIn, T.managementIn);
  const lf = frame - T.execIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Trade Execution</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 24 }}>Placing the Bull Call Spread — AAPL</div>
      <div style={{ display: "flex", gap: 28 }}>
        {/* Spread details */}
        <div style={{ flex: 1.1, padding: 22, background: "rgba(255,255,255,0.05)", borderRadius: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: 2 }}>Trade Structure</div>
          {[
            ["BUY", "AAPL 185 Call", "$2.84", "#22c55e"],
            ["SELL", "AAPL 188 Call", "($1.42)", "#f87171"],
            ["NET DEBIT", "Per share", "$1.42", "#f59e0b"],
            ["Per contract (100 shares)", "", "$142.00", "#f59e0b"],
          ].map(([a, b, c, col], i) => {
            const rowOp = ci(lf, [i * 8, i * 8 + 25], [0, 1]);
            return (
              <div key={a + b} style={{ opacity: rowOp, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <span style={{ color: col, fontSize: 13, fontWeight: 700, marginRight: 10 }}>{a}</span>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{b}</span>
                </div>
                <span style={{ color: col, fontSize: 15, fontWeight: 700 }}>{c}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Max Profit", "$158", "#22c55e"], ["Max Loss", "$142", "#f87171"], ["Break-even", "$186.42", "#f59e0b"], ["Risk:Reward", "1.1 : 1", "#38bdf8"]].map(([k, v, c]) => (
              <div key={k} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                <div style={{ color: "#64748b", fontSize: 11 }}>{k}</div>
                <div style={{ color: c, fontSize: 18, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Execution rules */}
        <div style={{ flex: 1 }}>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: 2 }}>Execution Rules</div>
          {[
            { rule: "Enter as net debit limit", detail: "Submit spread order at $1.42 midpoint — never market order options", color: "#38bdf8" },
            { rule: "Position sizing: 2% max risk", detail: "$10K account → max $200 → 1 contract at $142 debit", color: "#f59e0b" },
            { rule: "Close at 50% of max profit", detail: "Exit when spread reaches $2.21 — lock in $79 gain before theta accelerates", color: "#22c55e" },
            { rule: "Stop at 50% of premium paid", detail: "Close if spread drops to $0.71 — limit loss to $71 per contract", color: "#f87171" },
          ].map((r, i) => {
            const rowOp = ci(lf, [35 + i * 12, 60 + i * 12], [0, 1]);
            return (
              <div key={r.rule} style={{ opacity: rowOp, marginBottom: 12, padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 10, borderLeft: `3px solid ${r.color}` }}>
                <div style={{ color: r.color, fontSize: 13, fontWeight: 700 }}>{r.rule}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{r.detail}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 8: Greeks Management ────────────────────────────────────────────────
function ManagementScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.managementIn, T.backtestIn);
  const lf = frame - T.managementIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Greeks-Based Management</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 24 }}>Managing a Live Bull Call Spread</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {/* Greek evolution */}
        <div style={{ padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#38bdf8", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Greek Values — AAPL 185/188 Call Spread</div>
          {[
            { greek: "Delta", val: "0.31", change: "→ 0.45 as AAPL rises", color: "#38bdf8", note: "Gains $31/point now; $45/point near target" },
            { greek: "Gamma", val: "+0.04", change: "Accelerates profits", color: "#22c55e", note: "Positive gamma works in our favor" },
            { greek: "Theta", val: "−$8/day", change: "Time costs money", color: "#f87171", note: "After 3 days flat: −$24 of $142 invested" },
            { greek: "Vega",  val: "+$0.09", change: "Per 1% IV change", color: "#a78bfa", note: "IV expansion would help; contraction hurts" },
          ].map((g, i) => {
            const rowOp = ci(lf, [i * 10, i * 10 + 28], [0, 1]);
            return (
              <div key={g.greek} style={{ opacity: rowOp, marginBottom: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, borderLeft: `3px solid ${g.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: g.color, fontSize: 15, fontWeight: 700 }}>{g.greek}: {g.val}</span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{g.change}</span>
                </div>
                <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{g.note}</div>
              </div>
            );
          })}
        </div>
        {/* Management rules */}
        <div style={{ padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12 }}>
          <div style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Mechanical Management Rules</div>
          {[
            { trigger: "Profit ≥ 50% of max", action: "CLOSE the spread — take the win", detail: "Spread at $2.21+ → exit immediately", color: "#22c55e" },
            { trigger: "Loss ≥ 50% of premium", action: "CLOSE the spread — cut the loss", detail: "Spread at $0.71− → exit immediately", color: "#f87171" },
            { trigger: "3 days passed, no move", action: "EVALUATE — theta is eating premium", detail: "$24 lost to time → reconsider holding", color: "#f59e0b" },
            { trigger: "Expiration approaching", action: "NEVER hold into final day", detail: "Gamma risk spikes — close by DTE 2", color: "#f87171" },
          ].map((r, i) => {
            const rowOp = ci(lf, [30 + i * 10, 55 + i * 10], [0, 1]);
            return (
              <div key={r.trigger} style={{ opacity: rowOp, marginBottom: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, borderLeft: `3px solid ${r.color}` }}>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>If: {r.trigger}</div>
                <div style={{ color: r.color, fontSize: 14, fontWeight: 700, marginTop: 4 }}>{r.action}</div>
                <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>{r.detail}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 9: Backtesting ──────────────────────────────────────────────────────
function BacktestScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.backtestIn, T.liveTradeIn);
  const lf = frame - T.backtestIn;

  const metrics = [
    { label: "Total Trades",      value: "94",    color: "#38bdf8" },
    { label: "Win Rate",          value: "64.9%", color: "#22c55e" },
    { label: "Avg Win",           value: "+78%",  color: "#22c55e" },
    { label: "Avg Loss",          value: "−97%",  color: "#f87171" },
    { label: "Profit Factor",     value: "2.1×",  color: "#f59e0b" },
    { label: "Annual Return",     value: "41%",   color: "#22c55e" },
    { label: "Sharpe Ratio",      value: "1.68",  color: "#a78bfa" },
    { label: "Max Drawdown",      value: "−12.4%",color: "#f87171" },
    { label: "IV Filter Lift",    value: "+8.9%", color: "#38bdf8" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Backtesting</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 10 }}>14-Month Options Backtest — SPY Spreads</div>
      <div style={{ color: "#64748b", fontSize: 14, marginBottom: 22 }}>94 bull call spreads + bear put spreads · Walk-forward validated</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {metrics.map((m, i) => {
          const cardOp = ci(lf, [i * 6, i * 6 + 24], [0, 1]);
          const cardY = ci(lf, [i * 6, i * 6 + 24], [16, 0]);
          return (
            <div key={m.label} style={{ opacity: cardOp, transform: `translateY(${cardY}px)`, padding: "16px 18px", background: "rgba(255,255,255,0.05)", borderRadius: 10, borderTop: `3px solid ${m.color}` }}>
              <div style={{ color: m.color, fontSize: 28, fontWeight: 800 }}>{m.value}</div>
              <div style={{ color: "#f1f5f9", fontSize: 13, marginTop: 4 }}>{m.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: ci(lf, [60, 80], [0, 1]), marginTop: 18, padding: "14px 20px", background: "rgba(34,197,94,0.08)", borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)" }}>
        <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>Key finding: </span>
        <span style={{ color: "#94a3b8", fontSize: 14 }}>IV rank filter eliminated 31% of low-quality setups, raising win rate from 56% to 64.9%</span>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 10: Live Trade — NVDA Earnings ──────────────────────────────────────
function LiveTradeScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.liveTradeIn, T.lossesIn);
  const lf = frame - T.liveTradeIn;

  const timeline = [
    { step: "ML Inputs",    detail: "IV rank 87% · analyst dispersion 0.34 · hist. move 8.2% · momentum 0.72", color: "#64748b" },
    { step: "Model Output", detail: "P(UP)=0.74 · magnitude +6.2% · P(IV expansion)=0.82 → STRATEGY: Long call", color: "#38bdf8" },
    { step: "Entry",        detail: "Buy NVDA 820 Call at $18.50 · NVDA at $800 · 5 DTE · Cost: $1,850/contract", color: "#f59e0b" },
    { step: "Earnings gap", detail: "NVDA reports — beats by $0.62 · Stock gaps from $800 → $870 (+8.75%)", color: "#a78bfa" },
    { step: "Exit",         detail: "820 Call trades at $52.00 · Sell at market · Profit: $33.50/share", color: "#22c55e" },
    { step: "Result",       detail: "Return per contract: $3,350 / $1,850 = 181% in 5 days", color: "#22c55e" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Live Trade Example</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 28 }}>NVIDIA Earnings Play — 181% Return in 5 Days</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {timeline.map((t, i) => {
          const rowOp = ci(lf, [i * 14, i * 14 + 30], [0, 1]);
          const rowX = ci(lf, [i * 14, i * 14 + 30], [-20, 0]);
          return (
            <div key={t.step} style={{ opacity: rowOp, transform: `translateX(${rowX}px)`, display: "flex", gap: 16, padding: "12px 18px", background: "rgba(255,255,255,0.05)", borderRadius: 10, borderLeft: `3px solid ${t.color}`, alignItems: "center" }}>
              <div style={{ minWidth: 100, color: t.color, fontSize: 13, fontWeight: 700 }}>{t.step}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{t.detail}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 11: Loss Management ─────────────────────────────────────────────────
function LossScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.lossesIn, T.summaryIn);
  const lf = frame - T.lossesIn;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1a1245)", opacity: op, padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Loss Management</div>
      <div style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 700, marginBottom: 28 }}>Disciplined Exit Rules — Non-Negotiable</div>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1 }}>
          {[
            { type: "Long Premium (bought option)", rules: ["Close at 50% of premium paid if stock moves against you within 3 days", "Keeps half your capital — money for the next ML signal", "Do not average down on a losing options position"], color: "#f59e0b" },
            { type: "Short Premium (credit spread)", rules: ["Close at 200% of premium received if underlying breaches your short strike", "A $1.42 credit can become a $3.00 loss on margin — act fast", "Never hold losing short options to expiration"], color: "#f87171" },
          ].map((s, i) => {
            const cardOp = ci(lf, [i * 25, i * 25 + 40], [0, 1]);
            return (
              <div key={s.type} style={{ opacity: cardOp, marginBottom: 18, padding: "18px 22px", background: "rgba(255,255,255,0.05)", borderRadius: 12, borderLeft: `4px solid ${s.color}` }}>
                <div style={{ color: s.color, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{s.type}</div>
                {s.rules.map((r, j) => (
                  <div key={j} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <span style={{ color: s.color, fontSize: 16, flexShrink: 0 }}>•</span>
                    <span style={{ color: "#94a3b8", fontSize: 14 }}>{r}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, padding: "22px", background: "rgba(248,113,113,0.08)", borderRadius: 12, border: "1px solid rgba(248,113,113,0.3)" }}>
          <div style={{ color: "#f87171", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>The Golden Rule</div>
          <div style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, lineHeight: 1.4, marginBottom: 20 }}>Pre-define every exit before you enter. Execute mechanically.</div>
          <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
            Options can go to zero. A disciplined 50% stop-loss on premium paid ensures you always have capital for the next trade. The ML model generates thousands of signals over time — no single trade matters enough to override your risk rules.
          </div>
          <div style={{ opacity: ci(lf, [50, 70], [0, 1]), marginTop: 20, padding: "12px", background: "rgba(248,113,113,0.15)", borderRadius: 8 }}>
            <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>Never let emotion override the exit rule.</div>
          </div>
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

  const results = [
    { label: "Win Rate",        value: "64.9%", color: "#22c55e" },
    { label: "Annual Return",   value: "41%",   color: "#22c55e" },
    { label: "Sharpe Ratio",    value: "1.68",  color: "#a78bfa" },
    { label: "Max Drawdown",    value: "−12.4%",color: "#f87171" },
  ];

  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg,#0f172a,#1e1b4b)", opacity: op, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 40, fontFamily: "Arial,sans-serif" }}>
      <div style={{ transform: `scale(${scale})`, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ color: "#a78bfa", fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Performance Summary</div>
          <div style={{ color: "#f1f5f9", fontSize: 46, fontWeight: 800 }}>ML Options Trading</div>
          <div style={{ color: "#64748b", fontSize: 18, marginTop: 8 }}>14-Month Backtest · SPY Spreads · XGBoost + LSTM IV</div>
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
        <div style={{ opacity: ci(lf, [55, 75], [0, 1]), display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[["IV Rank Filter", "+8.9% win rate lift", "#38bdf8"], ["Spread vs. Outright", "Lower break-even by 1.2%", "#22c55e"], ["Greeks Rules", "Mechanical 50% exits", "#a78bfa"]].map(([t, d, c]) => (
            <div key={t} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.05)", borderRadius: 10, borderTop: `2px solid ${c}` }}>
              <div style={{ color: c, fontSize: 14, fontWeight: 700 }}>{t}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Main Composition ──────────────────────────────────────────────────────────
export function OptionsTrading() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#0f172a" }}>
      {OPTIONS_CLIPS.map(({ file, start }) => (
        <Sequence key={file} from={start}>
          <Html5Audio src={staticFile(`audio/${file}.mp3`)} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", top: 16, left: 20, fontFamily: "Arial,sans-serif", fontSize: 13, color: "rgba(148,163,184,0.6)", fontWeight: 600, letterSpacing: 1 }}>{ORG}</div>

      {frame >= T.titleIn       && frame < T.fundamentalsIn + 30 && <TitleScene         frame={frame} />}
      {frame >= T.fundamentalsIn && frame < T.greeksIn      + 30 && <FundamentalsScene  frame={frame} />}
      {frame >= T.greeksIn      && frame < T.directionIn    + 30 && <GreeksScene        frame={frame} />}
      {frame >= T.directionIn   && frame < T.ivIn           + 30 && <OptionsDirectionScene frame={frame} />}
      {frame >= T.ivIn          && frame < T.matrixIn       + 30 && <IVScene            frame={frame} />}
      {frame >= T.matrixIn      && frame < T.execIn         + 30 && <StrategyMatrixScene frame={frame} />}
      {frame >= T.execIn        && frame < T.managementIn   + 30 && <ExecScene          frame={frame} />}
      {frame >= T.managementIn  && frame < T.backtestIn     + 30 && <ManagementScene    frame={frame} />}
      {frame >= T.backtestIn    && frame < T.liveTradeIn    + 30 && <BacktestScene      frame={frame} />}
      {frame >= T.liveTradeIn   && frame < T.lossesIn       + 30 && <LiveTradeScene     frame={frame} />}
      {frame >= T.lossesIn      && frame < T.summaryIn      + 30 && <LossScene          frame={frame} />}
      {frame >= T.summaryIn     && <SummaryScene frame={frame} />}

      <BrandBar frame={frame} />
    </AbsoluteFill>
  );
}
