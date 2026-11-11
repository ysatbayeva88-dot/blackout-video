import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LightPoints } from "./LightPoints";
import { asphaltTexture, grassTexture, numberTexture, windowsTexture } from "./textures";

/**
 * Runway 24/06, 3000 x 45 m. Landing direction is -Z, threshold of 24 at z = 0.
 * Markings follow ICAO layout: threshold "zebra", designator, centreline,
 * aiming point, touchdown-zone bars, edge lines.
 */
export const RWY_LEN = 3000;
export const RWY_W = 45;
export const AIM_Z = -325; // aiming point / PAPI abeam
export const PAPI_X = [-37.5, -46.5, -55.5, -64.5];
export const PAPI_ANGLES = [3.5, 3.17, 2.83, 2.5]; // inner unit -> outer unit

type Rect = [cx: number, cz: number, w: number, l: number];

const markingRects = (): Rect[] => {
  const r: Rect[] = [];
  const half = RWY_W / 2;
  // edge lines + threshold bars at both ends
  r.push([half - 0.45, -RWY_LEN / 2, 0.9, RWY_LEN], [-half + 0.45, -RWY_LEN / 2, 0.9, RWY_LEN]);
  r.push([0, -1, RWY_W, 1.8], [0, -RWY_LEN + 1, RWY_W, 1.8]);
  for (const end of [0, 1]) {
    const dir = end === 0 ? -1 : 1;
    const base = end === 0 ? 0 : -RWY_LEN;
    // threshold piano keys: 8 per side
    for (let k = 0; k < 8; k++)
      for (const s of [-1, 1]) r.push([s * (1.9 + k * 2.6), base + dir * 21, 1.8, 30]);
    // aiming point blocks
    for (const s of [-1, 1]) r.push([s * 13, base + dir * 325, 8, 50]);
    // touchdown zone bars (distance from threshold, bars per side)
    for (const [d, n] of [[150, 3], [450, 2], [600, 2], [750, 1], [900, 1]] as const)
      for (let i = 0; i < n; i++)
        for (const s of [-1, 1]) r.push([s * (9.9 + i * 3.3), base + dir * (d + 11), 1.8, 22.5]);
  }
  // centreline dashes 30 m / gap 20 m
  for (let z = -100; z > -RWY_LEN + 100; z -= 50) r.push([0, z - 15, 0.9, 30]);
  return r;
};

const Markings: React.FC = () => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const rects = useMemo(markingRects, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    rects.forEach(([cx, cz, w, l], i) => {
      m.compose(new THREE.Vector3(cx, 0.06, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(w, l, 1));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [rects]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, rects.length]} receiveShadow>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial color="#e9ecef" roughness={0.8} polygonOffset polygonOffsetFactor={-2} />
    </instancedMesh>
  );
};

const Designator: React.FC<{ text: string; z: number; flip?: boolean }> = ({ text, z, flip }) => (
  <mesh position={[0, 0.06, z]} rotation={[-Math.PI / 2, 0, flip ? Math.PI : 0]}>
    <planeGeometry args={[13, 21]} />
    <meshStandardMaterial map={numberTexture(text)} transparent roughness={0.8} polygonOffset polygonOffsetFactor={-2} />
  </mesh>
);

/** Positions for the static runway / taxiway lights. */
const useLightSets = () =>
  useMemo(() => {
    const edgeWhite: number[] = [], edgeAmber: number[] = [], green: number[] = [], red: number[] = [];
    const approach: number[] = [], taxiBlue: number[] = [], taxiGreen: number[] = [], center: number[] = [];
    for (let z = 0; z >= -RWY_LEN; z -= 60)
      for (const s of [-1, 1]) (z < -RWY_LEN + 600 ? edgeAmber : edgeWhite).push(s * 23.5, 0.4, z);
    for (let z = -15; z >= -RWY_LEN; z -= 15) center.push(0, 0.1, z);
    for (let x = -22; x <= 22; x += 3) { green.push(x, 0.3, 1.5); red.push(x, 0.3, -RWY_LEN - 1.5); }
    for (let x = 26; x <= 38; x += 3) for (const s of [-1, 1]) green.push(s * x, 0.3, 1.5); // wing bars
    // approach lighting: barrettes every 30 m out to 900 m, crossbar at 300 m
    for (let z = 30; z <= 900; z += 30) for (let x = -2; x <= 2; x++) approach.push(x * 1.1, 1 + z * 0.004, z);
    for (let x = -15; x <= 15; x += 1.5) approach.push(x, 2.2, 300);
    // parallel taxiway at x = +180
    for (let z = 100; z >= -RWY_LEN - 100; z -= 30) { taxiBlue.push(168, 0.3, z, 192, 0.3, z); taxiGreen.push(180, 0.1, z); }
    for (const cz of [-200, -1500, -2800]) for (let x = 30; x < 168; x += 15) taxiGreen.push(x, 0.1, cz);
    return { edgeWhite, edgeAmber, green, red, approach, taxiBlue, taxiGreen, center };
  }, []);

