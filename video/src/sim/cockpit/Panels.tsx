import React from "react";
import { mulberry32 } from "../rng";

const F = "DejaVu Sans, sans-serif";
const MONO = "DejaVu Sans Mono, monospace";
const PANEL = "#4a535e";
const PANEL_DARK = "#353c45";
const LABEL = "#e9edf2";

/** Overhead panel seen from below, rows shrink towards the windshield (fake perspective). */
export const Overhead: React.FC<{ lights: number }> = ({ lights }) => {
  const r = mulberry32(1234);
  const rows = 4;
  const els: React.ReactNode[] = [];
  const names = ["FUEL", "HYD", "ELEC", "APU", "BLEED", "PRESS", "ANTI-ICE", "LIGHTS", "IRS", "ENG START", "PACKS", "WIPERS"];
  for (let row = 0; row < rows; row++) {
    const y0 = 10 + row * 62 - row * row * 3;
    const h = 58 - row * 6;
    const sx = 1 - row * 0.07;
    const modules = 6;
    for (let m = 0; m < modules; m++) {
      const w = (1080 * sx) / modules;
      const x0 = 540 - (1080 * sx) / 2 + m * w;
      els.push(<rect key={`m${row}${m}`} x={x0 + 3} y={y0} width={w - 6} height={h} rx={4} fill={PANEL} stroke="#2a2f36" strokeWidth={2} />);
      els.push(
        <text key={`t${row}${m}`} x={x0 + w / 2} y={y0 + 12} fontSize={9 - row} fill={LABEL} fontFamily={F} textAnchor="middle" opacity={0.85}>
          {names[(row * 6 + m) % names.length]}
        </text>,
      );
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const cx = x0 + ((k + 0.5) * w) / n;
        const kind = r();
        if (kind < 0.45) {
          // toggle switch
          els.push(<circle key={`s${row}${m}${k}`} cx={cx} cy={y0 + h * 0.62} r={7 - row} fill="#1d2126" stroke="#9aa3ad" strokeWidth={1.5} />);
          els.push(<rect key={`l${row}${m}${k}`} x={cx - 2} y={y0 + h * 0.62 - (r() > 0.5 ? 14 : 0) + row} width={4} height={14 - row * 2} rx={2} fill="#d8dde3" />);
        } else if (kind < 0.8) {
          // annunciator light
          const on = r() < lights;
          const col = r() > 0.5 ? "#4da3ff" : "#ffb000";
          els.push(<rect key={`a${row}${m}${k}`} x={cx - 14 + row} y={y0 + h * 0.4} width={28 - row * 2} height={14 - row} rx={2} fill={on ? col : "#23272d"} opacity={on ? 0.95 : 1} />);
        } else {
          // rotary knob
          els.push(<circle key={`k${row}${m}${k}`} cx={cx} cy={y0 + h * 0.62} r={10 - row} fill="#15181c" stroke="#5e6670" strokeWidth={2} />);
          els.push(<line key={`kl${row}${m}${k}`} x1={cx} y1={y0 + h * 0.62} x2={cx + 6} y2={y0 + h * 0.62 - 7} stroke="#fff" strokeWidth={2} />);
        }
      }
    }
  }
  return (
    <g>
      <path d="M0 0 L1080 0 L1080 230 Q540 290 0 230 Z" fill={PANEL_DARK} />
      {els}
      <path d="M0 0 L1080 0 L1080 230 Q540 290 0 230 Z" fill="url(#overheadShade)" />
    </g>
  );
};

