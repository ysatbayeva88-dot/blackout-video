import React from "react";

/**
 * View from the cockpit door: the captain has slumped onto the yoke, master caution
 * flashing, Alikhan runs in. Windshield areas are left transparent for the 3D world.
 */
export const DOOR_WINDOWS =
  "M262 520 L531 512 L531 790 L222 800 Z M549 512 L818 520 L858 800 L549 790 Z M96 560 L232 530 L206 790 L70 760 Z M848 530 L984 560 L1010 760 L874 790 Z";

export const Doorway: React.FC<{ k: number; t: number }> = ({ k, t }) => {
  const flash = 0.5 + 0.5 * Math.sin(t * 12);
  // Alikhan: from the right foreground towards the captain
  const ease = 1 - Math.pow(1 - Math.min(1, k / 0.9), 2.2);
  const ax = 900 - 210 * ease;
  const ay = 1560 - 380 * ease + Math.sin(k * Math.PI * 9) * 14 * (1 - ease * 0.6);
  const as = 2.1 - 1.05 * ease;
  const stride = Math.sin(k * Math.PI * 9);
  const reach = Math.max(0, (k - 0.7) / 0.3);
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="dwRed" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#ff3b1f" stopOpacity={0.35 * flash} />
          <stop offset="1" stopColor="#ff3b1f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="dwShirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3f4f6" />
          <stop offset="1" stopColor="#b9bec6" />
        </linearGradient>
        <linearGradient id="dwSeat" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#15171b" />
          <stop offset="0.5" stopColor="#2a2d33" />
          <stop offset="1" stopColor="#121417" />
        </linearGradient>
        <filter id="dwBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={`${6 * (1 - ease) + 1} 1`} />
        </filter>
      </defs>
      {/* interior shell with window cut-outs */}
      <path fillRule="evenodd" fill="#0c0e12" d={`M0 0 H1080 V1920 H0 Z ${DOOR_WINDOWS}`} />
      {/* overhead panel lights */}
      {Array.from({ length: 40 }).map((_, i) => (
        <rect key={i} x={180 + (i % 20) * 37} y={300 + Math.floor(i / 20) * 60 + (i % 3) * 6} width={14} height={6} rx={2} fill={i % 7 === 0 ? "#ffb000" : i % 5 === 0 ? "#4da3ff" : "#2a2f37"} opacity={0.9} />
      ))}
      <path d="M0 230 Q540 140 1080 230 L1080 470 Q540 420 0 470 Z" fill="#1a1d23" opacity={0.85} />
      {/* glareshield + panel with glowing screens */}
      <path d="M160 790 Q540 770 920 790 L960 880 L120 880 Z" fill="#14171c" />
      {[200, 330, 460, 590, 720, 850].map((x, i) => (
        <g key={x}>
          <rect x={x - 10} y={830} width={88} height={70} rx={4} fill="#05070a" />
          <rect x={x - 4} y={836} width={76} height={58} fill={i === 0 || i === 4 ? "#1d6fd1" : "#0b1a12"} opacity={0.9} />
          {(i === 0 || i === 4) && <rect x={x - 4} y={866} width={76} height={28} fill="#7a4a1f" opacity={0.9} />}
          {i % 2 === 1 && <path d={`M${x + 4} 890 Q${x + 34} 845 ${x + 64} 890`} fill="none" stroke="#ff4dff" strokeWidth={2} />}
        </g>
      ))}
      {/* master caution lights */}
      {[180, 880].map((x) => (
        <rect key={x} x={x} y={796} width={36} height={20} rx={3} fill="#ffb000" opacity={0.35 + 0.65 * flash} />
      ))}
      <rect x={0} y={0} width={1080} height={1920} fill="url(#dwRed)" />
      {/* pedestal */}
      <path d="M430 900 L650 900 L700 1250 L380 1250 Z" fill="#1d2127" />
      <rect x={500} y={960} width={18} height={60} rx={6} fill="#5c646e" />
      <rect x={560} y={960} width={18} height={60} rx={6} fill="#5c646e" />
      {/* captain slumped over the yoke */}
      <g transform="translate(-55 -60) scale(1.2)">
        <rect x={300} y={880} width={60} height={14} rx={6} fill="#25282d" />
        <path d="M212 1010 Q230 935 320 925 Q410 930 440 1000 L448 1100 L200 1100 Z" fill="url(#dwShirt)" />
        <path d="M228 960 L300 948 L300 962 L232 976 Z" fill="#d7b24a" />
        <path d="M352 948 L425 960 L420 976 L352 962 Z" fill="#d7b24a" />
        <path d="M250 930 Q250 960 280 962 L380 962 Q410 960 410 930" fill="none" stroke="#2c3036" strokeWidth={12} strokeLinecap="round" />
        <ellipse cx={330} cy={906} rx={46} ry={40} fill="#2a1c14" transform="rotate(-18 330 906)" />
        <path d="M296 892 Q330 870 368 892" fill="none" stroke="#3a2a20" strokeWidth={6} />
        {/* arm hanging down beside the seat */}
        <path d="M206 1000 Q182 1100 176 1230 L206 1236 Q214 1120 238 1020 Z" fill="url(#dwShirt)" />
        <rect x={172} y={1226} width={38} height={14} fill="#d7b24a" />
        <ellipse cx={192} cy={1262} rx={20} ry={26} fill="#c98e68" />
        {/* fallen cap on the floor */}
        <ellipse cx={130} cy={1600} rx={70} ry={22} fill="#12161d" />
        <ellipse cx={130} cy={1588} rx={50} ry={26} fill="#1b2230" />
        <rect x={100} y={1580} width={60} height={8} fill="#d7b24a" />
      </g>
      {/* seat backs */}
      <path d="M110 1330 Q110 1260 190 1255 L430 1255 Q500 1260 500 1330 L520 1920 L80 1920 Z" fill="url(#dwSeat)" />
      <path d="M160 1280 Q160 1245 210 1243 L400 1243 Q450 1245 450 1280 L455 1330 L155 1330 Z" fill="#1e2126" />
      <path d="M600 1000 Q600 930 680 925 L920 925 Q990 930 990 1000 L1010 1920 L580 1920 Z" fill="url(#dwSeat)" />
      <path d="M650 950 Q650 905 700 902 L890 902 Q940 905 940 950 L945 1010 L645 1010 Z" fill="#1e2126" />
      {/* Alikhan running in (seen from behind) */}
      <g transform={`translate(${ax} ${ay}) scale(${as})`} filter="url(#dwBlur)">
        {/* legs */}
        <path d={`M-40 150 L-10 150 L${-14 + stride * 18} 330 L${-46 + stride * 18} 330 Z`} fill="#15181e" />
        <path d={`M10 150 L40 150 L${46 - stride * 18} 330 L${14 - stride * 18} 330 Z`} fill="#1a1d24" />
        {/* torso: dark jacket */}
        <path d="M-78 10 Q-80 -40 -40 -52 L40 -52 Q80 -40 78 10 L66 160 L-66 160 Z" fill="#232a36" />
        <path d="M-20 -52 L20 -52 L14 -36 L-14 -36 Z" fill="#eef0f3" />
        {/* arms swinging */}
        <path d={`M-74 -20 Q-104 40 ${-96 - stride * 10} ${110 - stride * 26} L${-74 - stride * 10} ${116 - stride * 26} Q-80 50 -52 -6 Z`} fill="#1d232e" />
        <path
          d={`M74 -20 Q${104 - reach * 30} ${40 - reach * 70} ${96 + stride * 10 - reach * 120} ${110 + stride * 26 - reach * 170} L${74 + stride * 10 - reach * 120} ${116 + stride * 26 - reach * 170} Q80 50 52 -6 Z`}
          fill="#1d232e"
        />
        {/* head: short dark hair, neck */}
        <rect x={-14} y={-74} width={28} height={26} fill="#c98e68" />
        <ellipse cx={0} cy={-102} rx={34} ry={38} fill="#1b130e" />
        <ellipse cx={-30} cy={-96} rx={6} ry={11} fill="#c98e68" />
        <ellipse cx={30} cy={-96} rx={6} ry={11} fill="#c98e68" />
      </g>
      {/* door frame edges in the foreground */}
      <rect x={0} y={0} width={46} height={1920} fill="#07080a" />
      <rect x={1034} y={0} width={46} height={1920} fill="#07080a" />
    </svg>
  );
};
