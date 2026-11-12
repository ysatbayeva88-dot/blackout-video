"""Final audio mix for the ant video: voice on top, ducked music, beds and 'giant' SFX.

Reads audio/ant_full.mp3, audio/ant_timings.json, video/src/ant/cues.json, audio/sfx/*.mp3
and the synthesized one-shots in video/public (tools/sfx_ant.py, tools/sfx_music.py).
Writes video/public/ant_mix.mp3 (and a copy in audio/) normalised to -14 LUFS.
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from mix_plane import SR, db, load, place, smooth_env  # noqa: E402
from mix_blizzard import envelope, looped  # noqa: E402
from sfx_music import env_adsr, lowpass, music  # noqa: E402

SFX = os.path.join(ROOT, "audio/sfx")


def music_ant(duration, free, calm_end, end_rest):
    """Tension bed peaking in the water trap (hard cut at «Свободен»), a lighter second rise
    through strength / cold / the ant, then a warm resolve for the final question."""
    n = int(duration * SR)
    out = np.zeros(n)
    a = music(free + 4.0, free, 0.5)[: int(free * SR)]
    out[: len(a)] = a
    b0 = free + 1.0
    lb = calm_end - b0
    b = music(lb + 9.0, lb + 6.0, 0.5)[: int(lb * SR)] * 0.55  # never reaches its peak
    i0 = int(b0 * SR)
    b *= env_adsr(len(b), 1.5, 0.6)
    out[i0: i0 + len(b)] += b
    i1 = int(calm_end * SR)
    rt = np.arange(n - i1) / SR
    chord = sum(np.sin(2 * np.pi * f * rt) for f in (110, 138.6, 164.8, 220, 277.2)) / 5
    out[i1:] += lowpass(chord, 1000.0) * env_adsr(n - i1, 1.5, end_rest) * 0.9
    return out


def main():
    tm = json.load(open(os.path.join(ROOT, "audio/ant_timings.json")))
    cues = json.load(open(os.path.join(ROOT, "video/src/ant/cues.json")))
    D = cues["duration"]
    N = int(D * SR)
    t = np.arange(N) / SR
    sc = {x["name"]: x for x in cues["scenes"]}

    voice = np.zeros(N)
    v = load(os.path.join(ROOT, "audio/ant_full.mp3"), loudnorm=-16)
    voice[: min(N, len(v))] = v[:N]
    gate = np.zeros(N)
    for sg in tm["segments"]:
        gate[int(max(0, sg["start"] - 0.05) * SR): int((sg["end"] + 0.1) * SR)] = 1
    duck = smooth_env(gate)

    def ducked(bus, depth_db):
        return bus * (1 + (db(depth_db) - 1) * duck)

    m = music_ant(D, cues["free"], sc["final"]["start"], 3.0)
    m = m / (np.sqrt(np.mean(m[: int(cues["free"] * SR)] ** 2)) + 1e-9) * db(-27)
    mix = ducked(m[:N], -18)

    # rain hiss bed while it rains, cold wind in the cold scene (library loops, quiet)
    rain = looped(f"{SFX}/blizzard_wind_loop.mp3", N) * envelope(N, [cues["rain"]], 0.6) * db(-20)
    cold = looped(f"{SFX}/blizzard_wind_loop.mp3", N) * envelope(N, [cues["cold"]], 0.5) * db(-12)
    mix += ducked(rain + cold, -8)

    hb = looped(f"{SFX}/heartbeat_loop.mp3", N, 0.3) * envelope(N, [cues["heartbeat"]], 0.3)
    hb *= np.interp(t, cues["heartbeat"], [0.45, 1.0]) * db(-6)
    mix += ducked(hb, -4)

    for c in cues["sfx"]:
        path = os.path.join(ROOT, "video/public" if c.get("synth") else "audio/sfx", c["file"] + ".mp3")
        x = load(path, loudnorm=-20)
        bus = np.zeros(N)
        place(bus, x, c["start"], db(c["gain"]), c.get("fade", 0.05), c.get("len"))
        mix += ducked(bus, c["duck"])

    mix *= db(4)
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
    dst = os.path.join(ROOT, "video/public/ant_mix.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", af, "-ar", "48000", "-ac", "2", "-b:a", "192k", dst], check=True)
    os.remove(tmp)
    subprocess.run(["cp", dst, os.path.join(ROOT, "audio/ant_mix.mp3")], check=True)
    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    vm = gate > 0
    print(f"under voice: voice {rms(voice[vm]):.1f} dB, rest {rms(mix[vm]):.1f} dB; gaps: rest {rms(mix[~vm]):.1f} dB")
    print("written", dst)


if __name__ == "__main__":
    main()