/** Windshield frame: posts, sills and wipers; the glass areas stay transparent. */
export const WindshieldFrame: React.FC = () => (
  <g>
    {/* frame drawn as a ring with the two front windows cut out (evenodd) */}
    <path
      fillRule="evenodd"
      fill="#2a2f35"
      d={`M0 210 L1080 210 L1080 880 L0 880 Z
          M60 300 Q290 262 518 268 L518 860 L40 860 Z
          M562 268 Q790 262 1020 300 L1040 860 L562 860 Z`}
    />
    <rect x={518} y={260} width={44} height={610} fill="#23272d" />
    <rect x={530} y={260} width={20} height={610} fill="#30363d" />
    {/* glass tint + reflection */}
    <path d="M60 300 Q290 262 518 268 L518 860 L40 860 Z" fill="url(#glass)" />
    <path d="M562 268 Q790 262 1020 300 L1040 860 L562 860 Z" fill="url(#glass)" />
    {/* wipers parked */}
    <line x1={120} y1={850} x2={420} y2={820} stroke="#15181b" strokeWidth={7} strokeLinecap="round" />
    <line x1={660} y1={820} x2={960} y2={850} stroke="#15181b" strokeWidth={7} strokeLinecap="round" />
  </g>
);

const Window: React.FC<{ x: number; y: number; w: number; label: string; value: string; color?: string }> = ({ x, y, w, label, value, color = "#ffae34" }) => (
  <g>
    <text x={x + w / 2} y={y - 6} fontSize={13} fill={LABEL} fontFamily={F} textAnchor="middle" fontWeight={700}>{label}</text>
    <rect x={x} y={y} width={w} height={34} rx={3} fill="#050607" stroke="#6b7480" strokeWidth={1.5} />
    <text x={x + w - 8} y={y + 26} fontSize={24} fill={color} fontFamily={MONO} textAnchor="end" fontWeight={700}>{value}</text>
  </g>
);

const Knob: React.FC<{ cx: number; cy: number; r?: number; angle?: number }> = ({ cx, cy, r = 20, angle = 0 }) => (
  <g transform={`rotate(${angle} ${cx} ${cy})`}>
    <circle cx={cx} cy={cy} r={r + 4} fill="#1c1f24" />
    {Array.from({ length: 18 }).map((_, i) => (
      <line key={i} x1={cx} y1={cy - r - 3} x2={cx} y2={cy - r + 1} stroke="#7d8692" strokeWidth={2} transform={`rotate(${i * 20} ${cx} ${cy})`} />
    ))}
    <circle cx={cx} cy={cy} r={r - 2} fill="url(#knobGrad)" />
    <rect x={cx - 1.5} y={cy - r + 2} width={3} height={10} fill="#fff" />
  </g>
);

const Btn: React.FC<{ x: number; y: number; label: string; on?: boolean }> = ({ x, y, label, on }) => (
  <g>
    <rect x={x} y={y} width={58} height={40} rx={4} fill="#d7dbe0" stroke="#22262b" strokeWidth={2} />
    <rect x={x + 8} y={y + 4} width={42} height={8} rx={2} fill={on ? "#38ff6a" : "#2c3a30"} />
    <text x={x + 29} y={y + 31} fontSize={12} fill="#1c1f24" fontFamily={F} textAnchor="middle" fontWeight={800}>{label}</text>
  </g>
);

export type McpState = { spd: number; hdg: number; alt: number; vs: number; cmdA: boolean; knobAlt: number; caution: boolean };

