import React from "react";
import * as THREE from "three";
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../fonts";
import { Captions } from "../plane/Captions";
import { mulberry32 } from "../sim/rng";
import { CAR, Car } from "./Car";
import { Bottle, Breath, Eyelids, Fists, GasWisps, Interior, Phone, SideWindow, SnowHand, TimerCard, TimerChip, Vignette } from "./Overlays";
import { Beam, Cam, Drift, Glow, Marker, Person, Puffs, RescueTruck, Snowfall, Spot, World } from "./SnowWorld";
import { CUES, KEYWORDS, SEGMENTS, buried, daylight, engineOn, prog, s, scene, sceneAt, storyClock, tw, w } from "./timeline";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const REST = V(5.4, 0, 0);
const REST_YAW = 0.32;
const SPEED = 20; // m/s on the highway

/** Car pose: before the crash it drives down the right lane (-Z), skids right into the drift. */
const carPose = (t: number) => {
  const u = CUES.impact - t; // seconds before impact
  if (u <= 0) {
    const jolt = tw(t, [CUES.impact, CUES.impact + 0.08, CUES.impact + 0.6], [0, 1, 0]);
    return { pos: REST.clone(), yaw: REST_YAW, pitch: -0.06 * jolt };
  }
  const SK = 0.95;
  if (u < SK) {
    const k = 1 - u / SK; // 0..1 through the skid
    const z = 8 * u + (12 / (2 * SK)) * u * u;
    const x = 1.8 + (REST.x - 1.8) * (k * k * (3 - 2 * k));
    return { pos: V(x, 0, z), yaw: REST_YAW * Math.sin(k * Math.PI * 0.5) * 1.15, pitch: 0 };
  }
  const z0 = 8 * SK + (12 / (2 * SK)) * SK * SK;
  return { pos: V(1.8, 0, z0 + SPEED * (u - SK)), yaw: 0, pitch: 0 };
};

const toWorld = (pose: ReturnType<typeof carPose>, local: [number, number, number] | THREE.Vector3) => {
  const l = Array.isArray(local) ? V(...local) : local.clone();
  return l.applyEuler(new THREE.Euler(pose.pitch, pose.yaw, 0, "YXZ")).add(pose.pos);
};

const smooth = (k: number) => k * k * (3 - 2 * k);

/** Exterior camera for each outside shot. */
const extCam = (name: string, t: number, pose: ReturnType<typeof carPose>): Cam => {
  const k = prog(name, t);
  const car = pose.pos;
  switch (name) {
    case "hook": {
      const a = 0.55 - 0.2 * k;
      const r = 6.5 - 1.8 * smooth(k);
      return { pos: V(car.x + Math.sin(a) * r, 1.25 + 0.3 * (1 - k), car.z - Math.cos(a) * r), look: V(car.x, 0.75, car.z), fov: 50 };
    }
    case "road":
      return { pos: toWorld({ ...pose, pitch: 0 }, [0.4, 2.0, 7.5]), look: toWorld({ ...pose, pitch: 0 }, [0, 1.0, -10]), fov: 60 };
    case "crash": {
      return { pos: V(0.6, 1.3, -7.5), look: V(car.x * 0.6 + 2, 0.7, car.z * 0.5 - 1), fov: 58 };
    }
    case "lost": {
      const lift = smooth(prog("lost", t));
      return { pos: V(car.x + 3.5 + 2 * lift, 3.2 + 5 * lift, car.z + 6 + 3 * lift), look: V(car.x - 3, 0.7, car.z - 1.5), fov: 58 };
    }
    case "buried": {
      const a = 2.1 + 0.6 * k;
      return { pos: V(car.x + Math.sin(a) * 7.5, 2.1, car.z - Math.cos(a) * 7.5), look: V(car.x, 0.7, car.z), fov: 55 };
    }
    case "pipe": {
      const push = smooth(k);
      return { pos: toWorld(pose, [CAR.exhaust[0] - 1.6 + 0.6 * push, 0.75, CAR.exhaust[2] + 3.4 - 1.2 * push]), look: toWorld(pose, [CAR.exhaust[0] + 0.2, 0.35, CAR.exhaust[2]]), fov: 48 };
    }
    case "dig":
      return { pos: toWorld(pose, [CAR.exhaust[0] + 3.0, 1.4, CAR.exhaust[2] + 3.8]), look: toWorld(pose, [CAR.exhaust[0] - 0.3, 0.45, CAR.exhaust[2] + 0.3]), fov: 50 };
    case "relief":
      return { pos: toWorld(pose, [CAR.exhaust[0] + 3.5, 1.8 + 0.5 * k, CAR.exhaust[2] + 5.5 + k]), look: toWorld(pose, [-0.4, 0.7, 1.2]), fov: 52 };
    case "scarf": {
      const top = toWorld(pose, CAR.antennaTop);
      const a = -0.4 + 0.5 * k;
      return { pos: V(top.x - 3.2 * Math.cos(a), 1.1, top.z + 3.2 * Math.sin(a) + 1), look: V(top.x + 0.3, top.y - 0.2, top.z), fov: 50 };
    }
    case "rescue": {
      return { pos: V(2.4, 1.5, 7.5 - 1.5 * k), look: V(0.8, 1.3, -40), fov: 50 };
    }
    case "outro":
    default: {
      const lift = smooth(prog("outro", t));
      return { pos: V(car.x - 10 - 4 * lift, 3 + 7 * lift, car.z + 10 + 4 * lift), look: V(car.x - 3, 1, car.z - 4), fov: 52 };
    }
  }
};

