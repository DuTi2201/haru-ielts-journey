// Mirrors backend Pydantic schemas exactly. Do not rename fields.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReadAlongTimings } from "@/lib/read-along";

export type Role = "learner" | "editor" | "admin";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface ProfileOut {
  id: string;
  email: string;
  role: Role;
  display_name: string | null;
  goal: string | null;
  exam_date: string | null;
  daily_minutes: number;
  /** true while the password is a temporary one an admin made: the app asks for a new one first. */
  must_change_password?: boolean;
}
export interface ChangePasswordIn {
  current_password: string;
  new_password: string;
}
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}
export interface JobOut {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  step: string | null;
  result: Record<string, any> | null;
  error: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}
export interface JobAccepted {
  job_id: string;
  status: JobStatus;
  poll_url: string;
  events_url: string;
}
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string | null;
  code?: string | null;
  retryable?: boolean | null;
  /** 402 payment_required: what would open it ("lesson_pack" | "exam_pass") and the product
   * codes that do (GET /billing/catalog), cheapest first. */
  needs?: "lesson_pack" | "exam_pass" | "feature_pass" | null;
  unlock_with?: string[] | null;
}
export interface WritingSubmissionOut {
  id: string;
  prompt_id: string;
  status: string;
  transcript: string | null;
  created_at: string;
}
export interface WritingScoreOut {
  submission_id: string;
  criteria: Record<string, any>;
  score_min: number;
  score_max: number;
  priority_fixes: Record<string, any>[];
}

export type ImportKind = "lesson" | "corpus" | "exam_paper" | "editorial_article";
export type ImportItemStatus =
  "pending" | "flagged_yellow" | "flagged_red" | "confirmed" | "rejected";

export interface ImportBatchOut {
  id: string;
  kind: ImportKind;
  status: string;
  flagged_count: number;
  source_file: string | null;
  film_id: number | null;
  exam_paper_id: string | null;
  created_at: string;
}
export interface ImportBatchAccepted {
  import_batch_id: string;
  job_id: string;
  status: JobStatus;
  poll_url: string;
  events_url: string;
}
export interface ImportItemOut {
  id: string;
  import_batch_id: string;
  kind: string;
  status: ImportItemStatus;
  payload: Record<string, any>;
  confidence: number;
}
export interface ImportItemPatch {
  payload?: Record<string, any> | null;
  status?: "confirmed" | "rejected" | null;
}

/** What two independent reads of the same page saw differently — shown to the
 * reviewer as it is, never corrected by the model. */
export interface ExamReadDiff {
  field: string;
  /** the readable words around the difference, as the first read (the one saved) wrote them */
  a: string;
  /** ... and as the second read wrote them */
  b: string;
  /** exam-v3: the whole second reading of the field (only on the first difference of
   * a field), so the reviewer can take it in one tap */
  b_full?: string;
  /** exam-v3: all options of the second read, when the reads found a different number */
  b_options?: string[];
}
/** exam-v3: standard wording offered where an instruction / stem is a standard one with
 * characters missing. Never applied by the system. */
export interface ExamInstructionSuggest {
  instruction_en?: string;
  stem_en?: string;
}
/** payload of an `exam_item` import item (extraction exam-v2). */
export interface ExamItemPayload {
  number: number;
  passage_ref: string | null;
  qtype_code: string | null;
  /** printed once above a group of questions, copied onto each of them */
  instruction_en: string | null;
  group_range: [number, number] | null;
  stem_en: string;
  options: string[];
  /** 1-based, like the key; null until a key is applied */
  answer: number | null;
  answer_from_key: boolean;
  answer_guess: number | null;
  /** the page of the uploaded file (counting from 1), as the model labelled it; null when unknown */
  source_page: number | null;
  flags: string[];
  alt?: ExamReadDiff[];
  instruction_suggest?: ExamInstructionSuggest;
}
/** payload of an `exam_passage` import item. */
export interface ExamPassagePayload {
  local_ref: string;
  kind: string | null;
  body_en: string | null;
  /** the paper prints "저작권 …" instead of the text */
  withheld: boolean;
  source_page: number | null;
  flags: string[];
  alt?: ExamReadDiff[];
}
/** payload of the `exam_summary` item: facts about the whole extraction, never
 * reviewed (its status is always "confirmed"). */
export interface ExamSummaryPayload {
  prompt_version: string;
  /** "đọc" | "nghe" | "viết" | null */
  section: string | null;
  numbers: number[];
  questions: number;
  gaps: number[];
  duplicates: number[];
  pages: number;
  windows: number;
  /** indexes of the page windows that could not be read */
  failed_windows: number[];
  verify_windows: number;
  verify_failed: number[];
  verified: boolean;
  /** exam-v3: the model that read the paper */
  model?: string;
  /** exam-v3: pages read again for their hard spots, pages where that failed, and
   * the questions whose text came from that narrow look */
  refine_pages?: number[];
  refine_failed?: number[];
  refined?: number[];
  key?: {
    source: "file" | "paper" | "manual";
    skill: string | null;
    /** how many questions got an answer */
    applied: number;
    missing: number[];
    unmatched: number[];
    conflicts: number[];
    at: string;
  } | null;
}

/** Result of the answer-key job (`job.result`): like ExamAnswerReportOut, but
 * `applied` is a count there. */
export interface ExamKeyJobResult {
  import_batch_id: string;
  skill: string | null;
  applied: number;
  changed: number[];
  unmatched: number[];
  missing: number[];
  conflicts: number[];
}

/** POST /imports/{id}/answers — what typing a list of answers did (or would do). */
export interface ExamAnswerReportOut {
  dry_run: boolean;
  skill: string | null;
  /** question number → 1-based answer, as parsed */
  answers: Record<string, number>;
  applied: number[];
  changed: number[];
  unmatched: number[];
  missing: number[];
  conflicts: number[];
}

export interface TopicOut {
  id: number;
  name: string;
  quizlet_url: string | null;
}
export interface CollocationOut {
  ko: string;
  vi: string;
}
export interface ContrastOut {
  pattern: string;
  diff_vi: string;
}
/** How a word or phrase is mostly used. Null when the extraction was not sure. */
export type WordRegister = "spoken" | "written" | "neutral";

/** An exam course a word, card or note belongs to as well: "kiip-3" = KIIP stage 3 (중급1);
 * stage 5 is 한국사회이해. Absent / null = not tagged. */
export type ExamTag = `kiip-${1 | 2 | 3 | 4 | 5}`;

/** "core" = learn it now (the words the next lessons build on); "recognize" = understand it
 * when met, no need to produce it. Null on words that come from a news article. */
export type VocabPriority = "core" | "recognize";

export interface VocabItemOut {
  id: number;
  lesson_id: number | null;
  headword: string;
  pos: string | null;
  meaning_vi: string;
  definition_en: string | null;
  level: number;
  hanja: string | null;
  sino_vietnamese: string | null;
  example_en: string | null;
  /** Vietnamese for example_en (seeded lessons). */
  example_vi?: string | null;
  // The chunk layers (lesson-v4). TOPIK tests which words go together, so a
  // card is learned with its set. All absent on cards extracted before v4.
  /** The set it is learned in, e.g. "Động từ đi với thời tiết". */
  family?: string | null;
  /** The part of `headword` that must be chosen correctly (오다 in 비가 오다). */
  node_word?: string | null;
  register?: WordRegister | null;
  /** The exam course this word is part of as well ("kiip-3"). */
  exam?: ExamTag | null;
  priority?: VocabPriority | null;
  /** When / with whom, and the slip Vietnamese learners usually make. */
  usage_note_vi?: string | null;
  /** How it is read when that differs from the spelling: "[학쌩]". */
  pron_en?: string | null;
  collocations?: CollocationOut[] | null;
  /** Tempting wrong stand-ins for node_word. */
  distractors?: string[] | null;
  /** Path of this word's picture, when one has been made (and not hidden). */
  image_url?: string | null;
}
/** "must" = Bắt buộc (other cards build on it, or the courses need it daily); "normal" = Bổ trợ. */
export type GrammarImportance = "must" | "normal";

/** Another grammar card, as a link from a card. */
export interface GrammarRefOut {
  pattern: string;
  lesson_id: number;
  lesson_title: string;
  importance?: GrammarImportance | null;
}

export interface GrammarPointOut {
  id: number;
  lesson_id: number | null;
  pattern: string;
  meaning_vi: string;
  level: number;
  /** Several examples are one per line; `example_vi` lines up with them. */
  example_en: string | null;
  example_vi?: string | null;
  /** A caution that belongs to this pattern alone. */
  note_vi?: string | null;
  /** Real usage guidance — "when/in what situation", not just the bare
   * "V/A + form". Null on rows extracted before this field existed. */
  usage_context_vi: string | null;
  /** How this pattern actually shows up in TOPIK exam questions. */
  exam_tip_vi: string | null;
  /** The set of look-alike patterns it is learned with (TOPIK asks "closest in
   * meaning"), and how it differs from each of the others. */
  contrast_group?: string | null;
  contrasts?: ContrastOut[] | null;
  /** The exam course this card is part of as well ("kiip-3"). */
  exam?: ExamTag | null;
  /** Path of the illustration of this pattern, when one has been made. */
  image_url?: string | null;
  /** "extension" = a 🟣 card the exam sets use beyond the lesson's own sources. */
  tier?: GrammarTier;
  /** Extension cards only: 👁 recognise (reading/listening) or ✍ use (writing/speaking). */
  use_level?: GrammarUseLevel | null;
  /** Core cards: how much of it a learner must keep. Null on an extension card (it has use_level). */
  importance?: GrammarImportance | null;
  /** One question to answer before marking the card understood; the right option is first. */
  check_item?: { stem: string; options: string[]; why: string } | null;
  /** The earlier cards this one is made of or rests on. */
  built_from?: GrammarRefOut[];
  /** The later cards that are made of this one. */
  built_into?: GrammarRefOut[];
  /** Spaced review: the earlier card this one teaches again. */
  revisit_of?: GrammarRefOut | null;
  /** `usage_context_vi` cut into its labelled parts (Cấu tạo / Hoàn cảnh dùng / Vì sao chọn … /
   * Trong bài này), without the badge line. Absent on an older server: show `usage_context_vi`. */
  usage_sections?: GrammarUsageSection[];
  /** Where the content came from ("biên soạn bổ sung …") — a footnote, not advice. When the
   * server sends it, `note_vi` no longer carries it. */
  source_note_vi?: string | null;
}
export interface GrammarUsageSection {
  key: "form" | "when" | "why" | "lesson" | "level" | "other";
  label: string | null;
  body_vi: string;
}
export type GrammarTier = "core" | "extension";
export type GrammarUseLevel = "recognize" | "produce";
/** Sơ cấp / Trung cấp / Cao cấp. Null on a lesson that predates the seeded format. */
export type LessonTrack = "beginner" | "intermediate" | "advanced";
/** "build" is "Tạo câu": a ladder from ordering tiles to writing a short paragraph. */
export type PracticeSkill = "listening" | "reading" | "build" | "writing" | "speaking";

