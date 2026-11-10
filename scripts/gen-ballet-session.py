# Usage: VSCO_DIR=<VSCO-2-CE> PIANO_DIR=<..>/piano GUITAR_DIR=<..>/guitar python3 scripts/gen-ballet-session.py <out-dir> [p0:p1]
#   (needs numpy, scipy and ffmpeg; prepare the piano and guitar sets once with scripts/prepare-session-samples.py.
#    `p0:p1` renders only phrases p0..p1-1 of the 50 (18 s each), for listening tests; no argument = the whole 15:00.)
#
# "Thiên Nga Đen · phiên học 15 phút": the ballet of gen-ballet-swan.py re-made for one study session. It is the same
# story and the same four leitmotifs, but laid out as a single arc of exactly 15:00.000 that closes on itself, so the
# player can repeat it for hours. The score is original; the sound comes from
#   * VSCO 2 Community Edition (Versilian Studios, CC0 1.0): strings, harp, flute, clarinet, oboe, horn, trumpet, timpani,
#     bells and cymbals, played by scripts/vsco_sampler.py;
#   * Splendid Grand Piano (a Steinway, released into the public domain by AKAI; SFZ map by kinwie);
#   * Karoryfer "Black And Green Guitars" (a Gretsch hollow-body, CC0 1.0, Copyright 2022 Karoryfer Lecolds);
#   * our own synthesis for what is missing (music box, choir, sub-bass), and for the piano / guitar if their sets are absent.
#
# Form (3/4, crotchet = 80, 400 bars of 2.25 s = 900 s, 50 phrases of 8 bars):
#   I   VÀO VIỆC   bars   0- 56  0:00-2:06  one layer at a time (guitar pulse -> piano -> strings -> flute), quiet
#   II  TẬP TRUNG   bars  56-296  2:06-11:06 five episodes of six phrases (guitar+harp / piano / strings / winds / all soft);
#                                            the loudness does not move: nothing here is meant to be noticed
#   III NƯỚC RÚT    bars 296-360  11:06-13:30 the swell: more voices, higher register, a dominant pedal, then the dawn in B major
#   IV  HẠ CÁNH     bars 360-400  13:30-15:00 the lights go down; the last chord (B-F# open fifth + low B + bell) rings into the
#                                            first bar, which is built over the same low B: the loop has no seam.
#
# Harmony. The progression from the reference song, I-vi-IV-V, is used in four keys:
#   A  F#m  D  E    in the INTRO exactly as written (all four chords belong to B Dorian: the tonic Bm is held back and the low B
#                   stays under them as a pedal)
#   D  Bm   G  A    REF_D, the same shape in D major (the relative major of B minor)
#   Bm G    D  A    HOME, its rotation, the home of the curse
#   Em Bm   G  F#   TURN, which ends on the dominant: the A# (leading tone) leans back into B minor
#   B  G#m  E  F#   DAWN, the same shape in B major
# and from the guitar tabs: a steady quaver pulse whose pitch walks down three steps over each chord (C#-B-A, F#-E-D, ...),
# the layering order ostinato -> pad -> melody, long tied melody notes, bars of air, and an ending that falls to one held note.
#
# Leitmotifs: CURSE (B-D-F# up, lament down, hanging on A#), LOVE (A-D-F#, D major), MOTTO (B-D-F#-B, short-short-short-long,
# in B major at dawn), SIGH (C#->B).
import os
import re
import subprocess
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
WINDOW = None                                      # (first, last+1) phrase, for listening tests
if len(sys.argv) > 2:
    _a, _b = sys.argv[2].split(":")
    WINDOW = (int(_a), int(_b))
rng = np.random.default_rng(1894)
SOLO = WINDOW is not None
LIB = PLIB = GLIB = None
if os.environ.get("VSCO_DIR"):
    import vsco_sampler
    LIB = vsco_sampler.Library(os.environ["VSCO_DIR"], seed=1894)
    if os.environ.get("PIANO_DIR"):
        PLIB = vsco_sampler.Library(os.environ["PIANO_DIR"], seed=1895, sfz_dir=os.environ["PIANO_DIR"])
    if os.environ.get("GUITAR_DIR"):
        GLIB = vsco_sampler.Library(os.environ["GUITAR_DIR"], seed=1896, sfz_dir=os.environ["GUITAR_DIR"])

# ------------------------------------------------------------------ small helpers
_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def n(name):
    """'F#5' -> MIDI number (C4 = 60)."""
    acc, i = 0, 1
    while name[i] in "#b":
        acc += 1 if name[i] == "#" else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + _PC[name[0]] + acc


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tarr(dur):
    return np.arange(max(1, int(SR * dur))) / SR


def unit(x):
    """scale a steady waveform to unit RMS (so `vel` means the same loudness for every instrument)."""
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-9)


def rel_env(t, dur, rel):
    r = np.clip((dur - t) / max(rel, 1e-3), 0, 1)
    return np.sin(0.5 * np.pi * r)


def att_env(t, att, curve=1.0):
    return np.minimum(1, t / max(att, 1e-3)) ** curve


def fft_lp(x, fc, order=4):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    g = 1 / np.sqrt(1 + (f / fc) ** (2 * order))
    return np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), n=x.shape[0], axis=0)


def fft_hp(x, fc):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    g = (f / fc) ** 2 / (1 + (f / fc) ** 2)
    return np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), n=x.shape[0], axis=0)


def band_noise(dur, lo, hi):
    x = rng.standard_normal(max(64, int(SR * dur)))
    return fft_lp(fft_hp(x, lo), hi, 2)


# ------------------------------------------------------------------ instruments (each returns mono)
def violin(f, dur, vel, att=0.09, rel=0.22, vib=1.0, bright=1.0, glide_from=None, glide=0.13, swell=0.15, noise=0.012):
    """solo violin: bowed harmonic series shaped by body resonances, delayed vibrato that opens up, optional
    portamento from the previous pitch, a little bow noise."""
    t = tarr(dur)
    ft = f * (glide_from / f) ** np.exp(-t / (glide / 3)) if glide_from else np.full_like(t, f)
    rate = 5.3 + 0.25 * np.sin(2 * np.pi * 0.3 * t + rng.uniform(0, 6.28))
    dev = 0.0050 * vib * np.clip((t - 0.2) / 0.5, 0, 1) * np.sin(2 * np.pi * np.cumsum(rate) / SR)
    ph = 2 * np.pi * np.cumsum(ft * (1 + dev)) / SR
    s = 0
    for k in range(1, 17):
        fk = f * k
        if fk > 9000:
            break
        body = 0.45 + 0.85 * np.exp(-((fk - 650) / 420) ** 2) + 0.55 * np.exp(-((fk - 2600) / 900) ** 2)
        s = s + (body / k ** (1.1 / bright)) * np.sin(k * ph)
    s = unit(s)
    wob = 1 + 0.04 * np.sin(2 * np.pi * 0.55 * t + rng.uniform(0, 6.28))
    env = att_env(t, att, 1.2) * (1 + swell * np.sin(np.pi * np.clip(t / dur, 0, 1))) * rel_env(t, dur, rel) * wob
    nz = band_noise(dur, 2500, 7000)[: len(t)] * noise * att_env(t, 0.05)
    return vel * (s * env + nz * env)


def strsec(f, dur, vel, att=1.0, rel=1.2, voices=3, bright=1.0, trem=0.0, tasto=False, slide_to=None):
    """string section: a few detuned voices, each with its own slow vibrato; optional bowed tremolo, sul tasto
    (soft, flautando) and a slide to another pitch."""
    t = tarr(dur)
    s = 0
    expo = (2.3 if tasto else 1.35) / bright
    for v in range(voices):
        det = (v - (voices - 1) / 2) * 0.0075 + rng.normal(0, 0.0008)
        rate = rng.uniform(4.7, 5.8)
        base_f = f * (slide_to / f) ** np.clip(t / dur, 0, 1) if slide_to else np.full_like(t, f)
        inc = base_f * (1 + det) / SR
        ph = 2 * np.pi * np.cumsum(inc) + (0.0032 * f / rate) * np.clip((t - 0.3) / 0.8, 0, 1) * np.sin(2 * np.pi * rate * t + rng.uniform(0, 6.28))
        voice = 0
        for k in range(1, 9):
            if f * k > 9000:
                break
            voice = voice + np.sin(k * ph) / k ** expo
        if trem:
            voice = voice * (1 - trem * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(9, 13) * t + rng.uniform(0, 6.28))))
        s = s + voice
    return vel * unit(s) * att_env(t, att, 1.4) * rel_env(t, dur, rel)


def pizz(f, dur, vel, tau=0.30):
    t = tarr(max(dur, 0.2))
    s = sum((1 / k ** 1.2) * np.sin(2 * np.pi * f * k * (1 + 0.0003 * k * k) * t) * np.exp(-t / (tau / (1 + 0.5 * (k - 1)))) for k in range(1, 9))
    click = np.diff(rng.standard_normal(len(t)), prepend=0) * np.exp(-t / 0.004) * 0.05
    return vel * (s + click) * att_env(t, 0.002) * rel_env(t, len(t) / SR, 0.05)


def cello(f, dur, vel, att=0.28, rel=0.5, vib=1.0):
    t = tarr(dur)
    dev = 0.0045 * vib * np.clip((t - 0.3) / 0.5, 0, 1) * np.sin(2 * np.pi * 5.0 * t + rng.uniform(0, 6.28))
    ph = 2 * np.pi * np.cumsum(f * (1 + dev)) / SR
    s = unit(sum((1 / k ** 1.15) * np.sin(k * ph) for k in range(1, 11)))
    return vel * s * att_env(t, att) * rel_env(t, dur, rel)


def sub(f, dur, vel, att=1.5, rel=1.5):
    t = tarr(dur)
    s = unit(np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t))
    return vel * s * att_env(t, att, 1.5) * rel_env(t, dur, rel)


