import {
  AbsoluteFill, Html5Audio, Img, Sequence, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

const ORG = "Artificial Intelligence Solutions, Inc.";

export const NEURAL_DURATION = 6912;

const T = {
  titleIn: 0, neuronIn: 367, networkIn: 671,
  forwardIn: 1039, trainingIn: 1359, appsIn: 1684, outroIn: 2014,
  mathIn: 2323, govIn: 3075, healthIn: 3958, oilIn: 4907, finalIn: 5882,
};

const NET = [3, 4, 4, 2];
const SVG_W = 500;
const SVG_H = 280;
const LAYER_COLORS = ["#38bdf8", "#a78bfa", "#a78bfa", "#4ade80"];

function nodePos(li, ni) {
  const xPad = 90;
  const xGap = (SVG_W - 2 * xPad) / (NET.length - 1);
  return { x: xPad + li * xGap, y: (SVG_H / (NET[li] + 1)) * (ni + 1) };
}

function ci(frame, [f0, f1], [v0, v1]) {
  return interpolate(frame, [f0, f1], [v0, v1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

// Durations from Edge TTS en-US-GuyNeural (frames @ 30fps).
const NN_CLIPS = [
  { file: "nn-01", start: 60,   dur: 277 }, // ends 337
  { file: "nn-02", start: 367,  dur: 274 }, // ends 641
  { file: "nn-03", start: 671,  dur: 338 }, // ends 1009
  { file: "nn-04", start: 1039, dur: 290 }, // ends 1329
  { file: "nn-05", start: 1359, dur: 295 }, // ends 1654
  { file: "nn-06", start: 1684, dur: 300 }, // ends 1984
  { file: "nn-07", start: 2014, dur: 279 }, // ends 2293
  { file: "nn-08", start: 2323, dur: 722 }, // ends 3045
  { file: "nn-09", start: 3075, dur: 853 }, // ends 3928
  { file: "nn-10", start: 3958, dur: 919 }, // ends 4877
  { file: "nn-11", start: 4907, dur: 945 }, // ends 5852
  { file: "nn-12", start: 5882, dur: 940 }, // ends 6822
];

function NarrationTrack() {
  return (
    <>
      {NN_CLIPS.map(c => (
        <Sequence key={c.file} from={c.start} durationInFrames={c.dur}>
          <Html5Audio src={staticFile(`audio/${c.file}.mp3`)} />
        </Sequence>
      ))}
    </>
  );
}

function Card({ children }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 18, padding: "32px 48px" }}>
      {children}
    </div>
  );
}

function SceneTitle({ text, frame, startFrame }) {
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - startFrame, fps, config: { damping: 20, stiffness: 120 } });
  return (
    <div style={{ fontSize: 20, fontWeight: 700, color: "#38bdf8", marginBottom: 20, opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [20, 0])}px)` }}>
      {text}
    </div>
  );
}

function TitleScene({ frame }) {
  const op = ci(frame, [0, 40], [0, 1]);
  const fadeOut = frame >= T.neuronIn ? ci(frame, [T.neuronIn, T.neuronIn + 30], [1, 0]) : 1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: "#38bdf8", lineHeight: 1.1 }}>Neural Networks</div>
        <div style={{ fontSize: 24, color: "#a78bfa", marginTop: 12 }}>Understanding the Basics</div>
      </div>
    </AbsoluteFill>
  );
}

function NeuronScene({ frame }) {
  const op = ci(frame, [T.neuronIn, T.neuronIn + 30], [0, 1]);
  const fadeOut = frame >= T.networkIn ? ci(frame, [T.networkIn, T.networkIn + 25], [1, 0]) : 1;
  const inputs = [{ label: "x₁", weight: "w₁" }, { label: "x₂", weight: "w₂" }, { label: "x₃", weight: "w₃" }];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <Card>
        <SceneTitle text="Single Neuron" frame={frame} startFrame={T.neuronIn} />
        <svg width={SVG_W} height={200} viewBox={`0 0 ${SVG_W} 200`}>
          {inputs.map((inp, i) => {
            const iy = 30 + i * 70, nx = 240, ny = 100;
            return (
              <g key={i}>
                <circle cx={60} cy={iy} r={22} fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth={2} />
                <text x={60} y={iy + 5} textAnchor="middle" fontSize={13} fill="#38bdf8">{inp.label}</text>
                <line x1={82} y1={iy} x2={nx - 28} y2={ny} stroke="#64748b" strokeWidth={1.5} />
                <text x={(82 + nx - 28) / 2} y={(iy + ny) / 2 - 8} fontSize={11} fill="#a78bfa" textAnchor="middle">{inp.weight}</text>
              </g>
            );
          })}
          <circle cx={240} cy={100} r={28} fill="rgba(167,139,250,0.2)" stroke="#a78bfa" strokeWidth={2} />
          <text x={240} y={96} textAnchor="middle" fontSize={11} fill="#a78bfa">∑+σ</text>
          <line x1={268} y1={100} x2={430} y2={100} stroke="#64748b" strokeWidth={1.5} />
          <circle cx={430} cy={100} r={22} fill="rgba(74,222,128,0.2)" stroke="#4ade80" strokeWidth={2} />
          <text x={430} y={105} textAnchor="middle" fontSize={13} fill="#4ade80">y</text>
        </svg>
      </Card>
    </AbsoluteFill>
  );
}

function NetworkScene({ frame }) {
  const op = ci(frame, [T.networkIn, T.networkIn + 30], [0, 1]);
  const fadeOut = frame >= T.forwardIn ? ci(frame, [T.forwardIn, T.forwardIn + 25], [1, 0]) : 1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <Card>
        <SceneTitle text="Network Architecture" frame={frame} startFrame={T.networkIn} />
        <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
          {NET.flatMap((layerSize, li) =>
            li < NET.length - 1
              ? Array.from({ length: layerSize }, (_, ni) =>
                  Array.from({ length: NET[li + 1] }, (_, ni2) => {
                    const p1 = nodePos(li, ni), p2 = nodePos(li + 1, ni2);
                    const prog = ci(frame, [T.networkIn + li * 40, T.networkIn + (li + 1) * 40], [0, 1]);
                    return <line key={`c-${li}-${ni}-${ni2}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#334155" strokeWidth={1} opacity={prog} />;
                  })
                )
              : []
          )}
          {NET.flatMap((layerSize, li) =>
            Array.from({ length: layerSize }, (_, ni) => {
              const { x, y } = nodePos(li, ni);
              const prog = ci(frame, [T.networkIn + li * 40, T.networkIn + li * 40 + 30], [0, 1]);
              return <circle key={`n-${li}-${ni}`} cx={x} cy={y} r={16} fill={`${LAYER_COLORS[li]}22`} stroke={LAYER_COLORS[li]} strokeWidth={2} opacity={prog} />;
            })
          )}
          {["Input", "Hidden", "Hidden", "Output"].map((label, li) => (
            <text key={li} x={nodePos(li, 0).x} y={SVG_H - 4} textAnchor="middle" fontSize={11} fill="#9ca3af">{label}</text>
          ))}
        </svg>
      </Card>
    </AbsoluteFill>
  );
}

