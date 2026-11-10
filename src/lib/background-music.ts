/** Nhạc nền tập trung: một vòng nhạc không lời phát lặp lại sau lưng bài học.
 *
 *  - Âm lượng người học chỉnh được trong 5–35% (mặc định 30%), không bao giờ tới 40%.
 *  - Khi có tiếng của bài học (audio bài nghe, podcast, giọng đọc từ vựng/câu, đọc máy), nhạc tự
 *    nhỏ xuống 7% rồi trở lại sau khi hết tiếng. Khi đang ghi âm (micro mở) nhạc tắt hẳn, để tiếng
 *    nhạc không lọt vào bản ghi.
 *  - Hai cách phát:
 *      "buffer"  (lofi, aria, ballet 4 phút): Web Audio. Vòng lặp liền mạch tuyệt đối (có 1 giây đệm
 *                hai đầu để chỗ nối không chạm vào khung đầu/cuối của bộ giải mã AAC) và âm lượng chỉnh
 *                được trên iOS. Chỉ giữ một bản đã giải mã trong bộ nhớ: ballet 4 phút nặng ~100 MB.
 *      "element" (ballet 15 phút): thẻ <audio loop>, phát thẳng từ mạng, không giải mã vào bộ nhớ (15
 *                phút giải mã ra ~320 MB). Đây là cách duy nhất điện thoại cho phát tiếp khi tắt màn hình
 *                hoặc chuyển app, kèm nút trên màn hình khóa (Media Session). Chỗ nối vòng có thể hở vài
 *                chục mili giây; bản nhạc được viết để chỗ đó rất nhỏ tiếng.
 *    Trên iOS `audio.volume` bị bỏ qua, nên thẻ <audio> đi qua Web Audio (MediaElementSource + gain).
 *  - Nhạc KHÔNG bị tắt khi ẩn trang: người học bật nhạc rồi khóa màn hình vẫn nghe tiếp; tắt bằng
 *    công tắc trong ứng dụng hoặc nút dừng ở màn hình khóa.
 *  - Trình duyệt chỉ cho phát tiếng sau một lần chạm: nếu lần trước người học để nhạc bật, lần chạm
 *    đầu tiên trong phiên mới sẽ khởi động nhạc.
 *
 *  - Người mới vào (chưa từng chỉnh nhạc trên máy này): nhạc BẬT sẵn, bản "Ballet giao hưởng", âm
 *    lượng 15%. Trình duyệt vẫn chặn tiếng cho tới lần chạm/nhấn phím đầu tiên trên trang (kể cả
 *    trang chủ "/"), nên nhạc vào ngay lần chạm đó; trình duyệt nào cho phép thì phát luôn.
 *
 *  Lựa chọn (bật/tắt, âm lượng, bản nhạc) nhớ trên máy này (localStorage), không lên server: ai đã
 *  tắt nhạc thì lần sau vẫn tắt. */
import { useSyncExternalStore } from "react";

import { readLocal, writeLocal } from "@/lib/lesson-local";

export const MUSIC_MIN_VOLUME = 0.05;
export const MUSIC_MAX_VOLUME = 0.35;
/** For a newcomer (no choice saved on this device). */
export const MUSIC_DEFAULT_VOLUME = 0.15;
export const MUSIC_DEFAULT_TRACK = "ballet";
/** Mức nhạc khi có tiếng bài học (5–9% theo yêu cầu). */
export const MUSIC_DUCKED_VOLUME = 0.07;

/** Giây đệm ở đầu và cuối file (xem gen_music: [1 s cuối vòng][vòng][1 s đầu vòng]). */
const PAD_SECONDS = 1;

/** Bản 15 phút dừng quá lâu thì phát lại từ đầu (một phiên học mới), không tiếp giữa chừng. */
const RESUME_WITHIN_MS = 5 * 60 * 1000;
/** Khóa của đoạn im lặng giữ trang ở trạng thái "đang phát media" khi chạy bản nhạc kiểu buffer. */
const SILENT = "silent";

