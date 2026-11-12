import React from "react";
import * as THREE from "three";
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../fonts";
import { Captions } from "../plane/Captions";
import { mulberry32 } from "../sim/rng";
import { CubeCard, DraftBadge, Frost, Label, Meter, OutroCard, Ruler, Thermo, Vignette, WaterFilter, WaterView } from "./Hud";
import {
  AirLines, Ant, BLADE_H, Bokeh, CRUMB, Cam, Crumb, Dome, Drop, Grass, Ground, H0, HF, Hero, Look, Pose, Puffs, RICE, Rain, Rice, Splash, TABLE_Y, Table,
  V, World, bladePoint,
} from "./Macro";
import { CUES, KEYWORDS, SEGMENTS, ease, meterAt, meterTrend, prog, s, scene, sceneAt, smooth, tw, w } from "./timeline";

const LP = V(13.4, 0, -1.0); // where he lifts the rice and stays afterwards
const facing = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(to.x - from.x, to.z - from.z);

const lerpColor = (a: string, b: string, k: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, k))).getHexString();
const SUNNY = { skyTop: "#8fc0ea", skyMid: "#e3ecd0", skyBottom: "#8db35c", fog: "#cfdcbf", sun: 1, hemi: 1 };
const RAINY = { skyTop: "#46525e", skyMid: "#7b8787", skyBottom: "#4f613c", fog: "#7f8c86", sun: 0.22, hemi: 0.7 };
const COLD = { skyTop: "#9cc4ec", skyMid: "#d3e2ee", skyBottom: "#7fa3a0", fog: "#bfd2e2", sun: 0.55, hemi: 0.9 };
const mixLook = (a: typeof SUNNY, b: typeof SUNNY, k: number, fogDensity: number): Look => ({
  skyTop: lerpColor(a.skyTop, b.skyTop, k),
  skyMid: lerpColor(a.fog, b.fog, k), // horizon = fog colour, so the ground fades into the sky without a line
  skyBottom: lerpColor(a.skyBottom, b.skyBottom, k),
  fog: lerpColor(a.fog, b.fog, k),
  fogDensity,
  sun: a.sun + (b.sun - a.sun) * k,
  hemi: a.hemi + (b.hemi - a.hemi) * k,
});

type HeroState = { pos: THREE.Vector3; yaw: number; pose: Pose; tilt?: number; wet?: number; visible: boolean };

