"""Phrase-by-phrase ElevenLabs voiceover for scripts/<name>.txt (default: plane).

Usage: python3 tools/voiceover.py [name]

Outputs:
  audio/phrases/<hash>.mp3/.json   cached raw TTS keyed by voice+text (re-runs only voice new lines)
  audio/<name>_full.mp3            glued voiceover
  audio/<name>_timings.json        per-phrase and per-word timecodes (seconds)
  audio/<name>.srt                 phrase-level subtitles
"""
import base64, glob, hashlib, json, os, re, shutil, subprocess, sys, urllib.request
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
MODEL = "eleven_multilingual_v2"
SETTINGS = {"stability": 0.35, "similarity_boost": 0.8, "style": 0.45,
            "speed": 1.1, "use_speaker_boost": True}
DISPATCHER_VOICE = "onwK4e9ZLuTAKqWW03F9"  # premade "Daniel - Steady Broadcaster"
GAP, GAP_PAUSE, GAP_TOUCHDOWN = 0.2, 0.35, 0.6
CLIMAX = ("Касание", "Глуши")  # phrases that get the long 0.6 s pause before them
NAME = sys.argv[1] if len(sys.argv) > 1 else "plane"


def env():
    vals = {k: os.environ[k] for k in ("ELEVENLABS_API_KEY", "VOICE_ID") if k in os.environ}
    path = os.path.join(ROOT, ".env")
    for line in open(path) if os.path.exists(path) else []:
        if "=" in line:
            k, v = line.strip().split("=", 1)
            vals[k] = v
    return vals


def tts(voice, text, key):
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps"
        "?output_format=mp3_44100_128",
        data=json.dumps({"text": text, "model_id": MODEL,
                         "voice_settings": SETTINGS}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le",
                          "-ac", "1", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def ffilter(x, af):
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ac", "1",
                        "-ar", str(SR), "-i", "-", "-af", af, "-f", "f32le",
                        "-"], input=x.astype(np.float32).tobytes(),
                       check=True, capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def click(rng, length=0.05):
    n = int(SR * length)
    t = np.arange(n) / SR
    burst = rng.standard_normal(n) * np.exp(-t * 90) * 0.5
    tone = np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 60) * 0.25
    return (burst + tone).astype(np.float32)


def radio(x, rng):
    """Band-limit to ~300-3000 Hz, add slight grit + hiss, click in/out."""
    x = ffilter(x, "highpass=f=300:poles=2,highpass=f=300:poles=2,"
                   "lowpass=f=3000:poles=2,lowpass=f=3000:poles=2,"
                   "acompressor=threshold=0.1:ratio=6:attack=5:release=60")
    x = np.tanh(x * 2.2) / np.tanh(2.2)
    lead, tail = 0.09, 0.12
    body = np.concatenate([np.zeros(int(SR * lead)), x, np.zeros(int(SR * tail))])
    hiss = ffilter(rng.standard_normal(len(body)).astype(np.float32) * 0.02,
                   "highpass=f=300,lowpass=f=3200")
    body = body * 0.85 + hiss
    c1, c2 = click(rng), click(rng)
    body[:len(c1)] += c1
    body[-len(c2):] += c2
    return body.astype(np.float32), lead


def word_times(text, al):
    chars = al["characters"]
    starts, ends = al["character_start_times_seconds"], al["character_end_times_seconds"]
    assert "".join(chars) == text, "alignment does not match text"
    words = []
    for m in re.finditer(r"\S+", text):
        w = m.group()
        if not re.search(r"\w", w):  # lone dash etc.
            continue
        words.append({"text": w, "start": starts[m.start()], "end": ends[m.end() - 1]})
    return words


