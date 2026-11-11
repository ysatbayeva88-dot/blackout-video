import React from "react";
import * as THREE from "three";
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../fonts";
import { Captions } from "../plane/Captions";
import { AIM_Z } from "./Airport";
import { Airliner } from "./Airliner";
import { CockpitOverlay } from "./cockpit/CockpitOverlay";
import { cockpitFocus, cockpitState } from "./cockpitState";
import { Doorway } from "./Doorway";
import { ReverserSpray, TireSmoke } from "./Effects3D";
import { CUES, Pose, TOUCH, bodyToWorld, config, pose, poseQuat, s, scene, sceneAt, tw } from "./flight";
import { CameraState, World } from "./World";

const v3 = (v: THREE.Vector3) => [v.x, v.y, v.z] as [number, number, number];

/** Camera for each exterior shot. */
const exteriorCam = (name: string, t: number, p: Pose): CameraState => {
  const sc = scene(name);
  const k = (t - sc.start) / (sc.end - sc.start);
  switch (name) {
    case "orbit": {
      const a = ((-50 - 95 * tw(k, [0, 1], [0, 1])) * Math.PI) / 180; // front-left -> rear-left
      const r = 52 - 10 * k;
      const c = p.pos.clone().add(new THREE.Vector3(r * Math.sin(a), 6 + 4 * k, -r * Math.cos(a)));
      return { pos: v3(c), lookAt: v3(p.pos.clone().add(new THREE.Vector3(0, 0, -2))), yaw: 0, pitch: 0, roll: 0, hfov: 56 };
    }
    case "dive": {
      const c = p.pos.clone().add(new THREE.Vector3(22, 10 - 6 * k, 52));
      return { pos: v3(c), lookAt: v3(bodyToWorld(p, [0, -1, -6])), yaw: 0, pitch: 0, roll: 0, hfov: 58 };
    }
    case "airport": {
      const c = p.pos.clone().add(new THREE.Vector3(-58, 20, 110));
      const look = p.pos.clone().lerp(new THREE.Vector3(0, 0, AIM_Z - 600), 0.28);
      return { pos: v3(c), lookAt: v3(look), yaw: 0, pitch: 0, roll: 0, hfov: 64 };
    }
    case "flaps":
      return { pos: v3(bodyToWorld(p, [11.5, 3.4, 13.5])), lookAt: v3(bodyToWorld(p, [7.5, -1.4, 3.6])), yaw: 0, pitch: 0, roll: p.roll * 0.3, hfov: 54 };
    case "gear":
      return { pos: v3(bodyToWorld(p, [-8.5, -5.2, -5])), lookAt: v3(bodyToWorld(p, [-2.4, -3.0, 2])), yaw: 0, pitch: 0, roll: 0, hfov: 62 };
    case "touchdown":
    default: {
      const cam = new THREE.Vector3(-36, 2.3, AIM_Z - 75);
      const look = p.pos.clone().add(new THREE.Vector3(0, -1.2, -8));
      return { pos: v3(cam), lookAt: v3(look), yaw: 0, pitch: 0, roll: 0, hfov: tw(t, [sc.start, TOUCH + 0.6, sc.end], [36, 46, 62]) };
    }
  }
};

const cockpitCam = (t: number, p: Pose, centerY = 560): CameraState => {
  const eye = bodyToWorld(p, [-0.55, 1.05, -16.6]);
  const head = Math.sin(t * 0.9) * 0.4;
  return { pos: v3(eye), yaw: p.yaw + head * 0.5, pitch: p.pitch - 3 + head * 0.3, roll: p.roll, hfov: 58, centerY, centerX: 290 };
};

