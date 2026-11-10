import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, FileSearch, KeyRound, Loader2 } from "lucide-react";

import { useExamSource } from "@/components/haru/exam-source-context";
import { ProgressCard } from "@/components/haru/studio-ui";
import { BTN, BTN_SM, FIELD } from "@/components/haru/studio-kit";
import { UnderlineText } from "@/components/haru/UnderlineText";
import { useJobEvents } from "@/hooks/use-job-events";
import { errorMessage } from "@/lib/api/client";
import { typeAnswers, uploadAnswerKey } from "@/lib/api/imports";
import type {
  ExamAnswerReportOut,
  ExamItemPayload,
  ExamKeyJobResult,
  ExamPassagePayload,
  ExamReadDiff,
  ExamSummaryPayload,
  ExamInstructionSuggest,
  ImportItemOut,
  ImportItemPatch,
} from "@/lib/api/types";
import { stripUnderline } from "@/lib/exam-text";
import {
  applySuggestion,
  dismissSuggestion,
  EXAM_READER_VERSION,
  formatNumbers,
  groupDiffs,
  keepFirstRead,
  markMissing,
  markRefinedChecked,
  takeSecondRead,
  type DiffGroup,
} from "@/lib/exam-review";
import { cn } from "@/lib/utils";

/* Review of an exam paper read by exam-v3 (instruction / stem / passage /
 * options kept apart, nothing paraphrased, no answer guessed). The Studio lists
 * one card per passage and per question; a hidden `exam_summary` item carries the
 * facts about the whole reading and is shown as the header, never as a card.
 * Every choice a reviewer makes here ("Giữ lượt 1", "Lấy lượt 2", "Dùng chỉ dẫn
 * chuẩn", "Đã đối chiếu") is an ordinary edit of the card's payload: the app never
 * decides which reading is right. */

const MARKS = ["①", "②", "③", "④", "⑤"] as const;

type Severity = "red" | "yellow";
/** Why a card needs a look, by cause (the backend's flag codes). Red = cannot be
 * right as it stands; yellow = look at it. A missing key is neither: it is just
 * "no answer yet". */
const FLAGS: Record<string, { label: string; severity: Severity }> = {
  withheld: { label: "Đoạn văn không được công bố (bản quyền)", severity: "red" },
  missing_passage: { label: "Thiếu đoạn văn mà câu hỏi cần", severity: "red" },
  missing_qtype: { label: "Chưa xác định loại câu hỏi", severity: "red" },
  options_count: { label: "Số phương án khác 4", severity: "red" },
  unclear: { label: "Có chữ đọc không rõ ([?]) hoặc gạch chân lỗi", severity: "red" },
  no_underline: { label: "Đề nói “밑줄” nhưng không thấy phần gạch chân", severity: "red" },
  duplicate_number: { label: "Số câu xuất hiện hai lần với nội dung khác nhau", severity: "red" },
  empty: { label: "Đoạn văn trống", severity: "red" },
  text_mismatch: { label: "Hai lượt đọc khác nhau", severity: "yellow" },
  instruction_variant: {
    label: "Chỉ dẫn/câu hỏi na ná cách ghi chuẩn nhưng thiếu chữ",
    severity: "yellow",
  },
  refined: { label: "Đọc lại có mục tiêu — hãy đối chiếu với trang gốc", severity: "yellow" },
  low_confidence: { label: "Mô hình không chắc chữ chép đúng", severity: "yellow" },
  single_read: { label: "Chỉ một lượt đọc thấy câu này", severity: "yellow" },
  no_answer: { label: "Bảng đáp án không có câu này", severity: "yellow" },
};

const SECTION_LABEL: Record<string, string> = {
  đọc: "Đọc (읽기)",
  nghe: "Nghe (듣기)",
  viết: "Viết (쓰기)",
};
const KEY_SOURCE_LABEL: Record<string, string> = {
  file: "bảng đáp án đã tải lên",
  paper: "bảng đáp án in trên đề",
  manual: "đáp án nhập tay",
};

// ------------------------------------------------------------------ helpers --
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const asNumbers = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : [];
const asNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);
const asString = (value: unknown): string => (typeof value === "string" ? value : "");

function asDiffs(value: unknown): ExamReadDiff[] {
  if (!Array.isArray(value)) return [];
  const out: ExamReadDiff[] = [];
  for (const v of value) {
    if (v && typeof v === "object" && typeof v.a === "string" && typeof v.b === "string") {
      const diff: ExamReadDiff = {
        field: typeof v.field === "string" ? v.field : "",
        a: v.a,
        b: v.b,
      };
      if (typeof v.b_full === "string") diff.b_full = v.b_full;
      if (Array.isArray(v.b_options)) diff.b_options = asStrings(v.b_options);
      out.push(diff);
    }
  }
  return out;
}