/** Rescue truck position on the road: drives in from far away and stops beside the car. */
const truckZ = (t: number) => tw(t, [CUES.rescue - 0.3, CUES.rescue + 1.6, scene("alive").start + 1.0], [-90, -40, -9]);

export const BlizzardVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const sc = sceneAt(t);
  const hook = sc.name === "hook"; // flash-forward: the car already stuck in the drift
  const pose = carPose(hook ? CUES.impact + 2 : t);
  const day = daylight(t);
  const bury = hook ? 0.85 : buried(t);
  const engine = engineOn(t);
  const crashed = hook || t >= CUES.impact;

  // ---- environment ----
  const night = new THREE.Color("#2a3446");
  const dayFog = new THREE.Color("#c7ced6");
  const fogColor = night.clone().lerp(dayFog, day);
  const whiteout = tw(t, [CUES.wall - 0.2, CUES.wall + 0.5], [0, 1]) * (t < scene("crash").end ? 1 : 0);
  let density = 0.045 + 0.035 * whiteout;
  if (t < CUES.wall) density = 0.02;
  if (t >= CUES.rescue) density = tw(t, [CUES.rescue, CUES.duration], [0.04, 0.02]);
  if (day > 0.5) density = 0.045;
  const fog = { color: fogColor, density };
  const ambient = 0.45 + 0.4 * day;
  const hemi = 0.9 + 0.6 * day;

  // ---- car state ----
  const headlights = hook ? 0 : !crashed ? 1 : tw(t, [CUES.impact, CUES.impact + 1.5], [1, 0]);
  const hazard = crashed && day < 0.5 && t < scene("d3").start;
  const snowOnCar = hook ? 0.8 : crashed ? tw(t, [CUES.impact, scene("buried").start, scene("d3").start], [0.1, 0.7, 1]) : 0;
  const pipeSnow = t >= scene("t12").start ? (t < scene("dig").start ? 1 : tw(t, [scene("dig").start, scene("dig").end - 0.2], [1, 0])) : 0;
  const scarf = t >= scene("scarf").start ? 1 : 0;
  const isPov = sc.view === "pov" || sc.view === "side";

  // ---- camera ----
  let cam: Cam;
  const eye = toWorld(pose, CAR.eye);
  if (sc.view === "pov") {
    const sway = Math.sin(t * 0.7) * 0.03;
    cam = { pos: eye, look: toWorld(pose, [CAR.eye[0] + sway, CAR.eye[1] - 0.25, CAR.eye[2] - 5]), fov: 88 };
  } else if (sc.view === "side") {
    cam = { pos: eye, look: toWorld(pose, [CAR.eye[0] - 5, CAR.eye[1] - 0.45, CAR.eye[2] + 0.2]), fov: 80 };
  } else if (sc.view === "card") {
    const k = prog(sc.name, t);
    cam = { pos: V(pose.pos.x - 7 + k, 2.4, pose.pos.z + 8), look: V(pose.pos.x, 0.8, pose.pos.z), fov: 55 };
  } else cam = extCam(sc.name, t, pose);

  // ---- snowfall + headlight cones ----
  const fwd = V(0, -0.06, -1).applyEuler(new THREE.Euler(pose.pitch, pose.yaw, 0, "YXZ")).normalize();
  const lights: { pos: THREE.Vector3; dir: THREE.Vector3; power: number }[] = [];
  if (headlights > 0.01) lights.push({ pos: toWorld(pose, [0, 0.68, -2.3]), dir: fwd, power: 1.6 * headlights });
  const tz = truckZ(t);
  const truckOn = t >= CUES.rescue - 0.3;
  if (truckOn) lights.push({ pos: V(1.8, 1.4, tz - 2.8), dir: V(0, -0.05, 1).normalize(), power: 2.2 });
  const windStrength = t >= CUES.rescue ? tw(t, [CUES.rescue, CUES.duration], [9, 4]) : day > 0.5 ? 7 : 10;
  const wind = V(windStrength, 0, windStrength * 0.25);
  const flakeAmbient = new THREE.Color("#c4d0e2").lerp(new THREE.Color("#ffffff"), day).multiplyScalar(0.8 + 0.2 * day);
  const heavy = t >= CUES.wall && t < CUES.rescue ? 1 : 0.6;

  // ---- exhaust steam / gas / dig chunks ----
  const r = mulberry32(31);
  const ex = toWorld(pose, CAR.exhaust);
  const puffs: { pos: THREE.Vector3; size: number; opacity: number; color?: string }[] = [];
  const steaming = engine && crashed && pipeSnow < 0.5;
  for (let i = 0; i < 14; i++) {
    const ph = (t * 0.9 + i / 14) % 1;
    const drift = V(wind.x * 0.25 * ph * 2, 0.6 * ph, 1.6 * ph + wind.z * 0.2 * ph);
    if (steaming) puffs.push({ pos: ex.clone().add(drift), size: 0.25 + 1.4 * ph, opacity: 0.45 * (1 - ph) });
    if (engine && pipeSnow >= 0.5 && (sc.name === "pipe" || sc.name === "gas")) {
      // trapped exhaust seeping from the drift toward the cabin
      const p = ex.clone().add(V(0, 0.4, 0)).lerp(toWorld(pose, [-0.6, 0.35, 0.8]), ph);
      puffs.push({ pos: p, size: 0.4 + 0.6 * ph, opacity: 0.32 * Math.sin(ph * Math.PI), color: "#9aa0a8" });
    }
  }
  if (sc.name === "dig") {
    for (let i = 0; i < 26; i++) {
      const spawn = scene("dig").start + r() * (scene("dig").end - scene("dig").start - 0.3);
      const age = t - spawn;
      if (age < 0 || age > 0.7) continue;
      const v0 = V(-1.5 - r() * 2.5, 2.5 + r() * 2, 0.5 + r() * 1.5);
      const p = ex.clone().add(V(0, 0.2, 0.1)).add(v0.multiplyScalar(age)).add(V(0, -4.9 * age * age, 0));
      puffs.push({ pos: p, size: 0.18 + r() * 0.25, opacity: 0.9 * (1 - age / 0.7) });
    }
  }

  // ---- people ----
  const walker = sc.name === "lost" && t < s(7) + 0.6;
  const walkDir = V(-1, 0, -0.35).normalize();
  const walkPos = toWorld(pose, [-1.5, 0, -0.3]).add(walkDir.clone().multiplyScalar(1.3 * (t - scene("lost").start)));
  const walkerOpacity = tw(t, [scene("lost").start + 2.2, scene("lost").start + 3.6], [1, 0]);
  const digger = sc.name === "dig" || sc.name === "relief";

  // ---- camera shake + flashes ----
  const impactShake = tw(t, [CUES.impact, CUES.impact + 0.05, CUES.impact + 0.8], [0, 26, 0]);
  const climaxShake = tw(t, [CUES.climax, CUES.climax + 0.05, CUES.climax + 0.6], [0, 22, 0]);
  const fistShake = sc.name === "move" ? 5 * Math.abs(Math.sin(t * 6)) : 0;
  const roadShake = sc.name === "road" ? 2.5 : 0;
  const amp = impactShake + climaxShake + fistShake + roadShake + (sc.name === "wake" ? 6 : 0);
  const shake: [number, number] = [Math.sin(t * 43) * amp, Math.cos(t * 37) * amp];
  const cutFlash = Math.max(
    ...CUES.scenes.slice(1).map((c) => tw(t, [c.start, c.start + 0.05, c.start + 0.28], [0, 0.22, 0])),
  );
  const hitFlash = Math.max(tw(t, [CUES.impact, CUES.impact + 0.04, CUES.impact + 0.35], [0, 0.6, 0]), tw(t, [CUES.climax, CUES.climax + 0.04, CUES.climax + 0.35], [0, 0.45, 0]));
  const rescueGlow = sc.name === "alive" ? tw(t, [scene("alive").start, scene("alive").start + 0.8, scene("alive").end], [0.05, 0.2, 0.1]) : 0;

  // ---- interior state ----
  const fuel = t < scene("t12").start ? 0.5 : t < scene("d2").start ? 0.38 : t < scene("d3").start ? 0.2 : tw(t, [scene("gauges").start, scene("gauges").start + 1], [0.08, 0.0]);
  const keyTurn =
    sc.name === "engine" ? tw(t, [w(8, 0) - 0.3, w(8, 0) + 0.2], [0, 1]) : sc.name === "keyoff" ? tw(t, [CUES.climax + 0.05, CUES.climax + 0.3], [1, 0]) : engine ? 1 : 0;
  const lit = sc.name === "engine" ? tw(t, [w(8, 0) - 0.2, w(8, 0) + 0.3], [0.1, 1]) : sc.name === "keyoff" ? tw(t, [CUES.climax + 0.2, CUES.climax + 0.45], [1, 0.1]) : engine ? 1 : sc.name === "gauges" ? 0.7 : 0.1;
  const rpm = engine && crashed ? 0.8 + Math.sin(t * 3) * 0.03 : sc.name === "engine" ? tw(t, [w(8, 0) - 0.2, w(8, 0) + 0.4], [0, 0.8]) : 0;
  const cabinTemp =
    t < scene("engine").start ? -2 : t < scene("t12").start ? tw(t, [scene("engine").start, scene("window").end], [-2, 8]) : t < scene("d2").start ? 17 : t < scene("d3").start ? -7 : -15;
  const frost = t < CUES.impact ? 0 : t < scene("t12").start ? 0.25 : t < scene("d2").start ? 0.35 : t < scene("d3").start ? 0.55 : 0.8;
  const warmth = sc.name === "sleepy" ? tw(t, [scene("sleepy").start, scene("sleepy").end], [0.3, 1]) : engine && t > scene("t12").start && t < CUES.climax ? 0.4 : 0;
  let focus: { x: number; y: number; r: number; k: number } | undefined;
  if (sc.name === "engine") focus = t < s(8) + 1.6 ? { x: 905, y: 1560, r: 150, k: 1 } : { x: 385, y: 1335, r: 150, k: 1 };
  if (sc.name === "gauges") focus = t < w(23, 3) ? { x: 385, y: 1360, r: 160, k: 1 } : { x: 540, y: 1330, r: 120, k: 1 };
  if (sc.name === "keyoff") focus = { x: 905, y: 1560, r: 160, k: 1 };
  const breathK = isPov && crashed && !(engine && t > scene("t12").start) && sc.name !== "phone" && sc.name !== "snow" && sc.name !== "bottle" ? 1 : 0;

  // ---- sleepy / CO effects ----
  const eyelids =
    sc.name === "sleepy"
      ? tw(t, [scene("sleepy").start + 0.3, scene("sleepy").end - 0.1], [0, 0.85]) * (0.85 + 0.15 * Math.sin(t * 4))
      : sc.name === "wake"
        ? tw(t, [scene("wake").start, scene("wake").start + 0.25], [0.9, 0])
        : 0;
  const blur = sc.name === "sleepy" ? tw(t, [scene("sleepy").start, scene("sleepy").end], [0, 6]) : sc.name === "wake" ? 3 + 2 * Math.sin(t * 8) : sc.name === "gas" ? 2 + 1.5 * Math.sin(t * 3) : 0;
  const doubleV = sc.name === "wake" || sc.name === "gas" ? 14 + 8 * Math.sin(t * 5) : 0;
  const redPulse = sc.name === "wake" || sc.name === "gas" ? 0.25 + 0.2 * Math.sin(t * 7.5) : 0;
  const gasK = sc.name === "gas" ? tw(t, [scene("gas").start, scene("gas").start + 0.8], [0, 1]) : sc.name === "keyoff" ? 0.7 : 0;
  const outro = tw(t, [s(27) - 0.1, s(27) + 0.6], [0, 0.4]);

  const timerLabel = storyClock(t);
  const card = sc.view === "card";

  const scene3d = (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true, toneMappingExposure: 1.4 }}>
      <World cam={cam} fog={fog} sky={fogColor} ambient={ambient} hemi={hemi}>
        <group position={pose.pos} rotation={[pose.pitch, pose.yaw, 0, "YXZ"]}>
          <Car headlights={headlights} hazard={hazard} t={t} snowOnCar={snowOnCar} pov={isPov} scarf={scarf} />
          {headlights > 0.01 && !isPov &&
            CAR.headlights.map((p, i) => (
              <group key={i} position={p} rotation={[0.05, 0, 0]}>
                {sc.name === "road" && <Beam length={26} radius={4.5} opacity={0.12 * headlights} />}
                <Spot position={[0, 0, 0]} target={[0, -0.6, -10]} intensity={60 * headlights} angle={0.45} penumbra={0.5} distance={60} decay={1.5} color="#fff4dc" />
              </group>
            ))}
          {headlights > 0.01 && isPov && (
            <Spot position={[0, 0.7, -2.3]} target={[0, 0, -12]} intensity={90 * headlights} angle={0.5} penumbra={0.5} distance={60} decay={1.5} color="#fff4dc" />
          )}
          {hazard && Math.floor(t * 1.6) % 2 === 0 && <pointLight position={[0, 0.9, 0]} color="#ff9a1a" intensity={6} distance={10} decay={1.5} />}
        </group>
        {crashed && <Drift at={[REST.x, 0, REST.z]} yaw={REST_YAW} depth={bury} pipe={pipeSnow} />}
        {walker && (
          <group position={walkPos} rotation={[0, Math.atan2(walkDir.x, walkDir.z) + Math.PI, 0]}>
            <Person walk={t * 6} opacity={walkerOpacity} />
          </group>
        )}
        {digger && (
          <group position={toWorld(pose, [CAR.exhaust[0] - 0.75, 0.05, CAR.exhaust[2] + 0.75])} rotation={[0, REST_YAW - 0.72, 0]}>
            <Person walk={t * 5} crouch={sc.name === "dig" ? 1 : 0.15} dig={sc.name === "dig" ? 1 : 0} />
          </group>
        )}
        {truckOn && (
          <group position={[1.8, 0, tz]}>
            <RescueTruck t={t} />
            <group position={[0, 1.3, -2.75]} rotation={[-0.04, Math.PI, 0]}>
              <Beam length={40} radius={7} opacity={0.12} />
            </group>
            {[-0.8, 0.8].map((x) => (
              <Glow key={x} position={[x, 1.15, -2.9]} size={3.5} color="#fff6e6" opacity={0.9} />
            ))}
            <Glow position={[0, 2.8, 0.4]} size={2.5 + Math.sin(t * 7) * 1.2} color="#ff8c00" opacity={0.8} />
            <Spot position={[0, 1.4, -2.8]} target={[0, 0, 20]} intensity={140} angle={0.5} penumbra={0.6} distance={90} decay={1.4} color="#ffffff" />
          </group>
        )}
        <Puffs items={puffs} />
        <Marker position={ex} t={t} k={sc.name === "pipe" ? tw(t, [w(14, 1), w(14, 1) + 0.3], [0, 1]) : 0} />
        <Snowfall t={t} camPos={cam.pos} wind={wind} count={Math.round(9000 * heavy)} box={44} size={0.9} ambient={flakeAmbient} fog={fog} lights={lights} seed={1} />
        {!isPov && <Snowfall t={t} camPos={cam.pos} wind={wind} count={Math.round(500 * heavy)} box={7} size={1.0} ambient={flakeAmbient} fog={fog} lights={lights} seed={2} />}
      </World>
    </ThreeCanvas>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ translate: `${shake[0]}px ${shake[1]}px`, scale: amp > 0 ? "1.04" : "1" }}>
        <AbsoluteFill style={{ filter: blur > 0.1 || card ? `blur(${card ? 6 : blur}px)` : undefined }}>
          {scene3d}
          {sc.view === "pov" && (
            <Interior t={t} lit={lit} fuel={fuel} rpm={rpm} cabinTemp={cabinTemp} fuelWarn={fuel < 0.05 && t > scene("d3").start} keyTurn={keyTurn} frost={frost} warmth={warmth} focus={focus} />
          )}
          {sc.view === "side" && (
            <SideWindow
              t={t}
              drop={sc.name === "window" ? tw(t, [s(9) + 0.3, s(9) + 1.2], [0, 1]) : 0}
              handle={sc.name === "door" ? 1 : 0}
              handleRed={sc.name === "door" && t > w(5, 2) ? 1 : 0}
              switchK={sc.name === "window" && t > s(9) + 0.2 && t < s(9) + 1.2 ? 1 : 0}
              frost={frost}
            />
          )}
        </AbsoluteFill>
        {doubleV > 0 && (
          <AbsoluteFill style={{ opacity: 0.35, translate: `${doubleV}px ${-doubleV * 0.3}px`, mixBlendMode: "screen", filter: `blur(${blur}px)` }}>
            {sc.view === "pov" && <Interior t={t} lit={lit} fuel={fuel} rpm={rpm} cabinTemp={cabinTemp} fuelWarn={false} keyTurn={keyTurn} frost={frost} warmth={warmth} />}
          </AbsoluteFill>
        )}
        {sc.view === "side" && sc.name === "door" && (
          <AbsoluteFill
            style={{
              background: `radial-gradient(circle at 315px 1285px, rgba(0,0,0,0) 160px, rgba(0,0,0,0.6) 280px)`,
            }}
          />
        )}
        {sc.view === "side" && sc.name === "window" && (
          <AbsoluteFill style={{ background: `radial-gradient(ellipse at 540px 560px, rgba(0,0,0,0) 420px, rgba(0,0,0,0.5) 700px)` }} />
        )}
        {sc.name === "phone" && <Phone k={tw(t, [scene("phone").start, scene("phone").start + 0.3], [0, 1])} t={t} />}
        {sc.name === "snow" && <SnowHand k={tw(t, [scene("snow").start, scene("snow").start + 0.4], [0, 1])} cross={tw(t, [w(20, 1) - 0.1, w(20, 1) + 0.6], [0, 1])} />}
        {sc.name === "bottle" && (
          <Bottle
            k={tw(t, [scene("bottle").start, scene("bottle").start + 0.4], [0, 1])}
            melt={tw(t, [scene("bottle").start + 0.5, scene("bottle").end], [0, 1])}
            tuck={tw(t, [w(21, 3), scene("bottle").end - 0.1], [0, 0.75])}
          />
        )}
        {sc.name === "move" && <Fists k={tw(t, [scene("move").start, scene("move").start + 0.35], [0, 1])} t={t} />}
        <Breath t={t} k={breathK} />
        <GasWisps t={t} k={gasK} />
        <Eyelids k={eyelids} />
      </AbsoluteFill>
      <Vignette k={redPulse} color="200,0,0" />
      <Vignette k={sc.view === "pov" ? 0.35 : 0.45} />
      <AbsoluteFill style={{ backgroundColor: "#fff4dc", opacity: rescueGlow, mixBlendMode: "screen" }} />
      {card && timerLabel && <TimerCard label={timerLabel} k={prog(sc.name, t)} t={t} />}
      {!card && timerLabel && t < s(25) && <TimerChip label={timerLabel} />}
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: outro }} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: Math.max(cutFlash, hitFlash) }} />
      <Captions t={t} segments={SEGMENTS} keywords={KEYWORDS} />
      <Audio src={staticFile("blizzard_mix.mp3")} />
    </AbsoluteFill>
  );
};
