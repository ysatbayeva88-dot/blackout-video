"""Scene + sound cue sheet for the plane video, derived from the voiceover timings.

Single source of truth for timing: writes video/src/sim/cues.json, which both
the Remotion composition (scenes, camera, hand) and tools/mix_plane.py (audio) read.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tm = json.load(open(os.path.join(ROOT, "audio/plane_timings.json")))
SEG = tm["segments"]
s = lambda i: SEG[i]["start"]
e = lambda i: SEG[i]["end"]
w = lambda i, k: SEG[i]["words"][k]["start"]
END = round(tm["duration"] + 1.0, 3)
TOUCH = s(26)

# (name, view, start). view: cockpit | exterior | doorway
scenes = [
    ("hook", "cockpit", 0.0),
    ("orbit", "exterior", s(2) - 0.15),
    ("doorway", "doorway", s(3) - 0.15),
    ("mayday", "cockpit", s(4) - 0.1),
    ("autopilot", "cockpit", s(10) - 0.1),
    ("altknob", "cockpit", s(12) - 0.1),
    ("dive", "exterior", s(13) - 0.15),
    ("airport", "exterior", s(14) - 0.15),
    ("flaps", "exterior", s(15) - 0.1),
    ("gear", "exterior", s(16) - 0.1),
    ("greens", "cockpit", s(17) - 0.1),
    ("gust", "cockpit", s(18) - 0.15),
    ("final", "cockpit", s(22) - 0.1),
    ("touchdown", "exterior", TOUCH - 0.45),
    ("stop", "cockpit", e(27) + 0.15),
]
scene_list = []
for i, (name, view, start) in enumerate(scenes):
    end = scenes[i + 1][2] if i + 1 < len(scenes) else END
    scene_list.append({"name": name, "view": view, "start": round(start, 3), "end": round(end, 3)})

# sound effects: file, start (s), gain (dB, before ducking), duck under voice (dB), optional length
sfx = [
    {"file": "alarm", "start": 0.0, "gain": -14, "duck": -8, "len": s(2) - 0.2, "fade": 0.6},
    {"file": "switch_toggle", "start": w(5, 0) + 0.3, "gain": -8, "duck": -4},       # headset taken
    {"file": "button_click", "start": w(7, 0) + 0.2, "gain": 0, "duck": -2},          # push-to-talk
    {"file": "button_click", "start": w(10, 0) - 0.05, "gain": -6, "duck": -2},       # radio squelch-ish
]
for k in range(6):  # altitude knob detents
    sfx.append({"file": "button_click", "start": round(s(12) + 0.15 + k * 0.28, 3), "gain": -8, "duck": -3})
sfx += [
    {"file": "wind_descent", "start": s(13) - 0.3, "gain": -10, "duck": -8, "fade": 1.0},
    {"file": "switch_toggle", "start": s(15) + 0.1, "gain": -6, "duck": -3},          # flap lever
    {"file": "gear_down", "start": s(16) - 0.1, "gain": -9, "duck": -7},
    {"file": "button_click", "start": w(22, 0) + 0.1, "gain": -2, "duck": -2},        # A/P disconnect
    {"file": "switch_toggle", "start": w(22, 5) + 0.1, "gain": -6, "duck": -3},       # thrust to idle
    {"file": "tire_screech", "start": TOUCH - 0.05, "gain": -6, "duck": -4},
    {"file": "reverse_thrust", "start": s(27) - 0.1, "gain": -9, "duck": -8, "fade": 1.2},
    {"file": "cabin_applause", "start": s(28) + 0.1, "gain": -13, "duck": -8, "fade": 1.5},
]
# synthesized one-shots (video/public): whoosh on every cut, low thud at touchdown
for sc in scene_list[1:]:
    sfx.append({"file": "whoosh", "start": round(sc["start"] - 0.12, 3), "gain": -12, "duck": -4, "synth": True})
sfx.append({"file": "thud", "start": TOUCH, "gain": -10, "duck": 0, "synth": True})

cues = {
    "duration": END,
    "touch": TOUCH,
    "scenes": scene_list,
    "sfx": [{**x, "start": round(x["start"], 3)} for x in sfx],
}
json.dump(cues, open(os.path.join(ROOT, "video/src/sim/cues.json"), "w"), ensure_ascii=False, indent=1)
for sc in scene_list:
    print(f'{sc["start"]:6.2f}-{sc["end"]:6.2f} {sc["view"]:9s} {sc["name"]}')