def horn(f, dur, vel, att=0.20, rel=0.35, bright=1.0):
    """brass-like: louder = brighter (harmonic k grows with env**(1 + 0.4(k-1)))."""
    t = tarr(dur)
    base = att_env(t, att, 1.0) * rel_env(t, dur, rel)
    dev = 0.003 * np.clip((t - 0.4) / 0.6, 0, 1) * np.sin(2 * np.pi * 5.1 * t)
    ph = 2 * np.pi * np.cumsum(f * (1 + dev)) / SR
    s = 0
    for k in range(1, 13):
        if f * k > 6000:
            break
        s = s + (1 / k ** 0.95) * base ** (1 + 0.45 * (k - 1) / bright) * np.sin(k * ph)
    n_ = band_noise(dur, 800, 3000)[: len(t)] * np.exp(-t / 0.06) * 0.03
    return vel * (unit(s) * base + n_)


def clarinet(f, dur, vel, att=0.09, rel=0.2):
    t = tarr(dur)
    dev = 0.002 * np.clip((t - 0.3) / 0.6, 0, 1) * np.sin(2 * np.pi * 5.0 * t)
    ph = 2 * np.pi * np.cumsum(f * (1 + dev)) / SR
    s = sum((1 / k ** 0.9) * np.sin(k * ph) for k in range(1, 14, 2)) + 0.06 * np.sin(2 * ph)
    nz = band_noise(dur, 1500, 5000)[: len(t)] * 0.025
    e = att_env(t, att) * rel_env(t, dur, rel)
    return vel * (unit(s) + nz * np.exp(-t / 0.1)) * e


def reed(f, dur, vel, att=0.10, rel=0.28, formant=1250, vib=1.0):
    """oboe / bassoon-like reed: formant around `formant` Hz, delayed vibrato, breath at the onset."""
    t = tarr(dur)
    dev = 0.005 * vib * np.clip((t - 0.35) / 0.5, 0, 1) * np.sin(2 * np.pi * 5.3 * t + rng.uniform(0, 6.28))
    ph = 2 * np.pi * np.cumsum(f * (1 + dev)) / SR
    s = 0
    for k in range(1, 15):
        fk = f * k
        if fk > 7000:
            break
        s = s + ((0.35 + np.exp(-((fk - formant) / 900) ** 2)) / k ** 0.8) * np.sin(k * ph)
    nz = band_noise(dur, 1200, 4500)[: len(t)] * np.exp(-t / 0.05) * 0.05
    return vel * (unit(s) * att_env(t, att) * rel_env(t, dur, rel) * (1 + 0.05 * np.sin(2 * np.pi * 0.8 * t)) + nz)


def flute(f, dur, vel, att=0.13, rel=0.3):
    t = tarr(dur)
    dev = 0.004 * np.clip((t - 0.4) / 0.6, 0, 1) * np.sin(2 * np.pi * 5.0 * t + rng.uniform(0, 6.28))
    ph = 2 * np.pi * np.cumsum(f * (1 + dev)) / SR
    s = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    nz = band_noise(dur, 3000, 8000)[: len(t)] * 0.03
    return vel * (unit(s) + nz) * att_env(t, att) * rel_env(t, dur, rel)


def harp(f, dur, vel):
    t = tarr(dur)
    s = sum((1 / k ** 1.35) * np.sin(2 * np.pi * f * k * (1 + 0.0003 * k * k) * t) * np.exp(-t / (2.6 / (1 + 0.55 * (k - 1)))) for k in range(1, 9) if f * k < 12000)
    return vel * s * att_env(t, 0.0025) * rel_env(t, dur, 0.4)


def bell(f, dur, vel, kind="celesta", wob=0.0):
    """celesta / music box / tubular bell: inharmonic partials with their own decays. `wob` bends the pitch
    slowly (a music box running down)."""
    table = {
        "celesta": [(1, 1.0, 1.4), (2.0, 0.30, 0.8), (3.99, 0.16, 0.4), (6.0, 0.06, 0.2)],
        "box": [(1, 1.0, 1.0), (2.01, 0.28, 0.6), (4.1, 0.14, 0.3), (6.3, 0.06, 0.15)],
        "tubular": [(1, 1.0, 4.0), (2.0, 0.5, 2.8), (2.41, 0.45, 2.4), (3.0, 0.38, 2.0), (4.2, 0.22, 1.2), (5.4, 0.12, 0.8)],
        "glass": [(1, 1.0, 2.5), (2.76, 0.34, 1.4), (5.4, 0.14, 0.7), (8.9, 0.05, 0.4)],
    }[kind]
    t = tarr(dur)
    bend = 1 + wob * np.sin(2 * np.pi * 2.3 * t) if wob else 1.0
    s = sum(a * np.sin(2 * np.pi * f * r * bend * t) * np.exp(-t / tau) for r, a, tau in table if f * r < 14000)
    return vel * s * att_env(t, 0.002) * rel_env(t, dur, 0.3)


def timp(f, dur, vel):
    t = tarr(dur)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.14 * np.exp(-t / 0.04))) / SR
    s = np.sin(ph) * np.exp(-t / 0.95) + 0.35 * np.sin(1.5 * ph) * np.exp(-t / 0.35)
    click = band_noise(0.03, 300, 3000)
    s[: len(click)] += click * 0.4 * np.exp(-np.arange(len(click)) / (SR * 0.006))
    return vel * s * att_env(t, 0.002) * rel_env(t, dur, 0.2)


def drum_heart(vel):
    """a heartbeat: lub ... dub."""
    t = tarr(0.9)
    one = lambda f0, tau: np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.5 * np.exp(-t / 0.03))) / SR) * np.exp(-t / tau)
    s = one(52, 0.10)
    d = int(0.30 * SR)
    s[d:] += 0.6 * one(46, 0.12)[: len(t) - d]
    y = vel * s * att_env(t, 0.003) * rel_env(t, 0.9, 0.2)
    if LIB is not None:      # a real bass drum, soft and pitched down, so the heart can be heard on small speakers too
        bd = LIB.oneshot("Percussion/BDrumNewhit_v1_rr*.wav", dur=0.6, gain=vel * 0.5 * CAL["bd"], ratio=0.85, rel=0.3)
        out = np.zeros((len(y), 2), np.float32)
        out += (y * 0.7071)[:, None]
        out[: len(bd)] += bd[: len(out)]
        out[d: d + len(bd)] += 0.6 * bd[: len(out) - d]
        return out
    return y


def swell_noise(dur, vel, lo=3500, hi=12000, att=None, tau=None):
    """cymbal / tam-tam: noise that grows (att) or crashes and decays (tau)."""
    t = tarr(dur)
    x = unit(band_noise(dur, lo, hi)[: len(t)])
    if att:
        e = (np.clip(t / att, 0, 1) ** 2.2) * rel_env(t, dur, 0.25)
    else:
        e = np.exp(-t / (tau or 1.2)) * att_env(t, 0.004)
    return vel * x * e


def choir(f, dur, vel, vowel="ah", att=1.2, rel=1.8):
    """a choir of five singers, each with its own tuning (a few cents), vibrato rate, vowel colour and entry time,
    plus the breath that always goes with voices."""
    F = {"ah": [(800, 1.0, 120), (1150, 0.5, 150), (2900, 0.16, 250)], "oh": [(450, 1.0, 110), (800, 0.6, 130), (2830, 0.1, 250)]}[vowel]
    t = tarr(dur)
    s = 0
    for _ in range(5):
        det = 2 ** (float(np.clip(rng.normal(0, 7), -12, 12)) / 1200)
        rate = rng.uniform(4.9, 6.3)
        shade = rng.uniform(0.94, 1.06)
        tt = np.clip(t - rng.uniform(0, 0.05), 0, None)
        ph = 2 * np.pi * f * det * tt + (0.0035 * f / rate) * np.clip((tt - 0.4) / 0.8, 0, 1) * np.sin(2 * np.pi * rate * tt + rng.uniform(0, 6.28))
        for k in range(1, 30):
            fk = f * k
            if fk > 4500:
                break
            w = sum(a * np.exp(-((fk - c * shade) / (2.5 * bw)) ** 2) for c, a, bw in F) + 0.04
            s = s + (w / k ** 0.6) * np.sin(k * ph)
    s = unit(s)
    breath = unit(band_noise(dur, 700, 3500)[: len(t)]) * 0.07
    y = vel * (s + breath) * att_env(t, att, 1.5) * rel_env(t, dur, rel)
    return fft_lp(y, 3500, 2)        # the synthesised voices lose their buzzy top end, so they sit behind the recorded organ and horns


def caw(vel):
    """a crow, far away: a buzzy downward glide through a nasal formant."""
    dur = rng.uniform(0.13, 0.20)
    t = tarr(dur)
    f0 = rng.uniform(380, 520)
    ph = 2 * np.pi * np.cumsum(f0 * (1 - 0.35 * t / dur)) / SR
    s = sum(np.sin(k * ph + 0.4 * np.sin(2 * np.pi * 90 * t)) * np.exp(-((f0 * k - 1100) / 700) ** 2) / k ** 0.5 for k in range(1, 14))
    return vel * unit(s) * att_env(t, 0.012) * rel_env(t, dur, 0.06)


# ------------------------------------------------------------------ real recordings (only when VSCO_DIR is set)
# Every name below keeps the signature of its synthesised twin, so the score does not care which one it gets.
# A recorded note is chosen by pitch and by dynamic layer, re-pitched, looped if it must be held longer than the
# recording, and layered twice (a few cents apart, a few ms late) for a section so that it sounds like many players.
_synth = dict(violin=violin, strsec=strsec, pizz=pizz, cello=cello, horn=horn, clarinet=clarinet, reed=reed,
              flute=flute, harp=harp, bell=bell, timp=timp)

# loudness of each recording relative to its synthesised twin at the same `vel` (measured on a few pitches, then
# trimmed by hand); this keeps the balance the mix had before the recordings were introduced.
CAL = dict(violin=1.08, strsec=1.06, cello=1.0, horn=1.12, clarinet=1.05, reed=0.92, flute=1.0, harp=0.72, pizz=0.30,
           timp=0.40, tubular=0.86, glock=0.53, spic=0.31, organ=1.18, tuba=1.15, trombone=1.15, trumpet=1.03,
           roll=2.0, crash=1.5, gong=0.80, bd=0.50, belltree=0.40)


def _midi(f):
    return 69 + 12 * np.log2(f / 440.0)


FALLBACK = {}


def _fb(name, f, *args):
    """the synthesised twin (where a note lies outside the recorded range); counted, so the report can say how often."""
    if LIB is not None:
        key = (name, int(round(_midi(f))))
        FALLBACK[key] = FALLBACK.get(key, 0) + 1
    return _synth[name](f, *args)


