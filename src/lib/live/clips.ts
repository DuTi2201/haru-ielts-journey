/**
 * The learner's own sentences, kept on the device during a talk with Haru so the pronunciation
 * check can listen to them afterwards (nothing is uploaded until the session ends, and only a
 * few sentences then).
 *
 * The microphone sends 100 ms chunks. A sentence starts at the first voiced chunk while Haru is
 * quiet (with 300 ms of pre-roll so the first syllable is not cut) and ends when Haru starts
 * talking again, after 2.5 s of quiet, or at 15 s; trailing quiet beyond 300 ms is trimmed.
 * Sentences are then matched to the learner turns of the transcript by time (the transcript of a
 * sentence arrives while or shortly after it is said).
 */

export interface Take {
  start: number; // ms timestamps
  end: number;
  samples: Int16Array;
}

const CHUNK_MS = 100;
const PREROLL = 3; // chunks
const TAIL = 3; // chunks of quiet kept after the last voiced one
const QUIET_CLOSE_MS = 2500;
const MAX_MS = 15000;
const MAX_TAKES = 12;

function concat(chunks: Int16Array[]): Int16Array {
  const out = new Int16Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export class TakeRecorder {
  readonly takes: Take[] = [];
  private ring: Int16Array[] = [];
  private open: {
    start: number;
    chunks: Int16Array[];
    lastVoiced: number;
    voicedCount: number;
  } | null = null;

  /** One microphone chunk. `haruTalking`: Haru's voice is playing (nothing is recorded then). */
  feed(pcm: Int16Array, voiced: boolean, haruTalking: boolean, now: number) {
    if (haruTalking) {
      this.close();
      this.ring = [];
      return;
    }
    if (!this.open) {
      if (voiced) {
        this.open = {
          start: now - this.ring.length * CHUNK_MS,
          chunks: [...this.ring, pcm],
          lastVoiced: 0,
          voicedCount: 1,
        };
        this.open.lastVoiced = this.open.chunks.length;
        this.ring = [];
      } else {
        this.ring = [...this.ring, pcm].slice(-PREROLL);
      }
      return;
    }
    this.open.chunks.push(pcm);
    if (voiced) {
      this.open.lastVoiced = this.open.chunks.length;
      this.open.voicedCount += 1;
    }
    const quietMs = (this.open.chunks.length - this.open.lastVoiced) * CHUNK_MS;
    if (quietMs >= QUIET_CLOSE_MS || this.open.chunks.length * CHUNK_MS >= MAX_MS) this.close(now);
  }

  /** Haru started answering (or the session ended): the sentence being said is complete. */
  close(now = Date.now()) {
    const o = this.open;
    this.open = null;
    if (!o || o.voicedCount < 5) return; // under half a second of voice: a cough or a click, not a sentence
    const kept = o.chunks.slice(0, Math.min(o.chunks.length, o.lastVoiced + TAIL));
    this.takes.push({
      start: o.start,
      end: Math.min(now, o.start + kept.length * CHUNK_MS),
      samples: concat(kept),
    });
    if (this.takes.length > MAX_TAKES) this.takes.shift();
  }
}

/** Pair each learner turn (its index in the transcript and when its text first arrived) with the
 * sentence it transcribes: the first unused take that started before the text came and ended no
 * more than 4 s before it. */
export function matchTakes(
  takes: Take[],
  starts: { turn: number; at: number }[],
): Map<number, Take> {
  const used = new Set<Take>();
  const out = new Map<number, Take>();
  for (const s of starts) {
    const take = takes.find((t) => !used.has(t) && t.start - 500 <= s.at && s.at <= t.end + 4000);
    if (take) {
      used.add(take);
      out.set(s.turn, take);
    }
  }
  return out;
}

const HANGUL = /[가-힣]/g;

/** The sentences worth checking: Korean ones of 0.8-15 s, the richest first, at most `max` and
 * `maxSeconds` together; returned in the order they were said. */
export function pickTakes(
  matched: Map<number, Take>,
  turnText: (turn: number) => string,
  { max = 5, maxSeconds = 55 } = {},
): { turn: number; take: Take; text: string }[] {
  const cands = [...matched.entries()]
    .map(([turn, take]) => ({
      turn,
      take,
      text: turnText(turn),
      seconds: take.samples.length / 16000,
    }))
    .filter((c) => c.seconds >= 0.8 && c.seconds <= 15 && (c.text.match(HANGUL)?.length ?? 0) >= 2)
    .sort((a, b) => (b.text.match(HANGUL)?.length ?? 0) - (a.text.match(HANGUL)?.length ?? 0));
  const picked: typeof cands = [];
  let total = 0;
  for (const c of cands) {
    if (picked.length >= max || total + c.seconds > maxSeconds) continue;
    picked.push(c);
    total += c.seconds;
  }
  return picked
    .sort((a, b) => a.turn - b.turn)
    .map(({ turn, take, text }) => ({ turn, take, text }));
}