/** What a lesson's practice set holds (rides along with the lesson and the list). */
export interface PracticeCountsOut {
  items: number;
  questions: number;
  by_skill: Partial<Record<PracticeSkill, number>>;
}
/** A normal lesson, or the review lesson that closes a topic. */
export type LessonKind = "lesson" | "review" | "hangul";
/** What a note is for; the lesson screen groups notes by it. Older lessons have none. */
export type LessonNoteKind = "goal" | "language" | "sample" | "fact" | "writing" | "pitfall";
export interface LessonNoteOut {
  title: string | null;
  body: string;
  kind?: LessonNoteKind | null;
  /** A note the exam course needs too ("kiip-3"). */
  exam?: ExamTag | null;
}
/** How much of a lesson is part of the KIIP course (GET /lessons). `stages` counts words +
 * cards + notes by stage; `mastered` is the learner's own count of tagged words and cards
 * (null while signed out). */
export interface KiipCountsOut {
  vocab: number;
  grammar: number;
  notes: number;
  stages: Partial<Record<ExamTag, number>>;
  mastered: number | null;
}
/** One thing to try without looking at the lesson; `answer` is shown when the learner asks. */
export interface CoachCheckOut {
  prompt_vi: string;
  answer?: string | null;
}

/** "Việc cần làm" at the top of a lesson: study advice written for that lesson. The counts shown
 * beside it (words, cards, questions) are the lesson's own, not part of this block. */
export interface CoachOut {
  goal_vi?: string | null;
  focus_vi?: string[];
  watch_out_vi?: string[];
  notebook_vi?: string[];
  self_check?: CoachCheckOut[];
  tip_vi?: string | null;
}

/** One hand-planned sitting of a lesson: what the learner can do after it, its words and cards in
 * teaching order (named by `headword` / `pattern`) and the exercise ids that close it. */
export interface LessonSessionOut {
  title_vi: string;
  can_do_vi: string;
  use_vi?: string | null;
  topik_vi?: string | null;
  vocab: string[];
  grammar: string[];
  check: string[];
  situation?: SituationOut | null;
}

/** A short dialogue situation closing a sitting (lesson_seed.SituationSeed). */
export interface SituationOut {
  scene_vi: string;
  turns: { who: "A" | "B"; ko: string; vi: string }[];
  reply: {
    prompt_en: string;
    prompt_vi: string;
    options: { ko: string; vi: string; ok: boolean; why_vi: string }[];
  };
  compare: {
    ask_vi: string;
    a: { ko: string; vi: string };
    b: { ko: string; vi: string };
    better: "a" | "b";
    why_vi: string;
  };
}

/** Paid access of a lesson for the caller (see lib/billing.ts). */
export type LessonAccess = "free" | "owned" | "locked";
export interface LessonTotalsOut {
  vocab: number;
  grammar: number;
  notes: number;
}

export interface LessonOut {
  id: number;
  title: string;
  level: number;
  content: string;
  created_at: string;
  topics: TopicOut[];
  vocab: VocabItemOut[];
  grammar: GrammarPointOut[];
  // lesson-v5
  slug?: string | null;
  title_en?: string | null;
  summary?: string | null;
  track?: LessonTrack | null;
  sort_order?: number;
  notes?: LessonNoteOut[];
  coach?: CoachOut | null;
  /** The lesson cut into sittings by hand; empty = the app cuts it evenly. */
  sessions?: LessonSessionOut[];
  practice?: PracticeCountsOut | null;
  /** Path of the lesson's banner picture, when one has been made. */
  image_url?: string | null;
  /** "review" = the topic's review lesson (no words or cards of its own). */
  kind?: LessonKind;
  /** Paid access: "free" (also every lesson while billing is off), "owned", or "locked" — then
   * this is only a preview and `unlock_with` lists the product codes that open it. */
  access?: LessonAccess;
  unlock_with?: string[];
  /** What a locked lesson holds in full. */
  totals?: LessonTotalsOut | null;
}
/** One row of the lesson picker (GET /lessons). `mastered` is null for an
 * anonymous caller; `is_next` marks the lesson /me/plan would hand a signed-in
 * learner. */
export interface LessonSummaryOut {
  id: number;
  title: string;
  level: number;
  topics: string[];
  vocab_count: number;
  grammar_count: number;
  mastered: number | null;
  is_next: boolean;
  // lesson-v5
  slug?: string | null;
  title_en?: string | null;
  summary?: string | null;
  track?: LessonTrack | null;
  sort_order?: number;
  practice?: PracticeCountsOut | null;
  /** Practice questions answered right / answered at all; null when anonymous. */
  practice_correct?: number | null;
  practice_answered?: number | null;
  /** Path of the lesson's banner picture (the picker's thumbnail). */
  image_url?: string | null;
  /** cover of its (first) topic, for the topic card */
  topic_image_url?: string | null;
  /** "review" = the topic's review lesson; `mastered` is null for it. */
  kind?: LessonKind;
  /** What of this lesson the KIIP course needs too; absent / null = nothing is tagged. */
  kiip?: KiipCountsOut | null;
  access?: LessonAccess;
  unlock_with?: string[];
  /** Hành trình Thiên Nga: the chapter of a main lesson (null: a support lesson, then `support`
   * is its constellation), its feathers, and the learner's earned ones (null signed out). */
  chapter?: number | null;
  support?: string | null;
  feathers_total?: number;
  feathers_earned?: number | null;
}

// ------------------------------------------------------------ lesson practice --
// GET /lessons/{id}/practice mirrors the validated seed shape of the backend
// (app/services/lesson_seed.py). Answers and explanations ship with it because
// the browser grades instantly.
export interface PracticeChart {
  type: "bar" | "line" | "pie";
  title_vi?: string | null;
  unit?: string | null;
  categories: string[];
  series: { name: string; values: number[] }[];
}
export interface PracticeTable {
  header: string[];
  rows: string[][];
}
/** A chart or a table with its caption. */
export interface PracticeDataBlock {
  title_vi?: string | null;
  note_vi?: string | null;
  chart?: PracticeChart | null;
  table?: PracticeTable | null;
}
/** A picture drawn from icons (names in src/lib/scene-icons.ts). */
export interface PracticeScene {
  caption_vi: string;
  icons: string[];
  image_prompt?: string | null;
}
export interface PracticeGuideBlock {
  title_vi: string;
  body_vi?: string | null;
  bullets_vi?: string[];
  table?: PracticeTable | null;
}
export interface PracticeTurn {
  /** F = woman, M = man, N = narrator */
  speaker: "F" | "M" | "N";
  text: string;
  /** What the line means in Vietnamese; shown with the script after the answer. */
  vi?: string | null;
}
export type PracticeStimulus =
  | { kind: "audio"; turns: PracticeTurn[] }
  | { kind: "cloze"; text: string }
  | { kind: "underline"; text: string }
  | { kind: "notice"; title?: string | null; lines: string[] }
  | { kind: "chart"; block: PracticeDataBlock }
  | { kind: "order"; items: { id: string; text: string }[] }
  | { kind: "headline"; text: string; hint_vi?: string | null }
  | { kind: "passage"; text: string }
  | { kind: "insert"; given: string; text: string };
