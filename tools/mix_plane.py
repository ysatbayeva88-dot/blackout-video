"""Final audio mix for the plane video: voice on top, ducked music + SFX underneath.

Reads audio/plane_full.mp3, audio/plane_timings.json, video/src/sim/cues.json,
audio/sfx/*.mp3 and the synthesized whoosh/thud in video/public.
Writes video/public/plane_mix.mp3 (and a copy in audio/) normalised to -14 LUFS.
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from sfx_music import music  # noqa: E402

SR = 44100
db = lambda x: 10 ** (x / 20)


def load(path, loudnorm=None):
    af = ["-af", f"loudnorm=I={loudnorm}:TP=-2:LRA=11"] if loudnorm is not None else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, *af, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def smooth_env(gate, attack=0.08, release=0.35):
    """One-pole attack/release follower on a 0/1 gate (sample rate SR)."""
    out = np.empty_like(gate)
    a_up, a_dn = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    acc = 0.0
    # run at 1/64 control rate for speed, then upsample
    step = 64
    ctrl = gate[::step]
    res = np.empty_like(ctrl)
    a_up, a_dn = a_up ** step, a_dn ** step
    for i, g in enumerate(ctrl):
        a = a_up if g > acc else a_dn
        acc = a * acc + (1 - a) * g
        res[i] = acc
    out = np.repeat(res, step)[: len(gate)]
    return out


def place(bus, x, start, gain=1.0, fade=0.0, length=None):
    if length is not None:
        x = x[: int(length * SR)]
    x = x.copy()
    if fade > 0:
        n = min(len(x), int(fade * SR))
        x[-n:] *= np.linspace(1, 0, n)
    i0 = int(start * SR)
    i1 = min(len(bus), i0 + len(x))
    if i1 > i0:
        bus[i0:i1] += x[: i1 - i0] * gain


def main():
    tm = json.load(open(os.path.join(ROOT, "audio/plane_timings.json")))
    cues = json.load(open(os.path.join(ROOT, "video/src/sim/cues.json")))
    N = int(cues["duration"] * SR)

    voice = np.zeros(N)
    v = load(os.path.join(ROOT, "audio/plane_full.mp3"), loudnorm=-16)
    voice[: min(N, len(v))] = v[:N]

    gate = np.zeros(N)
    for sg in tm["segments"]:
        gate[int(max(0, sg["start"] - 0.05) * SR): int((sg["end"] + 0.1) * SR)] = 1
    duck = smooth_env(gate)  # 0 silence .. 1 voice

    def ducked(bus, depth_db):
        return bus * (1 + (db(depth_db) - 1) * duck)

    # music: tension bed, hard stop at touchdown, relieved chord after (synth, normalised)
    m = music(cues["duration"], cues["touch"], 3.0)
    m = m / (np.sqrt(np.mean(m[: int(cues["touch"] * SR)] ** 2)) + 1e-9) * db(-26)
    mus = np.zeros(N)
    mus[: min(N, len(m))] = m[:N]
    mix = ducked(mus, -18)

    # engine hum: whole video, crossfaded loop, slightly lower after the stop
    eng = load(os.path.join(ROOT, "audio/sfx/engine_cockpit_loop.mp3"), loudnorm=-20)
    xf = int(1.0 * SR)
    bed = np.zeros(N + len(eng))
    pos = 0
    ramp = np.linspace(0, 1, xf)
    while pos < N:
        seg = eng.copy()
        if pos > 0:
            seg[:xf] *= ramp
        seg[-xf:] *= ramp[::-1]
        bed[pos: pos + len(seg)] += seg
        pos += len(eng) - xf
    bed = bed[:N] * db(-12)
    t = np.arange(N) / SR
    bed *= np.interp(t, [0, 0.5, cues["touch"] + 3, cues["duration"]], [0.4, 1, 1, 0.45])
    mix += ducked(bed, -6)

    # one-shot effects
    for c in cues["sfx"]:
        path = os.path.join(ROOT, "video/public" if c.get("synth") else "audio/sfx", c["file"] + ".mp3")
        x = load(path, loudnorm=-20)
        bus = np.zeros(N)
        place(bus, x, c["start"], db(c["gain"]), c.get("fade", 0.05), c.get("len"))
        mix += ducked(bus, c["duck"])

    mix *= db(5)  # effects bed sits ~12 dB under the voice while it speaks
    out = voice + mix
    # gentle safety limiter before loudness normalisation
    out = np.tanh(out * 1.2) / 1.2
    tmp = os.path.join(ROOT, "audio/.mix_tmp.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-i", "-", tmp],
                   input=out.astype(np.float32).tobytes(), check=True)
    # two-pass loudnorm to -14 LUFS
    p = subprocess.run(["ffmpeg", "-nostats", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True)
    js = json.loads(p.stderr[p.stderr.rindex("{"): p.stderr.rindex("}") + 1])
    af = ("loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:"
          f"measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:"
          f"measured_thresh={js['input_thresh']}:offset={js['target_offset']}")
    dst = os.path.join(ROOT, "video/public/plane_mix.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", af, "-ar", "48000", "-ac", "2", "-b:a", "192k", dst], check=True)
    os.remove(tmp)
    subprocess.run(["cp", dst, os.path.join(ROOT, "audio/plane_mix.mp3")], check=True)

    # report: voice vs everything else
    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
    vm = gate > 0
    print(f"under voice: voice {rms(voice[vm]):.1f} dB, rest {rms(mix[vm]):.1f} dB; gaps: rest {rms(mix[~vm]):.1f} dB")
    print("written", dst)


if __name__ == "__main__":
    main()
