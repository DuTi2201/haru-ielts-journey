import { API_BASE_URL, apiFetch, tokenStore } from "./client";
import type {
  CorpusEnrichmentStatusOut,
  ExamAnswerReportOut,
  HiddenCorpusItemOut,
  ImportBatchAccepted,
  ImportBatchOut,
  ImportItemOut,
  ImportItemPatch,
  ImportKind,
  JobAccepted,
} from "./types";

export interface CreateImportBatchInput {
  kind: ImportKind;
  /** required for every kind except "editorial_article" (which takes a
   * URL instead — see sourceUrl/sourceName below) and "exam_paper" when
   * `files` (plural) is used instead. A pasted-text lesson is just a
   * synthetic `new File([text], "...", { type: "text/plain" })` built by
   * the caller — the backend now accepts text/plain here too. */
  file?: File | undefined;
  /** kind === "exam_paper" only: up to 6 files that are the pages of ONE đề
   * thi (a scan split in several files, say) — sent as repeated `files` form
   * fields. The server cuts them into pages and reads a few at a time, so a big
   * scan is never one request. The answer key is NOT part of this: send it
   * afterwards with uploadAnswerKey / typeAnswers. Takes priority over `file`
   * when both happen to be set. */
  files?: File[] | undefined;
  /** required when kind === "corpus" */
  filmTitle?: string | undefined;
  /** required when kind === "exam_paper" */
  examKind?: string | undefined;
  sessionLabel?: string | undefined;
  /** required when kind === "editorial_article" */
  sourceUrl?: string | undefined;
  sourceName?: string | undefined;
  titleKo?: string | undefined;
  /** kind === "editorial_article" only: re-scrape+re-analyze a URL that
   * was already ingested before, instead of silently reusing the old
   * batch/job — e.g. to pick up a pipeline fix (cleaner body_ko, a
   * corrected outlet-name suggestion) on an article ingested previously. */
  force?: boolean | undefined;
}

/** POST /imports — multipart upload. Uses fetch directly (not apiFetch)
 * since this is the one endpoint that sends FormData, not JSON. */
export async function createImportBatch(
  input: CreateImportBatchInput,
): Promise<ImportBatchAccepted> {
  const form = new FormData();
  form.set("kind", input.kind);
  if (input.files && input.files.length > 0) {
    for (const f of input.files) form.append("files", f);
  } else if (input.file) {
    form.set("file", input.file);
  }
  if (input.filmTitle) form.set("film_title", input.filmTitle);
  if (input.examKind) form.set("exam_kind", input.examKind);
  if (input.sessionLabel) form.set("session_label", input.sessionLabel);
  if (input.sourceUrl) form.set("source_url", input.sourceUrl);
  if (input.sourceName) form.set("source_name", input.sourceName);
  if (input.titleKo) form.set("title_ko", input.titleKo);
  if (input.force) form.set("force", "true");

  const token = tokenStore.get();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json, application/problem+json");

  const res = await fetch(`${API_BASE_URL}/api/v1/imports`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const { ApiError } = await import("./client");
    throw new ApiError({
      type: body.type ?? "about:blank",
      title: body.title ?? res.statusText,
      status: body.status ?? res.status,
      detail: body.detail ?? null,
      code: body.code ?? null,
    });
  }
  return (await res.json()) as ImportBatchAccepted;
}

export const listImportBatches = () => apiFetch<ImportBatchOut[]>(`/api/v1/imports`);
export const getImportBatch = (id: string) =>
  apiFetch<ImportBatchOut>(`/api/v1/imports/${encodeURIComponent(id)}`);
export const listImportItems = (batchId: string) =>
  apiFetch<ImportItemOut[]>(`/api/v1/imports/${encodeURIComponent(batchId)}/items`);
export const patchImportItem = (batchId: string, itemId: string, body: ImportItemPatch) =>
  apiFetch<ImportItemOut>(
    `/api/v1/imports/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      json: body,
    },
  );
export const confirmImportBatch = (batchId: string) =>
  apiFetch<ImportBatchAccepted>(`/api/v1/imports/${encodeURIComponent(batchId)}/confirm`, {
    method: "POST",
  });
export const rollbackImportBatch = (batchId: string) =>
  apiFetch<ImportBatchOut>(`/api/v1/imports/${encodeURIComponent(batchId)}/rollback`, {
    method: "POST",
  });

// ------------------------------------------------------------- exam answers --
/** The printed answer key (정답표) of an exam batch, on its own — the server
 * reads it twice and only keeps the numbers both reads agree on. `section`
 * (đọc / nghe) picks the table of a multi-part key; empty = taken from the
 * session label and what was extracted. Returns a job; its `result` says how
 * many answers landed. Multipart, so sent with fetch's own FormData body. */
export const uploadAnswerKey = (batchId: string, files: File[], section?: "đọc" | "nghe") => {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  if (section) form.set("section", section);
  return apiFetch<JobAccepted>(`/api/v1/imports/${encodeURIComponent(batchId)}/answer-key`, {
    method: "POST",
    body: form,
  });
};
/** Answers typed or pasted ("1-2, 2-4" pairs, or an unbroken run of digits from
 * `start`). `dry_run` only reports what would happen. Anything unclear is
 * refused by the server (400 invalid_answers), never guessed. */
export const typeAnswers = (
  batchId: string,
  body: { text: string; start: number; dry_run: boolean },
) =>
  apiFetch<ExamAnswerReportOut>(`/api/v1/imports/${encodeURIComponent(batchId)}/answers`, {
    method: "POST",
    json: body,
  });

// ------------------------------------------------------- corpus enrichment --
/** How far the corpus is from having a Vietnamese meaning, a usage note and a
 * naturalness verdict on every sentence. */
export const getCorpusEnrichment = () =>
  apiFetch<CorpusEnrichmentStatusOut>(`/api/v1/imports/corpus-enrichment`);
/** Starts the background run (one at a time: pressing it again while a run is
 * going returns that run). Resumable — only what is still missing is done. */
export const startCorpusEnrichment = () =>
  apiFetch<JobAccepted>(`/api/v1/imports/corpus-enrichment`, { method: "POST" });
/** Sentences the model judged unnatural, hidden from learners. */
export const listHiddenCorpusItems = () =>
  apiFetch<HiddenCorpusItemOut[]>(`/api/v1/imports/corpus-enrichment/hidden`);
export const restoreHiddenCorpusItem = (itemId: string) =>
  apiFetch<void>(`/api/v1/imports/corpus-enrichment/hidden/${encodeURIComponent(itemId)}/restore`, {
    method: "POST",
  });
