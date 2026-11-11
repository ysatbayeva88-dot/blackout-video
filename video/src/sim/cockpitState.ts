import { CockpitState, Highlight, SPOTS } from "./cockpit/CockpitOverlay";
import { YOKE_LOCAL, thrustHandleY, THRUST_X, yokePoint } from "./cockpit/Panels";
import { Pose, TOUCH, config, e, lin, s, scene, tw, w } from "./flight";

type HandKey = { t: number; at: HandTarget | null; pose?: "point" | "grip"; angle?: number };
type HandTarget = { x: number; y: number } | "gripR" | "ptt" | "apDisc" | "thrust" | "gearLever";

/** Where Alikhan's hand goes, keyed to the voiceover. */
const HAND: HandKey[] = [
  { t: 0.0, at: null },
  { t: 0.9, at: "gripR", pose: "grip", angle: -18 },
  { t: s(5) - 0.15, at: { x: 82, y: 790 }, pose: "point", angle: -48 },
  { t: s(5) + 0.95, at: { x: 82, y: 800 }, pose: "grip", angle: -48 },
  { t: s(6) - 0.05, at: "ptt", pose: "point", angle: -42 },
  { t: s(9), at: "gripR", pose: "grip", angle: -18 },
  { t: w(10, 2) - 0.2, at: { x: 935, y: 1010 }, pose: "point", angle: -20 },
  { t: s(11) + 0.2, at: { x: 930, y: 985 }, pose: "point", angle: -20 },
  { t: e(11) - 0.15, at: { x: 990, y: 1180 }, pose: "point", angle: -20 },
  { t: s(12) - 0.1, at: { x: 556, y: 985 }, pose: "grip", angle: -12 },
  { t: scene("greens").start, at: "gearLever", pose: "grip", angle: -10 },
  { t: scene("gust").start, at: "gripR", pose: "grip", angle: -18 },
  { t: w(22, 0) - 0.35, at: "apDisc", pose: "point", angle: -40 },
  { t: w(22, 2) - 0.1, at: "gripR", pose: "grip", angle: -18 },
  { t: w(22, 5) - 0.3, at: "thrust", pose: "grip", angle: -8 },
  { t: s(29), at: null },
];

/** Camera punch-ins on the cockpit (overlay coordinates). */
const FOCUS: { t: number; x: number; y: number; z: number }[] = [
  { t: 0, x: 540, y: 1000, z: 1.0 },
  { t: s(1) - 0.1, x: 420, y: 1350, z: 1.15 },
  { t: scene("mayday").start, x: 420, y: 1350, z: 1.1 },
  { t: s(5) - 0.1, x: 170, y: 860, z: 1.45 },
  { t: s(6) - 0.1, x: 260, y: 1450, z: 1.3 },
  { t: s(8), x: 540, y: 1000, z: 1.05 },
  { t: scene("autopilot").start, x: 760, y: 960, z: 1.35 },
  { t: scene("altknob").start, x: 555, y: 960, z: 1.7 },
  { t: scene("greens").start, x: 930, y: 1500, z: 1.5 },
  { t: scene("gust").start, x: 540, y: 980, z: 1.0 },
  { t: w(22, 5) - 0.2, x: 560, y: 1250, z: 1.12 },
  { t: s(23), x: 540, y: 1000, z: 1.0 },
];

const keyAt = <T extends { t: number }>(arr: T[], t: number) => {
  let i = 0;
  while (i + 1 < arr.length && t >= arr[i + 1].t) i++;
  return i;
};

export const cockpitFocus = (t: number) => {
  const i = keyAt(FOCUS, t);
  const a = FOCUS[Math.max(0, i - 1)], b = FOCUS[i];
  const k = tw(t, [b.t, b.t + 0.6], [0, 1]);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
};

