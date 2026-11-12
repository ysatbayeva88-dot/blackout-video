"""Scene + sound + survival-meter cue sheet for the ant video, derived from the voiceover timings.

Single source of truth for timing: writes video/src/ant/cues.json, read by the Remotion
composition (scenes, camera, HUD) and by tools/mix_ant.py (audio).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tm = json.load(open(os.path.join(ROOT, "audio/ant_timings.json")))
SEG = tm["segments"]
s = lambda i: SEG[i]["start"]
e = lambda i: SEG[i]["end"]
w = lambda i, k: SEG[i]["words"][min(k, len(SEG[i]["words"]) - 1)]["start"]
END = round(tm["duration"] + 1.0, 3)

KILL = w(0, 9)  # «убить»
IMPACT = s(8)  # «Удар!»
CLIMAX = s(11)  # «Рвёшься наружу»
FREE = w(12, 2)  # «Свободен»
STOMP = w(19, 2)  # «топот»
LIFT = w(16, 8)  # «несёшь»

# (name, view, start). view: pov (first person) | side (third person) | wide | card (infographic)
scenes = [
    ("hook", "pov", 0.0),
    ("intro", "side", s(1) - 0.1),
    ("edge", "pov", s(2) - 0.1),
    ("land", "side", s(3) - 0.15),
    ("air", "side", s(4) - 0.1),
    ("rain", "wide", s(5) - 0.1),
    ("drop", "side", s(6) - 0.15),
    ("impact", "side", IMPACT - 0.08),
    ("trap", "side", s(9) - 0.1),
    ("tension", "pov", s(10) - 0.1),
    ("struggle", "side", CLIMAX - 0.1),
    ("free", "side", s(12) - 0.15),
    ("film", "side", s(13) - 0.1),
    ("strong", "side", s(14) - 0.1),
    ("cube", "card", s(15) - 0.1),
    ("lift", "side", s(16) - 0.1),
    ("cold", "side", s(17) - 0.15),
    ("world", "wide", s(18) - 0.1),
    ("ant", "pov", s(19) - 0.15),
    ("final", "wide", s(20) - 0.1),
    ("outro", "wide", s(21) - 0.1),
]
scene_list = []
for i, (name, view, start) in enumerate(scenes):
    end = scenes[i + 1][2] if i + 1 < len(scenes) else END
    scene_list.append({"name": name, "view": view, "start": round(start, 3), "end": round(end, 3)})
S = {sc["name"]: sc for sc in scene_list}

# survival meter keyframes: [time, percent]; the HUD eases between them
meter = [
    [0.4, 50], [KILL, 50], [KILL + 0.4, 20],
    [w(3, 2), 20], [w(3, 2) + 0.5, 60],  # «Ни царапины»
    [IMPACT, 60], [IMPACT + 0.3, 25],
    [s(9) + 0.4, 25], [s(9) + 1.0, 15],
    [s(10) + 1.0, 15], [s(10) + 1.6, 8],
    [CLIMAX + 0.8, 8], [CLIMAX + 1.4, 3],
    [FREE, 3], [FREE + 0.4, 15],
    [s(13) + 1.0, 15], [s(13) + 1.5, 10],
    [s(14) + 0.3, 10], [s(14) + 0.8, 20],
    [LIFT, 20], [LIFT + 0.5, 35],
    [s(17) + 0.8, 35], [s(17) + 1.6, 12],
    [STOMP, 12], [STOMP + 0.3, 6],
    [S["final"]["start"] - 0.4, 6], [S["final"]["start"] + 0.2, 15],
]
meter = [[round(t, 3), v] for t, v in meter]

# sound effects: file, start (s), gain (dB, before ducking), duck under voice (dB), optional fade/len
# synth: True -> video/public/<file>.mp3 (made by tools/sfx_ant.py / sfx_music.py)
sfx = [
    {"file": "ant_boom", "start": 0.0, "gain": -6, "duck": 0, "synth": True},
    {"file": "ant_fall_air", "start": w(2, 1), "gain": -8, "duck": -4, "synth": True},
    {"file": "ant_tap", "start": w(3, 2) - 0.15, "gain": -8, "duck": -2, "synth": True},
    {"file": "ant_drop_far", "start": s(5) + 0.2, "gain": -10, "duck": -4, "synth": True},
    {"file": "ant_drop_far", "start": s(5) + 0.9, "gain": -12, "duck": -4, "synth": True},
    {"file": "ant_drop_far", "start": S["drop"]["start"] + 0.3, "gain": -13, "duck": -4, "synth": True},
    {"file": "ant_riser", "start": IMPACT - 3.0, "gain": -10, "duck": -4, "synth": True},
    {"file": "ant_splash_big", "start": IMPACT - 0.05, "gain": -3, "duck": 0, "synth": True},
    {"file": "ant_underwater", "start": s(9) - 0.1, "gain": -9, "duck": -5, "len": FREE - s(9) + 0.1, "fade": 0.3, "synth": True},
    {"file": "ant_pop", "start": FREE - 0.1, "gain": -4, "duck": 0, "synth": True},
    {"file": "ant_drips", "start": s(13), "gain": -12, "duck": -5, "synth": True},
    {"file": "ant_thump", "start": LIFT - 0.4, "gain": -6, "duck": -2, "synth": True},
    {"file": "ant_crumb", "start": w(18, 3), "gain": -10, "duck": -4, "synth": True},
    {"file": "ant_click", "start": STOMP + 1.4, "gain": -12, "duck": -4, "synth": True},
]
# giant ant footsteps: a heavy stomp every ~0.37 s (each tripod step) while it walks past
t = STOMP - 0.05
while t < S["final"]["start"] - 0.1:
    sfx.append({"file": "ant_stomp", "start": t, "gain": -5 if t < STOMP + 0.5 else -8, "duck": -3, "synth": True})
    t += 0.37
for name in ("cube",):
    for k in range(3):
        sfx.append({"file": "ant_tick", "start": S[name]["start"] + 0.5 + k * 0.9, "gain": -12, "duck": -3, "synth": True})
# whoosh on every cut (not into the impact / free moments, which have their own hits)
for sc in scene_list[1:]:
    if sc["name"] in ("impact", "free", "struggle"):
        continue
    sfx.append({"file": "whoosh", "start": round(sc["start"] - 0.12, 3), "gain": -14, "duck": -4, "synth": True})

cues = {
    "duration": END,
    "draft": bool(tm.get("draft_phrases")),
    "kill": round(KILL, 3),
    "impact": round(IMPACT, 3),
    "climax": round(CLIMAX, 3),
    "free": round(FREE, 3),
    "stomp": round(STOMP, 3),
    "lift": round(LIFT, 3),
    "heartbeat": [round(s(10), 3), round(FREE, 3)],
    "rain": [round(S["rain"]["start"], 3), round(S["trap"]["start"] + 0.5, 3)],
    "cold": [round(S["cold"]["start"], 3), round(S["cold"]["end"], 3)],
    "meter": meter,
    "scenes": scene_list,
    "sfx": [{**x, "start": round(x["start"], 3)} for x in sfx],
}
os.makedirs(os.path.join(ROOT, "video/src/ant"), exist_ok=True)
json.dump(cues, open(os.path.join(ROOT, "video/src/ant/cues.json"), "w"), ensure_ascii=False, indent=1)
for sc in scene_list:
    print(f'{sc["start"]:6.2f}-{sc["end"]:6.2f} {sc["view"]:5s} {sc["name"]}')
