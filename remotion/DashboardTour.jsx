import {
  AbsoluteFill, Audio, Sequence, useCurrentFrame,
  interpolate, spring, staticFile,
} from "remotion";

// ── Duration & Timing ────────────────────────────────────────────────────────
// Exact durations measured from MPEG frame headers.
// TAIL=15f (0.5s): black gap between segments.
// FADE=20f: smooth 0.67s fade-in / fade-out black overlay at each transition.
// ── TOUR_DURATION and TOUR_CLIPS ───────────────────────────────────────────────
// Measured from public/audio/tour-XX.mp3 via: node calc-tour-durations.js
export const TOUR_DURATION = 73465;
const FADE = 20; // frames for fade-in / fade-out overlay
const TAIL = 15; // 0.5s black gap between segments

const TOUR_CLIPS = [
  { id:"01", start:    0, dur:2478 },  // 82.6s
  { id:"02", start: 2493, dur:2614 },  // 87.1s
  { id:"03", start: 5122, dur:2505 },  // 83.5s
  { id:"04", start: 7642, dur:2659 },  // 88.6s
  { id:"05", start:10316, dur:2836 },  // 94.5s
  { id:"06", start:13167, dur:2819 },  // 93.9s
  { id:"07", start:16001, dur:3019 },  // 100.6s
  { id:"08", start:19035, dur:2724 },  // 90.8s
  { id:"09", start:21774, dur:2742 },  // 91.4s
  { id:"10", start:24531, dur:2816 },  // 93.8s
  { id:"11", start:27362, dur:3181 },  // 106.0s
  { id:"12", start:30558, dur:3268 },  // 108.9s
  { id:"13", start:33841, dur:2765 },  // 92.2s
  { id:"14", start:36621, dur:3167 },  // 105.6s
  { id:"15", start:39803, dur:3323 },  // 110.8s
  { id:"16", start:43141, dur:3168 },  // 105.6s
  { id:"17", start:46324, dur:3117 },  // 103.9s
  { id:"18", start:49456, dur:2795 },  // 93.1s
  { id:"19", start:52266, dur:3279 },  // 109.3s
  { id:"20", start:55560, dur:3163 },  // 105.4s
  { id:"21", start:58738, dur:2995 },  // 99.8s
  { id:"22", start:61748, dur:3831 },  // 127.7s
  { id:"23", start:65594, dur:3698 },  // 123.2s
  { id:"24", start:69307, dur:4143 },  // 138.1s
];

// ── Palette ───────────────────────────────────────────────────────────────────
const BG     = "#080d1a";
const SURF   = "#0f1729";
const CARD   = "#141e33";
const BORDER = "#1e2f4a";
const TEXT   = "#dbeafe";
const MUTED  = "#5a7fa0";
const CYAN   = "#22d3ee";
const GREEN  = "#4ade80";
const RED    = "#f87171";
const AMBER  = "#fbbf24";
const PURPLE = "#a78bfa";
const ORG    = "Artificial Intelligence Solutions, Inc.";

// ── Helpers ───────────────────────────────────────────────────────────────────
const ci = (f, inR, outR) =>
  interpolate(f, inR, outR, { extrapolateLeft:"clamp", extrapolateRight:"clamp" });

const sp = (frame, start, delay=0) =>
  spring({ frame: frame-start-delay, fps:30, config:{ damping:18, stiffness:90, mass:0.6 } });

const fadeIn = (f, s, len=20) => ci(f, [s, s+len], [0, 1]);
const slideUp = (f, s, d=0) => ci(f, [s+d, s+d+22], [18, 0]);

// ── Layout constants ──────────────────────────────────────────────────────────
const LEFT_W  = 418;   // left text panel width
const RIGHT_X = 422;   // right panel x start
const RIGHT_W = 858;   // right panel width
const CONTENT_Y = 52;  // below top bar
const CONTENT_H = 618; // above brand bar

// ── Shared: Brand Bar ─────────────────────────────────────────────────────────
const BrandBar = ({ seg }) => (
  <div style={{
    position:"absolute", bottom:0, left:0, right:0, height:50,
    background:`linear-gradient(90deg,${BG} 0%,${SURF} 100%)`,
    borderTop:`2px solid ${CYAN}`,
    display:"flex", alignItems:"center", padding:"0 36px",
    justifyContent:"space-between",
  }}>
    <span style={{ color:MUTED, fontSize:12, fontWeight:600 }}>{ORG}</span>
    <span style={{ color:CYAN, fontSize:11, fontWeight:700, letterSpacing:"0.09em" }}>
      ML TRADING SYSTEM · DASHBOARD TOUR · {seg}/24
    </span>
  </div>
);

// ── Shared: Top bar ───────────────────────────────────────────────────────────
const TopBar = ({ frame, start, icon, title, color }) => {
  const op = fadeIn(frame, start, 16);
  const progress = ((parseInt(title)||1)-1) / 24 * 100;
  return (
    <div style={{
      position:"absolute", top:0, left:0, right:0, height:52,
      background:SURF, borderBottom:`1px solid ${BORDER}`,
      display:"flex", alignItems:"center", padding:"0 28px", gap:14,
      opacity:op,
    }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <span style={{ color, fontSize:16, fontWeight:800 }}>{title}</span>
      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:180, height:6, background:BORDER, borderRadius:4 }}>
          <div style={{ height:"100%", width:`${progress}%`, background:color, borderRadius:4, transition:"none" }} />
        </div>
        <span style={{ color:MUTED, fontSize:12 }}>Tour Progress</span>
      </div>
    </div>
  );
};

// ── Shared: Panel divider ─────────────────────────────────────────────────────
const Divider = ({ frame, start }) => (
  <div style={{
    position:"absolute", left:LEFT_W, top:CONTENT_Y, width:2,
    height:CONTENT_H, background:BORDER,
    opacity: fadeIn(frame, start, 20),
  }} />
);

