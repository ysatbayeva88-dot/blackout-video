import React from "react";
import { EICAS, FlightData, ND, PFD } from "./Displays";
import { Glareshield, Hand, Headset, McpState, Overhead, Pedestal, WindshieldFrame, Yoke } from "./Panels";

export type Highlight = { x: number; y: number; w: number; h: number; round?: boolean } | null;

export type CockpitState = {
  flight: FlightData;
  mcp: McpState;
  thrust: number; // 0 idle .. 1
  reverse: number; // 0..1
  flapLever: number; // 0..40
  gear: number; // 0 up .. 1 down
  gearLights: boolean[];
  yokePitch: number;
  yokeRoll: number;
  ptt: boolean;
  headset: boolean;
  overheadLights: number;
  highlight: Highlight;
  highlightPulse: number; // 0..1
  hand: { x: number; y: number; pose: "point" | "grip"; press: number; angle?: number } | null;
  shake: [number, number];
};

/** Named hotspots in overlay coordinates (for highlights and hand targets). */
export const SPOTS = {
  apButton: { x: 889, y: 928, w: 68, h: 40 },
  cmdA: { x: 805, y: 898, w: 58, h: 40 },
  altKnob: { x: 531, y: 938, w: 40, h: 40, round: true },
  altWindow: { x: 495, y: 900, w: 112, h: 34 },
  ptt: { x: 20, y: 1520, w: 50, h: 50, round: true },
  apDisc: { x: 40, y: 1470, w: 40, h: 40, round: true },
  thrust: { x: 475, y: 1430, w: 180, h: 260 },
  flaps: { x: 680, y: 1420, w: 100, h: 220 },
  headset: { x: 20, y: 740, w: 100, h: 140 },
  gear: { x: 860, y: 1400, w: 200, h: 240 },
  pfd: { x: 30, y: 1025, w: 330, h: 330 },
  nd: { x: 375, y: 1025, w: 330, h: 330 },
  eicas: { x: 720, y: 1025, w: 330, h: 330 },
  caution: { x: 18, y: 884, w: 62, h: 40 },
} as const;

const Glow: React.FC<{ h: Highlight; pulse: number }> = ({ h, pulse }) =>
  !h ? null : (
    <g filter="url(#hl)" opacity={0.65 + 0.35 * pulse}>
      {h.round ? (
        <circle cx={h.x + h.w / 2} cy={h.y + h.h / 2} r={Math.max(h.w, h.h) / 2 + 12} fill="none" stroke="#FFD60A" strokeWidth={7} />
      ) : (
        <rect x={h.x - 10} y={h.y - 10} width={h.w + 20} height={h.h + 20} rx={12} fill="none" stroke="#FFD60A" strokeWidth={7} />
      )}
    </g>
  );

export const CockpitOverlay: React.FC<{ s: CockpitState }> = ({ s }) => (
  <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    <defs>
      <linearGradient id="overheadShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.15" />
        <stop offset="1" stopColor="#000" stopOpacity="0.45" />
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#9fc4ff" stopOpacity="0.08" />
        <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.0" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.05" />
        <stop offset="0.56" stopColor="#ffffff" stopOpacity="0.0" />
      </linearGradient>
      <radialGradient id="knobGrad" cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#5a616b" />
        <stop offset="1" stopColor="#1a1d21" />
      </radialGradient>
      <linearGradient id="pedestal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3f4750" />
        <stop offset="1" stopColor="#1e2227" />
      </linearGradient>
      <linearGradient id="column" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#15171a" />
        <stop offset="0.5" stopColor="#3a3f46" />
        <stop offset="1" stopColor="#15171a" />
      </linearGradient>
      <linearGradient id="yokeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a5058" />
        <stop offset="1" stopColor="#1d2024" />
      </linearGradient>
      <linearGradient id="mainPanel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4d5661" />
        <stop offset="1" stopColor="#363d46" />
      </linearGradient>
      <filter id="hl" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="handShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="10" dy="18" stdDeviation="10" floodOpacity="0.55" />
      </filter>
    </defs>
    <g transform={`translate(${s.shake[0]} ${s.shake[1]})`}>
      <Overhead lights={s.overheadLights} />
      <WindshieldFrame />
      <Glareshield s={s.mcp} />
      {s.headset && <Headset />}
      {/* main instrument panel */}
      <rect x={0} y={995} width={1080} height={395} fill="url(#mainPanel)" />
      <g transform="translate(30 1025) scale(0.97)"><PFD d={s.flight} /></g>
      <g transform="translate(375 1025) scale(0.97)"><ND d={s.flight} /></g>
      <g transform="translate(720 1025) scale(0.97)"><EICAS d={s.flight} /></g>
      <Pedestal thrust={s.thrust} flaps={s.flapLever} gear={s.gear} gearLights={s.gearLights} reverse={s.reverse} />
      <Yoke pitch={s.yokePitch} roll={s.yokeRoll} ptt={s.ptt} disc={false} />
      <Glow h={s.highlight} pulse={s.highlightPulse} />
      {s.hand && (
        <g filter="url(#handShadow)">
          <Hand {...s.hand} />
        </g>
      )}
      {/* cabin vignette */}
      <rect x={0} y={0} width={1080} height={1920} fill="url(#vig)" pointerEvents="none" />
    </g>
    <defs>
      <radialGradient id="vig" cx="0.5" cy="0.45" r="0.8">
        <stop offset="0.65" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.55" />
      </radialGradient>
    </defs>
  </svg>
);
