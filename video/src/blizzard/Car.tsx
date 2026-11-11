import React, { useMemo } from "react";
import * as THREE from "three";
import { snowTexture } from "./textures";

/**
 * Procedural mid-size sedan. Local frame: origin on the ground under the car centre,
 * front toward -Z, +X to the right, metres.
 */
export const CAR = {
  length: 4.6,
  width: 1.82,
  headlights: [
    [-0.62, 0.68, -2.3],
    [0.62, 0.68, -2.3],
  ] as [number, number, number][],
  exhaust: [-0.5, 0.27, 2.36] as [number, number, number],
  antennaBase: [0.35, 1.46, 0.75] as [number, number, number],
  antennaTop: [0.35, 2.22, 0.75] as [number, number, number],
  /** Driver eye point (left-hand drive). */
  eye: [-0.37, 1.16, 0.05] as [number, number, number],
};

const extrude = (pts: [number, number][], depth: number, bevel = 0.05) => {
  const sh = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: depth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 8,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2); // shape u (length) -> world Z, front at -Z
  g.computeVertexNormals();
  return g;
};

// side profile, u = -2.3 (front) .. 2.3 (rear)
const BODY: [number, number][] = [
  [-2.28, 0.32], [-2.33, 0.5], [-2.3, 0.7], [-2.15, 0.8], [-1.0, 0.93], [1.4, 0.96],
  [2.18, 0.9], [2.32, 0.78], [2.33, 0.5], [2.28, 0.32],
];
const GLASS: [number, number][] = [
  [-1.02, 0.9], [-0.28, 1.43], [0.82, 1.43], [1.42, 0.94],
];

