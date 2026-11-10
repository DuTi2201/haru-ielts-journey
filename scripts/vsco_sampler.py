"""A minimal SFZ sampler for the orchestral recordings of VSCO 2: Community Edition.

VSCO 2 CE (Versilian Studios, https://github.com/sgossner/VSCO-2-CE) is released under CC0 1.0: the recordings
may be used for any purpose, commercial or not. We ask only that the samples themselves are not sold on, and
credit is appreciated, so: "orchestral sounds: VSCO 2 Community Edition, Versilian Studios (CC0)".

The recordings are NOT part of this repository (about 1.5 GB). gen-ballet-swan.py reads them from the folder
named by the VSCO_DIR environment variable (a checkout of the `master` branch); without it the generator falls
back to its own additive synthesis. The note maps (`vsco-sfz/*.sfz`, from the library's `SFZ` branch) are small
text files and live next to this script.

What this module does, and nothing more:
  * parse the few SFZ opcodes the library uses (sample, lokey, hikey, pitch_keycenter, lovel, hivel, tune);
  * pick a recording for (note, velocity), with a few semitones of extrapolation;
  * re-pitch it by cubic interpolation (optionally with a time-varying ratio: portamento, glissando, tape-fall);
  * hold a sustained note longer than its recording by cross-fading a loop in the steady part;
  * optionally measure each recording's real pitch and correct it (`autotune`, used for the harp);
  * return a stereo float32 array of exactly the requested duration, with attack/release envelopes.
"""
import glob
import os
import re

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import map_coordinates
from scipy.signal import fftconvolve, resample_poly

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
SFZ_DIR = os.path.join(HERE, "vsco-sfz")


def _note_number(v):
    v = v.strip()
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    m = re.fullmatch(r"([a-gA-G])([#b]?)(-?\d+)", v)          # SFZ: c4 = 60
    pc = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}[m.group(1).lower()]
    return 12 * (int(m.group(3)) + 1) + pc + {"#": 1, "b": -1, "": 0}[m.group(2)]


def parse_sfz(path):
    text = re.sub(r"//[^\n]*", "", open(path, encoding="latin-1").read())
    ctrl, glob_ops, grp, regions = {}, {}, {}, []
    for m in re.finditer(r"<(\w+)>([^<]*)", text):
        tag, body = m.groups()
        ops = {k: v.strip() for k, v in re.findall(r"(\w+)=(.*?)(?=\s+\w+=|\s*$)", body, flags=re.S)}
        if tag == "control":
            ctrl = ops
        elif tag == "global":
            glob_ops, grp = ops, {}
        elif tag == "group":
            grp = ops
        elif tag == "region":
            regions.append({**glob_ops, **grp, **ops})
    return ctrl, regions


def _to_float(x):
    if x.dtype == np.int16:
        x = x.astype(np.float32) / 32768.0
    elif x.dtype == np.int32:
        x = x.astype(np.float32) / 2147483648.0
    elif x.dtype == np.uint8:
        x = (x.astype(np.float32) - 128.0) / 128.0
    else:
        x = x.astype(np.float32)
    return x


def measure_cents(x, midi):
    """how many cents the recording's pitch lies above `midi` (centroid of its strongest harmonics; the mean pitch
    of a vibrato note). Only meaningful for clearly pitched sounds."""
    m = x.mean(axis=1)
    n = len(m)
    a = int(0.35 * SR)
    b = min(n - int(0.5 * SR), a + int(4.0 * SR))
    if b - a < 0.5 * SR:
        a, b = 0, n
    seg = m[a:b] * np.hanning(b - a)
    nfft = 1 << int(np.ceil(np.log2(len(seg) * 4)))
    spec = np.abs(np.fft.rfft(seg, nfft)) ** 2
    f = np.fft.rfftfreq(nfft, 1 / SR)
    f0 = 440.0 * 2 ** ((midi - 69) / 12.0)
    est, wts = [], []
    for k in range(1, 9):
        fk = f0 * k
        if fk > 7000:
            break
        lo, hi = np.searchsorted(f, fk * 0.97), np.searchsorted(f, fk * 1.03)
        j = lo + int(np.argmax(spec[lo:hi]))
        lo2, hi2 = np.searchsorted(f, f[j] * 0.975), np.searchsorted(f, f[j] * 1.025)
        w = spec[lo2:hi2]
        est.append(1200 * np.log2(np.sum(w * f[lo2:hi2]) / np.sum(w) / fk))
        wts.append(spec[j])
    est, wts = np.array(est), np.array(wts)
    top = np.argsort(wts)[::-1][:3]
    return float(np.average(est[top], weights=wts[top]))


