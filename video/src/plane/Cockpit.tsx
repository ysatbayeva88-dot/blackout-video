import React from "react";
import { S, E, W, active, phrases, tween } from "./timeline";


const YELLOW = "#FFD60A";
const GREEN = "#30D158";
const RED = "#FF3B30";
const BEZEL = "#0b0d12";
const RIM = "#3b4252";
const DIM_TEXT = "#8b93a5";

/** Pulsing yellow glow ring around a highlighted element. */
const Glow: React.FC<{ g: number; t: number; children: React.ReactNode }> = ({ g, t, children }) =>
  g <= 0.001 ? null : (
    <g opacity={g * (0.75 + 0.25 * Math.sin(t * 9))} filter="url(#glow)" stroke={YELLOW} fill="none" strokeWidth={8}>
      {children}
    </g>
  );

const fmtAlt = (m: number) => Math.round(m).toLocaleString("ru-RU").replace(/ /g, " ");

export const Cockpit: React.FC<{ t: number }> = ({ t }) => {
  // ---------- flight state, all driven by voiceover timings ----------
  const touch = S(32);
  const altitude =
    t < S(14)
      ? 10000 + Math.sin(t * 1.7) * 6
      : t < S(17)
        ? tween(t, [S(14), S(17)], [10000, 300])
        : tween(t, [S(17), S(29), S(30), S(31), touch], [300, 30, 10, 5, 0]);
  const speed =
    t < S(19)
      ? 480
      : t < touch
        ? tween(t, [S(19), E(19), touch], [480, 260, 240])
        : tween(t, [touch, E(35)], [240, 0]);
  const roll =
    tween(t, [S(24), E(24), S(27), E(27) - 0.3], [0, 28, 26, 0]) +
    (t > S(23) && t < E(26) ? Math.sin(t * 23) * 3 + Math.sin(t * 37) * 2 : 0);
  const pitch = tween(t, [S(14), S(14) + 1.5, S(17), W(28, 2), touch, touch + 0.5], [0, 45, 0, 0, -45, 0]);
  const apOn = t < W(28, 0) + 0.3; // engaged from the start, off on "Отключайте"
  const yokeRot = tween(t, [S(26), S(26) + 0.35, S(27), E(27)], [0, -22, -22, 0]);
  const flaps = tween(t, [S(18), E(18)], [0, 1]);
  const gear = tween(t, [S(20), E(20)], [0, 1]);
  const gearLights = [0, 1, 2].map((i) => t > S(21) + i * 0.3);
  const throttle = tween(t, [W(28, 5), E(28)], [0, 1]); // 0 = cruise, 1 = idle
  const knob = tween(t, [S(14), E(14)], [0, -540]);
  const brakes = active(t, [phrases(34, 35)]);
  const rolloutPhase = t > touch ? tween(t, [touch, E(35)], [0, 1]) : 0;

  // runway grows from a dot on the horizon to filling the windshield at touchdown
  const runway = t < S(17) ? 0 : tween(t, [S(17), S(22), touch], [0.03, 0.25, 1]);
  const cautionBlink = (active(t, [[0, S(10)]]) + active(t, [phrases(24, 26)])) > 0 && Math.sin(t * 14) > 0;

  // ---------- highlight windows ----------
  const hl = {
    yoke: active(t, [phrases(0, 1), phrases(26, 27)]),
    alt: active(t, [phrases(2, 2), phrases(14, 15), phrases(29, 31)]),
    headset: active(t, [phrases(5)]),
    ptt: active(t, [phrases(6, 7)]),
    ap: active(t, [phrases(11, 12), [W(28, 0), W(28, 1) + 0.3]]),
    knob: active(t, [phrases(14)]),
    speed: active(t, [phrases(19)]),
    flaps: active(t, [phrases(18)]),
    gear: active(t, [phrases(20, 21)]),
    attitude: active(t, [phrases(24, 27), [W(28, 2), W(28, 4) + 0.3]]),
    throttle: active(t, [[W(28, 5), E(28) + 0.3]]),
    brakes,
  };
  const radioWaves = active(t, [phrases(7), phrases(10), phrases(14), phrases(28)]);

  // ---------- windshield ----------
  const horizonY = 470 + pitch;
  const cloudShift = (t * (t < touch ? 60 : 60 * (1 - rolloutPhase))) % 1400;

  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#081428" />
          <stop offset="0.55" stopColor="#24305a" />
          <stop offset="0.85" stopColor="#c2603a" />
          <stop offset="1" stopColor="#f4a259" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2a33" />
          <stop offset="1" stopColor="#14161c" />
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#232833" />
          <stop offset="1" stopColor="#12151b" />
        </linearGradient>
        <clipPath id="windshield">
          <path d="M60 120 Q540 40 1020 120 L1060 760 L20 760 Z" />
        </clipPath>
        <clipPath id="attClip">
          <circle cx={290} cy={1010} r={118} />
        </clipPath>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.7" />
        </radialGradient>
      </defs>

      {/* ===== Windshield view ===== */}
      <rect width={1080} height={1920} fill="#07090d" />
      <g clipPath="url(#windshield)">
        <g transform={`rotate(${roll} 540 ${horizonY})`}>
          <rect x={-600} y={horizonY - 1600} width={2280} height={1000} fill="#081428" />
          <rect x={-600} y={horizonY - 600} width={2280} height={600} fill="url(#sky)" />
          <rect x={-600} y={horizonY} width={2280} height={1600} fill="url(#ground)" />
          {/* city lights near horizon */}
          {Array.from({ length: 40 }).map((_, i) => (
            <circle key={i} cx={-200 + ((i * 97) % 1500)} cy={horizonY + 6 + ((i * 37) % 40)} r={2 + (i % 3)} fill="#ffcf7a" opacity={0.5} />
          ))}
          {/* runway trapezoid */}
          {runway > 0 && (
            <g>
              <polygon
                points={`${540 - 20 * runway} ${horizonY + 2} ${540 + 20 * runway} ${horizonY + 2} ${540 + 900 * runway} ${horizonY + 30 + 1100 * runway} ${540 - 900 * runway} ${horizonY + 30 + 1100 * runway}`}
                fill="#3a3d46"
                stroke="#e9eef7"
                strokeWidth={2 + 6 * runway}
              />
              {Array.from({ length: 10 }).map((_, i) => {
                const k = ((i + rolloutPhase * 25 + (t > touch ? (t - touch) * 4 * (1 - rolloutPhase) : 0)) % 10) / 10;
                const y = horizonY + 4 + (30 + 1100 * runway) * k * k;
                const w = (2 + 18 * runway) * (0.2 + k);
                return <rect key={i} x={540 - w / 2} y={y} width={w} height={8 + 60 * runway * k} fill="#f4f6fb" opacity={0.9} />;
              })}
              {/* approach lights */}
              {[-1, 1].map((s) =>
                Array.from({ length: 6 }).map((_, i) => (
                  <circle key={`${s}${i}`} cx={540 + s * (24 + i * 140) * runway} cy={horizonY + 12 + i * 160 * runway} r={3 + 6 * runway} fill={i % 2 ? "#ff4d4d" : "#fff6c2"} />
                )),
              )}
            </g>
          )}
        </g>
        {/* clouds drifting by */}
        {t < touch &&
          [0, 1, 2, 3].map((i) => (
            <ellipse
              key={i}
              cx={((i * 380 - cloudShift * (1 + i * 0.3) + 2400) % 1500) - 200}
              cy={170 + i * 70 + pitch}
              rx={180 + i * 40}
              ry={34 + i * 6}
              fill="#c9d3ea"
              opacity={(0.12 + 0.04 * i) * tween(t, [S(16), S(17)], [1, 0])}
            />
          ))}
      </g>
      {/* windshield frame + center pillar */}
      <path d="M60 120 Q540 40 1020 120 L1060 760 L20 760 Z" fill="none" stroke="#0e1117" strokeWidth={40} />
      <rect x={526} y={60} width={28} height={700} fill="#0e1117" />

      {/* ===== Glareshield: autopilot panel ===== */}
      <rect x={0} y={740} width={1080} height={130} fill="#0f1218" />
      <rect x={250} y={762} width={580} height={88} rx={14} fill={BEZEL} stroke={RIM} strokeWidth={3} />
      <rect x={272} y={776} width={110} height={60} rx={10} fill={apOn ? GREEN : "#1d2a22"} />
      <text x={327} y={818} textAnchor="middle" fontSize={34} fontWeight={900} fill={apOn ? "#04210c" : "#3d5a46"} fontFamily="Montserrat">AP</text>
      <Glow g={hl.ap} t={t}><rect x={264} y={768} width={126} height={76} rx={14} /></Glow>
      <text x={420} y={800} fontSize={22} fill={DIM_TEXT} fontFamily="Montserrat" fontWeight={700}>ALT</text>
      <text x={420} y={834} fontSize={34} fill="#ffb340" fontFamily="DejaVu Sans Mono" fontWeight={700}>{String(t < S(14) ? 10000 : 300).padStart(5, "0")}</text>
      {/* altitude select knob */}
      <g transform={`rotate(${knob} 640 806)`}>
        <circle cx={640} cy={806} r={34} fill="#2a2f3a" stroke="#596274" strokeWidth={4} />
        <rect x={637} y={774} width={6} height={22} rx={3} fill="#e9eef7" />
      </g>
      <Glow g={hl.knob} t={t}><circle cx={640} cy={806} r={44} /></Glow>
      {/* master caution */}
      <rect x={720} y={776} width={92} height={60} rx={10} fill={cautionBlink ? RED : "#3a1414"} />
      <text x={766} y={803} textAnchor="middle" fontSize={15} fontWeight={800} fill={cautionBlink ? "#fff" : "#6b3030"} fontFamily="Montserrat">MASTER</text>
      <text x={766} y={824} textAnchor="middle" fontSize={15} fontWeight={800} fill={cautionBlink ? "#fff" : "#6b3030"} fontFamily="Montserrat">CAUTION</text>

      {/* ===== Main instrument panel ===== */}
      <rect x={0} y={870} width={1080} height={480} fill="url(#panel)" />

      {/* attitude indicator */}
      <circle cx={290} cy={1010} r={130} fill={BEZEL} stroke={RIM} strokeWidth={6} />
      <g clipPath="url(#attClip)">
        <g transform={`rotate(${roll} 290 1010) translate(0 ${pitch * 0.6})`}>
          <rect x={100} y={760} width={380} height={250} fill="#2f7fd6" />
          <rect x={100} y={1010} width={380} height={250} fill="#8a5a2b" />
          <line x1={100} y1={1010} x2={480} y2={1010} stroke="#fff" strokeWidth={4} />
          {[-40, -20, 20, 40].map((d) => (
            <line key={d} x1={290 - (Math.abs(d) === 20 ? 30 : 50)} y1={1010 + d} x2={290 + (Math.abs(d) === 20 ? 30 : 50)} y2={1010 + d} stroke="#fff" strokeWidth={3} />
          ))}
        </g>
      </g>
      <path d="M210 1010 L265 1010 L290 1030 L315 1010 L370 1010" fill="none" stroke={YELLOW} strokeWidth={8} strokeLinejoin="round" />
      <Glow g={hl.attitude} t={t}><circle cx={290} cy={1010} r={140} /></Glow>

      {/* speed readout (center) */}
      <rect x={450} y={940} width={180} height={140} rx={16} fill={BEZEL} stroke={RIM} strokeWidth={4} />
      <text x={540} y={978} textAnchor="middle" fontSize={22} fill={DIM_TEXT} fontWeight={700} fontFamily="Montserrat">СКОРОСТЬ</text>
      <text x={540} y={1038} textAnchor="middle" fontSize={54} fill="#e9eef7" fontWeight={700} fontFamily="DejaVu Sans Mono">{Math.round(speed)}</text>
      <text x={540} y={1068} textAnchor="middle" fontSize={20} fill={DIM_TEXT} fontFamily="Montserrat">км/ч</text>
      <Glow g={hl.speed} t={t}><rect x={440} y={930} width={200} height={160} rx={22} /></Glow>

      {/* altimeter */}
      <circle cx={790} cy={1010} r={130} fill={BEZEL} stroke={RIM} strokeWidth={6} />
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <g key={i}>
            <line x1={790 + Math.sin(a) * 100} y1={1010 - Math.cos(a) * 100} x2={790 + Math.sin(a) * 120} y2={1010 - Math.cos(a) * 120} stroke="#cfd6e4" strokeWidth={4} />
            <text x={790 + Math.sin(a) * 80} y={1018 - Math.cos(a) * 80} textAnchor="middle" fontSize={22} fill="#cfd6e4" fontFamily="DejaVu Sans Mono">{i}</text>
          </g>
        );
      })}
      <line x1={790} y1={1010} x2={790} y2={905} stroke="#fff" strokeWidth={7} strokeLinecap="round" transform={`rotate(${(altitude / 1000) * 36} 790 1010)`} />
      <circle cx={790} cy={1010} r={10} fill="#fff" />
      <rect x={725} y={1080} width={130} height={40} rx={8} fill="#000" stroke={RIM} strokeWidth={2} />
      <text x={790} y={1110} textAnchor="middle" fontSize={26} fill="#ffb340" fontWeight={700} fontFamily="DejaVu Sans Mono">{fmtAlt(altitude)} м</text>
      <Glow g={hl.alt} t={t}><circle cx={790} cy={1010} r={140} /></Glow>

      {/* lower row: gear, flaps, throttle, headset */}
      {/* gear lever */}
      <rect x={110} y={1180} width={120} height={140} rx={12} fill={BEZEL} stroke={RIM} strokeWidth={3} />
      <rect x={164} y={1196} width={12} height={110} rx={6} fill="#2a2f3a" />
      <circle cx={170} cy={1210 + 80 * gear} r={22} fill="#e9eef7" stroke="#8b93a5" strokeWidth={3} />
      <text x={170} y={1350} textAnchor="middle" fontSize={22} fill={DIM_TEXT} fontWeight={700} fontFamily="Montserrat">ШАССИ</text>
      {gearLights.map((on, i) => (
        <circle key={i} cx={250 + i * 0} cy={1200 + i * 46} r={14} fill={on ? GREEN : "#1d2a22"} stroke="#0b0d12" strokeWidth={3} />
      ))}
      <Glow g={hl.gear} t={t}><rect x={100} y={1170} width={180} height={160} rx={18} /></Glow>
      {/* flaps */}
      <rect x={330} y={1180} width={110} height={140} rx={12} fill={BEZEL} stroke={RIM} strokeWidth={3} />
      <rect x={379} y={1196} width={12} height={110} rx={6} fill="#2a2f3a" />
      <rect x={355} y={1196 + 80 * flaps} width={60} height={30} rx={6} fill="#cfd6e4" />
      <text x={385} y={1350} textAnchor="middle" fontSize={22} fill={DIM_TEXT} fontWeight={700} fontFamily="Montserrat">ЗАКРЫЛКИ</text>
      <Glow g={hl.flaps} t={t}><rect x={320} y={1170} width={130} height={160} rx={18} /></Glow>
      {/* throttle */}
      <rect x={520} y={1180} width={140} height={140} rx={12} fill={BEZEL} stroke={RIM} strokeWidth={3} />
      <rect x={584} y={1196} width={12} height={110} rx={6} fill="#2a2f3a" />
      <rect x={545} y={1200 + 80 * throttle} width={90} height={26} rx={8} fill="#1e1e1e" stroke="#596274" strokeWidth={3} />
      <text x={590} y={1350} textAnchor="middle" fontSize={22} fill={DIM_TEXT} fontWeight={700} fontFamily="Montserrat">ГАЗ</text>
      <Glow g={hl.throttle} t={t}><rect x={510} y={1170} width={160} height={160} rx={18} /></Glow>
      {/* brakes light */}
      <rect x={700} y={1250} width={120} height={50} rx={10} fill={brakes > 0.5 ? "#ff9f0a" : "#2b2214"} />
      <text x={760} y={1283} textAnchor="middle" fontSize={20} fontWeight={800} fill={brakes > 0.5 ? "#2b1600" : "#5a4a2a"} fontFamily="Montserrat">ТОРМОЗ</text>
      <Glow g={hl.brakes} t={t}><rect x={692} y={1242} width={136} height={66} rx={14} /></Glow>
      {/* headset */}
      <g transform="translate(910 1215)">
        <path d="M-50 20 Q-50 -50 0 -50 Q50 -50 50 20" fill="none" stroke="#cfd6e4" strokeWidth={10} strokeLinecap="round" />
        <rect x={-64} y={8} width={28} height={50} rx={10} fill="#cfd6e4" />
        <rect x={36} y={8} width={28} height={50} rx={10} fill="#cfd6e4" />
        <path d="M-50 50 Q-40 80 -5 80" fill="none" stroke="#cfd6e4" strokeWidth={5} />
        <circle cx={-2} cy={80} r={8} fill="#cfd6e4" />
      </g>
      <Glow g={hl.headset} t={t}><circle cx={910} cy={1225} r={86} /></Glow>
      {/* radio waves from headset during radio calls */}
      {radioWaves > 0 &&
        [0, 1, 2].map((i) => {
          const k = (t * 1.5 + i / 3) % 1;
          return <circle key={i} cx={910} cy={1215} r={60 + k * 110} fill="none" stroke={GREEN} strokeWidth={4} opacity={radioWaves * (1 - k)} />;
        })}

      {/* ===== Yoke ===== */}
      <g transform={`rotate(${yokeRot} 540 1560)`}>
        <rect x={510} y={1560} width={60} height={400} fill="#14171d" />
        <path
          d="M300 1440 Q300 1600 400 1600 L680 1600 Q780 1600 780 1440 L740 1440 Q740 1545 670 1545 L410 1545 Q340 1545 340 1440 Z"
          fill="#20242d"
          stroke="#3b4252"
          strokeWidth={5}
        />
        <rect x={290} y={1400} width={60} height={70} rx={20} fill="#20242d" stroke="#3b4252" strokeWidth={5} />
        <rect x={730} y={1400} width={60} height={70} rx={20} fill="#20242d" stroke="#3b4252" strokeWidth={5} />
        {/* push-to-talk button */}
        <circle cx={320} cy={1420} r={14} fill={hl.ptt > 0.5 && t > W(7, 0) - 0.4 ? RED : "#7a1f1f"} />
        <Glow g={hl.ptt} t={t}><circle cx={320} cy={1420} r={30} /></Glow>
        <Glow g={hl.yoke} t={t}>
          <path d="M300 1440 Q300 1600 400 1600 L680 1600 Q780 1600 780 1440" />
        </Glow>
      </g>

      <rect width={1080} height={1920} fill="url(#vignette)" />
    </svg>
  );
};