export interface PracticeOption {
  id: string;
  text?: string | null;
  scene?: PracticeScene | null;
  chart?: PracticeChart | null;
}
export interface PracticeQuestion {
  id: string;
  prompt_en?: string | null;
  prompt_vi?: string | null;
  options: PracticeOption[];
  answer: string;
  explanation_vi: string;
  tags?: string[];
  /** Patterns of the grammar cards this question tests (keys of `LessonPracticeOut.grammar`),
   * the main one first. */
  grammar?: string[];
}
export interface McqExerciseOut {
  id: string;
  skill: "listening" | "reading";
  type: string;
  title_vi: string;
  instruction_en?: string | null;
  instruction_vi?: string | null;
  stimulus?: PracticeStimulus | null;
  questions: PracticeQuestion[];
}
export interface WriteBlankOut {
  id: string;
  points: number;
  accepted: string[];
  common_errors_vi?: string | null;
}
/** Rung 1 of "Tạo câu": put word tiles in order to make one sentence. */
export interface BuildOrderOut {
  id: string;
  skill: "build";
  type: "build_order";
  rung: 1;
  title_vi: string;
  instruction_vi?: string | null;
  situation_vi?: string | null;
  /** What the sentence has to say, in Vietnamese. */
  meaning_vi: string;
  /** Already shuffled; a tile that no answer uses is a distractor. */
  tiles: string[];
  /** Every accepted order, tiles joined by one space; the first is the model. */
  answers: string[];
  explain_vi?: string | null;
  common_errors_vi?: string[];
  grammar?: string[];
}
export interface WriteFillOut {
  id: string;
  skill: "writing" | "build";
  /** "build" only: 2 = fill the frame, 3 = join two sentences. */
  rung?: number | null;
  type: "write_fill";
  number: string;
  title_vi: string;
  points: number;
  instruction_en?: string | null;
  instruction_vi?: string | null;
  context_vi?: string | null;
  heading_en?: string | null;
  text: string;
  blanks: WriteBlankOut[];
  tips_vi?: string[];
  grammar?: string[];
}
export interface WriteEssayOut {
  id: string;
  skill: "writing" | "build";
  /** "build" only: 4 = a short paragraph for one purpose, 5 = the learner's own text (the lesson's output). */
  rung?: number | null;
  type: "write_essay";
  number: string;
  title_vi: string;
  points: number;
  instruction_en?: string | null;
  instruction_vi?: string | null;
  limits: { min: number; max: number };
  data?: PracticeDataBlock[];
  prompt_en?: string | null;
  bullets_en?: string[];
  framework_vi?: string[];
  patterns_vi?: string[];
  outline?: { part_vi: string; content_vi: string; chars?: string | null }[];
  model_answer_en: string;
  model_note_vi?: string | null;
  common_errors_vi?: string[];
  rubric?: { criterion_vi: string; max: number; note_vi?: string | null }[];
  checklist_vi?: string[];
  /** Patterns the paragraph is meant to use; the screen shows which ones the text has. */
  detectors?: CapstoneDetectorOut[];
  /** Rung 5: the pieces of the model answer and the card (word or pattern) that teaches each one. */
  uses?: { form: string; card: string }[];
  grammar?: string[];
}
export interface SpeakPracticeOut {
  id: string;
  label_vi: string;
  prompt_en?: string | null;
  prompt_vi?: string | null;
  hint_vi?: string | null;
  frames?: PracticeScene[];
  data?: PracticeDataBlock[];
}
export interface SpeakOut {
  id: string;
  skill: "speaking";
  type: "speak";
  number: string;
  title_vi: string;
  max_points: number;
  prep_sec: number;
  answer_sec: number;
  instruction_en?: string | null;
  prompt_en: string;
  prompt_vi?: string | null;
  situation_vi?: string | null;
  frames?: PracticeScene[];
  audio?: { kind: "audio"; turns: PracticeTurn[] } | null;
  data?: PracticeDataBlock[];
  plan?: { when_vi: string; do_vi: string; phrases_en?: string | null }[];
  tips_vi?: string[];
  patterns_vi?: string[];
  model_answer_en: string;
  syllables_vi?: string | null;
  common_errors_vi?: string[];
  pronunciation_vi?: string[];
  practice?: SpeakPracticeOut[];
}
/** Chép chính tả: hear a short script, type it line by line, then listen again with the script
 * and learn the words that were missed. Has no options and no score of its own: it counts as
 * done when the typed text is close enough to the script. */
export interface DictationOut {
  id: string;
  skill: "listening";
  type: "listen_dictation";
  title_vi: string;
  instruction_vi?: string | null;
  stimulus: { kind: "audio"; turns: PracticeTurn[] };
  /** The words and forms to learn after the check. */
  focus: { ko: string; vi: string }[];
  tips_vi?: string[];
  grammar?: string[];
}
export type PracticeItem = (
  McqExerciseOut | BuildOrderOut | WriteFillOut | WriteEssayOut | SpeakOut | DictationOut
) &
  PracticeItemExtras;

/** What the server adds to an item (app/services/practice_tiers.py). */
export interface PracticeItemExtras {
  /** "challenge": a long text with many words not met yet, shown after the rest of its skill. */
  tier?: "warm" | "challenge";
  /** How many of its words the learner has not met yet in the course. */
  new_words?: number;
  support?: PracticeSupportOut;
}

/** Help before a hard item: words in this text, grammar not met yet, a three-step hint. */
export interface PracticeSupportOut {
  words: { ko: string; seen: string; vi: string }[];
  grammar: {
    form: string;
    seen: string;
    vi: string;
    lesson: string | null;
    lesson_id?: number | null;
    lesson_title?: string | null;
  }[];
  focus_vi: string;
  /** question id -> the options in Vietnamese */
  options_vi: Record<string, string[]>;
  /** question id -> one wrong option to cross out */
  elim: Record<string, string>;
}

export interface PracticeOverviewOut {
  blocks?: PracticeGuideBlock[];
  disclaimer_vi?: string[];
}
export interface PracticeExtensionOut {
  grammar?: { item: string; used_in: string; meaning_vi: string; simpler_vi: string }[];
  vocab_note_vi?: string | null;
  vocab_en?: string[];
}
/** A grammar card a practice question is linked to: enough for the box under the answer. */
export interface LinkedCardOut {
  pattern: string;
  meaning_vi: string;
  tier: GrammarTier;
  use_level?: GrammarUseLevel;
  lesson_slug: string;
  lesson_title: string;
  /** The lesson that teaches the card (to open it); null if it is no longer in the database. */
  lesson_id: number | null;
  /** The first look-alike pattern and how it differs. */
  contrast?: { pattern: string; diff_vi: string };
  /** The patterns of the earlier cards this one is made of. */
  builds_on?: string[];
  importance?: GrammarImportance | null;
  example_en?: string | null;
  example_vi?: string | null;
}
export interface LessonPracticeOut {
  lesson_id: number;
  items: PracticeItem[];
  guides: Partial<Record<PracticeSkill, PracticeGuideBlock[]>>;
  overview?: PracticeOverviewOut | null;
  extension?: PracticeExtensionOut | null;
  /** pattern -> card, for the patterns the questions are linked to. */
  grammar?: Record<string, LinkedCardOut>;
  /** image prompt -> URL; empty unless scene pictures are switched on. */
  scene_images: Record<string, string>;
  /** "review" for a topic review lesson, which also ships `review`. */
  kind?: LessonKind;
  review?: ReviewOut | null;
  /** The alphabet lesson's five parts (kind "hangul"). */
  hangul?: HangulOut | null;
  /** Question type -> one line on how to do it: the types this lesson is the first to use. */
  type_intro?: Record<string, { name_vi: string; how_vi: string }>;
}

// ------------------------------------------------------------------ alphabet lesson --
export interface HangulLetterOut {
  jamo: string;
  sound_vi: string;
  /** A block that says the letter (letters alone are read by their names). */
  example: string;
  note_vi?: string | null;
}
export interface HangulGroupOut {
  title_vi: string;
  note_vi?: string | null;
  letters: HangulLetterOut[];
}
export interface HangulWordOut {
  ko: string;
  vi: string;
  /** How it is said, when that differs from how it is written (학생 → 학쌩). */
  say?: string | null;
  note_vi?: string | null;
}
export interface HangulPickOut {
  hear: string;
  options: string[];
  answer: string;
}
export interface HangulChangeOut {
  written: string;
  said: string;
  vi: string;
}
export interface HangulRuleOut {
  title_vi: string;
  body_vi: string;
  changes: HangulChangeOut[];
}
export interface HangulPartOut {
  id: string;
  title_vi: string;
  goal_vi: string;
  /** What the swan says when this part's candle is lit. */
  swan_vi: string;
  explain: { title: string; body: string }[];
  groups: HangulGroupOut[];
  rules: HangulRuleOut[];
  build: string[];
  sort: string[];
  picks: HangulPickOut[];
  words: HangulWordOut[];
  keyboard: string[];
}
export interface HangulOut {
  intro_vi: string;
  done_vi: string;
  parts: HangulPartOut[];
}

// ----------------------------------------------------------- topic review lesson --
/** "Khi nào dùng cái nào": a situation and the card(s) that fit it, the right one first. */
export interface ReviewRuleOut {
  when_vi: string;
  use: string[];
  note_vi?: string | null;
}
/** One job grammar does in a sentence, with the cards that do it. */
export interface ReviewFunctionOut {
  id: string;
  title_vi: string;
  summary_vi: string;
  patterns: string[];
  rules: ReviewRuleOut[];
  pitfalls_vi?: string[];
}
export interface ReviewBandOut {
  label_vi: string;
  min_correct: number;
}
/** One level of the TOPIK I-style estimate (scored out of 200: listening 100 + reading 100). */
export interface ReviewScoreBandOut {
  label_vi: string;
  min_score: number;
}
export interface ReviewScoreOut {
  /** How many listening / reading questions the set holds (30 / 40 in the real TOPIK I). */
  listening: number;
  reading: number;
  /** Ascending by `min_score`, the first at 0. */
  bands: ReviewScoreBandOut[];
  /** What the learner is told about how far to trust the estimate. */
  note_vi: string;
}
export interface ReviewMockOut {
  minutes: number;
  /** Ascending by `min_correct`, the first at 0. Approximate ratios, not a real TOPIK score. */
  bands: ReviewBandOut[];
  /** Present when the set is read like a TOPIK I paper (an estimated score out of 200). */
  score?: ReviewScoreOut | null;
  /** Every multiple-choice question of the lesson, in the order of the set. */
  question_ids: string[];
}
/** Tells whether a pattern shows up in the learner's text (the regex runs on that text). */
export interface CapstoneDetectorOut {
  pattern: string;
  regex: string;
  label_vi?: string | null;
}
export interface CapstoneOut {
  essay_id: string;
  speak_id: string;
  required: CapstoneDetectorOut[];
  min_required: number;
}
export interface ReviewOut {
  functions: ReviewFunctionOut[];
  mock: ReviewMockOut;
  capstone: CapstoneOut;
  /** pattern -> card, for every card of the map. */
  cards: Record<string, LinkedCardOut>;
}
/** POST /lessons/{id}/answers — one practice question the learner just answered. */
export interface ExerciseAnswerRequest {
  exercise_id: string;
  question_id: string;
  correct: boolean;
  /** An option id or typed text, ≤ 500 characters. */
  answer?: string | undefined;
}
export interface ExerciseResultOut {
  exercise_id: string;
  question_id: string;
  correct: boolean;
  attempts: number;
  answer?: string | null;
}
export interface LessonProgressOut {
  lesson_id: number;
  total: number;
  answered: number;
  correct: number;
  results: ExerciseResultOut[];
}

/** What the learner did with one word / grammar card of a lesson (only cards with a record). */
export interface CardStudyOut {
  item_type: "vocab_item" | "grammar_point";
  item_id: number;
  /** The last answer: true = "đã hiểu / đã nhớ", false = "chưa chắc / chưa nhớ". */
  last_correct: boolean;
  strength: number;
}