export interface MusicTrack {
  id: string;
  label: string;
  hint: string;
  src: string;
  /** Độ dài đúng của một vòng, không tính hai đoạn đệm. */
  loopSeconds: number;
  /** Cách phát (xem đầu file). Mặc định "buffer". Với "element", file là đúng một vòng, không có đệm. */
  engine?: "buffer" | "element";
}

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    id: "lofi",
    label: "Lo-fi nhẹ",
    hint: "68 nhịp/phút, đàn điện",
    src: "/music/lofi-tap-trung.m4a",
    loopSeconds: (32 * 4 * 60) / 68,
  },
  {
    id: "aria",
    label: "Cổ điển nhẹ",
    hint: "60 nhịp/phút, đàn gảy",
    src: "/music/aria-nhe.m4a",
    loopSeconds: 96,
  },
  {
    id: "ballet",
    label: "Ballet giao hưởng",
    hint: "4 phút, có cốt truyện",
    src: "/music/ballet-thien-nga-v3.m4a", // a new file name for every new render: devices must not keep the old one
    // 13 scenes (Intro + 4 acts), each with its own tempo. The length is what
    // scripts/gen-ballet-swan.py prints as "loop": 11080973 samples at 44.1 kHz (251.3 s). The last
    // chord rings into the first bar, so the join is seamless.
    loopSeconds: 11080973 / 44100,
  },
  {
    id: "ballet15",
    label: "Ballet 15 phút",
    hint: "Có piano, guitar, sáo",
    // 3/4, 80 nhịp/phút, 400 ô nhịp = đúng 900,000 s (39.690.000 mẫu ở 44,1 kHz), khép kín: hợp âm cuối
    // vang vào ô đầu. Dựng bằng scripts/gen-ballet-session.py. File là đúng một vòng, không đệm.
    src: "/music/ballet-thien-nga-phien-hoc-15p-v1.m4a",
    loopSeconds: 900,
    engine: "element",
  },
];

/** off: tắt · loading: đang tải/giải mã · playing: đang phát · waiting: đã bật nhưng chờ một lần
 * chạm của người học · error: thiết bị không phát được. */
export type MusicStatus = "off" | "loading" | "playing" | "waiting" | "error";

export interface MusicState {
  on: boolean;
  volume: number;
  track: string;
  status: MusicStatus;
  /** Đang có tiếng bài học, nhạc đã hạ xuống mức nhỏ. */
  ducked: boolean;
}

const INITIAL: MusicState = {
  on: false,
  volume: MUSIC_DEFAULT_VOLUME,
  track: MUSIC_DEFAULT_TRACK,
  status: "off",
  ducked: false,
};

let state: MusicState = INITIAL;
const listeners = new Set<() => void>();

function patch(next: Partial<MusicState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  syncSystem();
}

const clampVolume = (v: number) =>
  Math.min(MUSIC_MAX_VOLUME, Math.max(MUSIC_MIN_VOLUME, Math.round(v * 100) / 100));

// ---- engine -------------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let startToken = 0;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer>>();

// The one <audio> element of the app. It carries the 15-minute track itself; while a "buffer" track
// plays it loops 30 s of silence, so the system keeps treating the page as playing media.
let media: HTMLAudioElement | null = null;
let mediaKey: string | null = null; // SILENT or a track id
let mediaAudible = false; // the element is carrying the music (not the silence)
let mediaSwitching = false; // src is being changed on purpose: its pause/abort events mean nothing
let mediaStoppedAt = 0;
let mediaLevel = 0; // the element's own volume while it glides (devices where `volume` works)
let mediaRamp: number | undefined;
let mediaPauseTimer: number | undefined;
let mediaViaGraph = false; // iOS ignores `volume`: the element goes through Web Audio instead
let mediaGain: GainNode | null = null;
let silentUrl: string | null = null;
let nativeVolume: boolean | undefined;
/** Our own elements are not lesson sounds: they must never duck the music. */
const ownMedia = new WeakSet<HTMLMediaElement>();

const trackById = (id: string): MusicTrack =>
  MUSIC_TRACKS.find((t) => t.id === id) ?? MUSIC_TRACKS[0]!;
const currentTrack = (): MusicTrack => trackById(state.track);
const noop = () => undefined;

