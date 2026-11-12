import React from "react";
import { AbsoluteFill, Easing, Img, interpolate } from "remotion";
import { frostDataUrl } from "../blizzard/textures";

const YELLOW = "#FFD60A";
const FONT: React.CSSProperties = { fontFamily: "Montserrat", fontWeight: 900, textTransform: "uppercase" };
const SHADOW = "0 0 16px rgba(0,0,0,0.85), 0 4px 0 rgba(0,0,0,0.7)";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** red (0%) -> yellow (40%) -> green (70%+) */
const meterColor = (v: number) => {
  const k = Math.min(1, Math.max(0, v / 70));
  const hue = k < 0.57 ? (k / 0.57) * 50 : 50 + ((k - 0.57) / 0.43) * 70;
  return `hsl(${hue}, 92%, 52%)`;
};

/** «ШАНС ВЫЖИТЬ: X%» bar at the top. trend: +1 rising (green flash), -1 falling (red flash). */
export const Meter: React.FC<{ value: number; trend: number; k: number; t: number; blink?: boolean }> = ({ value, trend, k, t, blink }) => {
  const col = meterColor(value);
  const pulse = trend !== 0 ? 0.5 + 0.5 * Math.sin(t * 18) : 0;
  const glow = trend > 0 ? `0 0 ${30 + 30 * pulse}px rgba(80,255,120,0.8)` : trend < 0 ? `0 0 ${30 + 30 * pulse}px rgba(255,40,40,0.9)` : "0 0 18px rgba(0,0,0,0.6)";
  const lowBlink = blink && value < 10 ? 0.55 + 0.45 * Math.sign(Math.sin(t * 12)) : 1;
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: 110, opacity: k, translate: `0 ${(1 - k) * -40}px` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", ...FONT }}>
        <div style={{ fontSize: 46, color: "#fff", letterSpacing: 2, textShadow: SHADOW }}>Шанс выжить</div>
        <div style={{ fontSize: 84, color: col, textShadow: SHADOW, lineHeight: 0.95, opacity: lowBlink, display: "flex", alignItems: "center", gap: 10 }}>
          {trend !== 0 && <span style={{ fontSize: 50, color: trend > 0 ? "#5dff7a" : "#ff3b3b" }}>{trend > 0 ? "▲" : "▼"}</span>}
          {Math.round(value)}%
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          height: 34,
          borderRadius: 17,
          background: "rgba(0,0,0,0.55)",
          border: "3px solid rgba(255,255,255,0.85)",
          boxShadow: glow,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${value}%`, height: "100%", background: col, boxShadow: `0 0 18px ${col}`, borderRadius: 14 }} />
      </div>
    </div>
  );
};

/** Little ruler in the corner: «ТВОЙ РОСТ: 3 ММ». */
export const Ruler: React.FC<{ k: number }> = ({ k }) => {
  const MM = 70; // px per mm on the ruler
  return (
    <div style={{ position: "absolute", left: 90, top: 300, opacity: k, scale: String(0.8 + 0.2 * k), transformOrigin: "left top" }}>
      <div style={{ ...FONT, fontSize: 34, color: "#fff", textShadow: SHADOW, marginBottom: 8 }}>
        Твой рост: <span style={{ color: YELLOW }}>3 мм</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
        <svg width={MM * 3 + 24} height={70} style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.7))" }}>
          <rect x={2} y={22} width={MM * 3 + 20} height={44} rx={6} fill="#f4e6b8" stroke="#3a2c10" strokeWidth={2} />
          {Array.from({ length: 31 }, (_, i) => {
            const x = 12 + (i * MM) / 10;
            const h = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9;
            return <line key={i} x1={x} x2={x} y1={22} y2={22 + h} stroke="#3a2c10" strokeWidth={i % 10 === 0 ? 3 : 1.5} />;
          })}
          {[0, 1, 2, 3].map((n) => (
            <text key={n} x={12 + n * MM} y={62} fontSize={18} fontFamily="Montserrat" fontWeight={800} textAnchor="middle" fill="#3a2c10">
              {n}
            </text>
          ))}
          <rect x={12} y={6} width={MM * 3} height={8} rx={4} fill={YELLOW} stroke="#000" strokeWidth={1.5} />
        </svg>
        {/* tiny person silhouette for scale */}
        <svg width={22} height={62} viewBox="0 0 22 62" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))" }}>
          <circle cx={11} cy={7} r={6} fill="#fff" />
          <path d="M4 16 h14 l-2 22 h-3 l-1 22 h-2 l-1 -22 h-3 z" fill="#e8692a" stroke="#fff" strokeWidth={1.2} />
        </svg>
      </div>
    </div>
  );
};

/** Fact label (pill) in the upper third. */
export const Label: React.FC<{ text: string; k: number; y?: number; color?: string }> = ({ text, k, y = 470, color = YELLOW }) => {
  if (k <= 0.001) return null;
  const pop = interpolate(k, [0, 1], [0.7, 1], { ...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: y, display: "flex", justifyContent: "center", opacity: Math.min(1, k * 2) }}>
      <div
        style={{
          ...FONT,
          fontWeight: 800,
          fontSize: 44,
          lineHeight: 1.2,
          textAlign: "center",
          color: "#111",
          background: color,
          padding: "14px 30px",
          borderRadius: 18,
          scale: String(pop),
          boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
          whiteSpace: "pre-line",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Square-cube law, the simple version: strength scales with area, weight with volume. */
export const CubeCard: React.FC<{ k: number; t0: number; t: number; result: number }> = ({ k, t0, t, result }) => {
  const a = (d: number) => interpolate(t - t0, [d, d + 0.4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const shrink = interpolate(t - t0, [0.3, 2.0], [1, 0.6], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const row = (icon: React.ReactNode, title: string, sub: string, value: string, d: number, color: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 34, opacity: a(d), translate: `${(1 - a(d)) * 60}px 0` }}>
      <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ ...FONT, fontSize: 56, color }}>{title}</div>
        <div style={{ ...FONT, fontWeight: 800, fontSize: 32, color: "rgba(255,255,255,0.8)" }}>{sub}</div>
        <div style={{ ...FONT, fontSize: 62, color: "#fff", marginTop: 6 }}>{value}</div>
      </div>
    </div>
  );
  const s = 150 * shrink;
  const square = <div style={{ width: s, height: s, background: "#5dff7a", border: "4px solid #fff", borderRadius: 8, boxShadow: "0 0 30px rgba(93,255,122,0.6)" }} />;
  const cube = (
    <svg width={180} height={180} viewBox="-90 -90 180 180">
      <g transform={`scale(${Math.pow(shrink, 3) * 1.2})`}>
        <polygon points="-60,-30 0,-60 60,-30 0,0" fill="#ffb03b" stroke="#fff" strokeWidth={4} />
        <polygon points="-60,-30 0,0 0,70 -60,40" fill="#e07f1a" stroke="#fff" strokeWidth={4} />
        <polygon points="60,-30 0,0 0,70 60,40" fill="#b85f0e" stroke="#fff" strokeWidth={4} />
      </g>
    </svg>
  );
  return (
    <AbsoluteFill style={{ opacity: k, background: "rgba(5,10,20,0.62)" }}>
      <div style={{ position: "absolute", left: 90, right: 90, top: 420, display: "flex", flexDirection: "column", gap: 46 }}>
        <div style={{ ...FONT, fontSize: 50, color: "#fff", textAlign: "center", opacity: a(0), textShadow: SHADOW }}>
          Ты меньше в <span style={{ color: YELLOW }}>580</span> раз
        </div>
        {row(square, "Сила мышц", "зависит от толщины", "÷ 340 000", 0.5, "#5dff7a")}
        {row(cube, "Вес", "зависит от объёма", "÷ 200 000 000", 1.3, "#ffb03b")}
        <div
          style={{
            ...FONT,
            fontSize: 58,
            textAlign: "center",
            color: "#111",
            background: YELLOW,
            borderRadius: 20,
            padding: "18px 10px",
            opacity: result,
            scale: String(0.8 + 0.2 * result),
          }}
        >
          Сила на кг веса × 580
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Thermometer that drains as the body cools. */
export const Thermo: React.FC<{ k: number; level: number }> = ({ k, level }) => (
  <div style={{ position: "absolute", right: 100, top: 520, opacity: k, scale: String(0.8 + 0.2 * k) }}>
    <svg width={90} height={330} viewBox="0 0 90 330" style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.7))" }}>
      <rect x={28} y={10} width={34} height={250} rx={17} fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth={5} />
      <circle cx={45} cy={285} r={38} fill="rgba(255,255,255,0.25)" stroke="#fff" strokeWidth={5} />
      <rect x={36} y={20 + 230 * (1 - level)} width={18} height={230 * level + 40} rx={9} fill={level > 0.4 ? "#ff5a3c" : "#4fb4ff"} />
      <circle cx={45} cy={285} r={28} fill={level > 0.4 ? "#ff5a3c" : "#4fb4ff"} />
    </svg>
  </div>
);

/** Looking out from inside a drop: blue tint, caustic lines, bubbles, wobble is done by an SVG filter. */
export const WaterView: React.FC<{ k: number; t: number }> = ({ k, t }) => {
  if (k <= 0) return null;
  const bubbles = Array.from({ length: 16 }, (_, i) => {
    const ph = ((t * (0.25 + (i % 5) * 0.06) + i * 0.137) % 1 + 1) % 1;
    const x = 120 + ((i * 197) % 840) + Math.sin(t * 2 + i) * 20;
    const y = 1700 - ph * 1500;
    const r = 8 + (i % 4) * 7;
    return <circle key={i} cx={x} cy={y} r={r} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={3} opacity={Math.sin(ph * Math.PI)} />;
  });
  return (
    <AbsoluteFill style={{ opacity: k }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 35%, rgba(120,210,240,0.18) 0%, rgba(30,110,150,0.45) 70%, rgba(5,40,70,0.75) 100%)" }} />
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(${110 + Math.sin(t) * 8}deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 60px, rgba(220,255,255,0.10) 75px, rgba(255,255,255,0) 90px)`,
          mixBlendMode: "screen",
          translate: `${Math.sin(t * 1.3) * 30}px ${t * 25 % 90}px`,
        }}
      />
      {/* the drop's surface overhead: a bright curved film line */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path d={`M -60 ${520 + Math.sin(t * 2) * 12} Q 540 ${180 + Math.sin(t * 1.4) * 20} 1140 ${520 + Math.cos(t * 2) * 12}`} stroke="rgba(230,255,255,0.75)" strokeWidth={10} fill="none" style={{ filter: "blur(3px)" }} />
        <path d={`M -60 ${540 + Math.sin(t * 2) * 12} Q 540 ${200 + Math.sin(t * 1.4) * 20} 1140 ${540 + Math.cos(t * 2) * 12}`} stroke="rgba(255,255,255,0.9)" strokeWidth={3} fill="none" />
        {bubbles}
      </svg>
    </AbsoluteFill>
  );
};

