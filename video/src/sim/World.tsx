import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Airport } from "./Airport";
import { LightPoints } from "./LightPoints";
import { mulberry32 } from "./rng";
import { cloudPuffTexture, cloudSeaTexture, fieldsTexture } from "./textures";

/** Low sun just above the horizon, ahead-left of the approach (golden hour). */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.06, -0.83).normalize();
const HAZE = "#c98a6a";

export type CameraState = {
  pos: [number, number, number];
  /** degrees: yaw (0 = looking down -Z, positive = left), pitch (nose up +), roll (right wing down +) */
  yaw: number;
  pitch: number;
  roll: number;
  /** horizontal field of view, degrees */
  hfov: number;
  /** screen y (px) of the optical centre; cockpit views put it inside the windshield */
  centerY?: number;
  /** screen x (px) of the optical centre (captain's seat looks through the left window) */
  centerX?: number;
};

const CameraRig: React.FC<{ cam: CameraState }> = ({ cam }) => {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    const W = size.width, H = size.height;
    const cy = cam.centerY ?? H / 2;
    const off = H / 2 - cy; // move principal point up by `off`
    const fullH = H + 2 * Math.abs(off);
    const offX = W / 2 - (cam.centerX ?? W / 2); // move principal point left by `offX`
    const fullW = W + 2 * Math.abs(offX);
    const f = W / 2 / Math.tan(((cam.hfov / 2) * Math.PI) / 180);
    c.fov = (2 * Math.atan(fullH / 2 / f) * 180) / Math.PI;
    c.aspect = fullW / fullH;
    c.near = 0.5;
    c.far = 160000;
    c.setViewOffset(fullW, fullH, offX > 0 ? 2 * offX : 0, off > 0 ? 2 * off : 0, W, H);
    c.position.set(...cam.pos);
    c.rotation.order = "YXZ";
    c.rotation.set((cam.pitch * Math.PI) / 180, (cam.yaw * Math.PI) / 180, (-cam.roll * Math.PI) / 180);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }, [camera, size, cam]);
  return null;
};

const Sky: React.FC = () => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { sun: { value: SUN_DIR } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
        fragmentShader: `
          varying vec3 vDir; uniform vec3 sun;
          void main(){
            float h = vDir.y;
            vec3 zenith = vec3(0.07,0.12,0.27);
            vec3 mid = vec3(0.28,0.33,0.52);
            vec3 horizon = vec3(0.98,0.62,0.40);
            vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
            col = mix(col, zenith, smoothstep(0.18, 0.7, h));
            float s = max(dot(normalize(vDir), sun), 0.0);
            col += vec3(1.0,0.55,0.25) * pow(s, 8.0) * 0.55 + vec3(1.0,0.85,0.6) * pow(s, 400.0) * 2.5;
            col = mix(col, vec3(0.60,0.42,0.38), smoothstep(0.0, -0.08, h));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[100000, 48, 24]} />
    </mesh>
  );
};

const Ground: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
    <planeGeometry args={[300000, 300000]} />
    <meshStandardMaterial map={fieldsTexture()} roughness={1} />
  </mesh>
);

/** City to the right of the approach + scattered villages; warm street and window lights. */
const City: React.FC = () => {
  const { pos, col } = useMemo(() => {
    const r = mulberry32(42);
    const pos: number[] = [], col: number[] = [];
    const add = (x: number, z: number, warm = r() > 0.25) => {
      pos.push(x, 3, z);
      const c = warm ? [1, 0.75 + r() * 0.15, 0.45] : [0.75, 0.85, 1];
      col.push(...c);
    };
    // street grid of the main city
    for (let gx = 0; gx < 60; gx++)
      for (let gz = 0; gz < 70; gz++) {
        const x = 1800 + gx * 140 + (r() - 0.5) * 30;
        const z = -3000 + gz * 160 + (r() - 0.5) * 30;
        if (Math.hypot(x - 5500, z - 2500) > 5200 * (0.7 + r() * 0.5)) continue;
        add(x, z);
        if (r() > 0.4) add(x + 70, z, true);
      }
    // villages and highway
    for (let v = 0; v < 25; v++) {
      const cx = (r() - 0.5) * 40000, cz = 3000 + r() * 40000;
      for (let i = 0; i < 80; i++) add(cx + (r() - 0.5) * 900, cz + (r() - 0.5) * 900);
    }
    for (let z = 15000; z > -8000; z -= 60) add(-1500 + z * 0.08, z, true);
    return { pos, col };
  }, []);
  return <LightPoints positions={pos} colors={col} size={3.5} opacity={0.95} />;
};

/** Cloud deck: tiled fbm sea + puffy sprites for depth. */
const Clouds: React.FC<{ y: number; opacity: number; around: [number, number] }> = ({ y, opacity, around }) => {
  const puffs = useMemo(() => {
    const r = mulberry32(77);
    return Array.from({ length: 520 }, () => ({
      x: (r() - 0.5) * 60000,
      z: (r() - 0.5) * 60000,
      dy: (r() - 0.3) * 500,
      s: 1400 + r() * 2600,
      tex: Math.floor(r() * 4),
    }));
  }, []);
  if (opacity <= 0.001) return null;
  // puffs wrap around the camera so the deck never ends
  const wrap = (v: number, c: number) => c + ((((v - c) % 60000) + 90000) % 60000) - 30000;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y - 150, 0]} renderOrder={1}>
        <planeGeometry args={[220000, 220000]} />
        <meshBasicMaterial map={cloudSeaTexture()} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {puffs.map((p, i) => (
        <sprite key={i} position={[wrap(p.x, around[0]), y + p.dy, wrap(p.z, around[1])]} scale={[p.s * 1.8, p.s, 1]} renderOrder={2}>
          <spriteMaterial map={cloudPuffTexture(p.tex)} transparent opacity={opacity * 0.95} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
};

export type WorldProps = {
  t: number;
  cam: CameraState;
  clouds?: { y: number; opacity: number };
  fogDensity?: number;
  children?: React.ReactNode;
};

/** Everything outside the aircraft: sky, ground, city, airport, clouds. */
export const World: React.FC<WorldProps> = ({ t, cam, clouds, fogDensity = 0.00006, children }) => {
  const camPos = useMemo(() => new THREE.Vector3(...cam.pos), [cam.pos]);
  return (
    <>
      <CameraRig cam={cam} />
      <fogExp2 attach="fog" args={[HAZE, fogDensity]} />
      <hemisphereLight args={["#ffd2b0", "#4a4048", 1.4]} />
      <directionalLight
        position={[SUN_DIR.x * 5000, SUN_DIR.y * 5000 + 400, SUN_DIR.z * 5000]}
        intensity={2.2}
        color="#ffb37a"
      />
      <ambientLight intensity={0.15} />
      <Sky />
      <Ground />
      <City />
      <Airport t={t} camPos={camPos} />
      {clouds && <Clouds y={clouds.y} opacity={clouds.opacity} around={[cam.pos[0], cam.pos[2]]} />}
      {children}
    </>
  );
};
