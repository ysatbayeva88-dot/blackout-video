import * as THREE from "three";
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

/** Value noise in [0,1], tileable over `period`. */
export const noise2 = (x: number, y: number, seed = 1, period = 256) => {
  const h = (i: number, j: number) => {
    i = ((i % period) + period) % period;
    j = ((j % period) + period) % period;
    let n = i * 374761393 + j * 668265263 + seed * 144665;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

export const fbm = (x: number, y: number, seed = 1, oct = 5, period = 256) => {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise2(x * f, y * f, seed + o * 17, period * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
};

/** Wind-blown snow surface: soft white with sastrugi streaks (colour) — tile it. */
export const snowTexture = memo(() => {
  const N = 512;
  const [c, g] = canvas(N);
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const streak = fbm(x / 64, y / 9, 3, 4, 8 * 1);
      const grain = noise2(x * 0.9, y * 0.9, 9, 512) * 0.06;
      const v = 0.86 + (streak - 0.5) * 0.16 + grain;
      const i = (y * N + x) * 4;
      img.data[i] = 255 * Math.min(1, v * 0.97);
      img.data[i + 1] = 255 * Math.min(1, v * 0.99);
      img.data[i + 2] = 255 * Math.min(1, v * 1.03);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
});

/** Matching bump map for the snow (heights). */
export const snowBump = memo(() => {
  const N = 256;
  const [c, g] = canvas(N);
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = fbm(x / 32, y / 6, 5, 4, 8) * 0.7 + noise2(x, y, 2, 256) * 0.3;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255 * v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
});

/** Asphalt with blown snow drifting across it. */
export const roadTexture = memo(() => {
  const W = 256, H = 1024;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const asph = 0.3 + noise2(x * 0.8, y * 0.8, 4, 1024) * 0.06;
      const drift = Math.max(0, fbm(x / 40, y / 90, 8, 4, 16) - 0.36) * 2.6;
      const edge = Math.max(0, Math.abs(x - W / 2) / (W / 2) - 0.75) * 4; // snow piles at the shoulders
      const k = Math.min(1, drift + edge);
      const v = asph * (1 - k) + 0.85 * k;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = 255 * v;
      img.data[i + 2] = 255 * Math.min(1, v * 1.04);
      img.data[i + 3] = 255;
    }
  // faded centre dashes
  g.putImageData(img, 0, 0);
  g.fillStyle = "rgba(220,220,200,0.35)";
  for (let y = 0; y < H; y += 256) g.fillRect(W / 2 - 3, y, 6, 120);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
});

/** Soft round flake sprite. */
export const flakeTexture = memo(() => {
  const [c, g] = canvas(64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.8)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
});

/** Puff sprite for exhaust steam / blowing snow clouds / chunks. */
export const puffTexture = memo(() => {
  const [c, g] = canvas(128);
  const r = mulberry32(11);
  for (let i = 0; i < 16; i++) {
    const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rad = 18 + r() * 26;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
});

/** Light-cone falloff (u across, v along the beam) for fake volumetric headlight beams. */
export const beamTexture = memo(() => {
  const W = 64, H = 256;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const along = y / H; // 0 at the lamp
            const a = Math.pow(1 - along, 1.6) * (0.7 + 0.3 * noise2(x / 6, y / 20, 3, 64));
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255 * a; // alphaMap reads the green channel
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
});

/** Frost crystals on glass as a CSS background (data URL). Denser toward the edges. */
export const frostDataUrl = memo(() => {
  const W = 540, H = 960;
  const [c, g] = canvas(W, H);
  const r = mulberry32(21);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ex = Math.min(x, W - x) / (W / 2), ey = Math.min(y, H - y) / (H / 2);
      const edge = 1 - Math.min(ex, ey);
      const n = fbm(x / 40, y / 40, 7, 5, 64);
      const a = Math.max(0, Math.min(1, (n + edge * 0.9 - 0.75) * 2.2));
      const i = (y * W + x) * 4;
      img.data[i] = 225;
      img.data[i + 1] = 236;
      img.data[i + 2] = 248;
      img.data[i + 3] = 255 * a * 0.85;
    }
  g.putImageData(img, 0, 0);
  // fern-like crystal strokes
  g.strokeStyle = "rgba(240,248,255,0.55)";
  g.lineWidth = 1;
  const branch = (x: number, y: number, ang: number, len: number, depth: number) => {
    if (depth === 0 || len < 3) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
    branch(x2, y2, ang + (r() - 0.5) * 0.5, len * 0.8, depth - 1);
    if (r() > 0.4) branch(x2, y2, ang + 0.9 + r() * 0.3, len * 0.5, depth - 1);
    if (r() > 0.4) branch(x2, y2, ang - 0.9 - r() * 0.3, len * 0.5, depth - 1);
  };
  for (let i = 0; i < 70; i++) {
    const side = Math.floor(r() * 4);
    const x = side === 0 ? 0 : side === 1 ? W : r() * W;
    const y = side === 2 ? 0 : side === 3 ? H : r() * H;
    const ang = Math.atan2(H / 2 - y, W / 2 - x) + (r() - 0.5) * 1.2;
    branch(x, y, ang, 30 + r() * 40, 6);
  }
  return c.toDataURL("image/png");
});
