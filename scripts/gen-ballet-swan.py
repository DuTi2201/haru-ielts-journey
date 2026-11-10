# Usage: VSCO_DIR=/path/to/VSCO-2-CE python3 scripts/gen-ballet-swan.py public/music [scene-name]
# v3 (22 Oct): the curse phrase in the intro now hangs on the leading tone A# (a Bm(maj7) colour) and is only resolved at dawn;
#   the Viennese lilt is about half as strong (beat 2 ~32-39 ms early for the accompaniment, 13-16 ms for the melody);
#   the G chord before the dawn is in first inversion so no G3 rubs against the F#2 pedal;
#   the synthesised choir has its own bus: 3 dB quieter, low-passed at 3.5 kHz, more reverb.
#        (needs numpy, scipy and ffmpeg; without VSCO_DIR everything is synthesised, which sounds much more electronic)
#
# "Thiên Nga Đen": a ~4 minute symphonic-ballet loop in B minor, composed for Haru. The score is original: no existing
# score, no existing recording, no borrowed melody. Inspired by the *idea* of Swan Lake (a curse, a prince, a black
# and a white swan), not by its notes. The sound comes from two places:
#   * real orchestral recordings, played by scripts/vsco_sampler.py: VSCO 2 Community Edition by Versilian Studios,
#     released under CC0 1.0 (violin/viola/cello sections, solo violin, harp, horn, trombone, tuba, trumpet, oboe,
#     flute, clarinet, bassoon, organ, timpani, glockenspiel, tubular bells, cymbals, gong, bass drum, bell tree);
#   * our own synthesis for what the library lacks: celesta, music box and glass bells, choir, crows, sub-bass, heartbeat.
# The story is carried by four leitmotifs that change colour from scene to scene:
#
#   CURSE  (B minor)  B-D-F# up, then a lament down to A#: the moonlit swan's theme.
#   LOVE   (D major)  the same B-D-F# shape, but warm and in three-time: the prince's waltz.
#   MOTTO  (B-D-F#-B) short-short-short-long: "love may die but I will not". Planted in the intro, shouted by
#                     horns in act 1, and finally sung in B *major* (D#) at dawn.
#   SIGH   (C#->B)    a falling second: grief, and the apology of act 3.
#
# Scenes (see SCENES): Intro · Act 1 (castle, mirror dance, Black Swan) · Act 2 (dream waltz, ball, fall) ·
# Act 3 (Maleficent, black vs white, "I'm sorry") · Act 4 (cemetery, city, dawn). The last chord (B major)
# rings into the first (B-F# without a third), so the loop is seamless: everything is rendered into a
# *circular* buffer (notes wrap past the end, the reverb is an FFT-circular convolution).
import os
import re
import subprocess
import sys
import wave

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
SOLO = sys.argv[2] if len(sys.argv) > 2 else None   # render one scene only (for listening tests)
rng = np.random.default_rng(1894)
LIB = None
if os.environ.get("VSCO_DIR"):
    import vsco_sampler
    LIB = vsco_sampler.Library(os.environ["VSCO_DIR"], seed=1894)

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


# ------------------------------------------------------------------ timeline
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


# `wet` is the reverb send of the scene. With recordings (which already carry their hall) it is scaled down.
WET_SCALE = 0.6 if LIB is not None else 1.0
SCENES = [
    S("INTRO", 4, 44, 4, 0.95, 0.42, "Lời nguyền dưới ánh trăng"),
    S("A1a", 4, 48, 5, 1.00, 0.40, "ACT 1 · Tỉnh giấc trong lâu đài hoang"),
    S("A1b", 3, 63, 7, 0.85, 0.58, "ACT 1 · Khiêu vũ cùng bóng hình hoàng tử", lilt=(1.0, 1.15, 1.06)),
    S("A1c", 4, [72, 76, 80, 84, 88, 92, 96], 7, 0.45, 0.70, "ACT 1 · Linh cảm, phản bội, hóa thân Thiên Nga Đen"),
    S("A2a", 3, [69] * 9 + [62], 10, 0.55, 0.66, "ACT 2 · Once upon a time: waltz của nàng Aurora", lilt=(1.0, 1.20, 1.08)),
    S("A2b", 3, 88, 8, 0.65, 0.82, "ACT 2 · Vũ hội dưới ánh đèn pha lê, vết rạn nứt", lilt=(1.0, 1.22, 1.10)),
    S("A2c", 4, 60, 3, 0.75, 0.70, "ACT 2 · Tòa tháp: cú đẩy định mệnh"),
    S("A3a", 6, 234, 12, 0.35, 0.96, "ACT 3 · Maleficent: hận thù và lời nguyền"),
    S("A3b", 4, 72, 6, 0.55, 0.80, "ACT 3 · Giằng xé giữa Đen và Trắng"),
    S("A3c", 4, 54, 3, 0.80, 0.44, "ACT 3 · Ánh ban mai và lời xin lỗi"),
    S("A4a", 4, 46, 4, 1.00, 0.40, "ACT 4 · Nghĩa địa của tình yêu"),
    S("A4b", 4, 56, 3, 0.95, 0.38, "ACT 4 · Thành phố không màu, tiễn biệt"),
    S("A4c", 4, 60, 6, 0.85, 0.72, "ACT 4 · Hừng đông của sự giải thoát"),
]
for _sc in SCENES:
    _sc.wet *= WET_SCALE
if SOLO:
    SCENES = [s for s in SCENES if s.name == SOLO]
T = 0.0
for sc in SCENES:
    sc.t0 = T
    T += sc.length