/** GET /lessons/{id}/study: where the learner stands in one lesson, kept on the server so a
 * new session (or another phone) opens on the part that is left. */
export interface LessonStudyOut {
  lesson_id: number;
  vocab_total: number;
  vocab_met: number;
  grammar_total: number;
  grammar_met: number;
  practice_total: number;
  practice_answered: number;
  /** The first part with something left; null when every part is done. */
  resume_step: "listen" | "vocab" | "grammar" | "practice" | null;
  cards: CardStudyOut[];
  /** The lesson cut into feathers (about five minutes each), in the order it shows them. */
  feathers?: FeatherOut[];
  /** The chapter of Hành trình Thiên Nga it belongs to; null: a support lesson. */
  chapter?: number | null;
  /** A support lesson: its constellation's code. */
  support?: string | null;
}

/** Một cọng lông: a small part of a lesson, earned by marking its words / cards once, answering
 * its questions, or finishing its part (the alphabet lesson). */
export interface FeatherOut {
  id: string;
  kind: "vocab" | "grammar" | "practice" | "part";
  label: string;
  /** practice: the skill tab it is in */
  skill?: string | null;
  part?: string | null;
  item_ids: number[];
  question_ids: string[];
  earned: boolean;
}

/** Sổ lỗi sai (GET /me/mistakes): a practice question whose latest answer is wrong, written out. */
export interface MistakeLineOut {
  text: string;
  vi?: string | null;
  speaker?: string | null;
}
export interface MistakeGrammarOut {
  pattern: string;
  meaning_vi?: string | null;
  lesson_id?: number | null;
  lesson_title?: string | null;
}
export interface MistakeOut {
  exercise_id: string;
  question_id: string;
  type: string;
  skill: string;
  title: string;
  prompt?: string | null;
  context: MistakeLineOut[];
  options: { id: string; text: string }[];
  chosen_id?: string | null;
  correct_id?: string | null;
  /** What the learner picked (an option's text) or typed; dictation lines are joined with " / ". */
  chosen?: string | null;
  correct: string[];
  explanation_vi?: string | null;
  notes_vi: string[];
  focus: { ko: string; vi: string }[];
  translation: string[];
  grammar: MistakeGrammarOut[];
  attempts: number;
  updated_at: string;
  understood: boolean;
}
export interface MistakeLessonOut {
  lesson_id: number;
  title: string;
  sort_order: number;
  mistakes: MistakeOut[];
}
export interface MistakeBookOut {
  lessons: MistakeLessonOut[];
  open: number;
  understood: number;
}
export interface CorpusItemOut {
  id: string;
  film_id: number;
  film_title: string;
  text_en: string;
  kind: string;
  level: number;
  register: string;
  topics: string[];
  grammar_patterns: string[];
  /** What the line means in Vietnamese, and when/with whom to use it. Null
   * until the backend has enriched the sentence — the UI then shows the
   * Korean alone. */
  meaning_vi?: string | null;
  usage_note_vi?: string | null;
}
/** A sentence close in meaning to another (cosine distance on the stored
 * embedding: 0 = identical, larger = further apart). */
export interface CorpusSimilarOut extends CorpusItemOut {
  distance: number;
}
/** Studio: how much of the corpus has a meaning, usage note and naturalness
 * verdict. Counts are stored rows (a repeated sentence counts twice here). */
export interface CorpusEnrichmentStatusOut {
  version: string;
  total: number;
  pending: number;
  enriched: number;
  /** judged unnatural: not shown to learners */
  hidden: number;
  /** readable but stiff: still shown */
  awkward: number;
  active_job_id: string | null;
}
export interface HiddenCorpusItemOut {
  id: string;
  film_title: string;
  text_en: string;
}
export interface CorpusFacetsOut {
  total: number;
  levels: { level: number; count: number }[];
  registers: { register: string; count: number }[];
  topics: { id: number; name: string; count: number }[];
  grammar: { id: number; pattern: string; count: number }[];
  films: { id: number; title: string; count: number }[];
}
export interface CorpusPageOut {
  total: number;
  offset: number;
  items: CorpusItemOut[];
}
export interface CorpusAudioRequest {
  text_en: string;
  voice?: string;
  prompt_version?: string;
}
export interface VocabAudioRequest {
  text_en: string;
  voice?: string;
  prompt_version?: string;
}
/** POST /audio/text — read any Korean text aloud (a sentence, a dialogue line,
 * a short passage; Korean only, up to 600 characters). Filed server-side under
 * a hash of the text + voice, so the same text asked for again plays at once. */
export interface TextAudioRequest {
  text: string;
  voice?: string;
  prompt_version?: string;
}
export interface PodcastRequest {
  voice?: string;
  prompt_version?: string;
  /** Lessons only. "template" (default) = a fixed script built from the lesson, no
   * model involved; "story" = Gemini retells the lesson (written in parts when it
   * is long). Each is stored and reused on its own. */
  mode?: "template" | "story";
  /** Lessons only: the lecture of this sitting (buổi, 1-based) alone, not the whole lesson. */
  sitting?: number;
}
/** POST /editorials/{id}/audio — reads the article's OWN body_en text
 * aloud verbatim (no Gemini script-writing step, unlike PodcastRequest).
 * Completely independent study mode from the podcast: this is the real
 * news text, native pacing/pauses, not a teaching script about its
 * vocab/grammar. */
export interface ArticleAudioRequest {
  voice?: string;
  prompt_version?: string;
  /** "easy" = the simplified-Korean (TOPIK 1-2) rewrite from the study pack. */
  variant?: "original" | "easy";
}
export interface AudioJobResult {
  cache_key: string;
  opus_path: string;
  aac_path: string;
  duration_sec: number;
  /** Article recordings only: when each sentence starts, so the reader can
   * follow the audio. null/absent for a recording made without it. */
  timings?: ReadAlongTimings | null;
  /** Only set for a podcast job (POST /lessons/{id}/podcast or
   * /editorials/{id}/podcast) — the Gemini-written script that was
   * synthesized, so the UI can show a transcript alongside playback. */
  script_text?: string;
  /** Lesson lectures recorded with it: [line, run, ms], when each language run of the script
   * starts (the lecture's slides follow it). */
  timeline?: [number, number, number][] | null;
}
export interface ItemStateReviewRequest {
  item_type: "vocab_item" | "grammar_point";
  item_id: number;
  correct: boolean;
  /** How the card was asked, and — for a wrong fill-in-the-blank — the choice the
   * learner picked. Optional: they only make the error log ("sổ lỗi") more exact. */
  mode?: "recognize" | "cloze" | undefined;
  chosen?: string | undefined;
  /** "Chưa chắc": right, but a guess — the card comes back sooner and gains no strength. */
  hard?: boolean | undefined;
  /** How long the answer took; a right answer slower than 8 s counts as "chưa chắc" too. */
  response_ms?: number | undefined;
}
export interface ItemStateOut {
  item_type: string;
  item_id: number;
  strength: number;
  last_seen: string;
  /** When the item comes back (spaced review), how many right answers in a row,
   * how often it was forgotten. */
  due_at?: string | null;
  reps?: number;
  lapses?: number;
  interval_days?: number;
  /** "Đã biết": out of the review queue until undone. */
  known_at?: string | null;
}

/** "Hôm nay bận — chỉ ôn" for today. */
export interface ReviewOnlyOut {
  review_only: boolean;
  day: string | null;
}

/** A fill-in-the-blank question; the answer is included so it can be marked at once. */
export interface ClozeOut {
  prompt_en: string;
  answer: string;
  choices: string[];
}
export interface ReviewQueueItem {
  item_type: "vocab_item" | "grammar_point";
  item_id: number;
  is_new: boolean;
  /** recognize = flip the card and judge yourself; cloze = pick the missing word. */
  mode: "recognize" | "cloze";
  reps: number;
  lapses: number;
  /** Forgotten again and again: shown first and flagged "hay sai". */
  leech?: boolean;
  due_at: string | null;
  lesson_title: string | null;
  /** A word that comes from a news article rather than a lesson. */
  article_id?: string | null;
  article_title?: string | null;
  /** A word from a deck of the TOPIK word bank the learner added. */
  bank_deck?: string | null;
  bank_title?: string | null;
  vocab: VocabItemOut | null;
  grammar: GrammarPointOut | null;
  cloze: ClozeOut | null;
}
/** Today's sitting: what is due, then what is new. */
export interface ReviewQueueOut {
  /** Everything due now — can be more than the due cards returned. */
  due_total: number;
  /** New cards today's cap still allows. */
  new_available: number;
  /** New cards started in the last 24 hours. */
  new_today: number;
  items: ReviewQueueItem[];
  /** "weak": the cards the learner keeps forgetting, due or not. */
  focus?: "due" | "weak";
  /** Article words not started yet that fit the learner's level. */
  article_waiting?: number;
  /** Article words held back because they are above the goal level. */
  article_above_level?: number;
  /** "Hôm nay bận — chỉ ôn" is on for today: no new cards. */
  review_only?: boolean;
}

// ---------------------------------------------------------------- practice --
export interface WeakTypeOut {
  error_type: string;
  label: string;
  skill: string;
  count: number;
}
export interface WeakItemOut {
  item_type: "vocab_item" | "grammar_point";
  item_id: number;
  /** The chunk or the grammar pattern. */
  title: string;
  meaning_vi: string;
  family: string | null;
  errors: number;
}
export interface WeakFamilyOut {
  family: string;
  errors: number;
}
export interface ExamAccuracyOut {
  qtype_code: string;
  name: string;
  attempts: number;
  correct: number;
  accuracy_pct: number;
}
/** Where the learner keeps going wrong in the last `days` days. Counts of what
 * happened — never a prediction of an exam score. */
export interface WeaknessesOut {
  days: number;
  total_errors: number;
  by_type: WeakTypeOut[];
  top_items: WeakItemOut[];
  families: WeakFamilyOut[];
  exam: ExamAccuracyOut[];
  weak_cards: number;
  leeches: number;
  exam_ready: number;
}