// what is making sound besides the music
const playing = new Set<HTMLMediaElement>();
const utterances = new Set<SpeechSynthesisUtterance>();
const mics = new Set<MediaStream>();
let micPending = false; // getUserMedia is waiting for the learner's permission

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  // the system may suspend or "interrupt" the context (call, lock screen, another app)
  ctx.addEventListener("statechange", () => {
    if (ctx && ctx.state !== "running" && state.on) void ctx.resume().catch(noop);
    settleStatus();
  });
  return ctx;
}

/** iOS ignores `HTMLMediaElement.volume` (it always reads back 1). */
function hasNativeVolume(): boolean {
  if (nativeVolume === undefined) {
    try {
      const probe = new Audio();
      probe.volume = 0.5;
      nativeVolume = probe.volume === 0.5;
    } catch {
      nativeVolume = false;
    }
  }
  return nativeVolume;
}

/** 30 s of 8 kHz, 8-bit mono silence as a WAV blob. */
function silentSrc(): string {
  if (!silentUrl) {
    const rate = 8000;
    const n = rate * 30;
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const tag = (o: number, t: string) => {
      for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
    };
    tag(0, "RIFF");
    v.setUint32(4, 36 + n, true);
    tag(8, "WAVE");
    tag(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, rate, true);
    v.setUint32(28, rate, true);
    v.setUint16(32, 1, true);
    v.setUint16(34, 8, true);
    tag(36, "data");
    v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(0x80); // 8-bit PCM: 0x80 is zero
    silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }
  return silentUrl;
}

/** The level the music should sit at right now. */
function targetGain(): number {
  if (!state.on || mics.size > 0) return 0;
  return state.ducked ? Math.min(state.volume, MUSIC_DUCKED_VOLUME) : state.volume;
}

/** Glide to the target level; `tc` is the time constant in seconds (≈ a third of the fade). */
function applyGain(tc: number): void {
  if (ctx && master) master.gain.setTargetAtTime(targetGain(), ctx.currentTime, tc);
  rampMedia(tc);
  syncSystem();
}

/** The volume the <audio> element itself should have (devices where `volume` works). */
function mediaTarget(): number {
  if (mediaKey === null || mediaKey === SILENT) return 1; // the silence is silent at any level
  return mediaAudible ? targetGain() : 0;
}

function rampMedia(tc: number): void {
  const m = media;
  if (!m || mediaViaGraph || !hasNativeVolume()) return;
  window.clearInterval(mediaRamp);
  mediaRamp = undefined;
  const tick = (): boolean => {
    const target = mediaTarget();
    // timers are throttled while the page is hidden: jump instead of gliding
    const k = document.hidden ? 1 : 1 - Math.exp(-0.05 / Math.max(tc, 0.02));
    mediaLevel += (target - mediaLevel) * k;
    if (Math.abs(target - mediaLevel) < 0.002) mediaLevel = target;
    m.volume = Math.min(1, Math.max(0, mediaLevel));
    return mediaLevel === target;
  };
  if (tick()) return;
  mediaRamp = window.setInterval(() => {
    if (tick()) {
      window.clearInterval(mediaRamp);
      mediaRamp = undefined;
    }
  }, 50);
}

/** Let the element's sound through (or not). On iOS this is a gain node, elsewhere its volume. */
function setMediaAudible(on: boolean, tc: number): void {
  mediaAudible = on;
  if (ctx && mediaGain) {
    mediaGain.gain.setTargetAtTime(on || mediaKey === SILENT ? 1 : 0, ctx.currentTime, tc);
  }
  rampMedia(tc);
}

/** Start the element's sound from zero so that it fades in. */
function prepareFadeIn(m: HTMLAudioElement): void {
  mediaLevel = 0;
  if (!mediaViaGraph && hasNativeVolume()) m.volume = 0;
  if (ctx && mediaGain) {
    mediaGain.gain.cancelScheduledValues(ctx.currentTime);
    mediaGain.gain.setValueAtTime(0, ctx.currentTime);
  }
}

function getMedia(): HTMLAudioElement | null {
  if (media) return media;
  if (typeof Audio === "undefined") return null;
  const m = new Audio();
  m.loop = true;
  m.preload = "auto";
  m.setAttribute("playsinline", "");
  ownMedia.add(m);
  m.addEventListener("pause", () => {
    if (mediaSwitching) return;
    mediaStoppedAt = Date.now();
    settleStatus();
  });
  m.addEventListener("play", () => settleStatus());
  m.addEventListener("error", () => {
    if (state.on && !mediaSwitching && mediaKey !== null) patch({ status: "error" });
  });
  media = m;
  return m;
}