TOTAL = T + (3.0 if SOLO else 0.0)
N = int(round(TOTAL * SR))
BUS = {k: np.zeros((N, 2), np.float32) for k in ("lead", "orch", "harp", "perc", "choir")}
SEND = {"lead": 0.55, "orch": 0.50, "harp": 0.60, "perc": 0.35, "choir": 0.95}
RIDE = 0.45      # how strongly the gain riding flattens the story (0 = not at all); the first version used 0.55
WET_GATES = []   # (start s, end s): the reverb tail is cut dead for that stretch (the push in act 2)
GAIN = {"lead": 1.0, "orch": 1.0, "harp": 1.0, "perc": 1.0, "choir": 0.7}


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
def intro():
    sc = SC["INTRO"]
    one(sub, "orch", 0.5, sc, 0, 0, "B1", sc.length + 1.5, 0.38, att=3.0, rel=2.0)
    one(cello, "orch", 0.30, sc, 0, 0, "B2", sc.length - 0.5, 0.20, att=2.5, rel=2.0)
    # an open fifth, no third: neither major nor minor yet (the violins shiver in the moonlight: tremolo)
    pad(strsec, sc, 0, 0, "B4 F#5", 2.5, 0.20, att=3.0, rel=1.5, tasto=True, voices=2, trem=0.5)
    pad(strsec, sc, 1, 0, "E3 B3 G4", 1, 0.14, att=2.0, rel=1.5, tasto=True)
    pad(strsec, sc, 2, 0, "G3 D4 B4", 0.5, 0.14, att=1.2, rel=1.0, tasto=True)
    pad(strsec, sc, 2, 2, "F#3 A#3 C#4 E4", 1.5, 0.15, att=1.2, rel=1.2, tasto=True)
    pad(strsec, sc, 3, 0, "B3 D4 F#4", 2.8, 0.17, att=1.4, rel=2.0, tasto=True, trem=0.5)
    one(bell, "harp", 0.5, sc, 0, 0, "B4", 8, 0.10, kind="tubular")
    one(bell, "harp", 0.55, sc, 2, 0, "F#4", 8, 0.08, kind="tubular")
    sparkle(sc, 0, 0.5, "B5 D6 F#6 A5 E6 B6 C#6", 3, 5, 0.10)
    sparkle(sc, 1, 0, "B5 D6 F#6 A5 E6 B6 C#6", 5, 6, 0.10)
    sparkle(sc, 2, 0, "B5 D6 F#6 G6 E6 B6 C#6", 7, 6, 0.10)
    sparkle(sc, 3, 0, "D6 F#6 A#5 A#6 C#6", 4, 4, 0.08)
    # the harp murmurs in sixteenths underneath (the old ballet way to open on a lake at night)
    arp16(sc, 0, 0, "B3 F#4 B4 D5", 16, 0.09)
    arp16(sc, 1, 0, "E4 G4 B4 E5", 16, 0.085)
    arp16(sc, 2, 0, "G4 B4 D5 G5", 8, 0.085)
    arp16(sc, 2, 2, "A#4 C#5 E5 F#5", 8, 0.085)
    arp16(sc, 3, 0, "F#4 D5 F#5 D5", 8, 0.08)
    # CURSE: the swan's theme. A lone oboe sings the first phrase, the violin answers with the second.
    voice(reed, "lead", 0.55, sc, 0, 1, "B4:1 D5:.5 F#5:1.5 E5:1.5 D5:.5 C#5:2", 0.46, att=0.14)
    voice(violin, "lead", 0.55, sc, 2, 0, "D5:1 C#5:1 B4:1 A#4:3.4", 0.46, swell=0.25, att=0.14)
    # MOTTO, planted very softly in the low harp
    for i, nm in enumerate("B2 D3 F#3 B3".split()):
        put("harp", harp(hz(n(nm)), 3.0, 0.22 * sc.level * (1.0 if i < 3 else 1.3)), 0.4, sc.time(3, 2.55 + i * 0.28))


def a1a():
    sc = SC["A1a"]
    one(sub, "orch", 0.5, sc, 0, 0, "B1", sc.length + 1.0, 0.32, att=2.0, rel=1.5)
    put("orch", band_noise(sc.length, 300, 1800) * np.sin(np.pi * np.clip(tarr(sc.length) / sc.length, 0, 1)) * 0.035 * sc.level, 0.5, sc.t0)
    pad(strsec, sc, 0, 0, "B3 C#4 F#4", 5, 0.17, att=2.0, rel=1.5, tasto=True)
    pad(strsec, sc, 1, 0, "C4 E4 G4", 5, 0.16, att=1.8, rel=1.5, tasto=True)
    pad(strsec, sc, 2, 0, "G3 B3 D4", 5, 0.17, att=1.8, rel=1.5, tasto=True)
    pad(strsec, sc, 3, 0, "F#3 B3 C#4 E4", 5, 0.17, att=1.8, rel=1.5, tasto=True)
    pad(strsec, sc, 4, 0, "B3 D4 F#4", 5, 0.17, att=1.8, rel=2.0, tasto=True)
    # dust: a music box that is slightly out of tune and running down
    for (b, bt, nm) in [(0, 1, "F#5"), (0, 3, "D5"), (1, 2, "E5"), (2, 1.5, "G5"), (2, 3, "D5"), (3, 1, "C#5"), (3, 3, "A#4")]:
        one(bell, "harp", 0.7, sc, b, bt, nm, 4.0, 0.10, kind="box", wob=0.012)
    # the love arpeggio, remembered (A-D-F#), the last note left hanging
    for i, nm in enumerate(["A5", "D6", "F#6"]):
        one(bell, "harp", 0.3 + 0.1 * i, sc, 4, 0.5 + i * 1.0, nm, 5.0, 0.11, kind="box", wob=0.01)
    # the curse theme's head, wandering in a low clarinet
    voice(clarinet, "orch", 0.35, sc, 1, 0.5, "B3:1.5 D4:.5 F#4:2", 0.26)
    voice(clarinet, "orch", 0.35, sc, 3, 0.0, "E4:1.5 D4:.5 C#4:2", 0.24)
    # fairy dust over the lost C-major chord: whole-tone scales in celesta, a low flute breathing beneath
    wholetone(sc, 1, 2.5, "C6", 6, 0.22, 0.10)
    wholetone(sc, 3, 1.5, "B5", 6, 0.22, 0.09, pan_pos=0.45)


def a1b():
    sc = SC["A1b"]
    chords = ["D", "Bm", "A7", "A", "G", "G", "A"]
    bass = ["D2", "B2", "A2", "A2", "G2", "G2", "A2"]
    harp3 = {"D": "D3 A3 F#4", "Bm": "B2 F#3 D4", "A7": "A2 E3 C#4", "A": "A2 E3 C#4", "G": "G2 D3 B3"}
    padc = {"D": "D4 F#4 A4", "Bm": "B3 D4 F#4", "A7": "A3 C#4 E4 G4", "A": "A3 C#4 E4", "G": "G3 B3 D4"}
    end_bar, end_beat = 6, 1.5
    for b, c in enumerate(chords):
        last = b == 6
        top = sc.dur(b, 0, end_beat) if last else None
        arp = harp3[c].split()
        for j, nm in enumerate(arp):
            if last and j * 1.0 >= end_beat:
                continue
            one(harp, "harp", 0.3 + 0.2 * j, sc, b, float(j), nm, 2.6 if not last else 0.6, 0.30 if j == 0 else 0.22)
        one(cello, "orch", 0.30, sc, b, 0, bass[b], 2.4 if not last else top, 0.22, att=0.4)
        pad(strsec, sc, b, 0, padc[c], 3 if not last else end_beat, 0.10, att=1.0, rel=1.0 if not last else 0.05, voices=2)
    # LOVE, played by the violin; the second phrase is only half finished: the ghost is gone
    voice(violin, "lead", 0.55, sc, 0, 0, "A4:1 D5:2 F#5:2 E5:1 D5:1.5 C#5:.5 B4:1 A4:3", 0.46, swell=0.2)
    voice(violin, "lead", 0.55, sc, 4, 0, "B4:1 D5:2 G5:2 F#5:1 E5:1.5", 0.46, swell=0.2, rel=0.04)
    # the reflection: the same tune a bar later and an octave higher, glassy, on the other side
    voice(bell, "harp", 0.18, sc, 1, 0, "A5:1 D6:2 F#6:2 E6:1 D6:1.5 C#6:.5 B5:1", 0.085, kind="glass", wob=0.0)
    voice(bell, "harp", 0.18, sc, 4, 1, "B5:1 D6:2 G6:2 F#6:1", 0.075, kind="glass")
    # rain on the glass
    sparkle(sc, 1, 0, "E6 G6 A6 B6 D7 E7", 9, 14, 0.06, kind="glass", dur=1.6)
    # she vanishes: a cold low note and breath where the music was
    one(sub, "orch", 0.5, sc, 6, 1.5, "B1", 4.0, 0.34, att=0.6, rel=2.0)


