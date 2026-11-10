import { Composition } from "remotion";
import { PlaneVideo } from "./plane/PlaneVideo";
import { FPS, TOTAL_FRAMES } from "./plane/timeline";
import { SimTest } from "./sim/SimTest";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Plane" component={PlaneVideo} width={1080} height={1920} fps={FPS} durationInFrames={TOTAL_FRAMES} />
      <Composition id="SimTest" component={SimTest} width={1080} height={1920} fps={30} durationInFrames={60} defaultProps={{ mode: "final" as const }} />
    </>
  );
};