def main():
    e = env()
    key, voice = e["ELEVENLABS_API_KEY"], e["VOICE_ID"]
    lines = [l.strip() for l in open(os.path.join(ROOT, f"scripts/{NAME}.txt"), encoding="utf-8") if l.strip()]
    cache = os.path.join(ROOT, "audio/phrases")
    os.makedirs(cache, exist_ok=True)
    rng = np.random.default_rng(7)

    out, segments, t = [], [], 0.0
    for i, line in enumerate(lines):
        speaker = "dispatcher" if line.startswith("[ДИСПЕТЧЕР]") else "narrator"
        text = line.replace("[ДИСПЕТЧЕР]", "").strip()
        pause = text.startswith("...")
        text = text.lstrip(".").strip()
        # a spaced dash mid-phrase makes the voice hang for seconds; a comma reads cleanly
        text = re.sub(r"\s—\s", ", ", text)
        voice_id = DISPATCHER_VOICE if speaker == "dispatcher" else voice
        h = hashlib.sha1(f"{voice_id}|{MODEL}|{json.dumps(SETTINGS, sort_keys=True)}|{text}".encode()).hexdigest()[:12]
        jpath, mpath = f"{cache}/{h}.json", f"{cache}/{h}.mp3"
        if not os.path.exists(jpath):
            # reuse a clip from the old index-named cache if the text matches
            for old in glob.glob(f"{cache}/[0-9][0-9].json"):
                m = json.load(open(old))
                if m["text"] == text and m["speaker"] == speaker:
                    shutil.copy(old, jpath)
                    shutil.copy(old[:-5] + ".mp3", mpath)
                    break
        if not os.path.exists(jpath):
            print(f"TTS {i:02d} [{speaker}] {text}", file=sys.stderr)
            r = tts(voice_id, text, key)
            open(mpath, "wb").write(base64.b64decode(r["audio_base64"]))
            json.dump({"text": text, "speaker": speaker, "alignment": r["alignment"]},
                      open(jpath, "w"), ensure_ascii=False)
        meta = json.load(open(jpath))
        words = word_times(text, meta["alignment"])
        x = decode(mpath)
        # trim the TTS padding to the actual speech, small safety margins
        a = max(0.0, words[0]["start"] - 0.04)
        b = min(len(x) / SR, words[-1]["end"] + 0.12)
        x = x[int(a * SR):int(b * SR)]
        offset = -a
        if speaker == "dispatcher":
            x, lead = radio(x, rng)
            offset += lead
        gap = 0 if i == 0 else (GAP_TOUCHDOWN if text.startswith(CLIMAX) else GAP_PAUSE if pause else GAP)
        out.append(np.zeros(int(SR * gap), dtype=np.float32))
        t += gap
        segments.append({
            "id": i, "speaker": speaker, "text": text,
            "start": round(t, 3), "end": round(t + len(x) / SR, 3),
            "words": [{"text": w["text"], "start": round(t + w["start"] + offset, 3),
                       "end": round(t + w["end"] + offset, 3)} for w in words],
        })
        out.append(x)
        t += len(x) / SR

    out.append(np.zeros(int(SR * 0.5), dtype=np.float32))
    for old in glob.glob(f"{cache}/[0-9][0-9].*"):
        os.remove(old)  # legacy index-named cache has been migrated
    full = np.concatenate(out)
    full = full / max(1e-6, np.abs(full).max()) * 0.89
    wav = os.path.join(cache, "full.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "1", "-ar", str(SR),
                    "-i", "-", wav], input=full.tobytes(), check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-b:a", "192k",
                    os.path.join(ROOT, f"audio/{NAME}_full.mp3")], check=True)
    os.remove(wav)
    json.dump({"duration": round(len(full) / SR, 3), "segments": segments},
              open(os.path.join(ROOT, f"audio/{NAME}_timings.json"), "w"),
              ensure_ascii=False, indent=1)
    def ts(x):
        ms = int(round(x * 1000))
        return f"{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}"
    with open(os.path.join(ROOT, f"audio/{NAME}.srt"), "w", encoding="utf-8") as f:
        for n, sg in enumerate(segments, 1):
            who = "[ДИСПЕТЧЕР] " if sg["speaker"] == "dispatcher" else ""
            f.write(f"{n}\n{ts(sg['start'])} --> {ts(sg['end'])}\n{who}{sg['text']}\n\n")
    print(f"done: {len(segments)} phrases, {len(full)/SR:.2f}s")


if __name__ == "__main__":
    main()