def a1c():
    sc = SC["A1c"]
    # "easy come, easy go": a flippant little pizzicato, one bar in B, one in C
    for b, (root, mel) in enumerate([("B2", "B3:.5s F#4:.5s D4:.5s F#4:.5s B3:1s"), ("C3", "C4:.5s G4:.5s E4:.5s G4:.5s C4:1s")]):
        voice(pizz, "orch", 0.40 + 0.2 * b, sc, b, 0, mel, 0.32)
        one(pizz, "orch", 0.40, sc, b, 0, root, 1.0, 0.45)
    voice(clarinet, "orch", 0.38, sc, 1, 2.5, "A4:.5s G#4:.5s A4:1s", 0.20)
    one(cello, "orch", 0.30, sc, 0, 0, "B2", sc.dur(0, 0, 8) + 0.4, 0.22, att=1.2, rel=0.6)
    pad(strsec, sc, 0, 0, "B3 F#4 D5", 8, 0.08, att=1.5, rel=0.4, tasto=True, voices=2, lead=0.0)
    # betrayal: a diminished chord, a falling harp, a brass sting, the crows
    pad(strsec, sc, 2, 0, "A#3 C#4 E4 G4", 4, 0.30, att=0.05, rel=1.0, trem=0.7, lead=0.0, bright=1.2)
    pad(strsec, sc, 3, 0, "G#3 B3 D4 F4", 4, 0.26, att=0.4, rel=1.0, trem=0.7, lead=0.0, bright=1.2)
    gliss(sc, 2, 0, "B6 A6 G6 F#6 E6 D6 C#6 B5 A5 G5 F#5 E5 D5 B4 A4 F#4 D4 B3 G3 E3 B2", 0.045, 0.30)
    one(horn, "orch", 0.40, sc, 2, 0, "A#2", 1.6, 0.55, att=0.04, rel=0.8, bright=1.4)
    one(timp, "perc", 0.5, sc, 2, 0, "F#2", 1.4, 0.55)
    runs(sc, 2, 1.0, 4.0, 0.16, 7)
    crows(sc, 2, 1.0, 5.5, 0.09, 8)
    # transformation: timpani, brass, a rising swell. At 1:19 the organ enters on the low B and the violins start a
    # fast spiccato ostinato (the bow bouncing on the string), the cellos pulsing underneath.
    roll(sc, 4, 0, 5.5, "F#2", 0.10, 0.50)
    pad(organ, sc, 4, 0, "B1 F#2 B2", 8, 0.20, att=1.8, rel=0.3, lead=0.0)
    for i in range(32):
        up = i / 31
        put("orch", spicc(hz(n(("B4", "F#4", "D5", "F#4")[i % 4])), 0.15, (0.10 + 0.16 * up) * sc.level), 0.42 + 0.16 * (i % 2), sc.time(4, i * 0.25))
    for i in range(16):
        put("orch", spicc(hz(n("B2" if i % 4 else "F#2")), 0.2, (0.14 + 0.10 * i / 15) * sc.level, cello_=True), 0.30, sc.time(4, i * 0.5))
    pad(strsec, sc, 4, 0, "F#3 A#3 C#4 E4", 4, 0.28, att=2.0, rel=0.8, trem=0.5, bright=1.2)
    pad(strsec, sc, 5, 0, "F#3 B3 D4 F#4", 4, 0.30, att=0.8, rel=0.6, trem=0.5, bright=1.3)
    noise_at(sc, 4, 0, 5.5, 0.14, att=5.2)
    voice(horn, "orch", 0.38, sc, 4, 2, "B3:.5 D4:.5 F#4:.5 B4:2", 0.50)
    voice(horn, "orch", 0.38, sc, 5, 2, "B3:.5 D4:.5 F#4:.5 B4:2", 0.58)
    voice(violin, "lead", 0.58, sc, 5, 2, "B4:.5 D5:.5 F#5:.5 B5:2", 0.50, bright=1.3, swell=0.1)
    # "Queen": the whole orchestra on B minor, MOTTO shouted
    pad(strsec, sc, 6, 0, "B3 F#4 B4 D5 F#5", 4, 0.40, att=0.05, rel=1.8, trem=0.0, bright=1.3, lead=0.0)
    pad(horn, sc, 6, 0, "B2 F#3 D4 B4", 3, 0.50, att=0.05, rel=1.4, lead=0.0, bright=1.3)
    voice(horn, "orch", 0.40, sc, 6, 0, "B4:.5a D5:.5a F#5:.5a B5:2.5", 0.55, bright=1.3)
    one(timp, "perc", 0.5, sc, 6, 0, "B1", 2.5, 0.85)
    noise_at(sc, 6, 0, 3.5, 0.34, tau=1.6)
    gliss(sc, 6, 0, "B3 D4 F#4 B4 D5 F#5 B5 D6 F#6 B6", 0.04, 0.34)
    # gothic: the organ with its pedal, a minor "Ah" from the choir, a gong and the bass drum under the crash
    pad(organ, sc, 6, 0, "B1 B2 F#3 B3 D4 F#4", 4, 0.34, att=0.05, rel=2.2, lead=0.0)
    pad(choir, sc, 6, 0, "B3 F#4 B4 D5", 4, 0.30, att=0.25, rel=2.0, lead=0.0, bus="choir")
    hit(sc, 6, 0, "Percussion/gongHit_f.wav", 0.16, kind="gong", dur=8.0, rel=1.5)
    hit(sc, 6, 0, "Percussion/BDrumNewhit_v4_rr*.wav", 0.30, kind="bd", dur=2.5)


