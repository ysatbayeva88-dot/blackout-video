import React from "react";
import { Audio } from "@remotion/media";
import "../fonts";
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Captions } from "./Captions";
import { Cockpit } from "./Cockpit";
import { FPS, S, E, SCENES, duck, sceneStart, tween } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Camera: glides between per-scene focus points over the first 0.6 s of each scene. */
const camera = (t: number) => {
  let i = 0;
  while (i + 1 < SCENES.length && t >= sceneStart(i + 1)) i++;
  const prev = SCENES[Math.max(0, i - 1)].focus;
  const cur = SCENES[i].focus;
  const k = interpolate(t, [sceneStart(i), sceneStart(i) + 0.6], [0, 1], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const z = prev.zoom + (cur.zoom - prev.zoom) * k;
  const fx = prev.x + (cur.x - prev.x) * k;
  const fy = prev.y + (cur.y - prev.y) * k;
  // keep the cockpit covering the whole frame
  const tx = Math.min(0, Math.max(1080 - 1080 * z, 540 - fx * z));
  const ty = Math.min(0, Math.max(1920 - 1920 * z, 960 - fy * z));
  return { z, tx, ty };
};

export const PlaneVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const touch = S(32);

  const cam = camera(t);
  // shake: turbulence during the gust, a hard jolt at touchdown
  const gust = t > S(23) && t < E(26) ? 6 : 0;
  const jolt = interpolate(t, [touch, touch + 0.05, touch + 0.6], [0, 26, 0], clamp);
  const amp = gust + jolt;
  const shakeX = Math.sin(t * 47) * amp;
  const shakeY = Math.cos(t * 39) * amp;

  // flash on every scene change (synced with the whoosh) and a big one on touchdown
  const flash = Math.max(
    ...SCENES.slice(1).map((_, j) => interpolate(t, [sceneStart(j + 1), sceneStart(j + 1) + 0.08, sceneStart(j + 1) + 0.35], [0, 0.22, 0], clamp)),
    interpolate(t, [touch, touch + 0.04, touch + 0.5], [0, 0.85, 0], clamp),
  );
  // red alarm wash in the gust scene
  const alarm = (t > S(24) && t < S(27) ? 0.18 : 0) * (0.5 + 0.5 * Math.sin(t * 14));
  // final card darkens the cockpit
  const outro = tween(t, [S(38) - 0.3, S(38) + 0.3], [0, 0.6]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#07090d" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          translate: `${cam.tx + shakeX}px ${cam.ty + shakeY}px`,
          scale: String(cam.z),
        }}
      >
        <Cockpit t={t} />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#ff2d2d", opacity: alarm }} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: outro }} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
      <Captions t={t} />

      {/* ===== Audio ===== */}
      <Audio src={staticFile("voice.mp3")} />
      <Audio src={staticFile("music.mp3")} volume={(f) => 0.34 * duck(f / FPS)} />
      {SCENES.slice(1).map((_, j) => (
        <Sequence key={j} from={Math.round(sceneStart(j + 1) * FPS)} durationInFrames={20} layout="none">
          <Audio src={staticFile("whoosh.mp3")} volume={0.55} />
        </Sequence>
      ))}
      <Sequence from={Math.round(touch * FPS)} durationInFrames={30} layout="none">
        <Audio src={staticFile("thud.mp3")} volume={0.8} />
      </Sequence>
    </AbsoluteFill>
  );
};
