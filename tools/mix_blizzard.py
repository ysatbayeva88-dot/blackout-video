"""Final audio mix for the blizzard video: voice on top, ducked music, wind/engine beds and SFX.

Reads audio/blizzard_full.mp3, audio/blizzard_timings.json, video/src/blizzard/cues.json,
audio/sfx/*.mp3 and the synthesized whoosh/thud in video/public.
Writes video/public/blizzard_mix.mp3 (and a copy in audio/) normalised to -14 LUFS.
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from mix_plane import SR, db, load, place, smooth_env  # noqa: E402
from sfx_music import music_blizzard  # noqa: E402

SFX = os.path.join(ROOT, "audio/sfx")


def looped(path, n, xfade=1.0):
    x = load(path, loudnorm=-20)
    xf = int(xfade * SR)
    ramp = np.linspace(0, 1, xf)
    bed = np.zeros(n + len(x))
    pos = 0
    while pos < n:
        seg = x.copy()
        if pos > 0:
            seg[:xf] *= ramp
        seg[-xf:] *= ramp[::-1]
        bed[pos: pos + len(seg)] += seg
        pos += len(x) - xf
    return bed[:n]


def envelope(n, intervals, ramp=0.15):
    """0/1 gate from [start, end] intervals, smoothed with linear ramps."""
    g = np.zeros(n)
    for a, b in intervals:
        g[int(a * SR): int(b * SR)] = 1
    k = int(ramp * SR)
    return np.convolve(g, np.ones(k) / k, mode="same")


def main():
    tm = json.load(open(os.path.join(ROOT, "audio/blizzard_timings.json")))
    cues = json.load(open(os.path.join(ROOT, "video/src/blizzard/cues.json")))
    D = cues["duration"]
    N = int(D * SR)
    t = np.arange(N) / SR
    scenes = cues["scenes"]
    sc = {x["name"]: x for x in scenes}

    voice = np.zeros(N)
    v = load(os.path.join(ROOT, "audio/blizzard_full.mp3"), loudnorm=-16)
    voice[: min(N, len(v))] = v[:N]
    gate = np.zeros(N)
    for sg in tm["segments"]:
        gate[int(max(0, sg["start"] - 0.05) * SR): int((sg["end"] + 0.1) * SR)] = 1
    duck = smooth_env(gate)

    def ducked(bus, depth_db):
        return bus * (1 + (db(depth_db) - 1) * duck)

    # music
    m = music_blizzard(D, cues["climax"], sc["d2"]["start"], cues["rescue"], 3.0)
    m = m / (np.sqrt(np.mean(m[: int(cues["climax"] * SR)] ** 2)) + 1e-9) * db(-27)
    mix = ducked(m[:N], -18)

    # wind: outside bed on exterior shots, muffled bed inside the car; dies down after the rescue
    outside = envelope(N, [[x["start"], x["end"]] for x in scenes if x["view"] == "ext"])
    calm = np.interp(t, [0, cues["rescue"], D], [1, 1, 0.45])
    w_out = looped(f"{SFX}/blizzard_wind_loop.mp3", N) * db(-8) * outside * calm
    w_in = looped(f"{SFX}/wind_inside_car_loop.mp3", N) * db(-11) * (1 - outside) * calm
    hook_boost = np.interp(t, [0, 0.4, 2.5, 3.2], [1.6, 1.6, 1.2, 1])  # loud gust under the hook
    mix += ducked((w_out + w_in) * hook_boost, -8)

    # engine idle while it runs
    eng = looped(f"{SFX}/car_engine_idle_loop.mp3", N) * db(-12) * envelope(N, cues["engine"], 0.3)
    eng *= np.where(outside > 0.5, 0.7, 1.0)
    mix += ducked(eng, -6)

    # heartbeat under the CO scene, speeding up the feel by getting louder
    hb = looped(f"{SFX}/heartbeat_loop.mp3", N, 0.3) * envelope(N, [cues["heartbeat"]], 0.4)
    hb *= np.interp(t, [cues["heartbeat"][0], cues["heartbeat"][1]], [0.4, 1.0]) * db(-6)
    mix += ducked(hb, -4)

    for c in cues["sfx"]:
        path = os.path.join(ROOT, "video/public" if c.get("synth") else "audio/sfx", c["file"] + ".mp3")
        x = load(path, loudnorm=-20)
        bus = np.zeros(N)
        place(bus, x, c["start"], db(c["gain"]), c.get("fade", 0.05), c.get("len"))
        mix += ducked(bus, c["duck"])

    mix *= db(3)  # beds sit a bit lower than in the plane video: wind is constant here
    out = voice + mix
    out = np.tanh(out * 1.2) / 1.2
    tmp = os.path.join(ROOT, "audio/.mix_tmp.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-i", "-", tmp],
                   input=out.astype(np.float32).tobytes(), check=True)
    p = subprocess.run(["ffmpeg", "-nostats", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True)
    js = json.loads(p.stderr[p.stderr.rindex("{"): p.stderr.rindex("}") + 1])
    af = ("loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:"
          f"measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:"
          f"measured_thresh={js['input_thresh']}:offset={js['target_offset']}")
    dst = os.path.join(ROOT, "video/public/blizzard_mix.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", af, "-ar", "48000", "-ac", "2", "-b:a", "192k", dst], check=True)
    os.remove(tmp)
    subprocess.run(["cp", dst, os.path.join(ROOT, "audio/blizzard_mix.mp3")], check=True)
    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    vm = gate > 0
    print(f"under voice: voice {rms(voice[vm]):.1f} dB, rest {rms(mix[vm]):.1f} dB; gaps: rest {rms(mix[~vm]):.1f} dB")
    print("written", dst)


if __name__ == "__main__":
    main()
