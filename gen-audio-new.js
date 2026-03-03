// Generate NEW extended narration clips using Edge TTS (en-US-GuyNeural)
// Adds nn-08..nn-12, ml-08..ml-12, trade-08..trade-12
// Run: node gen-audio-new.js

const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const VOICE = "en-US-GuyNeural";

const clips = [
  // ── Neural Networks extended ──────────────────────────────────────────────
  {
    file: "nn-08",
    text: "Backpropagation applies the chain rule of calculus to compute gradients. The loss gradient flows backward through every layer: delta equals the transpose of the weight matrix times the upstream gradient, multiplied element-wise by the activation derivative. Each weight is then updated by subtracting the learning rate times its gradient, iteratively minimizing cross-entropy or mean squared error until the model converges.",
  },
  {
    file: "nn-09",
    text: "Government agencies rely on neural networks at every level. The National Security Agency uses deep convolutional networks to classify signals intelligence across billions of daily intercepts. The IRS deploys graph neural networks that flag fraudulent tax returns with 94 percent accuracy, recovering billions annually. U.S. Customs and Border Protection runs real-time object detection on cargo scans to identify contraband with sub-second latency.",
  },
  {
    file: "nn-10",
    text: "In healthcare, convolutional neural networks now match or exceed radiologist accuracy on medical imaging tasks. Google DeepMind's model detects over 50 eye diseases from retinal scans with 94 percent sensitivity. Recurrent networks analyze continuous ICU streams to predict sepsis onset 6 hours before clinical symptoms appear, enabling earlier intervention. Stanford researchers achieved 91 percent accuracy diagnosing skin cancer from dermoscopic photographs alone.",
  },
  {
    file: "nn-11",
    text: "The oil and gas industry applies neural networks across the entire value chain. Seismic interpretation networks process 3D subsurface data to locate hydrocarbon reservoirs with 30 percent greater precision than manual analysis. Recurrent networks predict mechanical equipment failures in drilling operations 72 hours in advance, cutting unplanned downtime by 40 percent. Refineries use neural controllers to optimize distillation columns in real time, reducing energy consumption by up to 15 percent.",
  },
  {
    file: "nn-12",
    text: "Benchmark results demonstrate the transformative impact of neural networks. ResNet-50 achieves 76 percent top-1 accuracy on ImageNet, surpassing human performance on many visual tasks. GPT-4 scores in the 90th percentile on the bar exam and medical licensing tests. In drug discovery, neural networks reduce candidate screening from years to weeks. Across all domains, neural networks consistently deliver superhuman performance at a fraction of traditional cost.",
  },

  // ── Machine Learning extended ─────────────────────────────────────────────
  {
    file: "ml-08",
    text: "Model evaluation relies on rigorous mathematics. Accuracy measures overall correct predictions, but precision, recall, and the F1 score reveal performance on imbalanced classes. The area under the ROC curve quantifies discrimination across all thresholds, while cross-validated log-loss measures probabilistic calibration. For regression tasks, root mean squared error and mean absolute percentage error benchmark predictive precision against ground truth.",
  },
  {
    file: "ml-09",
    text: "Government applications of machine learning span defense, law enforcement, and public services. The Securities and Exchange Commission uses gradient boosting models to detect insider trading patterns across millions of daily transactions. The Department of Defense applies reinforcement learning to autonomous drone navigation and mission planning. FEMA deploys natural language processing on social media streams during disasters to allocate emergency resources faster than any traditional dispatch system.",
  },
  {
    file: "ml-10",
    text: "Machine learning is transforming healthcare delivery. Random forests trained on electronic health records predict 30-day hospital readmissions with 80 percent AUC, enabling proactive discharge planning. Gradient boosting models accelerate clinical drug trial matching by parsing patient histories against eligibility criteria in milliseconds. In radiology, ensemble models flag anomalous findings in CT scans, reducing radiologist workload by 30 percent without sacrificing diagnostic accuracy.",
  },
  {
    file: "ml-11",
    text: "Oil and gas companies apply machine learning to maximize production and reduce risk. XGBoost models trained on well logs and production histories forecast reservoir decline curves with mean absolute error below 5 percent, guiding multi-billion dollar field development decisions. Support vector machines classify drilling lithology in real time, enabling automated bit selection. Natural language processing pipelines extract maintenance insights from thousands of unstructured engineering reports, reducing mean time to repair.",
  },
  {
    file: "ml-12",
    text: "Quantified results confirm machine learning's industry-wide impact. McKinsey estimates machine learning creates 13 trillion dollars in annual global economic value by 2030. In manufacturing, predictive maintenance models cut equipment downtime by 50 percent. Financial fraud detection systems achieve false positive rates below 0.1 percent while blocking 99 percent of fraudulent transactions. From agriculture to aerospace, machine learning consistently delivers measurable gains in efficiency, accuracy, and profitability.",
  },

  // ── ML Trading extended ───────────────────────────────────────────────────
  {
    file: "trade-08",
    text: "Quantitative risk mathematics underpins every trading strategy. The Sharpe ratio divides annualized excess return by its standard deviation, rewarding consistent risk-adjusted performance. Value at Risk estimates the maximum expected loss at a 95 or 99 percent confidence level over a defined horizon. Maximum drawdown measures peak-to-trough decline, while the Calmar ratio compares annualized return to maximum drawdown, giving portfolio managers a complete picture of strategy robustness.",
  },
  {
    file: "trade-09",
    text: "Regulatory bodies use machine learning to police financial markets. The SEC's Market Information Data Analytics System ingests 100 billion daily market events, applying anomaly detection models to identify spoofing, layering, and front-running in microseconds. The Financial Industry Regulatory Authority uses graph convolutional networks to map broker-dealer networks and surface coordinated manipulation rings. These surveillance systems have increased enforcement actions by 35 percent since their deployment.",
  },
  {
    file: "trade-10",
    text: "Healthcare and pharmaceutical trading presents unique machine learning opportunities. Gradient boosting models trained on clinical trial databases predict FDA approval probability with 72 percent accuracy, informing event-driven biotech strategies. Sentiment models parse earnings calls, clinical conference abstracts, and patent filings to anticipate drug pipeline milestones days before consensus. These approaches generate alpha uncorrelated with broader market factors, providing genuine diversification for institutional portfolios.",
  },
  {
    file: "trade-11",
    text: "Energy and commodity markets are a natural domain for machine learning trading systems. LSTM networks trained on satellite imagery of oil storage facilities, shipping traffic, and weather patterns forecast crude inventory levels before official government reports. Reinforcement learning agents optimize natural gas futures spreads across delivery hubs by learning from thousands of simulated market scenarios. Energy hedge funds using these techniques report Sharpe ratios above 2.0, significantly outperforming traditional commodity trading advisors.",
  },
  {
    file: "trade-12",
    text: "Across a decade of live and backtested trading, machine learning strategies demonstrate durable alpha. Direction classification models achieve 58 percent accuracy on daily S and P 500 returns, generating annualized returns of 14 percent with volatility below 12 percent. Combined with LSTM magnitude forecasts and dynamic position sizing, portfolio Sharpe ratios reach 1.8. Maximum drawdown remains below 15 percent, and strategies maintain profitability through multiple market regimes, including the 2020 COVID crash and 2022 rate shock.",
  },
];

async function generate() {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  console.log(`Voice: ${VOICE}`);
  console.log(`Output: ${OUT_DIR}\n`);

  for (const clip of clips) {
    const outPath = path.join(OUT_DIR, `${clip.file}.mp3`);
    try {
      const { audioStream } = await tts.toStream(clip.text);
      const chunks = [];
      await new Promise((resolve, reject) => {
        audioStream.on("data", (chunk) => chunks.push(chunk));
        audioStream.on("close", resolve);
        audioStream.on("error", reject);
      });
      fs.writeFileSync(outPath, Buffer.concat(chunks));
      const kb = Math.round(fs.statSync(outPath).size / 1024);
      console.log(`✓ ${clip.file}.mp3  (${kb} KB)`);
    } catch (err) {
      console.error(`✗ ${clip.file}: ${err.message}`);
    }
  }

  console.log("\nDone.");
}

generate().catch(console.error);
