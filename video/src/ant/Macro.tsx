import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { mulberry32 } from "../sim/rng";
import { fbm } from "../blizzard/textures";
import { bokehTexture, breadTexture, lawnTexture, puffTexture, skyTexture, soilBump, soilTexture, woodTexture } from "./textures";

/** World units are millimetres. Asnost is 3 mm tall. */
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export type Vec = [number, number, number];
export type Cam = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll?: number; focus?: number };

export const TABLE_Y = 770;
export const H0 = V(6, 0, 0); // landing spot / clearing centre / where the drop traps him
export const HF = V(11, 0, 2); // where he stands after escaping the drop
export const RICE = V(15.5, 0, -3.5);
export const CRUMB = V(5.5, 0, -6.5);
export const BLADE = V(1, 0, 15); // hero grass blade with the final drop
export const BLADE_H = 46;
export const TABLE_LEG = V(-26, 0, -70);

export type Look = {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  fog: string;
  fogDensity: number;
  sun: number;
  hemi: number;
};

// ---------------------------------------------------------------- camera + lights

const Rig: React.FC<{ cam: Cam; near: number; far: number }> = ({ cam, near, far }) => {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = cam.fov;
    c.aspect = size.width / size.height;
    c.near = near;
    c.far = far;
    c.position.copy(cam.pos);
    c.up.set(0, 1, 0);
    c.lookAt(cam.look);
    if (cam.roll) c.rotateZ(cam.roll);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }, [camera, size, cam, near, far]);
  return null;
};

export const SUN_DIR = V(-0.45, 0.8, 0.4).normalize();

export const World: React.FC<{
  cam: Cam;
  near: number;
  far: number;
  background: boolean;
  look: Look;
  shadowAt: THREE.Vector3;
  shadowBox: number;
  children?: React.ReactNode;
}> = ({ cam, near, far, background, look, shadowAt, shadowBox, children }) => {
  const { scene, gl } = useThree();
  const sky = useMemo(() => skyTexture(look.skyTop, look.skyMid, look.skyBottom), [look.skyTop, look.skyMid, look.skyBottom]);
  const sun = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    scene.background = background ? sky : null;
    scene.fog = new THREE.FogExp2(new THREE.Color(look.fog).getHex(), look.fogDensity);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.setClearColor(0x000000, 0);
    const l = sun.current;
    if (l) {
      l.position.copy(shadowAt).addScaledVector(SUN_DIR, shadowBox * 3);
      l.target.position.copy(shadowAt);
      l.target.updateMatrixWorld();
      const c = l.shadow.camera;
      c.left = c.bottom = -shadowBox;
      c.right = c.top = shadowBox;
      c.near = 0.1;
      c.far = shadowBox * 8;
      c.updateProjectionMatrix();
      l.shadow.mapSize.set(2048, 2048);
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.02;
      l.shadow.radius = 3;
    }
  }, [scene, gl, sky, background, look.fog, look.fogDensity, shadowAt, shadowBox]);
  return (
    <>
      <Rig cam={cam} near={near} far={far} />
      <ambientLight intensity={0.25 * look.hemi} color="#cfe0ff" />
      <hemisphereLight args={["#cfe3ff", "#4a3a22", 1.1 * look.hemi]} />
      <directionalLight ref={sun} intensity={3.2 * look.sun} color="#fff1d6" castShadow />
      {children}
    </>
  );
};

// ---------------------------------------------------------------- helpers

/** Cylinder from a to b. */
export const Seg: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; r: number; r2?: number; material: THREE.Material; cast?: boolean }> = ({ a, b, r, r2, material, cast = true }) => {
  const d = b.clone().sub(a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  return (
    <mesh position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q} material={material} castShadow={cast}>
      <cylinderGeometry args={[r2 ?? r, r, len, 8, 1]} />
    </mesh>
  );
};

// ---------------------------------------------------------------- water