/** SVG wobble filter (applied to the 3D layers while we are inside water). */
export const WaterFilter: React.FC<{ t: number; amount: number }> = ({ t, amount }) => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <filter id="waterwobble" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency={`${0.006 + 0.001 * Math.sin(t * 2)} ${0.01 + 0.002 * Math.cos(t * 1.7)}`} numOctaves={2} seed={3} />
      <feDisplacementMap in="SourceGraphic" scale={amount} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
);

export const Frost: React.FC<{ k: number }> = ({ k }) =>
  k <= 0 ? null : (
    <AbsoluteFill style={{ opacity: k }}>
      <AbsoluteFill style={{ background: "linear-gradient(rgba(90,160,255,0.25), rgba(60,120,220,0.35))", mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0) 45%, rgba(220,240,255,0.55) 100%)" }} />
      <Img
        src={frostDataUrl()}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.55,
          maskImage: "radial-gradient(ellipse at 50% 50%, transparent 40%, black 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, transparent 40%, black 85%)",
        }}
      />
    </AbsoluteFill>
  );

export const Vignette: React.FC<{ k: number; color?: string }> = ({ k, color = "0,0,0" }) =>
  k <= 0 ? null : <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(${color},0) 50%, rgba(${color},${k}) 100%)` }} />;

export const OutroCard: React.FC<{ k: number; t: number }> = ({ k, t }) =>
  k <= 0 ? null : (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: k }}>
      <div style={{ ...FONT, fontSize: 104, lineHeight: 1.05, color: "#fff", textAlign: "center", textShadow: SHADOW, translate: `0 ${-180 + (1 - k) * 40}px` }}>
        А ты бы
        <br />
        <span style={{ color: YELLOW }}>выжил?</span>
      </div>
      <div
        style={{
          ...FONT,
          fontWeight: 800,
          fontSize: 44,
          color: "#111",
          background: "#fff",
          padding: "16px 34px",
          borderRadius: 40,
          translate: `0 ${-120 + Math.sin(t * 4) * 6}px`,
        }}
      >
        Пиши в комментариях
      </div>
    </AbsoluteFill>
  );

export const DraftBadge: React.FC = () => (
  <div style={{ position: "absolute", right: 90, top: 300, ...FONT, fontWeight: 800, fontSize: 24, color: "#fff", background: "rgba(200,0,0,0.8)", padding: "6px 14px", borderRadius: 8 }}>
    Черновик: озвучка не полная
  </div>
);
