#!/usr/bin/env python3
"""Prepare the two extra sample sets used by gen-ballet-session.py (the 15-minute study track).

  piano   Splendid Grand Piano (Steinway, AKAI; public domain), https://github.com/sfzinstruments/SplendidGrandPiano
          -> FLAC converted to WAV (the sampler reads WAV only) + a plain note map `piano.sfz`.
  guitar  Karoryfer "Black And Green Guitars" (a Gretsch hollow-body, CC0 1.0),
          https://github.com/sfzinstruments/karoryfer.black-and-green-guitars  (release zip, ~480 MB)
          -> only the ordinary (sustained) notes of the green guitar are unpacked + a plain map `gretsch.sfz`.

The recordings are NOT part of this repository (hundreds of MB). Run once:

  python3 scripts/prepare-session-samples.py --piano-repo <clone of SplendidGrandPiano> \\
        --guitar-zip <Karoryfer_Black_And_Green_Guitars_1000.zip> --out <dir>

then render with  PIANO_DIR=<dir>/piano GUITAR_DIR=<dir>/guitar VSCO_DIR=<VSCO-2-CE checkout> python3 scripts/gen-ballet-session.py ...
(needs ffmpeg for the piano's FLAC files; the zip is untrusted data and is only read, never executed).
"""
import argparse
import os
import re
import subprocess
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vsco_sampler as vs   # noqa: E402  (only for its SFZ parser)

# Splendid Grand Piano: four recorded dynamics, mapped to velocity ranges like the original SFZ does.
PIANO_LAYERS = {"PP": (1, 67), "MP": (68, 84), "MF": (85, 100), "FF": (101, 127)}


def piano(repo, out):
    os.makedirs(out, exist_ok=True)
    regs, files = [], set()
    for layer, (lo_v, hi_v) in PIANO_LAYERS.items():
        for line in open(os.path.join(repo, "Data", layer + ".txt"), encoding="latin-1"):
            m = re.search(r"lokey=(\d+) hikey=(\d+) pitch_keycenter=(\d+).*?sample=(.+?)\.\$EXT", line)
            if m:
                regs.append((int(m[1]), int(m[2]), int(m[3]), lo_v, hi_v, m[4]))
                files.add(m[4])
    lines = ["<control>", "default_path="]
    for lo, hi, kc, lv, hv, name in regs:
        lines.append("<region> lokey=%d hikey=%d pitch_keycenter=%d lovel=%d hivel=%d sample=%s.wav"
                     % (lo, hi, kc, lv, hv, name.replace(" ", "_")))
    with open(os.path.join(out, "piano.sfz"), "w") as f:
        f.write("\n".join(lines) + "\n")
    for name in sorted(files):
        dst = os.path.join(out, name.replace(" ", "_") + ".wav")
        if not os.path.exists(dst):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(repo, "Samples", name + ".flac"),
                            "-c:a", "pcm_s16le", dst], check=True)
    print("piano: %d recordings, %d regions -> %s" % (len(files), len(regs), out))


def guitar(zip_path, out):
    os.makedirs(out, exist_ok=True)
    z = zipfile.ZipFile(zip_path)
    names = z.namelist()
    if any(x.startswith("/") or ".." in x.split("/") for x in names):
        sys.exit("the zip has unsafe paths; refusing to unpack it")
    wanted = [x for x in names if x.startswith("Samples/green/ord/") or x == "LICENSE" or x == "readme.txt"
              or x == "Programs/modules/maps_green/ord.sfz"]
    z.extractall(out, members=wanted)
    ctrl, regs = vs.parse_sfz(os.path.join(out, "Programs/modules/maps_green/ord.sfz"))
    lines, seen = ["<control>", "default_path="], set()
    for r in regs:
        lo, hi = int(r["lokey"]), int(r["hikey"])
        kc = int(r.get("pitch_keycenter", lo))
        lv, hv = int(r.get("lovel", 0)), int(r.get("hivel", 127))
        s = r["sample"].replace("../", "")
        k = (s, lo, hi, kc, lv, hv)
        if k in seen or not os.path.exists(os.path.join(out, s)):
            continue
        seen.add(k)
        lines.append("<region> lokey=%d hikey=%d pitch_keycenter=%d lovel=%d hivel=%d sample=%s" % (lo, hi, kc, lv, hv, s))
    with open(os.path.join(out, "gretsch.sfz"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("guitar: %d regions -> %s" % (len(lines) - 2, out))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--piano-repo", required=True)
    ap.add_argument("--guitar-zip", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    piano(a.piano_repo, os.path.join(a.out, "piano"))
    guitar(a.guitar_zip, os.path.join(a.out, "guitar"))