def a2a():
    sc = SC["A2a"]
    gliss(sc, 0, 0, "D3 F#3 A3 D4 F#4 A4 D5 F#5 A5 D6", 0.06, 0.34)
    pad(strsec, sc, 0, 0, "D4 A4 D5", 3, 0.12, att=1.0, rel=0.8, voices=2)
    one(cello, "orch", 0.30, sc, 0, 0, "D2", 2.5, 0.26)
    chords = ["D", "Bm", "A7", "A", "G", "G", "A", "D"]
    bass = ["D2", "B2", "A2", "A2", "G2", "G2", "A2", "D2"]
    stab = {"D": "A3 D4 F#4", "Bm": "B3 D4 F#4", "A7": "C#4 E4 G4", "A": "C#4 E4 A4", "G": "B3 D4 G4"}
    for i, c in enumerate(chords):
        b = i + 1
        one(cello, "orch", 0.32, sc, b, 0, bass[i], 1.5, 0.30, att=0.25, rel=0.4)
        for beat in (1, 2):
            for j, nm in enumerate(stab[c].split()):
                one(pizz, "orch", 0.40 + 0.1 * j, sc, b, float(beat), nm, 0.6, 0.12, tau=0.22)
        pad(strsec, sc, b, 0, stab[c].replace("A3", "D4") if c == "D" else stab[c], 3, 0.07, att=0.8, rel=0.6, voices=2)
    # LOVE in the flute, a little violin under it; second half in the solo violin, with slides
    voice(flute, "lead", 0.62, sc, 0, 2, "A4:1", 0.30)
    voice(flute, "lead", 0.62, sc, 1, 0, "D5:2 F#5:2 E5:1 D5:1.5 C#5:.5 B4:1 A4:3", 0.34)
    voice(violin, "lead", 0.50, sc, 1, 0, "D5:2 F#5:2 E5:1 D5:1.5 C#5:.5 B4:1 A4:3", 0.17, bright=0.9)
    voice(violin, "lead", 0.55, sc, 5, 0, "B4:1g D5:2 G5:2g F#5:1 E5:1.5 D5:.5 C#5:1 D5:3", 0.50, swell=0.2)
    voice(flute, "lead", 0.66, sc, 5, 0, "B5:1 D6:2 G6:2 F#6:1 E6:1.5 D6:.5 C#6:1 D6:3", 0.10)
    # champagne
    for b in (2, 4, 6, 8):
        one(bell, "harp", 0.3 + 0.05 * b, sc, b, 2.0, ["A6", "F#6", "D6", "A6"][(b // 2 - 1) % 4], 1.4, 0.07)
    # a glittering octatonic run carries the strings into the second half and into the closing tag; a glockenspiel
    # shines over the flute; a bell tree shivers at the cadence
    octatonic_into(sc, 4, 2.0, "B4", 0.125, 0.14)
    octatonic_into(sc, 8, 2.0, "F#5", 0.125, 0.14)
    voice(glock, "harp", 0.70, sc, 5, 0, "B5:1 D6:2 G6:2 F#6:1 E6:1.5 D6:.5 C#6:1 D6:3", 0.07)
    hit(sc, 8, 2.5, "Percussion/BellTree_Stroke*_v1_Sum.wav", 0.10, pan_pos=0.6, kind="belltree", dur=4.0, rel=1.0)
    # last bar: a tag and a slowing-down
    voice(violin, "lead", 0.55, sc, 9, 0, "F#5:1 A5:2", 0.42, swell=0.2, rel=0.5)
    pad(strsec, sc, 9, 0, "D4 A4 D5 F#5", 3, 0.14, att=0.6, rel=1.4)
    gliss(sc, 9, 1, "A4 D5 F#5 A5 D6 F#6", 0.05, 0.26)


def a2b():
    sc = SC["A2b"]
    mel = ["D5:1 F#5:1 A5:1", "B5:2 A5:1", "G5:1 F#5:1 E5:1", "F#5:2 D5:1", "D5:1 F#5:1 A5:1", "Bb5:2 A5:1", "G5:1 F5:1 Eb5:1", "E5:1 A5:1 C#6:1"]
    chord = ["D", "Bm", "G", "D", "D", "Bb", "Gm", "A7"]
    low = {"D": "D2", "Bm": "B2", "G": "G2", "Bb": "Bb2", "Gm": "G2", "A7": "A2"}
    st = {"D": "A3 D4 F#4", "Bm": "B3 D4 F#4", "G": "B3 D4 G4", "Bb": "D4 F4 Bb4", "Gm": "Bb3 D4 G4", "A7": "C#4 E4 G4"}
    arp = {"D": "D4 F#4 A4 D5 F#5 A5", "Bm": "B3 D4 F#4 B4 D5 F#5", "G": "G3 B3 D4 G4 B4 D5", "Bb": "Bb3 D4 F4 Bb4 D5 F5", "Gm": "G3 Bb3 D4 G4 Bb4 D5", "A7": "A3 C#4 E4 G4 A4 C#5"}
    for b in range(8):
        c = chord[b]
        one(cello, "orch", 0.32, sc, b, 0, low[c], 0.9, 0.34, att=0.1, rel=0.3)
        one(timp, "perc", 0.5, sc, b, 0, low[c], 0.8, 0.10)
        for beat in (1, 2):
            for j, nm in enumerate(st[c].split()):
                one(pizz, "orch", 0.38 + 0.12 * j, sc, b, float(beat), nm, 0.4, 0.17, tau=0.18)
        for j, nm in enumerate(arp[c].split()):
            one(harp, "harp", 0.25 + 0.1 * j, sc, b, j * 0.5, nm, 1.6, 0.13)
        voice(violin, "lead", 0.55, sc, b, 0, mel[b], 0.50 if b < 5 else 0.55, bright=1.2, swell=0.1, att=0.06)
    # the ghost: a music box playing the tune a beat later, drifting further out of tune each bar
    for b in range(2, 8):
        det = 1 + 0.003 * (b - 1)
        t0 = sc.time(b, 1.0)
        pos = 0
        for tok in mel[b].split():
            nm, d = tok.split(":")
            d = float(d)
            put("harp", bell(hz(n(nm) + 12) * det, 1.8, 0.075 * sc.level, "box", wob=0.01), 0.82, sc.time(b, 1.0 + pos))
            pos += d
    # glitter: glockenspiel doubling the tune two octaves up, a run into the repeat, a bell tree at the turn
    for b in range(8):
        voice(glock, "harp", 0.72, sc, b, 0, transpose(mel[b], 12), 0.055)
    octatonic_into(sc, 3, 2.0, "D5", 0.125, 0.14)
    hit(sc, 4, 0, "Percussion/BellTree_Stroke*_v1_Sum.wav", 0.09, pan_pos=0.65, kind="belltree", dur=4.0, rel=1.0)
    sparkle(sc, 0, 0, "D7 F#7 A6 B6 E7 A7", 22, sc.length - 1, 0.055, kind="glass", dur=1.4)
    # the crack: horns underneath the Bb and Gm bars
    pad(horn, sc, 5, 0, "Bb2 F3", 3, 0.36, att=0.7, rel=0.5, bright=1.1)
    pad(horn, sc, 6, 0, "G2 D3", 3, 0.38, att=0.4, rel=0.5, bright=1.2)
    pad(strsec, sc, 5, 0, "Bb3 D4 F4", 3, 0.16, att=0.6, rel=0.4, voices=2)
    pad(strsec, sc, 6, 0, "G3 Bb3 D4", 3, 0.18, att=0.5, rel=0.4, voices=2)
    pad(strsec, sc, 7, 0, "A3 C#4 E4 G4", 3, 0.24, att=0.3, rel=1.2, trem=0.5, bright=1.2)
    roll(sc, 7, 0, 5.0, "A1", 0.06, 0.30)


def a2c():
    sc = SC["A2c"]
    # the climb: LOVE's arpeggio rising two octaves, strings trembling, timpani underneath
    voice(violin, "lead", 0.56, sc, 0, 0, "A4:.5 D5:.5 F#5:.5 A5:.5 D6:.5 F#6:.5 A6:1", 0.46, bright=1.3, swell=0.0, att=0.04)
    pad(strsec, sc, 0, 0, "D4 A4 D5 F#5", 3.5, 0.20, att=2.5, rel=0.03, trem=0.6, bright=1.2, lead=0.0)
    roll(sc, 0, 0, 3.5, "D2", 0.06, 0.42)
    gliss(sc, 0, 2, "D4 F#4 A4 D5 F#5 A5 D6 F#6 A6 D7", 0.07, 0.28)
    # the push: silence on the downbeat of bar 1, a gasp, then the fall
    WET_GATES.append((sc.time(1, 0), sc.time(1, 0.95)))
    put("orch", band_noise(0.35, 400, 3000) * np.sin(np.pi * np.clip(tarr(0.35) / 0.35, 0, 1)) * 0.20 * sc.level, 0.5, sc.time(1, 0.55))
    t_fall = sc.time(1, 1.0)
    # a cluster glissando: five strings a semitone apart slide down together, so their beating gets tighter and darker
    for k, (hi_, lo_) in enumerate([("F#6", "F#2"), ("G6", "G2"), ("G#6", "G#2"), ("A6", "A2"), ("A#6", "A#2")]):
        put("orch", strsec(hz(n(hi_)), 3.6, (0.26 - 0.02 * k) * sc.level, att=0.05, rel=0.6, trem=0.4, bright=1.4, slide_to=hz(n(lo_))),
            0.30 + 0.10 * k, t_fall + 0.02 * k)
    gliss(sc, 1, 1.0, "B7 G7 E7 C#7 A6 F#6 D6 B5 G5 E5 C#5 A4 F#4 D4 B3 G3 E3 B2", 0.07, 0.24)
    x = band_noise(3.0, 200, 5000)
    sweep = x * (np.exp(-tarr(3.0) / 1.0)) * 0.10 * sc.level
    put("perc", sweep, 0.5, t_fall)
    # the landing
    t_thud = sc.time(2, 0)
    put("perc", timp(hz(n("B1")), 3.0, 0.95 * sc.level), 0.5, t_thud)
    put("perc", swell_noise(3.0, 0.30 * sc.level, 80, 700, tau=1.4), 0.5, t_thud)
    put("perc", bell(hz(n("B3")), 6.0, 0.20 * sc.level, "tubular"), 0.5, t_thud)
    one(sub, "orch", 0.5, sc, 2, 0, "B1", 7.0, 0.40, att=0.15, rel=3.0)
    sub_drop(sc, 2, 0, 92, 46, 1.8, 0.40)
    hit(sc, 2, 0, "Percussion/BDrumNewhit_v4_rr*.wav", 0.55, kind="bd", dur=2.5)
    hit(sc, 2, 0, "Percussion/gongHit_mf.wav", 0.12, kind="gong", dur=8.0, rel=1.5)
    # she wakes: a heartbeat starts
    for i in range(3):
        put("perc", drum_heart(0.34 * sc.level), 0.5, sc.time(2, 2.0 + i * 1.0))


def a3a():
    sc = SC["A3a"]
    slither = "B2:1 B2:1 C3:1 B2:1 A#2:1 B2:1"
    # B2 drone + chromatic slither in the low strings, timpani on 1 and 4
    for b in range(12):
        voice(cello, "orch", 0.30, sc, b, 0, slither if b < 8 else "B2:1s B2:1s D3:1s B2:1s F3:2", 0.30, att=0.05, rel=0.1)
        one(timp, "perc", 0.5, sc, b, 0, "B1", 1.0, 0.34)
        one(timp, "perc", 0.5, sc, b, 3, "B1", 1.0, 0.22)
    # MALEFICENT: the curse theme bent out of shape (D-F is a tritone away from B's fifth)
    theme = ["B3:2 D4:1 F4:3", "E4:2 D#4:1 D4:3", "C#4:2 C4:1 B3:3", "A#3:3"]
    low_theme = ["B2:2 D3:1 F3:3", "E3:2 D#3:1 D3:3", "C#3:2 C3:1 B2:3", "A#2:3"]
    for i, th in enumerate(theme):
        voice(horn, "orch", 0.40, sc, i, 0, th, 0.46, bright=1.2)
        voice(reed, "orch", 0.55, sc, i, 0, low_theme[i], 0.24, formant=500)
    up = ["B4:2 D5:1 F5:3", "E5:2 D#5:1 D5:3", "C#5:2 C5:1 B4:3", "A#4:3"]
    for i, th in enumerate(up):
        voice(horn, "orch", 0.40, sc, 4 + i, 0, th, 0.48, bright=1.3)
        voice(violin, "lead", 0.58, sc, 4 + i, 0, th, 0.34, bright=1.4, swell=0.0)
    dev = ["B3:1 B3:1 D4:1 B3:1 F4:2", "E4:1 E4:1 G4:1 E4:1 D#4:2", "C#4:1 C#4:1 E4:1 C#4:1 C4:2", "B3:6"]
    for i, th in enumerate(dev):
        voice(horn, "orch", 0.40, sc, 8 + i, 0, th, 0.55, bright=1.3)
    # the depths: a tuba doubles the low line, the organ holds its pedal (nothing below ~55 Hz: phones cannot play it)
    for i, th in enumerate(low_theme):
        voice(tuba, "orch", 0.30, sc, i, 0, th, 0.26)
    for i, th in enumerate(dev):
        voice(tuba, "orch", 0.30, sc, 8 + i, 0, transpose(th, -12), 0.28)
    pad(organ, sc, 0, 0, "B1 F#2", 24, 0.20, att=1.5, rel=0.4, lead=0.0)
    pad(organ, sc, 4, 0, "B1 F#2 B2", 24, 0.22, att=0.5, rel=0.4, lead=0.0)
    pad(organ, sc, 8, 0, "B1 F2 B2 F3", 24, 0.26, att=0.5, rel=1.6, lead=0.0)
    # cold glass: tremolo near the bridge (sul ponticello), and the dry knock of the bow's wood (col legno)
    for b in range(0, 12, 2):
        pad(strsec, sc, b, 0, "B5 D6 F6", 12, 0.07, att=0.4, rel=0.4, trem=0.7, pont=True, lead=0.0)
    for b in range(4, 12):
        for beat, nm in ((1.5, "F#4"), (4.5, "B3")):
            put("orch", colleg(hz(n(nm)), 0.11 * sc.level), 0.62, sc.time(b, beat))
    # tremolo strings underneath
    for b in range(4):
        pad(strsec, sc, b, 0, "B3 D4 F4 G#4", 6, 0.20, att=0.2, rel=0.2, trem=0.7, lead=0.0, bright=1.1)
    for b in range(4, 8):
        pad(strsec, sc, b, 0, "B3 F#4 D5", 6, 0.22, att=0.2, rel=0.2, trem=0.7, lead=0.0, bright=1.2)
    for b in range(8, 10):
        pad(strsec, sc, b, 0, "B3 F#4 D5", 6, 0.26, att=0.2, rel=0.2, trem=0.7, lead=0.0, bright=1.3)
    pad(strsec, sc, 10, 0, "A#3 C#4 E4 F#4", 6, 0.28, att=0.1, rel=0.2, trem=0.7, lead=0.0, bright=1.3)
    pad(strsec, sc, 11, 0, "B3 F#4 B4 D5", 6, 0.34, att=0.05, rel=1.4, lead=0.0, bright=1.3)
    # the curse is cast: a bell on the tritone, the crows
    for b in (7, 11):
        put("harp", bell(hz(n("B4")), 5.0, 0.12 * sc.level, "tubular"), 0.45, sc.time(b, 3))
        put("harp", bell(hz(n("F5")), 5.0, 0.11 * sc.level, "tubular"), 0.55, sc.time(b, 3))
    roll(sc, 3, 3, 1.3, "B1", 0.08, 0.30)
    roll(sc, 7, 3, 1.3, "B1", 0.10, 0.36)
    roll(sc, 10, 0, 3.0, "F#1", 0.10, 0.50)
    one(timp, "perc", 0.5, sc, 11, 0, "B1", 3.0, 0.80)
    noise_at(sc, 11, 0, 3.0, 0.22, tau=1.6)
    crows(sc, 4, 0, 6.0, 0.08, 7)
    runs(sc, 5, 0, 5.0, 0.12, 5, lo="B3", hi="B5")


def a3b():
    sc = SC["A3b"]
    chords = ["B2 F#3 B3 D4", "E3 B3 G4", "B2 F#3 B3 D4", "G3 B3 D4", "E3 B3 G4", "F#2 A#3 C#4 E4"]
    for b, c in enumerate(chords):
        pad(strsec, sc, b, 0, c, 4, 0.19, att=0.5, rel=0.4, trem=0.4, lead=0.0)
    roll(sc, 1, 0, 3.8, "B1", 0.04, 0.22)
    roll(sc, 3, 0, 3.8, "B1", 0.04, 0.24)
    roll(sc, 5, 0, 4.0, "F#1", 0.05, 0.34)
    # BLACK: the curse theme, low and forceful
    voice(horn, "orch", 0.36, sc, 0, 0, "B2:1.5 D3:.5 F#3:2 E3:1.5 D3:.5 C#3:2", 0.44, bright=1.2)
    voice(cello, "orch", 0.30, sc, 0, 0, "B3:1.5 D4:.5 F#4:2 E4:1.5 D4:.5 C#4:2", 0.30)
    # WHITE: LOVE turned minor (the same tune, a third lower), high and thin
    voice(flute, "lead", 0.64, sc, 2, 0, "F#5:1 B5:2 D6:2 C#6:1", 0.30)
    voice(violin, "lead", 0.56, sc, 2, 0, "F#4:1 B4:2 D5:2 C#5:1", 0.42, swell=0.2)
    # both at once, closer and louder, until they land on the same note
    voice(horn, "orch", 0.36, sc, 4, 0, "D3:1.5 C#3:.5 B2:1 A#2:1 F#2:4", 0.50, bright=1.3)
    voice(violin, "lead", 0.56, sc, 4, 0, "B4:1.5 A#4:.5 G4:1 F#4:3", 0.48, swell=0.2, bright=1.2)
    voice(flute, "lead", 0.64, sc, 4, 0, "B5:1.5 A#5:.5 G5:1 F#5:3", 0.20)


def a3c():
    sc = SC["A3c"]
    for b in range(3):
        for i in range(4):
            put("perc", drum_heart(0.30 * sc.level * (1 - 0.1 * (b + i / 4))), 0.5, sc.time(b, float(i)))
    chords = ["G3 B3 D4 G4", "C3 E3 G3 B3 D4", "D3 A3 F#4 C5"]
    for b, c in enumerate(chords):
        pad(strsec, sc, b, 0, c, 4, 0.16, att=1.2, rel=1.0, voices=3)
        arp = {"G3 B3 D4 G4": "G3 D4 G4 B4 D5 B4", "C3 E3 G3 B3 D4": "C3 G3 E4 B4 D5 B4", "D3 A3 F#4 C5": "D3 A3 F#4 C5 A4 F#4"}[c]
        for j, nm in enumerate(arp.split()):
            one(harp, "harp", 0.25 + 0.08 * j, sc, b, j * 0.66, nm, 2.4, 0.15)
    # SIGH: the apology, plain and quiet
    voice(violin, "lead", 0.52, sc, 0, 0, "D5:2 B4:1 D5:1 C5:2 B4:1 A4:1 A4:1 G4:1 F#4:2", 0.40, swell=0.25, vib=1.1, att=0.15)
    voice(flute, "lead", 0.64, sc, 1, 2, "B5:1 A5:1", 0.10)
    sparkle(sc, 0, 0, "G6 D6 B6 D7", 5, 10, 0.07, kind="glass", dur=2.0)


def a4a():
    sc = SC["A4a"]
    one(sub, "orch", 0.5, sc, 0, 0, "B1", sc.length + 1.5, 0.30, att=2.0, rel=2.0)
    # the lament bass: the descending chromatic tetrachord from the tonic to the dominant, B-A#-A-G#-G-F# (the
    # baroque sign of grief). Above it the harmony hurts: a diminished seventh, a half-diminished step, and at the
    # end F#7 with a flat ninth (G), the dominant that does not dare to resolve.
    for bar, beat, nm, d in [(0, 0, "B2", 4), (1, 0, "A#2", 2), (1, 2, "A2", 2), (2, 0, "G#2", 2), (2, 2, "G2", 2), (3, 0, "F#2", 4)]:
        one(cello, "orch", 0.30, sc, bar, float(beat), nm, sc.dur(bar, beat, d) + 0.3, 0.30, att=0.5, rel=0.9)
    for bar, beat, notes, d in [(0, 0, "F#3 B3 D4 F#4", 4), (1, 0, "C#4 E4 G4", 2), (1, 2, "B3 D4 F#4", 2),
                                (2, 0, "B3 D4 F4", 2), (2, 2, "B3 D4 G4", 2), (3, 0, "A#3 C#4 E4 G4", 4)]:
        pad(strsec, sc, bar, beat, notes, d, 0.12, att=1.6, rel=1.8, tasto=True, voices=2)
    # CURSE again, but now it is the white swan: thin, trembling, and it does not resolve
    voice(violin, "lead", 0.52, sc, 0, 0, "B4:1.5 D5:.5 F#5:2 E5:1.5 D5:.5 C#5:2 D5:1 C#5:1 B4:1 A#4:1 A#4:3", 0.34, vib=1.3, bright=0.85, swell=0.3, att=0.2)
    # single harp notes falling like petals, the frozen rose in glass overtones
    for (b, bt, nm) in [(0, 0, "F#3"), (0, 2, "D4"), (1, 0, "E4"), (1, 2, "B3"), (2, 0, "F4"), (2, 2, "D4"), (3, 0, "E4"), (3, 2, "G4")]:
        one(harp, "harp", 0.35, sc, b, float(bt), nm, 4.0, 0.18)
    for (b, bt, nm) in [(0, 3, "B6"), (1, 3.5, "F#6"), (2, 3, "D7"), (3, 2.5, "B6"), (3, 3.5, "F#7")]:
        one(bell, "harp", 0.70, sc, b, bt, nm, 5.0, 0.06, kind="glass")
    put("orch", band_noise(sc.length, 2000, 7000) * np.sin(np.pi * np.clip(tarr(sc.length) / sc.length, 0, 1)) * 0.02 * sc.level, 0.5, sc.t0)


def a4b():
    sc = SC["A4b"]
    pad(strsec, sc, 0, 0, "B4 E5 G5", 4, 0.07, att=1.5, rel=1.0, tasto=True, voices=2)
    pad(strsec, sc, 1, 0, "B4 D5 G5", 4, 0.07, att=1.0, rel=1.0, tasto=True, voices=2)
    pad(strsec, sc, 2, 0, "A#4 C#5 F#5", 4, 0.08, att=1.0, rel=1.6, tasto=True, voices=2)
    voice(cello, "lead", 0.40, sc, 0, 0, "G3:2 F#3:1 E3:1 B3:2 A3:1 G3:1 F#3:3 A#3:1", 0.46, vib=1.2, att=0.2)
    # petals, falling out of the car window
    pool = "D6 B5 G5 E5 D5 B4 G4".split()
    t0 = sc.t0
    for i in range(14):
        put("harp", harp(hz(n(pool[i % len(pool)])), 3.0, 0.10 * sc.level), rng.uniform(0.25, 0.75), t0 + 0.4 + i * (sc.length - 1.0) / 14 + rng.uniform(-0.1, 0.1))


def a4c():
    sc = SC["A4c"]
    # bar 0-1: the lowest, quietest point, and a first light
    one(cello, "orch", 0.30, sc, 0, 0, "F#2", 8.5, 0.28, att=3.0, rel=1.0)
    pad(strsec, sc, 0, 0, "F#3 C#4 F#4", 4, 0.13, att=1.5, rel=0.8, trem=0.3, voices=2)
    pad(strsec, sc, 1, 0, "F#3 B3 C#4", 2, 0.16, att=0.8, rel=0.6, trem=0.3)
    # the lift before the dawn: bVI (G) then bVII (A) then I (B major), over the F# pedal that never moves
    pad(strsec, sc, 1, 2, "B3 D4 G4", 1, 0.24, att=0.25, rel=0.15, bright=1.2, lead=0.0)
    pad(strsec, sc, 1, 3, "A3 C#4 E4 A4", 1, 0.28, att=0.2, rel=0.15, bright=1.3, lead=0.0)
    pad(horn, sc, 1, 2, "B3 D4", 1, 0.26, att=0.2, rel=0.15, lead=0.0)
    pad(horn, sc, 1, 3, "A3 E4", 1, 0.30, att=0.2, rel=0.15, lead=0.0)
    for j, nm in enumerate("F#3 C#4 F#4 A#4 C#5 F#5".split()):
        one(harp, "harp", 0.25 + 0.1 * j, sc, 0, j * 0.6 + 0.2, nm, 2.4, 0.14)
    voice(reed, "lead", 0.60, sc, 0, 2, "C#5:1 B4:1.5", 0.30)       # SIGH: acceptance
    voice(horn, "orch", 0.40, sc, 1, 0, "B3:.25 D#4:.25 F#4:.25 B4:1.25", 0.40, bright=0.9)   # MOTTO, now major
    roll(sc, 1, 0, 4.0, "F#2", 0.05, 0.40)
    # bar 2: dawn
    gliss(sc, 2, 0, "B3 D#4 F#4 B4 D#5 F#5 B5 D#6 F#6 B6", 0.045, 0.34)
    noise_at(sc, 2, 0, 3.2, 0.30, tau=1.6)
    one(timp, "perc", 0.5, sc, 2, 0, "B1", 3.0, 0.80)
    one(bell, "harp", 0.5, sc, 2, 0, "B3", 7.0, 0.14, kind="tubular")
    pad(organ, sc, 2, 0, "B1 B2 F#3 B3 D#4", 16, 0.16, att=0.6, rel=3.0, lead=0.0)
    pad(choir, sc, 2, 0, "B3 F#4 B4 D#5", 16, 0.26, att=1.0, rel=2.8, lead=0.0, bus="choir")
    full = [("B2 F#3 B3 D#4 F#4", 0), ("E3 B3 G#4 E4", 1), ("C#3 G#3 E4 G#4", 2), ("B2 F#3 B3 D#4 F#4", 3)]
    pad(strsec, sc, 2, 0, "B3 F#4 B4 D#5", 4, 0.36, att=0.15, rel=0.5, bright=1.2, lead=0.0)
    pad(strsec, sc, 3, 0, "E4 B4 G#5", 4, 0.34, att=0.15, rel=0.5, bright=1.2, lead=0.0)
    pad(strsec, sc, 4, 0, "C#4 G#4 E5", 2, 0.34, att=0.15, rel=0.3, bright=1.2, lead=0.0)
    pad(strsec, sc, 4, 2, "F#3 A#3 C#4 E4", 2, 0.34, att=0.15, rel=0.3, bright=1.2, lead=0.0)
    pad(strsec, sc, 5, 0, "B3 F#4 B4 D#5 F#5", 4, 0.38, att=0.3, rel=3.4, bright=1.2, lead=0.0)
    pad(horn, sc, 2, 0, "B2 F#3 D#4", 4, 0.30, att=0.15, rel=0.5, lead=0.0)
    pad(horn, sc, 3, 0, "E2 B2 G#3", 4, 0.30, att=0.15, rel=0.5, lead=0.0)
    pad(horn, sc, 4, 0, "C#3 G#3", 2, 0.30, att=0.15, rel=0.3, lead=0.0)
    pad(horn, sc, 4, 2, "F#2 C#3", 2, 0.32, att=0.15, rel=0.3, lead=0.0)
    pad(horn, sc, 5, 0, "B2 F#3 D#4", 4, 0.34, att=0.3, rel=3.0, lead=0.0)
    one(cello, "orch", 0.30, sc, 2, 0, "B2", 3.9, 0.34, att=0.1)
    one(cello, "orch", 0.30, sc, 3, 0, "E2", 3.9, 0.34, att=0.1)
    one(cello, "orch", 0.30, sc, 4, 0, "C#3", 1.9, 0.34, att=0.1)
    one(cello, "orch", 0.30, sc, 4, 2, "F#2", 1.9, 0.34, att=0.1)
    one(cello, "orch", 0.30, sc, 5, 0, "B2", 4.5, 0.38, att=0.1, rel=2.5)
    # CURSE, set free: the same tune in B major, then the horns shout MOTTO one last time
    voice(violin, "lead", 0.56, sc, 2, 0, "B4:1.5 D#5:.5 F#5:2 E5:1.5 D#5:.5 C#5:2 D#5:1 C#5:1 B4:1 A#4:1 B4:4", 0.56, swell=0.2, bright=1.3, att=0.1)
    voice(flute, "lead", 0.64, sc, 2, 0, "B5:1.5 D#6:.5 F#6:2 E6:1.5 D#6:.5 C#6:2", 0.10)
    voice(horn, "orch", 0.40, sc, 4, 2, "B3:.5a D#4:.5a F#4:.5a B4:2.5", 0.60, bright=1.2)
    one(timp, "perc", 0.5, sc, 5, 0, "B1", 3.0, 0.62)
    for j, nm in enumerate("B3 F#4 B4 D#5 F#5 B5 D#6 F#6".split()):
        one(harp, "harp", 0.25 + 0.07 * j, sc, 5, 0.3 + j * 0.45, nm, 3.5, 0.14)
    sparkle(sc, 5, 1, "B6 D#7 F#6 B5 D#6", 6, 3, 0.07)


SC = {s.name: s for s in SCENES}
FUNCS = {"INTRO": intro, "A1a": a1a, "A1b": a1b, "A1c": a1c, "A2a": a2a, "A2b": a2b, "A2c": a2c, "A3a": a3a, "A3b": a3b, "A3c": a3c, "A4a": a4a, "A4b": a4b, "A4c": a4c}


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


def width_points():
    """(time, stereo width) pairs: narrow and intimate for the quiet scenes, wide for the three climaxes. Width
    only touches what is above ~160 Hz, so the bass stays in the middle, and it never goes beyond 1.35 so that a
    mono speaker or a single earbud still gets the whole orchestra."""
    pts = []

    def at(name, bar, beat, w):
        if name in SC:
            pts.append((SC[name].time(bar, beat), w))
    at("INTRO", 0, 0, 0.85); at("A1a", 0, 0, 0.90); at("A1b", 3, 0, 1.00); at("A1c", 4, 0, 1.00); at("A1c", 6, 0, 1.30)
    at("A1c", 6, 3.9, 1.10); at("A2a", 4, 0, 1.00); at("A2b", 4, 0, 1.10); at("A2c", 1, 0, 0.90); at("A2c", 1, 1, 1.15)
    at("A2c", 2, 0, 1.30); at("A3a", 6, 0, 1.20); at("A3b", 3, 0, 1.10); at("A3c", 1, 0, 0.95); at("A4a", 0, 0, 0.85)
    at("A4b", 0, 0, 0.85); at("A4c", 1, 0, 0.90); at("A4c", 2, 0, 1.35); at("A4c", 4, 0, 1.35); at("A4c", 5, 0, 1.20)
    at("A4c", 5, 3.0, 0.90)
    return sorted(pts)


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
    padded = np.concatenate([mix[-SR:], mix, mix[:SR]])   # the player loops the middle (see background-music.ts)
    peak = np.max(np.abs(padded))
    print(path, "peak %.1f dBFS" % (20 * np.log10(peak)), "loop %.3f s = %d samples" % (len(mix) / SR, len(mix)), "file %.3f s" % (len(padded) / SR))
    pcm = (np.clip(padded, -1, 1) * 32767).astype("<i2")
    wav = path + ".wav"
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", path], check=True)
    return mix


def main():
    for sc in SCENES:
        FUNCS[sc.name]()
    if os.environ.get("HARU_STATS"):      # dry loudness of each bus in each scene (dBFS), to compare balance between runs
        print("bus levels (dB):          " + "  ".join("%6s" % b for b in BUS))
        for sc in SCENES:
            a, b_ = int(sc.t0 * SR), int((sc.t0 + sc.length) * SR)
            print("%-6s              " % sc.name + "  ".join("%6.1f" % (20 * np.log10(np.sqrt(np.mean(BUS[k][a:b_] ** 2) * 2) + 1e-9)) for k in BUS))
    curve = smooth_curve()
    send = sum(BUS[b] * SEND[b] for b in BUS) * curve[:, None]
    wet = hall(send.astype(np.float32))
    gate = np.ones(N, np.float32)
    for g0, g1 in WET_GATES:
        a, b = int(g0 * SR), int(g1 * SR)
        gate[a:b] = 0.03
        k = int(0.03 * SR)
        gate[a - k:a] = np.linspace(1, 0.03, k)
        gate[b:b + k] = np.linspace(0.03, 1, k)
    wet = wet * gate[:, None]
    dry = sum(BUS[b] * GAIN[b] for b in BUS)
    mix = fft_hp(dry + 0.9 * wet.astype(np.float32), 45)
    mix = fft_lp(mix, 12500 if LIB is not None else 9000, 2)
    if LIB is not None:      # recorded violins and cymbals are brighter than the synth was: take 3.5 dB off above ~3 kHz
        low = fft_lp(mix, 3200, 1)
        mix = low + (mix - low) * 10 ** (-3.5 / 20)
    mix = widen(mix.astype(np.float32), width_points())
    mix, env, g = level_ride(mix.astype(np.float32), strength=RIDE)
    name = "ballet-thien-nga-v3.m4a" if not SOLO else f"solo-{SOLO}.m4a"
    out = write_out(mix, f"{OUT}/{name}")
    if FALLBACK:
        print("notes outside the recorded range (played by the synth instead):", dict(sorted(FALLBACK.items())))
    # a report for the story map: start time and loudness of every scene
    print("scene       start    len   rms(dBFS)")
    for sc in SCENES:
        a, b = int(sc.t0 * SR), int((sc.t0 + sc.length) * SR)
        r = np.sqrt(np.mean(out[a:b].astype(np.float64) ** 2))
        print("%-6s %8.1f %6.1f   %6.1f   %s" % (sc.name, sc.t0, sc.length, 20 * np.log10(r), sc.story))


if __name__ == "__main__":
    main()