/** Cloud deck and haze for the current point of the story. */
const atmosphere = (t: number, camY: number) => {
  const cruise = t < scene("airport").start;
  const clouds = cruise ? { y: 7000, opacity: 1 } : { y: 1700, opacity: 0.7 };
  const inCloud = cruise ? Math.max(0, 1 - Math.abs(camY - 7050) / 260) : 0;
  return {
    clouds,
    fogDensity: cruise ? 0.00003 + inCloud * 0.004 : 0.00011,
    fogColor: inCloud > 0.05 ? "#d9d2d0" : "#c98a6a",
  };
};

export const PlaneSim: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const sc = sceneAt(t);
  const p = pose(t);
  const cfg = config(t);

  let cam: CameraState;
  if (sc.view === "cockpit") cam = cockpitCam(t, p);
  else if (sc.view === "doorway") cam = { ...cockpitCam(t, p, 660), pos: v3(bodyToWorld(p, [0, 1.3, -12.2])), hfov: 74, centerX: 540, pitch: p.pitch - 2 };
  else cam = exteriorCam(sc.name, t, p);
  const atm = atmosphere(t, cam.pos[1]);
  const showPlane = sc.view === "exterior";

  // cockpit punch-in, shake in the gust and at touchdown
  const focus = sc.view === "cockpit" ? cockpitFocus(t) : { x: 540, y: 960, z: 1 };
  const gust = t > s(19) && t < s(21) ? 5 : 0;
  const jolt = interpolate(t, [TOUCH, TOUCH + 0.05, TOUCH + 0.7], [0, 22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const amp = sc.view === "cockpit" ? gust + 1.2 : sc.name === "touchdown" ? jolt * 0.6 : sc.name === "dive" ? 3 : 0;
  const shake = [Math.sin(t * 41) * amp, Math.cos(t * 37) * amp] as [number, number];
  const z = focus.z;
  const tx = Math.min(0, Math.max(width - width * z, width / 2 - focus.x * z)) + shake[0];
  const ty = Math.min(0, Math.max(height - height * z, height / 2 - focus.y * z)) + shake[1];

  // flash on cuts
  const cut = Math.max(...CUES.scenes.slice(1).map((c) => interpolate(t, [c.start, c.start + 0.05, c.start + 0.3], [0, 0.25, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const touchFlash = interpolate(t, [TOUCH, TOUCH + 0.04, TOUCH + 0.4], [0, 0.35, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const alarm = sc.view === "cockpit" && t > s(19) && t < s(21) ? 0.14 * (0.5 + 0.5 * Math.sin(t * 12)) : 0;
  const outro = tw(t, [s(29) - 0.3, s(29) + 0.4], [0, 0.45]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transformOrigin: "0 0", translate: `${tx}px ${ty}px`, scale: String(z) }}>
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          gl={{ logarithmicDepthBuffer: true, antialias: true, toneMappingExposure: 1.35 }}
        >
          <World t={t} cam={cam} clouds={atm.clouds} fogDensity={atm.fogDensity} fogColor={atm.fogColor} shadowAt={showPlane ? p.pos : undefined}>
            {showPlane && (
              <group position={p.pos} quaternion={poseQuat(p)}>
                <Airliner t={t} flaps={cfg.flaps} gear={cfg.gear} reverse={cfg.reverse} compress={cfg.compress} landingLights={cfg.landingLights} />
              </group>
            )}
            {showPlane && <TireSmoke t={t} />}
            {showPlane && <ReverserSpray t={t} reverse={cfg.reverse} />}
          </World>
        </ThreeCanvas>
        {sc.view === "cockpit" && <CockpitOverlay s={{ ...cockpitState(t, p), shake: [0, 0] }} />}
        {sc.view === "doorway" && <Doorway k={(t - sc.start) / (sc.end - sc.start)} t={t} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#ff2d2d", opacity: alarm }} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: outro }} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: Math.max(cut, touchFlash) }} />
      <Captions t={t} />
      <Audio src={staticFile("plane_mix.mp3")} />
    </AbsoluteFill>
  );
};

export const SIM_DURATION_FRAMES = Math.ceil(CUES.duration * 30);
