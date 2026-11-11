"""Scene + sound cue sheet for the blizzard video, derived from the voiceover timings.

Single source of truth for timing: writes video/src/blizzard/cues.json, read by the
Remotion composition (scenes, camera, overlays) and by tools/mix_blizzard.py (audio).
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tm = json.load(open(os.path.join(ROOT, "audio/blizzard_timings.json")))
SEG = tm["segments"]
s = lambda i: SEG[i]["start"]
e = lambda i: SEG[i]["end"]
w = lambda i, k: SEG[i]["words"][k]["start"]
END = round(tm["duration"] + 1.0, 3)
CLIMAX = s(16)  # «Глуши мотор!»
RESCUE = s(25)  # «И вдруг в темноте — фары спасателей»
IMPACT = s(3)  # «Удар»
WALL = w(2, 3)  # «белая стена»

# (name, view, start). view: ext (3D outside) | pov (inside the car) | side (side window) | card (timer)
scenes = [
    ("hook", "ext", 0.0),
    ("breath", "pov", s(1) - 0.1),
    ("road", "ext", s(2) - 0.1),
    ("crash", "ext", s(3) - 0.35),
    ("phone", "pov", w(3, 4) - 0.1),
    ("t1", "card", s(4) - 0.1),
    ("door", "side", s(5) - 0.1),
    ("lost", "ext", s(6) - 0.1),
    ("engine", "pov", s(8) - 0.1),
    ("window", "side", s(9) - 0.1),
    ("t12", "card", s(10) - 0.1),
    ("buried", "ext", s(11) - 0.1),
    ("sleepy", "pov", s(12) - 0.1),
    ("wake", "pov", s(13) - 0.1),
    ("pipe", "ext", s(14) - 0.1),
    ("gas", "pov", s(15) - 0.1),
    ("keyoff", "pov", CLIMAX - 0.05),
    ("dig", "ext", w(16, 2) - 0.1),
    ("relief", "ext", s(17) - 0.1),
    ("d2", "card", s(18) - 0.1),
    ("scarf", "ext", s(19) - 0.1),
    ("snow", "pov", s(20) - 0.1),
    ("bottle", "pov", s(21) - 0.1),
    ("d3", "card", s(22) - 0.1),
    ("gauges", "pov", s(23) - 0.1),
    ("move", "pov", s(24) - 0.1),
    ("rescue", "ext", s(25) - 0.1),
    ("alive", "pov", s(26) - 0.1),
    ("outro", "ext", s(27) - 0.1),
]
scene_list = []
for i, (name, view, start) in enumerate(scenes):
    end = scenes[i + 1][2] if i + 1 < len(scenes) else END
    scene_list.append({"name": name, "view": view, "start": round(start, 3), "end": round(end, 3)})
S = {sc["name"]: sc for sc in scene_list}

# engine on/off intervals (drives the idle loop, dashboard lights, exhaust steam)
engine = [
    [round(s(2) - 0.1, 3), round(IMPACT + 0.4, 3)],  # driving until the crash
    [round(w(8, 0) + 0.9, 3), round(CLIMAX + 0.35, 3)],  # the ten-minute runs; CO scene; killed at the climax
]

# sound effects: file, start (s), gain (dB, before ducking), duck under voice (dB), optional length/fade
sfx = [
    {"file": "car_skid_crash_snow", "start": IMPACT - 0.9, "gain": -4, "duck": -3},
    {"file": "window_crack_open", "start": s(9) + 0.25, "gain": -6, "duck": -4},
    {"file": "car_engine_start", "start": w(8, 0) - 0.3, "gain": -6, "duck": -4},
    {"file": "car_engine_off", "start": CLIMAX + 0.3, "gain": -2, "duck": -2},
    {"file": "snow_digging", "start": w(16, 2), "gain": -4, "duck": -4},
    {"file": "snow_crunch_steps", "start": s(6) + 0.1, "gain": -8, "duck": -5, "fade": 1.2},
    {"file": "fabric_flapping_wind", "start": s(19) - 0.1, "gain": -8, "duck": -5, "fade": 0.6},
    {"file": "rescue_vehicle_approach", "start": RESCUE - 0.6, "gain": -6, "duck": -5, "fade": 1.5},
]
for name in ("t1", "t12", "d2", "d3"):
    sfx.append({"file": "clock_tick", "start": S[name]["start"], "gain": -6, "duck": -2})
# synthesized one-shots (video/public): whoosh on every cut, thud on impact and at the climax
for sc in scene_list[1:]:
    if sc["name"] in ("keyoff",):
        continue
    sfx.append({"file": "whoosh", "start": round(sc["start"] - 0.12, 3), "gain": -13, "duck": -4, "synth": True})
sfx.append({"file": "thud", "start": IMPACT, "gain": -6, "duck": 0, "synth": True})
sfx.append({"file": "thud", "start": CLIMAX, "gain": -6, "duck": 0, "synth": True})

cues = {
    "duration": END,
    "climax": round(CLIMAX, 3),
    "rescue": round(RESCUE, 3),
    "impact": round(IMPACT, 3),
    "wall": round(WALL, 3),
    "heartbeat": [round(s(13) - 0.1, 3), round(CLIMAX, 3)],
    "engine": engine,
    "scenes": scene_list,
    "sfx": [{**x, "start": round(x["start"], 3)} for x in sfx],
}
os.makedirs(os.path.join(ROOT, "video/src/blizzard"), exist_ok=True)
json.dump(cues, open(os.path.join(ROOT, "video/src/blizzard/cues.json"), "w"), ensure_ascii=False, indent=1)
for sc in scene_list:
    print(f'{sc["start"]:6.2f}-{sc["end"]:6.2f} {sc["view"]:5s} {sc["name"]}')