export interface ExamDrillQuestion {
  id: string;
  number: number;
  qtype_code: string;
  qtype_name_vi: string;
  /** printed once above a group of questions; null for older questions */
  instruction_en?: string | null;
  stem_en: string;
  options: string[];
  passage_en: string | null;
  paper_label: string;
}
export interface ExamDrillOut {
  items: ExamDrillQuestion[];
  /** Usable questions in the bank, whether or not they are offered now. */
  available: number;
}
export interface ExamAnswerRequest {
  item_id: string;
  /** 1-based, like the key. */
  chosen: number;
}
export interface ExamAnswerOut {
  item_id: string;
  chosen: number;
  answer: number;
  correct: boolean;
}

export type WritingLabel = "㉠" | "㉡";
export interface WritingBlankView {
  label: WritingLabel;
  intent_vi: string;
  uses: string[];
}
export interface WritingTargetOut {
  item_id: number;
  headword: string;
  meaning_vi: string;
}
export interface WritingPromptOut {
  text_type: string | null;
  title_en: string | null;
  body_en: string;
  register: string | null;
  blanks: WritingBlankView[];
  targets: WritingTargetOut[];
}
export interface WritingFixOut {
  original: string;
  corrected: string;
  category: string;
  reason_vi: string;
  source: "ai" | "auto";
}
export type WritingVerdict = "good" | "minor" | "off" | "unchecked";
export interface WritingBlankResultOut {
  label: WritingLabel;
  answer: string;
  verdict: WritingVerdict;
  comment_vi: string;
  fixes: WritingFixOut[];
  model_answer: string;
  alt_answers: string[];
  intent_vi: string;
}
export interface WritingResultOut {
  blanks: WritingBlankResultOut[];
  ai_checked: boolean;
  note: string;
}
export interface WritingDrillOut {
  id: string;
  /** The exercise being made. */
  status: "pending" | "ready" | "failed";
  /** The answers being checked. */
  grade_status: "none" | "pending" | "ready" | "failed";
  job_id: string | null;
  prompt: WritingPromptOut | null;
  answers: Record<string, string> | null;
  result: WritingResultOut | null;
  created_at: string;
}
export interface WritingDrillStartOut {
  drill_id: string;
  status: "pending" | "ready" | "failed";
  /** Follow it with the jobs API while status is "pending". */
  job_id: string | null;
}
export interface WritingAnswersRequest {
  answers: Partial<Record<WritingLabel, string>>;
}

export interface TodayPlanTask {
  kind:
    | "review"
    | "vocab_review"
    | "topic_review"
    | "listening"
    | "reading"
    | "placement"
    | "daily_reading";
  title: string;
  subtitle: string;
  status: "todo" | "in_progress" | "done";
  lesson_id: number | null;
  article_id: string | null;
  /** For the lesson task: the part of the lesson still to do (the lesson screen finds it by itself). */
  step?: "listen" | "vocab" | "grammar" | "practice" | null;
}

/** Hành trình Thiên Nga (backend app/services/journey.py). */
export interface JourneyOut {
  /** 1–5 reached; only goes up */
  stage: number;
  /** what the swan wears now (one stage back while cursed) */
  shown_stage: number;
  /** full days away before today */
  missed_days: number;
  cursed: boolean;
  studied_today: boolean;
  /** words and cards studied */
  items: number;
  /** no longer used (stages come from chapters) */
  next_readiness?: number | null;
  next_items?: number | null;
  name: string;
  card: string;
  /** the weekly streak shield (one day off a week forgiven) is unused this week */
  shield_ready?: boolean;
  /** the last day the shield covered, within the past week (ISO date) */
  shield_day?: string | null;
  /** chapters I–IV: their feathers (V is where the swan lives after) */
  chapters?: JourneyChapterOut[];
  /** chapter III's station (the far shore in sight) is reached */
  station?: boolean;
  /** feathers of the support lessons */
  starlight?: number;
  starlight_total?: number;
  /** 0–3, never lowered */
  sparkle?: number;
  next_sparkle_at?: number | null;
  /** codes of the relics earned, kept for good */
  relics?: string[];
  constellations?: ConstellationOut[];
}

export interface JourneyChapterOut {
  n: number;
  name: string;
  level: string;
  /** what the swan does when it is finished */
  becomes: string;
  earned: number;
  /** feathers of lessons the entry check let the learner skip */
  credited: number;
  total: number;
  lessons: number;
  lessons_done: number;
  done: boolean;
}

export interface StarOut {
  lesson_id: number;
  title: string;
  earned: number;
  total: number;
  lit: boolean;
}

/** A support topic: a constellation of its lessons, and its relic once finished. */
export interface ConstellationOut {
  code: string;
  name: string;
  topic: string;
  relic?: string | null;
  relic_earned: boolean;
  stars: StarOut[];
}

export interface TodayPlanOut {
  streak_days: number;
  readiness_pct: number | null;
  goal: string | null;
  exam_date: string | null;
  tasks: TodayPlanTask[];
  journey?: JourneyOut | null;
}

export interface EditorialArticleSummaryOut {
  id: string;
  source_name: string;
  title_en: string | null;
  level_estimate: number | null;
  topic_tags: string[];
  created_at: string;
  /** First scraped photo of the article, for the list-card thumbnail. */
  cover_image_url?: string | null;
  /** The course lessons this article follows (closest first) and a one-line "when to read it". */
  related_lesson_ids?: number[];
  unlock_hint?: string | null;
}
/** One question asked right after reading an article. */
export type EditorialPracticeItem =
  | {
      type: "mcq";
      skill: "reading" | "vocab" | "grammar";
      prompt_en: string;
      options: string[];
      answer_index: number;
      explanation_vi: string;
    }
  | { type: "apply"; prompt_vi: string; model_en: string };
/** One photo from the source article. `after_paragraph` = how many body
 * paragraphs precede it (0 = above the first paragraph). */
export interface ArticleImageOut {
  url: string;
  caption?: string | null;
  after_paragraph: number;
}
/** Beginner "reading ladder" — generated once per article on the backend
 * (app/services/study_pack.py). `paragraphs[i]` lines up with the i-th
 * newline-separated paragraph of `body_en`. */
export interface StudyWordOut {
  surface: string;
  base?: string | null;
  pos?: string | null;
  meaning_vi: string;
}
export interface StudySentenceOut {
  ko: string;
  vi?: string | null;
  words: StudyWordOut[];
  grammar_notes_vi: string[];
}
export interface StudyParagraphOut {
  easy_en?: string | null;
  sentences: StudySentenceOut[];
}
export interface StudyKeyTermOut {
  ko: string;
  vi: string;
}
export interface StudyPackOut {
  summary_vi: string;
  key_points_vi: string[];
  key_terms: StudyKeyTermOut[];
  paragraphs: StudyParagraphOut[];
}
export type StudyStatus = "none" | "pending" | "ready" | "failed";

export interface EditorialArticleOut {
  id: string;
  source_name: string;
  source_url: string;
  title_en: string | null;
  level_estimate: number | null;
  topic_tags: string[];
  body_en: string;
  vocab: VocabItemOut[];
  grammar: GrammarPointOut[];
  thinking_guide_text: string | null;
  created_at: string;
  images?: ArticleImageOut[];
  /** True when the server just queued a background photo fetch for an
   * article imported before photos existed — refetch once after a few
   * seconds instead of showing none. */
  images_pending?: boolean;
  study_status?: StudyStatus;
  study?: StudyPackOut | null;
  related_lesson_ids?: number[];
  unlock_hint?: string | null;
  practice?: EditorialPracticeItem[];
}
export interface EditorialModelOutline {
  phenomenon: string;
  cause: string;
  consequence: string;
  solution: string;
}
export interface EditorialOutlineSubmitRequest {
  phenomenon_text?: string | null;
  cause_text?: string | null;
  consequence_text?: string | null;
  solution_text?: string | null;
}
export interface EditorialSourceOut {
  id: number;
  name: string;
  base_url: string;
  rss_url: string | null;
  license_note: string | null;
  active: boolean;
}
export interface EditorialSourceCreate {
  name: string;
  base_url: string;
  rss_url?: string | null;
  license_note?: string | null;
  active?: boolean;
}
export interface EditorialSourceUpdate {
  base_url?: string | null;
  rss_url?: string | null;
  license_note?: string | null;
  active?: boolean | null;
}
export interface EditorialCandidateOut {
  id: string;
  source_name: string;
  source_url: string;
  title_en: string;
  snippet_en: string | null;
  topic_tags: string[];
  published_date: string | null;
  status: string;
  discovered_at: string;
}

export type EditorialOutlineFeedbackStatus = "none" | "pending" | "ready" | "failed";

export interface EditorialOutlineOut {
  editorial_article_id: string;
  phenomenon_text: string | null;
  cause_text: string | null;
  consequence_text: string | null;
  solution_text: string | null;
  revision_count: number;
  updated_at: string;
  model_outline: EditorialModelOutline | null;
  /** Real Gemini analysis of what the learner actually wrote — not
   * model_outline (the static reference answer). "pending" right after a
   * save; poll GET .../outline again until it's "ready"/"failed". */
  feedback_status: EditorialOutlineFeedbackStatus;
  feedback_text: string | null;
}

