import { Composition } from "remotion";
import { ReelsVideo } from "./ReelsVideo";
import { FPS, TOTAL_FRAMES, WIDTH, HEIGHT } from "./constants";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Reels"
        component={ReelsVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