const WATER_VS = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FS = /* glsl */ `
uniform vec3 sun; uniform vec3 skyTop; uniform vec3 skyHor; uniform vec3 ground; uniform vec3 tint;
uniform float opacity; uniform float sparkle; uniform float body;
varying vec3 vN; varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  float ndv = max(dot(N, V), 0.0);
  float f = pow(1.0 - ndv, 2.6);
  vec3 R = reflect(-V, N);
  vec3 env = R.y > 0.0 ? mix(skyHor, skyTop, pow(R.y, 0.6)) : mix(skyHor, ground, pow(-R.y, 0.35));
  float rs = max(dot(R, sun), 0.0);
  float spec = pow(rs, 400.0) * 9.0 * sparkle + pow(rs, 40.0) * 0.5;
  // light focused through the drop shows up as a glow on the side away from the sun
  float caustic = pow(max(dot(-N, sun), 0.0), 6.0) * 0.5;
  // a drop is a little lens: it shows the world upside down (sky at the bottom, dark grass at the top)
  float up = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 lens = mix(skyHor * 0.95 + vec3(0.04), vec3(0.04, 0.08, 0.02), smoothstep(0.15, 0.85, up));
  vec3 inner = mix(tint * (0.6 + caustic), lens, body);
  float rim = smoothstep(0.55, 1.0, 1.0 - ndv);
  vec3 col = mix(inner, env * mix(1.0, 0.5, body), f);
  col = mix(col, col * 0.2, rim * (0.25 + 0.6 * body));
  col += vec3(spec) + tint * caustic * (1.0 - body * 0.5);
  float a = clamp(opacity * (0.12 + 0.88 * f + body * 0.7 * (1.0 - f)) + spec + caustic * 0.2 * opacity, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const waterMaterial = (opacity = 1, tint = "#bfe3f0", side: THREE.Side = THREE.DoubleSide) =>
  new THREE.ShaderMaterial({
    vertexShader: WATER_VS,
    fragmentShader: WATER_FS,
    transparent: true,
    depthWrite: false,
    side,
    uniforms: {
      sun: { value: SUN_DIR.clone() },
      skyTop: { value: new THREE.Color("#e8f4ff") },
      skyHor: { value: new THREE.Color("#c9dcc0") },
      ground: { value: new THREE.Color("#2a2015") },
      tint: { value: new THREE.Color(tint) },
      opacity: { value: opacity },
      sparkle: { value: 1 },
      body: { value: 0 },
    },
  });

/** A free-falling drop: nearly spherical, flattened underneath, gently wobbling. */
export const Drop: React.FC<{ pos: THREE.Vector3; r: number; t: number; wobble?: number; dim?: number }> = ({ pos, r, t, wobble = 1, dim = 1 }) => {
  const mat = useMemo(() => {
    const m = waterMaterial(1, "#cfe8f2", THREE.FrontSide);
    m.uniforms.body.value = 0.8;
    return m;
  }, []);
  mat.uniforms.opacity.value = dim;
  const wb = Math.sin(t * 9) * 0.06 * wobble;
  return (
    <mesh position={pos} scale={[r * (1.04 + wb), r * (0.93 - wb), r * (1.04 + wb)]} material={mat} renderOrder={5}>
      <sphereGeometry args={[1, 48, 32]} />
    </mesh>
  );
};

/** Drop lying on the ground (contact angle ~100°), optionally bulged where Asnost pushes. */
export const Dome: React.FC<{
  pos: THREE.Vector3;
  r: number;
  h: number;
  t: number;
  bulgeDir?: THREE.Vector3;
  bulge?: number;
  wobble?: number;
  grow?: number;
}> = ({ pos, r, h, t, bulgeDir, bulge = 0, wobble = 0.3, grow = 1 }) => {
  const mat = useMemo(() => {
    const m = waterMaterial(1, "#bfe2ee");
    m.uniforms.body.value = 0.12; // keep it clear enough to see Asnost inside
    return m;
  }, []);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 72, 48), []);
  const base = useMemo(() => (geo.attributes.position.array as Float32Array).slice(), [geo]);
  useLayoutEffect(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const bd = bulgeDir ? bulgeDir.clone().normalize() : V(1, 0, 0);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
      const ang = Math.acos(Math.min(1, Math.max(-1, v.dot(bd))));
      const push = bulge * Math.exp(-(ang * ang) / 0.18);
      const wob = 1 + wobble * 0.05 * Math.sin(t * 7 + v.x * 3 + v.z * 2) * Math.max(0, v.y + 0.3);
      const x = v.x * r * wob + bd.x * push;
      const z = v.z * r * wob + bd.z * push;
      const y = (v.y * 0.5 + 0.5) * h * wob - h * 0.12 + Math.max(0, push * 0.15);
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  }, [geo, base, r, h, t, bulgeDir, bulge, wobble]);
  return (
    <group position={pos} scale={[grow, grow, grow]}>
      <mesh geometry={geo} material={mat} renderOrder={6} />
      {/* sunlight focused by the drop: bright caustic on the ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-SUN_DIR.x * h * 0.5, 0.02, -SUN_DIR.z * h * 0.5]} renderOrder={4}>
        <planeGeometry args={[r * 1.6, r * 1.6]} />
        <meshBasicMaterial map={puffTexture()} color="#fff4d0" transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

/** Impact splash: rising crown sheet + flying droplets. k = seconds since impact. */
export const Splash: React.FC<{ at: THREE.Vector3; k: number; size?: number; seed?: number }> = ({ at, k, size = 1, seed = 3 }) => {
  const mat = useMemo(() => waterMaterial(1, "#d4ecf5"), []);
  const dropMat = useMemo(() => {
    const m = waterMaterial(1, "#d4ecf5", THREE.FrontSide);
    m.uniforms.body.value = 0.8;
    return m;
  }, []);
  const drops = useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({ length: 26 }, () => {
      const a = r() * Math.PI * 2;
      const sp = 6 + r() * 10;
      return { dir: V(Math.cos(a), 0, Math.sin(a)), sp, up: 10 + r() * 16, rad: 0.18 + r() * 0.35 };
    });
  }, [seed]);
  if (k < 0 || k > 1.4) return null;
  const crown = Math.min(1, k / 0.25);
  const fade = Math.max(0, 1 - k / 0.6);
  mat.uniforms.opacity.value = fade * 0.6;
  const g = 40;
  return (
    <group position={at} scale={[size, size, size]}>
      {fade > 0 && (
        <mesh position={[0, 1.6 * crown, 0]} material={mat} renderOrder={7}>
          <cylinderGeometry args={[1.6 + 4.5 * crown, 1.2 + 2.2 * crown, 3.2 * crown + 0.01, 48, 1, true]} />
        </mesh>
      )}
      {drops.map((d, i) => {
        const x = d.sp * k;
        const y = d.up * k - 0.5 * g * k * k;
        if (y < -0.2) return null;
        const p = d.dir.clone().multiplyScalar(2 + x).add(V(0, Math.max(0, y) + 0.3, 0));
        return (
          <mesh key={i} position={p} scale={d.rad} material={dropMat} renderOrder={7}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Background rain: drops falling in slow motion around the clearing, each with its own little splash. */
export const Rain: React.FC<{ t: number; t0: number; k: number; center: THREE.Vector3 }> = ({ t, t0, k, center }) => {
  const items = useMemo(() => {
    const r = mulberry32(77);
    return Array.from({ length: 34 }, () => {
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 70;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, ph: r(), rad: 1.0 + r() * 1.2 };
    });
  }, []);
  if (k <= 0) return null;
  const PERIOD = 1.3;
  return (
    <group position={center}>
      {items.map((it, i) => {
        const age = ((t - t0) / PERIOD + it.ph) % 1;
        const cyc = Math.floor((t - t0) / PERIOD + it.ph);
        if (t - t0 + it.ph * PERIOD < PERIOD * 0.4 && i % 2) return null; // ramp up density
        const fall = 0.65;
        if (age < fall) {
          const y = 90 * (1 - age / fall) + it.rad;
          return <Drop key={i} pos={V(it.x, y, it.z)} r={it.rad} t={t + i} dim={k} />;
        }
        return <Splash key={i} at={V(it.x, 0, it.z)} k={(age - fall) * PERIOD} size={it.rad * 0.6} seed={i + cyc * 7} />;
      })}
    </group>
  );
};

// ---------------------------------------------------------------- ground, grass, props

/** Dense green lawn texture under the far grass, faded out toward the bare clearing. */
const Lawn: React.FC = () => {
  const mat = useMemo(() => {
    const map = lawnTexture().clone();
    map.repeat.set(40, 40);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.8, vertexColors: true, transparent: true, depthWrite: false, emissive: "#2a4a10", emissiveIntensity: 0.25 });
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.RingGeometry(55, 20000, 96, 40);
    const p = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const cols: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i));
      const a = Math.min(1, Math.max(0, (r - 55) / 90));
      cols.push(1, 1, 1, a);
      uv.setXY(i, p.getX(i) / 3000 + 0.5, p.getY(i) / 3000 + 0.5); // ~75 mm tiles with repeat 40
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 4));
    return g;
  }, []);
  return <mesh geometry={geo} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[H0.x, 0.05, H0.z]} receiveShadow renderOrder={1} />;
};

export const Ground: React.FC = () => {
  const mat = useMemo(() => {
    const map = soilTexture().clone();
    map.repeat.set(1500, 1500);
    map.needsUpdate = true;
    const bump = soilBump().clone();
    bump.repeat.set(1500, 1500);
    bump.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.5, roughness: 0.95, color: "#ffffff" });
  }, []);
  // pebbles / sand grains, dense around the clearing
  const pebbles = useMemo(() => {
    const r = mulberry32(9);
    const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 3));
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const s = 0.8 + 0.4 * fbm(p.getX(i) * 2 + 5, p.getZ(i) * 2 + p.getY(i), 3, 2, 64);
      p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.6, p.getZ(i) * s);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, color: "#ffffff" });
    const N = 1400;
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.pow(r(), 0.7) * 90;
      const x = H0.x + Math.cos(a) * d, z = H0.z + Math.sin(a) * d;
      const s = 0.08 + Math.pow(r(), 3) * 0.75;
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
      m.compose(V(x, s * 0.25, z), q, V(s, s, s));
      mesh.setMatrixAt(i, m);
      const tone = 0.22 + r() * 0.3;
      c.setRGB(tone * 1.0, tone * 0.85, tone * 0.66);
      mesh.setColorAt(i, c);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow>
        <planeGeometry args={[60000, 60000]} />
      </mesh>
      <primitive object={pebbles} />
      <Lawn />
    </>
  );
};

/** Tapered, folded, curved blade of unit width/height (bend along +z). */
const bladeGeometry = () => {
  const SEG = 12;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const base = new THREE.Color("#3a5a1c"), mid = new THREE.Color("#6aa533"), tip = new THREE.Color("#c2dc72");
  for (let i = 0; i <= SEG; i++) {
    const y = i / SEG;
    const hw = 0.5 * (1 - Math.pow(y, 2.2)) + 0.01;
    const z = 0.28 * y * y;
    const fold = 0.12 * hw;
    pos.push(-hw, y, z + fold, 0, y, z - fold * 0.2, hw, y, z + fold);
    const c = y < 0.5 ? base.clone().lerp(mid, y * 2) : mid.clone().lerp(tip, (y - 0.5) * 2);
    for (let k = 0; k < 3; k++) col.push(c.r * (k === 1 ? 1.1 : 1), c.g * (k === 1 ? 1.1 : 1), c.b);
    if (i < SEG) {
      const a = i * 3;
      idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

type Blade = { x: number; z: number; w: number; h: number; yaw: number; lean: number; ph: number; tint: number };

const makeBlades = (): Blade[] => {
  const r = mulberry32(21);
  const out: Blade[] = [];
  // composed "hero" blades around the clearing
  const hero: [number, number, number, number][] = [
    [BLADE.x, BLADE.z, 3.6, BLADE_H], [-9, 8, 3.4, 70], [-12, -4, 4, 95], [22, -14, 3.8, 80], [52, 12, 4.2, 110],
    [-4, 22, 3.5, 60], [18, 50, 3.8, 85], [-16, 16, 4.2, 120], [34, -8, 3.6, 66], [8, -20, 4, 92], [40, 40, 4.4, 130],
  ];
  for (const [x, z, w, h] of hero) out.push({ x, z, w, h, yaw: Math.atan2(H0.x - x, H0.z - z) + Math.PI + (r() - 0.5) * 0.6, lean: 0.05 + r() * 0.1, ph: r() * 6, tint: 0.9 + r() * 0.2 });
  out[0].yaw = Math.PI * 0.5; // final blade bends toward +x
  let n = 0;
  while (out.length < 1700 && n < 20000) {
    n++;
    const a = r() * Math.PI * 2;
    const d = 18 + Math.pow(r(), 0.8) * 520;
    const x = H0.x + Math.cos(a) * d, z = H0.z + Math.sin(a) * d;
    if (Math.hypot(x - TABLE_LEG.x, z - TABLE_LEG.z) < 26) continue;
    if (Math.hypot(x - RICE.x, z - RICE.z) < 9 || Math.hypot(x - CRUMB.x, z - CRUMB.z) < 7) continue;
    // keep a corridor free for the cameras (they mostly sit on the +x/+z side of the clearing)
    const ang = Math.atan2(z - H0.z, x - H0.x);
    if (d < 75 && ang > -0.15 && ang < 1.75) continue;
    if (d < 32) continue;
    const near = d < 90;
    // near the clearing blades arch outward, away from it; far away they point anywhere
    const out_ = Math.atan2(x - H0.x, z - H0.z);
    const yaw = near ? out_ + (r() - 0.5) * 1.2 : r() * Math.PI * 2;
    out.push({ x, z, w: 2.6 + r() * 2.2, h: (near ? 45 : 60) + r() * (near ? 70 : 110), yaw, lean: r() * (near ? 0.12 : 0.25), ph: r() * 6, tint: 0.8 + r() * 0.35 });
  }
  return out;
};

export const Grass: React.FC<{ t: number; wind: number }> = ({ t, wind }) => {
  const blades = useMemo(makeBlades, []);
  const mesh = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide, emissive: "#3c6a16", emissiveIntensity: 0.45 });
    const m = new THREE.InstancedMesh(bladeGeometry(), mat, blades.length);
    const c = new THREE.Color();
    blades.forEach((b, i) => m.setColorAt(i, c.setRGB(b.tint, b.tint * (0.95 + (i % 5) * 0.02), b.tint * 0.85)));
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    return m;
  }, [blades]);
  useLayoutEffect(() => {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    blades.forEach((b, i) => {
      const sway = Math.sin(t * 1.3 + b.ph) * 0.03 * wind + Math.sin(t * 3.1 + b.ph * 2) * 0.012 * wind;
      e.set(b.lean + sway, b.yaw, 0, "YXZ");
      q.setFromEuler(e);
      m4.compose(V(b.x, 0, b.z), q, V(b.w, b.h, b.h));
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [mesh, blades, t, wind]);
  return <primitive object={mesh} />;
};

/** Point on the hero blade at fraction y of its height (for the final drop). */
export const bladePoint = (y: number) => {
  const b = { yaw: Math.PI * 0.5, lean: 0.05 + 0.0, w: 3.6, h: BLADE_H };
  const local = V(0, y, 0.28 * y * y).multiply(V(b.w, b.h, b.h));
  return local.applyEuler(new THREE.Euler(b.lean, b.yaw, 0, "YXZ")).add(BLADE);
};

export const Table: React.FC = () => {
  const top = useMemo(() => {
    const map = woodTexture().clone();
    map.repeat.set(24, 8);
    map.rotation = Math.PI / 2;
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.75 });
  }, []);
  return (
    <group>
      <mesh position={[-350, TABLE_Y - 11, 0]} material={top} castShadow receiveShadow>
        <boxGeometry args={[700, 22, 600]} />
      </mesh>
      <mesh position={[TABLE_LEG.x, (TABLE_Y - 22) / 2, TABLE_LEG.z]} material={top} castShadow receiveShadow>
        <cylinderGeometry args={[17, 19, TABLE_Y - 22, 24]} />
      </mesh>
    </group>
  );
};

export const Rice: React.FC<{ pos: THREE.Vector3; rot: Vec }> = ({ pos, rot }) => {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#f3eee0", roughness: 0.38, clearcoat: 0.4, sheen: 0.3, sheenColor: new THREE.Color("#ffffff") }), []);
  return (
    <mesh position={pos} rotation={rot} scale={[1.1, 1.0, 3.5]} material={mat} castShadow receiveShadow>
      <sphereGeometry args={[1, 32, 20]} />
    </mesh>
  );
};

export const Crumb: React.FC<{ pos: THREE.Vector3 }> = ({ pos }) => {
  const { geo, mat } = useMemo(() => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(2.6, 5));
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const v = V(p.getX(i), p.getY(i), p.getZ(i));
      const n = fbm(v.x * 0.9 + 10, v.y * 0.9 + v.z * 0.7 + 3, 5, 4, 64);
      const pore = fbm(v.x * 3.5, v.y * 3.5 + v.z * 2.1, 8, 2, 64) < 0.35 ? 0.9 : 1;
      v.multiplyScalar((0.75 + n * 0.55) * pore);
      v.y *= 0.72;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const map = breadTexture().clone();
    map.repeat.set(2, 2);
    map.needsUpdate = true;
    return { geo: g, mat: new THREE.MeshStandardMaterial({ map, roughness: 0.92, color: "#f1d9a8" }) };
  }, []);
  return <mesh geometry={geo} material={mat} position={[pos.x, pos.y + 1.4, pos.z]} rotation={[0.2, 0.7, 0.1]} castShadow receiveShadow />;
};

/** Out-of-focus sun glints far away (only visible in the blurred background layers). */
export const Bokeh: React.FC<{ k: number; center: THREE.Vector3 }> = ({ k, center }) => {
  const items = useMemo(() => {
    const r = mulberry32(55);
    return Array.from({ length: 70 }, () => {
      const a = r() * Math.PI * 2;
      const d = 180 + r() * 900;
      return { p: V(Math.cos(a) * d, 15 + r() * 160, Math.sin(a) * d), s: 25 + r() * 70, c: r() < 0.5 ? "#fff3c4" : r() < 0.5 ? "#d8f5a2" : "#ffffff", o: 0.12 + r() * 0.2 };
    });
  }, []);
  if (k <= 0) return null;
  return (
    <group position={center}>
      {items.map((b, i) => (
        <sprite key={i} position={b.p} scale={[b.s, b.s, 1]}>
          <spriteMaterial map={bokehTexture()} color={b.c} transparent opacity={b.o * k} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </sprite>
      ))}
    </group>
  );
};

/** Soft particles (heat leaving the body, spray). */
export const Puffs: React.FC<{ items: { pos: THREE.Vector3; size: number; opacity: number; color: string }[] }> = ({ items }) => (
  <>
    {items.map((p, i) => (
      <sprite key={i} position={p.pos} scale={[p.size, p.size, 1]} renderOrder={8}>
        <spriteMaterial map={puffTexture()} color={p.color} transparent opacity={p.opacity} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    ))}
  </>
);

/** Air streaming up past a slowly falling body. */
export const AirLines: React.FC<{ t: number; center: THREE.Vector3; k: number }> = ({ t, center, k }) => {
  const lines = useMemo(() => {
    const r = mulberry32(13);
    return Array.from({ length: 22 }, () => ({ x: (r() - 0.5) * 7, z: (r() - 0.5) * 7, ph: r(), len: 1.5 + r() * 2.5 }));
  }, []);
  if (k <= 0) return null;
  return (
    <group position={center}>
      {lines.map((l, i) => {
        if (Math.hypot(l.x, l.z) < 1.2) return null;
        const y = (((t * 0.9 + l.ph) % 1) - 0.5) * 12;
        const o = Math.sin((((t * 0.9 + l.ph) % 1)) * Math.PI) * 0.45 * k;
        return (
          <mesh key={i} position={[l.x, y, l.z]} renderOrder={8}>
            <cylinderGeometry args={[0.025, 0.025, l.len, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={o} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------- Asnost

export type Pose = {
  walk?: number; // gait phase (radians)
  walkAmt?: number;
  armsUp?: number; // 0..1, both arms raised overhead (lifting)
  flex?: number; // 0..1, strongman flex
  spread?: number; // 0..1, skydiver pose
  hug?: number; // 0..1, arms wrapped around body
  push?: number; // 0..1, both arms forward pushing
  flail?: number; // 0..1, panicked arm movement
  crouch?: number;
  lookUp?: number;
  shiver?: number;
};

/** Asnost: built in metres (1.8 m) and scaled to 3 mm. Faces +z. */
export const Hero: React.FC<{ t: number; pose: Pose; wet?: number }> = ({ t, pose, wet = 0 }) => {
  const mats = useMemo(
    () => ({
      shirt: new THREE.MeshStandardMaterial({ color: "#e8692a", roughness: 0.8 }),
      jeans: new THREE.MeshStandardMaterial({ color: "#2f4466", roughness: 0.85 }),
      skin: new THREE.MeshStandardMaterial({ color: "#c79574", roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: "#1e140e", roughness: 0.7 }),
      shoe: new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.6 }),
      water: waterMaterial(0, "#d8f0fa"),
    }),
    [],
  );
  mats.water.uniforms.opacity.value = wet;
  const { walk = 0, walkAmt = 0, armsUp = 0, flex = 0, spread = 0, hug = 0, push = 0, flail = 0, crouch = 0, lookUp = 0, shiver = 0 } = pose;
  const sh = shiver * Math.sin(t * 60) * 0.03;
  const legSwing = Math.sin(walk) * 0.55 * walkAmt;
  const fl = (k: number) => flail * Math.sin(t * 13 + k) * 0.9;
  const hipY = 0.95 - crouch * 0.35;
  // arm angles: x = forward swing (negative = forward), z = sideways (positive = out for right arm)
  const arm = (sg: number) => {
    let x = sg * legSwing * 0.8;
    let z = 0.12;
    let elbow = 0.15;
    let bend = 0; // forearm rotation about its local z (up for flex, inward for hug)
    x += -1.5 * push;
    z += 1.25 * spread;
    x += (-2.9 - x) * armsUp;
    z += (0.25 - z) * armsUp;
    elbow += 0.5 * armsUp;
    z += (1.45 - z) * flex;
    elbow += (0.1 - elbow) * flex;
    bend += 2.1 * flex;
    x += (-0.55 - x) * hug;
    z += (0.05 - z) * hug;
    elbow += (0.35 - elbow) * hug;
    bend += -1.75 * hug;
    x += fl(sg * 2);
    z += Math.abs(fl(sg * 3)) * 0.6;
    return { x, z, elbow, bend };
  };
  const W = (k: number) => (wet > 0.01 ? k : 0);
  const part = (r: number, len: number, m: THREE.Material, pos?: Vec, rot?: Vec) => (
    <group position={pos} rotation={rot}>
      <mesh material={m} castShadow>
        <capsuleGeometry args={[r, len, 6, 12]} />
      </mesh>
      {W(1) > 0 && (
        <mesh material={mats.water} scale={[1.18, 1.06, 1.18]} renderOrder={6}>
          <capsuleGeometry args={[r, len, 6, 12]} />
        </mesh>
      )}
    </group>
  );
  return (
    <group scale={3 / 1.8} rotation={[0, 0, sh]}>
      {/* legs */}
      {[-1, 1].map((sg) => {
        const thigh = -sg * legSwing - crouch * 1.1 + spread * 0.15;
        const knee = crouch * 2.0 + Math.max(0, sg * legSwing) * 0.6 * walkAmt + spread * 0.5;
        return (
          <group key={sg} position={[sg * 0.11, hipY, 0]} rotation={[thigh, 0, sg * (0.03 + spread * 0.35)]}>
            {part(0.075, 0.33, mats.jeans, [0, -0.22, 0])}
            <group position={[0, -0.45, 0]} rotation={[knee, 0, 0]}>
              {part(0.065, 0.34, mats.jeans, [0, -0.22, 0])}
              <mesh position={[0, -0.45, 0.05]} material={mats.shoe} castShadow>
                <boxGeometry args={[0.12, 0.08, 0.27]} />
              </mesh>
            </group>
          </group>
        );
      })}
      {/* torso + head */}
      <group position={[0, hipY, 0]} rotation={[crouch * 0.5 - hug * 0.2, 0, 0]}>
        {part(0.17, 0.28, mats.shirt, [0, 0.36, 0])}
        <mesh position={[0, 0.08, 0]} material={mats.jeans} castShadow>
          <cylinderGeometry args={[0.172, 0.165, 0.16, 16]} />
        </mesh>
        <group position={[0, 0.64, 0]} rotation={[-lookUp * 0.6, 0, 0]}>
          <mesh position={[0, 0.03, 0]} material={mats.skin} castShadow>
            <capsuleGeometry args={[0.06, 0.05, 4, 8]} />
          </mesh>
          <mesh position={[0, 0.16, 0.01]} scale={[1, 1.12, 1.05]} material={mats.skin} castShadow>
            <sphereGeometry args={[0.115, 20, 16]} />
          </mesh>
          <mesh position={[0, 0.185, -0.008]} scale={[1.06, 1.12, 1.1]} material={mats.hair} castShadow>
            <sphereGeometry args={[0.116, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          </mesh>
          {wet > 0.01 && (
            <mesh position={[0, 0.16, 0.01]} scale={[1.12, 1.2, 1.15]} material={mats.water} renderOrder={6}>
              <sphereGeometry args={[0.11, 20, 16]} />
            </mesh>
          )}
        </group>
        {/* arms */}
        {[-1, 1].map((sg) => {
          const a = arm(sg);
          return (
            <group key={sg} position={[sg * 0.22, 0.56, 0]} rotation={[a.x, 0, sg * a.z]}>
              {part(0.055, 0.22, mats.shirt, [0, -0.14, 0])}
              <group position={[0, -0.3, 0]} rotation={[-a.elbow, 0, sg * a.bend]}>
                {part(0.045, 0.22, mats.skin, [0, -0.15, 0])}
                <mesh position={[0, -0.32, 0]} material={mats.skin} castShadow>
                  <sphereGeometry args={[0.055, 12, 10]} />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- the ant

/** Worker ant ~5 mm long (Lasius-like), walks along +z. `walk` = gait phase in cycles. */
export const Ant: React.FC<{ walk: number; t: number; headTurn?: number }> = ({ walk, t, headTurn = 0 }) => {
  const mats = useMemo(
    () => ({
      chitin: new THREE.MeshPhysicalMaterial({ color: "#2b1a12", roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.25 }),
      leg: new THREE.MeshPhysicalMaterial({ color: "#3a2418", roughness: 0.45, clearcoat: 0.6 }),
      eye: new THREE.MeshPhysicalMaterial({ color: "#050505", roughness: 0.1, clearcoat: 1 }),
      hair: new THREE.MeshBasicMaterial({ color: "#c9b8a0", transparent: true, opacity: 0.35 }),
    }),
    [],
  );
  const bob = Math.abs(Math.sin(walk * Math.PI * 2)) * 0.04;
  const hips: [number, number, number, number][] = [
    // side, hipZ, footX, footZ
    [1, 0.75, 1.45, 1.6], [1, 0.35, 1.75, 0.25], [1, -0.05, 1.55, -1.35],
    [-1, 0.75, 1.45, 1.6], [-1, 0.35, 1.75, 0.25], [-1, -0.05, 1.55, -1.35],
  ];
  const STRIDE = 1.1;
  return (
    <group position={[0, bob, 0]}>
      <mesh position={[0, 0.95, -1.55]} scale={[0.85, 0.72, 1.15]} rotation={[0.25, 0, 0]} material={mats.chitin} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      <mesh position={[0, 0.9, -0.38]} scale={[0.18, 0.28, 0.16]} material={mats.chitin} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      <mesh position={[0, 1.0, 0.35]} scale={[0.36, 0.38, 0.8]} rotation={[-0.25, 0, 0]} material={mats.chitin} castShadow>
        <sphereGeometry args={[1, 24, 18]} />
      </mesh>
      <group position={[0, 1.22, 1.35]} rotation={[0.15, headTurn, 0]}>
        <mesh scale={[0.55, 0.5, 0.55]} material={mats.chitin} castShadow>
          <sphereGeometry args={[1, 28, 20]} />
        </mesh>
        {[-1, 1].map((sg) => (
          <mesh key={sg} position={[sg * 0.46, 0.08, 0.2]} scale={[0.12, 0.17, 0.17]} material={mats.eye}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
        ))}
        {[-1, 1].map((sg) => (
          <Seg key={sg} a={V(sg * 0.2, -0.25, 0.42)} b={V(sg * 0.05, -0.32, 0.85 + 0.05 * Math.sin(t * 6))} r={0.07} r2={0.02} material={mats.leg} />
        ))}
        {[-1, 1].map((sg) => {
          const sway = Math.sin(t * 3.2 + sg) * 0.25;
          const base = V(sg * 0.22, 0.3, 0.42);
          const elbow = V(sg * (0.6 + sway * 0.3), 1.0, 0.85);
          const tip = V(sg * (0.75 + sway * 0.6), 0.55 + sway * 0.4, 1.9);
          return (
            <group key={sg}>
              <Seg a={base} b={elbow} r={0.04} material={mats.leg} />
              <Seg a={elbow} b={tip} r={0.045} r2={0.06} material={mats.leg} />
            </group>
          );
        })}
      </group>
      {hips.map(([sg, hz, fx, fz], i) => {
        const group = (i % 3 === 1 ? 0 : 0.5) + (sg > 0 ? 0 : 0.5);
        const ph = (((walk + group) % 1) + 1) % 1;
        const swing = ph < 0.5;
        const z = swing ? -0.5 * STRIDE * Math.cos(ph * 2 * Math.PI) : 0.5 * STRIDE * (1 - 4 * (ph - 0.5));
        const lift = swing ? Math.sin(ph * 2 * Math.PI) * 0.5 : 0;
        const hip = V(sg * 0.3, 0.85, hz);
        const foot = V(sg * fx, lift, fz + z);
        const knee = hip.clone().add(foot).multiplyScalar(0.5).add(V(sg * 0.35, 0.85, 0));
        return (
          <group key={i}>
            <Seg a={hip} b={knee} r={0.07} r2={0.06} material={mats.leg} />
            <Seg a={knee} b={foot} r={0.05} r2={0.025} material={mats.leg} />
          </group>
        );
      })}
    </group>
  );
};