/** The mark is drawn separately, so a leading ① already in the text is dropped. */
const stripMark = (text: string) => text.replace(/^\s*[①②③④⑤]\s*/, "");

// -------------------------------------------------------------- small pieces --
export function ExamFlags({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <ul aria-label="Lý do cần xem" className="mt-1.5 flex flex-wrap gap-1">
      {flags.map((f) => {
        const info = FLAGS[f];
        return (
          <li
            key={f}
            data-flag={f}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4",
              info?.severity === "red" ? "bg-danger-soft text-danger" : "bg-yellow-soft text-ink",
            )}
          >
            {info?.label ?? f}
          </li>
        );
      })}
    </ul>
  );
}

function diffLabel(field: string): string {
  const option = /^option (\d+)$/.exec(field);
  if (option) return `Phương án ${option[1]}`;
  return (
    { instruction: "Chỉ dẫn", stem: "Câu hỏi", options: "Số phương án", passage: "Đoạn văn" }[
      field
    ] ?? field
  );
}

type SavePayload = (payload: Record<string, unknown> | null) => void;

/** What the second, independent read saw differently, field by field, as the words
 * around each difference. The app never decides which read is right — the reviewer
 * checks the page and keeps the saved reading ("Giữ lượt 1") or takes the whole second
 * one ("Lấy lượt 2"). */
