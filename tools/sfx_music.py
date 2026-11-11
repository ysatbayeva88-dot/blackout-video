"""Synthesize the background track and SFX for the plane video (no third-party samples).

  video/public/music.mp3     tension bed, length = voiceover + tail; drops out at touchdown
  video/public/whoosh.mp3    scene-change whoosh
  video/public/thud.mp3      touchdown impact
"""
import json, os, subprocess
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "video/public")
SR = 44100
rng = np.random.default_rng(3)


def save(name, x):
    x = (x / max(1e-6, np.abs(x).max()) * 0.9).astype(np.float32)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "1", "-ar", str(SR),
                    "-i", "-", "-b:a", "192k", os.path.join(PUB, name)], input=x.tobytes(), check=True)


def lowpass(x, cutoff):
    # one-pole, cutoff may be an array (sweeps)
    a = np.exp(-2 * np.pi * np.broadcast_to(cutoff, x.shape) / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def env_adsr(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def whoosh():
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    sweep = 300 + 5000 * np.sin(np.pi * t / t[-1]) ** 2
    x = lowpass(noise, sweep) - lowpass(noise, sweep * 0.25)
    return x * np.sin(np.pi * t / t[-1]) ** 1.5


def thud():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = 90 * np.exp(-t * 6) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    crack = lowpass(rng.standard_normal(n), 2500) * np.exp(-t * 30) * 0.8
    return body + crack


def music(duration, touchdown, end_rest):
    n = int(duration * SR)
    t = np.arange(n) / SR
    bpm = 96; beat = 60 / bpm
    out = np.zeros(n)
    # intensity rises until touchdown, then silence, then a soft resolve chord
    inten = np.clip(t / touchdown, 0, 1) ** 1.3
    # drone: A1 + E2 with slow beating
    drone = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.6 * t)
             + 0.3 * np.sin(2 * np.pi * 110.4 * t)) * (0.5 + 0.3 * inten)
    out += lowpass(drone, 400.0) * 0.6
    # pulsing 8th-note bass, minor riff A-A-C-A-G-A-E-A
    riff = [55, 55, 65.4, 55, 49, 55, 41.2, 55]
    step = beat / 2
    for k in range(int(touchdown / step)):
        s = int(k * step * SR); m = int(step * 0.9 * SR)
        if s + m > n: break
        tt = np.arange(m) / SR
        f = riff[k % 8] * 2
        saw = 2 * ((f * tt) % 1) - 1
        note = saw * np.exp(-tt * 9) * (0.25 + 0.75 * inten[s])
        out[s:s + m] += note * 0.5
    # ticking hi-hat comes in from ~40% intensity
    for k in range(int(touchdown / step)):
        s = int(k * step * SR)
        if inten[s] < 0.35: continue
        m = int(0.05 * SR)
        h = rng.standard_normal(m) * np.exp(-np.arange(m) / SR * 80)
        h = h - lowpass(h, 6000.0)
        out[s:s + m] += h * 0.25 * inten[s]
    # riser into touchdown
    r0 = touchdown - 6.0
    i0, i1 = int(r0 * SR), int(touchdown * SR)
    rt = np.arange(i1 - i0) / SR
    riser = lowpass(rng.standard_normal(i1 - i0), 200 + 4000 * (rt / rt[-1]) ** 2) * (rt / rt[-1]) ** 2
    out[i0:i1] += riser * 0.6
    # hard cut at touchdown, short gap, then a warm major resolve (A major) to the end
    out[i1:] = 0
    s = int((touchdown + 1.2) * SR)
    rt = np.arange(n - s) / SR
    chord = sum(np.sin(2 * np.pi * f * rt) for f in (110, 138.6, 164.8, 220)) / 4
    out[s:] += lowpass(chord, 900.0) * env_adsr(n - s, 1.5, end_rest) * 0.8
    return out


def music_blizzard(duration, climax, calm_from, rescue, end_rest):
    """Tension bed rising to the climax (hard cut), sparse cold drone after, warm resolve at the rescue."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    a = music(climax + 4.0, climax, 0.5)[: int(climax * SR)]
    out[: len(a)] = a
    # cold drone (D minor-ish, very soft) from day two until the rescue
    i0, i1 = int(calm_from * SR), int(rescue * SR)
    tt = t[i0:i1] - calm_from
    drone = (np.sin(2 * np.pi * 73.4 * tt) + 0.5 * np.sin(2 * np.pi * 110 * tt + 0.3 * np.sin(0.4 * tt))
             + 0.25 * np.sin(2 * np.pi * 146.8 * tt))
    rise = np.clip(tt / max(1e-3, tt[-1]), 0, 1)
    out[i0:i1] += lowpass(drone, 300.0) * (0.12 + 0.25 * rise) * env_adsr(i1 - i0, 1.5, 0.4)
    # warm major resolve from the rescue to the end
    rt = t[i1:] - rescue
    chord = sum(np.sin(2 * np.pi * f * rt) for f in (110, 138.6, 164.8, 220, 277.2)) / 5
    out[i1:] += lowpass(chord, 1000.0) * env_adsr(n - i1, 2.0, end_rest) * 0.9
    return out


if __name__ == "__main__":
    tm = json.load(open(os.path.join(ROOT, "audio/plane_timings.json")))
    touch = next(s for s in tm["segments"] if s["text"].startswith("Касание"))["start"]
    total = tm["duration"] + 1.5
    save("whoosh.mp3", whoosh())
    save("thud.mp3", thud())
    save("music.mp3", music(total, touch, 2.5))
    print("ok", total, touch)