// ------------------------------------------------------------ lesson pictures --
// Editors draw the pictures of lessons in Studio (backend app/services/lesson_image.py).
export type ImageSlotKind = "lesson" | "vocab" | "grammar" | "scene";
/** An existing picture that could stand in for a missing one (a word of the same meaning). */
export interface ReuseCandidateOut {
  /** The existing picture. */
  key: string;
  /** The word it was made for. */
  label: string;
  meaning: string | null;
  /** One line for the editor: "Cùng nghĩa với …". */
  why: string;
  /** Sure enough for the "reuse every sure one" button. */
  confident: boolean;
  url: string;
}
export interface ImageSlotOut {
  key: string;
  kind: ImageSlotKind;
  /** The word, the pattern, the scene's caption. */
  label: string;
  /** What the picture is drawn as, in plain English words. */
  prompt: string;
  /** A word's meaning (Vietnamese). */
  meaning: string | null;
  /** Null until the picture is made. */
  url: string | null;
  hidden: boolean;
  /** Who made it; "reuse:<model>" for a copy of another word's picture. */
  model: string | null;
  /** While the picture is missing: existing pictures of words that mean the same, best first. */
  reuse: ReuseCandidateOut[];
}
export interface LessonImagesOut {
  lesson_id: number;
  title: string;
  enabled: boolean;
  model: string;
  total: number;
  have: number;
  hidden: number;
  slots: ImageSlotOut[];
  active_job_id: string | null;
}
export interface LessonImageSummaryOut {
  lesson_id: number;
  slug: string | null;
  title: string;
  total: number;
  have: number;
  hidden: number;
  /** Missing pictures an existing one of the same meaning could fill. */
  reusable: number;
}
export interface ImagesOverviewOut {
  enabled: boolean;
  model: string;
  lessons: LessonImageSummaryOut[];
  /** Distinct pictures over all lessons (one shared by two lessons counts once). */
  total: number;
  have: number;
  /** Missing pictures an existing one could fill (distinct), and how many of those are sure. */
  reusable: number;
  reusable_sure: number;
  active_job_id: string | null;
  active_lesson_id: number | null;
}
export interface ImageReusedOut {
  to_key: string;
  from_key: string;
  label: string | null;
  url: string;
}
export interface ImagesReusedOut {
  reused: number;
  items: ImageReusedOut[];
}
export interface ImageGenerateRequest {
  /** Empty = every lesson. */
  lesson_id?: number | undefined;
  /** Only these pictures; with `force` they are drawn again. */
  keys?: string[] | undefined;
  force?: boolean | undefined;
}

// -------------------------------------------- competency, mixed review, entry diagnostic --
/** Why an exercise is in a mixed review: its card is due / it was answered wrong before / not done yet. */
export type MixReason = "due" | "wrong" | "new";

/** One exercise of the mixed review. Graded here like any practice exercise and answered
 * under `lesson_id` (the lesson it comes from), so it feeds that lesson's progress. */
export interface MixItemOut {
  lesson_id: number;
  lesson_title: string;
  reason: MixReason;
  /** 0 nhận ra · 1 xếp câu · 2 điền / nối câu */
  rung: number;
  exercise: PracticeItem;
  grammar: Record<string, LinkedCardOut>;
}
export interface MixOut {
  lesson_id: number;
  items: MixItemOut[];
  by_reason: Partial<Record<MixReason, number>>;
  /** How many exercises could have been offered. */
  pool: number;
}

export interface CompetencyWeakOut {
  grammar_id: number;
  pattern: string;
  lesson_id: number;
  why: string;
  level: number;
}
export interface CompetencyNextOut {
  kind: "review" | "weak" | "practice" | "learn" | "mix" | "placement";
  title: string;
  subtitle: string;
  /** A route of the app. */
  path: string | null;
  lesson_id: number | null;
  /** The practice tab to open. */
  skill: string | null;
}
export interface CompetencySummaryOut {
  cards: number;
  unseen: number;
  studying: number;
  /** Highest rung reached ("0".."3") -> number of cards. */
  by_level: Record<string, number>;
  goal_reached: number;
  remembered: number;
  due: number;
  leeches: number;
}
export interface CompetencyLessonOut {
  lesson_id: number;
  title: string;
  summary: CompetencySummaryOut;
}
export interface CompetencyTopicOut {
  topic: string;
  summary: CompetencySummaryOut;
  lessons: CompetencyLessonOut[];
  weakest: CompetencyWeakOut[];
  next: CompetencyNextOut[];
}
/** The adaptive entry check (/me/placement/next, /me/placement/adaptive). */
export type SelfLevel = "new" | "basic" | "elementary" | "intermediate" | "advanced";
export type Purpose = "talk" | "work" | "topik1" | "topik4" | "topik5";

export interface SurveyIn {
  purpose: Purpose;
  self_level: SelfLevel;
  daily_minutes: number;
}

export interface AdaptiveAnswerIn {
  ref: string;
  /** an option id; "" = "Chưa học mẫu này" */
  choice: string;
}

export interface AdaptiveStepIn {
  self_level: SelfLevel;
  answers: AdaptiveAnswerIn[];
}

export interface AdaptiveStepOut {
  done: boolean;
  item?: { ref: string; exercise: Record<string, unknown> } | null;
  asked: number;
  progress: number;
  last_right?: boolean | null;
}

export interface AdaptiveFinishIn {
  survey: SurveyIn;
  answers: AdaptiveAnswerIn[];
}

export interface AdaptiveResultOut {
  taken_at: string;
  tested: boolean;
  level_label: string;
  asked: number;
  right: number;
  start_lesson_id?: number | null;
  start_title?: string | null;
  advice: "start_here" | "fill_gaps" | "restart_from";
  gaps: { lesson_id?: number | null; title: string; patterns: string[] }[];
  purpose: Purpose;
  goal_label: string;
  lessons_to_goal: number;
  minutes_to_goal: number;
  weeks: number;
  daily_minutes: number;
  exam_weeks?: number | null;
  need_daily?: number | null;
  next_lessons: { id: number; title: string; minutes: number; free: boolean }[];
  headline: string;
  tips: string[];
  words_by: "gemini" | "rules";
}

export interface PlacementSummaryOut {
  taken_at: string;
  score: number;
  total: number;
  known: string[];
  unknown: string[];
  /** Grammar point ids behind `known`. */
  known_ids: number[];
  /** ...of which right on a sentence to build or a blank to fill (not a lucky guess). */
  solid_ids: number[];
  /** Highest rung reached in the diagnostic, -1 when none. */
  start_rung: number;
  start_label: string;
  start_lesson_id: number | null;
  by_rung: Record<string, { right: number; total: number }>;
}
export interface CompetencyOut {
  /** Rung number -> label. */
  rungs: Record<string, string>;
  topics: CompetencyTopicOut[];
  placement: PlacementSummaryOut | null;
}

export interface PlacementItemOut {
  id: string;
  rung: number;
  exercise: PracticeItem;
}
export interface PlacementOut {
  title_vi: string;
  intro_vi: string;
  minutes: number;
  items: PlacementItemOut[];
  last: PlacementSummaryOut | null;
}
export interface PlacementAnswerIn {
  exercise_id: string;
  question_id: string;
  correct: boolean;
  answer: string;
}

// ----------------------------------------------------- daily reading / dialogue --
export interface DailyLineOut {
  /** F = the woman, M = the man, N = the narrator of a reading. */
  who: "F" | "M" | "N";
  speaker: string | null;
  ko: string;
  vi: string;
  /** The Chirp voice of the line — pass it to POST /audio/text. */
  voice: string;
}

export interface DailyGlossOut {
  ko: string;
  vi: string;
}

export interface DailyQuestionOut {
  q_vi: string;
  /** The right answer is not sent: POST .../finish grades and explains. */
  options: string[];
}

export interface DailyGrammarOut {
  grammar_id: number | null;
  lesson_id: number | null;
  pattern: string;
  meaning_vi: string | null;
}

export interface DailyWordOut {
  vocab_item_id: number | null;
  lesson_id: number | null;
  headword: string;
  meaning_vi: string | null;
  /** The learner has met this word (it has a study record). */
  known: boolean;
}

export interface DailyPassageOut {
  id: string;
  kind: "dialogue" | "reading";
  title_en: string;
  title_vi: string;
  scene_vi: string | null;
  speakers: Record<string, string>;
  lines: DailyLineOut[];
  /** The whole text, to be voiced as one clip (a reading). */
  text_en: string;
  voice: string;
  glossary: DailyGlossOut[];
  questions: DailyQuestionOut[];
  grammar: DailyGrammarOut[];
  words: DailyWordOut[];
  why_vi: string;
  status: "todo" | "done";
  correct: number | null;
  total: number | null;
}

export interface DailyReadingOut {
  day: string;
  items: DailyPassageOut[];
  done: number;
  total: number;
  /** Why there is nothing to read yet. */
  note_vi: string | null;
}

export interface DailyAnswerOut {
  answer: number | null;
  correct: number;
  is_right: boolean;
  explain_vi: string;
}

export interface DailyFinishOut {
  passage_id: string;
  correct: number;
  total: number;
  answers: DailyAnswerOut[];
  done: number;
  day_total: number;
}

// ---------------------------------------------------------- real exam practice --
// "Luyện đề thi thật" — mirrors the Rx* schemas of the backend (app/schemas.py).
export type RxResult = "solid" | "aided" | "wrong" | "pending";
export type RxSec = "L" | "R" | "W";

export interface RxGuideOut {
  code: string;
  sec: RxSec;
  name_vi: string;
  asks_vi: string;
  steps: string[];
  traps: string[];
  tips: string[];
  gain_vi: string;
  family: string;
  family_name_vi: string;
}

export interface RxCardOut {
  kind: "grammar_point" | "vocab_item";
  id: number;
  lesson_id: number;
  lesson_title: string | null;
  label: string;
  meaning_vi: string;
  /** The learner has met this card. */
  known: boolean;
  /** The same pattern (false: a close relative). */
  exact: boolean;
}

export interface RxPointOut {
  kind: "grammar" | "word";
  ko: string;
  vi: string;
  /** known: in the lessons and met; upcoming: in a lesson not reached yet; new: in no lesson. */
  status: "known" | "upcoming" | "new";
  cards: RxCardOut[];
}

export interface RxClipOut {
  who: "F" | "M" | "N";
  voice: string;
  ko: string;
}

export interface RxFitOut {
  known: number;
  upcoming: number;
  new: number;
  status: "ready" | "stretch" | "later";
}

