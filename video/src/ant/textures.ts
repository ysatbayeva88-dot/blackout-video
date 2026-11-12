import * as THREE from "three";
import { fbm, noise2 } from "../blizzard/textures";
import { mulberry32 } from "../sim/rng";

const memo = <T,>(make: () => T) => {
  let v: T | null = null;
  return () => (v ??= make());
};

const canvas = (w: number, h = w) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
};

const tex = (c: HTMLCanvasElement, srgb = true, repeat = true) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
};

/** Garden soil seen from 3 mm: dark crumbs, sand grains, bits of dry leaf. Tile it. */
export const soilTexture = memo(() => {
  const N = 512;
  const [c, g] = canvas(N);
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const big = fbm(x / 90, y / 90, 4, 4, 512 / 90);
      const mid = fbm(x / 18, y / 18, 7, 3, 512 / 18);
      const grain = noise2(x * 0.7, y * 0.7, 3, 512 * 0.7);
      const v = 0.32 + (big - 0.5) * 0.3 + (mid - 0.5) * 0.35 + (grain - 0.5) * 0.18;
      const sand = Math.max(0, mid - 0.62) * 3;
      const i = (y * N + x) * 4;
      img.data[i] = 255 * Math.min(1, v * 0.78 + sand * 0.5);
      img.data[i + 1] = 255 * Math.min(1, v * 0.6 + sand * 0.42);
      img.data[i + 2] = 255 * Math.min(1, v * 0.42 + sand * 0.3);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const r = mulberry32(5);
  // little pale pebbles and leaf flecks
  for (let k = 0; k < 260; k++) {
    const x = r() * N, y = r() * N, s = 1.5 + r() * 5;
    const leaf = r() < 0.25;
    g.fillStyle = leaf ? `rgba(${120 + r() * 60},${90 + r() * 40},${40 + r() * 20},0.7)` : `rgba(${170 + r() * 60},${150 + r() * 50},${120 + r() * 40},0.8)`;
    g.beginPath();
    g.ellipse(x, y, s, s * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
});

export const soilBump = memo(() => {
  const N = 512;
  const [c, g] = canvas(N);
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = fbm(x / 14, y / 14, 21, 4, 512 / 14) * 0.7 + noise2(x * 0.8, y * 0.8, 23, 512 * 0.8) * 0.3;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255 * v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return tex(c, false);
});

/** Weathered garden-table wood: long grain lines. */
export const woodTexture = memo(() => {
  const W = 256, H = 1024;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const warp = fbm(x / 60, y / 300, 31, 3, 64) * 18;
      const ring = Math.sin((x + warp) * 0.35) * 0.5 + 0.5;
      const fine = noise2(x * 0.9, y * 0.04, 33, 1024) * 0.25;
      const v = 0.55 + ring * 0.18 + fine - 0.12;
      const i = (y * W + x) * 4;
      img.data[i] = 255 * Math.min(1, v * 0.86);
      img.data[i + 1] = 255 * Math.min(1, v * 0.66);
      img.data[i + 2] = 255 * Math.min(1, v * 0.45);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return tex(c);
});

/** Porous bread crumb surface. */
export const breadTexture = memo(() => {
  const N = 256;
  const [c, g] = canvas(N);
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const n = fbm(x / 10, y / 10, 41, 4, 256 / 10);
      const pore = n < 0.38 ? 0.55 : 1;
      const v = (0.82 + (n - 0.5) * 0.25) * pore;
      const i = (y * N + x) * 4;
      img.data[i] = 255 * Math.min(1, v * 0.98);
      img.data[i + 1] = 255 * Math.min(1, v * 0.82);
      img.data[i + 2] = 255 * Math.min(1, v * 0.55);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return tex(c);
});

/** Soft round bokeh disc with a slightly brighter rim (like a real lens). */
export const bokehTexture = memo(() => {
  const N = 128;
  const [c, g] = canvas(N);
  const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, "rgba(255,255,255,0.85)");
  gr.addColorStop(0.7, "rgba(255,255,255,0.8)");
  gr.addColorStop(0.86, "rgba(255,255,255,0.5)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, N, N);
  return tex(c, true, false);
});

/** Soft glow puff (heat, mist, splash spray). */
export const puffTexture = memo(() => {
  const N = 128;
  const [c, g] = canvas(N);
  const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.4, "rgba(255,255,255,0.45)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, N, N);
  return tex(c, true, false);
});

/** Vertical sky gradient used as scene background. */
export const skyTexture = (top: string, mid: string, bottom: string) => {
  const [c, g] = canvas(4, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top);
  gr.addColorStop(0.55, mid);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  return tex(c, true, false);
};

/** Lawn seen from above: dense blade strokes over dark soil. Tile it. */
export const lawnTexture = memo(() => {
  const N = 512;
  const [c, g] = canvas(N);
  g.fillStyle = "#2c3a18";
  g.fillRect(0, 0, N, N);
  const r = mulberry32(17);
  for (let k = 0; k < 2600; k++) {
    const x = r() * N, y = r() * N;
    const len = 30 + r() * 90;
    const a = r() * Math.PI * 2;
    const l = 25 + r() * 35;
    g.strokeStyle = `hsl(${78 + r() * 30}, ${40 + r() * 30}%, ${l}%)`;
    g.lineWidth = 2 + r() * 4;
    g.lineCap = "round";
    for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) {
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.quadraticCurveTo(x + dx + Math.cos(a) * len * 0.5 + 8, y + dy + Math.sin(a) * len * 0.5, x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len);
      g.stroke();
    }
  }
  return tex(c);
});