class Sample:
    """one decoded recording: stereo, leading silence trimmed, with its loudness measured once."""

    def __init__(self, path):
        sr, x = wavfile.read(path)
        x = _to_float(x)
        if x.ndim == 1:
            x = np.stack([x, x], 1)
        if sr != SR:
            x = resample_poly(x, SR, sr, axis=0).astype(np.float32)
        mono = np.abs(x).max(axis=1)
        thr = mono.max() * 10 ** (-50 / 20)
        i0 = int(np.argmax(mono > thr)) if mono.max() > 0 else 0
        self.x = np.ascontiguousarray(x[max(0, i0 - int(0.003 * SR)):])
        n = len(self.x)
        a, b = int(0.3 * SR), int(min(0.55 * n, 5.0 * SR))
        if b - a < 0.2 * SR:
            a, b = 0, n
        self.rms_body = float(np.sqrt(np.mean(self.x[a:b] ** 2) * 2) + 1e-9)          # L and R power together
        self.rms_head = float(np.sqrt(np.mean(self.x[: int(1.0 * SR)] ** 2) * 2) + 1e-9)
        self._loop = None

    def loop_unit(self):
        """(start, unit): playing `x[:start]` and then `unit` over and over is seamless. The unit is a stretch of the
        steady part whose tail has been cross-faded into its head, at the lag where the two best line up."""
        if self._loop is not None:
            return self._loop
        n = len(self.x)
        xf = int(0.6 * SR)
        ls = int(min(1.4 * SR, 0.22 * n))
        le = int(0.72 * n)
        if le - ls < 2 * xf:
            self._loop = (None, None)
            return self._loop
        m = self.x.mean(axis=1)
        ref = m[ls - xf:ls]
        span = int(0.12 * SR)
        seg = m[le - xf - span:le + span]
        c = fftconvolve(seg, ref[::-1], mode="valid")
        e = np.sqrt(fftconvolve(seg ** 2, np.ones(len(ref)), mode="valid") + 1e-9)
        k = int(np.argmax(c / e))
        le = le - span + k
        fo = np.cos(np.linspace(0, np.pi / 2, xf))[:, None]
        fi = np.sin(np.linspace(0, np.pi / 2, xf))[:, None]
        body = self.x[ls:le - xf].copy()
        tail = self.x[le - xf:le] * fo + self.x[ls - xf:ls] * fi
        self._loop = (ls, np.concatenate([body, tail.astype(np.float32)]))
        return self._loop

    def extend(self, need, sustained):
        n = len(self.x)
        if need <= n:
            return self.x[:need]
        ls, unit = self.loop_unit() if sustained else (None, None)
        if unit is None:
            return np.concatenate([self.x, np.zeros((need - n, 2), np.float32)])
        reps = int(np.ceil((need - ls) / len(unit)))
        return np.concatenate([self.x[:ls]] + [unit] * reps)[:need]