export interface RxQuestionOut {
  qid: string;
  exam: string;
  exam_short: string;
  sec: RxSec;
  n: number;
  type: string;
  type_name: string;
  tier: number;
  stem: string | null;
  passage: string | null;
  given: string | null;
  image_url: string | null;
  pic: boolean;
  opts: string[];
  clips: RxClipOut[];
  bundle_index: number;
  bundle_size: number;
  blanks: string[];
  limit: [number, number] | null;
  prompt: string | null;
  questions: string[];
  fit: RxFitOut;
  hint_level: number;
  answered: boolean;
}

export interface RxSetOut {
  id: string;
  title_vi: string;
  why_vi: string;
  created_at: string;
  finished: boolean;
  done: number;
  total: number;
  guides: RxGuideOut[];
  questions: RxQuestionOut[];
}

export interface RxScopeIn {
  type?: string | null;
  family?: string | null;
  sec?: RxSec | null;
  exam?: string | null;
  qids?: string[];
  size?: number | null;
  redo_wrong?: boolean;
}

export interface RxHintOut {
  level: number;
  kind: "focus" | "translate" | "eliminate" | "patterns" | "start" | "outline";
  text: string | null;
  options_vi: string[] | null;
  gloss: string[][] | null;
  option: number | null;
  items: Record<string, unknown>[] | null;
  rubric: { k: string; w: string }[] | null;
}

export interface RxAnswerIn {
  qid: string;
  choice?: number | null;
  answers?: Record<string, string>;
  text?: string | null;
}

export interface RxTurnOut {
  who: string;
  ko: string;
  vi: string | null;
  voice: string | null;
}

export interface RxBlankResultOut {
  id: string;
  text: string;
  matched: boolean;
  sample: string;
  accepted: string[];
  why: string;
  gram: { k: string; vi: string }[];
  traps: string[];
}

export interface RxCheckOut {
  label: string;
  ok: boolean;
  note: string;
}

export interface RxAnswerOut {
  attempt_id: string;
  qid: string;
  result: RxResult;
  hints: number;
  chosen: number | null;
  ans: number | null;
  why: string | null;
  /** option number → why it is wrong ("" for the right one) */
  option_notes: Record<string, string>;
  options_vi: string[];
  passage_lines: [string, string][];
  turns: RxTurnOut[];
  given_vi: string | null;
  points: RxPointOut[];
  take: string;
  guide_tip: string | null;
  blanks: RxBlankResultOut[];
  checks: RxCheckOut[];
  sample: string | null;
  sample_vi: string | null;
  data: [string, string][];
  phrases: { k: string; vi: string }[];
  rubric: { k: string; w: string }[];
  tips: string | null;
  needs_self_check: boolean;
  done: number;
  total: number;
}

export interface RxSelfCheckIn {
  ok?: boolean | null;
  rubric_ok?: boolean[] | null;
}

export interface RxSelfCheckOut {
  attempt_id: string;
  result: RxResult;
  right: number;
  total: number;
}

export interface RxTierOut {
  tier: number;
  solid: number;
  total: number;
  is_solid: boolean;
}

export interface RxTypeStatOut {
  code: string;
  name_vi: string;
  sec: RxSec;
  total: number;
  tried: number;
  solid: number;
  to_redo: number;
  open: number;
  ready_open: number;
  attempts: number;
  right: number;
  cur_tier: number | null;
  tiers: RxTierOut[];
  next_vi: string;
}

export interface RxFamilyOut {
  code: string;
  sec: RxSec;
  order: number;
  name_vi: string;
  blurb_vi: string;
  gain_vi: string;
  total: number;
  tried: number;
  solid: number;
  types: RxTypeStatOut[];
}

export interface RxStageOut {
  key: "starter" | "building" | "solid";
  label_vi: string;
  known_grammar: number;
  total_grammar: number;
  tier_cap: number;
  goal: string | null;
}

export interface RxPlanOut {
  scope: RxScopeIn;
  title_vi: string;
  why_vi: string;
  size: number;
}

export interface RxResumeOut {
  set_id: string;
  title_vi: string;
  done: number;
  total: number;
}

export interface RxSectionOut {
  sec: RxSec;
  name_vi: string;
  total: number;
  tried: number;
  solid: number;
}

export interface RxExamOut {
  id: string;
  title: string;
  short: string;
  note_vi: string | null;
  sections: RxSectionOut[];
}

export interface RxRecentOut {
  set_id: string;
  title_vi: string;
  finished_at: string | null;
  solid: number;
  aided: number;
  wrong: number;
  total: number;
}

/** "Thử sức TOPIK II": a real exam question that suits a lesson, with a short primer. Never the
 * question or its answer; it is opened as a one-question sitting. */
export interface RxPrimerWordOut {
  ko: string;
  vi: string;
}
export interface RxPrimerFormOut {
  k: string;
  vi: string;
}
export interface RxLessonPickOut {
  qid: string;
  exam: string;
  exam_title: string;
  sec: "L" | "R";
  n: number;
  type: string;
  type_name_vi: string;
  tier: number;
  why_vi: string;
  words: RxPrimerWordOut[];
  forms: RxPrimerFormOut[];
  status: "new" | "solid" | "aided" | "wrong";
  /** Answered a short while ago: a sitting for it is refused for now. */
  resting: boolean;
}
export interface RxLessonOut {
  lesson_id: number;
  picks: RxLessonPickOut[];
}

export interface RxOverviewOut {
  stage: RxStageOut;
  today: RxPlanOut | null;
  resume: RxResumeOut | null;
  exams: RxExamOut[];
  families: RxFamilyOut[];
  recent: RxRecentOut[];
}

export interface RxItemStatusOut {
  qid: string;
  exam: string;
  exam_short: string;
  sec: RxSec;
  n: number;
  type: string;
  type_name: string;
  tier: number;
  status: "new" | "solid" | "aided" | "wrong";
  fit: "ready" | "stretch" | "later";
  open: boolean;
}

export interface RxTypeDetailOut {
  guide: RxGuideOut;
  stat: RxTypeStatOut;
  items: RxItemStatusOut[];
  points: RxPointOut[];
}

export interface RxExamDetailOut {
  id: string;
  title: string;
  note_vi: string | null;
  items: RxItemStatusOut[];
}

export interface RxSummaryItemOut {
  qid: string;
  n: number;
  exam_short: string;
  sec: RxSec;
  type: string;
  type_name: string;
  tier: number;
  result: RxResult;
  hints: number;
  take: string;
}

export interface RxSummaryOut {
  set_id: string;
  title_vi: string;
  finished: boolean;
  total: number;
  answered: number;
  solid: number;
  aided: number;
  wrong: number;
  pending: number;
  headline_vi: string;
  value_vi: string;
  items: RxSummaryItemOut[];
  new_points: RxPointOut[];
  to_review: RxCardOut[];
  types: RxTypeStatOut[];
  next_vi: string;
}

// ---------------------------------------------------------------------------- billing --
// app/api/routers/billing.py. Money is whole đồng (VND), never fractions.
export type ProductKind = "lesson_pack" | "exam_pass" | "feature_pass" | "combo";
export type FeatureKey = "talk" | "present" | "debate";
export interface BillingProductOut {
  code: string;
  kind: ProductKind;
  title_vi: string;
  blurb_vi: string;
  amount: number;
  /** A "was" price, shown struck through. */
  compare_at?: number | null;
  /** Feature pass: what it opens. */
  features?: FeatureKey[];
  /** Haru Nói: live minutes included for the whole pass (null = no total). */
  minutes?: number | null;
  /** Exam pass length in days; null for a lesson pack. */
  days?: number | null;
  /** Inclusive [first, last] lesson positions (sort_order) a pack opens. */
  lessons: number[][];
  lesson_count: number;
  /** A combo: the products it grants, each as if bought alone. */
  includes?: string[];
  /** A combo: its products bought one by one, at today's prices. */
  list_total?: number | null;
}
export interface BillingCatalogOut {
  /** false: everything is open and nothing is sold yet. */
  enabled: boolean;
  /** payOS is set up on the server. */
  purchasable: boolean;
  free_lesson_max: number;
  /** One link (the first help channel), for a single button. */
  support_url?: string | null;
  /** Every help channel an admin set (or the server's fallback). */
  support?: SupportOut | null;
  products: BillingProductOut[];
  /** How each AI speaking feature is sold: free, a daily free allowance, or pass only. */
  feature_rules?: FeatureRuleOut[];
  /** The one-time free trial of Haru Nói, per account. */
  trial?: TrialOut | null;
  /** Who sells (the policy pages). Empty fields: "đang cập nhật". */
  merchant?: MerchantOut;
  /** Luyện nghe, Đọc xã luận and Đề thi thật are for the team only: not offered to learners. */
  private_sources?: boolean;
}
export interface TrialOut {
  live_trial_minutes: number;
  present_trial_tries: number;
}
export interface FeatureRuleOut {
  feature: FeatureKey;
  label_vi: string;
  mode: "free" | "trial" | "paid";
  /** The one-time trial: minutes (shared by the live features) or tries. */
  trial_amount: number;
  trial_unit: "phút" | "lượt";
  trial_shared: boolean;
}
export interface MerchantOut {
  name?: string | null;
  tax_id?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}
export interface EntitlementsOut {
  billing_enabled: boolean;
  /** An admin grant / grandfathered account: every lesson is open. */
  everything: boolean;
  lesson_packs: string[];
  exam_pass: { active: boolean; ends_at?: string | null };
  feature_pass?: {
    active: boolean;
    ends_at?: string | null;
    features: FeatureKey[];
    /** Live minutes of the passes held (null = no total: an older pass, a grant). */
    minutes_total?: number | null;
    minutes_left?: number | null;
  };
  /** Per feature: unlimited (a pass), or the free uses left today (null = free feature). */
  /** Per feature: unlimited (a pass / free), or what is left of the one-time trial. */
  features_trial?: Partial<
    Record<
      FeatureKey,
      { unlimited: boolean; left?: number | null; total?: number | null; unit?: string | null }
    >
  >;
}
export interface BillingQuoteOut {
  product: BillingProductOut;
  list_amount: number;
  discount: number;
  total: number;
  coupon_code?: string | null;
  coupon_label_vi?: string | null;
  coupon_error_vi?: string | null;
  /** paid before for smaller lesson packs inside this one, taken off the total */
  credit?: number;
  owned: boolean;
  purchasable: boolean;
}
export type OrderStatus =
  "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "UNDERPAID" | "NEEDS_REVIEW";