/** Glareshield with the Mode Control Panel (autopilot). */
export const Glareshield: React.FC<{ s: McpState }> = ({ s }) => (
  <g>
    <path d="M0 860 Q540 840 1080 860 L1080 1000 L0 1000 Z" fill="#1d2025" />
    <rect x={95} y={872} width={890} height={112} rx={8} fill={PANEL} stroke="#262b31" strokeWidth={3} />
    <Window x={115} y={900} w={80} label="COURSE" value="240" />
    <Btn x={210} y={898} label="N1" />
    <Btn x={210} y={942 - 2} label="SPD" on />
    <Window x={285} y={900} w={86} label="IAS/MACH" value={String(Math.round(s.spd))} />
    <Knob cx={328} cy={958} r={14} />
    <Window x={395} y={900} w={80} label="HEADING" value={String(Math.round(s.hdg)).padStart(3, "0")} />
    <Knob cx={435} cy={958} r={14} angle={s.hdg} />
    <Window x={495} y={900} w={112} label="ALTITUDE" value={String(Math.round(s.alt))} />
    <Knob cx={551} cy={958} r={15} angle={s.knobAlt} />
    <Window x={627} y={900} w={90} label="VERT SPEED" value={s.vs === 0 ? "" : (s.vs > 0 ? "+" : "") + s.vs} color="#ffffff" />
    <Btn x={735} y={898} label="VNAV" on />
    <Btn x={735} y={940} label="LNAV" on />
    <Btn x={805} y={898} label="CMD A" on={s.cmdA} />
    <Btn x={805} y={940} label="CMD B" />
    <rect x={875} y={898} width={96} height={82} rx={5} fill="#1c1f24" />
    <text x={923} y={918} fontSize={12} fill={LABEL} fontFamily={F} textAnchor="middle" fontWeight={700}>A/P ENGAGE</text>
    <rect x={889} y={928} width={68} height={40} rx={4} fill={s.cmdA ? "#38ff6a" : "#183020"} />
    <text x={923} y={955} fontSize={16} fill={s.cmdA ? "#052a10" : "#3b6046"} fontFamily={F} textAnchor="middle" fontWeight={900}>A/P</text>
    {/* master caution / fire warning */}
    {[18, 1000].map((x, i) => (
      <g key={x}>
        <rect x={x} y={884} width={62} height={40} rx={5} fill={s.caution ? (i ? "#ff2a1f" : "#ffb000") : "#3b2a20"} />
        <text x={x + 31} y={901} fontSize={10} fill={s.caution ? "#fff" : "#6b5040"} fontFamily={F} textAnchor="middle" fontWeight={800}>{i ? "FIRE" : "MASTER"}</text>
        <text x={x + 31} y={915} fontSize={10} fill={s.caution ? "#fff" : "#6b5040"} fontFamily={F} textAnchor="middle" fontWeight={800}>{i ? "WARN" : "CAUTION"}</text>
      </g>
    ))}
  </g>
);

