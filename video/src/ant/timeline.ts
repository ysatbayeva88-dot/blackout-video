import { Easing, interpolate } from "remotion";
import timings from "./timings.json";
import cuesJson from "./cues.json";
import type { Segment } from "../plane/Captions";

export type View = "pov" | "side" | "wide" | "card";
export type Scene = { name: string; view: View; start: number; end: number };

export const SEGMENTS = timings.segments as Segment[];
export const CUES = cuesJson as unknown as {
  duration: number;
  draft: boolean;
  kill: number;
  impact: number;
  climax: number;
  free: number;
  stomp: number;
  lift: number;
  heartbeat: [number, number];
  rain: [number, number];
  cold: [number, number];
  meter: [number, number][];
  scenes: Scene[];
};

export const FPS = 30;
export const DURATION_FRAMES = Math.ceil(CUES.duration * FPS);

export const s = (i: number) => SEGMENTS[i].start;
export const e = (i: number) => SEGMENTS[i].end;
export const w = (i: number, k: number) => SEGMENTS[i].words[Math.min(k, SEGMENTS[i].words.length - 1)].start;

export const scene = (name: string) => CUES.scenes.find((x) => x.name === name)!;
export const sceneAt = (t: number) => CUES.scenes.find((x) => t >= x.start && t < x.end) ?? CUES.scenes[CUES.scenes.length - 1];
export const prog = (name: string, t: number) => {
  const sc = scene(name);
  return Math.min(1, Math.max(0, (t - sc.start) / (sc.end - sc.start)));
};
/** Seconds since a scene started. */
export const since = (name: string, t: number) => t - scene(name).start;

export const tw = (t: number, inp: number[], out: number[]) =>
  interpolate(t, inp, out, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
export const ease = (t: number, inp: number[], out: number[]) =>
  interpolate(t, inp, out, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
export const smooth = (k: number) => k * k * (3 - 2 * k);

/** Survival meter value (percent) at time t, eased between the cue keyframes. */
export const meterAt = (t: number) => {
  const m = CUES.meter;
  if (t <= m[0][0]) return m[0][1];
  for (let i = 1; i < m.length; i++) {
    if (t <= m[i][0]) {
      const k = (t - m[i - 1][0]) / Math.max(1e-3, m[i][0] - m[i - 1][0]);
      return m[i - 1][1] + (m[i][1] - m[i - 1][1]) * smooth(k);
    }
  }
  return m[m.length - 1][1];
};
/** Direction of the latest meter change: +1 up, -1 down, 0 steady (for the flash colour). */
export const meterTrend = (t: number) => {
  const m = CUES.meter;
  let r = 0;
  for (let i = 1; i < m.length; i++)
    if (m[i][1] !== m[i - 1][1] && t >= m[i - 1][0] && t <= m[i][0] + 0.6) r = Math.sign(m[i][1] - m[i - 1][1]);
  return r;
};

/** One highlighted keyword per phrase (word prefix, case-insensitive). */
export const KEYWORDS: Record<number, string> = {
  0: "убить", 1: "три", 2: "падаешь", 3: "царапины", 4: "воздух", 5: "дождь", 6: "десятки",
  7: "тонна", 8: "удар", 9: "клей", 10: "натяжение", 11: "тянет", 12: "свободен", 13: "тяжелее",
  14: "суперсильный", 15: "объёма", 16: "несёшь", 17: "холодно", 18: "небоскрёбы", 19: "лошадь",
  20: "капля", 21: "выжил",
};