/** iOS: route the element through Web Audio so that its level can be set and ducked. */
function ensureMediaGraph(m: HTMLAudioElement): void {
  if (mediaViaGraph || hasNativeVolume()) return;
  const c = getContext();
  if (!c || !master) return;
  try {
    const node = c.createMediaElementSource(m);
    mediaGain = c.createGain();
    mediaGain.gain.value = 0;
    node.connect(mediaGain);
    mediaGain.connect(master);
    mediaViaGraph = true;
  } catch {
    /* the element then plays on the device's own output, at the file's own level */
  }
}

/** Point the element at `key` and play it. The first call has to happen inside a tap. */
function playMedia(key: string, src: string): Promise<void> {
  const m = getMedia();
  if (!m) return Promise.reject(new Error("no audio element"));
  window.clearTimeout(mediaPauseTimer);
  mediaPauseTimer = undefined;
  mediaSwitching = true;
  try {
    if (mediaKey !== key) {
      mediaKey = key;
      m.src = src;
    } else if (m.paused && key !== SILENT && Date.now() - mediaStoppedAt > RESUME_WITHIN_MS) {
      m.currentTime = 0; // paused for long: a new session starts from the beginning
    }
    ensureMediaGraph(m);
    return Promise.resolve(m.play()).finally(() => {
      mediaSwitching = false;
    });
  } catch (e) {
    mediaSwitching = false;
    return Promise.reject(e);
  }
}

/** playing / waiting follows what the system lets through, not only what we asked for. */
function settleStatus(): void {
  if (typeof window === "undefined") return;
  if (
    !state.on ||
    state.status === "off" ||
    state.status === "loading" ||
    state.status === "error"
  ) {
    return;
  }
  const running = ctx?.state === "running";
  const ok =
    currentTrack().engine === "element"
      ? media !== null && !media.paused && (!mediaViaGraph || running)
      : current !== null && running;
  const next: MusicStatus = ok ? "playing" : "waiting";
  if (next !== state.status) patch({ status: next });
}

// ---- what the system shows and does: lock screen controls, audio session ----------------------

let sessionKey = "";

interface AudioSessionLike {
  type: string;
}

/** Keep the audio session type and the lock-screen card in line with the music. */
function syncSystem(): void {
  if (typeof navigator === "undefined") return;
  try {
    // "playback": the mute switch does not silence the music and it may go on in the background;
    // "auto" while the microphone is open so that recording works
    const session = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
    const want = state.on && mics.size === 0 && !micPending ? "playback" : "auto";
    if (session && session.type !== want) session.type = want;
  } catch {
    /* an older WebKit without the value: the default session is used */
  }
  updateSession();
}

function updateSession(): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  // while a lesson's own audio plays, its screen owns the lock-screen card (see use-article-audio)
  if (playing.size > 0) return;
  try {
    const ms = navigator.mediaSession;
    if (!state.on) {
      if (sessionKey) {
        ms.metadata = null;
        ms.playbackState = "none";
        sessionKey = "";
      }
      return;
    }
    const t = currentTrack();
    // also written again when a lesson screen cleared the card (it sets the metadata to null on leaving)
    if (
      (sessionKey !== t.id || ms.metadata?.title !== t.label) &&
      typeof MediaMetadata !== "undefined"
    ) {
      sessionKey = t.id;
      ms.metadata = new MediaMetadata({
        title: t.label,
        artist: "Haru",
        album: "Nhạc nền học tập",
        artwork: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
    }
    ms.playbackState = state.status === "playing" ? "playing" : "paused";
  } catch {
    /* lock-screen controls are a nicety, never required */
  }
}

/** (Re)take the lock-screen buttons: a lesson's audio screen may have set its own handlers. */
function claimSession(): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => {
      if (!state.on) setMusicOn(true);
      else wake(true);
    });
    const stop = () => {
      setMusicOn(false);
      media?.pause(); // at once: a timer may be throttled behind a locked screen
    };
    ms.setActionHandler("pause", stop);
    ms.setActionHandler("stop", stop);
    for (const a of ["previoustrack", "nexttrack", "seekbackward", "seekforward"] as const) {
      ms.setActionHandler(a, null);
    }
  } catch {
    /* ignore */
  }
  sessionKey = ""; // write the card again
  updateSession();
}