def _v127(vel, bright=1.0, soft=False):
    """instrument loudness (the synth's `vel`) -> which recorded dynamic layer to use."""
    v = 30 + 160 * vel * bright ** 0.8
    return int(np.clip(min(v, 52) if soft else v, 1, 127))


def _layers(inst, m, dur, v127, att, rel, k, gain, curve=None, spread=(3.0, 8.0), scatter=0.025):
    """k copies of the same note: a few cents apart, a few ms late, picked from different recordings."""
    nout = max(8, int(round(dur * SR)))
    acc = np.zeros((nout, 2), np.float32)
    for i in range(k):
        cents = 0.0 if k == 1 else (1 if i % 2 == 0 else -1) * rng.uniform(*spread)
        delay = 0.0 if i == 0 else rng.uniform(0.008, scatter)
        d = max(0.05, dur - delay)
        rc = None if curve is None else curve(np.arange(max(8, int(round(d * SR)))) / SR)
        y = inst.play(m, d, v127, att=att, rel=rel, cents=cents, ratio_curve=rc, gain=gain / np.sqrt(k) * (1.0 if i == 0 else 0.85))
        if y is None:
            return None
        s = int(delay * SR)
        e = min(nout, s + len(y))
        acc[s:e] += y[: e - s]
    return acc


_SEC_SUS = [(66, "ViolinEnsSusVib"), (52, "ViolaEnsSusVib"), (36, "CelloEnsSusVib"), (0, "ContrabassSusVB")]
_SEC_TREM = [(66, "ViolinEnsTrem"), (52, "ViolaEnsTrem"), (36, "CelloEnsTrem")]


def _section(m, trem):
    for lo, name in (_SEC_TREM if trem else _SEC_SUS):
        if m >= lo:
            inst = LIB.inst(name)
            if inst.covers(m):
                return inst
            return LIB.inst("SViolinVib") if m > inst.hi else None
    inst = LIB.inst("ContrabassSusVB")
    return inst if inst.covers(m) else None


def violin(f, dur, vel, att=0.09, rel=0.22, vib=1.0, bright=1.0, glide_from=None, glide=0.13, swell=0.15, noise=0.012):
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("SViolinVib")
        if inst.covers(m):
            curve = None if not glide_from else (lambda t: (glide_from / f) ** np.exp(-t / (glide / 3)))
            y = _layers(inst, m, dur, _v127(vel, bright), att, rel, 1, vel * CAL["violin"], curve)
            t = np.arange(len(y)) / SR
            return y * (1 + swell * np.sin(np.pi * np.clip(t / dur, 0, 1)))[:, None].astype(np.float32)
    return _fb("violin", f, dur, vel, att, rel, vib, bright, glide_from, glide, swell, noise)


def strsec(f, dur, vel, att=1.0, rel=1.2, voices=3, bright=1.0, trem=0.0, tasto=False, slide_to=None, pont=False):
    """string section. `tasto`: soft and dark (sul tasto). `pont`: glassy tremolo near the bridge (sul ponticello)."""
    if LIB is not None:
        m = _midi(f)
        inst = _section(m, trem >= 0.3 or pont)
        if inst is not None:
            mb = float(np.clip(m, inst.lo, inst.hi + 2))
            curve = None
            if slide_to:
                fb = hz(mb)
                curve = lambda t: f * (slide_to / f) ** np.clip(t / dur, 0, 1) / fb
            y = _layers(inst, mb, dur, _v127(vel, bright, soft=tasto), att, rel, 2 if voices >= 2 else 1, vel * CAL["strsec"], curve)
            if tasto:
                y = fft_lp(y, 3800, 2)
            if pont:
                y = y + 1.6 * fft_hp(y, 3200)
            return y.astype(np.float32)
    return _fb("strsec", f, dur, vel, att, rel, voices, bright, trem, tasto, slide_to)


def pizz(f, dur, vel, tau=0.30):
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("ViolinEnsPizz" if m >= 55 else "CelloEnsPizz", sustained=False, norm="head")
        if inst.covers(m):
            return inst.play(m, max(dur, 0.25), _v127(vel * 2), rel=0.06, gain=vel * CAL["pizz"])
    return _fb("pizz", f, dur, vel, tau)


def cello(f, dur, vel, att=0.28, rel=0.5, vib=1.0):
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("CelloEnsSusVib" if m >= 34 else "ContrabassSusVB")
        if inst.covers(m):
            return _layers(inst, m, dur, _v127(vel), att, rel, 1, vel * CAL["cello"])
    return _fb("cello", f, dur, vel, att, rel, vib)


def _brass(name, cal, f, dur, vel, att, rel, bright, k=2):
    m = _midi(f)
    inst = LIB.inst(name)
    if not inst.covers(m):
        return None
    return _layers(inst, m, dur, _v127(vel, bright), att, rel, k, vel * CAL[cal], spread=(3.0, 6.0), scatter=0.02)


def horn(f, dur, vel, att=0.20, rel=0.35, bright=1.0):
    if LIB is not None:
        y = _brass("FHornSus", "horn", f, dur, vel, att, rel, bright)
        if y is None:                                     # above the horn's recorded range: the trumpets take the shout
            y = _brass("TrumpetSus", "trumpet", f, dur, vel, att, rel, bright)
        if y is not None:
            return y
    return _fb("horn", f, dur, vel, att, rel, bright)


def tuba(f, dur, vel, att=0.25, rel=0.4, bright=1.0):
    y = _brass("TubaSus", "tuba", f, dur, vel, att, rel, bright, k=1) if LIB is not None else None
    return y if y is not None else _fb("horn", f, dur, vel, att, rel, bright)


def trombone(f, dur, vel, att=0.2, rel=0.4, bright=1.0):
    y = _brass("TromboneSus", "trombone", f, dur, vel, att, rel, bright) if LIB is not None else None
    return y if y is not None else _fb("horn", f, dur, vel, att, rel, bright)


def clarinet(f, dur, vel, att=0.09, rel=0.2):
    if LIB is not None and dur >= 0.15:
        m = _midi(f)
        inst = LIB.inst("ClarinetSus")
        if inst.covers(m):
            return _layers(inst, m, dur, _v127(vel), att, rel, 1, vel * CAL["clarinet"])
    return _fb("clarinet", f, dur, vel, att, rel)


def reed(f, dur, vel, att=0.10, rel=0.28, formant=1250, vib=1.0):
    """oboe (bassoon below the oboe's range)."""
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("OboeSusVib" if m >= 58 else "BassoonVib")
        if inst.covers(m):
            return _layers(inst, m, dur, _v127(vel), att, rel, 1, vel * CAL["reed"])
    return _fb("reed", f, dur, vel, att, rel, formant, vib)


def flute(f, dur, vel, att=0.13, rel=0.3):
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("FluteSusVib")
        if inst.covers(m):
            return _layers(inst, m, dur, _v127(vel), att, rel, 1, vel * CAL["flute"])
    return _fb("flute", f, dur, vel, att, rel)


def harp(f, dur, vel):
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("Harp", sustained=False, norm="head", autotune=True, up=7)
        if inst.covers(m):
            return inst.play(m, dur, 100, rel=0.4, gain=vel * CAL["harp"])
    return _fb("harp", f, dur, vel)


def timp(f, dur, vel):
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("Timpani", sustained=False, norm="head", up=4, down=7)
        if inst.covers(m):
            return inst.play(m, dur, _v127(vel * 1.2), rel=0.2, gain=vel * CAL["timp"])
    return _fb("timp", f, dur, vel)


def bell(f, dur, vel, kind="celesta", wob=0.0):
    if LIB is not None and kind == "tubular":
        m = _midi(f)
        inst = LIB.inst("TubularBells", sustained=False, norm="head", up=7, down=7)
        if inst.covers(m):
            return inst.play(m, dur, 100, rel=0.3, gain=vel * CAL["tubular"])
    return _synth["bell"](f, dur, vel, kind, wob)


def glock(f, dur, vel):
    """glockenspiel (a celesta bell where there is no recording)."""
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("Glockenspiel", sustained=False, norm="head", up=0, down=0)
        if inst.covers(m):
            return inst.play(m, dur, 100, rel=0.3, gain=vel * CAL["glock"])
    return _fb("bell", f, dur, vel, "celesta", 0.0)


def organ(f, dur, vel, att=0.6, rel=1.2):
    """pipe organ, the gothic colour."""
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("OrganLoud")
        if inst.covers(m):
            return inst.play(m, dur, 100, att=att, rel=rel, gain=vel * CAL["organ"])
    t = tarr(dur)
    s = sum(a * np.sin(2 * np.pi * f * r * t) for r, a in ((0.5, 0.5), (1, 1.0), (2, 0.6), (3, 0.3), (4, 0.4), (6, 0.15)) if f * r < 9000)
    return vel * unit(s) * att_env(t, att) * rel_env(t, dur, rel)


def spicc(f, dur, vel, cello_=False):
    """spiccato: a short, bouncing bow stroke (violin section, or cellos)."""
    if LIB is not None:
        m = _midi(f)
        inst = LIB.inst("CelloEnsSpic" if cello_ else "ViolinEnsSpic", sustained=False, norm="head")
        if inst.covers(m):
            return inst.play(m, max(dur, 0.12), _v127(vel * 2), rel=0.04, gain=vel * CAL["spic"])
    return _fb("pizz", f, max(dur, 0.12), vel, 0.12)


def colleg(f, vel):
    """col legno battuto: the wood of the bow tapping the string, a dry 'tak' with a faint pitch."""
    dur = 0.22
    t = tarr(dur)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.045) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.02)
    tick = band_noise(0.02, 1500, 6500)
    s[: len(tick)] += tick * 0.9 * np.exp(-np.arange(len(tick)) / (SR * 0.004))
    return vel * s * att_env(t, 0.001) * rel_env(t, dur, 0.05)