export const Car: React.FC<{
  headlights: number; // 0..1
  hazard: boolean;
  t: number;
  snowOnCar: number; // 0..1 thickness on roof/hood
  pov?: boolean; // camera is inside: hide glass and interior-facing bits
  scarf?: number; // 0 = none, >0 = scarf visible
}> = ({ headlights, hazard, t, snowOnCar, pov, scarf = 0 }) => {
  const geo = useMemo(
    () => ({
      body: extrude(BODY, CAR.width, 0.07),
      glass: extrude(GLASS, CAR.width - 0.16, 0.06),
      wheel: new THREE.CylinderGeometry(0.33, 0.33, 0.23, 28).rotateZ(Math.PI / 2),
      rim: new THREE.CylinderGeometry(0.2, 0.2, 0.24, 18).rotateZ(Math.PI / 2),
      // snow pillow: flattened dome with lumpy top
      cushion: (() => {
        const g = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
        const p = g.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const r = Math.hypot(x, z);
          const k = Math.pow(Math.max(0, y), 0.35); // flatter top, rounded rim
          p.setY(i, k * (1 + 0.12 * Math.sin(x * 9 + z * 5)));
          p.setX(i, x * (1 + 0.04 * (1 - r)));
        }
        g.computeVertexNormals();
        return g;
      })(),
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      paint: new THREE.MeshPhysicalMaterial({ color: "#5d6f84", metalness: 0.1, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#3a4e64", metalness: 0, roughness: 0.12, clearcoat: 1, emissive: "#0c1520", transparent: true, opacity: 0.92 }),
      tyre: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.9 }),
      rim: new THREE.MeshStandardMaterial({ color: "#8e959c", metalness: 0.8, roughness: 0.35 }),
      trim: new THREE.MeshStandardMaterial({ color: "#121416", roughness: 0.6 }),
      chrome: new THREE.MeshStandardMaterial({ color: "#5f6368", metalness: 0.9, roughness: 0.3 }),
      snow: new THREE.MeshStandardMaterial({ color: "#f3f6fa", roughness: 0.95, map: snowTexture() }),
    }),
    [],
  );
  const blink = hazard && Math.floor(t * 1.6) % 2 === 0;
  const head = new THREE.Color("#fff6e0").multiplyScalar(0.3 + 3.5 * headlights);
  const tail = new THREE.Color("#ff1a10").multiplyScalar(0.25 + (headlights > 0 ? 1.6 : 0));
  const amber = new THREE.Color("#ff9a1a").multiplyScalar(blink ? 4 : 0.15);
  const sn = snowOnCar;

  return (
    <group>
      <mesh geometry={geo.body} material={mats.paint} castShadow receiveShadow />
      {!pov && <mesh geometry={geo.glass} material={mats.glass} />}
      {/* roof skin */}
      <mesh position={[0, 1.445, 0.27]} material={mats.paint}>
        <boxGeometry args={[CAR.width - 0.18, 0.05, 1.18]} />
      </mesh>
      {/* bumpers + grille */}
      <mesh position={[0, 0.4, -2.3]} material={mats.trim}>
        <boxGeometry args={[1.74, 0.16, 0.1]} />
      </mesh>
      <mesh position={[0, 0.58, -2.34]} material={mats.chrome}>
        <boxGeometry args={[0.8, 0.12, 0.04]} />
      </mesh>
      <mesh position={[0, 0.4, 2.31]} material={mats.trim}>
        <boxGeometry args={[1.74, 0.16, 0.1]} />
      </mesh>
      {/* lamps */}
      {CAR.headlights.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.36, 0.12, 0.06]} />
          <meshBasicMaterial color={head} toneMapped={false} />
        </mesh>
      ))}
      {[-0.68, 0.68].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.76, 2.31]}>
            <boxGeometry args={[0.36, 0.13, 0.05]} />
            <meshBasicMaterial color={tail} toneMapped={false} />
          </mesh>
          <mesh position={[x * 1.22, 0.66, 2.3]}>
            <boxGeometry args={[0.1, 0.08, 0.05]} />
            <meshBasicMaterial color={amber} toneMapped={false} />
          </mesh>
          <mesh position={[x * 1.22, 0.66, -2.29]}>
            <boxGeometry args={[0.1, 0.08, 0.05]} />
            <meshBasicMaterial color={amber} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* wheels */}
      {[-1.42, 1.42].flatMap((z) =>
        [-0.82, 0.82].map((x) => (
          <group key={`${x}${z}`} position={[x, 0.33, z]}>
            <mesh geometry={geo.wheel} material={mats.tyre} />
            <mesh geometry={geo.rim} material={mats.rim} position={[x > 0 ? 0.01 : -0.01, 0, 0]} />
          </group>
        )),
      )}
      {/* mirrors */}
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[sgn * 1.0, 1.0, -0.85]} material={mats.paint}>
          <boxGeometry args={[0.16, 0.12, 0.2]} />
        </mesh>
      ))}
      {/* exhaust pipe */}
      <mesh position={CAR.exhaust} rotation={[Math.PI / 2, 0, 0]} material={mats.chrome}>
        <cylinderGeometry args={[0.045, 0.045, 0.22, 14, 1, true]} />
      </mesh>
      {/* antenna */}
      <mesh position={[CAR.antennaBase[0], (CAR.antennaBase[1] + CAR.antennaTop[1]) / 2, CAR.antennaBase[2]]} material={mats.chrome}>
        <cylinderGeometry args={[0.006, 0.01, CAR.antennaTop[1] - CAR.antennaBase[1], 6]} />
      </mesh>
      {scarf > 0 && <Scarf t={t} />}
      {/* snow on the roof, hood and trunk */}
      {sn > 0.01 && (
        <group>
          <mesh geometry={geo.cushion} position={[0, 1.45, 0.27]} scale={[0.86, 0.26 * sn, 0.7]} material={mats.snow} />
          <mesh geometry={geo.cushion} position={[0, 0.9, -1.6]} rotation={[0.08, 0, 0]} scale={[0.86, 0.17 * sn, 0.66]} material={mats.snow} />
          <mesh geometry={geo.cushion} position={[0, 0.94, 1.8]} scale={[0.86, 0.15 * sn, 0.45]} material={mats.snow} />
        </group>
      )}
    </group>
  );
};

/** Bright red scarf tied to the antenna tip, flapping downwind (+X). */
const Scarf: React.FC<{ t: number }> = ({ t }) => {
  const geo = useMemo(() => new THREE.PlaneGeometry(0.9, 0.16, 24, 3), []);
  const base = useMemo(() => geo.attributes.position.array.slice() as Float32Array, [geo]);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x0 = base[i * 3] + 0.45; // 0 at the knot .. 0.9 at the tail
    const y0 = base[i * 3 + 1];
    const k = x0 / 0.9;
    const wave = Math.sin(x0 * 9 - t * 22) * 0.09 * k + Math.sin(x0 * 4 - t * 13) * 0.05 * k;
    const droop = -0.08 * k * k + Math.sin(t * 7) * 0.03 * k;
    pos.setXYZ(i, x0, y0 + droop, wave);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return (
    <mesh geometry={geo} position={[CAR.antennaTop[0], CAR.antennaTop[1] - 0.1, CAR.antennaTop[2]]} rotation={[0, -0.5, 0]}>
      <meshStandardMaterial color="#e3121b" emissive="#5a0306" roughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
};
