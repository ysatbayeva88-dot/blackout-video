"""Synthesize the 'giant' sound effects for the ant video (numpy, no samples, no API credits).

Everything is heard from a 3 mm tall listener, so ordinary tiny sounds are pitched down,
stretched and made heavy: a raindrop lands like an explosion, ant steps are thuds.
Writes video/public/ant_*.mp3.
"""
import os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from sfx_music import SR, lowpass, save  # noqa: E402

rng = np.random.default_rng(11)


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def hp(x, f):
    return x - lowpass(x, f)


def boom(sec=2.2, f0=70, f1=28, crack=0.6):
    """Deep impact: falling-pitch sine body + noise crack + rumble tail."""
    t = tt(sec)
    f = f1 + (f0 - f1) * np.exp(-t * 5)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    n = rng.standard_normal(len(t))
    cr = lowpass(n, 3000.0) * np.exp(-t * 25) * crack
    rumble = lowpass(n, 160.0) * np.exp(-t * 1.6) * 3.0
    return body + cr + rumble


def splash(sec=2.6):
    """Huge water burst: boom + broadband spray hiss that falls off + bubbly gurgle."""
    t = tt(sec)
    n = rng.standard_normal(len(t))
    spray = hp(lowpass(n, 2600.0 + 3000 * np.exp(-t * 3)), 400.0) * np.exp(-t * 2.4) * 0.9
    gurgle = np.zeros(len(t))
    for _ in range(40):
        s0 = rng.uniform(0.15, sec - 0.3)
        f = rng.uniform(120, 420)
        m = int(0.12 * SR)
        i = int(s0 * SR)
        k = np.arange(m) / SR
        gurgle[i:i + m] += np.sin(2 * np.pi * (f + 900 * k) * k) * np.exp(-k * 30) * 0.25
    b = boom(sec, 90, 30, 1.0)
    return b + spray + gurgle


def drop_far():
    return splash(1.6) * np.exp(-tt(1.6) * 1.0)


def underwater(sec=10.0):
    """Muffled pressure drone with slow wobble and sparse bubbles."""
    t = tt(sec)
    n = rng.standard_normal(len(t))
    bed = lowpass(n, 220.0) * (1 + 0.4 * np.sin(2 * np.pi * 0.35 * t)) * 4
    hum = np.sin(2 * np.pi * 48 * t + 0.6 * np.sin(2 * np.pi * 0.2 * t)) * 0.25
    bub = np.zeros(len(t))
    for _ in range(int(sec * 3)):
        i = int(rng.uniform(0, sec - 0.2) * SR)
        m = int(0.09 * SR)
        k = np.arange(m) / SR
        f = rng.uniform(250, 700)
        bub[i:i + m] += np.sin(2 * np.pi * (f + 2500 * k) * k) * np.exp(-k * 45) * 0.18
    return bed + hum + bub


def pop():
    """Surface film tearing: a wet low 'blop' with a sharp release."""
    t = tt(0.9)
    f = 60 + 500 * np.exp(-t * 18)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)
    n = rng.standard_normal(len(t))
    return body + lowpass(n, 1800.0) * np.exp(-t * 35) * 0.5


def drips(sec=2.6):
    out = np.zeros(int(sec * SR))
    for k in range(7):
        i = int((0.1 + k * 0.33 + rng.uniform(-0.05, 0.05)) * SR)
        x = pop()[: int(0.35 * SR)] * 0.5
        out[i:i + len(x)] += x[: len(out) - i]
    return out


def stomp():
    t = tt(0.45)
    f = 34 + 60 * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    n = rng.standard_normal(len(t))
    grit = lowpass(n, 700.0) * np.exp(-t * 28) * 1.4
    return body + grit


def click():
    """Mandibles/antennae: a crisp chitin double-click, pitched down."""
    out = np.zeros(int(0.5 * SR))
    for d in (0.0, 0.12, 0.2):
        t = tt(0.06)
        x = hp(rng.standard_normal(len(t)), 900.0) * np.exp(-t * 120)
        i = int(d * SR)
        out[i:i + len(x)] += x
    return out


def fall_air(sec=1.8):
    t = tt(sec)
    n = rng.standard_normal(len(t))
    sweep = 400 + 1600 * np.sin(np.pi * t / sec)
    return (lowpass(n, sweep) - lowpass(n, sweep * 0.3)) * np.sin(np.pi * t / sec) ** 1.2


def tap():
    t = tt(0.25)
    return np.sin(2 * np.pi * 900 * t) * np.exp(-t * 60) * 0.4 + hp(rng.standard_normal(len(t)), 2000.0) * np.exp(-t * 90) * 0.3


def riser(sec=3.0):
    t = tt(sec)
    n = rng.standard_normal(len(t))
    k = t / sec
    whistle = np.sin(2 * np.pi * np.cumsum(300 + 900 * k ** 2) / SR) * 0.15 * k
    return lowpass(n, 200 + 3500 * k ** 2) * k ** 2 + whistle


def tick():
    t = tt(0.12)
    return np.sin(2 * np.pi * 1600 * t) * np.exp(-t * 70)


def crumb():
    """Bread crumb as a boulder: dry crunchy grinding."""
    t = tt(1.0)
    n = rng.standard_normal(len(t))
    crackle = n * (rng.random(len(t)) < 0.01) * 3
    return lowpass(crackle, 1500.0) * np.exp(-t * 2) + boom(1.0, 55, 30, 0.2) * 0.4


if __name__ == "__main__":
    for name, x in [
        ("ant_boom", boom()), ("ant_splash_big", splash()), ("ant_drop_far", drop_far()),
        ("ant_underwater", underwater()), ("ant_pop", pop()), ("ant_drips", drips()),
        ("ant_stomp", stomp()), ("ant_click", click()), ("ant_fall_air", fall_air()),
        ("ant_tap", tap()), ("ant_riser", riser()), ("ant_tick", tick()), ("ant_crumb", crumb()),
        ("ant_thump", boom(1.2, 60, 32, 0.3)),
    ]:
        save(f"{name}.mp3", x)
        print("ok", name)
