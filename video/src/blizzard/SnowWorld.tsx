import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "../sim/rng";
import { beamTexture, fbm, flakeTexture, puffTexture, roadTexture, snowBump, snowTexture } from "./textures";

/** Spot light whose target lives in the scene graph (so it follows its parent's transform). */
export const Spot: React.FC<{
  position: [number, number, number];
  target: [number, number, number];
  intensity: number;
  angle: number;
  penumbra: number;
  distance: number;
  decay: number;
  color: string;
}> = ({ position, target, ...rest }) => {
  const obj = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <primitive object={obj} position={target} />
      <spotLight position={position} target={obj} {...rest} />
    </>
  );
};

export type Cam = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll?: number };

const Rig: React.FC<{ cam: Cam }> = ({ cam }) => {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.fov = cam.fov;
    c.aspect = size.width / size.height;
    c.near = 0.05;
    c.far = 3000;
    c.position.copy(cam.pos);
    c.up.set(0, 1, 0);
    c.lookAt(cam.look);
    if (cam.roll) c.rotateZ(cam.roll);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }, [camera, size, cam]);
  return null;
};

/** Ground height of the open steppe (road corridor is flat). */
const steppeH = (x: number, z: number) => {
  const away = Math.min(1, Math.max(0, (Math.abs(x) - 6) / 25));
  return (fbm(x / 60 + 50, z / 60 + 50, 4, 4, 1024) - 0.5) * 5 * away + (fbm(x / 9 + 9, z / 25, 6, 3, 1024) - 0.5) * 0.6 * away;
};

const Terrain: React.FC = () => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1600, 1600, 260, 260).rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, steppeH(p.getX(i), p.getZ(i)) - 0.05);
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => {
    const map = snowTexture().clone();
    map.repeat.set(160, 160);
    map.needsUpdate = true;
    const bump = snowBump().clone();
    bump.repeat.set(160, 160);
    bump.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.95, color: "#ffffff" });
  }, []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
};

const Road: React.FC = () => {
  const mat = useMemo(() => {
    const map = roadTexture().clone();
    map.repeat.set(1, 120);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, -300]} material={mat} receiveShadow>
      <planeGeometry args={[8, 1600]} />
    </mesh>
  );
};

/** Roadside delineator posts and a line of power poles along the highway. */
const Roadside: React.FC = () => {
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    for (let z = 300; z > -1000; z -= 40) {
      out.push([-4.6, z]);
      out.push([4.6, z + 20]);
    }
    return out;
  }, []);
  const poles = useMemo(() => {
    const out: number[] = [];
    for (let z = 300; z > -1000; z -= 55) out.push(z);
    return out;
  }, []);
  return (
    <group>
      {posts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.1, 1.0, 0.1]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.85, x > 0 ? -0.051 : 0.051]}>
            <boxGeometry args={[0.08, 0.14, 0.01]} />
            <meshStandardMaterial color="#ff8a1a" emissive="#ff6a00" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      {poles.map((z) => (
        <group key={z} position={[-11, 0, z]}>
          <mesh position={[0, 4.5, 0]}>
            <cylinderGeometry args={[0.11, 0.14, 9, 8]} />
            <meshStandardMaterial color="#3b3027" roughness={0.9} />
          </mesh>
          <mesh position={[0, 8.6, 0]}>
            <boxGeometry args={[1.8, 0.1, 0.1]} />
            <meshStandardMaterial color="#3b3027" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/** Drift around the stuck car: heightfield, H = depth at the car, windward side (+X) higher. */
export const Drift: React.FC<{ at: [number, number, number]; yaw: number; depth: number; pipe: number }> = ({ at, yaw, depth, pipe }) => {
  const H = Math.round(depth * 40) / 40;
  const P = Math.round(pipe * 30) / 30;
  const geo = useMemo(() => {
    const S = 16, N = 140;
    const g = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // into car-local
      const lx = c * x - s * z, lz = s * x + c * z;
      const dx = Math.max(0, Math.abs(lx) - 0.95), dz = Math.max(0, Math.abs(lz) - 2.35);
      const d = Math.hypot(dx, dz);
      const wind = (lx > 0 ? 1.0 : 0.75) * (lz > 2.0 ? 0.55 : 1); // rear stays lower so the bumper shows
      let h = H * 1.05 * wind * Math.exp(-Math.pow(d / (1.2 + 1.6 * H), 2));
      // sastrugi ripple + lumps
      h += (fbm(x * 0.6 + 3, z * 0.25, 12, 3, 256) - 0.5) * 0.18 * Math.min(1, H * 2 + 0.3);
      // drift heaped over the exhaust pipe (rear-left)
      const ex = lx + 0.5, ez = lz - 2.45;
      h = Math.max(h, P * 0.62 * Math.exp(-(ex * ex) / 0.35 - (ez * ez) / 0.25));
      // edge falloff into the steppe
      const edge = Math.min(1, Math.max(0, (S / 2 - Math.max(Math.abs(x), Math.abs(z))) / 2));
      p.setY(i, Math.max(0, h) * edge - 0.02);
    }
    g.computeVertexNormals();
    return g;
  }, [H, P, yaw]);
  const mat = useMemo(() => {
    const map = snowTexture().clone();
    map.repeat.set(3, 3);
    map.needsUpdate = true;
    const bump = snowBump().clone();
    bump.repeat.set(3, 3);
    bump.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2, roughness: 0.95 });
  }, []);
  return <mesh geometry={geo} material={mat} position={at} receiveShadow />;
};