export const AntVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const sc = sceneAt(t);
  const P = (n: string) => prog(n, t);
  const S = (n: string) => scene(n);

  // ------------------------------------------------------------ hero
  let hero: HeroState = { pos: H0.clone(), yaw: 0.6, pose: {}, visible: true };
  switch (sc.name) {
    case "hook":
    case "edge":
    case "tension":
    case "ant":
      hero = { ...hero, visible: false };
      break;
    case "intro":
      hero = { pos: V(-1.1, TABLE_Y, 0), yaw: Math.PI / 2 - 0.15, pose: { lookUp: -0.5 }, visible: true };
      break;
    case "land": {
      const st = S("land").start;
      const touch = st + 0.85;
      const y = t < touch ? 9 * Math.pow(1 - (t - st) / 0.85, 1.6) : 0;
      const crouch = t < touch ? 0 : tw(t, [touch, touch + 0.12, w(3, 2) + 0.2, w(3, 2) + 0.6], [0, 0.75, 0.75, 0]);
      hero = { pos: V(H0.x, y, H0.z), yaw: 0.69, pose: { spread: t < touch ? 1 : tw(t, [touch, touch + 0.25], [1, 0]), crouch }, visible: true };
      break;
    }
    case "air": {
      const k = P("air");
      hero = { pos: V(H0.x, 30 - 4 * k, H0.z), yaw: 0.5 + 0.5 * k, pose: { spread: 1, flail: 0.15 }, visible: true };
      break;
    }
    case "rain":
      hero = { pos: H0.clone(), yaw: 0.75, pose: { lookUp: tw(t, [S("rain").start, S("rain").start + 0.8], [0, 0.8]) }, visible: true };
      break;
    case "drop":
      hero = { pos: H0.clone(), yaw: 0.75, pose: { lookUp: 1, armsUp: tw(t, [CUES.impact - 1.2, CUES.impact - 0.3], [0, 0.55]), crouch: tw(t, [CUES.impact - 1, CUES.impact], [0, 0.3]) }, visible: true };
      break;
    case "impact": {
      const k = tw(t, [CUES.impact, CUES.impact + 0.35], [0, 1]);
      hero = { pos: V(H0.x - 0.2 * k, 0.5 * k, H0.z + 0.6 * k), yaw: 0.75, tilt: -1.45 * smooth(k), pose: { flail: 0.6 * k, spread: 0.5 * k }, visible: true };
      break;
    }
    case "trap": {
      const k = P("trap");
      hero = { pos: V(H0.x - 0.2, 0.5 * (1 - k), H0.z + 0.6), yaw: 0.75 + 0.4 * k, tilt: -1.45 * (1 - smooth(k)), pose: { flail: 0.7, crouch: 0.5 * k }, visible: true };
      break;
    }
    case "struggle": {
      const back = tw(t, [w(11, 4) - 0.1, w(11, 4) + 0.25], [0, 1]);
      const fwd = tw(t, [S("struggle").start, w(11, 1) + 0.3], [0, 1]) * (1 - back);
      hero = { pos: V(H0.x + 0.6 + 1.3 * fwd - 1.2 * back, 0, H0.z + 0.3), yaw: Math.PI / 2, pose: { push: 1 - back * 0.7, flail: back * 0.8, walk: t * 9, walkAmt: 0.6 * (1 - back) }, visible: true };
      break;
    }
    case "free": {
      const run = tw(t, [S("free").start, CUES.free - 0.05], [0, 1]);
      const out = ease(t, [CUES.free - 0.05, CUES.free + 0.45], [0, 1]);
      const p = V(H0.x - 0.6 + 2.6 * run, 0, H0.z + 0.3).lerp(HF, out);
      hero = { pos: p, yaw: Math.PI / 2 - out * 0.9, pose: { push: 1 - out, walk: t * 11, walkAmt: 0.8 * (1 - tw(t, [CUES.free + 0.4, CUES.free + 0.7], [0, 1])), crouch: out * 0.3 }, wet: out, visible: true };
      break;
    }
    case "film":
      hero = { pos: HF.clone(), yaw: 0.9, pose: { crouch: 0.3, shiver: 0.15, armsUp: 0 }, wet: tw(t, [S("film").start, S("film").end], [1, 0.85]), visible: true };
      break;
    case "strong": {
      const k = tw(t, [S("strong").start + 0.2, S("strong").start + 0.8], [0, 1]);
      hero = { pos: HF.clone(), yaw: facing(HF, V(19, 0, 6)), pose: { flex: k, crouch: 0.3 * (1 - k) }, wet: 0.85 * (1 - k), visible: true };
      break;
    }
    case "cube":
      hero = { pos: HF.clone(), yaw: facing(HF, V(19, 0, 6)), pose: { flex: 1 }, visible: true };
      break;
    case "lift": {
      const walkK = ease(t, [S("lift").start, S("lift").start + 1.2], [0, 1]);
      const up = ease(t, [CUES.lift - 0.5, CUES.lift + 0.3], [0, 1]);
      hero = {
        pos: HF.clone().lerp(LP, walkK),
        yaw: facing(HF, LP) * (1 - up) + facing(LP, V(20, 0, 7)) * up,
        pose: { walk: t * 10, walkAmt: walkK > 0 && walkK < 1 ? 1 : 0, crouch: tw(t, [CUES.lift - 1.0, CUES.lift - 0.5, CUES.lift + 0.1], [0, 0.8, 0]), armsUp: up },
        visible: true,
      };
      break;
    }
    case "cold":
      hero = { pos: LP.clone(), yaw: facing(LP, V(20, 0, 7)), pose: { hug: tw(t, [S("cold").start, S("cold").start + 0.6], [0, 1]), shiver: 1, crouch: 0.25 }, visible: true };
      break;
    default:
      hero = { pos: LP.clone(), yaw: facing(LP, sc.name === "world" ? V(20, 0, 7) : V(BLADE_H * 0 + 2, 0, 14)), pose: { lookUp: sc.name === "world" ? 0.5 : 0.7 }, visible: true };
  }

  // rice: on the ground until he lifts it, overhead while carrying, then dropped beside him
  const riceUp = sc.name === "lift" && t > CUES.lift - 0.2;
  const riceLift = tw(t, [CUES.lift - 0.4, CUES.lift + 0.3], [0, 1]);
  const ricePos = riceUp ? RICE.clone().lerp(hero.pos.clone().add(V(0, 3.0 + 0.6 * riceLift, 0)), riceLift) : t > S("lift").end ? V(LP.x + 1.5, 1.0, LP.z + 3.2) : V(RICE.x, 1.0, RICE.z);
  const riceRot: [number, number, number] = riceUp ? [0, hero.yaw + Math.PI / 2, 0] : [0, 0.7, 0];

  // ------------------------------------------------------------ camera
  const k = P(sc.name);
  const hp = hero.pos;
  const sway = (a: number) => V(Math.sin(t * 1.3) * a, Math.sin(t * 1.7 + 1) * a * 0.6, 0);
  let cam: Cam;
  switch (sc.name) {
    case "hook":
      cam = { pos: V(2, 2.2, 6 - 2 * k).add(sway(0.08)), look: V(-12, 7 + 3 * k, -28), fov: 62, focus: 30 };
      break;
    case "intro": {
      // from out in the air beyond the edge: Asnost on the very edge, the drop to the lawn beside him
      cam = { pos: V(4.5 + 0.8 * k, TABLE_Y + 1.4 - 0.4 * k, 7.5 - 0.8 * k), look: V(-2.0, TABLE_Y + 0.2, 0), fov: 46, focus: 9.5 };
      break;
    }
    case "edge": {
      const step = w(2, 2);
      const fall = ease(t, [step, S("edge").end], [0, 1]);
      const y = TABLE_Y + 2.6 - (TABLE_Y - 12) * fall * fall;
      const lookDown = tw(t, [S("edge").start, step], [0, 1]);
      const look = V(40 - 30 * lookDown - 8 * fall, TABLE_Y - 30 - 740 * lookDown, 2 * fall);
      cam = { pos: V(1.6 + 6 * fall, y, 0), look, fov: 72, roll: fall * 0.6, focus: 600 };
      break;
    }
    case "land":
      cam = { pos: V(16, 3.2, 12), look: V(H0.x, 2.2 + Math.max(0, hp.y * 0.5), 0), fov: 40 };
      break;
    case "air":
      cam = { pos: V(H0.x + 7, hp.y + 2.5, 8.5), look: V(H0.x, hp.y + 1.2, 0), fov: 44 };
      break;
    case "rain":
      cam = { pos: V(24 - 3 * k, 7, 21 - 3 * k), look: V(H0.x, 3.5, 0), fov: 50 };
      break;
    case "drop": {
      const dropY = tw(t, [S("drop").start, CUES.impact], [48, 2.2]);
      const u = Math.min(1, dropY / 30);
      cam = { pos: V(H0.x + 8 + 8 * u, 2.2 + 3 * u, 11 + 9 * u), look: V(H0.x, Math.max(2, Math.min(16, (dropY + 1.5) * 0.56)), 0), fov: 52 };
      break;
    }
    case "impact":
      cam = { pos: V(16, 4.5, 15), look: V(H0.x, 2, 0), fov: 50 };
      break;
    case "trap":
      cam = { pos: V(13.5 - 1.5 * k, 3.6, 11 - 1.5 * k), look: V(H0.x, 1.5, 0.3), fov: 44 };
      break;
    case "tension":
      cam = { pos: V(H0.x - 0.4, 1.6, 0.4), look: V(H0.x + 8, 2.5 + 5 * smooth(k), 2), fov: 78, focus: 8 };
      break;
    case "struggle":
      cam = { pos: V(H0.x + 7.5, 2.4, 6.5).add(sway(0.1)), look: V(H0.x + 1.8, 1.7, 0.2), fov: 44 };
      break;
    case "free":
      cam = { pos: V(H0.x + 9, 2.6, 8.5), look: V(H0.x + 3.2, 1.6, 0.8), fov: 46 };
      break;
    case "film":
      cam = { pos: V(HF.x + 4.5 - 0.8 * k, 2.4, HF.z + 6 - 1 * k), look: V(HF.x, 1.6, HF.z), fov: 42 };
      break;
    case "strong":
    case "cube":
      cam = { pos: V(HF.x + 6.5, 0.7, HF.z + 4.5), look: V(HF.x + 0.5, 2.1, HF.z - 0.5), fov: 48 };
      break;
    case "lift":
      cam = { pos: V(LP.x + 6.5, 2.2 + 0.6 * k, LP.z + 7.5), look: V(LP.x - 0.3, 2.6, LP.z - 0.5), fov: 48 };
      break;
    case "cold":
      cam = { pos: V(LP.x + 5 - 1.5 * smooth(k), 2.3, LP.z + 6 - 1.8 * smooth(k)), look: V(LP.x, 1.7, LP.z), fov: 42 };
      break;
    case "world": {
      const toCrumb = ease(t, [w(18, 3) - 0.35, w(18, 3) + 0.25], [0, 1]);
      const up = { pos: V(LP.x + 3, 0.9, LP.z + 5), look: V(LP.x - 25, 70 - 10 * k, LP.z - 40), fov: 74 };
      const cr = { pos: V(LP.x + 4.5, 3.2, LP.z + 7), look: V((CRUMB.x + LP.x) / 2, 2, (CRUMB.z + LP.z) / 2), fov: 50 };
      cam = { pos: up.pos.clone().lerp(cr.pos, toCrumb), look: up.look.clone().lerp(cr.look, toCrumb), fov: up.fov + (cr.fov - up.fov) * toCrumb, focus: toCrumb > 0.5 ? 9 : 30 };
      break;
    }
    case "ant":
      cam = { pos: V(LP.x, 1.0, LP.z).add(sway(0.05)), look: V(antX(t) - 1.5, 1.8, -6.4), fov: 72 };
      break;
    case "final":
    case "outro":
    default: {
      const kk = smooth(tw(t, [S("final").start, CUES.duration], [0, 1]));
      const d = bladePoint(0.5);
      cam = { pos: V(d.x + 14 - 7 * kk, d.y + 1 - 2 * kk, d.z + 14 - 7 * kk), look: d, fov: 40 };
    }
  }
  const focus = cam.focus ?? cam.pos.distanceTo(cam.look);

  // ------------------------------------------------------------ look (sky, fog, light)
  const rainK = tw(t, [S("rain").start, S("rain").start + 1.0, S("trap").end, S("film").end], [0, 1, 1, 0]);
  const coldK = tw(t, [S("cold").start, S("cold").start + 0.6, S("cold").end - 0.3, S("cold").end + 0.4], [0, 1, 1, 0]);
  const high = sc.name === "intro" || sc.name === "edge";
  const fogDensity = high ? 0.00028 : sc.name === "air" ? 0.0025 : 0.0045;
  const look = coldK > 0 ? mixLook(SUNNY, COLD, coldK, fogDensity) : mixLook(SUNNY, RAINY, rainK, fogDensity);
  const shadowAt = sc.name === "edge" ? V(40, 0, 0) : sc.view === "pov" ? cam.pos.clone().add(cam.look.clone().sub(cam.pos).normalize().multiplyScalar(Math.min(focus, 20))).setY(0) : cam.look.clone();
  const shadowBox = sc.name === "edge" ? 300 : sc.name === "rain" || sc.name === "world" ? 60 : 22;

  // ------------------------------------------------------------ props in the scene
  const showTable = high || sc.name === "land" || sc.name === "air";
  const dropY = tw(t, [S("drop").start, CUES.impact], [48, 2.2]);
  const bigDrop = sc.name === "drop" ? V(H0.x, dropY, H0.z) : null;
  const hookDrop = sc.name === "hook" && t < 0.55 ? V(-8, 2.6 + 50 * (1 - t / 0.55), -24) : null;
  const domeOn = t >= CUES.impact + 0.12;
  const domeGrow = tw(t, [CUES.impact + 0.12, CUES.impact + 0.35, CUES.impact + 0.5], [0, 1.08, 1]);
  let bulge = 0;
  if (sc.name === "struggle") bulge = tw(t, [S("struggle").start, w(11, 1) + 0.3, w(11, 4) - 0.1, w(11, 4) + 0.2], [0, 1.5, 1.6, -0.3]);
  if (sc.name === "free") bulge = tw(t, [S("free").start, CUES.free - 0.05, CUES.free + 0.05], [0, 2.4, 0]);
  const domeWobble = 0.3 + 1.2 * tw(t, [CUES.free, CUES.free + 0.1, CUES.free + 1.5], [0, 1, 0]) + (sc.name === "trap" ? 0.6 : 0);
  const domeT = t;

  // ant: background walker in the hook, close pass in the ant scene
  let ant: { pos: THREE.Vector3; yaw: number; walk: number; turn: number } | null = null;
  if (sc.name === "hook") ant = { pos: V(-22 + 2.2 * t, 0, -55), yaw: Math.PI / 2, walk: (2.2 * t) / 1.1, turn: 0 };
  if (sc.name === "ant") ant = { pos: V(antX(t), 0, -6.4), yaw: -Math.PI / 2 - 0.12, walk: (22 - antX(t)) / 1.1, turn: tw(t, [CUES.stomp + 0.9, CUES.stomp + 1.3, CUES.stomp + 1.9, CUES.stomp + 2.3], [0, 0.45, 0.45, 0]) };

  // particles
  const puffs: { pos: THREE.Vector3; size: number; opacity: number; color: string }[] = [];
  if (sc.name === "cold") {
    const r = mulberry32(4);
    for (let i = 0; i < 26; i++) {
      const ph = (t * 0.6 + r()) % 1;
      const a = r() * Math.PI * 2;
      const y0 = 0.5 + r() * 2.4;
      const out = 0.4 + ph * 2.6;
      puffs.push({ pos: hp.clone().add(V(Math.cos(a) * out, y0 + ph * 1.8, Math.sin(a) * out)), size: 0.8 + ph * 1.6, opacity: 0.75 * Math.sin(ph * Math.PI) * coldK, color: "#ff7a2a" });
    }
  }
  const drips: THREE.Vector3[] = [];
  if (sc.name === "film" || sc.name === "free") {
    const r = mulberry32(8);
    for (let i = 0; i < 8; i++) {
      const ph = (t * 1.4 + r()) % 1;
      drips.push(hp.clone().add(V((r() - 0.5) * 1.2, 2.2 * (1 - ph * ph), (r() - 0.5) * 1.2)));
    }
  }

  // ------------------------------------------------------------ shakes, flashes, overlays
  const impactShake = tw(t, [CUES.impact, CUES.impact + 0.05, CUES.impact + 0.8], [0, 30, 0]);
  const hookShake = tw(t, [0.55, 0.6, 1.2], [0, 22, 0]);
  const stompShake = sc.name === "ant" && t > CUES.stomp - 0.1 ? 7 * Math.pow(Math.abs(Math.cos(((t - CUES.stomp + 0.05) / 0.37) * Math.PI)), 10) : 0;
  const struggleShake = sc.name === "struggle" ? 3 : 0;
  const amp = impactShake + hookShake + stompShake + struggleShake + (sc.name === "free" ? tw(t, [CUES.free, CUES.free + 0.05, CUES.free + 0.5], [0, 14, 0]) : 0);
  const shake: [number, number] = [Math.sin(t * 43) * amp, Math.cos(t * 37) * amp];
  const cutFlash = Math.max(...CUES.scenes.slice(1).map((c) => tw(t, [c.start, c.start + 0.05, c.start + 0.28], [0, 0.2, 0])));
  const hitFlash = Math.max(tw(t, [CUES.impact, CUES.impact + 0.04, CUES.impact + 0.4], [0, 0.7, 0]), tw(t, [0.55, 0.59, 0.9], [0, 0.4, 0]), tw(t, [CUES.free, CUES.free + 0.04, CUES.free + 0.35], [0, 0.4, 0]));
  const water = sc.name === "tension" ? 1 : 0;
  const redPulse = sc.name === "struggle" || (sc.name === "free" && t < CUES.free) ? 0.3 + 0.2 * Math.sin(t * 8) : sc.name === "tension" ? 0.15 : 0;
  const dof = sc.name === "edge" ? 0.4 : sc.name === "cube" ? 1.6 : 1;
  const nearBlur = sc.name === "cube" ? 10 : 0;

  // labels
  const lab = (a: number, b: number) => tw(t, [a, a + 0.25, b - 0.2, b], [0, 1, 1, 0]);
  const meterK = tw(t, [0.3, 0.7], [0, 1]) * tw(t, [s(21) - 0.2, s(21) + 0.3], [1, 0]);
  const rulerK = tw(t, [w(1, 2), w(1, 2) + 0.4], [0, 1]) * tw(t, [s(21) - 0.2, s(21) + 0.3], [1, 0]);
  const outro = tw(t, [s(21) - 0.1, s(21) + 0.5], [0, 1]);

  // ------------------------------------------------------------ 3D content (rendered in 3 depth layers)
  const content = (
    <>
      <Ground />
      <Grass t={t} wind={rainK > 0.3 ? 2.5 : coldK > 0.3 ? 2 : 1} />
      {showTable && <Table />}
      <Crumb pos={CRUMB} />
      <Rice pos={ricePos} rot={riceRot} />
      <Bokeh k={1 - rainK * 0.6} center={H0} />
      {hero.visible && (
        <group position={hero.pos} rotation={[hero.tilt ?? 0, hero.yaw, 0, "YXZ"]}>
          <Hero t={t} pose={hero.pose} wet={hero.wet ?? 0} />
        </group>
      )}
      {domeOn && <Dome pos={H0} r={4.4} h={3.7} t={domeT} bulgeDir={V(1, 0, 0.15)} bulge={bulge} wobble={domeWobble} grow={domeGrow} />}
      {t > S("final").start - 0.01 && <Drop pos={bladePoint(0.5).add(V(0.4, -1.6, 0))} r={1.7} t={t * 0.3} wobble={0.2} />}
      {bigDrop && <Drop pos={bigDrop} r={2.3} t={t} />}
      {hookDrop && <Drop pos={hookDrop} r={2.6} t={t} />}
      <Splash at={V(-8, 0, -24)} k={t - 0.55} size={1.6} seed={5} />
      <Splash at={H0} k={t - CUES.impact} size={1.5} seed={9} />
      <Splash at={V(H0.x + 3.8, 0, H0.z + 0.6)} k={t - CUES.free} size={0.35} seed={12} />
      {rainK > 0 && t < CUES.rain[1] && <Rain t={t} t0={CUES.rain[0]} k={Math.min(1, rainK * 1.5)} center={H0} />}
      {drips.map((p, i) => (
        <Drop key={i} pos={p} r={0.22} t={t + i} />
      ))}
      {sc.name === "air" && <AirLines t={t} center={hp.clone().add(V(0, 1.5, 0))} k={1} />}
      {ant && (
        <group position={ant.pos} rotation={[0, ant.yaw, 0]}>
          <Ant walk={ant.walk} t={t} headTurn={ant.turn} />
        </group>
      )}
      <Puffs items={puffs} />
    </>
  );

  const layers: { near: number; far: number; blur: number; bg: boolean }[] = [
    // layers overlap so each blurred layer's soft (transparent) near edge sits under the sharper layer above it
    { near: focus * 2.8, far: 40000, blur: 9 * dof, bg: true },
    { near: focus * 1.3, far: focus * 4, blur: 3 * dof, bg: false },
    { near: 0.04, far: focus * 1.7, blur: nearBlur, bg: false },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <WaterFilter t={t} amount={water ? 26 : 0} />
      <AbsoluteFill style={{ translate: `${shake[0]}px ${shake[1]}px`, scale: amp > 0 ? "1.04" : "1", filter: water ? "url(#waterwobble)" : undefined }}>
        {layers.map((L, i) => (
          <AbsoluteFill key={i} style={{ filter: L.blur > 0.2 ? `blur(${L.blur}px)` : undefined }}>
            <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, alpha: true, toneMappingExposure: 1.15 }}>
              <World cam={cam} near={L.near} far={L.far} background={L.bg} look={look} shadowAt={shadowAt} shadowBox={shadowBox}>
                {content}
              </World>
            </ThreeCanvas>
          </AbsoluteFill>
        ))}
        <WaterView k={water} t={t} />
      </AbsoluteFill>
      <Frost k={coldK * 0.9} />
      <Vignette k={redPulse} color="200,0,0" />
      <Vignette k={0.42} />
      <Thermo k={coldK} level={tw(t, [S("cold").start + 0.5, S("cold").end - 0.3], [0.85, 0.12])} />
      <CubeCard k={tw(t, [S("cube").start, S("cube").start + 0.3, S("cube").end - 0.25, S("cube").end], [0, 1, 1, 0])} t0={S("cube").start} t={t} result={tw(t, [w(15, 9) - 0.1, w(15, 9) + 0.3], [0, 1])} />
      <Label text={"Ты: ~2 м/с\nЧеловек: ~200 км/ч"} k={lab(S("air").start + 0.4, S("air").end)} />
      <Label text={"Капля: 4–30 мг\nТы: 0,35 мг"} k={lab(s(6), s(7))} />
      <Label text="≈ Тонна воды" k={lab(w(7, 3), CUES.impact)} color="#ff5a3c" />
      <Label text="Поверхностное натяжение" k={lab(w(10, 1), S("tension").end)} color="#7fe3ff" />
      <Label text={"Рисинка ≈ 25 мг\n= ×70 тебя"} k={lab(s(16) + 0.3, S("lift").end)} />
      <Label text={"Травинка ≈ 60 м\nКрошка ≈ 3 м"} k={lab(s(18) + 0.3, S("world").end)} />
      <Meter value={meterAt(t)} trend={meterTrend(t)} k={meterK} t={t} blink />
      <Ruler k={rulerK} />
      {CUES.draft && <DraftBadge />}
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: outro * 0.55 }} />
      <OutroCard k={outro} t={t} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: Math.max(cutFlash, hitFlash) }} />
      <Captions t={t} segments={SEGMENTS} keywords={KEYWORDS} />
      <Audio src={staticFile("ant_mix.mp3")} />
    </AbsoluteFill>
  );
};

/** Ant body x in the close pass: walks right-to-left in front of the camera (slow motion). */
function antX(t: number) {
  return 22 - 3.0 * Math.max(0, t - (CUES.stomp - 0.3));
}