function ForwardPassScene({ frame }) {
  const op = ci(frame, [T.forwardIn, T.forwardIn + 30], [0, 1]);
  const fadeOut = frame >= T.trainingIn ? ci(frame, [T.trainingIn, T.trainingIn + 25], [1, 0]) : 1;
  const activationProgress = ci(frame, [T.forwardIn + 30, T.forwardIn + 180], [0, NET.length - 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <Card>
        <SceneTitle text="Forward Pass" frame={frame} startFrame={T.forwardIn} />
        <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
          {NET.flatMap((layerSize, li) =>
            li < NET.length - 1
              ? Array.from({ length: layerSize }, (_, ni) =>
                  Array.from({ length: NET[li + 1] }, (_, ni2) => {
                    const p1 = nodePos(li, ni), p2 = nodePos(li + 1, ni2);
                    return <line key={`c-${li}-${ni}-${ni2}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#334155" strokeWidth={1} />;
                  })
                )
              : []
          )}
          {NET.flatMap((layerSize, li) =>
            Array.from({ length: layerSize }, (_, ni) => {
              const { x, y } = nodePos(li, ni);
              const isActive = activationProgress >= li;
              return <circle key={`n-${li}-${ni}`} cx={x} cy={y} r={16} fill={isActive ? `${LAYER_COLORS[li]}44` : "rgba(51,65,85,0.3)"} stroke={isActive ? LAYER_COLORS[li] : "#334155"} strokeWidth={2} />;
            })
          )}
        </svg>
        <div style={{ fontSize: 14, color: "#9ca3af", marginTop: 12, textAlign: "center" }}>
          Data flows layer by layer from input to output
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function TrainingScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.trainingIn, T.trainingIn + 30], [0, 1]);
  const fadeOut = frame >= T.appsIn ? ci(frame, [T.appsIn, T.appsIn + 25], [1, 0]) : 1;
  const steps = [
    { icon: "→", label: "Forward Pass",    color: "#38bdf8", delay: 0   },
    { icon: "△", label: "Compute Loss",    color: "#f59e0b", delay: 40  },
    { icon: "←", label: "Backpropagation", color: "#a78bfa", delay: 80  },
    { icon: "↑", label: "Update Weights",  color: "#4ade80", delay: 120 },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 18, padding: "32px 48px", width: 600 }}>
        <SceneTitle text="Training Process" frame={frame} startFrame={T.trainingIn} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {steps.map((step, i) => {
            const sp = spring({ frame: frame - T.trainingIn - step.delay, fps, config: { damping: 18, stiffness: 140 } });
            return (
              <div key={i} style={{ background: `${step.color}11`, border: `1px solid ${step.color}44`, borderRadius: 12, padding: "16px 20px", transform: `scale(${sp})`, opacity: sp }}>
                <div style={{ fontSize: 28, color: step.color, marginBottom: 6 }}>{step.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#e5e7eb" }}>{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ApplicationsScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.appsIn, T.appsIn + 30], [0, 1]);
  const fadeOut = frame >= T.outroIn ? ci(frame, [T.outroIn, T.outroIn + 25], [1, 0]) : 1;
  const apps = [
    { icon: "👁", label: "Image Recognition", color: "#38bdf8" },
    { icon: "🌐", label: "Translation",        color: "#a78bfa" },
    { icon: "🎙", label: "Voice Assistants",   color: "#4ade80" },
    { icon: "🚗", label: "Self-Driving Cars",  color: "#f59e0b" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 18, padding: "32px 48px", width: 620 }}>
        <SceneTitle text="Applications" frame={frame} startFrame={T.appsIn} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {apps.map((app, i) => {
            const sp = spring({ frame: frame - T.appsIn - i * 30, fps, config: { damping: 18, stiffness: 140 } });
            return (
              <div key={i} style={{ background: `${app.color}11`, border: `1px solid ${app.color}44`, borderRadius: 12, padding: "20px 24px", textAlign: "center", transform: `translateY(${interpolate(sp, [0, 1], [20, 0])}px)`, opacity: sp }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{app.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: app.color }}>{app.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function OutroScene({ frame }) {
  const op = ci(frame, [T.outroIn, T.outroIn + 30], [0, 1]);
  const fadeOut = frame >= T.mathIn ? ci(frame, [T.mathIn, T.mathIn + 25], [1, 0]) : 1;
  const tags = ["PyTorch", "TensorFlow", "Backprop", "Gradient Descent"];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: "#38bdf8" }}>Neural Networks</div>
        <div style={{ fontSize: 20, color: "#a78bfa", marginTop: 8 }}>The foundation of modern AI</div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "center" }}>
          {tags.map(tag => (
            <div key={tag} style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", borderRadius: 999, padding: "6px 16px", fontSize: 13, color: "#a78bfa" }}>
              {tag}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function MathScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.mathIn, T.mathIn + 30], [0, 1]);
  const fadeOut = frame >= T.govIn ? ci(frame, [T.govIn, T.govIn + 25], [1, 0]) : 1;
  const equations = [
    { label: "Chain Rule — Gradient Flow", eq: "δL/δw = δL/δy · δy/δz · δz/δw", color: "#38bdf8" },
    { label: "Weight Update Rule",          eq: "w ← w − η · ∇L(w)",              color: "#a78bfa" },
    { label: "Cross-Entropy Loss",          eq: "L = −Σ yᵢ · log(ŷᵢ)",            color: "#f59e0b" },
    { label: "Softmax Output",              eq: "σ(z)ᵢ = eᶻⁱ / Σⱼ eᶻʲ",           color: "#4ade80" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 18, padding: "32px 48px", width: 700 }}>
        <SceneTitle text="Backpropagation Mathematics" frame={frame} startFrame={T.mathIn} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {equations.map((eq, i) => {
            const sp = spring({ frame: frame - T.mathIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${eq.color}0d`, border: `1px solid ${eq.color}33`,
                borderRadius: 10, padding: "14px 20px",
                opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-24, 0])}px)`,
              }}>
                <div style={{ fontSize: 11, color: eq.color, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{eq.label}</div>
                <div style={{ fontSize: 18, color: "#e5e7eb", fontFamily: "monospace", letterSpacing: "0.03em" }}>{eq.eq}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function GovScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.govIn, T.govIn + 30], [0, 1]);
  const fadeOut = frame >= T.healthIn ? ci(frame, [T.healthIn, T.healthIn + 25], [1, 0]) : 1;
  const agencies = [
    { icon: "🛡", label: "NSA — Signals Intelligence", color: "#38bdf8",
      bullets: ["Deep CNNs classify signals across billions of daily intercepts", "Real-time threat scoring at national-scale data rates"] },
    { icon: "🏦", label: "IRS — Tax Fraud Detection", color: "#a78bfa",
      bullets: ["Graph neural networks flag fraudulent returns at 94% accuracy", "Billions in annual revenue recovered through ML-guided audits"] },
    { icon: "✈️", label: "CBP — Cargo Scanning", color: "#4ade80",
      bullets: ["Object detection on X-ray scans identifies contraband", "Sub-second latency across thousands of daily cargo inspections"] },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 18, padding: "32px 48px", width: 820 }}>
        <SceneTitle text="Government Applications" frame={frame} startFrame={T.govIn} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {agencies.map((a, i) => {
            const sp = spring({ frame: frame - T.govIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
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

function HealthScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.healthIn, T.healthIn + 30], [0, 1]);
  const fadeOut = frame >= T.oilIn ? ci(frame, [T.oilIn, T.oilIn + 25], [1, 0]) : 1;
  const cases = [
    { icon: "👁", label: "DeepMind — Retinal Eye Disease", color: "#f472b6",
      stat: "94% sensitivity", statColor: "#4ade80",
      desc: "Detects 50+ eye conditions from retinal scans, matching specialist-level accuracy" },
    { icon: "🏥", label: "ICU Sepsis Prediction", color: "#38bdf8",
      stat: "6 hr early warning", statColor: "#fbbf24",
      desc: "Recurrent networks analyze continuous vitals to alert clinicians before symptoms appear" },
    { icon: "🔬", label: "Stanford — Skin Cancer Diagnosis", color: "#a78bfa",
      stat: "91% accuracy", statColor: "#4ade80",
      desc: "CNN trained on 130,000 images classifies malignant lesions from dermoscopic photographs" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 18, padding: "32px 48px", width: 820 }}>
        <SceneTitle text="Healthcare Applications" frame={frame} startFrame={T.healthIn} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {cases.map((c, i) => {
            const sp = spring({ frame: frame - T.healthIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
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

function OilScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.oilIn, T.oilIn + 30], [0, 1]);
  const fadeOut = frame >= T.finalIn ? ci(frame, [T.finalIn, T.finalIn + 25], [1, 0]) : 1;
  const apps = [
    { icon: "🌍", label: "Seismic Reservoir Interpretation", color: "#f59e0b",
      stat: "30% better precision", statColor: "#4ade80",
      desc: "3D subsurface neural networks locate hydrocarbon deposits with greater accuracy than manual analysis" },
    { icon: "⚙️", label: "Drilling Equipment Failure Prediction", color: "#38bdf8",
      stat: "72 hr advance warning", statColor: "#fbbf24",
      desc: "Recurrent models monitoring sensor data cut unplanned downtime by 40 percent" },
    { icon: "🏭", label: "Refinery Distillation Optimization", color: "#4ade80",
      stat: "15% energy reduction", statColor: "#a78bfa",
      desc: "Neural controllers optimize distillation columns in real time using live process measurements" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 18, padding: "32px 48px", width: 820 }}>
        <SceneTitle text="Oil & Gas Applications" frame={frame} startFrame={T.oilIn} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {apps.map((a, i) => {
            const sp = spring({ frame: frame - T.oilIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
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

function FinalScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.finalIn, T.finalIn + 30], [0, 1]);
  const metrics = [
    { icon: "🖼", label: "ResNet-50 ImageNet",  val: "76%",  sub: "top-1 accuracy",     color: "#38bdf8" },
    { icon: "⚖️", label: "GPT-4 Bar Exam",       val: "90th", sub: "percentile",          color: "#a78bfa" },
    { icon: "💊", label: "Drug Discovery",        val: "10×",  sub: "faster screening",    color: "#4ade80" },
    { icon: "⚡", label: "Inference Latency",     val: "<1ms", sub: "per query on GPU",    color: "#f59e0b" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 18, padding: "36px 56px", width: 780 }}>
        <SceneTitle text="Benchmark Results" frame={frame} startFrame={T.finalIn} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {metrics.map((m, i) => {
            const sp = spring({ frame: frame - T.finalIn - i * 35, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${m.color}0d`, border: `1px solid ${m.color}33`,
                borderRadius: 14, padding: "22px 26px", textAlign: "center",
                opacity: sp, transform: `scale(${interpolate(sp, [0, 1], [0.85, 1])})`,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{m.icon}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.val}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.sub}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 22, padding: "12px 20px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 10, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
          Neural networks consistently deliver superhuman performance across vision, language, science, and medicine.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function BrandBar() {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Bottom-right brand watermark */}
      <div style={{
        position: "absolute", bottom: 28, right: 36,
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(2,6,23,0.72)", border: "1px solid rgba(56,189,248,0.3)",
        borderRadius: 40, padding: "7px 20px 7px 7px",
        backdropFilter: "blur(6px)",
      }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden",
          border: "2px solid #38bdf8", flexShrink: 0 }}>
          <Img
            src={staticFile("images/steve.jpg")}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
            Presented by
          </div>
          <div style={{ fontSize: 12, color: "#e5e7eb", fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap" }}>
            {ORG}
          </div>
        </div>
      </div>
      {/* Top-left org name */}
      <div style={{
        position: "absolute", top: 22, left: 32,
        fontSize: 11, color: "rgba(148,163,184,0.6)",
        fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase",
      }}>
        {ORG}
      </div>
    </AbsoluteFill>
  );
}

export function NeuralNet() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at top, #1e293b, #020617 45%)", fontFamily: "system-ui, -apple-system, sans-serif", color: "#e5e7eb" }}>
      <NarrationTrack />
      {frame < T.neuronIn   + 30 && <TitleScene       frame={frame} />}
      {frame >= T.neuronIn  && frame < T.networkIn   + 30 && <NeuronScene      frame={frame} />}
      {frame >= T.networkIn && frame < T.forwardIn   + 30 && <NetworkScene     frame={frame} />}
      {frame >= T.forwardIn && frame < T.trainingIn  + 30 && <ForwardPassScene frame={frame} />}
      {frame >= T.trainingIn && frame < T.appsIn     + 30 && <TrainingScene    frame={frame} />}
      {frame >= T.appsIn    && frame < T.outroIn     + 30 && <ApplicationsScene frame={frame} />}
      {frame >= T.outroIn   && frame < T.mathIn   + 30 && <OutroScene   frame={frame} />}
      {frame >= T.mathIn    && frame < T.govIn    + 30 && <MathScene    frame={frame} />}
      {frame >= T.govIn     && frame < T.healthIn + 30 && <GovScene     frame={frame} />}
      {frame >= T.healthIn  && frame < T.oilIn    + 30 && <HealthScene  frame={frame} />}
      {frame >= T.oilIn     && frame < T.finalIn  + 30 && <OilScene     frame={frame} />}
      {frame >= T.finalIn   && <FinalScene frame={frame} />}
      <BrandBar />
    </AbsoluteFill>
  );
}