/** Snowfall: points wrapped in a box around the camera, driven by time and wind; lit by headlight cones. */
export const Snowfall: React.FC<{
  t: number;
  camPos: THREE.Vector3;
  wind: THREE.Vector3;
  count: number;
  box: number;
  size: number;
  ambient: THREE.Color;
  fog: { color: THREE.Color; density: number };
  lights: { pos: THREE.Vector3; dir: THREE.Vector3; power: number }[];
  seed: number;
}> = ({ t, camPos, wind, count, box, size, ambient, fog, lights, seed }) => {
  const geo = useMemo(() => {
    const r = mulberry32(seed);
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r() * box;
      pos[i * 3 + 1] = r() * box * 0.6;
      pos[i * 3 + 2] = r() * box;
      rnd[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("rnd", new THREE.BufferAttribute(rnd, 1));
    return g;
  }, [count, box, seed]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          time: { value: 0 },
          cam: { value: new THREE.Vector3() },
          wind: { value: new THREE.Vector3() },
          box: { value: box },
          size: { value: size },
          ambient: { value: new THREE.Color() },
          fogColor: { value: new THREE.Color() },
          fogDensity: { value: 0 },
          lpos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
          ldir: { value: [new THREE.Vector3(), new THREE.Vector3()] },
          lpow: { value: [0, 0] },
          map: { value: flakeTexture() },
          screenH: { value: 1920 },
        },
        vertexShader: `
          attribute float rnd;
          uniform float time, box, size, screenH;
          uniform vec3 cam, wind;
          uniform vec3 lpos[2]; uniform vec3 ldir[2]; uniform float lpow[2];
          uniform vec3 ambient;
          varying vec3 vCol; varying float vDist;
          void main(){
            vec3 p = position;
            p += wind * time * (0.8 + 0.4 * rnd);
            p.y -= time * (1.0 + rnd);
            p.x += sin(time * (1.3 + rnd) + rnd * 40.0) * 0.6;
            p.z += cos(time * (1.1 + rnd) + rnd * 30.0) * 0.6;
            vec3 b = vec3(box, box * 0.6, box);
            p = mod(p - cam + b * 0.5, b) - b * 0.5 + cam;
            vec3 col = ambient;
            for (int i = 0; i < 2; i++) {
              vec3 d = p - lpos[i];
              float dist = length(d);
              float cone = smoothstep(0.82, 0.97, dot(d / max(dist, 1e-3), ldir[i]));
              col += vec3(1.0, 0.95, 0.85) * lpow[i] * cone / (1.0 + dist * dist * 0.012);
            }
            vCol = col;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vDist = -mv.z;
            gl_Position = projectionMatrix * mv;
            gl_PointSize = size * (0.5 + rnd) * screenH / 1920.0 * 60.0 / max(0.3, -mv.z);
          }`,
        fragmentShader: `
          uniform sampler2D map; uniform vec3 fogColor; uniform float fogDensity;
          varying vec3 vCol; varying float vDist;
          void main(){
            vec4 tx = texture2D(map, gl_PointCoord);
            float f = 1.0 - exp(-fogDensity * fogDensity * vDist * vDist);
            vec3 c = mix(vCol, fogColor, f * 0.7);
            float near = smoothstep(0.15, 0.6, vDist);
            gl_FragColor = vec4(c, tx.a * near * (1.0 - f * 0.6));
          }`,
      }),
    [box, size],
  );
  mat.uniforms.time.value = t;
  mat.uniforms.cam.value.copy(camPos);
  mat.uniforms.wind.value.copy(wind);
  mat.uniforms.ambient.value.copy(ambient);
  mat.uniforms.fogColor.value.copy(fog.color);
  mat.uniforms.fogDensity.value = fog.density;
  for (let i = 0; i < 2; i++) {
    const l = lights[i];
    mat.uniforms.lpos.value[i].copy(l ? l.pos : new THREE.Vector3());
    mat.uniforms.ldir.value[i].copy(l ? l.dir : new THREE.Vector3(0, 1, 0));
    mat.uniforms.lpow.value[i] = l ? l.power : 0;
  }
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};

