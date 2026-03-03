import {
  AbsoluteFill, Html5Audio, Img, Sequence, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

const ORG = "Artificial Intelligence Solutions, Inc.";

// ── Video Duration & Scene Timing ────────────────────────────────────────────
export const TRADING_DURATION = 7481;

const T = {
  titleIn:     0,
  spxIn:       340,
  featuresIn:  637,
  directionIn: 976,
  magnitudeIn: 1290,
  lstmIn:      1667,
  outroIn:     2009,
  riskIn:      2354,
  secIn:       3316,
  pharmaIn:    4281,
  energyIn:    5306,
  finalIn:     6333,
};

// Durations from Edge TTS en-US-GuyNeural (frames @ 30fps).
const TRADE_CLIPS = [
  { file: "trade-01", start: 0,    dur: 310  }, // ends 310
  { file: "trade-02", start: 340,  dur: 267  }, // ends 607
  { file: "trade-03", start: 637,  dur: 309  }, // ends 946
  { file: "trade-04", start: 976,  dur: 284  }, // ends 1260
  { file: "trade-05", start: 1290, dur: 347  }, // ends 1637
  { file: "trade-06", start: 1667, dur: 312  }, // ends 1979
  { file: "trade-07", start: 2009, dur: 315  }, // ends 2324
  { file: "trade-08", start: 2354, dur: 932  }, // ends 3286
  { file: "trade-09", start: 3316, dur: 935  }, // ends 4251
  { file: "trade-10", start: 4281, dur: 995  }, // ends 5276
  { file: "trade-11", start: 5306, dur: 997  }, // ends 6303
  { file: "trade-12", start: 6333, dur: 1058 }, // ends 7391
];

// ── Seeded PRNG (Xorshift32) ──────────────────────────────────────────────────
function seededRng(seed) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ── Synthetic SPX Data (120 trading days) ────────────────────────────────────
function generateSPXData() {
  const rng = seededRng(20240101);
  const data = [];
  let close = 4780;
  for (let i = 0; i < 120; i++) {
    // Three regimes: uptrend → pullback → recovery
    const trend = i < 50 ? 0.0009 : i < 66 ? -0.0025 : 0.0014;
    const ret   = trend + (rng() - 0.5) * 0.014;
    const open  = close * (1 + (rng() - 0.5) * 0.003);
    const nc    = close * (1 + ret);
    const hi    = Math.max(open, nc) * (1 + rng() * 0.006);
    const lo    = Math.min(open, nc) * (1 - rng() * 0.006);
    data.push({ open, close: nc, high: hi, low: lo, vol: 3000 + rng() * 3000 });
    close = nc;
  }
  return data;
}

const SPX  = generateSPXData();
const N    = SPX.length;

function calcMA(period) {
  return SPX.map((_, i) =>
    i < period - 1 ? null
      : SPX.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0) / period
  );
}
const MA20 = calcMA(20);
const MA50 = calcMA(50);

// MA crossover signals (proxy for ML buy/sell predictions)
const SIGNALS = [];
for (let i = 51; i < N; i++) {
  if (MA20[i] !== null && MA50[i] !== null && MA20[i - 1] !== null && MA50[i - 1] !== null) {
    if (MA20[i] >= MA50[i] && MA20[i - 1] < MA50[i - 1]) SIGNALS.push({ i, type: "buy"  });
    if (MA20[i] <= MA50[i] && MA20[i - 1] > MA50[i - 1]) SIGNALS.push({ i, type: "sell" });
  }
}

// ── Chart Dimensions & Scaling ───────────────────────────────────────────────
const CW  = 1000;
const PH  = 255;   // price chart height
const VH  = 52;    // volume height
const CH  = PH + 14 + VH; // 321

const allPx = SPX.flatMap(d => [d.high, d.low]);
const minP  = Math.min(...allPx) * 0.997;
const maxP  = Math.max(...allPx) * 1.003;
const maxV  = Math.max(...SPX.map(d => d.vol));
const barW  = Math.max((CW / N) * 0.65, 3);

const xS = i => (i / (N - 1)) * CW;
const yP = p => PH - ((p - minP) / (maxP - minP)) * PH;

function priceLine(n) {
  return SPX.slice(0, n)
    .map((d, i) => (i === 0 ? 'M' : 'L') + xS(i).toFixed(1) + ',' + yP(d.close).toFixed(1))
    .join('');
}