function loadBuffer(track: MusicTrack, c: AudioContext): Promise<AudioBuffer> {
  const hit = buffers.get(track.id);
  if (hit) return Promise.resolve(hit);
  let pending = loading.get(track.id);
  if (!pending) {
    pending = fetch(track.src)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((data) => c.decodeAudioData(data))
      .then((buf) => {
        // keep only one decoded track in memory: the ballet loop alone is ~100 MB once decoded
        for (const other of [...buffers.keys()]) if (other !== track.id) buffers.delete(other);
        buffers.set(track.id, buf);
        return buf;
      })
      .finally(() => loading.delete(track.id));
    loading.set(track.id, pending);
  }
  return pending;
}

function stopCurrent(fadeSeconds: number): void {
  const cur = current;
  current = null;
  if (!cur || !ctx) return;
  cur.gain.gain.setTargetAtTime(0, ctx.currentTime, fadeSeconds / 3);
  window.setTimeout(
    () => {
      try {
        cur.src.stop();
      } catch {
        /* already stopped */
      }
      cur.src.disconnect();
      cur.gain.disconnect();
    },
    fadeSeconds * 1000 + 300,
  );
}

/** Start (or switch to) a track. Must first be reached from a tap/click/key press. */
async function startTrack(id: string): Promise<void> {
  const track = trackById(id);
  const token = ++startToken;
  claimSession();
  if (track.engine === "element") await startElement(track, token);
  else await startBuffer(track, token);
}

/** The 15-minute track: the <audio> element plays the file as it is, straight from the network. */
async function startElement(track: MusicTrack, token: number): Promise<void> {
  const m = getMedia();
  if (!m) {
    patch({ status: "error" });
    return;
  }
  // everything up to play() has to run inside the tap, before any await
  const resumed = hasNativeVolume() ? undefined : getContext()?.resume().catch(noop);
  if (!(mediaKey === track.id && !m.paused)) prepareFadeIn(m);
  patch({ status: "loading" });
  buffers.clear(); // a decoded loop of another track is not needed any more (and 15 min would not fit)
  stopCurrent(0.6);
  const started = playMedia(track.id, track.src);
  applyGain(0.3); // lifts the master gain where the element goes through Web Audio (iOS)
  setMediaAudible(true, 0.5); // the element's own fade-in (gain node or volume)
  try {
    await started;
    if (resumed)
      await Promise.race([resumed, new Promise<void>((r) => window.setTimeout(r, 2500))]);
    if (token !== startToken || !state.on) return;
    patch({ status: "playing" });
    settleStatus();
  } catch (e) {
    if (token !== startToken) return;
    const name = e instanceof DOMException ? e.name : "";
    patch({ status: name === "NotAllowedError" || name === "AbortError" ? "waiting" : "error" });
  }
}

/** The short tracks: one decoded buffer looped by Web Audio. */
async function startBuffer(track: MusicTrack, token: number): Promise<void> {
  const c = getContext();
  if (!c || !master) {
    patch({ status: "error" });
    return;
  }
  // resume() has to be called inside the gesture, before any await
  const resumed = c.resume().catch(noop);
  // the silence keeps the page "playing media" so that the system lets Web Audio go on in the
  // background; if the 15-minute track is still sounding it is replaced once this one is ready
  const carrying = media !== null && mediaKey !== null && mediaKey !== SILENT && !media.paused;
  if (!carrying) void playMedia(SILENT, silentSrc()).catch(noop);
  patch({ status: "loading" });
  try {
    const timeout = new Promise<void>((r) => window.setTimeout(r, 2500));
    const [buf] = await Promise.all([loadBuffer(track, c), Promise.race([resumed, timeout])]);
    if (token !== startToken || !state.on) return;
    if (c.state !== "running") {
      patch({ status: "waiting" });
      return;
    }
    stopCurrent(0.6);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = PAD_SECONDS;
    src.loopEnd = Math.min(PAD_SECONDS + track.loopSeconds, buf.duration);
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(master);
    gain.gain.setTargetAtTime(1, c.currentTime, 0.5); // fade in
    src.start(0, PAD_SECONDS);
    current = { src, gain };
    if (carrying) {
      setMediaAudible(false, 0.2);
      window.setTimeout(() => {
        if (token === startToken && state.on && mediaKey !== SILENT) {
          void playMedia(SILENT, silentSrc()).catch(noop);
        }
      }, 800);
    }
    applyGain(0.3);
    patch({ status: "playing" });
  } catch {
    if (token === startToken) patch({ status: "error" });
  }
}

