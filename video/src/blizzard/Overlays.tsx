import React from "react";
import { AbsoluteFill, Easing, Img, interpolate } from "remotion";
import { mulberry32 } from "../sim/rng";
import { frostDataUrl } from "./textures";

const W = 1080, H = 1920;
const YELLOW = "#FFD60A";
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t: number, inp: number[], out: number[]) =>
  interpolate(t, inp, out, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

/** Dims the frame except a soft circle around the active element. */
export const Spotlight: React.FC<{ x: number; y: number; r: number; k: number }> = ({ x, y, r, k }) =>
  k <= 0.001 ? null : (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}px ${y}px, rgba(0,0,0,0) ${r}px, rgba(0,0,0,${0.62 * k}) ${r * 1.7}px)`,
      }}
    />
  );

const Frost: React.FC<{ clip: string; k: number }> = ({ clip, k }) =>
  k <= 0.01 ? null : (
    <Img
      src={frostDataUrl()}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", clipPath: clip, opacity: k, mixBlendMode: "screen" }}
    />
  );

// windshield polygon (screen px)
const WS = "polygon(150px 300px, 930px 300px, 1060px 1190px, 20px 1190px)";

/** Gauge with a needle; value 0..1 sweeps -120°..120°. */
const Gauge: React.FC<{ cx: number; cy: number; r: number; v: number; lit: number; labels: [string, string]; warn?: boolean; title: string }> = ({
  cx, cy, r, v, lit, labels, warn, title,
}) => {
  const ang = (-120 + 240 * clamp(v)) * (Math.PI / 180);
  const glow = 0.15 + 0.85 * lit;
  const ticks = Array.from({ length: 9 }, (_, i) => (-120 + i * 30) * (Math.PI / 180));
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#07090b" stroke="#2a2f35" strokeWidth={6} />
      {ticks.map((a, i) => (
        <line
          key={i}
          x1={cx + Math.sin(a) * r * 0.78}
          y1={cy - Math.cos(a) * r * 0.78}
          x2={cx + Math.sin(a) * r * 0.92}
          y2={cy - Math.cos(a) * r * 0.92}
          stroke={`rgba(235,245,255,${glow})`}
          strokeWidth={i % 2 ? 3 : 6}
        />
      ))}
      <text x={cx - r * 0.62} y={cy + r * 0.62} fill={`rgba(235,245,255,${glow})`} fontFamily="Montserrat" fontWeight={800} fontSize={r * 0.26} textAnchor="middle">
        {labels[0]}
      </text>
      <text x={cx + r * 0.62} y={cy + r * 0.62} fill={`rgba(235,245,255,${glow})`} fontFamily="Montserrat" fontWeight={800} fontSize={r * 0.26} textAnchor="middle">
        {labels[1]}
      </text>
      <text x={cx} y={cy + r * 0.5} fill={`rgba(160,200,255,${glow * 0.8})`} fontFamily="Montserrat" fontWeight={800} fontSize={r * 0.17} textAnchor="middle">
        {title}
      </text>
      <line
        x1={cx}
        y1={cy}
        x2={cx + Math.sin(ang) * r * 0.82}
        y2={cy - Math.cos(ang) * r * 0.82}
        stroke={warn ? "#ff3b30" : `rgba(255,120,40,${0.4 + 0.6 * lit})`}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={r * 0.09} fill="#2a2f35" />
    </g>
  );
};

/** First-person view from the driver's seat: windshield frame, dashboard, wheel, cluster, key. */
export const Interior: React.FC<{
  t: number;
  lit: number; // dashboard illumination 0..1 (engine / ignition)
  fuel: number;
  rpm: number;
  cabinTemp: number;
  fuelWarn: boolean;
  keyTurn: number; // 0 off .. 1 on
  frost: number;
  warmth: number; // amber glow from the heater 0..1
  focus?: { x: number; y: number; r: number; k: number };
}> = ({ t, lit, fuel, rpm, cabinTemp, fuelWarn, keyTurn, frost, warmth, focus }) => {
  const warnOn = fuelWarn && Math.floor(t * 2.5) % 2 === 0;
  const tempStr = `${cabinTemp > 0 ? "+" : cabinTemp < 0 ? "−" : ""}${Math.abs(Math.round(cabinTemp))}°C`;
  return (
    <AbsoluteFill>
      <Frost clip={WS} k={frost} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="dash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d2024" />
            <stop offset="1" stopColor="#08090a" />
          </linearGradient>
          <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0c0d0f" />
            <stop offset="1" stopColor="#25282c" />
          </linearGradient>
          <radialGradient id="wheel" cx="0.5" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#2b2e33" />
            <stop offset="1" stopColor="#0b0c0e" />
          </radialGradient>
          <radialGradient id="warm" cx="0.5" cy="1" r="0.9">
            <stop offset="0" stopColor="rgba(255,150,60,0.35)" />
            <stop offset="1" stopColor="rgba(255,150,60,0)" />
          </radialGradient>
        </defs>
        {/* roof liner + pillars */}
        <path d={`M0 0 H${W} V320 L930 300 H150 L0 320 Z`} fill="url(#roof)" />
        <path d="M0 300 L150 300 L20 1190 L0 1190 Z" fill="#141619" />
        <path d={`M${W} 300 L930 300 L1060 1190 L${W} 1190 Z`} fill="#141619" />
        {/* rear-view mirror */}
        <rect x={420} y={322} width={240} height={78} rx={18} fill="#0e0f11" stroke="#2c3036" strokeWidth={4} />
        <rect x={432} y={332} width={216} height={58} rx={12} fill="#1c2733" opacity={0.9} />
        {/* dashboard */}
        <path d={`M0 1170 Q540 1120 ${W} 1170 V${H} H0 Z`} fill="url(#dash)" />
        <path d="M250 1215 Q540 1135 830 1215 L800 1250 Q540 1185 280 1250 Z" fill="#101215" />
        {/* cluster */}
        <rect x={250} y={1210} width={580} height={260} rx={60} fill="#050607" stroke="#1d2126" strokeWidth={6} />
        <Gauge cx={385} cy={1335} r={105} v={fuel} lit={lit} labels={["E", "F"]} warn={fuelWarn} title="ТОПЛИВО" />
        <Gauge cx={695} cy={1335} r={105} v={rpm / 7} lit={lit} labels={["0", "7"]} title="×1000" />
        {/* central display: cabin temperature */}
        <rect x={478} y={1280} width={124} height={92} rx={12} fill="#0b1520" stroke="#1d2b3a" strokeWidth={3} />
        <text x={540} y={1308} fill={`rgba(140,190,255,${0.35 + 0.65 * Math.max(lit, 0.6)})`} fontFamily="Montserrat" fontWeight={800} fontSize={17} textAnchor="middle">
          САЛОН
        </text>
        <text
          x={540}
          y={1352}
          fill={cabinTemp < 0 ? `rgba(120,200,255,${0.5 + 0.5 * Math.max(lit, 0.6)})` : `rgba(255,190,120,${0.5 + 0.5 * Math.max(lit, 0.6)})`}
          fontFamily="Montserrat"
          fontWeight={900}
          fontSize={34}
          textAnchor="middle"
        >
          {tempStr}
        </text>
        {/* fuel warning lamp */}
        <circle cx={385} cy={1420} r={14} fill={warnOn ? "#ffb000" : "#2a2112"} />
        {/* centre console + heater vents */}
        <rect x={905} y={1260} width={175} height={220} rx={18} fill="#0c0d0f" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={925} y={1285 + i * 30} width={140} height={14} rx={7} fill="#1b1e22" />
        ))}
        {/* steering wheel */}
        <circle cx={540} cy={1790} r={390} fill="none" stroke="url(#wheel)" strokeWidth={70} />
        <path d="M200 1790 Q540 1690 880 1790 L860 1880 Q540 1800 220 1880 Z" fill="#141619" />
        <circle cx={540} cy={1800} r={120} fill="#17191c" stroke="#24272b" strokeWidth={6} />
        {/* ignition key */}
        <g transform={`rotate(${-60 + 90 * keyTurn} 905 1590)`}>
          <circle cx={905} cy={1590} r={34} fill="#1d2024" stroke="#3c4148" strokeWidth={5} />
          <rect x={897} y={1520} width={16} height={70} rx={6} fill="#b9bec5" />
          <rect x={880} y={1488} width={50} height={40} rx={12} fill="#2b2f35" />
        </g>
      </svg>
      {warmth > 0.01 && <AbsoluteFill style={{ backgroundImage: "radial-gradient(ellipse at 50% 100%, rgba(255,150,60,0.32), rgba(255,150,60,0) 70%)", opacity: warmth }} />}
      {focus && <Spotlight {...focus} />}
    </AbsoluteFill>
  );
};

// side window polygon (looking left out the driver's window)
const SW = "polygon(90px 430px, 1010px 380px, 1040px 1130px, 60px 1130px)";

/** Looking left: driver's door with window, door handle, window switch. */
export const SideWindow: React.FC<{ t: number; drop: number; handle: number; handleRed: number; switchK: number; frost: number }> = ({
  t, drop, handle, handleRed, switchK, frost,
}) => {
  const gap = drop * 70; // px the glass has lowered
  const r = mulberry32(3);
  const streaks = drop > 0.05 ? Array.from({ length: 40 }, () => ({ x: r() * 900 + 90, s: r(), d: r() })) : [];
  return (
    <AbsoluteFill>
      {/* glass tint (absent in the gap) */}
      <div style={{ position: "absolute", inset: 0, clipPath: SW, background: "rgba(20,30,45,0.25)", transform: `translateY(${gap}px)` }} />
      <div style={{ position: "absolute", inset: 0, clipPath: SW, transform: `translateY(${gap}px)` }}>
        <Frost clip="inset(0)" k={frost} />
      </div>
      {gap > 2 && (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          {/* glass top edge */}
          <path d={`M90 ${430 + gap} L1010 ${380 + gap}`} stroke="rgba(200,220,240,0.7)" strokeWidth={5} />
          {streaks.map((p, i) => {
            const y = 400 + ((t * (500 + p.s * 400) + p.d * 900) % 760);
            const yTop = 430 - (p.x / 1010) * 50;
            if (y < yTop) return null;
            return <line key={i} x1={p.x} y1={y} x2={p.x + 40 + p.s * 30} y2={y + 14} stroke="rgba(255,255,255,0.6)" strokeWidth={3} strokeLinecap="round" />;
          })}
        </svg>
      )}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="door" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#24272b" />
            <stop offset="1" stopColor="#0a0b0c" />
          </linearGradient>
        </defs>
        {/* frame */}
        <path d={`M0 0 H${W} V380 L1010 380 L90 430 L0 440 Z`} fill="#121417" />
        <path d="M0 440 L90 430 L60 1130 L0 1130 Z" fill="#16181b" />
        <path d={`M${W} 380 L1010 380 L1040 1130 L${W} 1130 Z`} fill="#16181b" />
        {/* door panel */}
        <path d={`M0 1120 H${W} V${H} H0 Z`} fill="url(#door)" />
        <rect x={0} y={1120} width={W} height={34} fill="#2b2f34" />
        <path d="M80 1480 Q540 1430 1000 1480 L1000 1560 Q540 1510 80 1560 Z" fill="#1a1c20" />
        {/* inner door handle */}
        <g opacity={0.6 + 0.4 * handle}>
          <rect x={210} y={1250} width={210} height={70} rx={30} fill="#0d0e10" />
          <rect x={235} y={1268} width={140} height={34} rx={16} fill={handleRed > 0.5 ? "#d7261e" : "#a7adb5"} />
        </g>
        {/* window switch */}
        <rect x={640} y={1478} width={150} height={60} rx={14} fill="#0d0e10" />
        <rect x={660 + switchK * 4} y={1490 + switchK * 8} width={50} height={36} rx={8} fill={switchK > 0 ? YELLOW : "#3a3f46"} />
        <rect x={722} y={1490} width={50} height={36} rx={8} fill="#3a3f46" />
      </svg>
    </AbsoluteFill>
  );
};

/** Phone held up: no signal. */
export const Phone: React.FC<{ k: number; t: number }> = ({ k, t }) => {
  if (k <= 0.01) return null;
  const y = interpolate(k, [0, 1], [500, 0]);
  const pulse = 0.6 + 0.4 * Math.sin(t * 9);
  return (
    <div style={{ position: "absolute", left: 300, top: 520 + y, width: 480, height: 900, borderRadius: 64, background: "#0a0a0b", border: "10px solid #26282c", boxShadow: "0 30px 80px rgba(0,0,0,0.7)" }}>
      <div style={{ position: "absolute", inset: 18, borderRadius: 48, background: "linear-gradient(#1c2a3d, #0b1017)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <svg width={220} height={150}>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={20 + i * 50} y={120 - (i + 1) * 28} width={34} height={(i + 1) * 28} rx={6} fill="rgba(255,255,255,0.18)" />
          ))}
          <line x1={20} y1={20} x2={200} y2={130} stroke="#ff3b30" strokeWidth={12} strokeLinecap="round" opacity={pulse} />
        </svg>
        <div style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: 56, color: "#fff", textTransform: "uppercase" }}>Нет сети</div>
        <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 30, color: "rgba(255,255,255,0.55)" }}>SOS недоступен</div>
      </div>
    </div>
  );
};

/** Full-screen timer card: «ЧАС 1» etc. with a ticking clock hand. */
export const TimerCard: React.FC<{ label: string; k: number; t: number }> = ({ label, k, t }) => {
  const tick = Math.floor(t * 4);
  const ang = tick * 30;
  const pop = interpolate(k, [0, 0.15, 0.3], [0.7, 1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "rgba(3,6,12,0.55)", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40, scale: String(pop) }}>
        <svg width={300} height={300}>
          <circle cx={150} cy={150} r={130} fill="rgba(0,0,0,0.35)" stroke={YELLOW} strokeWidth={14} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return <line key={i} x1={150 + Math.sin(a) * 100} y1={150 - Math.cos(a) * 100} x2={150 + Math.sin(a) * 115} y2={150 - Math.cos(a) * 115} stroke="#fff" strokeWidth={6} />;
          })}
          <line x1={150} y1={150} x2={150 + Math.sin((ang * Math.PI) / 180) * 95} y2={150 - Math.cos((ang * Math.PI) / 180) * 95} stroke={YELLOW} strokeWidth={10} strokeLinecap="round" />
          <circle cx={150} cy={150} r={12} fill={YELLOW} />
        </svg>
        <div
          style={{
            fontFamily: "Montserrat",
            fontWeight: 900,
            fontSize: 150,
            color: YELLOW,
            letterSpacing: 6,
            textShadow: "0 0 30px rgba(0,0,0,0.9), 0 8px 0 rgba(0,0,0,0.8)",
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Small persistent timer chip at the top. */
export const TimerChip: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ position: "absolute", top: 130, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
    <div
      style={{
        fontFamily: "Montserrat",
        fontWeight: 900,
        fontSize: 50,
        color: "#111",
        background: YELLOW,
        padding: "10px 34px",
        borderRadius: 18,
        letterSpacing: 3,
        boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <svg width={40} height={40}>
        <circle cx={20} cy={20} r={16} fill="none" stroke="#111" strokeWidth={5} />
        <line x1={20} y1={20} x2={20} y2={9} stroke="#111" strokeWidth={5} strokeLinecap="round" />
        <line x1={20} y1={20} x2={28} y2={22} stroke="#111" strokeWidth={5} strokeLinecap="round" />
      </svg>
      {label}
    </div>
  </div>
);

/** Breath vapour rising from the bottom of the frame (first person), one exhale every ~3 s. */
export const Breath: React.FC<{ t: number; k: number }> = ({ t, k }) => {
  if (k <= 0.01) return null;
  const period = 3.2;
  const ph = (t % period) / period;
  const a = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI) : 0;
  const rise = ph * 420;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 540 - 260 + i * 90 + Math.sin(t * 2 + i) * 30,
            top: 1380 - rise - i * 60,
            width: 420 + ph * 300,
            height: 300 + ph * 200,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(235,242,250,0.55), rgba(235,242,250,0) 65%)",
            opacity: a * k * (1 - i * 0.25),
            filter: "blur(8px)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Eyelids closing (0 open .. 1 shut). */
export const Eyelids: React.FC<{ k: number }> = ({ k }) =>
  k <= 0.01 ? null : (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: -100, right: -100, top: 0, height: (H / 2) * k + 120 * k, background: "#000", borderRadius: "0 0 50% 50%" }} />
      <div style={{ position: "absolute", left: -100, right: -100, bottom: 0, height: (H / 2) * k + 120 * k, background: "#000", borderRadius: "50% 50% 0 0" }} />
    </AbsoluteFill>
  );

/** Carbon monoxide: grey translucent wisps creeping up from the floor. */
export const GasWisps: React.FC<{ t: number; k: number }> = ({ t, k }) => {
  if (k <= 0.01) return null;
  const r = mulberry32(8);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 14 }, (_, i) => {
        const x = r() * W, sp = 60 + r() * 80, ph = r() * 10, sz = 380 + r() * 380;
        const y = H - ((t * sp + ph * 100) % 1500);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - sz / 2 + Math.sin(t * 0.8 + ph) * 80,
              top: y - sz / 2,
              width: sz,
              height: sz * 0.6,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(170,175,185,0.35), rgba(170,175,185,0) 70%)",
              opacity: k,
              filter: "blur(14px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ k: number; color?: string }> = ({ k, color = "0,0,0" }) =>
  k <= 0.01 ? null : <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(${color},0) 35%, rgba(${color},${k}) 100%)` }} />;