/** Centre pedestal: thrust levers, flap lever, speed brake. Gear panel on the right. */
export const Pedestal: React.FC<{ thrust: number; flaps: number; gear: number; gearLights: boolean[]; reverse: number }> = ({ thrust, flaps, gear, gearLights, reverse }) => {
  const detents = ["UP", "1", "2", "5", "10", "15", "25", "30", "40"];
  const flapY = 1430 + (flaps / 40) * 190;
  return (
    <g>
      <rect x={0} y={1385} width={1080} height={535} fill="#121418" />
      <path d="M330 1385 L750 1385 L860 1920 L220 1920 Z" fill="url(#pedestal)" stroke="#2c3138" strokeWidth={3} />
      {/* thrust lever slots + handles (0 = idle at bottom, 1 = full) */}
      {[470, 560].map((x, i) => {
        const y = 1640 - thrust * 190;
        return (
          <g key={x}>
            <rect x={x - 7} y={1430} width={14} height={240} rx={7} fill="#08090b" />
            <rect x={x - 5} y={y} width={10} height={1700 - y} fill="#9aa3ad" />
            <rect x={x - 38} y={y - 22} width={76} height={36} rx={12} fill="#1d1f23" stroke="#5c646e" strokeWidth={3} />
            <rect x={x - 30} y={y - 16} width={60} height={8} rx={4} fill="#3a3f46" />
            {/* reverse thrust lever */}
            <rect x={x - 12} y={y - 30 - reverse * 40} width={24} height={16} rx={5} fill="#c9cdd2" />
            <text x={x} y={1700} fontSize={14} fill={LABEL} fontFamily={F} textAnchor="middle">{i + 1}</text>
          </g>
        );
      })}
      <text x={515} y={1424} fontSize={13} fill={LABEL} fontFamily={F} textAnchor="middle" fontWeight={700}>THRUST</text>
      {/* flap lever */}
      <rect x={673} y={1430} width={12} height={200} rx={6} fill="#08090b" />
      {detents.map((d, i) => (
        <g key={d}>
          <line x1={690} y1={1430 + (i / 8) * 190} x2={702} y2={1430 + (i / 8) * 190} stroke={LABEL} strokeWidth={2} />
          <text x={708} y={1435 + (i / 8) * 190} fontSize={13} fill={LABEL} fontFamily={F}>{d}</text>
        </g>
      ))}
      <rect x={648} y={flapY - 14} width={62} height={28} rx={4} fill="#e8ebee" stroke="#555" strokeWidth={2} />
      <rect x={652} y={flapY - 4} width={54} height={8} fill="#b9bec4" />
      <text x={690} y={1424} fontSize={13} fill={LABEL} fontFamily={F} textAnchor="middle" fontWeight={700}>FLAPS</text>
      {/* speed brake */}
      <rect x={375} y={1430} width={12} height={160} rx={6} fill="#08090b" />
      <rect x={358} y={1440 + reverse * 60} width={46} height={24} rx={4} fill="#d8dde2" />
      <text x={381} y={1424} fontSize={12} fill={LABEL} fontFamily={F} textAnchor="middle" fontWeight={700}>SPD BRK</text>
      {/* gear panel */}
      <rect x={860} y={1400} width={200} height={240} rx={10} fill={PANEL} stroke="#262b31" strokeWidth={3} />
      <text x={960} y={1424} fontSize={13} fill={LABEL} fontFamily={F} textAnchor="middle" fontWeight={700}>LANDING GEAR</text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={i === 1 ? 932 : i === 0 ? 878 : 986} y={i === 1 ? 1436 : 1470} width={56} height={26} rx={3} fill={gearLights[i] ? "#38ff6a" : "#183020"} />
          <text x={(i === 1 ? 932 : i === 0 ? 878 : 986) + 28} y={(i === 1 ? 1436 : 1470) + 18} fontSize={11} fill={gearLights[i] ? "#052a10" : "#3b6046"} fontFamily={F} textAnchor="middle" fontWeight={800}>
            {["LEFT", "NOSE", "RIGHT"][i]}
          </text>
        </g>
      ))}
      <rect x={952} y={1512} width={16} height={110} rx={8} fill="#08090b" />
      <text x={990} y={1525} fontSize={12} fill={LABEL} fontFamily={F}>UP</text>
      <text x={990} y={1620} fontSize={12} fill={LABEL} fontFamily={F}>DN</text>
      <line x1={960} y1={1520} x2={960} y2={1520 + gear * 90} stroke="#c9cdd2" strokeWidth={8} />
      {/* wheel-shaped handle */}
      <circle cx={960} cy={1525 + gear * 90} r={22} fill="#e9ecef" stroke="#555" strokeWidth={3} />
      <circle cx={960} cy={1525 + gear * 90} r={9} fill="#9aa1a8" />
    </g>
  );
};

/** Captain's yoke. pitch: -1 (pushed forward) .. 1 (pulled back), roll in degrees. */
export const Yoke: React.FC<{ pitch: number; roll: number; ptt: boolean; disc: boolean }> = ({ pitch, roll, ptt, disc }) => {
  const y = 1730 + pitch * -50;
  const s = 1.25 + pitch * 0.08;
  return (
    <g transform={`translate(240 ${y}) scale(${s}) rotate(${roll})`}>
      {/* column */}
      <rect x={-26} y={20} width={52} height={420} fill="url(#column)" />
      <rect x={-34} y={-30} width={68} height={70} rx={14} fill="#1b1d21" stroke="#3d434b" strokeWidth={3} />
      {/* ram's-horn wheel */}
      <path
        d="M-200 -110 Q-215 10 -150 40 L150 40 Q215 10 200 -110 L168 -118 Q172 -10 130 6 L-130 6 Q-172 -10 -168 -118 Z"
        fill="url(#yokeGrad)"
        stroke="#4a5059"
        strokeWidth={3}
      />
      {/* grips */}
      <rect x={-214} y={-170} width={48} height={92} rx={22} fill="#24272c" stroke="#4a5059" strokeWidth={3} />
      <rect x={166} y={-170} width={48} height={92} rx={22} fill="#24272c" stroke="#4a5059" strokeWidth={3} />
      {/* checklist clip / hub plate */}
      <rect x={-70} y={-12} width={140} height={40} rx={8} fill="#2e3238" />
      <rect x={-56} y={-4} width={112} height={24} rx={4} fill="#d9d4c3" opacity={0.85} />
      {/* buttons: AP disconnect (red), trim rockers, push-to-talk */}
      <circle cx={-190} cy={-150} r={10} fill={disc ? "#ff3b30" : "#9a1f1a"} stroke="#000" strokeWidth={2} />
      <rect x={-205} y={-128} width={10} height={20} rx={3} fill="#c9cdd2" />
      <rect x={-189} y={-128} width={10} height={20} rx={3} fill="#c9cdd2" />
      <rect x={-216} y={-100} width={14} height={22} rx={4} fill={ptt ? "#ffd60a" : "#555b63"} />
      <circle cx={190} cy={-150} r={10} fill="#9a1f1a" stroke="#000" strokeWidth={2} />
    </g>
  );
};