# ------------------------------------------------------------------ the three new voices of the study track
# piano (Splendid Grand Piano), guitar (Gretsch, Black And Green Guitars) and a flute with a little more air ("sao").
# Same rule as above: each keeps the signature of a synthesised twin that plays when the sample set is missing.
def piano_synth(f, dur, vel, rel=0.35):
    """a plain additive piano: slightly stretched partials, the high ones dying first, a felt-hammer thump."""
    dur = max(dur, 0.2)
    t = tarr(dur)
    tau = 3.2 * (110.0 / max(f, 80.0)) ** 0.45
    s = sum((1 / k ** 1.05) * np.sin(2 * np.pi * f * k * np.sqrt(1 + 0.00035 * k * k) * t) * np.exp(-t / (tau / (1 + 0.6 * (k - 1))))
            for k in range(1, 12) if f * k < 9000)
    thump = band_noise(0.03, 200, 1800)
    s[: len(thump)] += thump * 0.25 * np.exp(-np.arange(len(thump)) / (SR * 0.008))
    return vel * unit(s) * att_env(t, 0.003) * rel_env(t, len(t) / SR, rel) * np.exp(-t / (tau * 2.2)) * 1.6


def guitar_synth(f, dur, vel, rel=0.18):
    """a plucked string: harmonics in a 1/k fall, brighter at the pluck and then mellowing, a short pick click."""
    dur = max(dur, 0.2)
    t = tarr(dur)
    s = sum((1 / k ** 1.1) * np.sin(2 * np.pi * f * k * (1 + 0.0002 * k * k) * t) * np.exp(-t / (1.4 / (1 + 0.8 * (k - 1))))
            for k in range(1, 14) if f * k < 9000)
    click = np.diff(rng.standard_normal(len(t)), prepend=0) * np.exp(-t / 0.003) * 0.05
    return vel * unit(s + click) * att_env(t, 0.002) * rel_env(t, len(t) / SR, rel) * np.exp(-t / 1.6) * 1.8


_synth["piano"] = piano_synth
_synth["guitar"] = guitar_synth
CAL.update(piano=0.80, guitar=0.62)


def _vk(vel):
    """loudness of the score (`vel` ~ 0.05-0.45) -> velocity of the recorded piano / guitar, i.e. which dynamic layer."""
    return int(np.clip(25 + 230 * vel, 1, 127))


def piano(f, dur, vel, rel=0.35):
    if PLIB is not None:
        m = _midi(f)
        inst = PLIB.inst("piano", sustained=False, norm="head", up=3, down=3)
        if inst.covers(m):
            return inst.play(m, max(dur, 0.2), _vk(vel), rel=rel, gain=vel * CAL["piano"])
    return _fb("piano", f, dur, vel, rel)


def guitar(f, dur, vel, rel=0.18):
    if GLIB is not None:
        m = _midi(f)
        inst = GLIB.inst("gretsch", sustained=False, norm="head", up=0, down=0)
        if inst.covers(m):
            y = inst.play(m, max(dur, 0.2), _vk(vel), rel=rel, gain=vel * CAL["guitar"])
            return fft_lp(y, 3400, 1).astype(np.float32)      # a hollow-body with the tone knob rolled back: warm, not glassy
    return _fb("guitar", f, dur, vel, rel)


def sao(f, dur, vel, att=0.16, rel=0.35):
    """the flute with a rounder, breathier voice (a bamboo flute is not in any free sample set): the recorded flute,
    its top rolled off, a little breath noise on the onset."""
    y = flute(f, dur, vel, att=att, rel=rel)
    y = fft_lp(y, 5200, 1)
    t = np.arange(len(y)) / SR
    nz = band_noise(len(y) / SR + 0.05, 2200, 6500)[: len(y)] * 0.035 * vel * np.exp(-t / 0.18) * att_env(t, 0.04)
    if y.ndim == 2:
        y = y + nz[:, None]
    else:
        y = y + nz
    return y.astype(np.float32)
LILT_K = 0.5       # strength of the Viennese lilt for the accompaniment (1.0 = the first version: beat 2 ~62-75 ms early)
MEL_LILT = 0.4     # the melody follows only this fraction of the accompaniment's lilt


class Scene:
    def __init__(self, name, beats, bpms, wet, level, story, lilt=None):
        self.name, self.beats, self.bpms, self.wet, self.level, self.story = name, beats, list(bpms), wet, level, story
        self.t0 = 0.0
        self.bar_sec = [beats * 60.0 / b for b in self.bpms]
        self.length = sum(self.bar_sec)
        # Viennese waltz: the three beats of a bar are not equal. Measured recordings of the Blue Danube (Yang 2022)
        # give about 1 : 1.2 : 1.1 for Viennese playing against 1 : 1.15 : 1.16 for other orchestras, i.e. the second
        # beat arrives early. `lilt` are those weights; the bar keeps its length.
        self.cum = None
        if lilt:
            w = 1 + LILT_K * (np.array(lilt, float) - 1)
            self.cum = np.concatenate([[0.0], np.cumsum(w)]) / w.sum() * beats
            self.lilt_w = w / w.sum() * beats

    def warp(self, beat, amt=1.0):
        if self.cum is None:
            return beat
        k = min(int(beat), self.beats - 1)
        return beat + amt * (self.cum[k] + (beat - k) * self.lilt_w[k] - beat)

    def time(self, bar, beat=0.0, amt=1.0):
        while beat >= self.beats:
            beat -= self.beats
            bar += 1
        i = min(bar, len(self.bar_sec) - 1)
        starts = self.t0 + sum(self.bar_sec[:i]) + max(0, bar - i) * self.bar_sec[-1]
        return starts + self.warp(beat, amt) * self.bar_sec[i] / self.beats

    def dur(self, bar, beat, d):
        return self.time(bar, beat + d) - self.time(bar, beat)


def S(name, beats, bpms, bars, wet, level, story, lilt=None):
    if np.isscalar(bpms):
        bpms = [bpms] * bars
    return Scene(name, beats, bpms, wet, level, story, lilt)



# ------------------------------------------------------------------ timeline: 50 phrases of 8 bars, one steady 3/4
BPM = 80.0
NPH = 50
PH_BARS = 8
LILT = (1.0, 1.12, 1.05)      # the second beat arrives a little early (the Viennese lilt), about half as much as in gen-ballet-swan.py

# the dynamic arc (phrase index -> loudness of the writing, multiplied into every note) and the reverb send
ARC_LEVEL = [(0, .30), (3, .40), (6, .50), (8, .58), (36, .60), (38, .64), (40, .70), (41, .74), (42, .78), (43, .78),
             (44, .68), (45, .60), (46, .54), (47, .44), (48, .36), (49, .30)]
ARC_WET = [(0, 1.0), (6, .85), (9, .65), (36, .65), (40, .55), (43, .55), (45, .75), (49, 1.0)]


def _interp(pts, p):
    return float(np.interp(p, [a for a, _ in pts], [b for _, b in pts]))


STORY = [(0, "I · Vào việc · mặt hồ lúc nửa đêm"), (4, "I · Vào việc · lời nguyền trở về (si thứ)"), (7, "II · Tập trung · guitar và hạc cầm"),
         (13, "II · Tập trung · piano"), (19, "II · Tập trung · dàn dây"), (25, "II · Tập trung · gió gỗ"),
         (31, "II · Tập trung · tất cả, rất khẽ"), (37, "III · Nước rút · dâng lên"), (42, "III · Nước rút · hừng đông (si trưởng)"),
         (45, "IV · Hạ cánh · tắt dần"), (47, "IV · Hạ cánh · chỉ còn quãng năm trống")]


def _story(p):
    s = STORY[0][1]
    for a, t in STORY:
        if p >= a:
            s = t
    return s


PHR_RANGE = range(*(WINDOW if WINDOW else (0, NPH)))
SCENES = [Scene("P%02d" % p, 3, [BPM] * PH_BARS, _interp(ARC_WET, p) * (0.6 if LIB is not None else 1.0), _interp(ARC_LEVEL, p), _story(p), LILT)
          for p in PHR_RANGE]
T = 0.0
for sc in SCENES:
    sc.t0 = T
    T += sc.length
TOTAL = T + (3.0 if SOLO else 0.0)
N = int(round(TOTAL * SR))
if not SOLO:
    assert N == 39690000, N          # exactly 15:00.000 at 44.1 kHz
BUS = {k: np.zeros((N, 2), np.float32) for k in ("lead", "orch", "harp", "keys", "perc", "choir")}
SEND = {"lead": 0.55, "orch": 0.50, "harp": 0.60, "keys": 0.42, "perc": 0.35, "choir": 0.95}
RIDE = 0.28      # gain riding: just enough to even out a note that stands out; the arc itself is the story and must survive
WET_GATES = []
GAIN = {"lead": 1.0, "orch": 1.0, "harp": 1.0, "keys": 1.0, "perc": 1.0, "choir": 0.7}
def put(bus, sig, pan_pos, t_sec, scale=1.0):
    if sig is None:
        return
    th = pan_pos * np.pi / 2
    if sig.ndim == 2:      # a stereo recording keeps its own image; pan_pos then works as a balance control
        gains = np.array([min(1.0, np.sqrt(2) * np.cos(th)), min(1.0, np.sqrt(2) * np.sin(th))], np.float32)
        st = (sig * gains).astype(np.float32) * scale
    else:
        st = np.stack([sig * np.cos(th), sig * np.sin(th)], 1).astype(np.float32) * scale
    s = int(round(t_sec * SR)) % N
    e = s + len(st)
    b = BUS[bus]
    if e <= N:
        b[s:e] += st
    else:
        k = N - s
        b[s:] += st[:k]
        b[: e - N] += st[k:]


