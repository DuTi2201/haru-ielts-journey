# NOTE: the "ballet" adagio loop below is superseded by scripts/gen-ballet-swan.py (the app now plays that one).
# Usage: python3 scripts/gen-music.py public/music [lofi|aria|ballet|both]   (needs numpy + ffmpeg)
# Regenerates the focus-music loops in public/music ("both" = all three). Original synthesis, so no licence applies.
"""Original focus-music loops, synthesised from scratch (no samples, no third-party recordings, so
no licence to track). Everything is rendered into a *circular* buffer (notes wrap past the end,
filters and reverb are FFT-circular), so the loop point is seamless by construction."""
import os, subprocess, sys
import numpy as np

SR = 44100
OUT = sys.argv[1]


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)


def pan(sig, p):  # p in 0..1
    th = p * np.pi / 2
    return np.stack([sig * np.cos(th), sig * np.sin(th)], 1)


def place(buf, sig, start):
    n, N = len(sig), buf.shape[0]
    s = int(start) % N
    e = s + n
    if e <= N:
        buf[s:e] += sig
    else:
        k = N - s
        buf[s:] += sig[:k]
        buf[: e - N] += sig[k:]


def tail(t, dur, r=0.2):
    return np.clip((dur - t) / r, 0, 1)


def rhodes(f, dur, vel=1.0):
    t = np.arange(int(SR * dur)) / SR
    idx = 1.5 * np.exp(-t / 0.3) + 0.12
    m = np.sin(2 * np.pi * f * t)
    car = np.sin(2 * np.pi * f * t + idx * m)
    bell = 0.10 * np.sin(2 * np.pi * f * 6.9 * t) * np.exp(-t / 0.07)
    return vel * (car + bell) * np.minimum(1, t / 0.004) * np.exp(-t / 1.2) * tail(t, dur)


def pluck(f, dur, vel=1.0, tau0=1.5):
    t = np.arange(int(SR * dur)) / SR
    sig = 0
    for k in range(1, 9):
        sig = sig + (1 / k ** 1.25) * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(
            -t / (tau0 / (1 + 0.6 * (k - 1))))
    return vel * sig * np.minimum(1, t / 0.003) * tail(t, dur)


def pad(f, dur, vel=1.0, att=1.0, rel=1.2):
    t = np.arange(int(SR * dur)) / SR
    s = 0
    for det in (-0.004, 0.0, 0.004):
        ff = f * (1 + det)
        s = s + np.sin(2 * np.pi * ff * t) + 0.35 * np.sin(2 * np.pi * 2 * ff * t) + 0.12 * np.sin(2 * np.pi * 3 * ff * t)
    return vel * s / 3 * np.minimum(1, t / att) * tail(t, dur, rel)


def bass(f, dur, vel=1.0):
    t = np.arange(int(SR * dur)) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    return vel * s * np.minimum(1, t / 0.012) * np.exp(-t / 1.3) * tail(t, dur, 0.25)


def kick(vel=1.0):
    t = np.arange(int(SR * 0.4)) / SR
    ph = 2 * np.pi * (45 * t + 45 * 0.06 * (1 - np.exp(-t / 0.06)) * 1.0 + 40 * 0.05 * (1 - np.exp(-t / 0.05)))
    return vel * np.sin(ph) * np.exp(-t / 0.12) * np.minimum(1, t / 0.002)


def noise_hit(rng, dur, tau, lo_cut=True, vel=1.0):
    t = np.arange(int(SR * dur)) / SR
    x = rng.standard_normal(len(t))
    if lo_cut:
        x = np.diff(x, prepend=0)
    return vel * x * np.exp(-t / tau) * np.minimum(1, t / 0.001)


def fft_lp(x, fc, order=4):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    g = 1 / np.sqrt(1 + (f / fc) ** (2 * order))
    return np.fft.irfft(X * g[:, None], n=x.shape[0], axis=0)


def fft_hp(x, fc):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    g = (f / fc) ** 2 / (1 + (f / fc) ** 2)
    return np.fft.irfft(X * g[:, None], n=x.shape[0], axis=0)


