import { interpolate } from "remotion";
import timings from "./timings.json";
import cuesJson from "./cues.json";
import type { Segment } from "../plane/Captions";

export type View = "ext" | "pov" | "side" | "card";
export type Scene = { name: string; view: View; start: number; end: number };

export const SEGMENTS = timings.segments as Segment[];
export const CUES = cuesJson as unknown as {
  duration: number;
  climax: number;
  rescue: number;
  impact: number;
  wall: number;
  heartbeat: [number, number];
  engine: [number, number][];
  scenes: Scene[];
};

export const FPS = 30;
export const DURATION_FRAMES = Math.ceil(CUES.duration * FPS);

/** Phrase start / end / word start (seconds). */
export const s = (i: number) => SEGMENTS[i].start;
export const e = (i: number) => SEGMENTS[i].end;
export const w = (i: number, k: number) => SEGMENTS[i].words[k].start;

export const scene = (name: string) => CUES.scenes.find((x) => x.name === name)!;
export const sceneAt = (t: number) => CUES.scenes.find((x) => t >= x.start && t < x.end) ?? CUES.scenes[CUES.scenes.length - 1];
/** 0..1 progress through a scene. */
export const prog = (name: string, t: number) => {
  const sc = scene(name);
  return Math.min(1, Math.max(0, (t - sc.start) / (sc.end - sc.start)));
};

/** Clamped interpolate. */
export const tw = (t: number, inp: number[], out: number[]) =>
  interpolate(t, inp, out, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const engineOn = (t: number) => CUES.engine.some(([a, b]) => t >= a && t < b);

/** Story clock shown on the timer chip. */
export const storyClock = (t: number): string | null => {
  if (t < scene("t1").start) return null;
  if (t < scene("t12").start) return "ЧАС 1";
  if (t < scene("d2").start) return "ЧАС 12";
  if (t < scene("d3").start) return "ДЕНЬ 2";
  return "ДЕНЬ 3";
};

/** Daylight 0 (night) .. 1 (overcast day). Day two is daytime, everything else is night. */
export const daylight = (t: number) => tw(t, [scene("d2").start, scene("d2").start + 0.3, scene("d3").start, scene("d3").start + 0.3], [0, 1, 1, 0]);

/** How deep the car is buried: 0 = on the road, 1 = snow up to the windows. */
export const buried = (t: number) => {
  if (t < CUES.impact) return 0;
  if (t < scene("buried").start) return tw(t, [CUES.impact, CUES.impact + 0.3, scene("buried").start], [0.15, 0.3, 0.45]);
  return tw(t, [scene("buried").start, scene("buried").end], [0.8, 1]);
};

/** One highlighted keyword per phrase (word prefix, case-insensitive). */
export const KEYWORDS: Record<number, string> = {
  0: "буран", 1: "асность", 2: "стена", 3: "удар", 4: "час", 5: "уходи", 6: "десяти",
  7: "машину", 8: "десять", 9: "щель", 10: "двенадцатый", 11: "окна", 12: "сон", 13: "стоп",
  14: "выхлопную", 15: "угарный", 16: "глуши", 17: "проснулся", 18: "день", 19: "шарф",
  20: "снег", 21: "растапливай", 22: "третий", 23: "нуле", 24: "двигайся", 25: "фары",
  26: "живой", 27: "выжил",
};