export const cockpitState = (t: number, p: Pose): CockpitState => {
  const cfg = config(t);
  const apOn = t < w(22, 0) + 0.15;
  const gustCaution = t > s(19) && t < e(20);
  const caution = (t < s(10) || gustCaution) && Math.sin(t * 12) > -0.2;
  const approach = t >= scene("airport").start;
  const thrust = t < scene("dive").start ? 0.8 : !approach ? 0.15 : t < w(22, 5) ? 0.5 : tw(t, [w(22, 5), w(22, 5) + 0.5], [0.5, 0]);
  const selAlt = t < s(12) + 0.1 ? 33000 : Math.round(tw(t, [s(12) + 0.1, s(12) + 1.9], [33000, 1000]) / 100) * 100;
  const yokePitch = t > TOUCH ? tw(t, [TOUCH, TOUCH + 1.5], [0.8, 0]) : tw(t, [s(24), TOUCH], [0, 0.8]) + (p.pitch < -4 ? -0.5 : 0);
  // the yoke follows the correction in the gust: jerk at "Руки сами дёргают", centred on "Плавно"
  const yokeRoll = tw(t, [s(19), e(19), s(20), s(20) + 0.25, s(21), e(21)], [0, 14, 14, -28, -20, 0]) + p.roll * -0.3;
  const reverse = cfg.reverse;
  const flightN1 = t < scene("dive").start ? 86 : !approach ? 38 : t < w(22, 5) ? 58 : t < TOUCH + 0.6 ? 26 : 26 + reverse * 52;

  const resolve = (h: HandTarget) => {
    if (typeof h === "object") return h;
    if (h === "gripR") return yokePoint(YOKE_LOCAL.gripR[0], YOKE_LOCAL.gripR[1] + 10, yokePitch, yokeRoll);
    if (h === "ptt") return yokePoint(YOKE_LOCAL.ptt[0], YOKE_LOCAL.ptt[1], yokePitch, yokeRoll);
    if (h === "apDisc") return yokePoint(YOKE_LOCAL.apDisc[0], YOKE_LOCAL.apDisc[1], yokePitch, yokeRoll);
    if (h === "thrust") return { x: (THRUST_X[0] + THRUST_X[1]) / 2, y: thrustHandleY(thrust) + 6 };
    return { x: 960, y: 1525 + cfg.gear * 90 + 4 };
  };

  // hand: ease between consecutive targets, slide in/out from the bottom-right
  const OFF = { x: 1200, y: 2150 };
  const i = keyAt(HAND, t);
  const cur = HAND[i], prev = HAND[Math.max(0, i - 1)];
  const k = tw(t, [cur.t, cur.t + 0.45], [0, 1]);
  const pa = prev.at ? resolve(prev.at) : OFF;
  const pb = cur.at ? resolve(cur.at) : OFF;
  const pressPTT = t > w(7, 0) && t < e(7) ? 1 : 0;
  const pressDisc = t > w(22, 0) && t < w(22, 0) + 0.35 ? 1 : 0;
  const hand =
    !cur.at && k >= 1
      ? null
      : {
          x: pa.x + (pb.x - pa.x) * k,
          y: pa.y + (pb.y - pa.y) * k + (cur.at === "ptt" ? pressPTT * 6 : 0),
          pose: (cur.pose ?? prev.pose ?? "point") as "point" | "grip",
          press: Math.max(pressPTT, pressDisc),
          angle: (cur.angle ?? -24) + (t > s(12) && t < e(12) ? Math.sin(t * 9) * 6 : 0),
        };

  // highlight
  const yokeSpot = (l: readonly [number, number], r = 26): Highlight => {
    const q = yokePoint(l[0], l[1], yokePitch, yokeRoll);
    return { x: q.x - r, y: q.y - r, w: 2 * r, h: 2 * r, round: true };
  };
  let highlight: Highlight = null;
  if (t < s(1)) highlight = SPOTS.caution;
  else if (t < scene("orbit").start) highlight = yokeSpot(YOKE_LOCAL.gripR, 40);
  else if (t > s(5) && t < e(5)) highlight = SPOTS.headset;
  else if (t > s(6) && t < e(7)) highlight = yokeSpot(YOKE_LOCAL.ptt);
  else if (t > w(10, 2) && t < e(11)) highlight = SPOTS.apButton;
  else if (t > s(12) && t < e(12)) highlight = SPOTS.altKnob;
  else if (t > scene("greens").start && t < scene("greens").end) highlight = SPOTS.gear;
  else if ((t > s(19) && t < e(19)) || (t > s(21) && t < e(21))) highlight = SPOTS.pfd;
  else if (t > s(20) && t < e(20)) highlight = yokeSpot(YOKE_LOCAL.gripR, 40);
  else if (t > w(22, 0) - 0.1 && t < w(22, 2)) highlight = yokeSpot(YOKE_LOCAL.apDisc);
  else if (t > w(22, 2) && t < w(22, 5)) highlight = SPOTS.pfd;
  else if (t > w(22, 5) && t < e(22) + 0.3) highlight = SPOTS.thrust;
  else if (t > s(23) && t < e(25)) highlight = SPOTS.pfd;

  const altFt = Math.max(0, (p.pos.y - 3.5) / 0.3048);
  return {
    flight: {
      pitch: p.pitch,
      roll: p.roll,
      ias: p.ias,
      selSpd: approach ? 140 : 282,
      altFt,
      selAlt,
      vs: p.vs,
      hdg: 240 - p.yaw,
      radioAltM: approach ? p.wheelH : undefined,
      fma: approach ? ["MCP SPD", "LOC", "G/S"] : t > s(12) + 1 ? ["MCP SPD", "LNAV", "LVL CHG"] : ["MCP SPD", "LNAV", "VNAV PTH"],
      apEngaged: apOn,
      n1: [flightN1 + Math.sin(t * 3) * 0.3, flightN1 - 0.4 + Math.sin(t * 2.7) * 0.3],
      flaps: cfg.flaps * 30,
      gearDown: cfg.gear > 0.99,
      distNm: approach ? Math.max(0, (p.pos.z + 325) / 1852) : 112 - t * 0.12,
    },
    mcp: { spd: approach ? 140 : 282, hdg: 240, alt: selAlt, vs: 0, cmdA: apOn, knobAlt: lin(t, [s(12) + 0.1, s(12) + 1.9], [0, -600]), caution },
    thrust,
    reverse,
    flapLever: cfg.flaps * 30,
    gear: cfg.gear,
    gearLights: [0, 1, 2].map((n) => t > s(17) - 0.05 + n * 0.22),
    yokePitch,
    yokeRoll,
    ptt: pressPTT > 0,
    headset: t < s(5) + 1.2,
    overheadLights: 0.35,
    highlight,
    highlightPulse: 0.5 + 0.5 * Math.sin(t * 8),
    hand,
    shake: [0, 0],
  };
};