class Instrument:
    def __init__(self, lib, sfz_name, sustained=True, norm="body", up=3, down=3, autotune=False):
        ctrl, regs = parse_sfz(os.path.join(lib.sfz_dir or SFZ_DIR, sfz_name + ".sfz"))
        base = ctrl.get("default_path", "").replace("\\", "/")
        self.lib, self.sustained, self.norm, self.up, self.down, self.autotune = lib, sustained, norm, up, down, autotune
        self.regions = []
        for r in regs:
            path = os.path.join(lib.root, base, r["sample"].replace("\\", "/"))
            if not os.path.exists(path):
                continue
            key = _note_number(r["pitch_keycenter"]) if "pitch_keycenter" in r else _note_number(r.get("key", "60"))
            self.regions.append(dict(
                path=path, lo=_note_number(r.get("lokey", r.get("key", "0"))), hi=_note_number(r.get("hikey", r.get("key", "127"))),
                key=key, lov=int(r.get("lovel", 0)), hiv=int(r.get("hivel", 127)), tune=float(r.get("tune", 0))))
        if not self.regions:
            raise FileNotFoundError("no samples found for %s under %s" % (sfz_name, lib.root))
        self.lo = min(r["lo"] for r in self.regions)
        self.hi = max(r["hi"] for r in self.regions)

    def covers(self, midi):
        return self.lo - self.down <= midi <= self.hi + self.up

    def pick(self, midi, vel127):
        m = int(round(midi))
        c = [r for r in self.regions if r["lo"] <= m <= r["hi"]]
        if not c:                                            # beyond the recorded range: the nearest key centre
            c = [min(self.regions, key=lambda r: min(abs(m - r["lo"]), abs(m - r["hi"])))]
        v = [r for r in c if r["lov"] <= vel127 <= r["hiv"]]
        if not v:
            v = [min(c, key=lambda r: min(abs(vel127 - r["lov"]), abs(vel127 - r["hiv"])))]
        w = min(r["hiv"] - r["lov"] for r in v)
        v = [r for r in v if r["hiv"] - r["lov"] == w]
        return v[self.lib.rng.integers(len(v))]

    def play(self, midi, dur, vel127=90, att=0.0, rel=0.3, cents=0.0, ratio_curve=None, gain=1.0):
        """a stereo (n, 2) float32 array of `dur` seconds. `ratio_curve` (n values, multiplied into the pitch ratio)
        gives portamento / glissando; the note then reads the recording at a changing speed."""
        if not self.covers(midi):
            return None
        reg = self.pick(midi, int(np.clip(vel127, 1, 127)))
        smp = self.lib.sample(reg["path"])
        corr = 0.0
        if self.autotune:                                    # a few recordings (the harp) are tuned a little flat
            if "meas" not in reg:
                reg["meas"] = float(np.clip(measure_cents(smp.x, reg["key"]) + reg["tune"], -40, 40))
            corr = -reg["meas"]
        ratio = 2.0 ** ((midi - reg["key"]) / 12.0 + (cents + reg["tune"] + corr) / 1200.0)
        nout = max(8, int(round(dur * SR)))
        if ratio_curve is None:
            coords = np.arange(nout) * ratio
        else:
            rc = np.asarray(ratio_curve, np.float64)[:nout] * ratio
            coords = np.concatenate([[0.0], np.cumsum(rc[:-1])])
            nout = len(coords)
        src = smp.extend(int(coords[-1]) + 8, self.sustained)
        out = np.empty((nout, 2), np.float32)
        for ch in range(2):
            out[:, ch] = map_coordinates(src[:, ch], [coords], order=3, mode="nearest")
        norm = smp.rms_body if self.norm == "body" else smp.rms_head
        t = np.arange(nout) / SR
        env = np.minimum(1.0, t / 0.004)                      # 4 ms: no click on a re-pitched start
        if att > 0.02:
            env = env * np.minimum(1.0, t / att) ** 1.2
        r = np.clip((dur - t) / max(rel, 1e-3), 0, 1)
        env = env * np.sin(0.5 * np.pi * r)
        return out * (env * gain / norm)[:, None].astype(np.float32)


class Library:
    def __init__(self, root, seed=7, sfz_dir=None):
        """`sfz_dir`: where the note maps live (default: vsco-sfz/ next to this file). The piano and guitar sets of
        gen-ballet-session.py bring their own maps, written by prepare-session-samples.py."""
        self.root = root
        self.sfz_dir = sfz_dir
        self.rng = np.random.default_rng(seed)
        self._cache = {}
        self._insts = {}

    def sample(self, path):
        s = self._cache.get(path)
        if s is None:
            if len(self._cache) > 160:                       # bound the memory: ~4 MB per recording
                self._cache.pop(next(iter(self._cache)))
            s = self._cache[path] = Sample(path)
        return s

    def inst(self, sfz_name, **kw):
        k = (sfz_name, tuple(sorted(kw.items())))
        if k not in self._insts:
            self._insts[k] = Instrument(self, sfz_name, **kw)
        return self._insts[k]

    def oneshot(self, pattern, dur=None, gain=1.0, rel=0.3, ratio=1.0, norm="head", tail_after_peak=None):
        """a single recording picked at random from files matching `pattern` (relative to the library root), cut to
        `dur` seconds (or to `tail_after_peak` seconds after its loudest moment)."""
        files = sorted(glob.glob(os.path.join(self.root, pattern)))
        if not files:
            return None
        smp = self.lib_sample(files[self.rng.integers(len(files))])
        x = smp.x
        if tail_after_peak is not None:
            e = np.convolve(np.abs(x).max(axis=1), np.ones(SR // 10) / (SR // 10), mode="same")
            dur = (int(np.argmax(e)) + 1) / SR + tail_after_peak
        n = len(x) if dur is None else min(len(x), int(dur * SR))
        if ratio != 1.0:
            coords = np.arange(int(n / ratio)) * ratio
            x = np.stack([map_coordinates(smp.x[:, c], [coords], order=3, mode="nearest") for c in range(2)], 1).astype(np.float32)
            n = len(x)
        t = np.arange(n) / SR
        end = n / SR
        env = np.sin(0.5 * np.pi * np.clip((end - t) / max(rel, 1e-3), 0, 1)) * np.minimum(1.0, t / 0.003)
        k = {"head": smp.rms_head, "body": smp.rms_body, "raw": 1.0}[norm]
        return x[:n] * (env * gain / k)[:, None].astype(np.float32)

    lib_sample = sample
