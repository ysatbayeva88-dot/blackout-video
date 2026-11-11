import { Composition } from "remotion";
import { PlaneSim, SIM_DURATION_FRAMES } from "./sim/PlaneSim";
import { SimTest } from "./sim/SimTest";
import { BlizzardVideo } from "./blizzard/BlizzardVideo";
import { DURATION_FRAMES as BLIZZARD_FRAMES } from "./blizzard/timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Plane" component={PlaneSim} width={1080} height={1920} fps={30} durationInFrames={SIM_DURATION_FRAMES} />
      <Composition id="Blizzard" component={BlizzardVideo} width={1080} height={1920} fps={30} durationInFrames={BLIZZARD_FRAMES} />
      <Composition id="SimTest" component={SimTest} width={1080} height={1920} fps={30} durationInFrames={60} defaultProps={{ mode: "final" as const }} />
    </>
  );
};
