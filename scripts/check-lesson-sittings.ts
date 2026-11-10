/** Checks the sitting plan of every lesson against a running API: each word, card and question
 * in exactly one sitting, and the spread of sitting lengths.
 *   API=http://127.0.0.1:8077/api/v1 TOKEN=<access token> node --experimental-strip-types scripts/check-lesson-sittings.ts */
import { planSittings, questionIdsOf } from "../src/lib/lesson-sessions.ts";
const API = process.env.API ?? "http://127.0.0.1:8000/api/v1";
const T = process.env.TOKEN!;
const H = { Authorization: `Bearer ${T}` };
const list = await (await fetch(`${API}/lessons`, { headers: H })).json();
const rows: string[] = [];
let bad = 0;
const all: number[] = [];
for (const l of list) {
  const lesson = await (await fetch(`${API}/lessons/${l.id}`, { headers: H })).json();
  if (lesson.kind === "hangul" || lesson.kind === "review" || !lesson.vocab) continue;
  const pr = await fetch(`${API}/lessons/${l.id}/practice`, { headers: H });
  const practice = pr.ok ? await pr.json() : { items: [] };
  const s = planSittings(lesson.vocab, lesson.grammar, practice.items ?? []);
  // invariants: every word / card / question exactly once
  const v = s.flatMap((x) => x.steps.flatMap((st) => (st.kind === "vocab" ? st.ids : [])));
  const g = s.flatMap((x) => x.steps.flatMap((st) => (st.kind === "grammar" ? st.ids : [])));
  const q = s.flatMap((x) => x.steps.flatMap((st) => ("questionIds" in st ? st.questionIds : [])));
  const allQ = (practice.items ?? []).flatMap(questionIdsOf);
  const ok =
    v.length === lesson.vocab.length &&
    new Set(v).size === v.length &&
    g.length === lesson.grammar.length &&
    q.length === allQ.length &&
    new Set(q).size === q.length;
  if (!ok) bad++;
  s.forEach((x) => all.push(x.minutes));
  const learn = s.filter((x) => x.kind === "learn");
  const checks = learn.map(
    (x) => x.steps.find((st) => st.kind === "check")?.questionIds.length ?? 0,
  );
  rows.push(
    `${l.id}\t${lesson.vocab.length}w ${lesson.grammar.length}g ${allQ.length}q\t→ ${learn.length} học + ${s.length - learn.length} luyện\tmin ${s.map((x) => x.minutes).join(",")}\tcheck ${checks.join(",")}${ok ? "" : "  ✗"}`,
  );
}
console.log(rows.join("\n"));
all.sort((a, b) => a - b);
console.log(
  "sittings",
  all.length,
  "median",
  all[Math.floor(all.length / 2)],
  "p10",
  all[Math.floor(all.length * 0.1)],
  "p90",
  all[Math.floor(all.length * 0.9)],
  "max",
  all[all.length - 1],
  "bad",
  bad,
);
