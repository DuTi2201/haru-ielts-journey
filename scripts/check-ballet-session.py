#!/usr/bin/env python3
"""Numbers for the 15-minute study track (gen-ballet-session.py): is it really 15:00.000 and seamless, does its loudness
follow the arc it was written with, and does the harmony it plays match the score?

  python3 scripts/check-ballet-session.py public/music/ballet-thien-nga-phien-hoc-15p.m4a

The app plays the file with an <audio loop> element, so the file is exactly the loop (a file written with
HARU_PADDED=1 has a 1 s pad at each end instead; the script tells them apart by their length). Needs numpy and ffmpeg."""
import subprocess
import sys

import numpy as np

SR = 44100
LOOP = 900.0
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
CHORDS = {  # root pitch class, quality
    "A": (9, "maj"), "F#m": (6, "min"), "D": (2, "maj"), "E": (4, "maj"), "Bm": (11, "min"), "G": (7, "maj"),
    "Em": (4, "min"), "F#": (6, "maj"), "B": (11, "maj"), "G#m": (8, "min"),
}


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2)


def chroma(x, a, b):
    seg = x[int(a * SR):int(b * SR)] * np.hanning(int(b * SR) - int(a * SR))
    S = np.abs(np.fft.rfft(seg)) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    ok = (f > 55) & (f < 2000)
    pc = np.round(12 * np.log2(f[ok] / 440.0) + 9).astype(int) % 12
    c = np.bincount(pc, weights=S[ok], minlength=12)
    return c / (c.sum() + 1e-12)


def best_chord(c):
    best, score = None, -1
    for nm, (r, q) in CHORDS.items():
        tri = [r, (r + (4 if q == "maj" else 3)) % 12, (r + 7) % 12]
        s = sum(c[i] for i in tri) - 0.5 * sum(c[i] for i in range(12) if i not in tri)
        if s > score:
            best, score = nm, s
    return best


def main(path):
    x = decode(path)
    n_total = len(x)
    pad = 0.0 if abs(n_total / SR - LOOP) < 0.5 else 1.0
    n_loop = n_total - 2 * int(pad * SR)
    print("file: %.3f s (%d samples)%s; the loop: %.3f s (%d samples; the score has %d)"
          % (n_total / SR, n_total, " with a 1 s pad at each end" if pad else ", no pads", n_loop / SR, n_loop, int(LOOP * SR)))
    lo = x[int(pad * SR):int(pad * SR) + n_loop]
    m = lo.mean(axis=1)
    peak = np.abs(x).max()
    print("peak %.1f dBFS, samples above 0.999: %d, rms %.1f dBFS" % (20 * np.log10(peak), int((np.abs(x) > 0.999).sum()),
                                                                     20 * np.log10(np.sqrt(np.mean(lo.astype(np.float64) ** 2)))))
    # ---- the seam: the end of the loop followed by its beginning
    k = int(0.5 * SR)
    seam = np.concatenate([m[-k:], m[:k]])
    step = np.abs(np.diff(seam))
    typical = np.median(np.abs(np.diff(m[SR * 60:SR * 61])))
    print("seam: largest sample-to-sample step across the join %.5f (a typical step in the music: %.5f, its 99.9th percentile %.5f)"
          % (step[k - 3:k + 3].max(), typical, np.percentile(np.abs(np.diff(m[SR * 60:SR * 120])), 99.9)))
    for name, a, b in (("last 3 s", -3.0, 0.0), ("first 3 s", 0.0, 3.0)):
        seg = m[int(a * SR):] if b == 0 else m[:int(b * SR)]
        print("  %-9s rms %.1f dBFS" % (name, 20 * np.log10(np.sqrt(np.mean(seg ** 2)))))
    # ---- loudness per minute and per section
    print("\nloudness (rms dBFS) per minute:")
    mins = [20 * np.log10(np.sqrt(np.mean(m[int(i * 60 * SR):int((i + 1) * 60 * SR)] ** 2)) + 1e-9) for i in range(15)]
    print("  " + "  ".join("%2d:%5.1f" % (i, v) for i, v in enumerate(mins)))
    sec = {"I vào việc 0:00-2:06": (0, 126), "II tập trung 2:06-11:06": (126, 666), "III nước rút 11:06-13:30": (666, 810), "IV hạ cánh 13:30-15:00": (810, 900),
           "đỉnh 12:34-13:12": (754, 792)}
    for k_, (a, b) in sec.items():
        print("  %-26s %.1f dBFS" % (k_, 20 * np.log10(np.sqrt(np.mean(m[int(a * SR):int(b * SR)] ** 2)))))
    plat = [20 * np.log10(np.sqrt(np.mean(m[int(t * SR):int((t + 18) * SR)] ** 2))) for t in range(126, 666, 18)]
    print("  plateau, per 18 s phrase: min %.1f, max %.1f, spread %.1f dB (a spread under ~3 dB means nothing in the plateau stands out)" % (min(plat), max(plat), max(plat) - min(plat)))
    # ---- harmony: the opening progression, chord by chord (4.5 s each), over the first 72 s
    print("\nopening progression, 16 chords of 4.5 s (the score: A F#m D E, four times):")
    got = [best_chord(chroma(m, 2.25 * 2 * i + 0.3, 2.25 * 2 * (i + 1) - 0.3)) for i in range(16)]
    print("  " + " ".join(got))
    # ---- the mode at dawn: D natural (minor) or D# (major)?
    for nm, a, b in (("1:12-1:30 (B minor arrival)", 72, 90), ("12:36-12:54 (the dawn)", 756, 774)):
        c = chroma(m, a, b)
        print("%-30s D %.3f   D# %.3f   F# %.3f   B %.3f  -> %s" % (nm, c[2], c[3], c[6], c[11], "major third" if c[3] > c[2] else "minor third"))
    # ---- how busy is it? note onsets (spectral flux peaks) per minute
    print("\nonsets per minute (spectral flux peaks):")
    hop, nfft = 1024, 2048
    win = np.hanning(nfft)
    nfr = (len(m) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(nfr)[:, None]
    flux = np.zeros(nfr)
    prev = None
    for s in range(0, nfr, 4096):
        blk = idx[s:s + 4096]
        mag = np.abs(np.fft.rfft(m[blk] * win, axis=1))
        mag = np.log1p(30 * mag)
        d = np.concatenate([[mag[0] * 0] if prev is None else [mag[0] - prev], np.diff(mag, axis=0)])
        flux[s:s + len(blk)] = np.maximum(d, 0).sum(axis=1)
        prev = mag[-1]
    thr = np.median(flux) + 1.5 * flux.std()
    pk = (flux[1:-1] > flux[:-2]) & (flux[1:-1] >= flux[2:]) & (flux[1:-1] > thr)
    per_min = np.bincount(((np.where(pk)[0] + 1) * hop / SR // 60).astype(int), minlength=15)[:15]
    print("  " + "  ".join("%2d:%3d" % (i, v) for i, v in enumerate(per_min)))


if __name__ == "__main__":
    main(sys.argv[1])