/** Fake volumetric light cone (additive), pointing along -Z of its parent. */
export const Beam: React.FC<{ length: number; radius: number; opacity: number; color?: string }> = ({ length, radius, opacity, color = "#fff1d6" }) => {
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(radius, length, 32, 1, true);
    g.translate(0, -length / 2, 0); // apex at origin
    g.rotateX(Math.PI / 2); // base now at z = -length: the beam points along -Z
    return g;
  }, [length, radius]);
  if (opacity <= 0.001) return null;
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial
        color={color}
        alphaMap={beamTexture()}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        fog={false}
      />
    </mesh>
  );
};

/** Low-poly person in a dark winter jacket. walk: phase (radians), crouch 0..1, arms dig 0..1. */
export const Person: React.FC<{ walk: number; crouch?: number; dig?: number; opacity?: number }> = ({ walk, crouch = 0, dig = 0, opacity = 1 }) => {
  const jacket = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1f2a36", roughness: 0.85, transparent: true }), []);
  const pants = useMemo(() => new THREE.MeshStandardMaterial({ color: "#16181b", roughness: 0.9, transparent: true }), []);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b98a6e", roughness: 0.7, transparent: true }), []);
  const hat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5b1f22", roughness: 0.9, transparent: true }), []);
  for (const m of [jacket, pants, skin, hat]) m.opacity = opacity;
  const swing = Math.sin(walk) * 0.5 * (1 - crouch);
  const lower = crouch * 0.45;
  const armDig = Math.sin(walk * 2.2) * 0.9 * dig;
  return (
    <group position={[0, -lower, 0]}>
      {[-1, 1].map((sg) => (
        <mesh key={sg} position={[sg * 0.12, 0.45 + lower * 0.5, 0]} rotation={[sg * swing - crouch * 1.2, 0, 0]} material={pants}>
          <capsuleGeometry args={[0.08, 0.7, 4, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 1.15, 0]} rotation={[-crouch * 0.6, 0, 0]} material={jacket}>
        <capsuleGeometry args={[0.2, 0.5, 6, 12]} />
      </mesh>
      {[-1, 1].map((sg) => (
        <mesh
          key={sg}
          position={[sg * 0.27, 1.2, -crouch * 0.15]}
          rotation={[-sg * swing - dig * 1.3 + sg * armDig, 0, sg * 0.15]}
          material={jacket}
        >
          <capsuleGeometry args={[0.065, 0.55, 4, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 1.66, -crouch * 0.25]} material={skin}>
        <sphereGeometry args={[0.12, 16, 12]} />
      </mesh>
      <mesh position={[0, 1.72, -crouch * 0.25]} material={hat}>
        <sphereGeometry args={[0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
};

/** Six-wheel rescue all-terrain truck with a light bar and a rotating amber beacon. Front at -Z. */
export const RescueTruck: React.FC<{ t: number }> = ({ t }) => {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9cdd1", roughness: 0.5, metalness: 0.3 }), []);
  const stripe = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4421a", roughness: 0.5 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#121416", roughness: 0.8 }), []);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0d1218", roughness: 0.1, metalness: 0.4 }), []);
  const rot = t * 7;
  const beacon = 0.5 + 0.5 * Math.sin(rot);
  return (
    <group>
      <mesh position={[0, 1.7, 0.6]} material={body}>
        <boxGeometry args={[2.4, 1.9, 4.4]} />
      </mesh>
      <mesh position={[0, 1.2, 0.6]} material={stripe}>
        <boxGeometry args={[2.42, 0.25, 4.42]} />
      </mesh>
      <mesh position={[0, 1.55, -2.1]} material={body}>
        <boxGeometry args={[2.3, 1.5, 1.2]} />
      </mesh>
      <mesh position={[0, 1.95, -2.71]} material={glass}>
        <boxGeometry args={[2.0, 0.7, 0.02]} />
      </mesh>
      {[-1.9, 0.2, 2.2].flatMap((z) =>
        [-1.15, 1.15].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.6, z]} rotation={[0, 0, Math.PI / 2]} material={dark}>
            <cylinderGeometry args={[0.6, 0.6, 0.45, 20]} />
          </mesh>
        )),
      )}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 1.15, -2.72]}>
          <boxGeometry args={[0.32, 0.18, 0.04]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      {/* roof light bar */}
      <mesh position={[0, 2.75, -2.3]}>
        <boxGeometry args={[1.8, 0.14, 0.2]} />
        <meshBasicMaterial color={new THREE.Color("#fff8e6").multiplyScalar(3)} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.8, 0.4]}>
        <cylinderGeometry args={[0.16, 0.16, 0.22, 14]} />
        <meshBasicMaterial color={new THREE.Color("#ff8c00").multiplyScalar(0.6 + 4 * beacon)} toneMapped={false} />
      </mesh>
      <pointLight position={[Math.cos(rot) * 0.6, 3.1, 0.4 + Math.sin(rot) * 0.6]} color="#ff8c00" intensity={40 * beacon} distance={30} decay={1.6} />
    </group>
  );
};