def reverb(x, rng, rt=2.4, wet=0.3, lp=3500):
    N = x.shape[0]
    n_ir = int(SR * rt * 1.4)
    t = np.arange(n_ir) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n_ir) * np.exp(-t * 6.9 / rt)
        ir[: int(0.02 * SR)] = 0
        ir = fft_lp(ir[:, None], lp, 2)[:, 0]
        ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        pad_ir = np.zeros(N)
        pad_ir[:n_ir] = ir
        out[:, ch] = np.fft.irfft(np.fft.rfft(x[:, ch]) * np.fft.rfft(pad_ir), n=N)
    return x * (1 - wet * 0.5) + out * wet


def finish(mix, rng, path, lp, rt, wet, rms_db=-19.0, roll=0.0):
    mix = fft_hp(mix, 55)
    mix = reverb(mix, rng, rt=rt, wet=wet)
    mix = fft_lp(mix, lp)
    rms = np.sqrt(np.mean(mix ** 2))
    mix = mix * (10 ** (rms_db / 20) / rms)
    mix = np.roll(mix, -int(roll * SR), axis=0)  # put the loop point between hits (circular, so exact)
    mix = np.tanh(mix * 1.2) / 1.2  # gentle ceiling, no clipping
    mix = np.concatenate([mix[-SR:], mix, mix[:SR]])  # 1 s of the loop's end before and its start after: the player loops the middle, so the join never touches the codec's edge frames
    peak = np.max(np.abs(mix))
    print(path, "peak dBFS %.1f" % (20 * np.log10(peak)), "dur %.1fs" % (len(mix) / SR))
    pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
    wav = path + ".wav"
    with open(wav, "wb") as fh:
        import wave
        w = wave.open(fh, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", path], check=True)
    os.remove(wav)


def lofi(path):
    rng = np.random.default_rng(11)
    bpm = 68; beat = 60 / bpm; bar = 4 * beat; bars = 32
    N = int(round(bars * bar * SR)); buf = np.zeros((N, 2))
    prog = [  # (voicing, bass)
        ([59, 62, 64, 67], 48), ([57, 60, 64, 67], 45), ([57, 60, 62, 65], 50), ([59, 62, 65, 67], 43),
        ([59, 62, 64, 67], 52), ([57, 60, 64, 67], 45), ([57, 60, 62, 65], 50), ([59, 62, 65, 67], 43),
    ]
    penta = [72, 74, 76, 79, 81, 84]
    last = 76
    for b in range(bars):
        v, bs = prog[b % 8]; t0 = b * bar
        # pad + bass
        for m in v:
            place(buf, pan(pad(hz(m - 12), bar + 1.4, 0.16), 0.5 + rng.uniform(-.2, .2)), (t0 - 0.2) * SR)
        place(buf, pan(bass(hz(bs), bar * 0.95, 0.9), 0.5), t0 * SR)
        place(buf, pan(bass(hz(bs), bar * 0.45, 0.6), 0.5), (t0 + 2.5 * beat) * SR)
        # comping: rolled chord on 1 and a lighter one on the "and" of 3
        for when, vel in ((0.0, 0.5), (2.5, 0.32)):
            for i, m in enumerate(v):
                place(buf, pan(rhodes(hz(m), 4.5, vel * rng.uniform(.85, 1.05)), 0.5 + rng.uniform(-.18, .18)),
                      (t0 + when * beat + i * 0.028 + rng.uniform(0, .01)) * SR)
        # sparse melody
        pool = sorted(set(penta + [m + 12 for m in v]))
        pos = 0
        while pos < 8:
            if rng.random() < 0.38:
                cand = [p for p in pool if abs(p - last) <= 5 and p != last] or pool
                last = int(rng.choice(cand))
                swing = 0.06 * beat if pos % 2 else 0
                place(buf, pan(rhodes(hz(last), 3.0, 0.42), 0.62), (t0 + pos * beat / 2 + swing) * SR)
                pos += int(rng.choice([2, 3, 4]))
            else:
                pos += 1
        # drums (very soft): kick 1 & 3&, rim on 2 & 4, swung hats
        place(buf, pan(kick(0.55), 0.5), t0 * SR)
        place(buf, pan(kick(0.38), 0.5), (t0 + 2.5 * beat) * SR)
        for bt in (1, 3):
            place(buf, pan(noise_hit(rng, 0.18, 0.045, True, 0.045), 0.47), (t0 + bt * beat) * SR)
        for k in range(8):
            sw = 0.07 * beat if k % 2 else 0
            place(buf, pan(noise_hit(rng, 0.06, 0.012, True, 0.02 * (1.4 if k % 2 == 0 else 0.8)), 0.6),
                  (t0 + k * beat / 2 + sw) * SR)
    finish(buf, rng, path, lp=4800, rt=2.2, wet=0.30, roll=0.41 * beat)


def aria(path):
    rng = np.random.default_rng(5)
    bpm = 60; beat = 1.0; bar = 4.0; bars = 24
    N = int(round(bars * bar * SR)); buf = np.zeros((N, 2))
    prog = [  # (4 ascending chord tones, bass)
        ([55, 59, 62, 67], 43), ([54, 57, 62, 66], 50), ([55, 59, 64, 67], 52), ([54, 59, 62, 66], 47),
        ([55, 60, 64, 67], 48), ([55, 59, 62, 67], 43), ([55, 60, 64, 67], 48), ([57, 62, 66, 69], 50),
    ]
    patt = [0, 2, 1, 3, 2, 3, 1, 2]
    last = 79
    for b in range(bars):
        v, bs = prog[b % 8]; t0 = b * bar
        for m in v[:3]:
            place(buf, pan(pad(hz(m - 12), bar + 2.0, 0.13, att=1.6, rel=1.8), 0.5 + rng.uniform(-.25, .25)), (t0 - 0.3) * SR)
        place(buf, pan(bass(hz(bs), bar, 0.8), 0.5), t0 * SR)
        for k, ix in enumerate(patt):
            place(buf, pan(pluck(hz(v[ix]), 3.2, 0.34 * rng.uniform(.85, 1.05)), 0.38 + 0.24 * (ix / 3)),
                  (t0 + k * beat / 2 + rng.uniform(0, .006)) * SR)
        for k in range(4):  # one melody note every 2 beats, some rests
            if rng.random() < 0.28: continue
            tones = [m + 12 for m in v] + [m + 24 for m in v[:2]]
            cand = [p for p in tones if abs(p - last) <= 5 and p != last] or tones
            last = int(rng.choice(cand))
            place(buf, pan(pluck(hz(last), 3.8, 0.42, tau0=2.0), 0.66), (t0 + k * beat) * SR)
    finish(buf, rng, path, lp=6500, rt=2.8, wet=0.34)


# ---- ballet adagio: B minor, 56 dotted-quarter/min, 6/8. Harp arpeggios, a string pad, a solo reed
# melody and a low cello. The melody and harmony are written here, in the *manner* of a romantic
# ballet adagio (no existing score, no samples), so no licence applies. 48 bars = 102.857 s.
BPM = 56.0                      # dotted quarter
EIGHTH = 60.0 / BPM / 3         # 0.357 s
BAR = 6 * EIGHTH                # 2.143 s
BARS = 48
N_SEC = 8                       # bars per section


def vib_t(t, rate, depth, delay, rng):
    ph = rng.uniform(0, 2 * np.pi)
    return depth * np.minimum(1, np.maximum(0, (t - delay) / 0.5)) * np.sin(2 * np.pi * rate * t + ph)


def harp(f, dur, vel):
    t = np.arange(int(SR * dur)) / SR
    s = 0
    for k in range(1, 9):
        s = s + (1 / k ** 1.35) * np.sin(2 * np.pi * f * k * (1 + 0.0003 * k * k) * t) * np.exp(-t / (2.6 / (1 + 0.55 * (k - 1))))
    return vel * s * np.minimum(1, t / 0.0025) * tail(t, dur, 0.4)


def strings(f, dur, vel, rng, att=1.3, rel=1.6):
    """ensemble: 5 slightly detuned voices, each with its own slow vibrato; soft top end."""
    t = np.arange(int(SR * dur)) / SR
    s = 0
    for det in (-0.006, -0.003, 0.0, 0.003, 0.006):
        v = vib_t(t, rng.uniform(4.6, 5.4), 0.0035, 0.2, rng)
        ph = 2 * np.pi * np.cumsum(f * (1 + det + v)) / SR
        for k in range(1, 8):
            s = s + (1 / k ** 1.5) * np.sin(k * ph)
    env = np.minimum(1, t / att) ** 1.5 * tail(t, dur, rel)
    return vel * s / 5 * env


def cello(f, dur, vel, rng, att=0.28, rel=0.5):
    t = np.arange(int(SR * dur)) / SR
    v = vib_t(t, 5.0, 0.0045, 0.3, rng)
    ph = 2 * np.pi * np.cumsum(f * (1 + v)) / SR
    s = sum((1 / k ** 1.15) * np.sin(k * ph) for k in range(1, 10))
    return vel * s * np.minimum(1, t / att) * tail(t, dur, rel)


def reed(f, dur, vel, rng, att=0.10, rel=0.30):
    """solo reed (oboe-like): formant around 1.2 kHz, delayed vibrato, a breath of noise at the onset."""
    t = np.arange(int(SR * dur)) / SR
    v = vib_t(t, 5.3, 0.0050, 0.35, rng)
    ph = 2 * np.pi * np.cumsum(f * (1 + v)) / SR
    s = 0
    for k in range(1, 13):
        fk = f * k
        formant = 0.35 + np.exp(-((fk - 1250) / 900) ** 2)
        s = s + (formant / k ** 0.8) * np.sin(k * ph)
    env = np.minimum(1, t / att) * tail(t, dur, rel) * (1 + 0.06 * np.sin(2 * np.pi * 0.8 * t))
    n = rng.standard_normal(len(t))
    n = np.convolve(n, np.ones(12) / 12, mode="same") * np.exp(-t / 0.05) * 0.05
    return vel * (s * 0.28 * env + n)


def flute(f, dur, vel, rng):
    t = np.arange(int(SR * dur)) / SR
    v = vib_t(t, 5.0, 0.004, 0.4, rng)
    ph = 2 * np.pi * np.cumsum(f * (1 + v)) / SR
    s = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    return vel * s * np.minimum(1, t / 0.13) * tail(t, dur, 0.35)


# ----- harmony: one chord per bar (root MIDI below the staff, quality) --------------------------
def ch(root, q): return (root, q)
Bm, G, D, A = ch(47, "m"), ch(43, "M"), ch(50, "M"), ch(45, "M")
Em, F, Bm_D = ch(52, "m"), ch(42, "M"), ch(50, "m")  # F = F# major (ch 42 = F#2)
Gm_ = G
PROG_A = [Bm, G, D, A, Bm, G, Em, F]
PROG_B = [Em, (50, "m"), G, (42 + 8, "M"), Em, (50, "m"), F, F]            # Em | Bm/D | G | D/F# | Em | Bm/D | F# | F#
PROG_C = [D, (45, "M"), Bm, (42 + 12, "m"), G, (42 + 8, "M"), (52, "m"), A]  # D | A | Bm | F#m | G | D/F# | Em | A
PROG_D = [Bm, G, D, A, Bm, Em, F, F]
SECTIONS = [  # (progression, loudness, tag)
    (PROG_A, 0.84, "A"), (PROG_A, 0.90, "A2"), (PROG_B, 0.96, "B"),
    (PROG_A, 0.88, "A3"), (PROG_C, 0.93, "C"), (PROG_D, 0.78, "coda"),
]

# melody per section: (eighth offset from section start, midi, length in eighths)
MEL_A = [(0, 78, 3), (3, 74, 3), (6, 71, 4), (10, 74, 2), (12, 78, 3), (15, 76, 3), (18, 73, 6),
         (24, 78, 3), (27, 81, 3), (30, 79, 4), (34, 78, 2), (36, 76, 3), (39, 71, 3), (42, 73, 3), (45, 70, 3)]
MEL_B = [(0, 79, 6), (6, 78, 3), (9, 74, 3), (12, 74, 3), (15, 71, 3), (18, 78, 4), (22, 76, 2),
         (24, 79, 3), (27, 83, 3), (30, 81, 4), (34, 78, 2), (36, 78, 3), (39, 76, 3), (42, 73, 3), (45, 70, 3)]
MEL_C = [(0, 74, 3), (3, 78, 3), (6, 76, 3), (9, 73, 3), (12, 74, 3), (15, 78, 3), (18, 78, 3), (21, 73, 3),
         (24, 79, 4), (28, 78, 2), (30, 78, 3), (33, 74, 3), (36, 76, 3), (39, 79, 3), (42, 76, 3), (45, 73, 3)]
MEL_D = [(0, 78, 6), (6, 74, 6), (12, 78, 6), (18, 76, 6), (24, 74, 6), (30, 71, 6), (36, 70, 6), (42, 73, 6)]
MELODY = {"A": MEL_A, "A2": MEL_A, "B": MEL_B, "A3": MEL_A, "C": MEL_C, "coda": MEL_D}


def chord_tones(root, q):
    third = 3 if q == "m" else 4
    return [root, root + 7, root + 12, root + 12 + third, root + 19, root + 24]


def ballet(path):
    rng = np.random.default_rng(23)
    N = int(round(BARS * BAR * SR)); buf = np.zeros((N, 2))
    for si, (prog, loud, tag) in enumerate(SECTIONS):
        s0 = si * N_SEC * BAR
        for bi, (root, q) in enumerate(prog):
            t0 = s0 + bi * BAR
            tones = chord_tones(root, q)
            # harp: six eighths up (even bars) or a rocking up-down figure (odd bars)
            order = [0, 1, 2, 3, 4, 5] if bi % 2 == 0 else [0, 2, 1, 3, 2, 4]
            if tag in ("coda",): order = [0, 2, 3, 5, 3, 2]
            for k, ix in enumerate(order):
                m = tones[ix]
                v = loud * (0.30 + 0.06 * (k == 0)) * rng.uniform(.88, 1.06)
                place(buf, pan(harp(hz(m), 3.4, v), 0.28 + 0.44 * (ix / 5)), (t0 + k * EIGHTH + rng.uniform(0, 0.008)) * SR)
            # strings: three-note voicing, a swell per bar-pair, overlapping
            third = 3 if q == "m" else 4
            voic = [root + 24 - 12, root + 24 - 12 + third, root + 31 - 12]  # R, 3rd, 5th around the middle
            for j, m in enumerate(voic):
                place(buf, pan(strings(hz(m), BAR * 2 + 1.6, loud * 0.13, rng), 0.35 + 0.15 * j), (t0 - 0.35) * SR) if bi % 2 == 0 else None
            # low cello: the root, once a bar
            place(buf, pan(cello(hz(root), BAR * 0.97, loud * 0.36, rng), 0.45), t0 * SR)
        # melody: solo reed; flute an octave above (very soft) in the repeat, cello an octave below in A3
        for off, m, ln in MELODY[tag]:
            t = s0 + off * EIGHTH
            dur = ln * EIGHTH + 0.10
            lead_v = loud * (0.62 if tag != "coda" else 0.56)
            place(buf, pan(reed(hz(m), dur, lead_v, rng), 0.58), t * SR)
            if tag == "A2":
                place(buf, pan(flute(hz(m + 12), dur, loud * 0.10, rng), 0.66), t * SR)
            if tag == "A3":
                place(buf, pan(cello(hz(m - 12), dur, loud * 0.30, rng), 0.40), t * SR)
    finish(buf, rng, path, lp=5200, rt=3.4, wet=0.42, rms_db=-19.0)


which = sys.argv[2] if len(sys.argv) > 2 else "both"
if which in ("both", "lofi"): lofi(OUT + "/lofi-tap-trung.m4a")
if which in ("both", "aria"): aria(OUT + "/aria-nhe.m4a")
if which in ("both", "ballet"): ballet(OUT + "/ballet-adagio.m4a")