/** Alikhan's right hand. pose "point" presses buttons, "grip" holds a lever. */
export const Hand: React.FC<{ x: number; y: number; pose: "point" | "grip"; press: number; angle?: number }> = ({ x, y, pose, press, angle = -28 }) => (
  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${1 - press * 0.05}) translate(-50 102)`}>
    {/* sleeve: white shirt with dark jacket cuff */}
    <path d="M10 120 L120 120 L190 720 L-40 720 Z" fill="#20252e" />
    <path d="M14 116 L118 116 L124 160 L8 160 Z" fill="#f2f3f5" />
    {/* wrist + palm */}
    <path d="M20 118 Q14 70 22 40 Q30 10 62 8 Q100 8 110 40 Q120 80 112 118 Z" fill="#c98e68" />
    <path d="M30 110 Q26 70 34 44 Q60 30 98 48 Q104 80 100 112 Z" fill="#b97d58" opacity={0.35} />
    {pose === "point" ? (
      <g>
        {/* curled fingers */}
        <path d="M62 30 Q66 6 84 8 Q100 12 98 34 Z" fill="#c38963" stroke="#9c6a49" strokeWidth={2} />
        <path d="M80 44 Q90 22 106 28 Q118 36 108 56 Z" fill="#c38963" stroke="#9c6a49" strokeWidth={2} />
        <path d="M90 66 Q104 50 116 58 Q124 70 110 82 Z" fill="#c38963" stroke="#9c6a49" strokeWidth={2} />
        {/* index finger extended */}
        <path d="M34 34 Q30 -40 36 -86 Q40 -104 54 -102 Q66 -98 64 -80 L62 30 Z" fill="#cf946d" stroke="#9c6a49" strokeWidth={2} />
        <path d="M40 -92 Q48 -100 58 -92 L58 -84 Q48 -90 40 -84 Z" fill="#e7c2a6" />
        <line x1={38} y1={-40} x2={60} y2={-40} stroke="#a6714f" strokeWidth={1.5} />
        {/* thumb */}
        <path d="M24 70 Q-6 50 -8 22 Q-6 8 8 12 Q22 30 34 52 Z" fill="#c38963" stroke="#9c6a49" strokeWidth={2} />
      </g>
    ) : (
      <g>
        {/* fingers wrapped over a handle */}
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${24 + i * 22} 20 Q${22 + i * 22} -26 ${36 + i * 22} -34 Q${50 + i * 22} -34 ${48 + i * 22} -6 L${46 + i * 22} 22 Z`} fill="#c98e68" stroke="#9c6a49" strokeWidth={2} />
        ))}
        <path d="M18 70 Q-14 40 -10 6 Q-2 -6 10 4 Q20 30 34 52 Z" fill="#c38963" stroke="#9c6a49" strokeWidth={2} />
      </g>
    )}
  </g>
);