// ── Left Panel — text + key terms ─────────────────────────────────────────────
const LeftPanel = ({ frame, start, desc, terms, color=CYAN }) => (
  <div style={{
    position:"absolute", left:0, top:CONTENT_Y,
    width:LEFT_W, height:CONTENT_H,
    padding:"22px 26px", boxSizing:"border-box",
    display:"flex", flexDirection:"column", gap:14,
    overflow:"hidden",
  }}>
    {/* Description */}
    <div style={{
      color:TEXT, fontSize:14, lineHeight:1.7,
      opacity: fadeIn(frame, start, 25),
      transform:`translateY(${slideUp(frame, start)}px)`,
    }}>{desc}</div>

    {/* Key Terms */}
    <div style={{
      color:color, fontSize:11, fontWeight:700, letterSpacing:"0.07em",
      textTransform:"uppercase", marginTop:2,
      opacity: fadeIn(frame, start+15, 15),
    }}>Key Terms</div>

    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {terms.map((t,i) => {
        const sc = sp(frame, start, 20+i*10);
        return (
          <div key={i} style={{
            background:CARD, borderRadius:8, padding:"9px 14px",
            borderLeft:`3px solid ${t.color||color}`,
            opacity: sc,
            transform:`translateX(${ci(frame,[start+20+i*10,start+20+i*10+20],[-16,0])}px)`,
          }}>
            <div style={{ color:t.color||color, fontSize:12, fontWeight:800, marginBottom:2 }}>
              {t.label}
            </div>
            <div style={{ color:MUTED, fontSize:12, lineHeight:1.5 }}>{t.def}</div>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Right Panel wrapper ───────────────────────────────────────────────────────
const RightPanel = ({ frame, start, children }) => (
  <div style={{
    position:"absolute", left:RIGHT_X, top:CONTENT_Y,
    width:RIGHT_W, height:CONTENT_H,
    display:"flex", alignItems:"center", justifyContent:"center",
    opacity: fadeIn(frame, start, 20),
    overflow:"hidden",
    padding:"10px 20px", boxSizing:"border-box",
  }}>
    {children}
  </div>
);

// ── Two-Panel wrapper ─────────────────────────────────────────────────────────
const TwoPanel = ({ frame, start, seg, icon, title, color=CYAN, desc, terms, right }) => (
  <AbsoluteFill style={{ background:BG, fontFamily:"system-ui,sans-serif" }}>
    <TopBar frame={frame} start={start} icon={icon} title={title} color={color} />
    <Divider frame={frame} start={start} />
    <LeftPanel frame={frame} start={start} desc={desc} terms={terms} color={color} />
    <RightPanel frame={frame} start={start}>{right(frame, start)}</RightPanel>
    <BrandBar seg={seg} />
  </AbsoluteFill>
);

// ══════════════════════════════════════════════════════════════════════════════
// RIGHT-PANEL VISUALS
// ══════════════════════════════════════════════════════════════════════════════

// ── Vis 01: Dashboard system overview map ─────────────────────────────────────
const Vis01 = (frame, start) => {
  const nodes = [
    { x:410, y:100, label:"Market Data", icon:"📡", color:CYAN },
    { x:200, y:210, label:"ML Engine", icon:"🤖", color:GREEN },
    { x:620, y:210, label:"Options Data", icon:"⚡", color:AMBER },
    { x:100, y:340, label:"Signal Panel", icon:"📊", color:GREEN },
    { x:310, y:340, label:"GEX Chart", icon:"⚡", color:AMBER },
    { x:510, y:340, label:"Flows", icon:"🌊", color:PURPLE },
    { x:720, y:340, label:"Fundamentals", icon:"📋", color:CYAN },
    { x:410, y:470, label:"Trade Decision", icon:"🎯", color:RED },
  ];
  const edges = [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6],[3,7],[4,7],[5,7]];
  return (
    <svg width={820} height={560} viewBox="0 0 820 560">
      {edges.map(([a,b],i) => {
        const op = ci(frame,[start+i*4,start+i*4+15],[0,1]);
        return (
          <line key={i} x1={nodes[a].x} y1={nodes[a].y+18}
            x2={nodes[b].x} y2={nodes[b].y-18}
            stroke={BORDER} strokeWidth={1.5} opacity={op} />
        );
      })}
      {nodes.map((n,i) => {
        const sc = sp(frame, start, i*8);
        return (
          <g key={i} transform={`translate(${n.x},${n.y})`} opacity={sc}>
            <rect x={-60} y={-22} width={120} height={44} rx={8}
              fill={CARD} stroke={n.color} strokeWidth={1.5} />
            <text x={0} y={-4} fill={n.color} fontSize={18} textAnchor="middle">{n.icon}</text>
            <text x={0} y={12} fill={TEXT} fontSize={11} fontWeight="700" textAnchor="middle">{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Vis 02: Asset tab grid ────────────────────────────────────────────────────
const Vis02 = (frame, start) => {
  const groups = [
    { label:"Index ETFs",       color:CYAN,   assets:["SPY","QQQ","DIA","IWM"] },
    { label:"Magnificent Seven", color:GREEN, assets:["AAPL","MSFT","NVDA","TSLA","AMZN","GOOGL","META"] },
    { label:"Futures",          color:AMBER,  assets:["ES=F","NQ=F","RTY=F","YM=F"] },
    { label:"Options Vehicles", color:PURPLE, assets:["SPX","VIX","NDX"] },
  ];
  return (
    <div style={{ width:"100%", padding:"10px 0" }}>
      {groups.map((g,gi) => {
        const op = sp(frame, start, gi*16);
        return (
          <div key={gi} style={{ marginBottom:18, opacity:op,
            transform:`translateX(${ci(frame,[start+gi*16,start+gi*16+22],[-20,0])}px)` }}>
            <div style={{ color:g.color, fontSize:12, fontWeight:800, marginBottom:8,
              letterSpacing:"0.07em", textTransform:"uppercase", paddingLeft:4,
              borderLeft:`3px solid ${g.color}` }}>
              &nbsp;{g.label}
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {g.assets.map((a,ai) => {
                const asc = sp(frame, start, gi*16+ai*5);
                return (
                  <div key={ai} style={{
                    background:`${g.color}18`, border:`1.5px solid ${g.color}77`,
                    borderRadius:7, padding:"7px 14px",
                    color:g.color, fontSize:14, fontWeight:900,
                    transform:`scale(${asc})`,
                  }}>{a}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Vis 03: Labeled Candlestick chart ─────────────────────────────────────────
const Vis03 = (frame, start) => {
  const candles = [
    {o:182,h:185,l:181,c:184},{o:184,h:186,l:183,c:183.2},
    {o:183.2,h:187,l:183,c:186.1},{o:186.1,h:187.5,l:184,c:184.8},
    {o:184.8,h:188,l:184,c:187.5},{o:187.5,h:189,l:186,c:188.2},
    {o:188.2,h:189,l:185,c:185.5},{o:185.5,h:186,l:183,c:183.2},
    {o:183.2,h:185,l:182,c:184.6},{o:184.6,h:187,l:184,c:186.5},
  ];
  const minP=181,maxP=189,W=800,H=340;
  const xS = i => 40 + i*(W/candles.length)+20;
  const yP = p => H - ((p-minP)/(maxP-minP))*H;
  const bw = 46;
  const reveal = ci(frame,[start,start+80],[0,candles.length]);
  return (
    <svg width={820} height={400} viewBox="0 0 820 400">
      {/* Axes */}
      {[182,184,186,188].map(p=>(
        <g key={p}>
          <line x1={30} x2={790} y1={yP(p)} y2={yP(p)} stroke={BORDER} strokeWidth={1} strokeDasharray="4,4" />
          <text x={26} y={yP(p)+4} fill={MUTED} fontSize={11} textAnchor="end">{p}</text>
        </g>
      ))}
      {/* Candles */}
      {candles.slice(0,Math.ceil(reveal)).map((c,i)=>{
        const bull = c.c>=c.o;
        const col = bull ? GREEN : RED;
        const bodyTop = yP(Math.max(c.o,c.c));
        const bodyH = Math.max(Math.abs(yP(c.o)-yP(c.c)),2);
        const alpha = ci(frame,[start+i*8,start+i*8+15],[0,1]);
        return (
          <g key={i} opacity={alpha}>
            <line x1={xS(i)} x2={xS(i)} y1={yP(c.h)} y2={yP(c.l)} stroke={col} strokeWidth={2} />
            <rect x={xS(i)-bw/2} y={bodyTop} width={bw} height={bodyH} fill={col} rx={3} />
          </g>
        );
      })}
      {/* Annotations */}
      {frame > start+90 && (
        <g opacity={ci(frame,[start+90,start+110],[0,1])}>
          {/* High label */}
          <line x1={xS(5)+28} x2={xS(5)+28} y1={yP(candles[5].h)+2} y2={yP(candles[5].h)+48} stroke={MUTED} strokeWidth={1.5} strokeDasharray="3,3" />
          <text x={xS(5)+34} y={yP(candles[5].h)+56} fill={MUTED} fontSize={12} fontWeight="700">HIGH — Upper Wick</text>
          {/* Body label */}
          <line x1={xS(5)-28} x2={xS(5)-60} y1={yP(candles[5].o)-2} y2={yP(candles[5].o)-2} stroke={GREEN} strokeWidth={1.5} strokeDasharray="3,3" />
          <text x={xS(5)-66} y={yP(candles[5].o)+4} fill={GREEN} fontSize={12} fontWeight="700" textAnchor="end">BODY — Open/Close</text>
          {/* Low label */}
          <line x1={xS(7)+28} x2={xS(7)+28} y1={yP(candles[7].l)-2} y2={yP(candles[7].l)-48} stroke={RED} strokeWidth={1.5} strokeDasharray="3,3" />
          <text x={xS(7)+34} y={yP(candles[7].l)-52} fill={RED} fontSize={12} fontWeight="700">LOW — Lower Wick</text>
          {/* Arrows */}
          <text x={xS(4)-60} y={260} fill={GREEN} fontSize={13} fontWeight="800">▲ Bullish</text>
          <text x={xS(6)-60} y={260} fill={RED} fontSize={13} fontWeight="800">▼ Bearish</text>
        </g>
      )}
      {/* Timeframe row */}
      {["15m","1H","4H","1D","1W"].map((tf,i)=>(
        <g key={tf}>
          <rect x={40+i*72} y={360} width={64} height={26} rx={6}
            fill={tf==="4H"?CYAN:CARD} stroke={tf==="4H"?CYAN:BORDER} />
          <text x={40+i*72+32} y={378} fill={tf==="4H"?BG:MUTED} fontSize={12} fontWeight="700" textAnchor="middle">{tf}</text>
        </g>
      ))}
      <text x={420} y={378} fill={MUTED} fontSize={12}>← Timeframe Selector</text>
    </svg>
  );
};

// ── Vis 04: BUY / SELL / HOLD badges with ML flow ────────────────────────────
const Vis04 = (frame, start) => {
  const signals = [
    { label:"BUY",  color:GREEN,  icon:"▲", desc:"Price expected to rise" },
    { label:"SELL", color:RED,    icon:"▼", desc:"Price expected to fall" },
    { label:"HOLD", color:AMBER,  icon:"◆", desc:"Insufficient conviction" },
  ];
  const steps = ["OHLCV Data","Feature Eng.","XGBoost Model","Signal Output"];
  return (
    <div style={{ width:"100%" }}>
      {/* ML pipeline */}
      <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:28,
        opacity: fadeIn(frame,start+10,20) }}>
        {steps.map((s,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center" }}>
            <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:8,
              padding:"8px 14px", color:MUTED, fontSize:12, fontWeight:700, whiteSpace:"nowrap" }}>{s}</div>
            {i<steps.length-1 && <div style={{ color:MUTED, fontSize:18, padding:"0 6px" }}>→</div>}
          </div>
        ))}
      </div>
      {/* Signal badges */}
      <div style={{ display:"flex", gap:22 }}>
        {signals.map((s,i)=>{
          const sc = sp(frame,start,20+i*20);
          return (
            <div key={i} style={{
              flex:1, background:CARD, borderRadius:14,
              border:`2px solid ${s.color}66`,
              padding:"26px 18px", textAlign:"center",
              boxShadow:`0 0 30px ${s.color}18`,
              transform:`scale(${sc}) translateY(${ci(frame,[start+20+i*20,start+20+i*20+25],[28,0])}px)`,
              opacity:sc,
            }}>
              <div style={{ fontSize:44, marginBottom:12 }}>{s.icon}</div>
              <div style={{
                background:`${s.color}22`, border:`2px solid ${s.color}`,
                borderRadius:10, padding:"10px 0",
                color:s.color, fontSize:30, fontWeight:900, letterSpacing:3, marginBottom:14,
              }}>{s.label}</div>
              <div style={{ color:MUTED, fontSize:13, lineHeight:1.5 }}>{s.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Vis 05: Probability gauge bar ─────────────────────────────────────────────
const Vis05 = (frame, start) => {
  const prob = ci(frame,[start+15,start+90],[0,78]);
  const col = prob>65 ? GREEN : prob>45 ? AMBER : RED;
  const stats = [
    {l:"Signal",     v:"BUY",     c:GREEN},
    {l:"Probability",v:`${Math.round(prob)}%`, c:col},
    {l:"Magnitude",  v:"+2.4%",  c:TEXT},
    {l:"RSI (14)",   v:"61.2",   c:AMBER},
    {l:"MACD",       v:"Bullish",c:GREEN},
    {l:"Conviction", v:"HIGH",   c:GREEN},
  ];
  return (
    <div style={{ width:"100%" }}>
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:"24px 26px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ color:MUTED, fontSize:12, fontWeight:700 }}>CONFIDENCE SCORE — SPY</span>
          <span style={{ color:col, fontSize:26, fontWeight:900 }}>{Math.round(prob)}%</span>
        </div>
        <div style={{ background:`${BORDER}88`, borderRadius:8, height:28, overflow:"hidden", position:"relative" }}>
          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${prob}%`,
            background:`linear-gradient(90deg,${RED} 0%,${AMBER} 45%,${GREEN} 80%)`, borderRadius:8 }} />
          <div style={{ position:"absolute", left:"65%", top:0, bottom:0, width:2, background:TEXT, opacity:0.4 }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
          <span style={{ color:RED, fontSize:11 }}>0%  Low</span>
          <span style={{ color:AMBER, fontSize:11 }}>65% Threshold</span>
          <span style={{ color:GREEN, fontSize:11 }}>100% High</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {stats.map((s,i)=>{
          const sc = sp(frame,start,40+i*10);
          return (
            <div key={i} style={{ background:CARD, borderRadius:8, padding:"11px 16px",
              display:"flex", justifyContent:"space-between",
              opacity:sc, transform:`translateX(${ci(frame,[start+40+i*10,start+40+i*10+20],[-16,0])}px)` }}>
              <span style={{ color:MUTED, fontSize:13 }}>{s.l}</span>
              <span style={{ color:s.c, fontSize:14, fontWeight:800 }}>{s.v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Vis 06: Feature importance bars ──────────────────────────────────────────
const Vis06 = (frame, start) => {
  const features = [
    {n:"RSI (14)",         w:0.82, c:AMBER,  v:"61.2"},
    {n:"MACD",             w:0.74, c:GREEN,  v:"Bullish"},
    {n:"ATR",              w:0.68, c:CYAN,   v:"3.24"},
    {n:"Bollinger Bands",  w:0.61, c:PURPLE, v:"Upper"},
    {n:"Volume Ratio",     w:0.55, c:RED,    v:"1.4×"},
    {n:"Trend Score",      w:0.49, c:TEXT,   v:"Strong"},
    {n:"EMA Cross",        w:0.41, c:GREEN,  v:"Golden"},
    {n:"Price Momentum",   w:0.35, c:AMBER,  v:"+1.8%"},
  ];
  return (
    <div style={{ width:"100%" }}>
      <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:14,
        opacity: fadeIn(frame,start,16) }}>FEATURE IMPORTANCE — MODEL WEIGHT</div>
      {features.map((f,i)=>{
        const sc = sp(frame,start,i*10);
        const barW = ci(frame,[start+i*10+8,start+i*10+42],[0,f.w*100]);
        return (
          <div key={i} style={{ marginBottom:10, opacity:sc,
            transform:`translateX(${ci(frame,[start+i*10,start+i*10+20],[-20,0])}px)` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
              <span style={{ color:f.c, fontSize:13, fontWeight:700 }}>{f.n}</span>
              <span style={{ color:f.c, fontSize:13, fontWeight:700 }}>{f.v}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ flex:1, background:`${BORDER}88`, borderRadius:4, height:12 }}>
                <div style={{ height:"100%", width:`${barW}%`, background:f.c, borderRadius:4 }} />
              </div>
              <span style={{ color:MUTED, fontSize:11, minWidth:34, textAlign:"right" }}>{Math.round(f.w*100)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Vis 07: Signal quality checklist ──────────────────────────────────────────
const Vis07 = (frame, start) => {
  const items = [
    {t:"Trend aligned across timeframes",    pass:true},
    {t:"Volume confirming the move",          pass:true},
    {t:"Options flows support direction",     pass:true},
    {t:"Volatility within normal range",      pass:true},
    {t:"No conflicting macro events",         pass:false},
    {t:"RSI not in extreme overbought zone",  pass:true},
    {t:"MACD crossover confirmed",            pass:true},
    {t:"Price above 20-day moving average",   pass:true},
  ];
  const score = items.filter(x=>x.pass).length;
  return (
    <div style={{ display:"flex", gap:20, width:"100%" }}>
      <div style={{ flex:1 }}>
        {items.map((it,i)=>{
          const sc = sp(frame,start,i*11);
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
              background:CARD, borderRadius:8, padding:"10px 14px", marginBottom:8,
              border:`1px solid ${it.pass?GREEN+"33":RED+"33"}`,
              opacity:sc, transform:`translateX(${ci(frame,[start+i*11,start+i*11+20],[-22,0])}px)` }}>
              <div style={{ width:26, height:26, borderRadius:"50%",
                background:`${it.pass?GREEN:RED}22`, border:`2px solid ${it.pass?GREEN:RED}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                color:it.pass?GREEN:RED, fontWeight:900, fontSize:14, flexShrink:0 }}>
                {it.pass?"✓":"✗"}
              </div>
              <span style={{ color:TEXT, fontSize:13 }}>{it.t}</span>
            </div>
          );
        })}
      </div>
      <div style={{ width:160, display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", opacity:ci(frame,[start+80,start+100],[0,1]) }}>
        <div style={{ background:CARD, border:`2px solid ${GREEN}66`, borderRadius:14,
          padding:"22px 20px", textAlign:"center" }}>
          <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:8 }}>SETUP SCORE</div>
          <div style={{ color:GREEN, fontSize:54, fontWeight:900 }}>{score}/8</div>
          <div style={{ color:GREEN, fontSize:12, fontWeight:800, marginTop:8 }}>HIGH QUALITY</div>
          <div style={{ color:MUTED, fontSize:11, marginTop:8, lineHeight:1.5 }}>
            More green = higher probability
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Vis 08: Market Summary breadth ────────────────────────────────────────────
const Vis08 = (frame, start) => {
  const bull = ci(frame,[start+20,start+80],[0,68]);
  const indices = [
    {n:"S&P 500",v:"5,847",c:"+1.2%",col:GREEN},
    {n:"NASDAQ", v:"20,441",c:"+1.8%",col:GREEN},
    {n:"DOW",    v:"43,282",c:"+0.7%",col:GREEN},
    {n:"VIX",    v:"16.4",  c:"-1.1", col:AMBER},
  ];
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:14 }}>
        <div style={{ background:CARD, border:`2px solid ${GREEN}55`, borderRadius:12,
          padding:"18px 20px", flex:1, textAlign:"center", opacity:fadeIn(frame,start,22) }}>
          <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:8 }}>MARKET DIRECTION</div>
          <div style={{ background:`${GREEN}22`, border:`2px solid ${GREEN}`, borderRadius:10,
            padding:"10px 0", color:GREEN, fontSize:24, fontWeight:900, letterSpacing:2 }}>BULLISH</div>
          <div style={{ color:MUTED, fontSize:11, marginTop:8 }}>ML consensus</div>
        </div>
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12,
          padding:"18px 20px", flex:2, opacity:fadeIn(frame,start+10,22) }}>
          <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:12 }}>MARKET BREADTH — % ASSETS BULLISH</div>
          <div style={{ background:`${BORDER}88`, borderRadius:8, height:22, overflow:"hidden", marginBottom:8 }}>
            <div style={{ height:"100%", width:`${bull}%`,
              background:`linear-gradient(90deg,${GREEN},${CYAN})`, borderRadius:8 }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:GREEN, fontWeight:800, fontSize:16 }}>{Math.round(bull)}% Bullish</span>
            <span style={{ color:RED, fontWeight:800, fontSize:16 }}>{Math.round(100-bull)}% Bearish</span>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        {indices.map((idx,i)=>{
          const sc = sp(frame,start,50+i*12);
          return (
            <div key={i} style={{ flex:1, background:CARD, borderRadius:8, padding:"12px 14px",
              border:`1px solid ${idx.col}33`, opacity:sc }}>
              <div style={{ color:MUTED, fontSize:11 }}>{idx.n}</div>
              <div style={{ color:TEXT, fontSize:16, fontWeight:800 }}>{idx.v}</div>
              <div style={{ color:idx.col, fontSize:13, fontWeight:700 }}>{idx.c}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Vis 09: ML Rankings table ─────────────────────────────────────────────────
const Vis09 = (frame, start) => {
  const rows = [
    {sym:"NVDA",sig:"BUY", prob:89,mag:"+4.1%",col:GREEN},
    {sym:"TSLA",sig:"BUY", prob:82,mag:"+3.2%",col:GREEN},
    {sym:"QQQ", sig:"BUY", prob:76,mag:"+1.8%",col:GREEN},
    {sym:"SPY", sig:"BUY", prob:71,mag:"+1.2%",col:GREEN},
    {sym:"AAPL",sig:"HOLD",prob:54,mag:"+0.6%",col:AMBER},
    {sym:"BAC", sig:"HOLD",prob:48,mag:"+0.2%",col:AMBER},
    {sym:"XOM", sig:"SELL",prob:28,mag:"-1.4%",col:RED},
    {sym:"UNH", sig:"SELL",prob:22,mag:"-2.1%",col:RED},
  ];
  return (
    <div style={{ width:"100%" }}>
      <div style={{ display:"grid", gridTemplateColumns:"80px 70px 1fr 100px",
        gap:10, padding:"7px 14px", color:MUTED, fontSize:11, fontWeight:700,
        letterSpacing:"0.06em", borderBottom:`1px solid ${BORDER}`,
        opacity:fadeIn(frame,start,16) }}>
        <span>SYMBOL</span><span>SIGNAL</span><span>PROBABILITY</span><span style={{textAlign:"right"}}>MAGNITUDE</span>
      </div>
      {rows.map((r,i)=>{
        const sc = sp(frame,start,i*10);
        const bw = ci(frame,[start+i*10+12,start+i*10+46],[0,r.prob]);
        return (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 70px 1fr 100px",
            gap:10, padding:"10px 14px", alignItems:"center",
            background:i%2===0?CARD:SURF, borderRadius:6, marginBottom:4,
            opacity:sc, transform:`translateX(${ci(frame,[start+i*10,start+i*10+20],[-18,0])}px)` }}>
            <span style={{ color:TEXT, fontWeight:800, fontSize:15 }}>{r.sym}</span>
            <span style={{ background:`${r.col}22`, border:`1px solid ${r.col}66`,
              color:r.col, borderRadius:6, padding:"3px 8px", fontSize:12, fontWeight:800 }}>{r.sig}</span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ flex:1, background:`${BORDER}88`, borderRadius:4, height:8 }}>
                <div style={{ height:"100%", width:`${bw}%`, background:r.col, borderRadius:4 }} />
              </div>
              <span style={{ color:r.col, fontSize:12, fontWeight:700, minWidth:32 }}>{r.prob}%</span>
            </div>
            <span style={{ color:r.col, fontWeight:800, fontSize:14, textAlign:"right" }}>{r.mag}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Vis 10: Gamma concept diagram ────────────────────────────────────────────
const Vis10 = (frame, start) => {
  const arrowOp = ci(frame,[start+35,start+55],[0,1]);
  return (
    <div style={{ display:"flex", gap:18, width:"100%" }}>
      {[
        {regime:"POSITIVE GAMMA",col:GREEN,
         items:[
           {arrow:"↓","act":"Dealers BUY",res:"Price cushioned"},
           {arrow:"↑","act":"Dealers SELL",res:"Price dampened"},
         ],
         result:"Volatility SUPPRESSED — price stays in range"},
        {regime:"NEGATIVE GAMMA",col:RED,
         items:[
           {arrow:"↓↓","act":"Dealers SELL",res:"Move amplified"},
           {arrow:"↑↑","act":"Dealers BUY",res:"Move amplified"},
         ],
         result:"Volatility AMPLIFIED — moves accelerate"},
      ].map((panel,pi)=>(
        <div key={pi} style={{ flex:1, background:CARD, border:`2px solid ${panel.col}44`,
          borderRadius:14, padding:"20px 18px",
          opacity:ci(frame,[start+pi*16,start+pi*16+22],[0,1]) }}>
          <div style={{ color:panel.col, fontSize:13, fontWeight:800, marginBottom:14,
            textTransform:"uppercase", letterSpacing:"0.07em" }}>{panel.regime}</div>
          {panel.items.map((it,i)=>(
            <div key={i} style={{ display:"flex", gap:12, alignItems:"center",
              marginBottom:14, opacity:arrowOp }}>
              <div style={{ fontSize:26, color:panel.col, width:40, textAlign:"center" }}>{it.arrow}</div>
              <div>
                <div style={{ color:panel.col, fontWeight:700, fontSize:13 }}>{it.act}</div>
                <div style={{ color:MUTED, fontSize:12 }}>{it.res}</div>
              </div>
            </div>
          ))}
          <div style={{ background:`${panel.col}11`, borderRadius:8, padding:"10px 12px",
            opacity:arrowOp }}>
            <span style={{ color:panel.col, fontSize:12, fontWeight:700 }}>Result: </span>
            <span style={{ color:TEXT, fontSize:12 }}>{panel.result}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Vis 11: GEX bar chart ─────────────────────────────────────────────────────
const Vis11 = (frame, start) => {
  const strikes=[575,578,580,582,585,588,590,592,595,598,600,602,605];
  const gex=   [-1.2,-0.8,2.4,3.8,-0.5,1.2,5.6,2.1,-1.8,-2.4,3.2,4.8,-0.6];
  const maxG=Math.max(...gex.map(Math.abs));
  const W=800,PH=200,midY=130,bw=42;
  const xS = i => 30+i*(W/strikes.length)+18;
  const reveal = ci(frame,[start,start+70],[0,strikes.length]);
  return (
    <svg width={820} height={350} viewBox="0 0 820 350">
      <text x={410} y={18} fill={MUTED} fontSize={12} textAnchor="middle" fontWeight="700">GAMMA EXPOSURE BY STRIKE — SPY</text>
      <line x1={20} x2={800} y1={midY} y2={midY} stroke={MUTED} strokeWidth={1.5} />
      <text x={14} y={midY+4} fill={MUTED} fontSize={10} textAnchor="end">0</text>

      {strikes.slice(0,Math.ceil(reveal)).map((s,i)=>{
        const v=gex[i]; const col=v>0?GREEN:RED;
        const bodyY=v>0?midY-(v/maxG)*90:midY;
        const bodyH=Math.abs(v/maxG)*90;
        const alpha=ci(frame,[start+i*5,start+i*5+15],[0,1]);
        return (
          <g key={i} opacity={alpha}>
            <rect x={xS(i)-bw/2} y={bodyY} width={bw} height={bodyH||2} fill={col} rx={3} opacity={0.85} />
            <text x={xS(i)} y={v<0?midY+bodyH+13:midY-bodyH-6}
              fill={col} fontSize={9} textAnchor="middle" fontWeight="700">{s}</text>
          </g>
        );
      })}

      {/* Spot */}
      {frame>start+40 && (
        <g opacity={ci(frame,[start+40,start+55],[0,1])}>
          <line x1={xS(6)} x2={xS(6)} y1={24} y2={midY+100}
            stroke={CYAN} strokeWidth={2} strokeDasharray="5,3" />
          <text x={xS(6)+4} y={34} fill={CYAN} fontSize={11} fontWeight="700">SPOT 591</text>
        </g>
      )}
      {/* Gamma Wall */}
      {frame>start+55 && (
        <g opacity={ci(frame,[start+55,start+70],[0,1])}>
          <text x={xS(6)} y={midY-98} fill={GREEN} fontSize={11} fontWeight="800" textAnchor="middle">GAMMA WALL</text>
          <line x1={xS(6)} x2={xS(6)} y1={midY-88} y2={midY-(gex[6]/maxG)*90+2} stroke={GREEN} strokeWidth={1.5} strokeDasharray="3,3" />
        </g>
      )}
      {/* Flip Level */}
      {frame>start+65 && (
        <g opacity={ci(frame,[start+65,start+80],[0,1])}>
          <line x1={xS(2)} x2={xS(2)} y1={24} y2={midY+100} stroke={AMBER} strokeWidth={2} strokeDasharray="6,3" />
          <text x={xS(2)-4} y={260} fill={AMBER} fontSize={11} fontWeight="800" textAnchor="end">FLIP LEVEL</text>
        </g>
      )}
      {/* Put Wall */}
      {frame>start+70 && (
        <text x={xS(1)} y={midY+Math.abs(gex[1]/maxG)*90+22}
          fill={RED} fontSize={11} fontWeight="800" textAnchor="middle"
          opacity={ci(frame,[start+70,start+85],[0,1])}>PUT WALL</text>
      )}

      <text x={60} y={330} fill={GREEN} fontSize={11} fontWeight="700">■ Long Gamma (suppresses vol)</text>
      <text x={340} y={330} fill={RED} fontSize={11} fontWeight="700">■ Short Gamma (amplifies vol)</text>
    </svg>
  );
};

// ── Vis 12: Regime badges + PCR gauge ────────────────────────────────────────
const Vis12 = (frame, start) => {
  const regimes=[
    {label:"PINNED",   col:CYAN,   icon:"📌",desc:"Price locked between gamma walls — low vol environment"},
    {label:"TRENDING", col:GREEN,  icon:"📈",desc:"Gamma supports continued directional momentum"},
    {label:"BREAKOUT", col:RED,    icon:"💥",desc:"Crossed flip level — negative gamma, vol spikes likely"},
  ];
  const pcr = ci(frame,[start+50,start+90],[0,1.18]);
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:14 }}>
        {regimes.map((r,i)=>{
          const sc=sp(frame,start,i*18);
          return (
            <div key={i} style={{ flex:1, background:CARD, borderRadius:12,
              border:`2px solid ${r.col}44`, padding:"16px 14px",
              transform:`scale(${sc})`, opacity:sc }}>
              <div style={{ fontSize:26, marginBottom:8 }}>{r.icon}</div>
              <div style={{ background:`${r.col}22`, border:`1px solid ${r.col}`,
                borderRadius:8, padding:"5px 10px", color:r.col, fontSize:15, fontWeight:900,
                marginBottom:8, display:"inline-block" }}>{r.label}</div>
              <div style={{ color:MUTED, fontSize:12, lineHeight:1.5 }}>{r.desc}</div>
            </div>
          );
        })}
      </div>
      {/* PCR */}
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12,
        padding:"18px 22px", opacity:ci(frame,[start+45,start+65],[0,1]) }}>
        <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:12 }}>
          PUT-CALL RATIO = Total Put Open Interest ÷ Total Call Open Interest
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ flex:1, background:`${BORDER}88`, borderRadius:8, height:20, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.min(pcr/2,1)*100}%`,
              background:`linear-gradient(90deg,${GREEN},${AMBER},${RED})`, borderRadius:8 }} />
          </div>
          <span style={{ color:AMBER, fontSize:26, fontWeight:900, minWidth:50 }}>{pcr.toFixed(2)}</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
          <span style={{ color:GREEN, fontSize:12 }}>{"<0.8 Bullish"}</span>
          <span style={{ color:AMBER, fontSize:12 }}>0.8–1.2 Neutral</span>
          <span style={{ color:RED, fontSize:12 }}>{"›1.2 Bearish"}</span>
        </div>
      </div>
    </div>
  );
};

// ── Vis 13: Tornado chart ─────────────────────────────────────────────────────
const Vis13 = (frame, start) => {
  const strikes=[580,582,585,588,590,592,595,598,600];
  const callVol=[800,1200,2400,3800,5600,4200,2800,1600,900];
  const putVol= [2800,4200,3600,2400,1800,1200,800,600,400];
  const maxV=6000, CW=290, rowH=32, midX=410;
  const reveal=ci(frame,[start,start+60],[0,strikes.length]);
  return (
    <svg width={820} height={360} viewBox="0 0 820 360">
      <text x={410} y={18} fill={MUTED} fontSize={12} textAnchor="middle" fontWeight="700">OPTION FLOWS TORNADO — SPY</text>
      <text x={230} y={35} fill={GREEN} fontSize={12} textAnchor="middle">← Calls</text>
      <text x={590} y={35} fill={RED} fontSize={12} textAnchor="middle">Puts →</text>

      {strikes.slice(0,Math.ceil(reveal)).map((s,i)=>{
        const y=42+i*rowH;
        const callW=(callVol[i]/maxV)*CW;
        const putW=(putVol[i]/maxV)*CW;
        const alpha=ci(frame,[start+i*6,start+i*6+15],[0,1]);
        return (
          <g key={i} opacity={alpha}>
            <rect x={midX-callW} y={y+2} width={callW} height={rowH-4} fill={GREEN} rx={3} opacity={0.75} />
            <rect x={midX} y={y+2} width={putW} height={rowH-4} fill={RED} rx={3} opacity={0.75} />
            <text x={midX} y={y+rowH/2+4} fill={TEXT} fontSize={11} fontWeight="700" textAnchor="middle">{s}</text>
          </g>
        );
      })}
      <line x1={midX} x2={midX} y1={36} y2={42+strikes.length*rowH} stroke={MUTED} strokeWidth={1.5} />

      {/* Summary */}
      <rect x={60} y={330} width={140} height={26} rx={6} fill={`${GREEN}22`} stroke={GREEN} strokeWidth={1} />
      <text x={130} y={348} fill={GREEN} fontSize={12} textAnchor="middle" fontWeight="800">Total Calls 24.8M</text>
      <rect x={220} y={330} width={140} height={26} rx={6} fill={`${RED}22`} stroke={RED} strokeWidth={1} />
      <text x={290} y={348} fill={RED} fontSize={12} textAnchor="middle" fontWeight="800">Total Puts 18.4M</text>
      <rect x={380} y={330} width={120} height={26} rx={6} fill={`${CYAN}22`} stroke={CYAN} strokeWidth={1} />
      <text x={440} y={348} fill={GREEN} fontSize={12} textAnchor="middle" fontWeight="800">Flow: BULLISH</text>
    </svg>
  );
};

// ── Vis 14: Premium metrics ───────────────────────────────────────────────────
const Vis14 = (frame, start) => {
  const callP=ci(frame,[start+15,start+70],[0,284]);
  const putP= ci(frame,[start+20,start+75],[0,167]);
  const dd=   ci(frame,[start+25,start+80],[0,42]);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, width:"100%" }}>
      <div style={{ display:"flex", gap:14 }}>
        <div style={{ flex:1, background:CARD, border:`2px solid ${GREEN}44`,
          borderRadius:12, padding:"20px", textAlign:"center", opacity:fadeIn(frame,start,22) }}>
          <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:6 }}>TOTAL CALL PREMIUM</div>
          <div style={{ color:GREEN, fontSize:38, fontWeight:900 }}>${Math.round(callP)}M</div>
          <div style={{ color:MUTED, fontSize:12, marginTop:6 }}>Calls purchased today</div>
          {callP>putP*1.3&&<div style={{ color:GREEN, fontSize:11, fontWeight:700, marginTop:6 }}>↑ INSTITUTIONS BUYING UPSIDE</div>}
        </div>
        <div style={{ flex:1, background:CARD, border:`2px solid ${RED}44`,
          borderRadius:12, padding:"20px", textAlign:"center", opacity:fadeIn(frame,start+8,22) }}>
          <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:6 }}>TOTAL PUT PREMIUM</div>
          <div style={{ color:RED, fontSize:38, fontWeight:900 }}>${Math.round(putP)}M</div>
          <div style={{ color:MUTED, fontSize:12, marginTop:6 }}>Puts purchased today</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:14 }}>
        <div style={{ flex:2, background:CARD, border:`1px solid ${AMBER}44`,
          borderRadius:12, padding:"18px 20px", opacity:fadeIn(frame,start+20,22) }}>
          <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:8 }}>NET DEALER DELTA</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:10 }}>
            <span style={{ color:AMBER, fontSize:34, fontWeight:900 }}>-{Math.round(dd)}M</span>
            <span style={{ color:RED, fontSize:12 }}>Dealers SHORT delta</span>
          </div>
          <div style={{ background:`${BORDER}88`, borderRadius:6, height:12, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${dd/60*100}%`,
              background:AMBER, borderRadius:6, marginLeft:"50%", transform:"translateX(-100%)" }} />
          </div>
          <div style={{ color:MUTED, fontSize:12, marginTop:8 }}>Short dealer delta → dealers buy to hedge → persistent bid</div>
        </div>
        <div style={{ flex:1, background:CARD, border:`1px solid ${CYAN}44`,
          borderRadius:12, padding:"18px", textAlign:"center", opacity:fadeIn(frame,start+35,22) }}>
          <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:8 }}>MAX PAIN</div>
          <div style={{ color:CYAN, fontSize:40, fontWeight:900 }}>590</div>
          <div style={{ color:MUTED, fontSize:12, marginTop:8, lineHeight:1.5 }}>
            Price where most options expire worthless — gravitational attractor at expiry
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Vis 15: Unusual Activity table ────────────────────────────────────────────
const Vis15 = (frame, start) => {
  const trades=[
    {sym:"SPY", exp:"Mar 21",type:"CALL",strike:595,size:"12,400",prem:"$8.2M",col:GREEN},
    {sym:"QQQ", exp:"Mar 14",type:"CALL",strike:510,size:"8,800", prem:"$5.4M",col:GREEN},
    {sym:"NVDA",exp:"Apr 17",type:"CALL",strike:140,size:"5,200", prem:"$4.1M",col:GREEN},
    {sym:"SPX", exp:"Mar 7", type:"PUT", strike:575,size:"4,600", prem:"$3.7M",col:RED},
    {sym:"AAPL",exp:"Mar 21",type:"CALL",strike:225,size:"3,800", prem:"$2.9M",col:GREEN},
    {sym:"META",exp:"Apr 4", type:"CALL",strike:600,size:"2,900", prem:"$2.2M",col:GREEN},
  ];
  return (
    <div style={{ width:"100%" }}>
      <div style={{ display:"grid", gridTemplateColumns:"60px 70px 55px 65px 90px 80px",
        gap:10, padding:"7px 14px", color:MUTED, fontSize:11, fontWeight:700,
        borderBottom:`1px solid ${BORDER}`, opacity:fadeIn(frame,start,16) }}>
        <span>SYM</span><span>EXP</span><span>TYPE</span><span>STRIKE</span><span>SIZE</span><span>PREMIUM</span>
      </div>
      {trades.map((t,i)=>{
        const sc=sp(frame,start,i*12);
        return (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"60px 70px 55px 65px 90px 80px",
            gap:10, padding:"10px 14px", alignItems:"center",
            background:i%2===0?CARD:SURF, borderRadius:6, marginBottom:4,
            border:`1px solid ${t.col}18`,
            opacity:sc, transform:`translateX(${ci(frame,[start+i*12,start+i*12+20],[-22,0])}px)` }}>
            <span style={{ color:TEXT, fontWeight:800 }}>{t.sym}</span>
            <span style={{ color:MUTED, fontSize:12 }}>{t.exp}</span>
            <span style={{ background:`${t.col}22`, color:t.col, borderRadius:4, padding:"2px 7px",
              fontSize:11, fontWeight:800, textAlign:"center" }}>{t.type}</span>
            <span style={{ color:TEXT, fontWeight:700 }}>{t.strike}</span>
            <span style={{ color:TEXT, fontWeight:700 }}>{t.size}</span>
            <span style={{ color:t.col, fontWeight:900 }}>{t.prem}</span>
          </div>
        );
      })}
      <div style={{ marginTop:12, background:`${PURPLE}11`, border:`1px solid ${PURPLE}44`,
        borderRadius:8, padding:"10px 14px", opacity:ci(frame,[start+70,start+90],[0,1]) }}>
        <span style={{ color:PURPLE, fontWeight:700 }}>Call Sweep</span>
        <span style={{ color:TEXT, fontSize:12 }}> — thousands of contracts bought rapidly across exchanges — strong institutional signal</span>
      </div>
    </div>
  );
};

// ── Vis 16: Options strategy legs ────────────────────────────────────────────
const Vis16 = (frame, start) => {
  const strats=[
    {name:"Bull Call Spread",dir:"BULLISH",col:GREEN,icon:"📈",
     legs:["BUY Call @ lower strike","SELL Call @ higher strike"],
     desc:"Defined-risk bullish play — profits from moderate upside"},
    {name:"Bear Put Spread",dir:"BEARISH",col:RED,icon:"📉",
     legs:["BUY Put @ higher strike","SELL Put @ lower strike"],
     desc:"Mirror of bull spread — profits from moderate downside"},
    {name:"Iron Condor",dir:"NEUTRAL",col:AMBER,icon:"🦅",
     legs:["SELL Call spread above","SELL Put spread below"],
     desc:"Collect premium when price stays in a range"},
    {name:"Cash-Secured Put",dir:"BULLISH",col:CYAN,icon:"💰",
     legs:["SELL Put below current price"],
     desc:"Collect premium while willing to buy the asset cheaper"},
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, width:"100%" }}>
      {strats.map((s,i)=>{
        const sc=sp(frame,start,i*16);
        return (
          <div key={i} style={{ background:CARD, borderRadius:12, border:`2px solid ${s.col}33`,
            padding:"16px 18px",
            transform:`scale(${sc}) translateY(${ci(frame,[start+i*16,start+i*16+25],[18,0])}px)`,
            opacity:sc }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:22 }}>{s.icon}</span>
              <div>
                <div style={{ color:TEXT, fontWeight:800, fontSize:14 }}>{s.name}</div>
                <span style={{ background:`${s.col}22`, color:s.col, borderRadius:6,
                  padding:"2px 9px", fontSize:11, fontWeight:700 }}>{s.dir}</span>
              </div>
            </div>
            {s.legs.map((l,li)=>(
              <div key={li} style={{ display:"flex", gap:8, alignItems:"center",
                color:TEXT, fontSize:12, marginBottom:4 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:s.col, flexShrink:0 }} />{l}
              </div>
            ))}
            <div style={{ color:MUTED, fontSize:11, marginTop:8, lineHeight:1.4 }}>{s.desc}</div>
          </div>
        );
      })}
    </div>
  );
};

// ── Vis 17: Zero DTE table ────────────────────────────────────────────────────
const Vis17 = (frame, start) => {
  const assets=[
    {sym:"SPX", bias:"BULLISH",callVol:"142K",putVol:"98K", pcr:0.69,score:94,col:GREEN},
    {sym:"SPY", bias:"BULLISH",callVol:"86K", putVol:"72K", pcr:0.84,score:88,col:GREEN},
    {sym:"QQQ", bias:"NEUTRAL",callVol:"44K", putVol:"41K", pcr:0.93,score:72,col:AMBER},
    {sym:"NVDA",bias:"BULLISH",callVol:"28K", putVol:"18K", pcr:0.64,score:61,col:GREEN},
    {sym:"TSLA",bias:"BEARISH",callVol:"22K", putVol:"34K", pcr:1.55,score:44,col:RED},
  ];
  return (
    <div style={{ width:"100%" }}>
      <div style={{ background:`${RED}11`, border:`1px solid ${RED}44`, borderRadius:8,
        padding:"9px 14px", marginBottom:14, display:"flex", gap:10, alignItems:"center",
        opacity:fadeIn(frame,start,18) }}>
        <span style={{ fontSize:18 }}>⚡</span>
        <span style={{ color:RED, fontSize:12, fontWeight:700 }}>
          0DTE options can lose 100% of value within minutes — strict discipline and fast execution required
        </span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"65px 90px 74px 74px 60px 90px",
        gap:8, padding:"7px 12px", color:MUTED, fontSize:11, fontWeight:700,
        borderBottom:`1px solid ${BORDER}`, opacity:fadeIn(frame,start+10,16) }}>
        <span>SYMBOL</span><span>BIAS</span><span>CALL VOL</span><span>PUT VOL</span><span>PCR</span><span>SCORE</span>
      </div>
      {assets.map((a,i)=>{
        const sc=sp(frame,start,18+i*13);
        const sAnim=ci(frame,[start+18+i*13+10,start+18+i*13+40],[0,a.score]);
        return (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"65px 90px 74px 74px 60px 90px",
            gap:8, padding:"10px 12px", alignItems:"center",
            background:i%2===0?CARD:SURF, borderRadius:6, marginBottom:4,
            opacity:sc, transform:`translateX(${ci(frame,[start+18+i*13,start+18+i*13+20],[-18,0])}px)` }}>
            <span style={{ color:TEXT, fontWeight:800 }}>{a.sym}</span>
            <span style={{ background:`${a.col}22`, color:a.col, borderRadius:6,
              padding:"3px 9px", fontSize:12, fontWeight:800 }}>{a.bias}</span>
            <span style={{ color:GREEN, fontWeight:700 }}>{a.callVol}</span>
            <span style={{ color:RED, fontWeight:700 }}>{a.putVol}</span>
            <span style={{ color:a.pcr<1?GREEN:RED, fontWeight:700 }}>{a.pcr}</span>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ flex:1, background:`${BORDER}88`, borderRadius:4, height:8 }}>
                <div style={{ height:"100%", width:`${sAnim}%`, background:a.col, borderRadius:4 }} />
              </div>
              <span style={{ color:a.col, fontSize:11, fontWeight:800 }}>{Math.round(sAnim)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Vis 18: Fundamental score + P/E ──────────────────────────────────────────
const Vis18 = (frame, start) => {
  const score=ci(frame,[start+15,start+80],[0,84]);
  const metrics=[
    {l:"Forward P/E",    v:"28.4×",  c:AMBER, note:"Price ÷ projected earnings"},
    {l:"Analyst Target", v:"$245",   c:GREEN, note:"12-month consensus price"},
    {l:"Upside",         v:"+14.2%", c:GREEN, note:"vs current price $214"},
    {l:"Market Cap",     v:"$3.72T", c:TEXT,  note:"Total market capitalization"},
    {l:"Rating",         v:"BUY",    c:GREEN, note:"Analyst consensus rating"},
    {l:"Div Yield",      v:"0.5%",   c:MUTED, note:"Annual dividend yield"},
  ];
  return (
    <div style={{ display:"flex", gap:18, width:"100%", alignItems:"flex-start" }}>
      <div style={{ width:220, flexShrink:0, background:CARD, border:`2px solid ${GREEN}44`,
        borderRadius:14, padding:"20px", textAlign:"center",
        opacity:fadeIn(frame,start,22) }}>
        <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:12 }}>FUNDAMENTAL SCORE</div>
        <svg width={180} height={170} style={{ margin:"0 auto", display:"block" }}>
          <circle cx={90} cy={90} r={72} fill="none" stroke={BORDER} strokeWidth={12} />
          <circle cx={90} cy={90} r={72} fill="none"
            stroke={score>70?GREEN:score>40?AMBER:RED} strokeWidth={12}
            strokeDasharray={`${(score/100)*452} 452`}
            strokeLinecap="round" transform="rotate(-90 90 90)" />
          <text x={90} y={96} fill={GREEN} fontSize={36} fontWeight="900" textAnchor="middle">{Math.round(score)}</text>
          <text x={90} y={116} fill={MUTED} fontSize={12} textAnchor="middle">/ 100</text>
        </svg>
        <div style={{ color:GREEN, fontSize:13, fontWeight:800, marginTop:6 }}>STRONG</div>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:12,
          opacity:fadeIn(frame,start+10,16) }}>VALUATION — AAPL</div>
        {metrics.map((m,i)=>{
          const sc=sp(frame,start,18+i*11);
          return (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              background:CARD, borderRadius:8, padding:"10px 14px", marginBottom:8,
              opacity:sc, transform:`translateX(${ci(frame,[start+18+i*11,start+18+i*11+20],[18,0])}px)` }}>
              <div>
                <div style={{ color:TEXT, fontSize:13 }}>{m.l}</div>
                <div style={{ color:MUTED, fontSize:11 }}>{m.note}</div>
              </div>
              <span style={{ color:m.c, fontSize:17, fontWeight:900 }}>{m.v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Vis 19: Growth + profitability bars ──────────────────────────────────────
const Vis19 = (frame, start) => {
  const sections=[
    {title:"Growth",  col:GREEN, items:[
      {l:"Revenue Growth (YoY)",v:"+11.4%",bar:0.72,note:"Year-over-year sales increase"},
      {l:"EPS Growth",          v:"+13.8%",bar:0.80,note:"Earnings per share growth"},
    ]},
    {title:"Profitability",col:CYAN,items:[
      {l:"Net Margin",  v:"26.4%",bar:0.82,note:"% of revenue = profit"},
      {l:"Return on Equity",v:"171%",bar:0.95,note:"Profit relative to shareholder equity"},
    ]},
    {title:"Financial Health",col:AMBER,items:[
      {l:"Debt / Equity", v:"1.87", bar:0.44, note:"How much debt vs equity", c:AMBER},
      {l:"Current Ratio", v:"0.92", bar:0.30, note:"Short-term assets vs liabilities", c:RED},
    ]},
  ];
  let delay=0;
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:14 }}>
      {sections.map((sec,si)=>{
        delay+=20;
        return (
          <div key={si} style={{ opacity:fadeIn(frame,start+si*22,18) }}>
            <div style={{ color:sec.col, fontSize:11, fontWeight:700, letterSpacing:"0.07em",
              textTransform:"uppercase", marginBottom:10,
              borderLeft:`3px solid ${sec.col}`, paddingLeft:8 }}>{sec.title}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {sec.items.map((m,mi)=>{
                const barW=ci(frame,[start+si*22+mi*10+10,start+si*22+mi*10+44],[0,(m.bar||0.5)*100]);
                const col=m.c||sec.col;
                return (
                  <div key={mi} style={{ background:CARD, borderRadius:8, padding:"12px 14px",
                    border:`1px solid ${col}22` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ color:TEXT, fontSize:12 }}>{m.l}</span>
                      <span style={{ color:col, fontWeight:900, fontSize:15 }}>{m.v}</span>
                    </div>
                    <div style={{ background:`${BORDER}88`, borderRadius:4, height:8 }}>
                      <div style={{ height:"100%", width:`${barW}%`, background:col, borderRadius:4 }} />
                    </div>
                    <div style={{ color:MUTED, fontSize:11, marginTop:4 }}>{m.note}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Vis 20: Morning prep cards ────────────────────────────────────────────────
const Vis20 = (frame, start) => {
  const items=[
    {icon:"📊",label:"ML Rankings",    col:CYAN,  desc:"Top signals ranked by conviction heading into the open"},
    {icon:"📅",label:"Economic Calendar",col:AMBER,desc:"FOMC dates, CPI, earnings, Fed speakers"},
    {icon:"📈",label:"Overnight Futures",col:GREEN,desc:"ES/NQ pre-market direction — gap analysis"},
    {icon:"📰",label:"Pre-Market News", col:TEXT,  desc:"Key headlines and catalysts before the bell"},
    {icon:"⚡",label:"GEX Key Levels",  col:AMBER, desc:"Today's gamma walls, put walls, and flip levels"},
    {icon:"🎯",label:"Support & Resistance",col:PURPLE,desc:"Technical levels to watch derived from GEX"},
  ];
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ background:`${AMBER}11`, border:`1px solid ${AMBER}44`, borderRadius:8,
        padding:"10px 16px", display:"flex", gap:10, alignItems:"center", marginBottom:6,
        opacity:fadeIn(frame,start,18) }}>
        <span style={{ fontSize:20 }}>🌅</span>
        <span style={{ color:AMBER, fontWeight:700, fontSize:13 }}>Open every morning BEFORE market open — 9:30 AM ET</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {items.map((item,i)=>{
          const sc=sp(frame,start,16+i*13);
          return (
            <div key={i} style={{ background:CARD, borderRadius:10, padding:"14px 14px",
              border:`1px solid ${item.col}22`,
              transform:`scale(${sc}) translateY(${ci(frame,[start+16+i*13,start+16+i*13+24],[18,0])}px)`,
              opacity:sc }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{item.icon}</div>
              <div style={{ color:item.col, fontSize:13, fontWeight:800, marginBottom:4 }}>{item.label}</div>
              <div style={{ color:MUTED, fontSize:11, lineHeight:1.5 }}>{item.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Vis 21: Asset details layout mockup ──────────────────────────────────────
const Vis21 = (frame, start) => {
  const price=ci(frame,[start+15,start+60],[214.5,218.7]);
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:CARD, borderRadius:12, padding:"14px 20px",
        border:`1px solid ${BORDER}`, display:"flex", gap:20, alignItems:"center",
        opacity:fadeIn(frame,start,20) }}>
        <div>
          <div style={{ color:MUTED, fontSize:11 }}>APPLE INC.</div>
          <div style={{ color:TEXT, fontSize:13, fontWeight:700 }}>AAPL · NASDAQ</div>
        </div>
        <div style={{ color:TEXT, fontSize:32, fontWeight:900 }}>${price.toFixed(2)}</div>
        <div style={{ color:GREEN, fontSize:16, fontWeight:700 }}>+$4.22  +1.97%</div>
        <div style={{ marginLeft:"auto", background:`${GREEN}22`, border:`1px solid ${GREEN}`,
          borderRadius:8, padding:"5px 14px", color:GREEN, fontWeight:800 }}>BUY 82%</div>
      </div>
      <div style={{ display:"flex", gap:12 }}>
        <div style={{ flex:2, background:CARD, borderRadius:10, padding:"12px",
          border:`1px solid ${BORDER}`, opacity:fadeIn(frame,start+12,20) }}>
          <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:8 }}>PRICE CHART + ML SIGNAL OVERLAY</div>
          <svg width="100%" height={150} viewBox="0 0 460 150">
            <polyline points="0,120 46,105 92,88 138,80 184,95 230,74 276,60 322,50 368,38 414,28"
              fill="none" stroke={CYAN} strokeWidth={2.5}
              strokeDasharray={ci(frame,[start+25,start+75],[0,600]).toString()} />
            {frame>start+55&&<circle cx={414} cy={28} r={7} fill={GREEN} opacity={ci(frame,[start+55,start+70],[0,1])} />}
            {frame>start+55&&<text x={418} y={26} fill={GREEN} fontSize={11} fontWeight="700">BUY</text>}
            {[50,100,140].map(y=>(
              <line key={y} x1={0} x2={460} y1={y} y2={y} stroke={BORDER} strokeWidth={1} strokeDasharray="4,4" />
            ))}
          </svg>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
          {[
            {l:"Forward P/E",  v:"28.4×",c:AMBER,icon:"📊"},
            {l:"Target Price", v:"$245",  c:GREEN,icon:"🎯"},
            {l:"Analyst",      v:"BUY",   c:GREEN,icon:"⭐"},
          ].map((m,i)=>{
            const sc=sp(frame,start,24+i*13);
            return (
              <div key={i} style={{ background:CARD, borderRadius:8, padding:"10px 12px",
                display:"flex", justifyContent:"space-between", alignItems:"center",
                border:`1px solid ${m.c}22`, opacity:sc, flex:1 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:16 }}>{m.icon}</span>
                  <span style={{ color:MUTED, fontSize:12 }}>{m.l}</span>
                </div>
                <span style={{ color:m.c, fontWeight:900 }}>{m.v}</span>
              </div>
            );
          })}
          <div style={{ background:CARD, borderRadius:8, padding:"10px 12px",
            border:`1px solid ${BORDER}`, flex:1, opacity:fadeIn(frame,start+55,20) }}>
            <div style={{ color:MUTED, fontSize:10, marginBottom:4 }}>LATEST NEWS</div>
            {["Q1 earnings beat est.","iPhone sales record","Vision Pro ships"].map((h,i)=>(
              <div key={i} style={{ color:TEXT, fontSize:10, paddingBottom:3,
                borderBottom:`1px solid ${BORDER}`, marginBottom:3 }}>📰 {h}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Vis 22: 6-step trading sequence ──────────────────────────────────────────
const Vis22 = (frame, start) => {
  const steps=[
    {n:1,icon:"🌅",label:"Market Preparation",   col:AMBER, desc:"Macro overview, economic calendar, futures direction"},
    {n:2,icon:"📊",label:"Market Summary",         col:CYAN,  desc:"Breadth, ML consensus, highest-conviction signals"},
    {n:3,icon:"⚡",label:"Gamma Exposure",         col:AMBER, desc:"Key gamma levels — walls, flip, regime badge"},
    {n:4,icon:"🌊",label:"Option Flows",           col:PURPLE,desc:"Confirm institutional money aligns with your direction"},
    {n:5,icon:"📈",label:"Live Trading",           col:GREEN, desc:"Select asset, review ML signal, checklist, chart"},
    {n:6,icon:"📋",label:"Fundamentals",           col:GREEN, desc:"Confirm business quality supports the trade thesis"},
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:9, width:"100%" }}>
      {steps.map((s,i)=>{
        const sc=sp(frame,start,i*15);
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:14,
            background:CARD, border:`2px solid ${s.col}33`, borderRadius:10, padding:"10px 18px",
            opacity:sc, transform:`translateX(${ci(frame,[start+i*15,start+i*15+24],[-26,0])}px)` }}>
            <div style={{ width:38, height:38, borderRadius:"50%", flexShrink:0,
              background:`${s.col}22`, border:`2px solid ${s.col}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              color:s.col, fontSize:16, fontWeight:900 }}>{s.n}</div>
            <span style={{ fontSize:20, flexShrink:0 }}>{s.icon}</span>
            <div>
              <div style={{ color:s.col, fontSize:14, fontWeight:800 }}>{s.label}</div>
              <div style={{ color:MUTED, fontSize:12 }}>{s.desc}</div>
            </div>
          </div>
        );
      })}
      {frame>start+130&&(
        <div style={{ background:`${GREEN}11`, border:`2px solid ${GREEN}44`, borderRadius:10,
          padding:"12px 18px", textAlign:"center",
          opacity:ci(frame,[start+130,start+148],[0,1]) }}>
          <span style={{ color:GREEN, fontWeight:700, fontSize:14 }}>
            When all six layers align — you have the highest-probability setup the dashboard can generate.
          </span>
        </div>
      )}
    </div>
  );
};


// ── Vis 23: Algorithms & Bots ─────────────────────────────────────────────────
const Vis23 = (frame, start) => {
  const algoFamilies = [
    {label:"Trend Following",   icon:"📈", col:GREEN,  items:["Linear Regression","Momentum Score","EMA Crossover"],
     note:"Best in TRENDING gamma regime — rides directional continuation"},
    {label:"Mean Reversion",    icon:"↕️",  col:CYAN,   items:["Bollinger Band Bounce","RSI Extremes","Z-Score"],
     note:"Best in PINNED gamma regime — fades moves back to equilibrium"},
    {label:"ML Classifiers",    icon:"🤖", col:PURPLE, items:["XGBoost Ensemble","Random Forest","SVM"],
     note:"Multi-feature direction prediction — powers the main signals"},
    {label:"Deep Learning",     icon:"🧠", col:AMBER,  items:["LSTM Networks","Transformer","CNN"],
     note:"Captures long-range sequential dependencies across 100+ candles"},
    {label:"Reinforcement",     icon:"🎯", col:RED,    items:["Q-Learning Agent","PPO Policy","DQN"],
     note:"Learns optimal position sizing and exit timing via reward feedback"},
  ];
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ color:MUTED, fontSize:11, fontWeight:700, marginBottom:4,
        opacity:fadeIn(frame,start,16) }}>ALGORITHM FAMILIES — 20 STRATEGIES CATALOGUED</div>
      {algoFamilies.map((fam, fi) => {
        const sc = sp(frame, start, fi*14);
        return (
          <div key={fi} style={{
            background:CARD, borderRadius:10, padding:"12px 14px",
            border:`1.5px solid ${fam.col}33`,
            opacity:sc,
            transform:`translateX(${ci(frame,[start+fi*14,start+fi*14+22],[-22,0])}px)`,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <span style={{ fontSize:18 }}>{fam.icon}</span>
              <span style={{ color:fam.col, fontWeight:800, fontSize:13 }}>{fam.label}</span>
              <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                {fam.items.map((item, ii) => (
                  <span key={ii} style={{
                    background:`${fam.col}18`, border:`1px solid ${fam.col}55`,
                    borderRadius:5, padding:"2px 8px",
                    color:fam.col, fontSize:10, fontWeight:700,
                  }}>{item}</span>
                ))}
              </div>
            </div>
            <div style={{ color:MUTED, fontSize:11, lineHeight:1.4 }}>{fam.note}</div>
          </div>
        );
      })}
    </div>
  );
};

// ── Vis 24: Asset Algorithms ──────────────────────────────────────────────────
const Vis24 = (frame, start) => {
  // Mini candlestick data
  const candles = [
    {o:585,h:587,l:584,c:586.5},{o:586.5,h:589,l:586,c:588},
    {o:588,h:590,l:587,c:589.5},{o:589.5,h:591,l:588,c:590.5},
    {o:590.5,h:593,l:590,c:591.8},{o:591.8,h:592,l:588,c:589},
    {o:589,h:591,l:588,c:590.2},{o:590.2,h:594,l:590,c:593},
    {o:593,h:595,l:592,c:594.5},{o:594.5,h:596,l:593,c:595},
  ];
  const minP=583, maxP=597, CW=820, CH=200;
  const xS = i => 30 + i*(CW/candles.length)+18;
  const yP = p => CH - ((p-minP)/(maxP-minP))*CH;
  const bw = 44;
  const reveal = ci(frame,[start+10,start+70],[0,candles.length]);

  // Indicator values (simplified)
  const sma20 = 590.0;
  const sma50 = 587.5;
  const bbU   = 595.0;
  const bbL   = 585.0;
  // GEX levels
  const gexLevels = [
    {price:594, color:CYAN,  label:"Call Wall"},
    {price:585, color:RED,   label:"Put Wall"},
    {price:589, color:AMBER, label:"Flip"},
    {price:591, color:"rgba(210,235,255,0.8)", label:"Spot"},
  ];

  const pipeSteps = ["Historical OHLCV","23 Features","XGBoost Classifier","XGBoost Regressor","Signal + Magnitude"];
  return (
    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:12 }}>
      {/* Pipeline */}
      <div style={{ display:"flex", alignItems:"center", gap:0,
        opacity:fadeIn(frame,start,18), flexWrap:"wrap" }}>
        {pipeSteps.map((s,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center" }}>
            <div style={{ background:CARD, border:`1px solid ${i===3?PURPLE:i===2?GREEN:BORDER}`,
              borderRadius:7, padding:"5px 10px",
              color:i===4?GREEN:i===2||i===3?TEXT:MUTED,
              fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>{s}</div>
            {i<pipeSteps.length-1 && <div style={{ color:MUTED, fontSize:14, padding:"0 3px" }}>→</div>}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background:"#070d18", borderRadius:10, padding:"8px",
        border:`1px solid ${BORDER}` }}>
        <div style={{ color:MUTED, fontSize:10, fontWeight:700, padding:"0 4px 4px",
          opacity:fadeIn(frame,start+5,15) }}>SPY · 4H · XGBoost Ensemble</div>
        <svg width={820} height={220} viewBox={`0 0 820 ${CH+20}`}>
          {/* Grid */}
          {[585,588,591,594].map(p=>(
            <line key={p} x1={20} x2={800} y1={yP(p)} y2={yP(p)}
              stroke="rgba(36,48,88,0.5)" strokeWidth={1} strokeDasharray="4,4" />
          ))}

          {/* Bollinger Bands */}
          {frame>start+25 && (
            <g opacity={ci(frame,[start+25,start+40],[0,1])}>
              <line x1={30} x2={780} y1={yP(bbU)} y2={yP(bbU)}
                stroke="rgba(251,191,36,0.5)" strokeWidth={1} strokeDasharray="5,3" />
              <line x1={30} x2={780} y1={yP(bbL)} y2={yP(bbL)}
                stroke="rgba(251,191,36,0.5)" strokeWidth={1} strokeDasharray="5,3" />
              <text x={784} y={yP(bbU)+4} fill="rgba(251,191,36,0.7)" fontSize={9} fontWeight="700">BB+</text>
              <text x={784} y={yP(bbL)+4} fill="rgba(251,191,36,0.7)" fontSize={9} fontWeight="700">BB-</text>
            </g>
          )}

          {/* SMA lines */}
          {frame>start+30 && (
            <g opacity={ci(frame,[start+30,start+45],[0,1])}>
              <line x1={30} x2={780} y1={yP(sma20)} y2={yP(sma20)}
                stroke={GREEN} strokeWidth={1.5} />
              <text x={784} y={yP(sma20)+4} fill={GREEN} fontSize={9} fontWeight="700">20</text>
              <line x1={30} x2={780} y1={yP(sma50)} y2={yP(sma50)}
                stroke="#60a5fa" strokeWidth={1.5} />
              <text x={784} y={yP(sma50)+4} fill="#60a5fa" fontSize={9} fontWeight="700">50</text>
            </g>
          )}

          {/* Candles */}
          {candles.slice(0, Math.ceil(reveal)).map((c,i) => {
            const bull = c.c >= c.o;
            const col  = bull ? GREEN : RED;
            const top  = yP(Math.max(c.o, c.c));
            const bodyH= Math.max(Math.abs(yP(c.o)-yP(c.c)), 2);
            return (
              <g key={i} opacity={ci(frame,[start+10+i*5,start+10+i*5+12],[0,1])}>
                <line x1={xS(i)} x2={xS(i)} y1={yP(c.h)} y2={yP(c.l)} stroke={col} strokeWidth={1.5} />
                <rect x={xS(i)-bw/2} y={top} width={bw} height={bodyH} fill={col} rx={2} />
              </g>
            );
          })}

          {/* GEX price lines */}
          {frame>start+50 && gexLevels.map((g,gi) => (
            <g key={gi} opacity={ci(frame,[start+50+gi*8,start+50+gi*8+15],[0,1])}>
              <line x1={20} x2={780} y1={yP(g.price)} y2={yP(g.price)}
                stroke={g.color} strokeWidth={1.5} strokeDasharray="6,3" />
              <text x={22} y={yP(g.price)-3} fill={g.color} fontSize={9} fontWeight="800">{g.label} {g.price}</text>
            </g>
          ))}

          {/* BUY signal marker */}
          {frame>start+75 && (
            <g opacity={ci(frame,[start+75,start+90],[0,1])}>
              <polygon points={`${xS(9)},${yP(candles[9].l)+18} ${xS(9)-7},${yP(candles[9].l)+32} ${xS(9)+7},${yP(candles[9].l)+32}`}
                fill={GREEN} />
              <text x={xS(9)} y={yP(candles[9].l)+46} fill={GREEN} fontSize={9} fontWeight="800" textAnchor="middle">BUY</text>
            </g>
          )}
        </svg>
      </div>

      {/* TF buttons strip */}
      <div style={{ display:"flex", gap:6, alignItems:"center", opacity:fadeIn(frame,start+20,18) }}>
        <span style={{ color:MUTED, fontSize:10, fontWeight:700 }}>TF:</span>
        {["4H","1H","30m","15m","5m"].map((tf,i) => (
          <div key={i} style={{
            background: tf==="4H" ? CYAN : CARD,
            border:`1px solid ${tf==="4H"?CYAN:BORDER}`,
            borderRadius:5, padding:"3px 10px",
            color: tf==="4H" ? "#000" : MUTED,
            fontSize:11, fontWeight:800,
          }}>{tf}</div>
        ))}
        <span style={{ color:MUTED, fontSize:10, marginLeft:6 }}>← per-chart timeframe selector</span>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SEGMENT DEFINITIONS — title, desc, terms, right visual, color
// ══════════════════════════════════════════════════════════════════════════════
const SEGMENTS = [
  {
    icon:"🤖", title:"Dashboard Overview", color:CYAN, seg:"01",
    desc:"The ML Trading Dashboard is a complete AI-powered trading system giving you machine learning signals, gamma exposure analysis, real-time option flows, and fundamental data — all in one place, updated live every 30 seconds.",
    terms:[
      {label:"ML Signal",  color:GREEN,  def:"Machine learning model output — BUY, SELL, or HOLD based on historical price patterns"},
      {label:"GEX",        color:AMBER,  def:"Gamma Exposure — measures how options market makers must hedge their positions"},
      {label:"Option Flows",color:PURPLE,def:"Real-time tracking of call and put volume, premium, and institutional trades"},
      {label:"XGBoost",    color:CYAN,   def:"Gradient boosting algorithm — the ML model type powering the trade signals"},
    ],
    vis: Vis01,
  },
  {
    icon:"📈", title:"Live Trading — Asset Selector", color:CYAN, seg:"02",
    desc:"The Live Trading page covers 22 assets across four groups, each color-coded for instant visual recognition: Index ETFs, the Magnificent Seven tech stocks, Futures contracts, and Options vehicles like SPX and VIX.",
    terms:[
      {label:"Index ETFs",         color:CYAN,   def:"SPY, QQQ, DIA, IWM — baskets tracking major US indices"},
      {label:"Magnificent Seven",  color:GREEN,  def:"AAPL, MSFT, NVDA, TSLA, AMZN, GOOGL, META — mega-cap tech leaders"},
      {label:"Futures Contracts",  color:AMBER,  def:"ES=F, NQ=F — S&P 500 and NASDAQ futures with nearly 24hr trading"},
      {label:"Color Coding",       color:PURPLE, def:"Each asset group has a unique color for fast visual identification across all charts"},
    ],
    vis: Vis02,
  },
  {
    icon:"📉", title:"Candlestick Chart", color:GREEN, seg:"03",
    desc:"Every asset page shows a live candlestick chart revealing the open, close, high, and low price for each time period. Switch between 15-minute, 1-hour, 4-hour, daily, and weekly views to see different timeframes.",
    terms:[
      {label:"Candlestick Body",  color:GREEN,  def:"Rectangle between open and close — green if price rose, red if it fell"},
      {label:"Wick / Shadow",     color:MUTED,  def:"Thin line above/below body showing the highest and lowest price in the period"},
      {label:"Bullish Candle",    color:GREEN,  def:"Closing price is higher than opening price — buyers were in control"},
      {label:"Bearish Candle",    color:RED,    def:"Closing price is lower than opening price — sellers were in control"},
    ],
    vis: Vis03,
  },
  {
    icon:"🤖", title:"ML Signal Panel", color:GREEN, seg:"04",
    desc:"The ML Signal Panel shows the model's output for each asset — a directional signal with a probability score. The model is trained on years of historical OHLCV data and outputs one of three classifications every 30 seconds.",
    terms:[
      {label:"BUY Signal",    color:GREEN,  def:"Model predicts price is more likely to rise in the next period — look for long trades"},
      {label:"SELL Signal",   color:RED,    def:"Model predicts price is more likely to fall — look for short or put strategies"},
      {label:"HOLD Signal",   color:AMBER,  def:"Model has insufficient conviction — wait for a clearer setup before trading"},
      {label:"XGBoost Model", color:CYAN,   def:"Gradient boosted trees trained on RSI, MACD, ATR, volume, and price features"},
    ],
    vis: Vis04,
  },
  {
    icon:"📊", title:"Probability Gauge", color:CYAN, seg:"05",
    desc:"Every signal comes with a probability score from 0 to 100% indicating how confident the model is. A score above 65% is considered high conviction. Below 45% suggests the model sees conflicting signals.",
    terms:[
      {label:"Confidence Score", color:CYAN,  def:"Model's estimated probability that price will move in the predicted direction"},
      {label:"65% Threshold",    color:GREEN, def:"Signals above 65% probability are classified as high conviction and most actionable"},
      {label:"Probability",      color:AMBER, def:"Output of the classification model — not a guarantee, but a statistical edge"},
      {label:"Magnitude",        color:TEXT,  def:"Expected size of the predicted price move, as a percentage of current price"},
    ],
    vis: Vis05,
  },
  {
    icon:"📡", title:"Feature Drivers", color:AMBER, seg:"06",
    desc:"The Feature Drivers section shows which technical indicators are contributing most to the current ML signal. Each bar represents how heavily that feature influenced today's model output — giving you insight into what the machine is seeing.",
    terms:[
      {label:"RSI (14)",       color:AMBER,  def:"Relative Strength Index — measures momentum; >70 overbought, <30 oversold"},
      {label:"MACD",          color:GREEN,  def:"Moving Average Convergence Divergence — trend direction and momentum indicator"},
      {label:"ATR",           color:CYAN,   def:"Average True Range — measures volatility by averaging recent high-low ranges"},
      {label:"Bollinger Bands",color:PURPLE,def:"Price channels based on standard deviation — shows when price is stretched"},
    ],
    vis: Vis06,
  },
  {
    icon:"✅", title:"Signal Quality Checklist", color:GREEN, seg:"07",
    desc:"Before entering any trade, the Signal Quality Checklist gives you a rapid multi-factor assessment. Each item evaluates one dimension of the trade setup — trend alignment, volume confirmation, options flow, and more.",
    terms:[
      {label:"Setup Score",     color:GREEN, def:"Total number of checklist items passing — higher score means higher conviction trade"},
      {label:"Multi-Timeframe", color:CYAN,  def:"Checking if trend direction agrees on 15m, 1H, 4H, and daily charts simultaneously"},
      {label:"Volume Confirmation",color:AMBER,def:"Volume should increase in the direction of the breakout for signal to be valid"},
      {label:"Options Alignment",color:PURPLE,def:"Call/put flows and GEX regime should agree with the ML signal direction"},
    ],
    vis: Vis07,
  },
  {
    icon:"🌍", title:"Market Summary", color:CYAN, seg:"08",
    desc:"The Market Summary page gives you a macro-level view of the entire market before zooming into individual assets. It shows the AI's overall market direction call, breadth across all 22 assets, and live index readings.",
    terms:[
      {label:"Market Direction",  color:GREEN, def:"Aggregated ML consensus — whether the majority of signals are bullish, bearish, or mixed"},
      {label:"Market Breadth",    color:CYAN,  def:"Percentage of assets showing bullish signals — high breadth means broad participation"},
      {label:"Sentiment",         color:AMBER, def:"Combined reading of technical, flow, and gamma data into one market mood label"},
      {label:"VIX",               color:RED,   def:"CBOE Volatility Index — measures expected market volatility; spikes signal fear"},
    ],
    vis: Vis08,
  },
  {
    icon:"🏆", title:"ML Rankings Table", color:CYAN, seg:"09",
    desc:"The ML Rankings table sorts all 22 assets from highest to lowest probability of an upward move. This gives you an instant view of which assets have the strongest setups right now, and which to avoid.",
    terms:[
      {label:"Probability Rank", color:CYAN,  def:"Assets sorted by model confidence — highest conviction opportunities at the top"},
      {label:"Signal Badge",     color:GREEN, def:"Color-coded BUY/SELL/HOLD displayed next to probability score for fast scanning"},
      {label:"Magnitude",        color:TEXT,  def:"Predicted size of the next move — larger magnitude signals deserve bigger attention"},
      {label:"Asset Comparison", color:AMBER, def:"Relative view across all assets lets you find the best risk/reward opportunity"},
    ],
    vis: Vis09,
  },
  {
    icon:"⚡", title:"Gamma Exposure — Concept", color:AMBER, seg:"10",
    desc:"Gamma Exposure reveals how options market makers — the dealers — are positioned and how they must hedge. In positive gamma they suppress volatility. In negative gamma they amplify moves. Understanding this gives you a massive edge.",
    terms:[
      {label:"Gamma",          color:AMBER, def:"Rate of change of an option's delta per $1 move in the underlying stock price"},
      {label:"Delta Hedging",  color:CYAN,  def:"Dealers continuously buy or sell the underlying asset to stay delta-neutral"},
      {label:"Positive Gamma", color:GREEN, def:"Dealers sell rallies and buy dips — price gets magnetized to key strikes"},
      {label:"Negative Gamma", color:RED,   def:"Dealers amplify moves — selling into drops and buying into rallies, accelerating trends"},
    ],
    vis: Vis10,
  },
  {
    icon:"📊", title:"GEX Bar Chart", color:AMBER, seg:"11",
    desc:"The GEX bar chart shows the net gamma exposure at each strike price. Green bars mean dealers are long gamma there — suppressing volatility. Red bars mean short gamma — potential volatility amplifier. Three key levels tell you where price is likely to go.",
    terms:[
      {label:"Gamma Wall",   color:GREEN, def:"Strike with the largest positive gamma — acts as a price ceiling or strong resistance"},
      {label:"Put Wall",     color:RED,   def:"Strike with the largest negative gamma below — acts as a price floor or support"},
      {label:"Flip Level",   color:AMBER, def:"Strike where gamma flips from positive to negative — crossing it changes market dynamics"},
      {label:"Dealer Hedging",color:CYAN, def:"Each bar represents the total hedging pressure dealers must apply at that strike"},
    ],
    vis: Vis11,
  },
  {
    icon:"🎯", title:"Regime Badges & PCR", color:CYAN, seg:"12",
    desc:"The Regime Badge classifies current market structure into one of three modes: Pinned, Trending, or Breakout. Combined with the Put-Call Ratio, you know instantly whether to expect a calm or volatile trading session.",
    terms:[
      {label:"PINNED Regime",  color:CYAN,  def:"Price trapped between gamma walls — expect a tight range, ideal for Iron Condors"},
      {label:"TRENDING Regime",color:GREEN, def:"Gamma structure supports directional continuation — trends can extend further"},
      {label:"BREAKOUT Regime",color:RED,   def:"Price crossed the flip level — dealer hedging amplifies moves, expect higher volatility"},
      {label:"Put-Call Ratio", color:AMBER, def:"Total put open interest divided by call OI — above 1.2 signals defensive positioning"},
    ],
    vis: Vis12,
  },
  {
    icon:"🌊", title:"Option Flows — Tornado Chart", color:PURPLE, seg:"13",
    desc:"The Tornado chart visualizes call and put volume at every strike price simultaneously. Calls extend to the left, puts to the right. A dominant call side signals bullish institutional positioning. The overall balance gives you the flow bias.",
    terms:[
      {label:"Call Volume",   color:GREEN,  def:"Total contracts traded at each strike — large call volume signals bullish positioning"},
      {label:"Put Volume",    color:RED,    def:"Total put contracts — large put volume signals hedging or bearish bets"},
      {label:"Open Interest", color:PURPLE, def:"Total outstanding contracts at each strike — shows where money is parked long-term"},
      {label:"Flow Bias",     color:CYAN,   def:"Overall directional lean — whether more premium is flowing into calls or puts today"},
    ],
    vis: Vis13,
  },
  {
    icon:"💰", title:"Premium & Dealer Metrics", color:PURPLE, seg:"14",
    desc:"Three institutional-grade metrics reveal where real money is flowing: total call and put dollar premium, net dealer delta showing hedging pressure, and max pain — the strike where most options expire worthless at expiration.",
    terms:[
      {label:"Call Premium",   color:GREEN, def:"Total dollar value of all calls purchased today — large call premium = institutional bullishness"},
      {label:"Put Premium",    color:RED,   def:"Total dollar value of all puts purchased — large put premium = hedging or bearish bets"},
      {label:"Dealer Delta",   color:AMBER, def:"Net directional exposure of all dealers — short dealer delta means they must buy to hedge"},
      {label:"Max Pain",       color:CYAN,  def:"Strike where maximum number of options expire worthless — price gravitates here near expiration"},
    ],
    vis: Vis14,
  },
  {
    icon:"🏦", title:"Unusual Activity", color:PURPLE, seg:"15",
    desc:"Unusual Activity flags options trades that are significantly larger than normal — often a signal of institutional or smart-money positioning. A single call sweep worth millions of dollars can precede a major directional move.",
    terms:[
      {label:"Call Sweep",         color:GREEN,  def:"Large buy order split across multiple exchanges simultaneously — aggressive institutional buying"},
      {label:"Block Trade",        color:PURPLE, def:"Single large options transaction — often institutions taking a directional position"},
      {label:"Institutional Flow", color:CYAN,   def:"Options orders large enough to be from hedge funds, banks, or major market participants"},
      {label:"Premium Filter",     color:AMBER,  def:"Unusual Activity only shows trades above a dollar threshold — filtering out retail noise"},
    ],
    vis: Vis15,
  },
  {
    icon:"🎯", title:"Options Strategy", color:GREEN, seg:"16",
    desc:"The Options Strategy page recommends a specific trade structure based on the current ML signal, volatility environment, and GEX regime. Each strategy includes the exact legs to trade with defined risk and reward parameters.",
    terms:[
      {label:"Bull Call Spread", color:GREEN, def:"Buy lower strike call, sell higher strike call — bullish, defined risk and reward"},
      {label:"Bear Put Spread",  color:RED,   def:"Buy higher strike put, sell lower — bearish, mirror of bull call spread"},
      {label:"Iron Condor",      color:AMBER, def:"Sell both a call spread and put spread — profits when price stays in a range"},
      {label:"Cash-Secured Put", color:CYAN,  def:"Sell a put, hold cash to buy shares if assigned — bullish income strategy"},
    ],
    vis: Vis16,
  },
  {
    icon:"⚡", title:"Zero DTE", color:RED, seg:"17",
    desc:"Zero DTE options expire today, offering the highest leverage and fastest profit potential — but also the most risk. The 0DTE page ranks assets by activity score using call volume, put volume, PCR, and expected intraday range.",
    terms:[
      {label:"0DTE",           color:RED,   def:"Zero Days to Expiration — options that expire at market close today"},
      {label:"Activity Score", color:AMBER, def:"Composite ranking combining call/put volume ratio, PCR, and expected range size"},
      {label:"Expected Range", color:CYAN,  def:"Implied move derived from at-the-money straddle price — likely trading corridor for today"},
      {label:"Expiry Risk",    color:RED,   def:"Options lose time value extremely fast in final hours — positions can go to zero quickly"},
    ],
    vis: Vis17,
  },
  {
    icon:"📋", title:"Fundamentals — Score & Valuation", color:GREEN, seg:"18",
    desc:"The Fundamentals page scores each asset from 0 to 100 based on valuation, growth, profitability, and financial health. Use this to confirm the underlying business quality before trading the ML signal.",
    terms:[
      {label:"Fundamental Score", color:GREEN, def:"Composite 0–100 rating across valuation, growth, profitability, and balance sheet health"},
      {label:"Forward P/E",       color:AMBER, def:"Current price divided by next-year projected earnings — lower means cheaper valuation"},
      {label:"Analyst Target",    color:GREEN, def:"12-month consensus price target from Wall Street analysts covering the stock"},
      {label:"Upside",            color:CYAN,  def:"Percentage difference between current price and analyst target — potential return to fair value"},
    ],
    vis: Vis18,
  },
  {
    icon:"📈", title:"Growth & Financial Health", color:GREEN, seg:"19",
    desc:"Deep fundamental analysis covers three pillars: Growth metrics like revenue and earnings per share expansion, Profitability measures like net margin and return on equity, and Financial Health indicators like debt levels and liquidity ratios.",
    terms:[
      {label:"Revenue Growth",  color:GREEN, def:"Year-over-year increase in total sales — high growth rate signals strong business momentum"},
      {label:"Net Margin",      color:CYAN,  def:"Percentage of revenue that becomes profit after all expenses — higher is better"},
      {label:"Return on Equity",color:GREEN, def:"Net income divided by shareholder equity — measures how efficiently company uses capital"},
      {label:"Debt / Equity",   color:AMBER, def:"Total debt relative to equity — high ratio means more financial leverage and risk"},
    ],
    vis: Vis19,
  },
  {
    icon:"🌅", title:"Market Preparation Hub", color:AMBER, seg:"20",
    desc:"The Market Preparation Hub is your morning command center — open it before the 9:30 AM bell every day. It aggregates ML rankings, economic events, overnight futures, pre-market news, and key gamma levels into one concise briefing.",
    terms:[
      {label:"Economic Calendar", color:AMBER, def:"Schedule of market-moving events — FOMC, CPI, earnings, Fed speeches — for the day"},
      {label:"Pre-Market Scan",   color:CYAN,  def:"Review of overnight price action, gap, and volume before US market opens"},
      {label:"GEX Key Levels",    color:AMBER, def:"Today's gamma wall, put wall, and flip level — the day's most important price boundaries"},
      {label:"Morning Plan",      color:GREEN, def:"Structured preparation routine reduces emotional decisions during live market hours"},
    ],
    vis: Vis20,
  },
  {
    icon:"🔍", title:"Asset Details Page", color:CYAN, seg:"21",
    desc:"Every asset has its own dedicated details page combining live price, the ML signal overlay on the candlestick chart, complete fundamental data, and the latest news feed — everything you need to make a final trade decision in one view.",
    terms:[
      {label:"Live Price Feed",    color:CYAN,  def:"Real-time (or 15-min delayed) price updating every 30 seconds from Yahoo Finance"},
      {label:"Signal Overlay",     color:GREEN, def:"ML signal drawn directly on the chart — BUY arrow at confirmed signal bars"},
      {label:"Fundamental Panel",  color:AMBER, def:"Key metrics like P/E, analyst target, and rating displayed alongside the chart"},
      {label:"News Integration",   color:TEXT,  def:"Latest headlines for the asset help explain unusual price or volume activity"},
    ],
    vis: Vis21,
  },
  {
    icon:"🚀", title:"6-Step Trading Sequence", color:GREEN, seg:"22",
    desc:"The ultimate trading workflow combines all six layers of the dashboard into a structured decision process. Following these six steps before every trade ensures you're only acting when multiple independent signals confirm the same direction.",
    terms:[
      {label:"Multi-Layer Confirmation", color:GREEN,  def:"Waiting for ML signal, GEX regime, option flows, and fundamentals to all agree"},
      {label:"Trade Discipline",         color:AMBER,  def:"Following the same structured process every time eliminates emotional decision-making"},
      {label:"Six-Step Process",         color:CYAN,   def:"Market Prep → Summary → GEX → Flows → Live Trading → Fundamentals"},
      {label:"Edge",                     color:PURPLE, def:"Statistical advantage from combining multiple data sources — no single indicator is enough"},
    ],
    vis: Vis22,
  },
  {
    icon:"🤖", title:"Algorithms & Bots", color:GREEN, seg:"23",
    desc:"Twenty distinct algorithmic strategies organized into five families — trend-following, mean-reversion, ML classifiers, deep learning, and reinforcement learning — each matched to the optimal gamma regime and market condition for deployment.",
    terms:[
      {label:"XGBoost Ensemble",    color:GREEN,  def:"Gradient boosted trees combining Classifier + Regressor — powers all 22 asset signals"},
      {label:"LSTM Networks",       color:PURPLE, def:"Long Short-Term Memory — deep learning architecture capturing sequential price patterns"},
      {label:"Gamma Regime Match",  color:AMBER,  def:"Choosing an algorithm whose behavior aligns with the current GEX regime (pinned vs trending)"},
      {label:"Reinforcement Agent", color:RED,    def:"Algorithm that learns trading policy by trial and error — optimizes position sizing dynamically"},
    ],
    vis: Vis23,
  },
  {
    icon:"📈", title:"Asset Algorithms", color:CYAN, seg:"24",
    desc:"XGBoost Classifier and Regressor ensemble deployed independently for all 22 assets. Each interactive chart overlays SMA 20, SMA 50, and Bollinger Band predictors with live GEX levels — Call Wall, Put Wall, Flip, and Spot — updating throughout the trading day.",
    terms:[
      {label:"SMA 20 / SMA 50",     color:GREEN,  def:"20- and 50-period Simple Moving Averages — trend direction indicators; golden cross = bullish"},
      {label:"Bollinger Bands",     color:AMBER,  def:"Moving average ± 2 standard deviations — price at band edges signals potential reversal"},
      {label:"GEX Price Lines",     color:CYAN,   def:"Live gamma levels drawn directly on the chart — Call Wall, Put Wall, Flip Level, and Spot"},
      {label:"Per-Chart Timeframe", color:PURPLE, def:"4H / 1H / 30m / 15m / 5m buttons switch each asset's chart independently without flicker"},
    ],
    vis: Vis24,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SEGMENT WRAPPER — uses local frame so animations always start at 0
// and adds smooth fade-in / fade-out transition overlay
// ══════════════════════════════════════════════════════════════════════════════
const SegmentWrapper = ({ clipDur, segData }) => {
  const frame = useCurrentFrame(); // local: 0 = segment start

  // Fade-in: black → transparent over first FADE frames
  // Fade-out: transparent → black over last FADE frames
  const fadeInOp  = interpolate(frame, [0, FADE], [1, 0], { extrapolateLeft:"clamp", extrapolateRight:"clamp" });
  const fadeOutOp = interpolate(frame, [clipDur + TAIL - FADE, clipDur + TAIL - 1], [0, 1], { extrapolateLeft:"clamp", extrapolateRight:"clamp" });
  const overlayOp = Math.max(fadeInOp, fadeOutOp);

  return (
    <>
      <Audio src={staticFile(`audio/tour-${segData.id}.mp3`)} />
      <TwoPanel
        frame={frame}
        start={0}
        seg={segData.seg}
        icon={segData.icon}
        title={segData.title}
        color={segData.color}
        desc={segData.desc}
        terms={segData.terms}
        right={segData.vis}
      />
      {/* Transition overlay */}
      <AbsoluteFill style={{
        background:"#000",
        opacity: overlayOp,
        pointerEvents:"none",
      }} />
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION
// ══════════════════════════════════════════════════════════════════════════════
export const DashboardTour = () => (
  <AbsoluteFill style={{ background:BG }}>
    {TOUR_CLIPS.map((clip, idx) => (
      <Sequence key={clip.id} from={clip.start} durationInFrames={clip.dur + TAIL}>
        <SegmentWrapper
          clipDur={clip.dur}
          segData={{ ...SEGMENTS[idx], id: clip.id }}
        />
      </Sequence>
    ))}
  </AbsoluteFill>
);