export interface OrderTransferOut {
  qr_code?: string | null;
  bank_bin?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  description?: string | null;
}
export interface BillingOrderOut {
  id: string;
  order_code: number;
  product_code: string;
  product_title: string;
  /** What is paid (after a discount code). */
  amount: number;
  list_amount?: number | null;
  discount?: number;
  coupon_code?: string | null;
  status: OrderStatus;
  paid_amount: number;
  expires_at: string;
  paid_at?: string | null;
  created_at: string;
  /** Only while the order waits for payment. */
  checkout_url?: string | null;
  transfer?: OrderTransferOut | null;
  unlocked: boolean;
  message_vi: string;
}
export interface BillingClaimOut {
  id: string;
  order_id?: string | null;
  note: string;
  bank_ref?: string | null;
  status: "open" | "resolved" | "rejected";
  resolution?: string | null;
  created_at: string;
}
export interface BillingClaimResultOut {
  /** The check found the payment and opened the lessons: no claim was needed. */
  unlocked: boolean;
  claim?: BillingClaimOut | null;
  order?: BillingOrderOut | null;
  support_url?: string | null;
}

// ------------------------------------------------------------------------------ admin --
// app/api/routers/admin_accounts.py and the /admin/billing routes of billing.py. Admin only.
export interface AdminAccessOut {
  /** Editors and admins open everything by their role. */
  staff: boolean;
  everything: boolean;
  lesson_packs: string[];
  exam_pass: boolean;
  exam_pass_until?: string | null;
}
export interface AdminLearnerRow {
  id: string;
  email: string;
  display_name?: string | null;
  role: Role;
  goal?: string | null;
  created_at: string;
  last_active_at?: string | null;
  /** Set while the account is locked (it cannot log in; nothing is deleted). */
  disabled_at?: string | null;
  disabled_reason?: string | null;
  /** Set while the password is a temporary one an admin made; it stops working at this time. */
  temp_password_expires_at?: string | null;
  exercises_answered: number;
  paid_orders: number;
  /** Whole đồng actually received on paid orders. */
  paid_total: number;
  open_claims: number;
  access: AdminAccessOut;
}
export interface AdminLearnerPage {
  total: number;
  items: AdminLearnerRow[];
}
export interface AdminProgress {
  exercises_answered: number;
  exercises_correct: number;
  lessons_touched: number;
  words_tracked: number;
  mistakes_logged: number;
  last_active_at?: string | null;
}
export type EntitlementKind = "lesson_pack" | "exam_pass" | "feature_pass" | "grant";
export interface AdminEntitlementOut {
  id: string;
  profile_id: string;
  kind: EntitlementKind;
  product_code: string;
  starts_at: string;
  /** null = for life. */
  ends_at?: string | null;
  source: string;
  order_id?: string | null;
  note?: string | null;
  revoked_at?: string | null;
}
export interface AdminOrderOut extends BillingOrderOut {
  email: string;
  profile_id: string;
  needs_review: boolean;
  note?: string | null;
  provider_ref?: string | null;
}
export interface AdminClaimOut extends BillingClaimOut {
  email: string;
  profile_id: string;
}
export interface AdminLearnerDetail extends AdminLearnerRow {
  exam_date?: string | null;
  daily_minutes: number;
  progress: AdminProgress;
  entitlements: AdminEntitlementOut[];
  orders: AdminOrderOut[];
  claims: AdminClaimOut[];
}
export interface AdminPaymentEvent {
  id: string;
  reference: string;
  amount: number;
  source: string;
  outcome: string;
  created_at: string;
}
export interface AdminOverview {
  billing_enabled: boolean;
  billing_configured: boolean;
  learners: {
    total: number;
    learner: number;
    editor: number;
    admin: number;
    new_7d: number;
    new_30d: number;
    active_7d: number;
    active_30d: number;
    paying: number;
    locked?: number;
  };
  money: {
    paid_total: number;
    paid_7d: number;
    paid_30d: number;
    paid_orders: number;
    by_product: { product_code: string; title: string; orders: number; revenue: number }[];
  };
  queue: { open_claims: number; needs_review: number; waiting_orders: number; underpaid: number };
  orders_by_status: Record<string, number>;
}
/** Shown once, to the admin, who passes it on privately. Only its hash is stored. */
export interface AdminTemporaryPassword {
  temporary_password: string;
  expires_at: string;
}
export interface AdminGrantIn {
  email?: string;
  profile_id?: string;
  /** A catalogue code, or "all". */
  product_code: string;
  days?: number;
  note?: string;
  /** Close this order as paid by hand. */
  order_id?: string;
}
export interface AdminReconcileOut {
  checked: number;
  unlocked: number;
  failed: number;
}

// ------------------------------------------------------------ admin: prices, rules, codes --
export interface AdminProductOut extends BillingProductOut {
  active: boolean;
  default_amount: number;
  default_title_vi: string;
  overridden: boolean;
}
export interface ProductSettingIn {
  amount: number;
  compare_at?: number | null;
  title_vi?: string | null;
  blurb_vi?: string | null;
  active: boolean;
}
export interface CouponOut {
  code: string;
  label_vi: string;
  percent_off?: number | null;
  amount_off?: number | null;
  product_codes?: string[] | null;
  max_uses?: number | null;
  once_per_learner: boolean;
  used: number;
  starts_at?: string | null;
  ends_at?: string | null;
  active: boolean;
  note?: string | null;
  created_at: string;
}
export interface CouponIn {
  code: string;
  percent_off?: number | null;
  amount_off?: number | null;
  product_codes?: string[] | null;
  max_uses?: number | null;
  once_per_learner?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  note?: string | null;
}

/* ---------------------------------------------------------------- anti-abuse (admin) */

/** The free trial's guard (GET/PUT /admin/abuse/guard). */
export interface AbuseGuard {
  trial_enabled: boolean;
  /** live trial minutes the whole system gives away a day; 0 = no cap */
  trial_daily_minutes: number;
  /** marked presentation tries a day; 0 = no cap */
  trial_daily_present_tries: number;
  trial_accounts_per_device: number;
  trial_accounts_per_ip_daily: number;
  signup_per_ip_daily: number;
}

export interface AbuseOverview {
  guard: AbuseGuard;
  today: {
    live_minutes: number;
    live_cap: number;
    present_tries: number;
    present_cap: number;
    trial_accounts: number;
    new_accounts: number;
  };
  domains: { domain: string; created_at: string }[];
  bundled_domains: number;
}

export interface AbuseClusterAccount {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  created_at: string;
  disabled_at: string | null;
  last_seen: string;
  trial_live_minutes: number;
  trial_present_tries: number;
  paid_orders: number;
}

export interface AbuseCluster {
  kind: "device" | "ip";
  key: string;
  accounts: AbuseClusterAccount[];
  trial_accounts: number;
  last_seen: string;
}

export interface LockManyOut {
  locked: number;
  already: number;
  skipped: number;
}

/* ---------------------------------------------------------------- support channels */

export type SupportKind = "zalo" | "telegram" | "messenger" | "facebook" | "email" | "phone";

export interface SupportLinkOut {
  kind: SupportKind;
  label: string;
  /** as the admin typed it */
  value: string;
  /** what it opens: https://zalo.me/…, mailto:…, tel:… */
  url: string;
}

export interface SupportOut {
  links: SupportLinkOut[];
  hours?: string | null;
  note?: string | null;
}

/** Thông tin vận hành an admin sets (GET/PUT /admin/billing/merchant). An empty field: the server's. */
export interface MerchantIn {
  name?: string | null;
  tax_id?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface MerchantAdminOut extends MerchantIn {
  shown: MerchantOut;
}

/** What an admin sets (GET/PUT /admin/billing/support). Empty channels are not shown. */
export interface SupportIn {
  zalo?: string | null;
  telegram?: string | null;
  messenger?: string | null;
  facebook?: string | null;
  email?: string | null;
  phone?: string | null;
  hours?: string | null;
  note?: string | null;
}

export interface SupportAdminOut extends SupportIn {
  shown: SupportOut;
}

/** «Nhờ Haru chấm» — AI check of a lesson paragraph (backend app/services/essay_check.py). */
export interface EssayFixOut {
  original: string;
  corrected: string;
  category: string;
  reason_vi: string;
  source: "ai" | "auto";
}
export interface EssayCriterionOut {
  criterion_vi: string;
  max: number;
  score: number | null;
  comment_vi: string;
}
export interface EssayResultOut {
  /** On the item's own points; null when the AI did not score every criterion. */
  score: number | null;
  points: number;
  criteria: EssayCriterionOut[];
  fixes: EssayFixOut[];
  missing_vi: string[];
  strengths_vi: string[];
  /** The learner's own text with only the mistakes fixed ("" when nothing to fix). */
  corrected_en: string;
  summary_vi: string;
  length: {
    chars: number;
    min: number | null;
    max: number | null;
    status: "ok" | "short" | "long";
  } | null;
  patterns: { pattern: string; label_vi: string; found: boolean }[];
  ai_checked: boolean;
  note: string;
}
export interface EssayCheckOut {
  id: string;
  lesson_id: number;
  exercise_id: string;
  status: "pending" | "ready" | "failed";
  job_id: string | null;
  text: string;
  result: EssayResultOut | null;
  created_at: string;
}

/** «Kho từ TOPIK» (backend app/services/topik_bank.py). */
export interface BankDeckOut {
  key: string;
  title_vi: string;
  grade: "mid" | "adv";
  grade_vi: string;
  words: number;
  /** In the learner's reviews: new words come from it a few a day. */
  added: boolean;
  started: number;
  /** Words answered right at least twice: enough to use them in a sentence or a talk. */
  practiced: number;
}
export interface BankDeckWordsOut {
  key: string;
  title_vi: string;
  grade: "mid" | "adv";
  grade_vi: string;
  added: boolean;
  words: VocabItemOut[];
}
