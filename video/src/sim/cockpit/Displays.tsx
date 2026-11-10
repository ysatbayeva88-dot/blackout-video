import React from "react";

/** Boeing-style glass cockpit displays drawn in SVG. Each display is 340 x 340 local units. */

const F = "DejaVu Sans, sans-serif";
const MONO = "DejaVu Sans Mono, monospace";
const GREEN = "#3dff6e";
const MAGENTA = "#ff4dff";
const CYAN = "#3de8ff";
const WHITE = "#f2f4f7";
const AMBER = "#ffb000";

export type FlightData = {
  pitch: number; // deg, nose up +
  roll: number; // deg, right wing down +
  ias: number; // kt
  selSpd: number;
  altFt: number;
  selAlt: number; // ft
  vs: number; // ft/min
  hdg: number;
  radioAltFt?: number;
  fma: [string, string, string];
  apEngaged: boolean;
  n1: [number, number]; // %
  flaps: number; // 0..40
  gearDown: boolean;
  distNm: number;
};

const Bezel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <g>
    <rect x={-14} y={-14} width={368} height={368} rx={18} fill="#1b1e23" stroke="#4b525c" strokeWidth={3} />
    <rect x={-6} y={-6} width={352} height={352} rx={8} fill="#000" />
    {children}
    {/* glass reflection */}
    <path d="M0 0 L340 0 L340 70 Q170 120 0 60 Z" fill="#fff" opacity={0.035} />
  </g>
);

const Tape: React.FC<{ x: number; value: number; step: number; label: number; pxPer: number; fmt: (v: number) => string; right?: boolean }> = ({
  x, value, step, label, pxPer, fmt, right,
}) => {
  const ticks = [];
  const start = Math.floor((value - 120 / pxPer) / step) * step;
  for (let v = start; v <= value + 120 / pxPer; v += step) {
    if (v < 0) continue;
    const y = 170 - (v - value) * pxPer;
    const major = Math.round(v / label) * label === Math.round(v);
    ticks.push(
      <g key={v}>
        <line x1={right ? x : x + 50} y1={y} x2={right ? x + 8 : x + 42} y2={y} stroke={WHITE} strokeWidth={2} />
        {major && (
          <text x={right ? x + 12 : x + 38} y={y + 6} fontSize={16} fill={WHITE} fontFamily={F} textAnchor={right ? "start" : "end"}>
            {fmt(v)}
          </text>
        )}
      </g>,
    );
  }
  return (
    <g>
      <defs>
        <clipPath id={`tape${x}`}>
          <rect x={x} y={50} width={58} height={240} />
        </clipPath>
      </defs>
      <rect x={x} y={50} width={58} height={240} fill="#3c4250" />
      <g clipPath={`url(#tape${x})`}>{ticks}</g>
    </g>
  );
};

const ReadoutBox: React.FC<{ x: number; w: number; text: string; right?: boolean }> = ({ x, w, text, right }) => (
  <g>
    <path
      d={
        right
          ? `M${x - 8} 170 L${x} 158 L${x} 150 L${x + w} 150 L${x + w} 190 L${x} 190 L${x} 182 Z`
          : `M${x} 150 L${x + w} 150 L${x + w} 158 L${x + w + 8} 170 L${x + w} 182 L${x + w} 190 L${x} 190 Z`
      }
      fill="#000"
      stroke={WHITE}
      strokeWidth={2}
    />
    <text x={x + w / 2} y={178} fontSize={22} fill={WHITE} fontFamily={MONO} textAnchor="middle" fontWeight={700}>
      {text}
    </text>
  </g>
);

