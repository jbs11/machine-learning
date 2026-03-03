import { AbsoluteFill, Freeze } from "remotion";

export function MLResource() {
  return (
    <AbsoluteFill style={{ background: "#020617" }}>
      <Freeze frame={0}>
        <AbsoluteFill>
          <iframe
            src="https://www.youtube.com/embed/aircAruvnKk?autoplay=1"
            style={{ width: "100%", height: "100%", border: "none" }}
            allow="autoplay; fullscreen"
            title="3Blue1Brown — But what is a Neural Network? (Deep Learning Ch.1)"
          />
        </AbsoluteFill>
      </Freeze>
    </AbsoluteFill>
  );
}
