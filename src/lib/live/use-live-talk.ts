import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, errorMessage } from "@/lib/api/client";
import {
  finishConversation,
  replyConversation,
  startConversation,
  type ConversationFinishOut,
  type ConversationStartOut,
  type ConversationTurn,
} from "@/lib/api/conversation";
import { PcmPlayer, rateOf, startMic, type MicCapture } from "@/lib/live/audio";
import { matchTakes, pickTakes, TakeRecorder } from "@/lib/live/clips";

/**
 * One spoken session with Haru over Gemini Live. The backend hands out a single-use token locked
 * to Haru's setup (lesson context and system instruction included); this hook opens the Live
 * WebSocket with it, streams the microphone, plays Haru's voice, keeps the transcript, and runs
 * the silence ladder — the model only learns that someone stopped talking, the app knows they are
 * stuck:
 *   6 s of quiet after Haru's question  → the hint cards light up on screen
 *   12 s                                → "ask again, simpler / give two choices"
 *   8 s more after that easier question → "say it in Vietnamese and start the Korean sentence"
 * Any sound from the learner starts the ladder over.
 */

export interface SpokenTake {
  turn: number;
  text: string;
  samples: Int16Array;
}

export type TalkStatus = "idle" | "connecting" | "live" | "ending" | "done" | "error";
export type Speaker = "haru" | "learner" | "none";

export const LADDER = { hintsMs: 6000, easierMs: 12000, bilingualMs: 8000 } as const;
/** Microphone level (RMS of a 100 ms chunk) above which the learner counts as speaking. */
export const VOICE_RMS = 0.02;

/** What the ladder does now: step 0 nothing yet, 1 hints shown, 2 easier question asked,
 * 3 Vietnamese help given (then it waits for the learner). */
export function ladderAction(
  idleMs: number,
  step: number,
): "hints" | "easier" | "bilingual" | null {
  if (step === 0 && idleMs >= LADDER.hintsMs) return "hints";
  if (step === 1 && idleMs >= LADDER.easierMs) return "easier";
  if (step === 2 && idleMs >= LADDER.bilingualMs) return "bilingual";
  return null;
}

/** Add a streamed transcript piece to the turn list: a new turn when the speaker changes, or when
 * the model had finished its previous turn (`fresh`) — two questions in a row are two bubbles. */
export function appendTranscript(
  turns: ConversationTurn[],
  role: ConversationTurn["role"],
  chunk: string,
  fresh = false,
) {
  if (!chunk) return turns;
  const last = turns[turns.length - 1];
  if (last && last.role === role && !fresh) {
    return [...turns.slice(0, -1), { role, text: last.text + chunk }];
  }
  return [...turns, { role, text: chunk.trimStart() }];
}

interface LiveServerMessage {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { mimeType?: string; data?: string }; text?: string }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  goAway?: unknown;
  error?: { message?: string };
}

/** What any Live role-play needs from its start call (the talks, the debates). */
export interface LiveStart {
  session_id: string;
  token: string;
  ws_url: string;
  setup: Record<string, unknown>;
  nudges: Record<string, string>;
  max_seconds: number;
}

export interface LiveApi<I extends LiveStart, R> {
  start: (remember: boolean, typing?: boolean) => Promise<I>;
  /** Haru's next line as text, for a typed chat (no Live connection). Absent: typing rides on Live. */
  reply?: (sessionId: string, turns: ConversationTurn[]) => Promise<string>;
  finish: (
    sessionId: string,
    body: { seconds: number; nudges: number; turns: ConversationTurn[] },
  ) => Promise<R>;
  /** What to show when finishing failed (the transcript is gone, the reason is not). */
  failed: (sessionId: string, seconds: number, turns: ConversationTurn[], error: string) => R;
}

/** Trò chuyện, about a chosen lesson ("Nói về bài này") or the one studied last. */
export function talkApi(
  lessonId?: number | null,
): LiveApi<ConversationStartOut, ConversationFinishOut> {
  return {
    ...TALK_API,
    start: (remember, typing) => startConversation(remember, lessonId, typing),
  };
}

const TALK_API: LiveApi<ConversationStartOut, ConversationFinishOut> = {
  start: (remember, typing) => startConversation(remember, undefined, typing),
  reply: async (sessionId, turns) => (await replyConversation(sessionId, turns)).text,
  finish: finishConversation,
  failed: (session_id, seconds, turns, error) => ({
    session_id,
    seconds,
    learner_turns: turns.filter((t) => t.role === "learner").length,
    report: null,
    report_error_vi: error,
  }),
};

const SLOW_KEY = "haru.talk.slow";
const NOT_STUCK = new Set(["start", "wrap_up", "slower", "normal_pace"]);