export const PFD: React.FC<{ d: FlightData }> = ({ d }) => {
  const ppd = 6; // px per degree of pitch
  return (
    <Bezel>
      <defs>
        <clipPath id="adi">
          <rect x={72} y={52} width={196} height={236} rx={24} />
        </clipPath>
      </defs>
      {/* attitude */}
      <g clipPath="url(#adi)">
        <g transform={`rotate(${-d.roll} 170 170) translate(0 ${d.pitch * ppd})`}>
          <rect x={-200} y={-500} width={740} height={670} fill="#1f86d6" />
          <rect x={-200} y={170} width={740} height={670} fill="#8a5a2a" />
          <line x1={-200} y1={170} x2={540} y2={170} stroke={WHITE} strokeWidth={2.5} />
          {[-20, -15, -10, -5, -2.5, 2.5, 5, 10, 15, 20].map((p) => {
            const y = 170 - p * ppd;
            const w = Math.abs(p) % 5 === 0 ? 34 : 16;
            return (
              <g key={p}>
                <line x1={170 - w} y1={y} x2={170 + w} y2={y} stroke={WHITE} strokeWidth={2} />
                {Math.abs(p) % 10 === 0 && (
                  <>
                    <text x={170 - w - 18} y={y + 5} fontSize={13} fill={WHITE} fontFamily={F} textAnchor="middle">{Math.abs(p)}</text>
                    <text x={170 + w + 18} y={y + 5} fontSize={13} fill={WHITE} fontFamily={F} textAnchor="middle">{Math.abs(p)}</text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </g>
      {/* roll scale */}
      <g transform={`rotate(${-d.roll} 170 170)`}>
        <path d="M170 64 L162 50 L178 50 Z" fill={WHITE} />
      </g>
      {[-60, -45, -30, -20, -10, 10, 20, 30, 45, 60].map((a) => (
        <line key={a} x1={170} y1={60} x2={170} y2={Math.abs(a) % 30 === 0 ? 46 : 52} stroke={WHITE} strokeWidth={2} transform={`rotate(${a} 170 170)`} />
      ))}
      <path d="M170 60 L163 47 L177 47 Z" fill="none" stroke={WHITE} strokeWidth={2} />
      {/* aircraft symbol + flight director */}
      <line x1={170} y1={110} x2={170} y2={230} stroke={MAGENTA} strokeWidth={3} transform={`translate(${-d.roll * 0.8} 0)`} />
      <line x1={110} y1={170} x2={230} y2={170} stroke={MAGENTA} strokeWidth={3} transform={`translate(0 ${d.pitch * 1.5})`} />
      <path d="M100 166 L145 166 L145 182 L137 182 L137 174 L100 174 Z" fill="#000" stroke={WHITE} strokeWidth={2.5} />
      <path d="M240 166 L195 166 L195 182 L203 182 L203 174 L240 174 Z" fill="#000" stroke={WHITE} strokeWidth={2.5} />
      <rect x={165} y={165} width={10} height={10} fill="#000" stroke={WHITE} strokeWidth={2.5} />
      {/* speed tape (kt) */}
      <Tape x={6} value={d.ias} step={10} label={20} pxPer={2.2} fmt={(v) => String(v)} />
      <text x={34} y={42} fontSize={18} fill={MAGENTA} fontFamily={MONO} textAnchor="middle">{d.selSpd}</text>
      <ReadoutBox x={6} w={50} text={String(Math.round(d.ias))} />
      {/* altitude tape (ft) */}
      <Tape x={276} value={d.altFt} step={100} label={500} pxPer={0.22} fmt={(v) => (v % 1000 === 0 ? String(v / 1000) + "000" : String(v))} right />
      <text x={305} y={42} fontSize={16} fill={MAGENTA} fontFamily={MONO} textAnchor="middle">{d.selAlt}</text>
      <ReadoutBox x={282} w={58} text={String(Math.round(d.altFt / 10) * 10)} right />
      <rect x={276} y={294} width={64} height={22} fill="#000" stroke={CYAN} strokeWidth={1.5} />
      <text x={308} y={311} fontSize={15} fill={CYAN} fontFamily={MONO} textAnchor="middle">{Math.round(d.altFt * 0.3048)} M</text>
      {/* FMA */}
      <rect x={60} y={0} width={220} height={24} fill="#000" />
      {d.fma.map((m, i) => (
        <text key={i} x={92 + i * 78} y={18} fontSize={13} fill={GREEN} fontFamily={F} textAnchor="middle">{m}</text>
      ))}
      <text x={170} y={42} fontSize={17} fill={d.apEngaged ? GREEN : AMBER} fontFamily={F} textAnchor="middle" fontWeight={700}>
        {d.apEngaged ? "CMD" : "AP OFF"}
      </text>
      {/* radio altitude */}
      {d.radioAltFt !== undefined && d.radioAltFt < 2500 && (
        <text x={170} y={276} fontSize={24} fill={d.radioAltFt < 200 ? AMBER : WHITE} fontFamily={MONO} textAnchor="middle" fontWeight={700}>
          {Math.max(0, Math.round(d.radioAltFt))}
        </text>
      )}
      {/* heading */}
      <rect x={110} y={300} width={120} height={36} fill="#3c4250" rx={6} />
      {[-20, -10, 0, 10, 20].map((o) => {
        const h = (Math.round(d.hdg / 10) * 10 + o + 360) % 360;
        const x = 170 + (h - d.hdg) * 2.4;
        return x > 112 && x < 228 ? (
          <text key={o} x={x} y={325} fontSize={14} fill={WHITE} fontFamily={F} textAnchor="middle">{String(h / 10).padStart(2, "0")}</text>
        ) : null;
      })}
      <path d="M170 302 L164 296 L176 296 Z" fill={WHITE} />
    </Bezel>
  );
};

export const ND: React.FC<{ d: FlightData }> = ({ d }) => {
  const cx = 170, cy = 300, R = 240;
  const rel = (brg: number) => ((brg - d.hdg + 540) % 360) - 180;
  const pt = (brg: number, nm: number, range = 20) => {
    const a = (rel(brg) * Math.PI) / 180;
    const r = (nm / range) * R;
    return [cx + Math.sin(a) * r, cy - Math.cos(a) * r] as const;
  };
  const rwy = pt(240, d.distNm);
  const wps = [
    { n: "LAGIN", p: pt(232, d.distNm + 6) },
    { n: "RW24", p: rwy },
    { n: "TOREX", p: pt(244, d.distNm - 7) },
  ];
  return (
    <Bezel>
      <defs>
        <clipPath id="nd">
          <rect x={0} y={0} width={340} height={340} />
        </clipPath>
      </defs>
      <g clipPath="url(#nd)">
        {/* compass arc */}
        <path d={`M${cx - R * 0.71} ${cy - R * 0.71} A${R} ${R} 0 0 1 ${cx + R * 0.71} ${cy - R * 0.71}`} fill="none" stroke={WHITE} strokeWidth={2} />
        {Array.from({ length: 72 }).map((_, i) => {
          const brg = i * 5;
          const a = rel(brg);
          if (Math.abs(a) > 46) return null;
          const major = brg % 10 === 0;
          return (
            <g key={i} transform={`rotate(${a} ${cx} ${cy})`}>
              <line x1={cx} y1={cy - R} x2={cx} y2={cy - R + (major ? 14 : 7)} stroke={WHITE} strokeWidth={2} />
              {brg % 30 === 0 && (
                <text x={cx} y={cy - R + 32} fontSize={16} fill={WHITE} fontFamily={F} textAnchor="middle">{brg / 10}</text>
              )}
            </g>
          );
        })}
        <path d={`M${cx - R * 0.5} ${cy - R * 0.43} A${R * 0.5} ${R * 0.5} 0 0 1 ${cx + R * 0.5} ${cy - R * 0.43}`} fill="none" stroke={WHITE} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.7} />
        <text x={cx - R * 0.5 - 4} y={cy - R * 0.43 - 6} fontSize={13} fill={WHITE} fontFamily={F}>10</text>
        {/* route */}
        <polyline points={wps.map((w) => w.p.join(",")).join(" ") + ` ${cx},${cy}`} fill="none" stroke={MAGENTA} strokeWidth={3} />
        {wps.map((w) => (
          <g key={w.n}>
            <path d={`M${w.p[0]} ${w.p[1] - 8} L${w.p[0] + 8} ${w.p[1]} L${w.p[0]} ${w.p[1] + 8} L${w.p[0] - 8} ${w.p[1]} Z`} fill="none" stroke={w.n === "RW24" ? MAGENTA : WHITE} strokeWidth={2} />
            <text x={w.p[0] + 12} y={w.p[1] + 5} fontSize={13} fill={w.n === "RW24" ? MAGENTA : WHITE} fontFamily={F}>{w.n}</text>
          </g>
        ))}
        {/* runway symbol */}
        <g transform={`translate(${rwy[0]} ${rwy[1]}) rotate(${rel(240)})`}>
          <rect x={-4} y={-30} width={8} height={30} fill="none" stroke={WHITE} strokeWidth={2} />
          <line x1={0} y1={0} x2={0} y2={140} stroke={WHITE} strokeWidth={1.5} strokeDasharray="10 6" />
        </g>
      </g>
      {/* own aircraft */}
      <path d={`M${cx} ${cy - 16} L${cx - 9} ${cy + 10} L${cx + 9} ${cy + 10} Z`} fill="none" stroke={WHITE} strokeWidth={2.5} />
      {/* header */}
      <rect x={130} y={4} width={80} height={26} fill="#000" stroke={WHITE} strokeWidth={1.5} />
      <text x={170} y={24} fontSize={19} fill={WHITE} fontFamily={MONO} textAnchor="middle">{String(Math.round(d.hdg)).padStart(3, "0")}</text>
      <text x={216} y={22} fontSize={12} fill={GREEN} fontFamily={F}>MAG</text>
      <text x={8} y={20} fontSize={13} fill={WHITE} fontFamily={F}>GS<tspan fontSize={17}> {Math.round(d.ias * 1.02)}</tspan></text>
      <text x={8} y={40} fontSize={13} fill={WHITE} fontFamily={F}>250°/12</text>
      <text x={332} y={20} fontSize={14} fill={MAGENTA} fontFamily={F} textAnchor="end">RW24</text>
      <text x={332} y={40} fontSize={14} fill={WHITE} fontFamily={F} textAnchor="end">{d.distNm.toFixed(1)} NM</text>
      <text x={8} y={332} fontSize={12} fill={CYAN} fontFamily={F}>TFC</text>
      <text x={332} y={332} fontSize={12} fill={GREEN} fontFamily={F} textAnchor="end">ILS 24</text>
    </Bezel>
  );
};

const N1Gauge: React.FC<{ x: number; y: number; v: number; label: string; max?: number; amber?: number }> = ({ x, y, v, label, max = 110, amber }) => {
  const r = 52;
  const a0 = -210, a1 = 30;
  const ang = a0 + (Math.min(v, max) / max) * (a1 - a0);
  const p = (a: number, rr = r) => [x + Math.cos((a * Math.PI) / 180) * rr, y + Math.sin((a * Math.PI) / 180) * rr] as const;
  const [sx, sy] = p(a0), [ex, ey] = p(ang);
  const large = ang - a0 > 180 ? 1 : 0;
  return (
    <g>
      <path d={`M${x} ${y} L${sx} ${sy} A${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`} fill="#5d6470" opacity={0.85} />
      <path d={`M${p(a0)[0]} ${p(a0)[1]} A${r} ${r} 0 1 1 ${p(a1)[0]} ${p(a1)[1]}`} fill="none" stroke={WHITE} strokeWidth={3} />
      {amber && <path d={`M${p(a1 - 8)[0]} ${p(a1 - 8)[1]} A${r} ${r} 0 0 1 ${p(a1)[0]} ${p(a1)[1]}`} fill="none" stroke="#ff2a2a" strokeWidth={5} />}
      <line x1={x} y1={y} x2={ex} y2={ey} stroke={WHITE} strokeWidth={3} />
      <rect x={x - 4} y={y - 40} width={56} height={26} fill="#000" stroke={WHITE} strokeWidth={1.5} />
      <text x={x + 24} y={y - 21} fontSize={17} fill={WHITE} fontFamily={MONO} textAnchor="middle">{v.toFixed(1)}</text>
      <text x={x} y={y + 30} fontSize={12} fill={CYAN} fontFamily={F} textAnchor="middle">{label}</text>
    </g>
  );
};

export const EICAS: React.FC<{ d: FlightData }> = ({ d }) => (
  <Bezel>
    <text x={170} y={30} fontSize={15} fill={CYAN} fontFamily={F} textAnchor="middle">N1</text>
    <N1Gauge x={95} y={95} v={d.n1[0]} label="" amber={1} />
    <N1Gauge x={245} y={95} v={d.n1[1]} label="" amber={1} />
    <text x={170} y={190} fontSize={15} fill={CYAN} fontFamily={F} textAnchor="middle">EGT</text>
    <N1Gauge x={95} y={225} v={380 + d.n1[0] * 4} max={1000} label="" />
    <N1Gauge x={245} y={225} v={380 + d.n1[1] * 4} max={1000} label="" />
    {/* N2 / FF columns */}
    {["N2", "FF"].map((k, i) => (
      <g key={k}>
        <text x={170} y={296 + i * 22} fontSize={13} fill={CYAN} fontFamily={F} textAnchor="middle">{k}</text>
        <text x={95} y={296 + i * 22} fontSize={15} fill={WHITE} fontFamily={MONO} textAnchor="middle">{i ? (0.4 + d.n1[0] * 0.025).toFixed(2) : (60 + d.n1[0] * 0.35).toFixed(1)}</text>
        <text x={245} y={296 + i * 22} fontSize={15} fill={WHITE} fontFamily={MONO} textAnchor="middle">{i ? (0.4 + d.n1[1] * 0.025).toFixed(2) : (60 + d.n1[1] * 0.35).toFixed(1)}</text>
      </g>
    ))}
    {/* flaps indicator */}
    <text x={320} y={190} fontSize={12} fill={CYAN} fontFamily={F} textAnchor="middle">FLAPS</text>
    <rect x={308} y={198} width={24} height={110} fill="none" stroke={WHITE} strokeWidth={1.5} />
    <rect x={310} y={200} width={20} height={(d.flaps / 40) * 106} fill={GREEN} />
    <text x={320} y={326} fontSize={14} fill={GREEN} fontFamily={MONO} textAnchor="middle">{Math.round(d.flaps)}</text>
  </Bezel>
);