// ---- public actions -----------------------------------------------------------------------

export function setMusicOn(on: boolean): void {
  if (on === state.on) return;
  writeLocal("music-on", on);
  if (on) {
    patch({ on: true });
    void startTrack(state.track);
    return;
  }
  startToken++;
  patch({ on: false, status: "off" });
  applyGain(0.15);
  stopCurrent(0.5);
  // the element glides to silence, then stops (keeping its place for a quick resume)
  if (media && !media.paused) {
    window.clearTimeout(mediaPauseTimer);
    mediaPauseTimer = window.setTimeout(() => {
      mediaPauseTimer = undefined;
      if (!state.on) media?.pause();
    }, 700);
  }
  // nothing is playing: let the device's audio hardware rest
  window.setTimeout(() => {
    if (!state.on) void ctx?.suspend().catch(() => undefined);
  }, 1000);
}

export function setMusicVolume(volume: number): void {
  const v = clampVolume(volume);
  writeLocal("music-volume", v);
  patch({ volume: v });
  applyGain(0.1);
}

export function setMusicTrack(id: string): void {
  if (!MUSIC_TRACKS.some((t) => t.id === id) || id === state.track) return;
  writeLocal("music-track", id);
  patch({ track: id });
  if (state.on) void startTrack(id);
}

// ---- reacting to the lesson's own sound ---------------------------------------------------

let releaseTimer: number | undefined;
let poll: number | undefined;

function refreshDuck(): void {
  const want = playing.size > 0 || utterances.size > 0;
  if (want) {
    window.clearTimeout(releaseTimer);
    releaseTimer = undefined;
    if (!state.ducked) {
      patch({ ducked: true });
      applyGain(0.12); // drop quickly so the lesson audio starts clean
    }
  } else if (state.ducked && releaseTimer === undefined) {
    // a short grace period: consecutive clips should not make the music pump up and down
    releaseTimer = window.setTimeout(() => {
      releaseTimer = undefined;
      if (playing.size === 0 && utterances.size === 0) {
        patch({ ducked: false });
        applyGain(0.7); // and come back slowly
        if (state.on) claimSession(); // the lesson audio may have taken over the lock-screen card
      }
    }, 900);
  }
}

/** Safety net: forget sounds that ended without telling us (an element removed while playing, a
 * microphone stream that was stopped). Runs only while something is being tracked. */
function ensurePoll(): void {
  if (poll !== undefined) return;
  poll = window.setInterval(() => {
    for (const el of [...playing]) if (el.paused || el.ended) playing.delete(el);
    const synth = window.speechSynthesis;
    if (utterances.size > 0 && synth && !synth.speaking && !synth.pending) utterances.clear();
    const hadMics = mics.size;
    for (const s of [...mics]) if (!s.active) mics.delete(s);
    if (mics.size !== hadMics) applyGain(0.6);
    refreshDuck();
    if (playing.size === 0 && utterances.size === 0 && mics.size === 0) {
      window.clearInterval(poll);
      poll = undefined;
    }
  }, 1000);
}

const watched = new WeakSet<HTMLMediaElement>();

function trackMedia(el: HTMLMediaElement): void {
  // the music's own element and the 20 ms silent clip that unlocks <audio> on iOS are not lesson sounds
  if (ownMedia.has(el) || (el.currentSrc || el.src).startsWith("data:")) return;
  if (!watched.has(el)) {
    watched.add(el);
    for (const ev of ["pause", "ended", "emptied", "abort", "error"]) {
      el.addEventListener(ev, () => {
        playing.delete(el);
        refreshDuck();
      });
    }
  }
  playing.add(el);
  refreshDuck();
  ensurePoll();
}