function readSlow(): boolean {
  try {
    return localStorage.getItem(SLOW_KEY) === "1";
  } catch {
    return false;
  }
}

export function useLiveTalk<I extends LiveStart = ConversationStartOut, R = ConversationFinishOut>(
  api: LiveApi<I, R> = TALK_API as unknown as LiveApi<I, R>,
) {
  const apiRef = useRef(api);
  apiRef.current = api;
  const [status, setStatus] = useState<TalkStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<I | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [speaker, setSpeaker] = useState<Speaker>("none");
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMutedState] = useState(false);
  /** Typing instead of speaking: no microphone (none on the device, permission refused, or a
   * quiet place). Haru still answers aloud; the learner's lines go in as text. */
  const [typing, setTyping] = useState(false);
  /** "Nói chậm": Haru speaks slower still; kept on the device for the next sessions. */
  const [slow, setSlowState] = useState(false);
  const slowRef = useRef(false);
  useEffect(() => {
    // Read after mount: the server render has no storage.
    slowRef.current = readSlow();
    setSlowState(slowRef.current);
  }, []);
  const [result, setResult] = useState<R | null>(null);
  /** The learner's own sentences worth a pronunciation check (kept on the device). */
  const [takes, setTakes] = useState<SpokenTake[]>([]);

  const ws = useRef<WebSocket | null>(null);
  const mic = useRef<MicCapture | null>(null);
  const player = useRef<PcmPlayer | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const live = useRef({
    info: null as I | null,
    turns: [] as ConversationTurn[],
    startedAt: 0,
    lastHaru: 0,
    lastLearner: 0,
    haruSpoke: false,
    step: 0,
    nudges: 0,
    wrapSent: false,
    endAfterReply: false,
    haruTurnDone: false,
    ending: false,
    ready: false,
    recorder: new TakeRecorder(),
    learnerStarts: [] as { turn: number; at: number }[],
  });

  const setLiveTurns = useCallback((fn: (t: ConversationTurn[]) => ConversationTurn[]) => {
    live.current.turns = fn(live.current.turns);
    setTurns(live.current.turns);
  }, []);

  const setLadder = useCallback((s: number) => {
    live.current.step = s;
    setStep(s);
  }, []);

  const send = useCallback((msg: unknown) => {
    const sock = ws.current;
    if (sock && sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
  }, []);

  /** An app signal to the model (never shown, never spoken back). */
  const signal = useCallback(
    (kind: string, also?: string) => {
      const nudges = live.current.info?.nudges;
      const text = nudges?.[kind];
      if (!text) return;
      // Only the silence ladder and hints count as being stuck (they move the band).
      if (!NOT_STUCK.has(kind)) live.current.nudges += 1;
      const extra = also ? nudges?.[also] : undefined;
      const full = extra ? `${text}\n${extra}` : text;
      send({
        clientContent: { turns: [{ role: "user", parts: [{ text: full }] }], turnComplete: true },
      });
    },
    [send],
  );

  const teardown = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    mic.current?.stop();
    mic.current = null;
    player.current?.close();
    player.current = null;
    const sock = ws.current;
    ws.current = null;
    if (sock) {
      sock.onmessage = null;
      sock.onclose = null;
      sock.onerror = null;
      try {
        sock.close();
      } catch {
        // already closed
      }
    }
  }, []);

  const end = useCallback(
    async (note?: string, failed = false) => {
      const l = live.current;
      if (l.ending || !l.info) return;
      l.ending = true;
      l.recorder.close();
      const matched = matchTakes(l.recorder.takes, l.learnerStarts);
      setTakes(
        pickTakes(matched, (i) => l.turns[i]?.text ?? "").map((p) => ({
          turn: p.turn,
          text: p.text,
          samples: p.take.samples,
        })),
      );
      teardown();
      setSpeaker("none");
      setStatus("ending");
      if (note) setError(note);
      const seconds = l.startedAt ? Math.round((Date.now() - l.startedAt) / 1000) : 0;
      try {
        const out = await apiRef.current.finish(l.info.session_id, {
          seconds,
          nudges: l.nudges,
          turns: l.turns,
        });
        setResult(out);
      } catch (e) {
        setResult(apiRef.current.failed(l.info.session_id, seconds, l.turns, errorMessage(e)));
      }
      // never connected: back to the start screen with the reason, not an empty report
      setStatus(failed ? "error" : "done");
    },
    [teardown],
  );

  const onTick = useCallback(() => {
    const l = live.current;
    if (!l.ready || l.ending || !l.info) return;
    const now = Date.now();
    const p = player.current;
    if (p?.playing) l.lastHaru = now;
    setElapsed(Math.round((now - l.startedAt) / 1000));
    const haruTalking = now - l.lastHaru < 600;
    const learnerTalking = now - l.lastLearner < 900;
    setSpeaker(haruTalking ? "haru" : learnerTalking ? "learner" : "none");

    const max = l.info.max_seconds;
    const sec = (now - l.startedAt) / 1000;
    if (!l.wrapSent && sec >= max - 30) {
      l.wrapSent = true;
      signal("wrap_up");
    }
    if (sec >= max + 30 || (l.endAfterReply && !haruTalking)) {
      void end();
      return;
    }

    if (!l.haruSpoke || haruTalking || learnerTalking || l.wrapSent) return;
    const idle = now - Math.max(l.lastHaru, l.lastLearner);
    const action = ladderAction(idle, l.step);
    if (action === "hints") setLadder(1);
    else if (action === "easier") {
      setLadder(2);
      signal("easier");
    } else if (action === "bilingual") {
      setLadder(3);
      signal("bilingual");
    }
  }, [end, setLadder, signal]);

  const onMessage = useCallback(
    async (ev: MessageEvent) => {
      const raw = typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text();
      let msg: LiveServerMessage;
      try {
        msg = JSON.parse(raw) as LiveServerMessage;
      } catch {
        return;
      }
      const l = live.current;
      if (msg.setupComplete !== undefined) {
        l.ready = true;
        l.startedAt = Date.now();
        setStatus("live");
        signal("start", slowRef.current ? "slower" : undefined);
        return;
      }
      if (msg.goAway !== undefined) {
        void end("Phiên trò chuyện đã đến giới hạn của máy chủ.");
        return;
      }
      if (msg.error) {
        void end(msg.error.message || "Kết nối giọng nói bị lỗi.");
        return;
      }
      const sc = msg.serverContent;
      if (!sc) return;
      const now = Date.now();
      for (const part of sc.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) {
          player.current?.play(part.inlineData.data, rateOf(part.inlineData.mimeType));
          l.lastHaru = now;
          l.haruSpoke = true;
        }
      }
      if (sc.outputTranscription?.text) {
        const text = sc.outputTranscription.text;
        const fresh = l.haruTurnDone;
        l.haruTurnDone = false;
        l.lastHaru = now;
        l.haruSpoke = true;
        setLiveTurns((t) => appendTranscript(t, "haru", text, fresh));
      }
      if (sc.inputTranscription?.text) {
        const last = l.turns[l.turns.length - 1];
        if (!last || last.role !== "learner")
          l.learnerStarts.push({ turn: l.turns.length, at: now });
        l.lastLearner = now;
        if (l.step !== 0) setLadder(0);
        setLiveTurns((t) => appendTranscript(t, "learner", sc.inputTranscription!.text!));
      }
      if (sc.interrupted) player.current?.interrupt();
      if (sc.turnComplete) {
        l.haruTurnDone = true;
        if (l.wrapSent && l.haruSpoke) l.endAfterReply = true;
      }
    },
    [end, setLadder, setLiveTurns, signal],
  );

  /** Typed chat: ask for Haru's next line from the talk so far and show it. */
  const haruReply = useCallback(async () => {
    const l = live.current;
    if (!l.info || l.ending) return;
    setSpeaker("haru");
    try {
      const text = await apiRef.current.reply!(l.info.session_id, l.turns);
      if (l.ending) return;
      l.lastHaru = Date.now();
      l.haruSpoke = true;
      l.haruTurnDone = true;
      setLiveTurns((t) => [...t, { role: "haru", text }]);
    } catch (e) {
      if (!l.ending) setError(errorMessage(e));
    } finally {
      setSpeaker("none");
    }
  }, [setLiveTurns]);

  const start = useCallback(
    async (remember: boolean, opts?: { typing?: boolean }) => {
      const typed = !!opts?.typing;
      setTyping(typed);
      setError(null);
      setResult(null);
      setTurns([]);
      setTakes([]);
      setElapsed(0);
      setLadder(0);
      setStatus("connecting");
      live.current = {
        info: null,
        turns: [],
        startedAt: 0,
        lastHaru: 0,
        lastLearner: 0,
        haruSpoke: false,
        step: 0,
        nudges: 0,
        wrapSent: false,
        endAfterReply: false,
        haruTurnDone: false,
        ending: false,
        ready: false,
        recorder: new TakeRecorder(),
        learnerStarts: [],
      };
      // both from this tap: iOS starts audio and asks for the microphone only from a gesture
      try {
        player.current = new PcmPlayer();
        await player.current.unlock();
        if (!typed)
          mic.current = await startMic((pcm, rms, raw) => {
            const l = live.current;
            const now = Date.now();
            if (rms > VOICE_RMS) {
              l.lastLearner = now;
              if (l.step !== 0) setLadder(0);
            }
            if (l.ready && !l.ending) {
              const haruTalking = now - l.lastHaru < 600 || !!player.current?.playing;
              l.recorder.feed(raw, rms > VOICE_RMS, haruTalking, now);
            }
            if (l.ready) {
              send({ realtimeInput: { audio: { data: pcm, mimeType: "audio/pcm;rate=16000" } } });
            }
          });
      } catch (e) {
        teardown();
        const denied =
          e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        setError(
          denied
            ? "Chưa có quyền dùng micro. Bạn có thể gõ phím để trò chuyện, hoặc bật quyền micro trong cài đặt trình duyệt rồi thử lại."
            : "Thiết bị này chưa mở được micro. Bạn có thể gõ phím để trò chuyện.",
        );
        setStatus("error");
        return;
      }

      let data: I;
      try {
        data = await apiRef.current.start(remember, typed);
      } catch (e) {
        teardown();
        setError(e instanceof ApiError ? e.problem.title || errorMessage(e) : errorMessage(e));
        setStatus("error");
        return;
      }
      live.current.info = data;
      setInfo(data);

      // typed chat: Haru answers in text through the API, no Live connection to open (or to fail)
      if (typed && apiRef.current.reply && !data.token) {
        const l = live.current;
        l.ready = true;
        l.startedAt = Date.now();
        setStatus("live");
        tick.current = setInterval(onTick, 250);
        void haruReply();
        return;
      }

      const sock = new WebSocket(`${data.ws_url}?access_token=${encodeURIComponent(data.token)}`);
      ws.current = sock;
      sock.onopen = () => sock.send(JSON.stringify({ setup: data.setup }));
      sock.onmessage = (ev) => void onMessage(ev);
      sock.onerror = () => {
        // onclose follows with the reason
      };
      sock.onclose = (ev) => {
        const l = live.current;
        if (l.ending) return;
        if (!l.ready) {
          void end(
            `Không mở được kết nối giọng nói${ev.reason ? ` (${ev.reason})` : ""}. Thử lại sau ít phút nhé.`,
            true,
          );
        } else {
          void end("Mất kết nối giữa chừng — Haru lưu lại những gì hai bên đã nói.");
        }
      };
      tick.current = setInterval(onTick, 250);
    },
    [end, haruReply, onMessage, onTick, send, setLadder, teardown],
  );

  /** A line the learner typed: shown as theirs and sent as plain text (app signals carry a prefix,
   * so the model takes this as the learner speaking). */
  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      const l = live.current;
      if (!t || !l.ready || l.ending) return;
      l.lastLearner = Date.now();
      if (l.step !== 0) setLadder(0);
      setLiveTurns((turns) => [...turns, { role: "learner", text: t }]);
      if (!ws.current && apiRef.current.reply) {
        setError(null);
        void haruReply();
        return;
      }
      send({
        clientContent: { turns: [{ role: "user", parts: [{ text: t }] }], turnComplete: true },
      });
    },
    [haruReply, send, setLadder, setLiveTurns],
  );

  /** Keys being pressed count as the learner answering: the silence ladder waits. */
  const typingActivity = useCallback(() => {
    live.current.lastLearner = Date.now();
  }, []);

  const hint = useCallback(() => {
    if (!live.current.ready) return;
    setLadder(Math.max(live.current.step, 1));
    signal("hint");
  }, [setLadder, signal]);

  const setSlow = useCallback(
    (on: boolean) => {
      slowRef.current = on;
      setSlowState(on);
      try {
        localStorage.setItem(SLOW_KEY, on ? "1" : "0");
      } catch {
        /* private mode: this session only */
      }
      if (live.current.ready) signal(on ? "slower" : "normal_pace");
    },
    [signal],
  );

  const setMuted = useCallback((m: boolean) => {
    mic.current?.setMuted(m);
    setMutedState(m);
  }, []);

  const reset = useCallback(() => {
    teardown();
    setStatus("idle");
    setResult(null);
    setError(null);
    setTurns([]);
    setInfo(null);
    setTakes([]);
  }, [teardown]);

  useEffect(() => teardown, [teardown]);

  return {
    status,
    error,
    info,
    turns,
    speaker,
    step,
    elapsed,
    muted,
    typing,
    sendText,
    typingActivity,
    result,
    takes,
    start,
    end,
    hint,
    slow,
    setSlow,
    setMuted,
    reset,
  };
}