/** Mitten holding a lump of snow, crossed out. */
export const SnowHand: React.FC<{ k: number; cross: number }> = ({ k, cross }) => {
  if (k <= 0.01) return null;
  const y = ease(k, [0, 1], [700, 0]);
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(0 ${y})`}>
        <path d="M330 1600 Q300 1300 420 1180 Q540 1100 660 1180 Q780 1300 750 1600 Z" fill="#2c3f5a" />
        <path d="M330 1600 Q300 1420 360 1330 L420 1340 Q380 1450 400 1600 Z" fill="#22344c" />
        <ellipse cx={540} cy={1150} rx={190} ry={120} fill="#eef3f8" />
        <ellipse cx={500} cy={1110} rx={90} ry={50} fill="#ffffff" />
        <ellipse cx={600} cy={1170} rx={60} ry={30} fill="#d9e2ec" />
      </g>
      {cross > 0 && (
        <g opacity={cross} stroke="#ff3b30" strokeWidth={36} strokeLinecap="round">
          <line x1={330} y1={900} x2={750} y2={1400} strokeDasharray={700} strokeDashoffset={700 * (1 - clamp(cross * 2))} />
          <line x1={750} y1={900} x2={330} y2={1400} strokeDasharray={700} strokeDashoffset={700 * (1 - clamp(cross * 2 - 1))} />
        </g>
      )}
    </svg>
  );
};

/** Plastic bottle with snow slowly melting into water, tucked under the jacket. */
export const Bottle: React.FC<{ k: number; melt: number; tuck: number }> = ({ k, melt, tuck }) => {
  if (k <= 0.01) return null;
  const y = ease(k, [0, 1], [800, 0]) + tuck * 260;
  const water = 0.15 + 0.6 * melt;
  const snow = 0.75 * (1 - melt);
  const bx = 430, by = 820, bw = 220, bh = 620;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <clipPath id="btl">
          <rect x={bx} y={by} width={bw} height={bh} rx={50} />
        </clipPath>
        <linearGradient id="jacket" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1a2533" />
          <stop offset="0.5" stopColor="#24344a" />
          <stop offset="1" stopColor="#1a2533" />
        </linearGradient>
      </defs>
      <g transform={`translate(0 ${y})`}>
        <rect x={bx + 70} y={by - 110} width={80} height={60} rx={10} fill="#2d6cdf" />
        <rect x={bx + 60} y={by - 60} width={100} height={70} rx={20} fill="rgba(210,230,255,0.25)" stroke="rgba(230,240,255,0.6)" strokeWidth={4} />
        <g clipPath="url(#btl)">
          <rect x={bx} y={by} width={bw} height={bh} fill="rgba(200,225,255,0.12)" />
          <rect x={bx} y={by + bh * (1 - water)} width={bw} height={bh * water} fill="rgba(120,180,255,0.45)" />
          <rect x={bx} y={by + bh * (1 - water - snow)} width={bw} height={bh * snow} fill="rgba(245,248,252,0.92)" />
        </g>
        <rect x={bx} y={by} width={bw} height={bh} rx={50} fill="none" stroke="rgba(230,240,255,0.7)" strokeWidth={5} />
        <rect x={bx + 26} y={by + 40} width={18} height={bh - 120} rx={9} fill="rgba(255,255,255,0.35)" />
      </g>
      {/* jacket flap covering the bottle as it is tucked away */}
      <path d={`M0 ${1920 - 900 * tuck} Q540 ${1840 - 900 * tuck} 1080 ${1920 - 900 * tuck} V1920 H0 Z`} fill="url(#jacket)" opacity={tuck > 0.01 ? 1 : 0} />
      {tuck > 0.01 && <line x1={540} y1={1920 - 880 * tuck} x2={540} y2={1920} stroke="#888d94" strokeWidth={10} strokeDasharray="14 10" />}
    </svg>
  );
};

/** Two mittens clenching and unclenching. */
export const Fists: React.FC<{ k: number; t: number }> = ({ k, t }) => {
  if (k <= 0.01) return null;
  const y = ease(k, [0, 1], [700, 0]);
  const clench = 0.5 + 0.5 * Math.sin(t * 6);
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {[-1, 1].map((sg) => {
        const cx = 540 + sg * 230;
        const s = 1 - clench * 0.12;
        return (
          <g key={sg} transform={`translate(${cx} ${1450 + y}) scale(${sg * s} ${s})`}>
            <path d="M-120 300 Q-150 0 -100 -110 Q0 -190 100 -120 Q150 0 120 300 Z" fill="#2c3f5a" />
            <path d={`M-100 -60 Q-160 ${-40 + clench * 50} -150 ${40 + clench * 40} Q-120 ${60 + clench * 20} -90 30`} fill="#22344c" />
            <path d="M-110 120 Q0 100 110 120 L115 170 Q0 150 -115 170 Z" fill="#1b2a3e" />
          </g>
        );
      })}
    </svg>
  );
};
