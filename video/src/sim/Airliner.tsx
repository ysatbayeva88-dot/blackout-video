import React, { useMemo } from "react";
import * as THREE from "three";
import { LightPoints } from "./LightPoints";

/**
 * Procedural twin-jet airliner (~737-800 proportions), body frame:
 * x = right wing, y = up, nose points to -z. Origin = fuselage centre line.
 * Fictional livery (no real airline branding).
 */

const LEN_TAIL = 20; // fuselage from z=+20 (tail) to z=-19.5 (nose)
const R = 1.88;

const profile = () => {
  const pts: THREE.Vector2[] = [];
  // lathe runs along +y; y = -20 tail tip ... +19.5 nose tip, later rotated so +y -> -z
  for (let i = 0; i <= 80; i++) {
    const y = -LEN_TAIL + (i / 80) * 39.5;
    let r = R;
    if (y < -13) r = 0.35 + (R - 0.35) * Math.pow((y + 20) / 7, 0.7);
    if (y > 13) r = R * Math.sqrt(Math.max(0, 1 - Math.pow((y - 13) / 6.5, 2.2)));
    pts.push(new THREE.Vector2(Math.max(r, 0.001), y));
  }
  return pts;
};

const liveryTexture = () => {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1024;
  const g = c.getContext("2d")!;
  // x = around (u), y = along length (v: 0 tail .. 1 nose) -> canvas y flipped
  g.fillStyle = "#f4f6f8";
  g.fillRect(0, 0, 2048, 1024);
  const vy = (v: number) => (1 - v) * 1024;
  const band = (u0: number, u1: number, col: string, v0 = 0.08, v1 = 0.93) => {
    g.fillStyle = col;
    g.fillRect(u0 * 2048, vy(v1), (u1 - u0) * 2048, vy(v0) - vy(v1));
  };
  // grey belly
  band(0.36, 0.64, "#aeb6bf", 0, 1);
  // blue cheat lines both sides
  band(0.255, 0.3, "#1f4fb8");
  band(0.7, 0.745, "#1f4fb8");
  band(0.3, 0.315, "#f2b705");
  band(0.685, 0.7, "#f2b705");
  // cabin windows: right side around u=0.19, left u=0.81
  g.fillStyle = "#1a2433";
  for (const u of [0.19, 0.81])
    for (let v = 0.2; v < 0.8; v += 0.0118) {
      if (Math.abs(v - 0.47) < 0.015 || Math.abs(v - 0.5) < 0.01) continue; // overwing exits
      g.beginPath();
      g.ellipse(u * 2048, vy(v), 7, 9, 0, 0, Math.PI * 2);
      g.fill();
    }
  // doors
  g.strokeStyle = "#7d8792";
  g.lineWidth = 3;
  for (const u of [0.19, 0.81])
    for (const v of [0.83, 0.12]) g.strokeRect(u * 2048 - 18, vy(v) - 30, 36, 60);
  // cockpit windows (dark) near nose top
  g.fillStyle = "#121a26";
  for (const [u0, u1] of [[0.04, 0.16], [0.84, 0.96], [0.16, 0.25], [0.75, 0.84]]) g.fillRect(u0 * 2048, vy(0.925), (u1 - u0) * 2048, 22);
  g.fillRect(0, vy(0.925), 0.04 * 2048, 22);
  g.fillRect(0.96 * 2048, vy(0.925), 0.04 * 2048, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

/** Flat wing-like slab from an XZ outline, extruded downward by `thick`. */
const slab = (outline: [number, number][], thick: number) => {
  const sh = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelSize: thick * 0.4, bevelThickness: thick * 0.4, bevelSegments: 2 });
  g.rotateX(Math.PI / 2); // shape's y -> z, extrude goes -y
  return g;
};