/** Every sound the app makes goes through one of these three browser calls, so hooking them lets the
 * music follow all of it (each lesson hook has its own <audio> element) without touching any. */
function installHooks(): void {
  const proto = HTMLMediaElement.prototype;
  const play = proto.play;
  proto.play = function (this: HTMLMediaElement) {
    trackMedia(this);
    const p = play.call(this);
    if (p) {
      p.catch(() => {
        playing.delete(this);
        refreshDuck();
      });
    }
    return p;
  };
  // the browser's own controls (e.g. replaying a recording) start playback without calling play()
  document.addEventListener(
    "play",
    (e) => {
      if (e.target instanceof HTMLMediaElement) trackMedia(e.target);
    },
    true,
  );

  if (typeof SpeechSynthesis !== "undefined") {
    const speak = SpeechSynthesis.prototype.speak;
    SpeechSynthesis.prototype.speak = function (
      this: SpeechSynthesis,
      u: SpeechSynthesisUtterance,
    ) {
      utterances.add(u);
      const done = () => {
        utterances.delete(u);
        refreshDuck();
      };
      u.addEventListener("end", done);
      u.addEventListener("error", done);
      refreshDuck();
      ensurePoll();
      return speak.call(this, u);
    };
  }

  const devices = navigator.mediaDevices;
  if (devices?.getUserMedia) {
    const getUserMedia = devices.getUserMedia.bind(devices);
    devices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      if (constraints?.audio) {
        micPending = true;
        syncSystem(); // the audio session must not be "playback" while the microphone opens
      }
      let stream: MediaStream;
      try {
        stream = await getUserMedia(constraints);
      } catch (e) {
        micPending = false;
        syncSystem();
        throw e;
      }
      if (constraints?.audio) {
        mics.add(stream);
        micPending = false;
        applyGain(0.08);
        ensurePoll();
      }
      return stream;
    };
  }
}

// ---- start-up -----------------------------------------------------------------------------

let started = false;

/** Call once from the browser (an effect), never during render. */
export function initMusic(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  // on unless the learner turned it off on this device
  const on = readLocal<boolean>("music-on", true) === true;
  const savedTrack = readLocal<string>("music-track", INITIAL.track);
  patch({
    on,
    volume: clampVolume(readLocal<number>("music-volume", MUSIC_DEFAULT_VOLUME)),
    track: MUSIC_TRACKS.some((t) => t.id === savedTrack) ? savedTrack : INITIAL.track,
    status: on ? "waiting" : "off",
  });
  installHooks();

  // the first tap of a session starts the music the learner left on; a later tap also revives
  // whatever the system put to sleep (phone call, app switch)
  const onGesture = () => wake(true);
  for (const ev of ["click", "touchend", "keydown"]) window.addEventListener(ev, onGesture, true);
  // a browser that already trusts the site plays at once; the others say no and the first tap
  // starts it (the status stays "waiting")
  if (on) void startTrack(state.track).catch(noop);

  // the music goes on under another app and behind a locked screen: nothing is suspended here
  document.addEventListener("visibilitychange", () => {
    if (!state.on) return;
    if (document.hidden) {
      applyGain(0.01); // timers are throttled while hidden: settle every glide now
      claimSession(); // and leave the lock-screen card in order
    } else {
      wake(false);
    }
  });
}

/** Bring back sound the system stopped. `fromGesture`: a tap, so a track may be (re)started. */
function wake(fromGesture: boolean): void {
  if (!state.on || state.status === "loading" || state.status === "error") return;
  const t = currentTrack();
  const started = media !== null || current !== null;
  if (!fromGesture && !started) return; // never start sound without a tap
  if (ctx && ctx.state !== "running") void ctx.resume().then(settleStatus, noop);
  if (t.engine === "element") {
    // pause by the system (call, headset, lock screen): carry on where it was (or from the start if long ago)
    if (!media || media.paused) void startTrack(t.id);
    return;
  }
  if (state.status === "waiting" && !current && fromGesture) {
    void startTrack(t.id);
    return;
  }
  if (media?.paused) void playMedia(SILENT, silentSrc()).then(settleStatus, noop);
}

// ---- React --------------------------------------------------------------------------------

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBackgroundMusic(): MusicState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}
