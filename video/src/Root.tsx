import { Composition } from "remotion";
import { PlaneVideo } from "./plane/PlaneVideo";
import { FPS, TOTAL_FRAMES } from "./plane/timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Plane"
      component={PlaneVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={TOTAL_FRAMES}
    />
  );
};