const paint = new THREE.MeshStandardMaterial({ color: "#eef1f4", metalness: 0.25, roughness: 0.35 });
const grey = new THREE.MeshStandardMaterial({ color: "#b9c0c8", metalness: 0.5, roughness: 0.4 });
const dark = new THREE.MeshStandardMaterial({ color: "#20242a", metalness: 0.4, roughness: 0.6 });
const blue = new THREE.MeshStandardMaterial({ color: "#1f4fb8", metalness: 0.2, roughness: 0.4 });
const rubber = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.9 });
const chrome = new THREE.MeshStandardMaterial({ color: "#d8dde2", metalness: 0.9, roughness: 0.2 });

const Engine: React.FC<{ x: number; reverse: number }> = ({ x, reverse }) => (
  <group position={[x, -2.0, -6.2]}>
    {/* pylon */}
    <mesh position={[0, 0.95, 1.2]} material={grey}>
      <boxGeometry args={[0.35, 0.9, 3.2]} />
    </mesh>
    {/* fan cowl */}
    <mesh rotation={[Math.PI / 2, 0, 0]} material={paint} castShadow>
      <cylinderGeometry args={[1.0, 1.05, 2.4, 32, 1, true]} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.22]} material={chrome}>
      <torusGeometry args={[1.0, 0.07, 10, 32]} />
    </mesh>
    {/* intake darkness + spinner */}
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.9]} material={dark}>
      <circleGeometry args={[0.98, 32]} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.05]} material={chrome}>
      <coneGeometry args={[0.28, 0.5, 20]} />
    </mesh>
    {/* thrust-reverser cascades exposed when the sleeve slides back */}
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.2 + reverse * 0.45]} material={dark}>
      <cylinderGeometry args={[0.98, 0.98, reverse * 0.9 + 0.01, 32, 1, true]} />
    </mesh>
    {/* translating sleeve */}
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 2.1 + reverse * 0.9]} material={paint} castShadow>
      <cylinderGeometry args={[1.05, 0.82, 1.6, 32, 1, true]} />
    </mesh>
    {/* exhaust cone */}
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 3.4 + reverse * 0.9]} material={grey}>
      <coneGeometry args={[0.45, 1.3, 20]} />
    </mesh>
  </group>
);

