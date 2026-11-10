import React from "react";
import "../fonts";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AIM_Z } from "./Airport";
import { CameraState, World } from "./World";
import { CockpitOverlay, CockpitState, SPOTS } from "./cockpit/CockpitOverlay";

const Caption: React.FC<{ words: string[]; key_: number; radio?: boolean }> = ({ words, key_, radio }) => (
  <div style={{ position: "absolute", left: 80, right: 80, top: 1600, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
    {radio && (
      <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 34, letterSpacing: 4, color: "#04210c", background: "#7CFFA0", padding: "6px 20px", borderRadius: 10 }}>
        ДИСПЕТЧЕР
      </div>
    )}
    <div style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: 82, lineHeight: 1.1, textAlign: "center", textTransform: "uppercase", color: radio ? "#7CFFA0" : "#fff", textShadow: "0 0 18px rgba(0,0,0,0.9), 0 6px 0 rgba(0,0,0,0.85)", WebkitTextStroke: "3px rgba(0,0,0,0.85)", paintOrder: "stroke fill" }}>
      {words.map((w, i) => (
        <span key={i} style={{ marginRight: "0.25em", color: i === key_ ? "#FFD60A" : undefined }}>{w}</span>
      ))}
    </div>
  </div>
);

/** Approval stills: cockpit in cruise (hand on A/P) and short final with the runway. */
export const SimTest: React.FC<{ mode: "cruise" | "final" }> = ({ mode }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const final = mode === "final";
  const d = 470;
  const cam: CameraState = final
    ? { pos: [-1.2, d * Math.tan((3 * Math.PI) / 180) + 4, AIM_Z + d], yaw: 0.4, pitch: -1.5, roll: 1.2, hfov: 50, centerY: 470, centerX: 290 }
    : { pos: [0, 10000, 30000], yaw: 8, pitch: 1.5, roll: 0, hfov: 60, centerY: 560, centerX: 290 };

  const s: CockpitState = {
    flight: final
      ? { pitch: 2.5, roll: 1.2, ias: 141, selSpd: 140, altFt: 100, selAlt: 1000, vs: -700, hdg: 240, radioAltFt: 100, fma: ["ARM", "LOC", "G/S"], apEngaged: false, n1: [48.2, 48.6], flaps: 30, gearDown: true, distNm: 0.5 }
      : { pitch: 2, roll: 0, ias: 282, selSpd: 282, altFt: 33000, selAlt: 33000, vs: 0, hdg: 240, fma: ["MCP SPD", "LNAV", "VNAV PTH"], apEngaged: true, n1: [86.4, 86.1], flaps: 0, gearDown: false, distNm: 112 },
    mcp: final
      ? { spd: 140, hdg: 240, alt: 1000, vs: 0, cmdA: false, knobAlt: 0, caution: false }
      : { spd: 282, hdg: 240, alt: 33000, vs: 0, cmdA: true, knobAlt: 0, caution: true },
    thrust: final ? 0.25 : 0.8,
    reverse: 0,
    flapLever: final ? 30 : 0,
    gear: final ? 1 : 0,
    gearLights: final ? [true, true, true] : [false, false, false],
    yokePitch: final ? 0.4 : 0,
    yokeRoll: final ? -4 : 0,
    ptt: false,
    overheadLights: 0.35,
    highlight: final ? SPOTS.thrust : SPOTS.apButton,
    highlightPulse: 0.8,
    hand: final ? { x: 520, y: 1585, pose: "grip", press: 0, angle: -8 } : { x: 923, y: 950, pose: "point", press: 0.6, angle: -24 },
    shake: [0, 0],
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas width={width} height={height} gl={{ logarithmicDepthBuffer: true, antialias: true, toneMappingExposure: 1.35 }}>
        <World t={t} cam={cam} clouds={final ? undefined : { y: 7000, opacity: 1 }} fogDensity={final ? 0.00012 : 0.000035} />
      </ThreeCanvas>
      <CockpitOverlay s={s} />
      {final ? (
        <Caption words={["Газ", "на", "ноль."]} key_={2} radio />
      ) : (
        <Caption words={["надпись", "«Эй-Пи»?"]} key_={1} />
      )}
    </AbsoluteFill>
  );
};