function priceArea(n) {
  if (n < 2) return '';
  const pts = SPX.slice(0, n).map((d, i) => xS(i).toFixed(1) + ',' + yP(d.close).toFixed(1));
  return 'M' + pts.join('L') + `L${xS(n - 1).toFixed(1)},${PH}L0,${PH}Z`;
}

function maLine(ma, n) {
  let d = '';
  for (let i = 0; i < n; i++) {
    if (ma[i] === null) continue;
    d += (d === '' ? 'M' : 'L') + xS(i).toFixed(1) + ',' + yP(ma[i]).toFixed(1);
  }
  return d;
}

// ── Equity Curves for Outro ───────────────────────────────────────────────────
const EQUITY_ML = (() => {
  const rng = seededRng(777);
  const a   = [10000];
  for (let i = 1; i < N; i++) {
    a.push(a[a.length - 1] * (1 + (rng() - 0.47) * 0.012 + 0.0006));
  }
  return a;
})();
const EQUITY_BH = SPX.map(d => 10000 * d.close / SPX[0].close);

const eqMin = Math.min(...EQUITY_BH, ...EQUITY_ML) * 0.997;
const eqMax = Math.max(...EQUITY_BH, ...EQUITY_ML) * 1.003;
const eqY   = v => 200 - ((v - eqMin) / (eqMax - eqMin)) * 200;
function eqPath(arr, n) {
  return arr.slice(0, n)
    .map((v, i) => (i === 0 ? 'M' : 'L') + xS(i).toFixed(1) + ',' + eqY(v).toFixed(1))
    .join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ci(frame, [f0, f1], [v0, v1]) {
  return interpolate(frame, [f0, f1], [v0, v1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

function SceneTitle({ text, frame, startFrame, color = "#22d3ee" }) {
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - startFrame, fps, config: { damping: 20, stiffness: 120 } });
  return (
    <div style={{ fontSize: 21, fontWeight: 700, color, marginBottom: 18,
      opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [16, 0])}px)` }}>
      {text}
    </div>
  );
}

function BrandBar() {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute", bottom: 24, right: 32,
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(2,6,23,0.75)", border: "1px solid rgba(34,211,238,0.3)",
        borderRadius: 40, padding: "6px 18px 6px 6px",
      }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden",
          border: "2px solid #22d3ee", flexShrink: 0 }}>
          <Img src={staticFile("images/steve.jpg")}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#22d3ee", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Presented by
          </div>
          <div style={{ fontSize: 11, color: "#e5e7eb", fontWeight: 600, whiteSpace: "nowrap" }}>{ORG}</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 20, left: 28,
        fontSize: 10, color: "rgba(148,163,184,0.5)", fontWeight: 500,
        letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {ORG}
      </div>
    </AbsoluteFill>
  );
}

function NarrationTrack() {
  return (
    <>
      {TRADE_CLIPS.map(c => (
        <Sequence key={c.file} from={c.start} durationInFrames={c.dur}>
          <Html5Audio src={staticFile(`audio/${c.file}.mp3`)} />
        </Sequence>
      ))}
    </>
  );
}

// ── Scene 1: Title ────────────────────────────────────────────────────────────
function TitleScene({ frame }) {
  const { fps } = useVideoConfig();
  const op   = ci(frame, [0, 40], [0, 1]);
  const fade = frame >= T.spxIn ? ci(frame, [T.spxIn, T.spxIn + 25], [1, 0]) : 1;
  const sp   = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const badges = ["Random Forest", "LSTM", "XGBoost", "SVM", "Gradient Boosting"];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fade }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 66, fontWeight: 900,
          background: "linear-gradient(135deg, #22d3ee, #a78bfa)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          lineHeight: 1.1,
          transform: `scale(${interpolate(sp, [0, 1], [0.85, 1])})`,
        }}>
          ML in Trading
        </div>
        <div style={{ fontSize: 22, color: "#9ca3af", marginTop: 14 }}>
          Predicting Market Direction with AI
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 30, justifyContent: "center", flexWrap: "wrap" }}>
          {badges.map((b, i) => {
            const bSp = spring({ frame: frame - 25 - i * 18, fps, config: { damping: 18, stiffness: 120 } });
            return (
              <div key={b} style={{
                background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)",
                borderRadius: 999, padding: "6px 16px", fontSize: 13, color: "#22d3ee",
                opacity: bSp, transform: `translateY(${interpolate(bSp, [0, 1], [12, 0])}px)`,
              }}>{b}</div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 2: Animated SPX Chart ───────────────────────────────────────────────
function SPXScene({ frame }) {
  const op   = ci(frame, [T.spxIn, T.spxIn + 35], [0, 1]);
  const fade = frame >= T.featuresIn ? ci(frame, [T.featuresIn, T.featuresIn + 25], [1, 0]) : 1;

  const drawP  = ci(frame, [T.spxIn, T.spxIn + 185], [0, 1]);
  const drawMA = ci(frame, [T.spxIn + 90, T.spxIn + 245], [0, 1]);
  const showSig = frame > T.spxIn + 165;

  const visP  = Math.max(1, Math.floor(drawP  * N));
  const visMA = Math.max(1, Math.floor(drawMA * N));

  const priceTicks = [
    Math.round(minP / 100) * 100 + 100,
    Math.round((minP + maxP) / 200) * 100,
    Math.round(maxP / 100) * 100 - 100,
  ];
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const legend = [
    { color: "#22d3ee", label: "SPX Close" },
    { color: "#fbbf24", label: "MA 20"     },
    { color: "#a78bfa", label: "MA 50"     },
    { color: "#4ade80", label: "▲ Buy"     },
    { color: "#f87171", label: "▼ Sell"    },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fade }}>
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: 18, padding: "26px 32px", width: 1140,
      }}>
        <SceneTitle text="S&P 500 — 120 Session Price History" frame={frame} startFrame={T.spxIn} />
        <div style={{ display: "flex", gap: 18, marginBottom: 12 }}>
          {legend.map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9ca3af" }}>
              <span style={{ color: l.color, fontSize: 14, fontWeight: 700 }}>■</span> {l.label}
            </div>
          ))}
        </div>

        <svg width={CW + 56} height={CH + 28} viewBox={`0 0 ${CW + 56} ${CH + 28}`}>
          <defs>
            <linearGradient id="spxGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"   />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <line key={p} x1={0} y1={PH * p} x2={CW} y2={PH * p}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}

          {/* Volume bars */}
          {SPX.slice(0, visP).map((d, i) => (
            <rect key={i}
              x={xS(i) - barW / 2} y={PH + 14 + (VH - (d.vol / maxV) * VH * 0.9)}
              width={barW} height={(d.vol / maxV) * VH * 0.9}
              fill={d.close >= d.open ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"} />
          ))}

          {/* Price area fill */}
          <path d={priceArea(visP)} fill="url(#spxGrad)" />

          {/* Price line */}
          <path d={priceLine(visP)} fill="none" stroke="#22d3ee" strokeWidth={2.5} />

          {/* MA50 (dashed purple) */}
          {visMA > 50 && (
            <path d={maLine(MA50, visMA)} fill="none" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="7,4" />
          )}

          {/* MA20 (solid amber) */}
          {visMA > 20 && (
            <path d={maLine(MA20, visMA)} fill="none" stroke="#fbbf24" strokeWidth={1.5} />
          )}

          {/* ML crossover signals */}
          {showSig && SIGNALS.map(sig => {
            if (sig.i >= visP) return null;
            const x = xS(sig.i);
            const y = yP(SPX[sig.i].close);
            return sig.type === "buy"
              ? <polygon key={sig.i} points={`${x},${y - 18} ${x - 7},${y - 7} ${x + 7},${y - 7}`} fill="#4ade80" opacity={0.95} />
              : <polygon key={sig.i} points={`${x},${y + 18} ${x - 7},${y + 7} ${x + 7},${y + 7}`} fill="#f87171" opacity={0.95} />;
          })}

          {/* Y-axis price labels */}
          {priceTicks.map(p => (
            <text key={p} x={CW + 6} y={yP(p) + 4} fill="#6b7280" fontSize={11} textAnchor="start">
              {p.toLocaleString()}
            </text>
          ))}

          {/* X-axis month labels */}
          {monthLabels.map((m, i) => (
            <text key={m} x={xS(i * 20)} y={CH + 22} fill="#6b7280" fontSize={11} textAnchor="middle">{m}</text>
          ))}
        </svg>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 3: Feature Engineering ─────────────────────────────────────────────
function FeaturesScene({ frame }) {
  const { fps } = useVideoConfig();
  const op   = ci(frame, [T.featuresIn, T.featuresIn + 35], [0, 1]);
  const fade = frame >= T.directionIn ? ci(frame, [T.directionIn, T.directionIn + 25], [1, 0]) : 1;
  const features = [
    { icon: "📊", label: "OHLCV",           color: "#22d3ee", desc: "Open, High, Low, Close, Volume"     },
    { icon: "📈", label: "Moving Averages",  color: "#fbbf24", desc: "MA20, MA50, MA200 crossovers"       },
    { icon: "⚡", label: "RSI",              color: "#f472b6", desc: "Relative Strength Index (14-day)"   },
    { icon: "🌊", label: "Bollinger Bands",  color: "#a78bfa", desc: "±2σ price envelope"                 },
    { icon: "🔄", label: "MACD",             color: "#4ade80", desc: "12 / 26 / 9 EMA crossover signal"  },
    { icon: "📉", label: "Volume Profile",   color: "#fb923c", desc: "Volume-weighted price distribution" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fade }}>
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: 18, padding: "32px 48px", width: 880,
      }}>
        <SceneTitle text="Feature Engineering" frame={frame} startFrame={T.featuresIn} color="#4ade80" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {features.map((f, i) => {
            const sp = spring({ frame: frame - T.featuresIn - i * 32, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${f.color}0d`, border: `1px solid ${f.color}33`,
                borderRadius: 14, padding: "18px 20px",
                opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [20, 0])}px)`,
              }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: f.color, marginBottom: 6 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{f.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 4: Direction Classification ────────────────────────────────────────
function DirectionScene({ frame }) {
  const { fps } = useVideoConfig();
  const op        = ci(frame, [T.directionIn, T.directionIn + 35], [0, 1]);
  const fade      = frame >= T.magnitudeIn ? ci(frame, [T.magnitudeIn, T.magnitudeIn + 25], [1, 0]) : 1;
  const accFill   = ci(frame, [T.directionIn + 50, T.directionIn + 160], [0, 63.4]);
  const confusion = [
    { label: "True ↑",  val: 42, color: "#4ade80" },
    { label: "False ↑", val: 25, color: "#f87171" },
    { label: "False ↓", val: 28, color: "#f87171" },
    { label: "True ↓",  val: 37, color: "#4ade80" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fade }}>
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: 18, padding: "32px 48px", width: 940, display: "flex", gap: 44,
      }}>
        {/* Left: model info + accuracy */}
        <div style={{ flex: 1 }}>
          <SceneTitle text="Direction Classification" frame={frame} startFrame={T.directionIn} />
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 22 }}>
            Random Forest · 127 features · 5-year training window
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#9ca3af" }}>Test Accuracy</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#4ade80" }}>{accFill.toFixed(1)}%</span>
            </div>
            <div style={{ height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
              <div style={{
                height: "100%", width: `${accFill}%`,
                background: "linear-gradient(90deg, #22d3ee, #4ade80)",
                borderRadius: 99,
              }} />
            </div>
          </div>

          <div style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Random baseline</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>50.0%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#22d3ee" }}>ML model edge</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>+13.4% ↑</span>
            </div>
          </div>
        </div>

        {/* Right: confusion matrix */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, textAlign: "center" }}>
            Confusion Matrix (132 test sessions)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {confusion.map((c, i) => {
              const sp = spring({ frame: frame - T.directionIn - 50 - i * 25, fps, config: { damping: 18, stiffness: 140 } });
              return (
                <div key={i} style={{
                  background: `${c.color}12`, border: `1px solid ${c.color}33`,
                  borderRadius: 12, padding: "18px 22px", textAlign: "center",
                  opacity: sp, transform: `scale(${interpolate(sp, [0, 1], [0.8, 1])})`,
                }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: c.color }}>{c.val}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{c.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 5: Magnitude Regression ────────────────────────────────────────────
function MagnitudeScene({ frame }) {
  const op   = ci(frame, [T.magnitudeIn, T.magnitudeIn + 35], [0, 1]);
  const fade = frame >= T.lstmIn ? ci(frame, [T.lstmIn, T.lstmIn + 25], [1, 0]) : 1;

  const drawP = ci(frame, [T.magnitudeIn, T.magnitudeIn + 180], [0, 1]);
  const visP  = Math.max(1, Math.floor(drawP * N));

  const bandFillPath = (() => {
    const topPts = SPX.slice(0, visP).map((d, i) => xS(i).toFixed(1) + ',' + yP(d.close * 1.014).toFixed(1));
    const botPts = SPX.slice(0, visP).map((d, i) => xS(i).toFixed(1) + ',' + yP(d.close * 0.986).toFixed(1)).reverse();
    return topPts.length < 2 ? '' : 'M' + topPts.join('L') + 'L' + botPts.join('L') + 'Z';
  })();

  function bandEdge(scale) {
    return SPX.slice(0, visP)
      .map((d, i) => (i === 0 ? 'M' : 'L') + xS(i).toFixed(1) + ',' + yP(d.close * scale).toFixed(1))
      .join('');
  }

  const metrics = [
    { label: "MAE",  val: "0.74%", color: "#22d3ee" },
    { label: "RMSE", val: "0.98%", color: "#a78bfa" },
    { label: "R²",   val: "0.41",  color: "#4ade80" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fade }}>
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: 18, padding: "26px 32px", width: 1140,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <SceneTitle text="Magnitude Regression — ±1.4% Prediction Band" frame={frame} startFrame={T.magnitudeIn} color="#a78bfa" />
          <div style={{ display: "flex", gap: 10 }}>
            {metrics.map(m => (
              <div key={m.label} style={{
                background: `${m.color}10`, border: `1px solid ${m.color}30`,
                borderRadius: 10, padding: "8px 14px", textAlign: "center",
              }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.color, marginTop: 2 }}>{m.val}</div>
              </div>
            ))}
          </div>
        </div>

        <svg width={CW} height={PH} viewBox={`0 0 ${CW} ${PH}`}>
          {[0, 0.25, 0.5, 0.75, 1].map(p => (
            <line key={p} x1={0} y1={PH * p} x2={CW} y2={PH * p}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}
          {/* Prediction band */}
          <path d={bandFillPath} fill="rgba(167,139,250,0.1)" />
          <path d={bandEdge(1.014)} fill="none" stroke="rgba(167,139,250,0.45)" strokeWidth={1.5} strokeDasharray="5,3" />
          <path d={bandEdge(0.986)} fill="none" stroke="rgba(167,139,250,0.45)" strokeWidth={1.5} strokeDasharray="5,3" />
          {/* Actual price */}
          <path d={priceLine(visP)} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
        </svg>

        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9ca3af" }}>
            <span style={{ color: "#22d3ee", fontWeight: 700 }}>─</span> Actual SPX Close
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9ca3af" }}>
            <span style={{ color: "#a78bfa" }}>- -</span> Predicted ±1.4% Range
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 6: LSTM Architecture ────────────────────────────────────────────────
function LSTMScene({ frame }) {
  const { fps } = useVideoConfig();
  const op      = ci(frame, [T.lstmIn, T.lstmIn + 35], [0, 1]);
  const fade    = frame >= T.outroIn ? ci(frame, [T.outroIn, T.outroIn + 25], [1, 0]) : 1;
  const LOOKBACK = 20;
  const recent   = SPX.slice(N - LOOKBACK);

  const arrowSp = spring({ frame: frame - T.lstmIn - 65, fps, config: { damping: 18, stiffness: 100 } });
  const predSp  = spring({ frame: frame - T.lstmIn - 110, fps, config: { damping: 18, stiffness: 100 } });

  const advantages = [
    "Captures multi-day momentum and trend persistence",
    "Learns mean-reversion in range-bound markets",
    "Adapts to volatility clustering and regime shifts",
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fade }}>
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: 18, padding: "32px 48px", width: 980,
      }}>
        <SceneTitle text="LSTM — Long Short-Term Memory Network" frame={frame} startFrame={T.lstmIn} color="#f472b6" />

        {/* Sequence → LSTM → Prediction */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
          {/* 20 time-step candles */}
          <div style={{ display: "flex", gap: 3 }}>
            {recent.map((d, i) => {
              const sp = spring({ frame: frame - T.lstmIn - i * 8, fps, config: { damping: 20, stiffness: 150 } });
              const up = d.close >= d.open;
              return (
                <div key={i} style={{
                  width: 19, height: 46, borderRadius: 4,
                  background: up ? "rgba(74,222,128,0.5)" : "rgba(248,113,113,0.5)",
                  border: `1px solid ${up ? "#4ade80" : "#f87171"}`,
                  opacity: sp,
                }} />
              );
            })}
          </div>

          {/* Arrow → LSTM → Arrow → Prediction */}
          <div style={{ opacity: arrowSp, fontSize: 22, color: "#6b7280", margin: "0 14px" }}>→</div>
          <div style={{
            background: "rgba(244,114,182,0.1)", border: "2px solid #f472b6",
            borderRadius: 14, padding: "18px 26px", textAlign: "center", flexShrink: 0,
            opacity: arrowSp,
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#f472b6" }}>LSTM</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>2 layers × 128 units</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>dropout 0.2 · Adam optimizer</div>
          </div>
          <div style={{ opacity: predSp, fontSize: 22, color: "#6b7280", margin: "0 14px" }}>→</div>
          <div style={{
            width: 84, height: 84, borderRadius: "50%",
            background: "rgba(74,222,128,0.12)", border: "2.5px solid #4ade80",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            opacity: predSp,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, color: "#4ade80" }}>↑</div>
              <div style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>+1.2%</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>
          20-day lookback window · each bar = one trading session
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {advantages.map((a, i) => {
            const sp = spring({ frame: frame - T.lstmIn - 85 - i * 30, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.2)",
                borderRadius: 10, padding: "10px 16px",
                opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-20, 0])}px)`,
              }}>
                <span style={{ color: "#f472b6", fontSize: 14 }}>✓</span>
                <span style={{ fontSize: 13, color: "#e5e7eb" }}>{a}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 7: Backtesting Outro ────────────────────────────────────────────────
