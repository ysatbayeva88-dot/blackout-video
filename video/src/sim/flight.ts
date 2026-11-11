import * as THREE from "three";
import { Easing, interpolate } from "remotion";
import timings from "../timings.json";
import cuesJson from "./cues.json";
import { AIM_Z } from "./Airport";
import { GEAR_HEIGHT } from "./Airliner";

export type Seg = { id: number; speaker: string; text: string; start: number; end: number; words: { text: string; start: number; end: number }[] };
export const SEG = timings.segments as Seg[];
export const s = (i: number) => SEG[i].start;
export const e = (i: number) => SEG[i].end;
export const w = (i: number, k: number) => SEG[i].words[k].start;

export type Scene = { name: string; view: "cockpit" | "exterior" | "doorway"; start: number; end: number };
export const CUES = cuesJson as { duration: number; touch: number; scenes: Scene[] };
export const TOUCH = CUES.touch;
export const scene = (name: string) => CUES.scenes.find((x) => x.name === name)!;
export const sceneAt = (t: number) => CUES.scenes.find((x) => t >= x.start && t < x.end) ?? CUES.scenes[CUES.scenes.length - 1];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.45, 0, 0.25, 1);
export const tw = (t: number, at: number[], v: number[]) => interpolate(t, at, v, { ...clamp, easing: ease });
export const lin = (t: number, at: number[], v: number[]) => interpolate(t, at, v, clamp);
/** 0..1 inside [a, b] with soft edges. */
export const win = (t: number, a: number, b: number, f = 0.2) => interpolate(t, [a - f, a, b, b + f], [0, 1, 1, 0], clamp);

export type Pose = {
  pos: THREE.Vector3; // fuselage centre, world metres
  yaw: number; // deg, + = nose left
  pitch: number; // deg, + = nose up
  roll: number; // deg, + = right wing down
  wheelH: number; // wheel height above runway (approach)
  ias: number; // kt
  vs: number; // ft/min
};

const DIVE = scene("dive");
const ROLLOUT = 6.0;

/** Light turbulence everywhere, stronger in the gust. */
const turb = (t: number, amp: number) => (Math.sin(t * 2.3) * 0.6 + Math.sin(t * 5.1 + 1) * 0.3 + Math.sin(t * 11.7) * 0.1) * amp;

/** Aircraft trajectory. Story time is compressed: cruise -> dive through clouds -> approach -> landing. */
export const pose = (t: number): Pose => {
  const gust = win(t, s(19), e(20), 0.4);
  const roll = tw(t, [s(19), e(19), s(21), e(21)], [0, -20, -17, 0]) + turb(t * 1.7, 0.6 + gust * 3);
  if (t < DIVE.start) {
    return { pos: new THREE.Vector3(0, 10000, 60000 - 230 * t), yaw: turb(t * 0.3, 0.3), pitch: 2 + turb(t, 0.2), roll: turb(t, 0.5), wheelH: 9999, ias: 282, vs: 0 };
  }
  if (t < scene("airport").start) {
    const k = (t - DIVE.start) / (DIVE.end - DIVE.start);
    return {
      pos: new THREE.Vector3(0, tw(k, [0, 1], [7650, 6500]), 60000 - 230 * t),
      yaw: 0,
      pitch: tw(k, [0, 0.35], [2, -9]),
      roll: turb(t, 1.2),
      wheelH: 9999,
      ias: 290,
      vs: -3500,
    };
  }
  if (t < TOUCH) {
    const h = tw(t, [scene("airport").start, s(16), s(18), s(22), s(23), s(24), s(25), TOUCH], [600, 420, 250, 75, 30, 10, 5, 0]);
    const dist = 90 * (TOUCH - t);
    const flare = tw(t, [s(24), TOUCH - 0.2], [0, 1]);
    return {
      pos: new THREE.Vector3(tw(t, [s(19), e(20), s(22)], [0, -18, 0]), h + GEAR_HEIGHT, AIM_Z + dist),
      yaw: tw(t, [s(19), e(20), s(22)], [0, 3, 0]) + turb(t * 0.8, 0.4),
      pitch: -2.5 + flare * 7 + turb(t * 1.3, 0.3 + gust),
      roll: roll * (1 - flare * 0.8),
      wheelH: h,
      ias: tw(t, [scene("airport").start, s(16), TOUCH], [175, 145, 138]),
      vs: -700 - (1 - flare) * 200 + flare * 600,
    };
  }
  const tau = Math.min(t - TOUCH, ROLLOUT);
  const v0 = 70;
  const travel = v0 * tau - (v0 / (2 * ROLLOUT)) * tau * tau;
  const speed = v0 * (1 - tau / ROLLOUT);
  const compress = Math.min(1, (t - TOUCH) / 0.3);
  return {
    pos: new THREE.Vector3(0, GEAR_HEIGHT - compress * 0.25, AIM_Z - travel),
    yaw: 0,
    pitch: tw(t, [TOUCH, TOUCH + 1.4], [4.5, 0]) + Math.sin(t * 13) * 0.15 * (speed / v0),
    roll: Math.sin(t * 7) * 0.3 * (speed / v0),
    wheelH: 0,
    ias: (speed / 0.514),
    vs: 0,
  };
};

/** Body-frame offset -> world position for a pose. */
export const bodyToWorld = (p: Pose, off: [number, number, number]) => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((p.pitch * Math.PI) / 180, (p.yaw * Math.PI) / 180, (-p.roll * Math.PI) / 180, "YXZ"));
  return new THREE.Vector3(...off).applyQuaternion(q).add(p.pos);
};

export const poseQuat = (p: Pose) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler((p.pitch * Math.PI) / 180, (p.yaw * Math.PI) / 180, (-p.roll * Math.PI) / 180, "YXZ"));

/** Aircraft configuration over time. */
export const config = (t: number) => ({
  flaps: tw(t, [s(15) + 0.1, s(15) + 1.3], [0, 1]),
  gear: tw(t, [s(16), s(16) + 1.4], [0, 1]),
  reverse: tw(t, [s(27) - 0.1, s(27) + 0.5, s(27) + 3.2, s(27) + 4.2], [0, 1, 1, 0]),
  landingLights: t > s(14),
  compress: t > TOUCH ? Math.min(1, (t - TOUCH) / 0.3) : 0,
});
