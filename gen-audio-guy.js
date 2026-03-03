// Generate all narration clips using Edge TTS (en-US-GuyNeural — deep, warm male)
// Run: node gen-audio-guy.js

const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const VOICE = "en-US-GuyNeural";

const clips = [
  // Neural Networks
  { file: "nn-01", text: "Neural networks are computing systems modeled after the human brain, transforming raw inputs into intelligent predictions through layers of interconnected neurons." },
  { file: "nn-02", text: "Every artificial neuron receives a set of inputs, multiplies each by a learned weight, and passes the sum through an activation function to produce an output signal." },
  { file: "nn-03", text: "Neurons are organized in layers. Input layers capture raw data, while deep hidden layers progressively extract abstract features, and the output layer delivers final predictions." },
  { file: "nn-04", text: "During a forward pass, data flows through each layer in sequence, as neurons apply their weights and activations, transforming the signal from one representation to the next." },
  { file: "nn-05", text: "Training adjusts every weight using backpropagation, by measuring the prediction error, then propagating gradients backward through the network, to minimize loss with each step." },
  { file: "nn-06", text: "Neural networks power some of the most impactful technologies today, driving breakthroughs in image recognition, natural language translation, and intelligent voice assistants." },
  { file: "nn-07", text: "Neural networks are the cornerstone of modern artificial intelligence, making deep learning possible across science, engineering, medicine, and global commerce." },
  // Machine Learning
  { file: "ml-01", text: "Machine learning is a branch of artificial intelligence that empowers systems to learn directly from data, discovering patterns without being explicitly programmed." },
  { file: "ml-02", text: "Instead of hand-coded rules, machine learning models train on labeled examples and generalize their knowledge to make accurate predictions on data they have never seen before." },
  { file: "ml-03", text: "There are three core learning paradigms. Supervised learning trains on labeled examples. Unsupervised learning discovers hidden structure. And reinforcement learning optimizes actions through reward." },
  { file: "ml-04", text: "The machine learning workflow moves from data collection, through feature engineering, to model training, then evaluation, and finally deployment into production." },
  { file: "ml-05", text: "Powerful algorithms span from linear regression for continuous prediction, to decision trees, random forests, support vector machines, and deep neural networks for complex tasks." },
  { file: "ml-06", text: "Machine learning drives the recommendation engines behind streaming services, the fraud detection systems protecting financial networks, and the diagnostic tools advancing modern medicine." },
  { file: "ml-07", text: "Machine learning is reshaping every industry by automating intelligent decisions at scale, and unlocking capabilities once thought to require human expertise." },
  // ML Trading
  { file: "trade-01", text: "Machine learning is revolutionizing quantitative trading by detecting subtle price patterns across massive datasets, that remain invisible to even the most experienced human traders." },
  { file: "trade-02", text: "The S and P 500 delivers decades of daily market data, tracking open, high, low, close, and volume for every trading session with precision." },
  { file: "trade-03", text: "Feature engineering transforms raw price action into predictive signals, computing moving averages, relative strength indicators, Bollinger Bands, and MACD crossovers." },
  { file: "trade-04", text: "Classification models tackle market direction by forecasting whether the next session will close higher, learning subtle patterns from years of historical price behavior." },
  { file: "trade-05", text: "Regression models estimate the magnitude of expected price movement, enabling precise position sizing, dynamic leverage control, and systematic risk management across a diversified portfolio." },
  { file: "trade-06", text: "Long Short-Term Memory networks model sequential market dynamics by capturing dependencies across hundreds of prior trading sessions, to anticipate near-term price trajectories." },
  { file: "trade-07", text: "Backtested across a full decade of S and P 500 data, these machine learning strategies deliver consistent risk-adjusted returns, with a Sharpe ratio exceeding one point five." },
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