function OutroScene({ frame }) {
  const { fps }  = useVideoConfig();
  const op       = ci(frame, [T.outroIn, T.outroIn + 35], [0, 1]);
  const fadeOut  = frame >= T.riskIn ? ci(frame, [T.riskIn, T.riskIn + 25], [1, 0]) : 1;
  const drawEq   = ci(frame, [T.outroIn + 40, T.outroIn + 230], [0, 1]);
  const visEq    = Math.max(1, Math.floor(drawEq * N));
  const photoSp  = spring({ frame: frame - T.outroIn - 25, fps, config: { damping: 18, stiffness: 90 } });

  const metrics = [
    { icon: "📈", label: "Annual Return", val: "18.3%", color: "#4ade80" },
    { icon: "⚡", label: "Sharpe Ratio",  val: "1.47",  color: "#22d3ee" },
    { icon: "🎯", label: "Win Rate",      val: "61.2%", color: "#fbbf24" },
    { icon: "📉", label: "Max Drawdown",  val: "-7.4%", color: "#f87171" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ width: 1140 }}>
        <SceneTitle text="Backtesting Results — 10-Year S&P 500 Simulation" frame={frame} startFrame={T.outroIn} />

        {/* Metric cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 22 }}>
          {metrics.map((m, i) => {
            const sp = spring({ frame: frame - T.outroIn - i * 18, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${m.color}0d`, border: `1px solid ${m.color}33`,
                borderRadius: 14, padding: "18px 14px", textAlign: "center",
                opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [16, 0])}px)`,
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: m.color }}>{m.val}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{m.label}</div>
              </div>
            );
          })}
        </div>

        {/* Equity curve comparison */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.1)",
          borderRadius: 14, padding: "18px 24px",
        }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af" }}>
              <span style={{ color: "#22d3ee", fontWeight: 700 }}>─</span> ML Strategy
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af" }}>
              <span style={{ color: "#475569" }}>- -</span> Buy &amp; Hold
            </div>
          </div>
          <svg width={CW} height={220} viewBox={`0 0 ${CW} 220`}>
            {[0, 0.25, 0.5, 0.75, 1].map(p => (
              <line key={p} x1={0} y1={200 * p} x2={CW} y2={200 * p}
                stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            ))}
            <path d={eqPath(EQUITY_BH, visEq)} fill="none" stroke="#475569" strokeWidth={1.5} strokeDasharray="6,4" />
            <path d={eqPath(EQUITY_ML, visEq)} fill="none" stroke="#22d3ee" strokeWidth={2.5} />
          </svg>
        </div>

        {/* Brand credit */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
          marginTop: 18, opacity: photoSp,
          transform: `scale(${interpolate(photoSp, [0, 1], [0.9, 1])})`,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", overflow: "hidden",
            border: "2px solid #22d3ee", boxShadow: "0 0 18px rgba(34,211,238,0.3)",
          }}>
            <Img src={staticFile("images/steve.jpg")}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#22d3ee", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Presented by
            </div>
            <div style={{ fontSize: 15, color: "#f1f5f9", fontWeight: 700 }}>{ORG}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 8: Risk Mathematics ─────────────────────────────────────────────────
function RiskScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.riskIn, T.riskIn + 30], [0, 1]);
  const fadeOut = frame >= T.secIn ? ci(frame, [T.secIn, T.secIn + 25], [1, 0]) : 1;
  const formulas = [
    { label: "Sharpe Ratio",    eq: "SR = (Rp − Rf) / σp",                      color: "#22d3ee" },
    { label: "Value at Risk",   eq: "VaR₉₅ = μ − 1.645 · σ  (daily P&L)",       color: "#a78bfa" },
    { label: "Max Drawdown",    eq: "MDD = (Peak − Trough) / Peak",              color: "#f87171" },
    { label: "Calmar Ratio",    eq: "Calmar = Annualized Return / |MDD|",        color: "#4ade80" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 18, padding: "32px 48px", width: 740 }}>
        <SceneTitle text="Quantitative Risk Mathematics" frame={frame} startFrame={T.riskIn} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {formulas.map((f, i) => {
            const sp = spring({ frame: frame - T.riskIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${f.color}0d`, border: `1px solid ${f.color}33`,
                borderRadius: 10, padding: "14px 20px",
                opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-24, 0])}px)`,
              }}>
                <div style={{ fontSize: 11, color: f.color, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{f.label}</div>
                <div style={{ fontSize: 17, color: "#e5e7eb", fontFamily: "monospace" }}>{f.eq}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 9: Regulatory Surveillance ─────────────────────────────────────────
function SecScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.secIn, T.secIn + 30], [0, 1]);
  const fadeOut = frame >= T.pharmaIn ? ci(frame, [T.pharmaIn, T.pharmaIn + 25], [1, 0]) : 1;
  const agencies = [
    { icon: "🏛", label: "SEC MIDAS — Market Surveillance", color: "#22d3ee",
      bullets: ["Ingests 100B+ daily market events detecting spoofing and layering in microseconds", "Anomaly detection models flag front-running across all US equity markets"] },
    { icon: "🕸", label: "FINRA — Broker Network Analysis", color: "#a78bfa",
      bullets: ["Graph convolutional networks map dealer networks to surface coordination rings", "Enforcement actions up 35% since ML-powered surveillance deployment"] },
    { icon: "📊", label: "Federal Reserve — Systemic Risk", color: "#4ade80",
      bullets: ["ML stress-test models simulate thousands of macro scenarios simultaneously", "Early warning signals for contagion risk across interconnected financial institutions"] },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 18, padding: "32px 48px", width: 860 }}>
        <SceneTitle text="Government & Regulatory Applications" frame={frame} startFrame={T.secIn} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {agencies.map((a, i) => {
            const sp = spring({ frame: frame - T.secIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${a.color}0d`, border: `1px solid ${a.color}33`,
                borderRadius: 12, padding: "16px 22px",
                display: "flex", alignItems: "flex-start", gap: 16,
                opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-24, 0])}px)`,
              }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{a.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: a.color, marginBottom: 6 }}>{a.label}</div>
                  {a.bullets.map((b, j) => (
                    <div key={j} style={{ fontSize: 12, color: "#9ca3af", marginBottom: j < a.bullets.length - 1 ? 4 : 0 }}>• {b}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 10: Healthcare & Pharma Trading ─────────────────────────────────────
function PharmaScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.pharmaIn, T.pharmaIn + 30], [0, 1]);
  const fadeOut = frame >= T.energyIn ? ci(frame, [T.energyIn, T.energyIn + 25], [1, 0]) : 1;
  const cases = [
    { icon: "💊", label: "FDA Approval Probability Modeling", color: "#f472b6",
      stat: "72% accuracy", statColor: "#4ade80",
      desc: "Gradient boosting on clinical trial databases informs event-driven biotech strategies" },
    { icon: "📄", label: "Clinical Pipeline Sentiment", color: "#22d3ee",
      stat: "Days before consensus", statColor: "#fbbf24",
      desc: "NLP parses conference abstracts and patent filings to anticipate drug approval milestones" },
    { icon: "📈", label: "Uncorrelated Alpha Generation", color: "#a78bfa",
      stat: "Low market beta", statColor: "#4ade80",
      desc: "Healthcare ML signals provide genuine diversification for institutional portfolios" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 18, padding: "32px 48px", width: 860 }}>
        <SceneTitle text="Healthcare & Pharma Trading" frame={frame} startFrame={T.pharmaIn} color="#f472b6" />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {cases.map((c, i) => {
            const sp = spring({ frame: frame - T.pharmaIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${c.color}0d`, border: `1px solid ${c.color}33`,
                borderRadius: 12, padding: "16px 22px",
                display: "flex", alignItems: "flex-start", gap: 16,
                opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-24, 0])}px)`,
              }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{c.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{c.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: c.statColor }}>{c.stat}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 11: Energy & Commodity Trading ──────────────────────────────────────
function EnergyScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.energyIn, T.energyIn + 30], [0, 1]);
  const fadeOut = frame >= T.finalIn ? ci(frame, [T.finalIn, T.finalIn + 25], [1, 0]) : 1;
  const apps = [
    { icon: "🛢", label: "Crude Inventory Forecasting", color: "#f59e0b",
      stat: "Pre-report alpha", statColor: "#4ade80",
      desc: "LSTMs trained on satellite oil storage imagery and shipping traffic forecast EIA inventory data" },
    { icon: "🔥", label: "Natural Gas Spread Optimization", color: "#22d3ee",
      stat: "Sharpe > 2.0", statColor: "#fbbf24",
      desc: "RL agents optimize hub-to-hub spread trades by learning from thousands of market simulations" },
    { icon: "☀️", label: "Renewable Energy Price Prediction", color: "#4ade80",
      stat: "Multi-regime alpha", statColor: "#a78bfa",
      desc: "Weather pattern models combined with grid data forecast intraday electricity spot prices" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 18, padding: "32px 48px", width: 860 }}>
        <SceneTitle text="Energy & Commodity Trading" frame={frame} startFrame={T.energyIn} color="#f59e0b" />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {apps.map((a, i) => {
            const sp = spring({ frame: frame - T.energyIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${a.color}0d`, border: `1px solid ${a.color}33`,
                borderRadius: 12, padding: "16px 22px",
                display: "flex", alignItems: "flex-start", gap: 16,
                opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-24, 0])}px)`,
              }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{a.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: a.color }}>{a.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: a.statColor }}>{a.stat}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 12: Final Portfolio Results ─────────────────────────────────────────
function FinalScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.finalIn, T.finalIn + 30], [0, 1]);
  const metrics = [
    { icon: "🎯", label: "Direction Accuracy",  val: "58%",   sub: "daily S&P 500 classification",   color: "#22d3ee" },
    { icon: "📈", label: "Annualized Return",   val: "14%",   sub: "with 12% volatility",             color: "#4ade80" },
    { icon: "⚡", label: "Sharpe Ratio",        val: "1.8",   sub: "combined LSTM + direction model", color: "#fbbf24" },
    { icon: "📉", label: "Max Drawdown",        val: "−15%",  sub: "through COVID crash & rate shock", color: "#f87171" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <div style={{ width: 1100 }}>
        <SceneTitle text="Portfolio Results — Multi-Regime Performance" frame={frame} startFrame={T.finalIn} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 22 }}>
          {metrics.map((m, i) => {
            const sp = spring({ frame: frame - T.finalIn - i * 25, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${m.color}0d`, border: `1px solid ${m.color}33`,
                borderRadius: 14, padding: "20px 14px", textAlign: "center",
                opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [16, 0])}px)`,
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{m.icon}</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: m.color }}>{m.val}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, lineHeight: 1.4 }}>{m.sub}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, fontWeight: 600 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 12, padding: "16px 24px", fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
          Strategy maintains profitability through multiple market regimes — profitable across bull markets, rate shocks, and the 2020 COVID crash.
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Main Composition ──────────────────────────────────────────────────────────
export function MLTrading() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{
      background: "radial-gradient(circle at top, #1e293b, #020617 45%)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#e5e7eb",
    }}>
      <NarrationTrack />
      {frame < T.spxIn        + 30 && <TitleScene     frame={frame} />}
      {frame >= T.spxIn       && frame < T.featuresIn  + 30 && <SPXScene      frame={frame} />}
      {frame >= T.featuresIn  && frame < T.directionIn + 30 && <FeaturesScene frame={frame} />}
      {frame >= T.directionIn && frame < T.magnitudeIn + 30 && <DirectionScene frame={frame} />}
      {frame >= T.magnitudeIn && frame < T.lstmIn      + 30 && <MagnitudeScene frame={frame} />}
      {frame >= T.lstmIn      && frame < T.outroIn     + 30 && <LSTMScene     frame={frame} />}
      {frame >= T.outroIn     && frame < T.riskIn   + 30 && <OutroScene  frame={frame} />}
      {frame >= T.riskIn      && frame < T.secIn    + 30 && <RiskScene   frame={frame} />}
      {frame >= T.secIn       && frame < T.pharmaIn + 30 && <SecScene    frame={frame} />}
      {frame >= T.pharmaIn    && frame < T.energyIn + 30 && <PharmaScene frame={frame} />}
      {frame >= T.energyIn    && frame < T.finalIn  + 30 && <EnergyScene frame={frame} />}
      {frame >= T.finalIn     && <FinalScene frame={frame} />}
      <BrandBar />
    </AbsoluteFill>
  );
}