/** Main gear leg with two wheels; ext 0 = retracted into the wing root, 1 = down & locked. */
const MainGear: React.FC<{ x: number; ext: number; compress: number }> = ({ x, ext, compress }) => {
  const side = Math.sign(x);
  return (
    <group position={[x, -1.5, 1.4]} rotation={[0, 0, -side * (1 - ext) * (Math.PI / 2)]}>
      <mesh position={[0, -1.0 + compress * 0.3, 0]} material={chrome}>
        <cylinderGeometry args={[0.13, 0.13, 2.0, 12]} />
      </mesh>
      <mesh position={[0, -0.4, 0.35]} rotation={[0.6, 0, 0]} material={grey}>
        <boxGeometry args={[0.1, 1.4, 0.1]} />
      </mesh>
      {[-0.32, 0.32].map((dx) => (
        <group key={dx} position={[dx, -2.0 + compress * 0.3, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={rubber} castShadow>
            <cylinderGeometry args={[0.56, 0.56, 0.38, 24]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[dx > 0 ? 0.2 : -0.2, 0, 0]} material={grey}>
            <cylinderGeometry args={[0.3, 0.3, 0.02, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const NoseGear: React.FC<{ ext: number; compress: number }> = ({ ext, compress }) => (
  <group position={[0, -1.4, -15.2]} rotation={[-(1 - ext) * (Math.PI / 2), 0, 0]}>
    <mesh position={[0, -0.85 + compress * 0.2, 0]} material={chrome}>
      <cylinderGeometry args={[0.09, 0.09, 1.7, 10]} />
    </mesh>
    {[-0.18, 0.18].map((dx) => (
      <mesh key={dx} position={[dx, -1.7 + compress * 0.2, 0]} rotation={[0, 0, Math.PI / 2]} material={rubber} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.22, 20]} />
      </mesh>
    ))}
  </group>
);

export type AirlinerProps = {
  t: number;
  flaps: number; // 0..1
  gear: number; // 0 up .. 1 down
  reverse: number; // 0..1
  compress?: number; // gear strut compression on the ground 0..1
  landingLights?: boolean;
};

export const Airliner: React.FC<AirlinerProps> = ({ t, flaps, gear, reverse, compress = 0, landingLights }) => {
  const fuselage = useMemo(() => {
    const g = new THREE.LatheGeometry(profile(), 64);
    g.rotateX(-Math.PI / 2); // lathe +y -> -z (nose forward), phi = 0 on top
    return g;
  }, []);
  const livery = useMemo(() => new THREE.MeshStandardMaterial({ map: liveryTexture(), metalness: 0.25, roughness: 0.35 }), []);
  const wing = useMemo(() => slab([[1.6, -4.5], [17.9, 3.2], [17.9, 4.6], [1.6, 3.4]], 0.32), []);
  const flap = useMemo(() => slab([[0, 0], [9.2, 0.95], [9.2, 2.0], [0, 1.3]], 0.12), []);
  const stab = useMemo(() => slab([[0.6, 0], [7.1, 3.2], [7.1, 4.4], [0.6, 3.6]], 0.18), []);
  const fin = useMemo(() => {
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(6.8, 0), new THREE.Vector2(7.6, 7.0), new THREE.Vector2(5.4, 7.0)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 });
    g.rotateY(-Math.PI / 2);
    return g;
  }, []);

  const strobe = (t * 1.0) % 1 < 0.06;
  const beacon = (t * 1.3) % 1 < 0.12;

  return (
    <group>
      <mesh geometry={fuselage} material={livery} castShadow receiveShadow />
      {/* wing-body fairing */}
      <mesh position={[0, -1.35, 0]} scale={[1.6, 0.55, 5.5]} material={grey}>
        <sphereGeometry args={[1, 24, 12]} />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          <group position={[0, -1.15, 0]} rotation={[0, 0, (6 * Math.PI) / 180]}>
            <mesh geometry={wing} material={paint} castShadow receiveShadow />
            {/* split winglet */}
            <mesh position={[17.95, 1.1, 4.0]} rotation={[0, 0, -0.08]} material={blue}>
              <boxGeometry args={[0.15, 2.4, 1.4]} />
            </mesh>
            {/* trailing-edge flap: slides aft and droops */}
            <group position={[2.4, -0.05, 3.25 + flaps * 1.0]} rotation={[(flaps * 30 * Math.PI) / 180, 0, 0]}>
              <mesh geometry={flap} material={grey} castShadow />
            </group>
          </group>
          <Engine x={5.0} reverse={reverse} />
          <group position={[0, 1.0, 15.4]}>
            <mesh geometry={stab} material={paint} castShadow />
          </group>
        </group>
      ))}
      <group position={[0.15, 1.5, 12.8]}>
        <mesh geometry={fin} material={blue} castShadow />
      </group>
      <MainGear x={2.9} ext={gear} compress={compress} />
      <MainGear x={-2.9} ext={gear} compress={compress} />
      <NoseGear ext={gear} compress={compress} />

      {/* navigation / anti-collision lights */}
      <LightPoints positions={[18.0, 0.8, 3.8]} color="#29ff5a" size={10} />
      <LightPoints positions={[-18.0, 0.8, 3.8]} color="#ff2a2a" size={10} />
      {strobe && <LightPoints positions={[18.0, 0.8, 4.6, -18.0, 0.8, 4.6, 0, 1.2, 20]} color="#ffffff" size={34} />}
      {beacon && <LightPoints positions={[0, 1.95, 2, 0, -1.95, 2]} color="#ff2a1f" size={22} />}
      {landingLights && <LightPoints positions={[2.2, -1.6, -2.2, -2.2, -1.6, -2.2, 0, -1.6, -15.4]} color="#fff6dd" size={48} />}
    </group>
  );
};

/** Wheel contact points in body frame (for tyre smoke). */
export const MAIN_WHEELS: [number, number, number][] = [
  [2.9, -3.5, 1.4],
  [-2.9, -3.5, 1.4],
];
export const GEAR_HEIGHT = 3.5; // fuselage centre above ground when sitting on its wheels
