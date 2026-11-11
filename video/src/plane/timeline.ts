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

export const SEGMENTS = timings.segments as Segment[];

/** One highlighted keyword per phrase (matched by word prefix, case-insensitive). */
export const KEYWORDS: Record<number, string> = {
  0: "сознания", 1: "алихан", 2: "восемьсот", 3: "пустоты", 4: "паникуй",
  5: "наушники", 6: "кнопку", 7: "мэйдэй", 8: "тишина", 9: "вдруг",
  10: "автопилот", 11: "эй-пи", 12: "трёхсот", 13: "облака", 14: "полоса",
  15: "закрылки", 16: "шасси", 17: "зелёные", 18: "ветра", 19: "влево",
  20: "дёргают", 21: "стоп", 22: "ноль", 23: "тридцать", 24: "десять",
  25: "пять", 26: "касание", 27: "реверс", 28: "живой", 29: "диспетчера",
  30: "справился",
};
