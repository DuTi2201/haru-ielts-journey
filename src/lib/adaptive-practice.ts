/** Practice that finds its own level without holding anyone back.
 *
 * The server marks each item "warm" (Vừa sức) or "challenge" (Thử thách: a long exam-style text
 * with words the learner has not met). Instead of putting every challenge at the very end, the
 * items are MIXED: mostly warm ones, with a challenge every few items so the learner gets used to
 * harder text and does not get bored. How often a challenge turns up follows how the learner is
 * doing, but the level only changes after a RUN of answers, never on a single one:
 *
 *   - 4 right in a row  → one level up   (more challenges)
 *   - 3 wrong in a row  → one level down (fewer challenges)
 *
 * Nothing is ever locked: every item stays in the list, and the learner can pin a level by hand.
 */

export type Level = "support" | "steady" | "stretch";
export type LevelChoice = "auto" | Level;

export const LEVELS: readonly Level[] = ["support", "steady", "stretch"];
/** Warm items between two challenges. `null`: no challenge until the warm ones are done. */
export const WARM_PER_CHALLENGE: Record<Level, number | null> = {
  support: null,
  steady: 4,
  stretch: 2,
};
export const RUN_UP = 4;
export const RUN_DOWN = 3;

export interface Run {
  level: Level;
  right: number;
  wrong: number;
}

export const START: Run = { level: "steady", right: 0, wrong: 0 };

/** One more answer: the level moves only when a run reaches its length, and the counters start over. */
export function step(run: Run, correct: boolean): Run {
  const right = correct ? run.right + 1 : 0;
  const wrong = correct ? 0 : run.wrong + 1;
  const i = LEVELS.indexOf(run.level);
  if (right >= RUN_UP && i < LEVELS.length - 1)
    return { level: LEVELS[i + 1]!, right: 0, wrong: 0 };
  if (wrong >= RUN_DOWN && i > 0) return { level: LEVELS[i - 1]!, right: 0, wrong: 0 };
  // at the top or the bottom the run just keeps counting without overflowing
  return { level: run.level, right: Math.min(right, RUN_UP), wrong: Math.min(wrong, RUN_DOWN) };
}

export const isChallenge = (item: { tier?: "warm" | "challenge" | undefined }): boolean =>
  item.tier === "challenge";

/** Interleaves `warm` and `challenge` (each in its own order) at the pace the level asks for. */
export function mix<T>(warm: readonly T[], challenge: readonly T[], level: Level): T[] {
  const every = WARM_PER_CHALLENGE[level];
  if (every === null) return [...warm, ...challenge];
  const out: T[] = [];
  let w = 0;
  let c = 0;
  while (w < warm.length || c < challenge.length) {
    for (let k = 0; k < every && w < warm.length; k++) out.push(warm[w++]!);
    if (c < challenge.length) out.push(challenge[c++]!);
    else if (w >= warm.length) break;
  }
  return out;
}

/** The order to show: what the learner has answered stays where it is (nothing jumps under their
 * thumb), and the rest is mixed again for the current level. */
export function replan<T extends { id: string; tier?: "warm" | "challenge" | undefined }>(
  shown: readonly T[],
  answered: ReadonlySet<string>,
  level: Level,
): T[] {
  let last = -1;
  shown.forEach((it, i) => {
    if (answered.has(it.id)) last = i;
  });
  const keep = shown.slice(0, last + 1);
  const rest = shown.slice(last + 1);
  return [
    ...keep,
    ...mix(
      rest.filter((x) => !isChallenge(x)),
      rest.filter(isChallenge),
      level,
    ),
  ];
}
