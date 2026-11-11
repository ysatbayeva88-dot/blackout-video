import React, { useMemo } from "react";
import * as THREE from "three";
import { MAIN_WHEELS } from "./Airliner";
import { TOUCH, bodyToWorld, pose } from "./flight";
import { mulberry32 } from "./rng";

const smokeTexture = (() => {
  let tex: THREE.Texture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const r = mulberry32(5);
    for (let i = 0; i < 14; i++) {
      const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 40, rad = 22 + r() * 26;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, "rgba(235,235,238,0.55)");
      grd.addColorStop(1, "rgba(200,200,205,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
})();

/** Tyre smoke puffs: spawned at the wheels at touchdown, they stay in world space and drift. */
export const TireSmoke: React.FC<{ t: number }> = ({ t }) => {
  const puffs = useMemo(() => {
    const r = mulberry32(99);
    const list: { spawn: number; pos: THREE.Vector3; drift: THREE.Vector3; size: number }[] = [];
    for (let k = 0; k < 18; k++) {
      const spawn = TOUCH + k * 0.035;
      const p = pose(spawn);
      for (const wh of MAIN_WHEELS) {
        const base = bodyToWorld(p, wh);
        base.y = 0.4;
        list.push({ spawn, pos: base, drift: new THREE.Vector3((r() - 0.5) * 2, 0.6 + r() * 0.6, 1 + r() * 2), size: 1.2 + r() * 1.2 });
      }
    }
    return list;
  }, []);
  if (t < TOUCH) return null;
  return (
    <group>
      {puffs.map((p, i) => {
        const a = t - p.spawn;
        if (a < 0 || a > 3.2) return null;
        const sz = p.size * (1 + a * 3.2);
        return (
          <sprite key={i} position={[p.pos.x + p.drift.x * a, p.pos.y + p.drift.y * a + sz * 0.25, p.pos.z + p.drift.z * a]} scale={[sz, sz * 0.8, 1]}>
            <spriteMaterial map={smokeTexture()} transparent opacity={0.85 * (1 - a / 3.2)} depthWrite={false} />
          </sprite>
        );
      })}
    </group>
  );
};

/** Dust kicked forward by the thrust reversers. */
export const ReverserSpray: React.FC<{ t: number; reverse: number }> = ({ t, reverse }) => {
  if (reverse < 0.05) return null;
  const p = pose(t);
  const r = mulberry32(Math.floor(t * 30));
  return (
    <group>
      {[5, -5].flatMap((x) =>
        Array.from({ length: 6 }).map((_, i) => {
          const a = ((t * 1.6 + i / 6) % 1);
          const q = bodyToWorld(p, [x * (1.25 + a * 0.6), -2.4, -3 - a * 10]);
          q.y = 0.6 + a * 2.5;
          const sz = 2 + a * 6 + r();
          return (
            <sprite key={`${x}${i}`} position={q} scale={[sz, sz * 0.6, 1]}>
              <spriteMaterial map={smokeTexture()} color="#d9c7b0" transparent opacity={reverse * 0.45 * (1 - a)} depthWrite={false} />
            </sprite>
          );
        }),
      )}
    </group>
  );
};
