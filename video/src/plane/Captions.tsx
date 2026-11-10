import React from "react";
import { Easing, interpolate } from "remotion";
import { KEYWORDS, SEGMENTS, Segment, Word } from "./timeline";

const YELLOW = "#FFD60A";
const RADIO = "#7CFFA0";
const MAX_WORDS = 4;
const MAX_CHARS = 24;

type Page = { seg: Segment; words: Word[]; start: number; end: number };

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "");

/** Split each phrase into short pages (≤2 lines on screen), shown word by word. */
const PAGES: Page[] = SEGMENTS.flatMap((seg) => {
  const pages: Word[][] = [[]];
  for (const w of seg.words) {
    const cur = pages[pages.length - 1];
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= MAX_WORDS || len > MAX_CHARS)) pages.push([w]);
    else cur.push(w);
  }
  return pages.map((words, i) => ({
    seg,
    words,
    start: i === 0 ? seg.start : words[0].start,
    end: i === pages.length - 1 ? seg.end + 0.2 : pages[i + 1][0].start,
  }));
});

export const Captions: React.FC<{ t: number }> = ({ t }) => {
  const page = PAGES.find((p) => t >= p.start && t < p.end);
  if (!page) return null;
  const isRadio = page.seg.speaker === "dispatcher";
  const key = KEYWORDS[page.seg.id];
  const long = page.words.reduce((n, w) => n + w.text.length, 0) > 18;

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: 1600,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      {isRadio && (
        <div
          style={{
            fontFamily: "Montserrat",
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: 4,
            color: "#04210c",
            background: RADIO,
            padding: "6px 20px",
            borderRadius: 10,
          }}
        >
          ДИСПЕТЧЕР
        </div>
      )}
      <div
        style={{
          fontFamily: "Montserrat",
          fontWeight: 900,
          fontSize: long ? 70 : 82,
          lineHeight: 1.1,
          textAlign: "center",
          textTransform: "uppercase",
          color: isRadio ? RADIO : "#fff",
          textShadow: "0 0 18px rgba(0,0,0,0.9), 0 6px 0 rgba(0,0,0,0.85)",
          WebkitTextStroke: "3px rgba(0,0,0,0.85)",
          paintOrder: "stroke fill",
        }}
      >
        {page.words.map((w, i) => {
          const shown = t >= w.start - 0.05;
          const pop = interpolate(t, [w.start - 0.05, w.start + 0.12], [0.6, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          });
          const isKey = key !== undefined && norm(w.text).startsWith(key);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: i < page.words.length - 1 ? "0.25em" : 0,
                opacity: shown ? 1 : 0,
                scale: String(shown ? pop : 0.6),
                color: isKey ? YELLOW : undefined,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