export const Airport: React.FC<{ t: number; camPos: THREE.Vector3 }> = ({ t, camPos }) => {
  const L = useLightSets();
  // PAPI: white when the eye is above the unit's angle, red below
  const papi = PAPI_X.map((x, i) => {
    const dist = Math.hypot(camPos.x - x, camPos.z - AIM_Z);
    const ang = (Math.atan2(camPos.y - 1, dist) * 180) / Math.PI;
    return { x, white: ang > PAPI_ANGLES[i] };
  });
  // sequenced flashers ("the rabbit") run towards the threshold twice a second
  const k = (t * 2) % 1;
  const strobeZ = 900 - Math.floor(k * 21) * 30;

  return (
    <group>
      {/* grass field around the airport */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[100, 0.01, -1500]} receiveShadow>
        <planeGeometry args={[5000, 9000]} />
        <meshStandardMaterial map={grassTexture()} roughness={1} />
      </mesh>
      {/* runway + stopways */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -RWY_LEN / 2]} receiveShadow>
        <planeGeometry args={[RWY_W, RWY_LEN + 120]} />
        <meshStandardMaterial map={asphaltTexture()} roughness={0.95} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      {/* darker rubber deposits in the touchdown zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, -500]}>
        <planeGeometry args={[16, 600]} />
        <meshBasicMaterial color="#15161a" transparent opacity={0.35} polygonOffset polygonOffsetFactor={-1.5} />
      </mesh>
      <Markings />
      <Designator text="24" z={-62} />
      <Designator text="06" z={-RWY_LEN + 62} flip />
      {/* taxiway, connectors, apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[180, 0.03, -1500]}>
        <planeGeometry args={[23, RWY_LEN + 200]} />
        <meshStandardMaterial color="#34363b" roughness={1} />
      </mesh>
      {[-200, -1500, -2800].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[100, 0.025, z]}>
          <planeGeometry args={[160, 23]} />
          <meshStandardMaterial color="#34363b" roughness={1} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[330, 0.03, -1500]}>
        <planeGeometry args={[220, 900]} />
        <meshStandardMaterial color="#3d4045" roughness={1} />
      </mesh>
      {/* terminal, tower, hangars */}
      <mesh position={[470, 18, -1500]} castShadow receiveShadow>
        <boxGeometry args={[50, 36, 700]} />
        <meshStandardMaterial map={windowsTexture()} emissiveMap={windowsTexture()} emissive="#ffffff" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[380, 35, -950]} castShadow>
        <cylinderGeometry args={[5, 7, 70, 16]} />
        <meshStandardMaterial color="#9aa0aa" />
      </mesh>
      <mesh position={[380, 74, -950]}>
        <cylinderGeometry args={[11, 9, 9, 16]} />
        <meshStandardMaterial color="#1c2b2a" emissive="#4fd1a5" emissiveIntensity={0.6} />
      </mesh>
      {[-2300, -2550].map((z) => (
        <mesh key={z} position={[430, 14, z]} castShadow receiveShadow>
          <boxGeometry args={[90, 28, 150]} />
          <meshStandardMaterial color="#6b7380" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}

      <LightPoints positions={L.edgeWhite} color="#fff4d6" size={7} />
      <LightPoints positions={L.edgeAmber} color="#ffbf47" size={7} />
      <LightPoints positions={L.center} color="#ffffff" size={4} opacity={0.7} />
      <LightPoints positions={L.green} color="#3dff7a" size={8} />
      <LightPoints positions={L.red} color="#ff3b30" size={7} />
      <LightPoints positions={L.approach} color="#fff1c9" size={8} />
      <LightPoints positions={[0, 2, strobeZ, 0, 2, strobeZ - 30]} color="#ffffff" size={26} />
      <LightPoints positions={L.taxiBlue} color="#4d7cff" size={5} />
      <LightPoints positions={L.taxiGreen} color="#46ff8c" size={4} opacity={0.8} />
      {papi.map((p) => (
        <group key={p.x}>
          <mesh position={[p.x, 0.6, AIM_Z]}>
            <boxGeometry args={[3, 1.2, 1.5]} />
            <meshStandardMaterial color="#d8b23a" />
          </mesh>
          <LightPoints positions={[p.x, 1, AIM_Z + 0.8]} color={p.white ? "#ffffff" : "#ff2a1f"} size={16} />
        </group>
      ))}
    </group>
  );
};
