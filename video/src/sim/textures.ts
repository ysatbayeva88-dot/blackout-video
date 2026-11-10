import * as THREE from "three";
import { mulberry32 } from "./rng";

const cache = new Map<string, THREE.Texture>();
const memo = (key: string, make: () => THREE.Texture) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
};

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
};

const finish = (c: HTMLCanvasElement, repeat = 1, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  t.needsUpdate = true;
  return t;
};

/** Soft radial glow for light points. */
export const glowTexture = () =>
  memo("glow", () => {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.12, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.3, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return finish(c, 1, false);
  });

/** Puffy cumulus sprite, lit from the top (warm) and shaded below (cool). */
export const cloudPuffTexture = (seed: number) =>
  memo(`puff${seed}`, () => {
    const r = mulberry32(seed);
    const [c, g] = canvas(256, 256);
    for (let i = 0; i < 26; i++) {
      const x = 128 + (r() - 0.5) * 150;
      const y = 140 + (r() - 0.5) * 70 - (Math.abs(x - 128) < 50 ? 20 * r() : 0);
      const rad = 30 + r() * 46;
      const lit = 1 - (y - 90) / 120;
      const grd = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad);
      const top = `rgba(${255},${Math.round(215 + 30 * lit)},${Math.round(190 + 50 * lit)},`;
      grd.addColorStop(0, top + "0.95)");
      grd.addColorStop(0.55, `rgba(205,190,200,0.8)`);
      grd.addColorStop(1, "rgba(120,120,150,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    return finish(c);
  });

/** Tileable fbm cloud sea seen from above. */
export const cloudSeaTexture = () =>
  memo("sea", () => {
    const N = 512;
    const [c, g] = canvas(N, N);
    const img = g.createImageData(N, N);
    const r = mulberry32(11);
    const grids = [4, 8, 16, 32, 64].map((s) => ({ s, v: Array.from({ length: s * s }, () => r()) }));
    const sample = (gr: { s: number; v: number[] }, x: number, y: number) => {
      const fx = (x / N) * gr.s, fy = (y / N) * gr.s;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (i: number, j: number) => gr.v[((j + gr.s) % gr.s) * gr.s + ((i + gr.s) % gr.s)];
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let v = 0, amp = 0.5;
        for (const gr of grids) {
          v += sample(gr, x, y) * amp;
          amp *= 0.5;
        }
        const d = Math.min(1, Math.max(0, (v - 0.42) * 3.2));
        const i = (y * N + x) * 4;
        img.data[i] = 240 + 15 * d;
        img.data[i + 1] = 200 + 40 * d;
        img.data[i + 2] = 195 + 40 * d;
        img.data[i + 3] = Math.round(255 * Math.min(1, 0.55 + d));
      }
    g.putImageData(img, 0, 0);
    return finish(c, 14);
  });

/** Patchwork farmland at dusk. */
export const fieldsTexture = () =>
  memo("fields", () => {
    const [c, g] = canvas(1024, 1024);
    const r = mulberry32(5);
    g.fillStyle = "#454d38";
    g.fillRect(0, 0, 1024, 1024);
    const cols = ["#4f5a3c", "#46502f", "#5c5638", "#3f4a30", "#665d40", "#4a5538"];
    for (let i = 0; i < 260; i++) {
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.fillRect(r() * 1024, r() * 1024, 40 + r() * 140, 30 + r() * 120);
    }
    g.strokeStyle = "rgba(20,22,18,0.6)";
    g.lineWidth = 2;
    for (let i = 0; i < 30; i++) {
      g.beginPath();
      g.moveTo(r() * 1024, 0);
      g.lineTo(r() * 1024, 1024);
      g.stroke();
    }
    return finish(c, 60);
  });

/** Airport grass with mowing stripes. */
export const grassTexture = () =>
  memo("grass", () => {
    const [c, g] = canvas(512, 512);
    const r = mulberry32(9);
    g.fillStyle = "#56683f";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";
      g.fillRect(0, i * 64, 512, 64);
    }
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? "70,90,50" : "40,55,30"},0.5)`;
      g.fillRect(r() * 512, r() * 512, 2, 2);
    }
    return finish(c, 40);
  });

/** Asphalt with subtle wear, tyre marks near touchdown handled by geometry. */
export const asphaltTexture = () =>
  memo("asphalt", () => {
    const [c, g] = canvas(512, 512);
    const r = mulberry32(3);
    g.fillStyle = "#3b3d42";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const v = 45 + r() * 30;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.6)`;
      g.fillRect(r() * 512, r() * 512, 1.5, 1.5);
    }
    for (let i = 0; i < 18; i++) {
      g.fillStyle = "rgba(25,25,28,0.25)";
      g.fillRect(0, r() * 512, 512, 4 + r() * 10);
    }
    const t = finish(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 120);
    return t;
  });

/** Runway designator, painted white on transparent. */
export const numberTexture = (text: string) =>
  memo(`num${text}`, () => {
    const [c, g] = canvas(256, 400);
    g.fillStyle = "#fff";
    g.font = "bold 330px DejaVu Sans, Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.save();
    g.translate(128, 200);
    g.scale(0.62, 1);
    g.fillText(text, 0, 10);
    g.restore();
    return finish(c);
  });

/** Lit office/terminal windows. */
export const windowsTexture = () =>
  memo("windows", () => {
    const [c, g] = canvas(256, 256);
    const r = mulberry32(21);
    g.fillStyle = "#1b1e26";
    g.fillRect(0, 0, 256, 256);
    for (let y = 8; y < 256; y += 16)
      for (let x = 6; x < 256; x += 12) {
        const on = r() > 0.45;
        g.fillStyle = on ? (r() > 0.3 ? "#ffd99a" : "#cfe6ff") : "#252a35";
        g.fillRect(x, y, 7, 9);
      }
    return finish(c);
  });
