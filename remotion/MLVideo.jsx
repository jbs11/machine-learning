import {
  AbsoluteFill, Html5Audio, Img, Sequence, interpolate,
  spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";

const ORG = "Artificial Intelligence Solutions, Inc.";

export const ML_DURATION = 7254;

const T = {
  titleIn:      0,
  whatIn:       303,
  typesIn:      606,
  workflowIn:   1067,
  algorithmsIn: 1372,
  appsIn:       1731,
  outroIn:      2076,
  mathIn:       2383,
  govIn:        3266,
  healthIn:     4189,
  oilIn:        5159,
  finalIn:      6134,
};

function ci(frame, [f0, f1], [v0, v1]) {
  return interpolate(frame, [f0, f1], [v0, v1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// Durations from Edge TTS en-US-GuyNeural (frames @ 30fps).
const ML_CLIPS = [
  { file: "ml-01", start: 0,    dur: 273 }, // ends 273
  { file: "ml-02", start: 303,  dur: 273 }, // ends 576
  { file: "ml-03", start: 606,  dur: 431 }, // ends 1037
  { file: "ml-04", start: 1067, dur: 275 }, // ends 1342
  { file: "ml-05", start: 1372, dur: 329 }, // ends 1701
  { file: "ml-06", start: 1731, dur: 315 }, // ends 2046
  { file: "ml-07", start: 2076, dur: 277 }, // ends 2353
  { file: "ml-08", start: 2383, dur: 853 }, // ends 3236
  { file: "ml-09", start: 3266, dur: 893 }, // ends 4159
  { file: "ml-10", start: 4189, dur: 940 }, // ends 5129
  { file: "ml-11", start: 5159, dur: 945 }, // ends 6104
  { file: "ml-12", start: 6134, dur: 1030}, // ends 7164
];

function NarrationTrack() {
  return (
    <>
      {ML_CLIPS.map(c => (
        <Sequence key={c.file} from={c.start} durationInFrames={c.dur}>
          <Html5Audio src={staticFile(`audio/${c.file}.mp3`)} />
        </Sequence>
      ))}
    </>
  );
}

function fadeInOut(frame, startFrame, endFrame) {
  const fadeIn  = ci(frame, [startFrame, startFrame + 30], [0, 1]);
  const fadeOut = endFrame != null ? ci(frame, [endFrame, endFrame + 25], [1, 0]) : 1;
  return fadeIn * fadeOut;
}

function Card({ children, width = 680 }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(148,163,184,0.2)",
      borderRadius: 18, padding: "32px 48px", width,
    }}>
      {children}
    </div>
  );
}

function SceneTitle({ text, frame, startFrame, color = "#38bdf8" }) {
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - startFrame, fps, config: { damping: 20, stiffness: 120 } });
  return (
    <div style={{
      fontSize: 22, fontWeight: 700, color, marginBottom: 24,
      opacity: sp,
      transform: `translateY(${interpolate(sp, [0, 1], [18, 0])}px)`,
    }}>
      {text}
    </div>
  );
}

function TitleScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [0, 40], [0, 1]);
  const fadeOut = frame >= T.whatIn ? ci(frame, [T.whatIn, T.whatIn + 25], [1, 0]) : 1;
  const sp = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 64, fontWeight: 900,
          background: "linear-gradient(135deg, #38bdf8, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1.1,
          transform: `scale(${interpolate(sp, [0, 1], [0.85, 1])})`,
        }}>
          Machine Learning
        </div>
        <div style={{ fontSize: 22, color: "#9ca3af", marginTop: 16 }}>From Data to Intelligence</div>
      </div>
    </AbsoluteFill>
  );
}

function WhatScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.whatIn, T.typesIn);
  const bullets = [
    { icon: "📊", text: "Learns patterns from data — no explicit rules needed",     color: "#38bdf8" },
    { icon: "🧠", text: "Generalises to make predictions on unseen examples",       color: "#a78bfa" },
    { icon: "🔁", text: "Improves automatically with more data and training time",  color: "#4ade80" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card>
        <SceneTitle text="What is Machine Learning?" frame={frame} startFrame={T.whatIn} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {bullets.map((b, i) => {
            const sp = spring({ frame: frame - T.whatIn - i * 35, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 16,
                background: `${b.color}0d`, border: `1px solid ${b.color}33`,
                borderRadius: 12, padding: "14px 20px",
                opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-30, 0])}px)`,
              }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{b.icon}</span>
                <span style={{ fontSize: 15, color: "#e5e7eb" }}>{b.text}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function TypesScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.typesIn, T.workflowIn);
  const types = [
    { label: "Supervised",    icon: "🏷", color: "#38bdf8", desc: "Labelled data — predict outputs from inputs",    examples: "Classification, Regression" },
    { label: "Unsupervised",  icon: "🔍", color: "#a78bfa", desc: "Unlabelled data — find hidden structure",        examples: "Clustering, Dimensionality reduction" },
    { label: "Reinforcement", icon: "🎮", color: "#4ade80", desc: "Agent learns via reward and penalty",            examples: "Game AI, Robotics" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={760}>
        <SceneTitle text="Types of Machine Learning" frame={frame} startFrame={T.typesIn} color="#a78bfa" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {types.map((t, i) => {
            const sp = spring({ frame: frame - T.typesIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${t.color}0d`, border: `1px solid ${t.color}44`,
                borderRadius: 14, padding: "20px 18px",
                opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [24, 0])}px)`,
              }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>{t.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.color, marginBottom: 8 }}>{t.label}</div>
                <div style={{ fontSize: 13, color: "#d1d5db", marginBottom: 8 }}>{t.desc}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>{t.examples}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function WorkflowScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.workflowIn, T.algorithmsIn);
  const steps = [
    { label: "Collect Data", icon: "🗄",  color: "#38bdf8" },
    { label: "Preprocess",   icon: "⚙️",  color: "#60a5fa" },
    { label: "Train Model",  icon: "🏋️",  color: "#a78bfa" },
    { label: "Evaluate",     icon: "📈",  color: "#f59e0b" },
    { label: "Deploy",       icon: "🚀",  color: "#4ade80" },
  ];
  const arrowProgress = ci(frame, [T.workflowIn + 60, T.workflowIn + 180], [0, steps.length - 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={740}>
        <SceneTitle text="ML Workflow" frame={frame} startFrame={T.workflowIn} color="#f59e0b" />
        <div style={{ display: "flex", alignItems: "center" }}>
          {steps.map((s, i) => {
            const sp = spring({ frame: frame - T.workflowIn - i * 30, fps, config: { damping: 18, stiffness: 130 } });
            const isActive = arrowProgress >= i;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{
                  flex: 1, textAlign: "center",
                  background: isActive ? `${s.color}22` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? s.color : "rgba(148,163,184,0.15)"}`,
                  borderRadius: 12, padding: "16px 8px",
                  opacity: sp, transform: `scale(${interpolate(sp, [0, 1], [0.8, 1])})`,
                }}>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? s.color : "#9ca3af" }}>{s.label}</div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ fontSize: 18, color: arrowProgress > i ? steps[i + 1].color : "#334155", padding: "0 4px", flexShrink: 0 }}>→</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function AlgorithmsScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.algorithmsIn, T.appsIn);
  const algos = [
    { label: "Linear Regression", icon: "📉", color: "#38bdf8", desc: "Predict continuous values" },
    { label: "Decision Trees",    icon: "🌳", color: "#4ade80", desc: "Hierarchical rule splits" },
    { label: "Random Forest",     icon: "🌲", color: "#34d399", desc: "Ensemble of decision trees" },
    { label: "SVM",               icon: "✂️", color: "#f59e0b", desc: "Optimal boundary margins" },
    { label: "K-Means",           icon: "🎯", color: "#a78bfa", desc: "Centroid-based clustering" },
    { label: "Neural Networks",   icon: "🧬", color: "#f472b6", desc: "Deep layered learning" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={760}>
        <SceneTitle text="Common Algorithms" frame={frame} startFrame={T.algorithmsIn} color="#4ade80" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {algos.map((a, i) => {
            const sp = spring({ frame: frame - T.algorithmsIn - i * 25, fps, config: { damping: 18, stiffness: 140 } });
            return (
              <div key={i} style={{
                background: `${a.color}0d`, border: `1px solid ${a.color}33`,
                borderRadius: 12, padding: "14px 16px",
                opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [16, 0])}px)`,
              }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: a.color, marginTop: 6 }}>{a.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{a.desc}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function AppsScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.appsIn, T.outroIn);
  const apps = [
    { icon: "🎬", label: "Recommendations",  color: "#38bdf8", sub: "Netflix, Spotify" },
    { icon: "🏥", label: "Medical Diagnosis", color: "#f472b6", sub: "Cancer detection" },
    { icon: "🛡", label: "Fraud Detection",   color: "#f59e0b", sub: "Banking & finance" },
    { icon: "💬", label: "Natural Language",  color: "#a78bfa", sub: "ChatGPT, Gemini" },
    { icon: "🚗", label: "Self-Driving",      color: "#4ade80", sub: "Tesla, Waymo" },
    { icon: "📸", label: "Computer Vision",   color: "#60a5fa", sub: "Face ID, OCR" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={760}>
        <SceneTitle text="Real-World Applications" frame={frame} startFrame={T.appsIn} color="#f472b6" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {apps.map((a, i) => {
            const sp = spring({ frame: frame - T.appsIn - i * 28, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${a.color}0d`, border: `1px solid ${a.color}33`,
                borderRadius: 12, padding: "16px", textAlign: "center",
                opacity: sp, transform: `translateY(${interpolate(sp, [0, 1], [20, 0])}px)`,
              }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>{a.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{a.sub}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function OutroScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.outroIn, T.outroIn + 35], [0, 1]);
  const fadeOut = frame >= T.mathIn ? ci(frame, [T.mathIn, T.mathIn + 25], [1, 0]) : 1;
  const photoSp = spring({ frame: frame - T.outroIn - 10, fps, config: { damping: 18, stiffness: 90 } });
  const tags = ["Python", "scikit-learn", "TensorFlow", "PyTorch", "Keras"];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op * fadeOut }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 54, fontWeight: 900,
          background: "linear-gradient(135deg, #38bdf8, #a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Machine Learning
        </div>
        <div style={{ fontSize: 20, color: "#9ca3af", marginTop: 10 }}>Turning data into decisions</div>

        {/* Brand credit block */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
          marginTop: 36, marginBottom: 20,
          opacity: photoSp,
          transform: `scale(${interpolate(photoSp, [0, 1], [0.85, 1])})`,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", overflow: "hidden",
            border: "3px solid #38bdf8",
            boxShadow: "0 0 24px rgba(56,189,248,0.35)",
          }}>
            <Img
              src={staticFile("images/steve.jpg")}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Presented by
            </div>
            <div style={{ fontSize: 17, color: "#f1f5f9", fontWeight: 700, marginTop: 3 }}>
              {ORG}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {tags.map(tag => (
            <div key={tag} style={{
              background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.35)",
              borderRadius: 999, padding: "7px 18px", fontSize: 13, color: "#38bdf8",
            }}>
              {tag}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function EvalMathScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.mathIn, T.govIn);
  const metrics = [
    { label: "Accuracy",  eq: "Correct / Total Predictions",                color: "#38bdf8" },
    { label: "F1 Score",  eq: "2 · (Precision · Recall) / (Precision + Recall)", color: "#a78bfa" },
    { label: "AUC-ROC",  eq: "Area under TPR vs FPR curve across thresholds", color: "#f59e0b" },
    { label: "RMSE",      eq: "√( Σ(yᵢ − ŷᵢ)² / n )",                     color: "#4ade80" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={720}>
        <SceneTitle text="Model Evaluation Mathematics" frame={frame} startFrame={T.mathIn} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {metrics.map((m, i) => {
            const sp = spring({ frame: frame - T.mathIn - i * 40, fps, config: { damping: 18, stiffness: 130 } });
            return (
              <div key={i} style={{
                background: `${m.color}0d`, border: `1px solid ${m.color}33`,
                borderRadius: 10, padding: "14px 20px",
                opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [-24, 0])}px)`,
              }}>
                <div style={{ fontSize: 11, color: m.color, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 15, color: "#e5e7eb", fontFamily: "monospace" }}>{m.eq}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function GovScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.govIn, T.healthIn);
  const agencies = [
    { icon: "📈", label: "SEC — Insider Trading Detection", color: "#22d3ee",
      bullets: ["Gradient boosting scans millions of daily transactions for anomalous patterns", "Insider trading cases referred for enforcement up 35% since model deployment"] },
    { icon: "🤖", label: "DoD — Autonomous Drone Navigation", color: "#a78bfa",
      bullets: ["Reinforcement learning optimizes flight paths and mission sequencing", "Real-time object classification from aerial imagery at edge-deployed speeds"] },
    { icon: "🚨", label: "FEMA — Disaster Resource Allocation", color: "#4ade80",
      bullets: ["NLP parses social media feeds to locate distress signals in real time", "Resource routing optimized faster than any traditional dispatch system"] },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={820}>
        <SceneTitle text="Government Applications" frame={frame} startFrame={T.govIn} color="#22d3ee" />
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
      </Card>
    </AbsoluteFill>
  );
}

function HealthScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.healthIn, T.oilIn);
  const cases = [
    { icon: "🏥", label: "Hospital Readmission Prediction", color: "#f472b6",
      stat: "80% AUC", statColor: "#4ade80",
      desc: "Random forests on EHR data enable proactive discharge planning and intervention" },
    { icon: "🧪", label: "Clinical Trial Matching", color: "#38bdf8",
      stat: "Millisecond matching", statColor: "#fbbf24",
      desc: "Gradient boosting parses patient histories against eligibility criteria at scale" },
    { icon: "🩻", label: "Radiology Anomaly Detection", color: "#a78bfa",
      stat: "30% workload reduction", statColor: "#4ade80",
      desc: "Ensemble models flag anomalous CT findings without sacrificing diagnostic accuracy" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={820}>
        <SceneTitle text="Healthcare Applications" frame={frame} startFrame={T.healthIn} color="#f472b6" />
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
      </Card>
    </AbsoluteFill>
  );
}

function OilScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = fadeInOut(frame, T.oilIn, T.finalIn);
  const apps = [
    { icon: "📉", label: "Reservoir Decline Curve Forecasting", color: "#f59e0b",
      stat: "MAE < 5%", statColor: "#4ade80",
      desc: "XGBoost on well logs and production history guides multi-billion dollar field development" },
    { icon: "🪨", label: "Drilling Lithology Classification", color: "#38bdf8",
      stat: "Real-time bit selection", statColor: "#fbbf24",
      desc: "SVMs classify rock formations from sensor feeds enabling automated drilling decisions" },
    { icon: "📋", label: "Maintenance Report Intelligence", color: "#4ade80",
      stat: "MTTR reduction", statColor: "#a78bfa",
      desc: "NLP extracts failure patterns from thousands of unstructured engineering reports" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={820}>
        <SceneTitle text="Oil & Gas Applications" frame={frame} startFrame={T.oilIn} color="#f59e0b" />
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
      </Card>
    </AbsoluteFill>
  );
}

function FinalScene({ frame }) {
  const { fps } = useVideoConfig();
  const op = ci(frame, [T.finalIn, T.finalIn + 30], [0, 1]);
  const metrics = [
    { icon: "💰", label: "Global Economic Value",   val: "$13T",  sub: "by 2030 (McKinsey)",       color: "#4ade80" },
    { icon: "🏭", label: "Manufacturing Downtime",  val: "−50%",  sub: "with predictive maintenance", color: "#38bdf8" },
    { icon: "🛡", label: "Fraud Blocked",           val: "99%",   sub: "with <0.1% false positives",  color: "#a78bfa" },
    { icon: "⚕️", label: "Medical Diagnosis",       val: "≥91%",  sub: "accuracy on imaging tasks",   color: "#f472b6" },
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: op }}>
      <Card width={780}>
        <SceneTitle text="Industry Impact & Results" frame={frame} startFrame={T.finalIn} color="#4ade80" />
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
                <div style={{ fontSize: 34, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.val}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{m.sub}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 22, padding: "12px 20px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 10, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
          Machine learning creates measurable gains in efficiency, accuracy, and profitability across every industry.
        </div>
      </Card>
    </AbsoluteFill>
  );
}

function BrandBar() {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Bottom-right brand watermark */}
      <div style={{
        position: "absolute",
        bottom: 28,
        right: 36,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(2,6,23,0.72)",
        border: "1px solid rgba(56,189,248,0.3)",
        borderRadius: 40,
        padding: "7px 20px 7px 7px",
        backdropFilter: "blur(6px)",
      }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #38bdf8",
          flexShrink: 0,
        }}>
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
        position: "absolute",
        top: 22,
        left: 32,
        fontSize: 11,
        color: "rgba(148,163,184,0.6)",
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}>
        {ORG}
      </div>
    </AbsoluteFill>
  );
}

export function MLVideo() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{
      background: "radial-gradient(circle at top, #1e293b, #020617 45%)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#e5e7eb",
    }}>
      <NarrationTrack />
      {frame < T.whatIn        + 30 && <TitleScene      frame={frame} />}
      {frame >= T.whatIn       && frame < T.typesIn      + 30 && <WhatScene       frame={frame} />}
      {frame >= T.typesIn      && frame < T.workflowIn   + 30 && <TypesScene      frame={frame} />}
      {frame >= T.workflowIn   && frame < T.algorithmsIn + 30 && <WorkflowScene   frame={frame} />}
      {frame >= T.algorithmsIn && frame < T.appsIn       + 30 && <AlgorithmsScene frame={frame} />}
      {frame >= T.appsIn       && frame < T.outroIn      + 30 && <AppsScene       frame={frame} />}
      {frame >= T.outroIn      && frame < T.mathIn   + 30 && <OutroScene    frame={frame} />}
      {frame >= T.mathIn       && frame < T.govIn    + 30 && <EvalMathScene frame={frame} />}
      {frame >= T.govIn        && frame < T.healthIn + 30 && <GovScene      frame={frame} />}
      {frame >= T.healthIn     && frame < T.oilIn    + 30 && <HealthScene   frame={frame} />}
      {frame >= T.oilIn        && frame < T.finalIn  + 30 && <OilScene      frame={frame} />}
      {frame >= T.finalIn      && <FinalScene frame={frame} />}
      <BrandBar />
    </AbsoluteFill>
  );
}