function ReadDiffs({
  diffs,
  busy,
  onKeep,
  onTake,
}: {
  diffs: ExamReadDiff[];
  busy: boolean;
  onKeep: ((field: string) => void) | undefined;
  onTake: ((group: DiffGroup) => void) | undefined;
}) {
  const groups = useMemo(() => groupDiffs(diffs), [diffs]);
  if (groups.length === 0) return null;
  return (
    <div
      data-testid="read-diffs"
      className="mt-2 rounded-[12px] border border-yellow-strong/60 bg-yellow-soft/50 p-2 text-[12px] leading-4"
    >
      <p className="font-semibold">Hai lượt đọc thấy khác nhau — hãy đối chiếu với đề gốc:</p>
      <ul className="mt-1 space-y-2">
        {groups.map((g) => (
          <li key={g.field} data-field={g.field}>
            <span className="font-semibold">{diffLabel(g.field)}</span>
            {g.diffs.map((d, i) => (
              <div key={i} className="mt-0.5">
                <p
                  lang="ko"
                  className="font-korean [word-break:keep-all] break-words font-semibold"
                >
                  <span className="font-sans text-ink-2">Lượt 1 (đang lưu): </span>
                  <UnderlineText text={d.a} />
                </p>
                <p
                  lang="ko"
                  className="font-korean [word-break:keep-all] break-words font-semibold"
                >
                  <span className="font-sans text-ink-2">Lượt 2: </span>
                  <UnderlineText text={d.b} />
                </p>
              </div>
            ))}
            {(onKeep || onTake) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {onKeep && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onKeep(g.field)}
                    className={cn(BTN.soft, BTN_SM)}
                  >
                    Giữ lượt 1
                  </button>
                )}
                {onTake && (
                  <button
                    type="button"
                    disabled={busy || (g.full === null && g.options === null)}
                    title={
                      g.full === null && g.options === null
                        ? "Lô này không lưu bản đầy đủ của lượt 2 — sửa bằng “Sửa JSON”"
                        : undefined
                    }
                    onClick={() => onTake(g)}
                    className={cn(BTN.ok, BTN_SM)}
                  >
                    Lấy lượt 2
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Xem trang N": opens the original page next to the cards (once the reviewer has
 * picked the paper's file). Outside a paper review it is just the page number. */
function PageLink({ page, className }: { page: number | null; className?: string }) {
  const source = useExamSource();
  if (!source) {
    return page === null ? null : (
      <span className={cn("text-[11px] font-semibold text-ink-2", className)}>trang {page}</span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => source.openPage(page)}
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-full border border-line bg-card/70 px-2.5 text-[11px] font-semibold text-blue-deep outline-none focus-visible:ring-2 focus-visible:ring-blue/50",
        className,
      )}
    >
      <FileSearch size={11} strokeWidth={2.4} />
      {page === null ? "Xem trang gốc" : `Xem trang ${page}`}
    </button>
  );
}

const SUGGEST_LABEL: Record<keyof ExamInstructionSuggest, string> = {
  instruction_en: "Chỉ dẫn",
  stem_en: "Câu hỏi",
};

/** An instruction or question line that is one of the standard TOPIK wordings with
 * a few characters missing. The standard text is only offered, with the missing
 * characters marked; nothing is changed until the reviewer says so. */
function SuggestionBox({
  suggest,
  current,
  busy,
  onUse,
  onDismiss,
}: {
  suggest: ExamInstructionSuggest;
  current: Record<keyof ExamInstructionSuggest, string>;
  busy: boolean;
  onUse: (() => void) | undefined;
  onDismiss: (() => void) | undefined;
}) {
  const fields = (Object.keys(SUGGEST_LABEL) as (keyof ExamInstructionSuggest)[]).filter(
    (k) => typeof suggest[k] === "string" && suggest[k] !== "",
  );
  if (fields.length === 0) return null;
  return (
    <div
      data-testid="instruction-suggest"
      className="rounded-[12px] border border-yellow-strong/60 bg-yellow-soft/50 p-2 text-[12px] leading-4"
    >
      <p className="font-semibold">
        Giống cách ghi chuẩn của đề TOPIK nhưng thiếu chữ — đối chiếu với đề gốc:
      </p>
      {fields.map((k) => {
        const standard = suggest[k] ?? "";
        return (
          <div key={k} className="mt-1">
            <span className="font-semibold">{SUGGEST_LABEL[k]}</span>
            <p lang="ko" className="font-korean [word-break:keep-all] break-words font-semibold">
              <span className="font-sans text-ink-2">Đang lưu: </span>
              {stripUnderline(current[k])}
            </p>
            <p
              lang="ko"
              data-testid={`standard-${k}`}
              className="font-korean [word-break:keep-all] break-words font-semibold"
            >
              <span className="font-sans text-ink-2">Chuẩn: </span>
              {markMissing(stripUnderline(current[k]), standard).map((part, i) =>
                part.missing ? (
                  <mark key={i} className="rounded bg-yellow-strong px-0.5 font-semibold text-ink">
                    {part.text}
                  </mark>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </p>
          </div>
        );
      })}
      {(onUse || onDismiss) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {onUse && (
            <button type="button" disabled={busy} onClick={onUse} className={cn(BTN.ok, BTN_SM)}>
              Dùng chỉ dẫn chuẩn
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              disabled={busy}
              onClick={onDismiss}
              className={cn(BTN.soft, BTN_SM)}
            >
              Giữ như đã đọc
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Text that came from one narrow re-read of a single page (no second reading to
 * compare with): to be checked against the page by a person. */
function RefinedNote({
  page,
  busy,
  onChecked,
}: {
  page: number | null;
  busy: boolean;
  onChecked: (() => void) | undefined;
}) {
  return (
    <div
      data-testid="refined-note"
      className="rounded-[12px] border border-yellow-strong/60 bg-yellow-soft/50 p-2 text-[12px] leading-4"
    >
      <p className="font-semibold">Chữ ở đây được đọc lại riêng, chỉ một lượt.</p>
      <p className="mt-0.5 font-medium text-ink-2">
        Hệ thống không có lượt thứ hai để so — mở trang gốc, đọc lại từng chữ rồi bấm “Đã đối chiếu”
        (hoặc sửa nếu sai).
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <PageLink page={page} />
        {onChecked && (
          <button type="button" disabled={busy} onClick={onChecked} className={cn(BTN.ok, BTN_SM)}>
            Đã đối chiếu
          </button>
        )}
      </div>
    </div>
  );
}

/** What a card needs to save a choice: the choice is an edit of the payload, sent as
 * the card's whole new payload. Nothing is offered on a card already written to the
 * paper (confirmed) — editing it there would change nothing the learners see. */
interface Editing {
  onPatch?: ((id: string, body: ImportItemPatch) => void) | undefined;
  busy?: boolean | undefined;
}

function useCardEdits(item: ImportItemOut, { onPatch, busy }: Editing) {
  const enabled = !!onPatch && item.status !== "confirmed";
  const save: SavePayload = (payload) => {
    if (!onPatch) return;
    if (payload === null) {
      toast.error("Lô này không lưu bản đầy đủ của lượt 2 — sửa bằng “Sửa JSON”.");
      return;
    }
    onPatch(item.id, { payload });
  };
  const payload = item.payload as Record<string, unknown>;
  return {
    busy: !!busy,
    enabled,
    keep: enabled ? (field: string) => save(keepFirstRead(payload, field)) : undefined,
    take: enabled ? (group: DiffGroup) => save(takeSecondRead(payload, group)) : undefined,
    useStandard: enabled ? () => save(applySuggestion(payload)) : undefined,
    keepAsRead: enabled ? () => save(dismissSuggestion(payload)) : undefined,
    markChecked: enabled ? () => save(markRefinedChecked(payload)) : undefined,
  };
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      {children}
    </div>
  );
}

function PassageBlock({
  passageRef,
  passage,
}: {
  passageRef: string;
  passage: ImportItemOut | undefined;
}) {
  if (!passage) {
    return (
      <p className="rounded-[10px] bg-danger-soft px-2 py-1 text-[12px] font-semibold leading-4 text-danger">
        Câu này dựa vào đoạn {passageRef} nhưng lô không có đoạn đó.
      </p>
    );
  }
  const p = passage.payload as Partial<ExamPassagePayload>;
  const body = asString(p.body_en);
  const confirmed = passage.status === "confirmed";
  const state = passage.status === "rejected" ? "đã từ chối" : confirmed ? null : "chưa xác nhận";
  if (p.withheld === true) {
    return (
      <p className="rounded-[10px] bg-danger-soft px-2 py-1 text-[12px] font-semibold leading-4 text-danger">
        Đoạn {passageRef}: đề không công bố nội dung (bản quyền) — câu này không dùng để luyện.
      </p>
    );
  }
  return (
    <details className="rounded-[12px] border border-glass-edge bg-card/50 px-2.5 py-1.5">
      <summary className="cursor-pointer select-none text-[12px] font-semibold">
        Đoạn văn {passageRef} · {body.length} ký tự
        {state && <span className="ml-1.5 text-danger">({state})</span>}
      </summary>
      {state && (
        <p className="mt-1 text-[12px] font-semibold leading-4 text-danger">
          Xác nhận đoạn này cùng lúc với câu hỏi, nếu không câu hỏi sẽ được ghi mà không có đoạn
          văn.
        </p>
      )}
      <p
        lang="ko"
        className="font-korean [word-break:keep-all] mt-1.5 max-h-60 overflow-y-auto whitespace-pre-line break-words text-[13px] font-medium leading-6"
      >
        <UnderlineText text={body} showUnreadable />
      </p>
    </details>
  );
}

// -------------------------------------------------------------------- cards --
/** One question: its instruction, stem, passage, options and answer apart. */
export function ExamItemBody({
  item,
  passage,
  keySource,
  onPatch,
  busy,
}: {
  item: ImportItemOut;
  passage: ImportItemOut | undefined;
  keySource: string | undefined;
} & Editing) {
  const p = item.payload as Partial<ExamItemPayload>;
  const edits = useCardEdits(item, { onPatch, busy });
  const flags = asStrings(p.flags);
  const suggest = p.instruction_suggest ?? null;
  const number = asNumber(p.number);
  const instruction = asString(p.instruction_en).trim();
  const stem = asString(p.stem_en).trim();
  const options = Array.isArray(p.options)
    ? p.options.map((o) => (typeof o === "string" ? o : ""))
    : [];
  const answer = asNumber(p.answer);
  const passageRef = asString(p.passage_ref);
  const range = Array.isArray(p.group_range) && p.group_range.length === 2 ? p.group_range : null;
  const page = asNumber(p.source_page);

  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-base font-semibold">Câu {number ?? "?"}</span>
        {range && (
          <span className="text-[12px] font-semibold text-ink-2">
            [{range[0]}~{range[1]}]
          </span>
        )}
        {asString(p.qtype_code) && (
          <span className="rounded-full bg-purple-soft px-2 py-0.5 text-[11px] font-semibold text-ink">
            {p.qtype_code}
          </span>
        )}
        <PageLink page={page} className="ml-auto" />
      </div>
      <ExamFlags flags={flags} />

      {suggest && (
        <SuggestionBox
          suggest={suggest}
          current={{ instruction_en: instruction, stem_en: stem }}
          busy={edits.busy}
          onUse={edits.useStandard}
          onDismiss={edits.keepAsRead}
        />
      )}
      {flags.includes("refined") && (
        <RefinedNote page={page} busy={edits.busy} onChecked={edits.markChecked} />
      )}

      {instruction && (
        <Labeled label="Chỉ dẫn">
          <p
            lang="ko"
            className="font-korean [word-break:keep-all] break-words text-[13px] font-medium leading-6 text-ink-2"
          >
            <UnderlineText text={instruction} showUnreadable />
          </p>
        </Labeled>
      )}
      {stem && (
        <Labeled label="Câu hỏi">
          <p
            lang="ko"
            className="font-korean [word-break:keep-all] whitespace-pre-line break-words text-sm font-semibold leading-6"
          >
            <UnderlineText text={stem} showUnreadable />
          </p>
        </Labeled>
      )}
      {!stem && !instruction && (
        <p className="text-[12px] font-semibold text-danger">Chưa chép được chỉ dẫn lẫn câu hỏi.</p>
      )}

      {passageRef && <PassageBlock passageRef={passageRef} passage={passage} />}

      {options.length > 0 ? (
        <Labeled label="Phương án">
          <ol className="mt-0.5 space-y-1">
            {options.map((text, i) => {
              const isAnswer = answer === i + 1;
              return (
                <li
                  key={i}
                  data-answer={isAnswer || undefined}
                  className={cn(
                    "flex items-start gap-2 rounded-[10px] px-2 py-1",
                    isAnswer ? "bg-green-soft ring-1 ring-green" : "bg-card/50",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="font-korean [word-break:keep-all] font-semibold text-blue-deep"
                  >
                    {MARKS[i] ?? `${i + 1}.`}
                  </span>
                  <span
                    lang="ko"
                    className="font-korean [word-break:keep-all] min-w-0 flex-1 break-words text-[13px] font-semibold leading-5"
                  >
                    <UnderlineText text={stripMark(text)} showUnreadable />
                  </span>
                  {isAnswer && <span className="shrink-0 text-[11px] font-semibold">Đáp án</span>}
                </li>
              );
            })}
          </ol>
        </Labeled>
      ) : (
        <p className="text-[12px] font-semibold text-danger">Chưa chép được phương án nào.</p>
      )}

      <p className="text-[12px] font-semibold leading-4 text-ink-2">
        {answer === null ? (
          "Chưa có đáp án — tải bảng đáp án hoặc dán đáp án ở khung “Đáp án” phía trên."
        ) : p.answer_from_key ? (
          <>
            Đáp án <b>{MARKS[answer - 1] ?? answer}</b> theo{" "}
            {(keySource && KEY_SOURCE_LABEL[keySource]) ?? "bảng đáp án"}.
          </>
        ) : (
          <span className="text-danger">
            Đáp án {MARKS[answer - 1] ?? answer} do AI đoán, chưa có bảng đáp án — câu này sẽ không
            dùng để luyện.
          </span>
        )}
      </p>
      <ReadDiffs diffs={asDiffs(p.alt)} busy={edits.busy} onKeep={edits.keep} onTake={edits.take} />
    </div>
  );
}

/** One passage, long text folded until asked for. */
export function ExamPassageBody({ item, onPatch, busy }: { item: ImportItemOut } & Editing) {
  const p = item.payload as Partial<ExamPassagePayload>;
  const edits = useCardEdits(item, { onPatch, busy });
  const [open, setOpen] = useState(false);
  const body = asString(p.body_en);
  const page = asNumber(p.source_page);
  const flags = asStrings(p.flags);
  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-base font-semibold">Đoạn {asString(p.local_ref) || "?"}</span>
        {asString(p.kind) && <span className="text-[12px] font-semibold text-ink-2">{p.kind}</span>}
        <PageLink page={page} className="ml-auto" />
      </div>
      <ExamFlags flags={flags} />
      {flags.includes("refined") && (
        <RefinedNote page={page} busy={edits.busy} onChecked={edits.markChecked} />
      )}
      {p.withheld === true ? (
        <p className="rounded-[10px] bg-danger-soft px-2 py-1 text-[12px] font-semibold leading-4 text-danger">
          Đề in thông báo bản quyền thay cho đoạn này. Giữ lại để các câu hỏi dựa vào nó được đánh
          dấu, và không dùng chúng để luyện.
        </p>
      ) : (
        <>
          <p
            lang="ko"
            className={cn(
              "font-korean [word-break:keep-all] whitespace-pre-line break-words text-[13px] font-medium leading-6",
              !open && "line-clamp-6",
            )}
          >
            <UnderlineText text={body} showUnreadable />
          </p>
          {body.length > 220 && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={cn(BTN.soft, BTN_SM)}
            >
              {open ? "Thu gọn" : "Xem đủ đoạn văn"}
            </button>
          )}
        </>
      )}
      <ReadDiffs diffs={asDiffs(p.alt)} busy={edits.busy} onKeep={edits.keep} onTake={edits.take} />
    </div>
  );
}

// ----------------------------------------------------------------- overview --
/** How the paper was read, and how far it is from being usable: pages, questions,
 * what is missing, how many have an answer, and why cards were flagged. */
export function ExamOverview({
  summary,
  items,
}: {
  summary: ImportItemOut | undefined;
  items: ImportItemOut[];
}) {
  const s = (summary?.payload ?? {}) as Partial<ExamSummaryPayload>;
  const source = useExamSource();
  const stats = useMemo(() => {
    const questions = items.filter((i) => i.kind === "exam_item" && i.status !== "rejected");
    const answered = questions.filter((i) => asNumber(i.payload?.["answer"]) !== null).length;
    const withheld = questions
      .filter((i) => asStrings(i.payload?.["flags"]).includes("withheld"))
      .map((i) => asNumber(i.payload?.["number"]))
      .filter((n): n is number => n !== null);
    const tally = new Map<string, number>();
    for (const i of items) {
      if (i.status === "confirmed" || i.status === "rejected") continue;
      for (const f of asStrings(i.payload?.["flags"])) tally.set(f, (tally.get(f) ?? 0) + 1);
    }
    return { questions: questions.length, answered, withheld, tally };
  }, [items]);

  if (!summary && stats.questions === 0) return null;
  const gaps = asNumbers(s.gaps);
  const duplicates = asNumbers(s.duplicates);
  const failedWindows = asNumbers(s.failed_windows);
  const verifyFailed = asNumbers(s.verify_failed);
  const refinePages = asNumbers(s.refine_pages);
  const refineFailed = asNumbers(s.refine_failed);
  const oldReader = !!summary && s.prompt_version !== EXAM_READER_VERSION;
  const key = s.key ?? null;
  const when = key?.at ? new Date(key.at) : null;

  return (
    <div
      data-testid="exam-overview"
      className="mt-3 space-y-1 rounded-[16px] border border-glass-edge bg-glass-row p-3 text-[12px] font-medium leading-4 text-ink-2"
    >
      <p className="text-xs font-semibold text-ink">
        {s.pages ? `${s.pages} trang · ` : ""}
        {stats.questions} câu
        {s.section ? ` · phần ${SECTION_LABEL[s.section] ?? s.section}` : ""}
      </p>
      {summary && (
        <p>
          {s.verified
            ? "Đã đọc lần 2 (cắt trang lệch) và đối chiếu từng chữ."
            : "Chưa đối chiếu lần 2 — các chữ chép sai sẽ không bị phát hiện tự động."}
          {s.model ? ` Mô hình đọc: ${s.model}.` : ""}
        </p>
      )}
      {refinePages.length > 0 && (
        <p>
          Đã đọc lại riêng các chỗ khó ở trang {formatNumbers(refinePages)}
          {asNumbers(s.refined).length > 0
            ? ` — câu ${formatNumbers(asNumbers(s.refined))} cần đối chiếu với trang gốc`
            : ""}
          .
        </p>
      )}
      {refineFailed.length > 0 && (
        <p className="font-semibold">
          Không đọc lại được trang {formatNumbers(refineFailed)} — giữ nguyên chữ đã đọc.
        </p>
      )}
      {oldReader && (
        <p className="font-semibold">
          Lô này đọc bằng phiên bản cũ ({s.prompt_version ?? "?"}), chưa có số trang tin cậy, nút
          “Lấy lượt 2” và đọc lại chỗ khó. Tải lại đúng tệp đề (hoặc “Hoàn tác” rồi tải lại nếu đã
          xác nhận) để đọc bằng {EXAM_READER_VERSION}.
        </p>
      )}
      {failedWindows.length > 0 && (
        <p className="font-semibold text-danger">
          {failedWindows.length} cụm trang không đọc được — đề có thể thiếu câu, hãy tải lại.
        </p>
      )}
      {verifyFailed.length > 0 && (
        <p className="font-semibold text-danger">
          {verifyFailed.length} cụm trang của lượt đối chiếu bị lỗi.
        </p>
      )}
      {gaps.length > 0 && (
        <p className="font-semibold text-danger">Thiếu số câu: {formatNumbers(gaps)}.</p>
      )}
      {duplicates.length > 0 && (
        <p className="font-semibold text-danger">Số câu bị trùng: {formatNumbers(duplicates)}.</p>
      )}
      {stats.withheld.length > 0 && (
        <p>
          Câu thuộc đoạn không công bố: <b>{formatNumbers(stats.withheld)}</b> — không dùng để
          luyện.
        </p>
      )}
      <p className={cn(stats.answered < stats.questions && "font-semibold")}>
        Đáp án: <b>{stats.answered}</b>/{stats.questions} câu
        {key && (
          <>
            {" "}
            · nguồn: {KEY_SOURCE_LABEL[key.source] ?? key.source}
            {when && !Number.isNaN(when.getTime()) ? ` (${when.toLocaleDateString("vi-VN")})` : ""}
          </>
        )}
        {stats.answered === 0 && " — chưa có bảng đáp án, không câu nào luyện được."}
      </p>
      {key && key.missing.length > 0 && (
        <p>Bảng đáp án không có câu: {formatNumbers(key.missing)}.</p>
      )}
      {key && key.unmatched.length > 0 && (
        <p>Bảng có số mà đề không có câu tương ứng: {formatNumbers(key.unmatched)}.</p>
      )}
      {key && key.conflicts.length > 0 && (
        <p className="font-semibold text-danger">
          Hai lượt đọc bảng đáp án không khớp ở câu {formatNumbers(key.conflicts)} — nhập tay các
          câu này.
        </p>
      )}
      {source && (
        <button
          type="button"
          onClick={() => source.openPage(null)}
          className={cn(BTN.soft, BTN_SM, "mt-1")}
        >
          <FileSearch size={13} strokeWidth={2.4} /> Mở đề gốc để đối chiếu
        </button>
      )}
      {stats.tally.size > 0 && (
        <ul aria-label="Cờ theo nguyên nhân" className="flex flex-wrap gap-1 pt-1">
          {[...stats.tally.entries()].map(([flag, count]) => (
            <li
              key={flag}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                FLAGS[flag]?.severity === "red"
                  ? "bg-danger-soft text-danger"
                  : "bg-yellow-soft text-ink",
              )}
            >
              {FLAGS[flag]?.label ?? flag} · {count}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ answers --
function reportLines(r: {
  changed: number[];
  unmatched: number[];
  missing: number[];
  conflicts?: number[] | undefined;
}): string[] {
  const lines: string[] = [];
  if (r.changed.length > 0) lines.push(`Thay đáp án đã có ở câu ${formatNumbers(r.changed)}.`);
  if (r.unmatched.length > 0) lines.push(`Đề không có câu ${formatNumbers(r.unmatched)}.`);
  if (r.missing.length > 0) lines.push(`Câu chưa có đáp án: ${formatNumbers(r.missing)}.`);
  if (r.conflicts && r.conflicts.length > 0)
    lines.push(`Không đọc chắc ở câu ${formatNumbers(r.conflicts)} — nhập tay các câu này.`);
  return lines;
}

/** Where answers come from: the printed key as a file (read twice, only agreed
 * numbers kept), or numbers typed/pasted (checked first with "Kiểm tra"). A paper's
 * pages never carry the key in a place the app can trust, so nothing is guessed. */
export function ExamAnswersPanel({
  batchId,
  answered,
  total,
  onApplied,
}: {
  batchId: string;
  answered: number;
  total: number;
  /** answers were written: refresh the batch's items */
  onApplied: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [section, setSection] = useState<"" | "đọc" | "nghe">("");
  const [keyJobId, setKeyJobId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [start, setStart] = useState(1);
  const [report, setReport] = useState<ExamAnswerReportOut | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const keyM = useMutation({
    mutationFn: () => uploadAnswerKey(batchId, files, section || undefined),
    onSuccess: (res) => setKeyJobId(res.job_id),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const keyJob = useJobEvents(keyJobId);
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (!keyJobId || !keyJob.status) return;
    const mark = `${keyJobId}:${keyJob.status}`;
    if (notified.current === mark) return;
    if (keyJob.status === "succeeded") {
      notified.current = mark;
      const result = keyJob.job?.result as Partial<ExamKeyJobResult> | null | undefined;
      toast.success(`Đã áp ${result?.applied ?? 0} đáp án`);
      setFiles([]);
      setReport(null);
      if (fileInput.current) fileInput.current.value = "";
      onApplied();
    } else if (keyJob.status === "failed") {
      notified.current = mark;
      toast.error(keyJob.error ?? "Không đọc được bảng đáp án");
    }
  }, [keyJob.status, keyJob.job, keyJob.error, keyJobId, onApplied]);

  const keyResult =
    keyJob.status === "succeeded" ? (keyJob.job?.result as Partial<ExamKeyJobResult> | null) : null;
  const keyBusy =
    keyM.isPending ||
    (!!keyJobId &&
      (keyJob.status === null || keyJob.status === "queued" || keyJob.status === "running"));

  const typeM = useMutation({
    mutationFn: (dryRun: boolean) => typeAnswers(batchId, { text, start, dry_run: dryRun }),
    onSuccess: (res) => {
      setReport(res);
      if (!res.dry_run) {
        toast.success(`Đã áp ${res.applied.length} đáp án`);
        setText("");
        onApplied();
      }
    },
    onError: () => setReport(null),
  });

  return (
    <details className="mt-3 rounded-[16px] border border-glass-edge bg-glass-row p-3">
      <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-semibold">
        <KeyRound size={14} strokeWidth={2.4} /> Đáp án ({answered}/{total} câu)
        <span className="ml-auto font-semibold text-ink-2">Tải bảng · dán đáp án</span>
      </summary>

      <div className="mt-2.5 space-y-3">
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold">Tải bảng đáp án (정답표)</p>
          <input
            ref={fileInput}
            type="file"
            multiple
            aria-label="Tệp bảng đáp án"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
            className={cn(
              FIELD,
              "!py-2 !text-sm file:mr-3 file:rounded-full file:border-0 file:bg-blue-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-deep",
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
              Bảng của phần
              <select
                aria-label="Phần thi của bảng đáp án"
                value={section}
                onChange={(e) => setSection(e.target.value as "" | "đọc" | "nghe")}
                className={cn(FIELD, "!w-auto !py-1.5 !text-xs")}
              >
                <option value="">Tự nhận theo kỳ thi</option>
                <option value="đọc">Đọc (읽기)</option>
                <option value="nghe">Nghe (듣기)</option>
              </select>
            </label>
            <button
              type="button"
              disabled={keyBusy || files.length === 0}
              onClick={() => keyM.mutate()}
              className={cn(BTN.primary, BTN_SM)}
            >
              {keyBusy && <Loader2 size={13} strokeWidth={2.4} className="animate-spin" />}
              Đọc & áp đáp án
            </button>
          </div>
          <p className="text-[12px] font-medium leading-4 text-ink-2">
            Bảng được đọc hai lần; chỉ câu nào hai lần khớp mới được dùng. Có thể tải sau khi đã xác
            nhận lô — đáp án vẫn chuyển tới các câu đã ghi.
          </p>
          {keyJobId && keyJob.status !== null && (
            <ProgressCard
              title={
                keyJob.status === "succeeded"
                  ? `Đã áp ${keyResult?.applied ?? 0} đáp án`
                  : keyJob.status === "failed"
                    ? "Không đọc được bảng đáp án"
                    : "Đang đọc bảng đáp án…"
              }
              pct={
                keyJob.status === "succeeded"
                  ? 100
                  : keyJob.progress > 0
                    ? Math.round(keyJob.progress * 100)
                    : null
              }
              tone={
                keyJob.status === "succeeded"
                  ? "done"
                  : keyJob.status === "failed"
                    ? "failed"
                    : "busy"
              }
              message={
                keyJob.status === "failed"
                  ? (keyJob.error ?? undefined)
                  : keyResult
                    ? reportLines({
                        changed: keyResult.changed ?? [],
                        unmatched: keyResult.unmatched ?? [],
                        missing: keyResult.missing ?? [],
                        conflicts: keyResult.conflicts,
                      }).join(" ")
                    : (keyJob.step ?? undefined)
              }
              onDismiss={keyBusy ? undefined : () => setKeyJobId(null)}
            />
          )}
        </div>

        <div className="space-y-1.5 border-t border-glass-edge pt-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold">
            <ClipboardPaste size={13} strokeWidth={2.4} /> Dán đáp án
          </p>
          <textarea
            rows={3}
            aria-label="Đáp án nhập tay"
            maxLength={4000}
            spellCheck={false}
            placeholder="Một chuỗi liền “2134…” (từ câu số bên dưới), hoặc cặp “1-2, 2-1, 3-4”"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setReport(null);
            }}
            className={cn(FIELD, "font-mono")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
              Chuỗi liền bắt đầu từ câu
              <input
                type="number"
                min={1}
                max={200}
                aria-label="Câu bắt đầu"
                value={start}
                onChange={(e) => {
                  setStart(Math.max(1, Math.min(200, Number(e.target.value) || 1)));
                  setReport(null);
                }}
                className={cn(FIELD, "!w-16 !py-1.5 !text-xs")}
              />
            </label>
            <button
              type="button"
              disabled={typeM.isPending || !text.trim()}
              onClick={() => typeM.mutate(true)}
              className={cn(BTN.soft, BTN_SM)}
            >
              Kiểm tra
            </button>
            <button
              type="button"
              disabled={
                typeM.isPending || !text.trim() || !report?.dry_run || report.applied.length === 0
              }
              onClick={() => typeM.mutate(false)}
              className={cn(BTN.ok, BTN_SM)}
            >
              {typeM.isPending && <Loader2 size={13} strokeWidth={2.4} className="animate-spin" />}
              Áp đáp án
            </button>
          </div>
          {typeM.isError && (
            <p role="alert" className="text-[12px] font-semibold leading-4 text-danger">
              {errorMessage(typeM.error)}
            </p>
          )}
          {report && (
            <div
              role="status"
              className="rounded-[12px] bg-card/60 p-2 text-[12px] font-medium leading-4"
            >
              <p className="font-semibold">
                {report.dry_run ? "Nếu áp sẽ" : "Đã"} đặt đáp án cho {report.applied.length} câu
                {report.applied.length > 0 ? ` (${formatNumbers(report.applied)})` : ""}.
              </p>
              {reportLines(report).map((line) => (
                <p key={line}>{line}</p>
              ))}
              {report.dry_run && report.applied.length > 0 && (
                <p className="text-ink-2">Bấm “Áp đáp án” để ghi.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
