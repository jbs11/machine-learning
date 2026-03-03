# AI Course — Machine Learning Video Suite

**Artificial Intelligence Solutions, Inc.**
Presented by Stephen Borick

---

## Overview

A full-stack AI education course delivering three animated video lessons with synchronized neural TTS narration, served through a responsive web application. Each video is programmatically rendered in React using [Remotion](https://www.remotion.dev/) and covers a different pillar of modern machine learning — from theoretical foundations to real-world sector applications.

---

## Course Modules

| Module | Video | Duration | Topics |
|--------|-------|----------|--------|
| 1 | Neural Networks | ~3:50 | Perceptrons, backprop math, CNNs/RNNs/Transformers, Government · Healthcare · Oil & Gas |
| 2 | Machine Learning | ~4:02 | Supervised/unsupervised/RL, evaluation metrics, algorithms, Government · Healthcare · Oil & Gas |
| 3 | ML in Trading | ~4:09 | SPX prediction, feature engineering, LSTM, risk math, SEC/FINRA · Pharma · Energy trading |

Each module includes:
- Animated SVG/React scenes with spring physics transitions
- 12-clip AI-narrated audio track (Microsoft Edge Neural TTS — `en-US-GuyNeural`)
- Detailed mathematics: backpropagation, evaluation formulas, risk metrics
- Sector-specific applications across Government, Healthcare, and Oil & Gas
- Benchmark results with specific, cited performance numbers

---

## Project Structure

```
.
├── remotion/                   # Remotion video compositions
│   ├── index.jsx               # Remotion entry point
│   ├── Root.jsx                # Registers all compositions
│   ├── NeuralNet.jsx           # Module 1 — Neural Networks (12 scenes)
│   ├── MLVideo.jsx             # Module 2 — Machine Learning (12 scenes)
│   ├── MLTrading.jsx           # Module 3 — ML in Trading (12 scenes)
│   └── MLResource.jsx          # Static resource composition
│
├── website/                    # Static web app (served via npx serve)
│   ├── index.html              # Course home page
│   ├── neural-networks.html    # Module 1 lesson page
│   ├── machine-learning.html   # Module 2 lesson page
│   ├── ml-trading.html         # Module 3 lesson page
│   ├── style.css               # Shared dark-mode stylesheet
│   ├── images/
│   │   └── steve.jpg           # Instructor photo
│   └── videos/                 # Rendered MP4 outputs (H.264, 1280×720)
│       ├── neural-network.mp4
│       ├── machine-learning.mp4
│       └── ml-trading.mp4
│
├── public/                     # Remotion public assets
│   ├── audio/                  # 36 narration MP3 clips (en-US-GuyNeural)
│   │   ├── nn-01.mp3 … nn-12.mp3
│   │   ├── ml-01.mp3 … ml-12.mp3
│   │   └── trade-01.mp3 … trade-12.mp3
│   └── images/
│       └── steve.jpg
│
├── gen-audio-guy.js            # Generates original 21 narration clips via msedge-tts
├── gen-audio-new.js            # Generates 15 extended narration clips
├── measure-audio.js            # Measures MP3 durations in frames at 30fps
├── remotion.config.js          # Remotion configuration
└── package.json
```

---

## Video Scene Breakdown

### Module 1 — Neural Networks (`NeuralNet.jsx`)

| Scene | Topic |
|-------|-------|
| 1 | Title / Introduction |
| 2 | Single Neuron — weighted sum, activation |
| 3 | Network Architecture — layers, depth, width |
| 4 | Forward Pass — matrix operations, GPU inference |
| 5 | Training — backpropagation, gradient descent |
| 6 | Applications — vision, NLP, voice, science |
| 7 | Summary / Outro |
| 8 | **Backpropagation Mathematics** — chain rule, weight update, cross-entropy, softmax |
| 9 | **Government Applications** — NSA signals intelligence, IRS fraud (94%), CBP cargo scanning |
| 10 | **Healthcare Applications** — DeepMind retinal (94%), ICU sepsis (6 hr), Stanford skin cancer (91%) |
| 11 | **Oil & Gas Applications** — seismic (+30%), equipment failure (72 hr), refinery (−15% energy) |
| 12 | **Benchmark Results** — ResNet-50 76%, GPT-4 90th %ile bar exam, 10× drug discovery |

### Module 2 — Machine Learning (`MLVideo.jsx`)

| Scene | Topic |
|-------|-------|
| 1 | Title / Introduction |
| 2 | What is Machine Learning? |
| 3 | Supervised · Unsupervised · Reinforcement Learning |
| 4 | ML Workflow — collect → preprocess → train → evaluate → deploy |
| 5 | Common Algorithms — regression, trees, SVM, K-Means, neural nets |
| 6 | Real-World Applications |
| 7 | Summary / Outro |
| 8 | **Evaluation Mathematics** — Accuracy, F1, AUC-ROC, RMSE |
| 9 | **Government Applications** — SEC insider trading, DoD drones, FEMA disaster response |
| 10 | **Healthcare Applications** — readmission 80% AUC, clinical trial matching, radiology −30% |
| 11 | **Oil & Gas Applications** — XGBoost reservoir MAE <5%, SVM lithology, NLP maintenance |
| 12 | **Industry Impact** — $13T McKinsey, −50% downtime, 99% fraud blocked, ≥91% medical imaging |

### Module 3 — ML in Trading (`MLTrading.jsx`)

| Scene | Topic |
|-------|-------|
| 1 | Title / Introduction |
| 2 | Animated S&P 500 Chart — 120-session price history with MA crossover signals |
| 3 | Feature Engineering — OHLCV, RSI, Bollinger Bands, MACD |
| 4 | Direction Classification — Random Forest, confusion matrix, 63.4% accuracy |
| 5 | Magnitude Regression — ±1.4% prediction band, MAE 0.74%, R² 0.41 |
| 6 | LSTM Architecture — 2-layer, 128 units, 20-day lookback |
| 7 | Backtesting Results — 18.3% annual return, Sharpe 1.47, −7.4% drawdown |
| 8 | **Quantitative Risk Mathematics** — Sharpe ratio, VaR, Max Drawdown, Calmar ratio |
| 9 | **Government & Regulatory** — SEC MIDAS (100B events/day), FINRA GCN, Fed stress-testing |
| 10 | **Healthcare & Pharma Trading** — FDA approval 72% accuracy, clinical pipeline sentiment |
| 11 | **Energy & Commodity Trading** — crude satellite forecasting, RL nat gas (Sharpe >2.0) |
| 12 | **Portfolio Results** — 58% direction, 14% annual return, Sharpe 1.8, −15% max drawdown |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Video rendering | [Remotion](https://www.remotion.dev/) 4.x — React-based programmatic video |
| UI framework | React 19, inline JSX styles |
| Animations | Remotion `spring()`, `interpolate()` |
| Charts | Hand-coded SVG with seeded PRNG data |
| Audio (TTS) | [msedge-tts](https://www.npmjs.com/package/msedge-tts) — `en-US-GuyNeural` neural voice |
| Audio measurement | ffmpeg via `@ffmpeg-installer/ffmpeg` |
| Web app | Vanilla HTML5 / CSS3 — no framework |
| Dev server | `npx serve` static file server |
| Video codec | H.264 (libx264), 1280×720, 30fps |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
npm install
```

### Regenerate Audio (optional)

The MP3 narration clips are pre-generated and committed. To regenerate:

```bash
# Original 21 clips (nn-01..07, ml-01..07, trade-01..07)
node gen-audio-guy.js

# Extended 15 clips (nn-08..12, ml-08..12, trade-08..12)
node gen-audio-new.js

# Measure frame durations at 30fps
node measure-audio.js
```

> **Note:** Requires internet access for Microsoft Edge Neural TTS API.

### Render Videos

```bash
# All three compositions (renders to website/videos/)
NODE_OPTIONS="--max-old-space-size=4096" npx remotion render remotion/index.jsx NeuralNetwork --output website/videos/neural-network.mp4
NODE_OPTIONS="--max-old-space-size=4096" npx remotion render remotion/index.jsx MachineLearning --output website/videos/machine-learning.mp4
NODE_OPTIONS="--max-old-space-size=4096" npx remotion render remotion/index.jsx MLTrading --output website/videos/ml-trading.mp4
```

> The `--max-old-space-size=4096` flag is required to prevent out-of-memory errors during rendering.

### Open in Remotion Studio (live preview)

```bash
npm run remotion
# Opens http://localhost:3000
```

### Serve the Website

```bash
cd website
npx serve -p 8080
# Opens http://localhost:8080
```

---

## Audio Clip Timing Reference

### Neural Networks (30fps)

| Clip | Start | Duration | Ends | Topic |
|------|-------|----------|------|-------|
| nn-01 | 60 | 277 | 337 | Introduction |
| nn-02 | 367 | 274 | 641 | Single neuron |
| nn-03 | 671 | 338 | 1009 | Network architecture |
| nn-04 | 1039 | 290 | 1329 | Forward pass |
| nn-05 | 1359 | 295 | 1654 | Training / backprop |
| nn-06 | 1684 | 300 | 1984 | Applications |
| nn-07 | 2014 | 279 | 2293 | Outro |
| nn-08 | 2323 | 722 | 3045 | Backprop mathematics |
| nn-09 | 3075 | 853 | 3928 | Government applications |
| nn-10 | 3958 | 919 | 4877 | Healthcare applications |
| nn-11 | 4907 | 945 | 5852 | Oil & Gas applications |
| nn-12 | 5882 | 940 | 6822 | Benchmark results |

### Machine Learning (30fps)

| Clip | Start | Duration | Ends | Topic |
|------|-------|----------|------|-------|
| ml-01 | 0 | 273 | 273 | Introduction |
| ml-02 | 303 | 273 | 576 | What is ML? |
| ml-03 | 606 | 431 | 1037 | Types of learning |
| ml-04 | 1067 | 275 | 1342 | ML workflow |
| ml-05 | 1372 | 329 | 1701 | Algorithms |
| ml-06 | 1731 | 315 | 2046 | Applications |
| ml-07 | 2076 | 277 | 2353 | Outro |
| ml-08 | 2383 | 853 | 3236 | Evaluation mathematics |
| ml-09 | 3266 | 893 | 4159 | Government applications |
| ml-10 | 4189 | 940 | 5129 | Healthcare applications |
| ml-11 | 5159 | 945 | 6104 | Oil & Gas applications |
| ml-12 | 6134 | 1030 | 7164 | Industry impact |

### ML in Trading (30fps)

| Clip | Start | Duration | Ends | Topic |
|------|-------|----------|------|-------|
| trade-01 | 0 | 310 | 310 | Introduction |
| trade-02 | 340 | 267 | 607 | S&P 500 data |
| trade-03 | 637 | 309 | 946 | Feature engineering |
| trade-04 | 976 | 284 | 1260 | Direction classification |
| trade-05 | 1290 | 347 | 1637 | Magnitude regression |
| trade-06 | 1667 | 312 | 1979 | LSTM architecture |
| trade-07 | 2009 | 315 | 2324 | Backtesting results |
| trade-08 | 2354 | 932 | 3286 | Risk mathematics |
| trade-09 | 3316 | 935 | 4251 | Government & regulatory |
| trade-10 | 4281 | 995 | 5276 | Healthcare & pharma trading |
| trade-11 | 5306 | 997 | 6303 | Energy & commodity trading |
| trade-12 | 6333 | 1058 | 7391 | Portfolio results |

---

## Branding

All videos and web pages carry the **Artificial Intelligence Solutions, Inc.** brand:

- **Videos**: Persistent bottom-right pill overlay with instructor photo and company name; top-left org name watermark
- **Website**: Navigation logo with instructor photo and company name; footer with photo and copyright

---

## License

© 2026 Artificial Intelligence Solutions, Inc. — All rights reserved.
