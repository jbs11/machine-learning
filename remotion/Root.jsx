import { Composition } from "remotion";
import { MLVideo, ML_DURATION } from "./MLVideo.jsx";
import { NeuralNet, NEURAL_DURATION } from "./NeuralNet.jsx";
import { MLResource } from "./MLResource.jsx";
import { MLTrading, TRADING_DURATION } from "./MLTrading.jsx";

export const RemotionRoot = () => (
  <>
    <Composition id="MachineLearning" component={MLVideo}    durationInFrames={ML_DURATION}      fps={30} width={1280} height={720} />
    <Composition id="NeuralNetwork"   component={NeuralNet}  durationInFrames={NEURAL_DURATION}  fps={30} width={1280} height={720} />
    <Composition id="MLResource"      component={MLResource} durationInFrames={34200}            fps={30} width={1280} height={720} />
    <Composition id="MLTrading"       component={MLTrading}  durationInFrames={TRADING_DURATION} fps={30} width={1280} height={720} />
  </>
);
