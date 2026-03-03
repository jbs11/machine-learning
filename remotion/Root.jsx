import { Composition } from "remotion";
import { MLVideo, ML_DURATION } from "./MLVideo.jsx";
import { NeuralNet, NEURAL_DURATION } from "./NeuralNet.jsx";
import { MLResource } from "./MLResource.jsx";
import { MLTrading, TRADING_DURATION } from "./MLTrading.jsx";
import { StockTrading, STOCK_DURATION } from "./StockTrading.jsx";
import { OptionsTrading, OPTIONS_DURATION } from "./OptionsTrading.jsx";
import { FuturesTrading, FUTURES_DURATION } from "./FuturesTrading.jsx";

export const RemotionRoot = () => (
  <>
    <Composition id="MachineLearning"  component={MLVideo}        durationInFrames={ML_DURATION}       fps={30} width={1280} height={720} />
    <Composition id="NeuralNetwork"    component={NeuralNet}      durationInFrames={NEURAL_DURATION}   fps={30} width={1280} height={720} />
    <Composition id="MLResource"       component={MLResource}     durationInFrames={34200}             fps={30} width={1280} height={720} />
    <Composition id="MLTrading"        component={MLTrading}      durationInFrames={TRADING_DURATION}  fps={30} width={1280} height={720} />
    <Composition id="StockTrading"     component={StockTrading}   durationInFrames={STOCK_DURATION}    fps={30} width={1280} height={720} />
    <Composition id="OptionsTrading"   component={OptionsTrading} durationInFrames={OPTIONS_DURATION}  fps={30} width={1280} height={720} />
    <Composition id="FuturesTrading"   component={FuturesTrading} durationInFrames={FUTURES_DURATION}  fps={30} width={1280} height={720} />
  </>
);