_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def transpose(text, semis):
    """'D5:1 r:2 A5:1' -> the same melody `semis` semitones away."""
    out = []
    for tok in text.split():
        nm, rest = tok.split(":", 1)
        if nm != "r":
            m = n(nm) + semis
            nm = _NAMES[m % 12] + str(m // 12 - 1)
        out.append(nm + ":" + rest)
    return " ".join(out)


TOK = re.compile(r"^([A-Ga-gr][#b]?\d?):([0-9.]+)([a-z]*)$")


def voice(inst, bus, pan_pos, sc, bar, beat, text, vel, **kw):
    """play a melody written as 'B4:1.5 D5:.5 F#5:2'. Flags after the length: s staccato, a accent, p soft,
    g glide up/down from the previous note, l legato (a little longer)."""
    pos, prev = beat, None
    for tok in text.split():
        m = TOK.match(tok.replace(":.", ":0."))
        assert m, tok
        name, d, flags = m.group(1), float(m.group(2)), m.group(3)
        if name != "r":
            f = hz(n(name))
            secs = sc.dur(bar, pos, d) * (0.55 if "s" in flags else 1.0) + (0.07 if "l" in flags else 0.0)
            v = vel * (1.3 if "a" in flags else 1.0) * (0.7 if "p" in flags else 1.0) * sc.level
            kk = dict(kw)
            if "g" in flags and prev:
                kk["glide_from"] = hz(prev)
            put(bus, inst(f, secs, v * rng.uniform(0.95, 1.05), **kk), pan_pos, sc.time(bar, pos, MEL_LILT) + rng.normal(0, 0.006))
            prev = n(name)
        pos += d


def pad(inst, sc, bar, beat, notes, beats, vel, lead=0.2, spread=(0.30, 0.70), bus="orch", **kw):
    """sustain a chord; each note is panned a little differently so the section has width."""
    names = notes.split()
    for i, nm in enumerate(names):
        p = spread[0] + (spread[1] - spread[0]) * (i / max(1, len(names) - 1))
        secs = sc.dur(bar, beat, beats) + lead
        put(bus, inst(hz(n(nm)), secs, vel * sc.level * rng.uniform(0.95, 1.05), **kw), p, sc.time(bar, beat) - lead + rng.normal(0, 0.012))


def one(inst, bus, pan_pos, sc, bar, beat, name, secs, vel, **kw):
    put(bus, inst(hz(n(name)), secs, vel * sc.level, **kw), pan_pos, sc.time(bar, beat))


def gliss(sc, bar, beat, names, step, vel, pan_pos=0.5, bus="harp"):
    """a harp glissando: the notes (in order) `step` seconds apart."""
    t0 = sc.time(bar, beat)
    for i, nm in enumerate(names.split()):
        put(bus, harp(hz(n(nm)), 2.6, vel * sc.level * (0.8 + 0.2 * np.sin(i))), 0.25 + 0.5 * (i / max(1, len(names.split()) - 1)), t0 + i * step)


def roll(sc, bar, beat, secs, name, v0, v1, bus="perc", gap=0.075):
    """a timpani roll that grows from v0 to v1 (a recorded roll when the library is there)."""
    t0 = sc.time(bar, beat)
    if LIB is not None and LIB.inst("TimpaniRolls", up=4, down=7).covers(n(name)):
        tail = 0.5
        y = LIB.inst("TimpaniRolls", up=4, down=7).play(n(name), secs + tail, _v127(v1 * 1.2), rel=tail, gain=CAL["roll"])
        x = np.clip(np.arange(len(y)) / SR / secs, 0, 1)
        put(bus, y * ((v0 + (v1 - v0) * x ** 1.3) * sc.level)[:, None].astype(np.float32), 0.5, t0)
        return
    k = int(secs / gap)
    for i in range(k):
        x = i / max(1, k - 1)
        v = (v0 + (v1 - v0) * x ** 1.3) * sc.level
        put(bus, timp(hz(n(name)), 0.9, v), 0.42 + 0.16 * (i % 2), t0 + i * gap * rng.uniform(0.9, 1.1))


def sparkle(sc, bar, beat, names, k, span, vel, kind="celesta", bus="harp", dur=2.4):
    pool = names.split()
    t0 = sc.time(bar, beat)
    for _ in range(k):
        nm = pool[rng.integers(len(pool))]
        put(bus, bell(hz(n(nm)), dur, vel * sc.level * rng.uniform(0.6, 1.1), kind), rng.uniform(0.1, 0.9), t0 + rng.uniform(0, span))


def crows(sc, bar, beat, secs, vel, k):
    t0 = sc.time(bar, beat)
    for _ in range(k):
        put("lead", caw(vel * sc.level * rng.uniform(0.5, 1.0)), rng.uniform(0.05, 0.95), t0 + rng.uniform(0, secs))


def _peak_time(y):
    """seconds from the start to the loudest moment of a recording (0.1 s smoothing)."""
    e = np.abs(y).max(axis=1)
    k = SR // 10
    e = np.convolve(e, np.ones(k) / k, mode="same")
    return float(np.argmax(e)) / SR


def noise_at(sc, bar, beat, secs, vel, att=None, tau=None, lo=3500, hi=12000):
    """a cymbal swell (att) or crash (tau) at a point in the score: recorded cymbals when the library is there."""
    t0 = sc.time(bar, beat)
    if LIB is not None:
        v = vel * sc.level
        if att:
            kind = "Long" if secs > 4 else "Median" if secs > 2 else "Short"
            y = LIB.oneshot("Percussion/susCymb1-cresc-%s_v1.wav" % kind, gain=1.2 * v / 0.1, rel=0.8, tail_after_peak=2.5, norm="raw")
            put("perc", y, 0.5, t0 + att - _peak_time(y))               # the swell peaks where the score says
        else:
            layer = "ff" if v > 0.22 else "mf" if v > 0.12 else "mp" if v > 0.07 else "pp"
            put("perc", LIB.oneshot("Percussion/cymbal-crash1_%s_rr*.wav" % layer, dur=6.0, gain=CAL["crash"], rel=0.8, norm="raw"), 0.5, t0)
        return
    put("perc", swell_noise(secs, vel * sc.level, lo, hi, att=att, tau=tau), 0.5, t0)


def hit(sc, bar, beat, pattern, vel, pan_pos=0.5, bus="perc", kind="crash", dur=5.0, **kw):
    """a one-shot recording (gong, bass drum, bell tree...). Nothing happens without the library."""
    if LIB is not None:
        put(bus, LIB.oneshot(pattern, dur=dur, gain=vel * sc.level * CAL[kind], **kw), pan_pos, sc.time(bar, beat))


def sub_drop(sc, bar, beat, f0, f1, secs, vel):
    """a sine that falls from f0 to f1 Hz (the floor of the tower dropping away). Kept above ~45 Hz: phones and
    laptop speakers cannot play lower, and it would only eat the headroom of everything else."""
    t = tarr(secs)
    f = f0 * (f1 / f0) ** np.clip(t / secs, 0, 1)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    put("orch", vel * sc.level * unit(s) * att_env(t, 0.01) * np.exp(-t / (secs * 0.6)) * rel_env(t, secs, 0.2), 0.5, sc.time(bar, beat))


def arp16(sc, bar, beat, notes, count, vel, step=0.25, bus="harp"):
    """a harp arpeggio in sixteenths: the chord's notes run up and back down."""
    seq = notes.split()
    seq = seq + seq[-2:0:-1]
    for i in range(count):
        p = 0.30 + 0.40 * (i % len(seq)) / max(1, len(seq) - 1)
        one(harp, bus, p, sc, bar, beat + i * step, seq[i % len(seq)], 2.4, vel * (1.25 if i % 4 == 0 else 1.0) * rng.uniform(0.9, 1.1))


def octatonic_into(sc, bar, beat, target, steps, vel, pan_pos=0.45, bus="orch"):
    """eight quick notes of the octatonic scale (half step, whole step, ...) that land on `target`: the strings
    glitter their way into the next phrase."""
    t = n(target)
    for j, off in enumerate((-10, -9, -7, -6, -4, -3, -1, 0)):
        put(bus, spicc(hz(t + off), 0.12, vel * sc.level * (0.8 + 0.04 * j)), pan_pos, sc.time(bar, beat + j * steps))


def wholetone(sc, bar, beat, start, count, step, vel, pan_pos=0.65):
    """a whole-tone run: celesta with a low flute breathing under it (the 'fairy dust' of an old fairy tale)."""
    m0 = n(start)
    for j in range(count):
        tt = sc.time(bar, beat + j * step)
        put("harp", bell(hz(m0 + 2 * j), 2.0, vel * sc.level * (0.8 + 0.2 * j / count)), pan_pos, tt)
        put("lead", flute(hz(m0 + 2 * j - 12), 0.32, 0.6 * vel * sc.level), pan_pos - 0.1, tt)


def runs(sc, bar, beat, secs, vel, k, lo="B3", hi="B5"):
    """a swarm of fast chromatic woodwind runs (the black birds)."""
    t0 = sc.time(bar, beat)
    for _ in range(k):
        start = rng.integers(n(lo), n(hi) - 8)
        direction = rng.choice([-1, 1])
        t = t0 + rng.uniform(0, secs)
        p = rng.uniform(0.1, 0.9)
        for j in range(rng.integers(5, 9)):
            m = start + direction * j
            put("orch", spicc(hz(m), 0.09, 1.3 * vel * sc.level * rng.uniform(0.7, 1.0)) if LIB is not None
                else clarinet(hz(m), 0.09, vel * sc.level * rng.uniform(0.7, 1.0)), p, t + j * 0.075)



# ------------------------------------------------------------------ the music
SC = {s.name: s for s in SCENES}

PROGS = {
    "INTRO_A": ["A", "F#m", "D", "E"],      # the progression from the reference song, as written
    "REF_D": ["D", "Bm", "G", "A"],         # the same shape (I-vi-IV-V) in D major
    "HOME": ["Bm", "G", "D", "A"],          # its rotation: the home of the curse
    "TURN": ["Em", "Bm", "G", "F#"],        # ends on the dominant, A# leans back into B minor
    "DAWN": ["B", "G#m", "E", "F#"],        # the same shape in B major
    "LAND": ["B5", "B5", "B5", "B5"],       # the open fifth
}
# chord -> (bass, triad, the three-step falling cell played by the pulse, arpeggio notes low to high)
CH = {
    "A": ("A2", "A3 C#4 E4", "C#5 B4 A4", "A3 E4 A4 C#5 E5"),
    "F#m": ("F#2", "F#3 A3 C#4", "C#5 B4 A4", "F#3 C#4 F#4 A4 C#5"),
    "D": ("D3", "D4 F#4 A4", "F#5 E5 D5", "D3 A3 D4 F#4 A4"),
    "E": ("E2", "E3 G#3 B3", "B4 A4 G#4", "E3 B3 E4 G#4 B4"),
    "Bm": ("B2", "B3 D4 F#4", "F#5 E5 D5", "B2 F#3 B3 D4 F#4"),
    "G": ("G2", "G3 B3 D4", "G5 F#5 E5", "G2 D3 G3 B3 D4"),
    "Em": ("E2", "E3 G3 B3", "B4 A4 G4", "E3 B3 E4 G4 B4"),
    "F#": ("F#2", "F#3 A#3 C#4", "C#5 B4 A#4", "F#2 C#3 F#3 A#3 C#4"),
    "B": ("B2", "B3 D#4 F#4", "D#5 C#5 B4", "B2 F#3 B3 D#4 F#4"),
    "G#m": ("G#2", "G#3 B3 D#4", "D#5 C#5 B4", "G#2 D#3 G#3 B3 D#4"),
    "B5": ("B2", "B3 F#4", "F#5 E5 B4", "B2 F#3 B3 F#4 B4"),
}
# melodies, one line per chord (6 beats each = 2 bars of 3/4)
MEL = {
    "INTRO_A": ["E5:1.5 C#5:.5 A4:1 B4:1.5 C#5:1.5",            # over A
                "A4:1 C#5:.5 F#5:1.5 E5:1.5 C#5:1.5",           # F#m
                "B4:1 D5:.5 F#5:1.5 E5:1.5 D5:.5 C#5:1",        # D: the head of CURSE (B-D-F#) hidden in a major chord
                "G#5:1.5 E5:.5 B4:1 C#5:1.5 B4:1.5"],           # E
    "CURSE_HOME": ["B4:1 D5:.5 F#5:1.5 E5:1.5 D5:.5 C#5:1",
                   "D5:1 B4:.5 G4:1.5 A4:1 B4:2",
                   "F#5:1.5 A5:.5 F#5:1 E5:1.5 D5:1.5",
                   "C#5:1.5 E5:.5 C#5:1 B4:1 A4:2"],
    "CURSE_TURN": ["G4:1 B4:.5 E5:1.5 D5:1.5 B4:1.5",
                   "B4:1 D5:.5 F#5:1.5 E5:1.5 D5:.5 C#5:1",
                   "D5:1.5 B4:1 D5:.5 G5:1.5 F#5:1.5",
                   "C#5:1.5 A#4:1 C#5:.5 A#4:3"],              # hangs on the leading tone
    "LOVE_REF_D": ["A4:1 D5:2 F#5:2 E5:1",
                   "D5:1.5 B4:.5 D5:1 F#5:1.5 E5:1.5",
                   "G5:2 F#5:1 E5:1.5 D5:1.5",
                   "C#5:1.5 E5:1.5 C#5:1 A4:2"],
    "MOTTO_DAWN": ["B4:.5 D#5:.5 F#5:.5 B5:2 F#5:1 D#5:1.5",
                   "G#5:1.5 F#5:.5 D#5:1 B4:1.5 D#5:1.5",
                   "E5:1 G#5:.5 B5:1.5 A5:1.5 G#5:1.5",
                   "A#5:1.5 C#6:.5 B5:1 F#5:3"],
}
MELKEY = {"INTRO_A": "INTRO_A", "HOME": "CURSE_HOME", "TURN": "CURSE_TURN", "REF_D": "LOVE_REF_D", "DAWN": "MOTTO_DAWN"}


def shift(text, semis):
    """a melody ('B4:1.5 r:1') or a list of note names ('B3 D4 F#4'), `semis` semitones away."""
    if not semis:
        return text
    out = []
    for tok in text.split():
        nm, sep, rest = tok.partition(":")
        if nm != "r":
            m = n(nm) + semis
            nm = _NAMES[m % 12] + str(m // 12 - 1)
        out.append(nm + sep + rest)
    return " ".join(out)


def _bars_ok(bar, air):
    return bar < PH_BARS - air


# ---- layers (each plays one 8-bar phrase; `ch` is the list of four chords)
def L_pulse(sc, ch, vel, pat="ref", inst=None, pan=0.36, octv=0, dur=0.42, air=0):
    """the quaver pulse of the guitar tabs: one pitch repeated, stepping down three notes over the two bars of a chord."""
    inst = inst or guitar
    for i, c in enumerate(ch):
        cell = shift(CH[c][2], 12 * octv).split()
        for bi in (0, 1):
            bar = 2 * i + bi
            if not _bars_ok(bar, air):
                continue
            if pat == "ref":
                seq = [cell[0]] * 3 + [cell[1]] * 3 if bi == 0 else [cell[2]] * 6
            else:      # "walk": c0 c0 c1 c1 c2 c2 / c2 c2 c1 c1 c0 c0
                seq = [cell[0], cell[0], cell[1], cell[1], cell[2], cell[2]] if bi == 0 else [cell[2], cell[2], cell[1], cell[1], cell[0], cell[0]]
            for k, nm in enumerate(seq):
                v = vel * (1.18 if k % 3 == 0 else 0.92) * rng.uniform(0.93, 1.07)
                one(inst, "keys", pan, sc, bar, k * 0.5, nm, dur, v)


def L_waltz(sc, ch, vel, inst=None, pan=0.62, air=0, rel=0.45):
    """oom-pah-pah: the root on the first beat, the upper two notes of the triad on the second and third."""
    inst = inst or piano
    for i, c in enumerate(ch):
        bass, tri, _, _ = CH[c]
        up = tri.split()[1:]
        for bi in (0, 1):
            bar = 2 * i + bi
            if not _bars_ok(bar, air):
                continue
            one(inst, "keys", pan - 0.12, sc, bar, 0, bass if c != "B5" else "B2", 2.0, vel * 1.1, rel=rel)
            for b in (1, 2):
                for j, nm in enumerate(up):
                    one(inst, "keys", pan + 0.06 * j, sc, bar, b + 0.03 * j, nm, 0.95, vel * 0.8 * rng.uniform(0.9, 1.1), rel=rel)


def L_parp(sc, ch, vel, inst=None, pan=0.55, air=0, dur=1.7, bus="keys"):
    """quaver arpeggios (up and turn / down), six to a bar."""
    inst = inst or piano
    for i, c in enumerate(ch):
        arp = CH[c][3].split()
        for bi in (0, 1):
            bar = 2 * i + bi
            if not _bars_ok(bar, air):
                continue
            idx = [0, 1, 2, 3, 4, 3] if bi == 0 else [2, 3, 4, 3, 2, 1]
            for k, j in enumerate(idx):
                v = vel * (1.15 if k == 0 else 0.9) * rng.uniform(0.93, 1.07)
                one(inst, bus, pan + 0.15 * (j / 4 - 0.5), sc, bar, k * 0.5, arp[j], dur, v)


def L_harp(sc, ch, vel, sparse=False):
    """a harp arpeggio rolling up the chord on the three beats of each bar."""
    for i, c in enumerate(ch):
        arp = CH[c][3].split()
        for bi in (0, 1):
            if sparse and bi == 1:
                continue
            bar = 2 * i + bi
            for j, idx in enumerate((0, 2, 4) if bi == 0 else (1, 3, 2)):
                one(harp, "harp", 0.3 + 0.2 * j, sc, bar, float(j), arp[idx], 2.6, vel * (1.15 if j == 0 else 0.85) * rng.uniform(0.92, 1.08))


def L_pad(sc, ch, vel, tasto=True, inst=None, bus="orch", **kw):
    inst = inst or strsec
    for i, c in enumerate(ch):
        pad(inst, sc, 2 * i, 0, CH[c][1], 6, vel, att=1.4, rel=1.4, bus=bus, **({"tasto": tasto, "voices": 2} if inst is strsec else {}), **kw)


def L_bass(sc, ch, vel):
    for i, c in enumerate(ch):
        one(cello, "orch", 0.30, sc, 2 * i, 0, CH[c][0], sc.dur(2 * i, 0, 6) + 0.3, vel, att=0.5, rel=0.8)


def L_pizz(sc, ch, vel):
    for i, c in enumerate(ch):
        up = CH[c][1].split()[1:]
        for bi in (0, 1):
            for b in (1, 2):
                for j, nm in enumerate(up):
                    one(pizz, "orch", 0.35 + 0.3 * (b - 1) + 0.05 * j, sc, 2 * i + bi, b, nm, 0.4, vel * rng.uniform(0.85, 1.1))


def L_mel(sc, prog, vel, inst, pan=0.55, bus="lead", octv=0, delay=0.0, **kw):
    for i, text in enumerate(MEL[MELKEY[prog]]):
        voice(inst, bus, pan, sc, 2 * i, delay, shift(text, 12 * octv), vel, **kw)


def L_drone(sc, vel, att=3.0):
    one(sub, "orch", 0.5, sc, 0, 0, "B1", sc.length + 1.0, vel * 0.75, att=att, rel=2.0)
    one(cello, "orch", 0.30, sc, 0, 0, "B2", sc.length - 0.3, vel * 0.33, att=2.5, rel=2.0)


def L_spark(sc, ch, vel, k=4, kind="celesta", span=16.0):
    pool = " ".join(shift(CH[c][1], 24) for c in ch)
    sparkle(sc, 0, 0.5, pool, k, span, vel, kind=kind)


def _hold(sc, i):
    return sc.dur(2 * i, 0, 6)


def L_horns(sc, ch, vel, inst=None, att=0.9):
    for i, c in enumerate(ch):
        pad(inst or horn, sc, 2 * i, 0, shift(CH[c][1], 0), 6, vel, att=att, rel=1.3, bright=0.9)


# ---- the phrases
PROG_OF = {}
for _p in range(NPH):
    if _p < 4:
        PROG_OF[_p] = "INTRO_A"
    elif _p < 7:
        PROG_OF[_p] = ["HOME", "REF_D", "TURN"][_p - 4]
    elif _p < 37:
        _e, _i = divmod(_p - 7, 6)
        PROG_OF[_p] = ["HOME", "HOME", "REF_D", "HOME", "REF_D", "TURN"][_i]
        if _e == 4 and _i < 2:
            PROG_OF[_p] = "INTRO_A"        # episode V begins with the opening progression again
    elif _p < 42:
        PROG_OF[_p] = ["HOME", "REF_D", "HOME", "TURN", "TURN"][_p - 37]
    elif _p < 47:
        PROG_OF[_p] = "DAWN"
    else:
        PROG_OF[_p] = "LAND"


def opening(p, sc, prog, ch):
    """I · Vào việc, phrases 0-6: one layer at a time (pulse -> pad -> piano -> flute)."""
    if p < 4:
        L_drone(sc, 0.24)
        L_pulse(sc, ch, 0.34, pat="ref")
        if p >= 1:
            L_pad(sc, ch, 0.15)
        if p >= 2:
            L_waltz(sc, ch, 0.26)
            L_bass(sc, ch, 0.15)
        if p >= 3:
            L_mel(sc, prog, 0.40, sao, att=0.2)
            L_spark(sc, ch, 0.10, k=4, kind="box")
        if p == 0:
            one(bell, "harp", 0.5, sc, 0, 0, "B4", 8, 0.09, kind="tubular")
    elif p == 4:                       # the arrival of B minor: the curse theme, on a violin
        L_pulse(sc, ch, 0.32, pat="ref")
        L_pad(sc, ch, 0.15)
        L_waltz(sc, ch, 0.26)
        L_bass(sc, ch, 0.17)
        L_harp(sc, ch, 0.20, sparse=True)
        L_mel(sc, prog, 0.34, violin, swell=0.2, att=0.18)
    elif p == 5:                       # the same shape in D major: the love theme
        L_pulse(sc, ch, 0.30, pat="walk")
        L_pad(sc, ch, 0.15)
        L_parp(sc, ch, 0.22)
        L_bass(sc, ch, 0.17)
        L_mel(sc, prog, 0.32, sao, att=0.2)
        L_spark(sc, ch, 0.09, k=4)
    else:                              # the turn: ends on F#, so the plateau starts by leaning on A#
        L_pulse(sc, ch, 0.32, pat="ref")
        L_pad(sc, ch, 0.16)
        L_waltz(sc, ch, 0.24)
        L_bass(sc, ch, 0.18)
        L_harp(sc, ch, 0.20)
        L_mel(sc, prog, 0.34, violin, swell=0.2, att=0.18)


EPISODES = ["guitar_harp", "piano", "strings", "winds", "all"]


def plateau(p, sc, prog, ch):
    """II · Tập trung, phrases 7-36: five episodes of six phrases. The melody is heard only in phrases 1 and 4 of each
    episode, and the last two bars of phrases 2 and 5 are left without a pulse (air)."""
    e, i = divmod(p - 7, 6)
    sing = i in (1, 4)
    air = 2 if i in (2, 5) else 0
    ep = EPISODES[e]
    if ep == "guitar_harp":
        L_pulse(sc, ch, 0.27, pat="ref" if i % 2 == 0 else "walk", air=air)
        L_harp(sc, ch, 0.24, sparse=(i % 3 == 2))
        L_bass(sc, ch, 0.16)
        L_pad(sc, ch, 0.09)
        if sing:
            L_mel(sc, prog, 0.27, sao, att=0.22)
        if i == 3:
            L_spark(sc, ch, 0.08, k=3, kind="box")
    elif ep == "piano":
        if i % 2 == 0:
            L_waltz(sc, ch, 0.26, air=air)
        else:
            L_parp(sc, ch, 0.24, air=air)
        L_pulse(sc, ch, 0.12, pat="walk", air=air, octv=0)
        L_harp(sc, ch, 0.14, sparse=True)
        L_bass(sc, ch, 0.14)
        L_pad(sc, ch, 0.08)
        if sing:
            L_mel(sc, prog, 0.29, piano, pan=0.6, bus="lead", rel=0.9)
            L_mel(sc, prog, 0.10, sao, octv=1, att=0.3)
    elif ep == "strings":
        L_pad(sc, ch, 0.15, tasto=False)
        L_pizz(sc, ch, 0.24)
        L_bass(sc, ch, 0.19)
        L_harp(sc, ch, 0.15, sparse=(i % 2 == 1))
        L_waltz(sc, ch, 0.09, air=air)
        if sing:
            L_mel(sc, prog, 0.34, violin, swell=0.25, att=0.22)
        if i == 2:
            L_spark(sc, ch, 0.08, k=3)
    elif ep == "winds":
        L_pulse(sc, ch, 0.22, pat="walk", inst=guitar, octv=0, air=air)
        L_parp(sc, ch, 0.14, inst=guitar, pan=0.4, air=air)
        L_bass(sc, ch, 0.15)
        L_pad(sc, ch, 0.09)
        L_harp(sc, ch, 0.14, sparse=True)
        if sing:
            L_mel(sc, prog, 0.28, sao, att=0.2)
            L_mel(sc, prog, 0.17, clarinet, octv=-1, delay=3.0, pan=0.4, bus="orch")
            if i == 4:
                L_mel(sc, prog, 0.14, reed, octv=0, delay=6.0, pan=0.65, bus="orch")
    else:                                       # "all": everything, softly
        L_pulse(sc, ch, 0.22, pat="ref", air=air)
        L_waltz(sc, ch, 0.18, air=air)
        L_harp(sc, ch, 0.17)
        L_pad(sc, ch, 0.11)
        L_bass(sc, ch, 0.15)
        if sing:
            L_mel(sc, prog, 0.25, sao, att=0.22)
            L_mel(sc, prog, 0.18, violin, swell=0.2, att=0.22, octv=0, delay=0.0)
        if i in (0, 3):
            L_spark(sc, ch, 0.08, k=3, kind="box")


def lift(p, sc, prog, ch):
    """III · Nước rút, phrases 37-44: more voices and a higher register, a dominant pedal, then B major."""
    x = min(1.0, (p - 37) / 4.0)                 # 0 -> 1 over phrases 37..41
    L_pulse(sc, ch, 0.22 + 0.07 * x, pat="ref", octv=0)
    L_parp(sc, ch, 0.20 + 0.07 * x)
    L_harp(sc, ch, 0.22)
    L_pad(sc, ch, 0.10 + 0.09 * x, tasto=False)
    L_bass(sc, ch, 0.15 + 0.08 * x)
    L_mel(sc, prog, 0.28 + 0.14 * x, violin, swell=0.25, att=0.18)
    if p >= 38:
        L_mel(sc, prog, 0.12 + 0.06 * x, sao, octv=1, att=0.25)
        L_horns(sc, ch, 0.06 + 0.05 * x)
    if p >= 39:
        for i, c in enumerate(ch):
            pad(strsec, sc, 2 * i, 0, shift(CH[c][1], 12), 6, 0.05 + 0.04 * x, att=1.2, rel=1.3, trem=0.5, voices=2)
        L_pad(sc, ch, 0.04 + 0.04 * x, inst=choir, bus="choir", vowel="ah")
        for i, c in enumerate(ch):
            one(timp, "perc", 0.5, sc, 2 * i, 0, CH[c][0], 2.0, 0.09 + 0.06 * x)
    if p in (40, 41):
        roll(sc, 6, 0, 4.2, "F#2", 0.05, 0.22 if p == 41 else 0.15)
    if p == 41:
        noise_at(sc, 6, 0, 4.0, 0.10, att=4.0)


def dawn(p, sc, prog, ch):
    """III · Nước rút, phrases 42-44: the same shape in B major; the motto, sung out loud for the first time."""
    big = p in (42, 43)
    fade = 1.0 if p < 44 else 0.7
    L_pulse(sc, ch, 0.27 * fade, pat="ref", octv=0)
    L_parp(sc, ch, 0.26 * fade)
    L_harp(sc, ch, 0.24 * fade)
    L_pad(sc, ch, 0.15 * fade, tasto=False)
    L_bass(sc, ch, 0.20 * fade)
    L_mel(sc, prog, 0.42 * fade, violin, swell=0.3, att=0.15)
    L_mel(sc, prog, 0.24 * fade, sao, octv=1, att=0.2)
    if big:
        L_mel(sc, prog, 0.22, horn, octv=-1, bright=1.1, att=0.12, bus="orch", pan=0.45)
        L_horns(sc, ch, 0.10)
        L_pad(sc, ch, 0.07, inst=choir, bus="choir", vowel="ah")
        for i, c in enumerate(ch):
            pad(strsec, sc, 2 * i, 0, shift(CH[c][1], 12), 6, 0.07, att=1.0, rel=1.3, trem=0.5, voices=2)
            one(timp, "perc", 0.5, sc, 2 * i, 0, CH[c][0], 2.0, 0.18)
        one(bell, "harp", 0.5, sc, 0, 0, "B4", 8, 0.10, kind="tubular")
        L_spark(sc, ch, 0.09, k=6, kind="celesta")
        if p == 42:
            noise_at(sc, 0, 0, 3.0, 0.14, tau=2.5)
    else:
        L_spark(sc, ch, 0.09, k=4, kind="celesta")
        L_horns(sc, ch, 0.06 * 0.7)


def landing(p, sc, prog, ch):
    """IV · Hạ cánh, phrases 45-49: the lights go down."""
    if p == 45:
        L_pulse(sc, ch, 0.16, pat="walk")
        L_parp(sc, ch, 0.20)
        L_harp(sc, ch, 0.16)
        L_pad(sc, ch, 0.12, tasto=True)
        L_bass(sc, ch, 0.16)
        L_mel(sc, "DAWN", 0.30, sao, att=0.25)
    elif p == 46:                                # the curse theme's head, freed: D#, not D
        L_pulse(sc, ch, 0.07, pat="ref", air=2)
        L_waltz(sc, ch, 0.11, air=2)
        L_pad(sc, ch, 0.08, tasto=True)
        L_bass(sc, ch, 0.10)
        voice(sao, "lead", 0.55, sc, 0, 0.0, "B4:1 D#5:.5 F#5:1.5 E5:1.5 D#5:.5 C#5:1 B4:6", 0.30, att=0.25)
        voice(violin, "lead", 0.45, sc, 3, 0.0, "F#4:3 D#4:3 C#4:3 B3:6", 0.22, swell=0.3, att=0.3)
        L_spark(sc, ch, 0.08, k=3, kind="box")
    elif p == 47:                                # piano alone with the open fifth
        for i in range(8):
            for j, nm in enumerate("B3 F#4 B4 F#5".split()):
                one(piano, "keys", 0.55, sc, i, j * 0.75, nm, 3.0, 0.16 * (1.0 - 0.06 * i) * rng.uniform(0.93, 1.07), rel=0.8)
        one(cello, "orch", 0.30, sc, 0, 0, "B2", sc.length, 0.14, att=3.0, rel=3.0)
        one(bell, "harp", 0.55, sc, 4, 0, "F#4", 8, 0.07, kind="tubular")
    elif p == 48:
        one(sub, "orch", 0.5, sc, 0, 0, "B1", sc.length + 1.0, 0.22, att=5.0, rel=2.0)
        pad(strsec, sc, 0, 0, "B3 F#4 B4", 21, 0.09, att=4.0, rel=3.0, tasto=True, voices=2)
        for b, bt, nm in [(1, 1, "F#5"), (2, 2, "B5"), (4, 0, "D6"), (5, 1.5, "F#5"), (6, 0, "B5")]:
            one(bell, "harp", 0.4 + 0.2 * (b % 3), sc, b, bt, nm, 5.0, 0.07, kind="box", wob=0.01)
        L_harp(sc, ["B5", "B5", "B5", "B5"], 0.10, sparse=True)
    else:                                        # p49: the last chord rings into the first bar of the loop
        one(sub, "orch", 0.5, sc, 0, 0, "B1", sc.length + 3.5, 0.24, att=0.5, rel=3.5)
        one(cello, "orch", 0.30, sc, 0, 0, "B2", sc.length + 1.0, 0.13, att=2.0, rel=3.0)
        pad(strsec, sc, 0, 0, "B3 F#4", 21, 0.07, att=2.5, rel=3.5, tasto=True, voices=2)
        one(bell, "harp", 0.5, sc, 0, 0.0, "B4", 14, 0.11, kind="tubular")
        one(bell, "harp", 0.55, sc, 0, 0.4, "F#4", 14, 0.06, kind="tubular")


def phrase(p):
    sc = SC["P%02d" % p]
    prog = PROG_OF[p]
    ch = PROGS[prog]
    if p < 7:
        opening(p, sc, prog, ch)
    elif p < 37:
        plateau(p, sc, prog, ch)
    elif p < 42:
        lift(p, sc, prog, ch)
    elif p < 45:
        dawn(p, sc, prog, ch)
    else:
        landing(p, sc, prog, ch)
# ------------------------------------------------------------------ mix
def hall(x, rt=3.2, lp=5200):
    """circular convolution reverb (two tails: bright and short, dark and long): 30 ms pre-delay, 12 early reflections."""
    Nn = x.shape[0]
    n_ir = int(SR * rt * 1.5)
    t = np.arange(n_ir) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        a = rng.standard_normal(n_ir) * np.exp(-t * 6.9 / (rt * 0.7))
        b = rng.standard_normal(n_ir) * np.exp(-t * 6.9 / (rt * 1.25))
        a = fft_lp(a[:, None], lp, 2)[:, 0]
        b = fft_lp(b[:, None], 1900, 2)[:, 0]
        ir = a / (np.sqrt(np.sum(a ** 2)) + 1e-9) + 0.8 * b / (np.sqrt(np.sum(b ** 2)) + 1e-9)
        ir[: int(0.030 * SR)] = 0                                          # pre-delay: the sound reaches the walls first
        for k in range(12):                                                # early reflections, different for each ear
            ir[int((0.032 + 0.058 * (k + rng.uniform(0, 0.8)) / 12) * SR)] += rng.choice([-1.0, 1.0]) * 0.28 * 0.85 ** k
        pad_ir = np.zeros(Nn, np.float32)
        pad_ir[:n_ir] = ir
        out[:, ch] = np.fft.irfft(np.fft.rfft(x[:, ch]) * np.fft.rfft(pad_ir), n=Nn)
    return out


def smooth_curve():
    """per-sample wet level, glided between scene mid-points (circularly)."""
    xs, ys = [], []
    for sc in SCENES:
        xs.append((sc.t0 + sc.length / 2) * SR)
        ys.append(sc.wet)
    if len(xs) == 1:
        return np.full(N, ys[0], np.float32)
    xs_ext = [xs[-1] - N] + xs + [xs[0] + N]
    ys_ext = [ys[-1]] + ys + [ys[0]]
    return np.interp(np.arange(N), xs_ext, ys_ext).astype(np.float32)


def widen(mix, pts):
    xs = np.array([p[0] for p in pts])
    ys = np.array([p[1] for p in pts])
    total = len(mix) / SR
    w = np.interp(np.arange(len(mix)) / SR, np.concatenate([[xs[-1] - total], xs, [xs[0] + total]]),
                  np.concatenate([[ys[-1]], ys, [ys[0]]])).astype(np.float32)           # circular, like everything else
    mid = (mix[:, 0] + mix[:, 1]) / 2
    side = (mix[:, 0] - mix[:, 1]) / 2
    side = side + (w - 1) * fft_hp(side[:, None], 160)[:, 0]
    return np.stack([mid + side, mid - side], 1).astype(np.float32)


def level_ride(mix, strength=0.55, win=3.0, lo=0.55, hi=1.9):
    """slow, gentle gain riding so the story keeps its shape but never leaves the 'background music' range."""
    blk = SR // 10
    nb = len(mix) // blk
    e = (mix[: nb * blk] ** 2).mean(axis=1).reshape(nb, blk).mean(axis=1)
    kw = max(3, int(win * 10)) | 1
    w = np.hanning(kw + 2)[1:-1]
    w /= w.sum()
    ext = np.concatenate([e[-kw:], e, e[:kw]])
    env_b = np.sqrt(np.convolve(ext, w, mode="same")[kw:-kw] + 1e-9)          # circular, 0.1 s resolution
    tgt = np.sqrt(np.mean(env_b ** 2))
    g_b = np.clip((tgt / env_b) ** strength, lo, hi)
    xs = (np.arange(nb) + 0.5) * blk
    xe = np.concatenate([[xs[-1] - nb * blk], xs, [xs[0] + nb * blk]])
    ge = np.concatenate([[g_b[-1]], g_b, [g_b[0]]])
    g = np.interp(np.arange(len(mix)), xe, ge).astype(np.float32)
    return mix * g[:, None], env_b, g


def write_out(mix, path, rms_db=-19.0):
    rms = np.sqrt(np.mean(mix.astype(np.float64) ** 2))
    mix = mix * (10 ** (rms_db / 20) / rms)
    mix = np.tanh(mix * 1.2) / 1.2
    if os.environ.get("HARU_PADDED"):          # [1 s end][loop][1 s start]: for a player that loops a middle section
        padded = np.concatenate([mix[-SR:], mix, mix[:SR]])
    else:                                       # exactly the loop, with 20 ms fades at the cut
        padded = mix.copy()
        k = int(0.02 * SR)
        padded[:k] *= np.linspace(0, 1, k, dtype=np.float32)[:, None]
        padded[-k:] *= np.linspace(1, 0, k, dtype=np.float32)[:, None]
    peak = np.max(np.abs(padded))
    print(path, "peak %.1f dBFS" % (20 * np.log10(peak)), "loop %.3f s = %d samples" % (len(mix) / SR, len(mix)), "file %.3f s" % (len(padded) / SR))
    pcm = (np.clip(padded, -1, 1) * 32767).astype("<i2")
    wav = path + ".wav"
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", path], check=True)
    return mix


def width_points():
    """(time, stereo width): narrow and intimate at both ends, wide for the dawn. Width only touches what is above ~160 Hz,
    so the bass stays in the middle, and it never goes beyond 1.35 so that a mono speaker or one earbud still gets everything."""
    pts = []

    def at(p, w):
        if "P%02d" % p in SC:
            pts.append((SC["P%02d" % p].t0, w))
    for p, w in ((0, .85), (4, .95), (7, 1.0), (13, 1.05), (19, 1.0), (25, 1.05), (31, 1.0), (37, 1.05), (40, 1.15), (42, 1.35),
                 (44, 1.25), (45, 1.0), (47, .90), (49, .85)):
        at(p, w)
    return sorted(pts) or [(0.0, 1.0)]


def _per_ch(fn, x, *a):
    out = np.empty(x.shape, np.float32)
    for c in range(x.shape[1]):
        out[:, c] = fn(x[:, c], *a)
    return out


def main():
    for p in PHR_RANGE:
        phrase(p)
    if os.environ.get("HARU_STATS"):      # dry loudness of each bus in each phrase (dBFS)
        print("phrase  " + "  ".join("%6s" % b for b in BUS))
        for sc in SCENES:
            a, b_ = int(sc.t0 * SR), int((sc.t0 + sc.length) * SR)
            print("%-6s  " % sc.name + "  ".join("%6.1f" % (20 * np.log10(np.sqrt(np.mean(BUS[k][a:b_] ** 2) * 2) + 1e-9)) for k in BUS))
    curve = smooth_curve()
    send = np.zeros((N, 2), np.float32)
    for b in BUS:
        send += BUS[b] * np.float32(SEND[b])
    send *= curve[:, None]
    wet = hall(send)
    del send
    dry = np.zeros((N, 2), np.float32)
    for b in list(BUS):
        dry += BUS[b] * np.float32(GAIN[b])
        BUS[b] = None
    mix = dry + np.float32(0.9) * wet.astype(np.float32)
    del dry, wet
    mix = _per_ch(fft_hp, mix, 45)
    mix = _per_ch(fft_lp, mix, 12500 if LIB is not None else 9000, 2)
    if LIB is not None:      # recorded violins, guitar and cymbals are brighter than synthesis: take 3.5 dB off above ~3 kHz
        low = _per_ch(fft_lp, mix, 3200, 1)
        mix = low + (mix - low) * np.float32(10 ** (-3.5 / 20))
        del low
    mix = widen(mix, width_points())
    mix, env, g = level_ride(mix, strength=RIDE, lo=0.7, hi=1.6)
    name = "ballet-thien-nga-phien-hoc-15p.m4a" if not SOLO else "session-p%d-%d.m4a" % WINDOW
    out = write_out(mix, "%s/%s" % (OUT, name))
    if FALLBACK:
        print("notes outside the recorded range (played by the synth instead):", dict(sorted(FALLBACK.items())))
    print("phrase  start    rms(dBFS)  story")
    for sc in SCENES:
        a, b = int(sc.t0 * SR), int((sc.t0 + sc.length) * SR)
        r = np.sqrt(np.mean(out[a:b].astype(np.float64) ** 2))
        print("%-6s %6.1f   %6.1f   %s" % (sc.name, sc.t0, 20 * np.log10(r), sc.story))


if __name__ == "__main__":
    main()
