import { Easing, interpolate } from "remotion";
import timings from "../timings.json";

export type Word = { text: string; start: number; end: number };
export type Segment = {
  id: number;
  speaker: "narrator" | "dispatcher";
  text: string;
  start: number;
  end: number;
  words: Word[];
};

export const FPS = 30;
export const SEGMENTS = timings.segments as Segment[];
export const VOICE_DURATION = timings.duration;
export const TOTAL_SECONDS = VOICE_DURATION + 1.5;
export const TOTAL_FRAMES = Math.ceil(TOTAL_SECONDS * FPS);

/** Start / end (seconds) of phrase `id` from the voiceover timings. */
export const S = (id: number) => SEGMENTS[id].start;
export const E = (id: number) => SEGMENTS[id].end;
/** Start (seconds) of word `k` of phrase `id`. */
export const W = (id: number, k: number) => SEGMENTS[id].words[k].start;

/** Scenes: first phrase id of each scene + camera focus (panel coordinates). */
export const SCENES = [
  { name: "Хук", from: 0, focus: { x: 540, y: 960, zoom: 1 } },
  { name: "Высота", from: 2, focus: { x: 800, y: 1010, zoom: 1.3 } },
  { name: "Мэйдэй", from: 5, focus: { x: 540, y: 1300, zoom: 1.15 } },
  { name: "Автопилот", from: 10, focus: { x: 540, y: 860, zoom: 1.3 } },
  { name: "Снижение", from: 14, focus: { x: 660, y: 950, zoom: 1.2 } },
  { name: "Заход", from: 17, focus: { x: 540, y: 820, zoom: 1.08 } },
  { name: "Порыв ветра", from: 23, focus: { x: 300, y: 900, zoom: 1.15 } },
  { name: "Посадка", from: 28, focus: { x: 540, y: 760, zoom: 1.08 } },
  { name: "Финал", from: 38, focus: { x: 540, y: 960, zoom: 1 } },
] as const;

export const sceneStart = (i: number) => (i === 0 ? 0 : S(SCENES[i].from) - 0.25);

/** One highlighted keyword per phrase (matched by word prefix, case-insensitive). */
export const KEYWORDS: Record<number, string> = {
  0: "сознания", 1: "асность", 2: "пустоты", 3: "паникуй", 4: "нормально",
  5: "наушники", 6: "кнопку", 7: "мэйдэй", 8: "тишина", 9: "вдруг",
  10: "автопилот", 11: "эй-пи", 12: "сам", 13: "дыши", 14: "трёхсот",
  15: "вниз", 16: "закладывает", 17: "полоса", 18: "закрылки", 19: "двухсот",
  20: "шасси", 21: "зелёные", 22: "ближе", 23: "ветра", 24: "влево",
  25: "земля", 26: "дёргают", 27: "стоп", 28: "ноль", 29: "тридцать",
  30: "десять", 31: "пять", 32: "касание", 33: "визжат", 34: "упора",
  35: "замирает", 36: "земле", 37: "живой", 38: "диспетчера", 39: "справился",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.45, 0, 0.2, 1);

/** Piecewise interpolation over seconds, clamped, eased. */
export const tween = (t: number, at: number[], values: number[]) =>
  interpolate(t, at, values, { ...clamp, easing: ease });

/** 0..1 while t is inside any [from, to] window, with soft edges. */
export const active = (t: number, windows: [number, number][], fade = 0.2) =>
  Math.max(
    0,
    ...windows.map(([a, b]) =>
      interpolate(t, [a - fade, a, b, b + fade], [0, 1, 1, 0], clamp),
    ),
  );

/** Highlight window covering phrases from..to (inclusive). */
export const phrases = (from: number, to = from): [number, number] => [S(from), E(to)];

/** Music ducking: 1 in silence, ~0.3 under the voice. */
export const duck = (t: number) => {
  const under = active(t, SEGMENTS.map((s) => [s.start - 0.05, s.end + 0.1]), 0.15);
  return 1 - 0.68 * under;
};