/** Additive glow sprite for lamps seen through the snow (ignores fog). */
export const Glow: React.FC<{ position: [number, number, number]; size: number; color: string; opacity: number }> = ({ position, size, color, opacity }) => (
  <sprite position={position} scale={[size, size, size]}>
    <spriteMaterial map={flakeTexture()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
  </sprite>
);

/** Pulsing red ring that marks an object through the snow (drawn on top). */
export const Marker: React.FC<{ position: THREE.Vector3; t: number; k: number }> = ({ position, t, k }) => {
  if (k <= 0.01) return null;
  const pulse = 1 + 0.25 * Math.sin(t * 8);
  return (
    <sprite position={position} scale={[0.7 * pulse, 0.7 * pulse, 1]} renderOrder={10}>
      <spriteMaterial map={ringTexture()} color="#ff3b30" transparent opacity={k} depthTest={false} depthWrite={false} fog={false} />
    </sprite>
  );
};

const ringTexture = (() => {
  let tex: THREE.Texture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.strokeStyle = "#fff";
    g.lineWidth = 12;
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.stroke();
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();

/** Billboard puffs (steam from the exhaust, snow thrown when digging). */
export const Puffs: React.FC<{
  items: { pos: THREE.Vector3; size: number; opacity: number; color?: string }[];
}> = ({ items }) => (
  <group>
    {items.map((p, i) => (
      <sprite key={i} position={p.pos} scale={[p.size, p.size, p.size]}>
        <spriteMaterial map={puffTexture()} transparent opacity={p.opacity} depthWrite={false} color={p.color ?? "#ffffff"} />
      </sprite>
    ))}
  </group>
);

export const World: React.FC<{
  cam: Cam;
  fog: { color: THREE.Color; density: number };
  sky: THREE.Color;
  ambient: number;
  hemi: number;
  children?: React.ReactNode;
}> = ({ cam, fog, sky, ambient, hemi, children }) => {
  const { scene, gl } = useThree();
  useLayoutEffect(() => {
    scene.background = sky.clone();
    scene.fog = new THREE.FogExp2(fog.color.getHex(), fog.density);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
  }, [scene, gl, sky, fog]);
  return (
    <>
      <Rig cam={cam} />
      <ambientLight intensity={ambient} color="#8fa3c4" />
      <hemisphereLight args={["#9fb3d3", "#3a4458", hemi]} />
      <directionalLight position={[-30, 40, -20]} intensity={hemi * 0.7} color="#cfdcf0" />
      <Terrain />
      <Road />
      <Roadside />
      {children}
    </>
  );
};
