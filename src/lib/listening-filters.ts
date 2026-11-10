import type { CorpusFacetsOut } from "@/lib/api/types";

/** What narrows the listening corpus. Every field is optional; together they
 * are "and"-ed. Lives in the /listening/play URL, so a refresh or the back
 * button keeps the same set. */
export interface ListeningFilter {
  level?: number | undefined;
  topic?: number | undefined;
  register?: string | undefined;
  grammar?: number | undefined;
  film?: number | undefined;
}

export const REGISTERS = ["존댓말", "반말", "hỗn hợp"] as const;

/** Speech levels in plain Vietnamese — what a learner needs in order to know
 * WHEN a sentence is the right one to say. */
export const REGISTER_INFO: Record<string, { label: string; hint: string }> = {
  존댓말: {
    label: "Lịch sự",
    hint: "존댓말 — nói với người lớn tuổi, cấp trên, người mới quen hoặc khi cần giữ lịch sự.",
  },
  반말: {
    label: "Thân mật",
    hint: "반말 — nói với bạn bè thân, người nhỏ tuổi hơn. Dùng sai người sẽ bị coi là thiếu lễ phép.",
  },
  "hỗn hợp": {
    label: "Hỗn hợp",
    hint: "Câu gồm cả lối nói lịch sự và thân mật (thường là hội thoại có nhiều lượt nói).",
  },
};

export const registerLabel = (register: string) => REGISTER_INFO[register]?.label ?? register;

const toNumber = (raw: unknown): number | undefined => {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Reads a filter out of untrusted URL search params; anything odd is dropped. */
export function parseFilter(raw: Record<string, unknown>): ListeningFilter {
  const level = toNumber(raw["level"]);
  const register =
    typeof raw["register"] === "string" &&
    (REGISTERS as readonly string[]).includes(raw["register"])
      ? raw["register"]
      : undefined;
  return {
    level: level !== undefined && level <= 6 ? level : undefined,
    topic: toNumber(raw["topic"]),
    register,
    grammar: toNumber(raw["grammar"]),
    film: toNumber(raw["film"]),
  };
}

export const hasFilter = (f: ListeningFilter) =>
  f.level !== undefined ||
  f.topic !== undefined ||
  f.register !== undefined ||
  f.grammar !== undefined ||
  f.film !== undefined;

/** "Cấp 2 · Lịch sự · Công việc" — the filter in words, for headings. */
export function describeFilter(f: ListeningFilter, facets?: CorpusFacetsOut): string {
  const parts: string[] = [];
  if (f.level !== undefined) parts.push(`Cấp ${f.level}`);
  if (f.register) parts.push(registerLabel(f.register));
  if (f.topic !== undefined) {
    const t = facets?.topics.find((x) => x.id === f.topic);
    if (t) parts.push(t.name);
  }
  if (f.grammar !== undefined) {
    const g = facets?.grammar.find((x) => x.id === f.grammar);
    if (g) parts.push(g.pattern);
  }
  if (f.film !== undefined) {
    const m = facets?.films.find((x) => x.id === f.film);
    if (m) parts.push(m.title);
  }
  return parts.join(" · ") || "Tất cả câu";
}

/** A fresh random seed: one per listening session, so each session walks the
 * corpus in its own order. */
export const newSeed = () => Math.random().toString(36).slice(2, 10);

export const formatCount = (n: number) => n.toLocaleString("vi-VN");
