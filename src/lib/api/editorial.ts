import { apiFetch } from "./client";
import type { PresentSession } from "./presentation";
import type {
  EditorialArticleOut,
  EditorialArticleSummaryOut,
  EditorialCandidateOut,
  EditorialOutlineOut,
  EditorialOutlineSubmitRequest,
  EditorialSourceCreate,
  EditorialSourceOut,
  EditorialSourceUpdate,
  ImportBatchAccepted,
} from "./types";

export interface ListEditorialsParams {
  level?: number | undefined;
  topic?: string | undefined;
  /** the articles that follow this course lesson (easiest first) */
  lesson_id?: number | undefined;
  limit?: number | undefined;
}

/** Public read, same as listCorpusItems — no login required just to
 * browse and read articles. Only articles an admin has confirmed ever
 * show up here (see app/api/routers/editorial.py). */
export function listEditorials(params: ListEditorialsParams = {}) {
  const qs = new URLSearchParams();
  if (params.level !== undefined) qs.set("level", String(params.level));
  if (params.topic) qs.set("topic", params.topic);
  if (params.lesson_id !== undefined) qs.set("lesson_id", String(params.lesson_id));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<EditorialArticleSummaryOut[]>(`/api/v1/editorials${suffix}`);
}

export const getEditorial = (articleId: string) =>
  apiFetch<EditorialArticleOut>(`/api/v1/editorials/${encodeURIComponent(articleId)}`);

/** Login required — "Đã đọc xong": Today moves on to the next article. Idempotent (204). */
export const markEditorialRead = (articleId: string) =>
  apiFetch<void>(`/api/v1/editorials/${encodeURIComponent(articleId)}/read`, { method: "PUT" });

/** Login required — this is the learner's own outline draft. A 401 here
 * means "not logged in yet", not a real error; callers degrade to a
 * read-only prompt rather than surfacing it as a failure. */
export const getEditorialOutline = (articleId: string) =>
  apiFetch<EditorialOutlineOut>(`/api/v1/editorials/${encodeURIComponent(articleId)}/outline`);

export const submitEditorialOutline = (articleId: string, body: EditorialOutlineSubmitRequest) =>
  apiFetch<EditorialOutlineOut>(`/api/v1/editorials/${encodeURIComponent(articleId)}/outline`, {
    method: "POST",
    json: body,
  });

/** Login required — "Trình bày 2 phút" (present) / "Phản biện" (debate): a Trình bày round about
 * this article (its title, outline, key terms and grammar), opened on the Trình bày screen. */
export const presentEditorial = (articleId: string, kind: "present" | "debate") =>
  apiFetch<PresentSession>(`/api/v1/editorials/${encodeURIComponent(articleId)}/presentation`, {
    method: "POST",
    json: { kind },
  });

// --------------------------------------------------------------- admin-facing --
// Editor/admin role required (backend require_role("editor", "admin")) —
// backs Studio's "Nguồn báo" and "Bài chờ duyệt (RSS)" panels.

export const listEditorialSources = () =>
  apiFetch<EditorialSourceOut[]>(`/api/v1/editorial-sources`);

export const createEditorialSource = (body: EditorialSourceCreate) =>
  apiFetch<EditorialSourceOut>(`/api/v1/editorial-sources`, { method: "POST", json: body });

export const updateEditorialSource = (sourceId: number, body: EditorialSourceUpdate) =>
  apiFetch<EditorialSourceOut>(`/api/v1/editorial-sources/${sourceId}`, {
    method: "PATCH",
    json: body,
  });

export interface ListEditorialCandidatesParams {
  status?: string | undefined;
  limit?: number | undefined;
}

/** Backs the Studio "candidate" review queue — RSS auto-discovery
 * (discover_editorial_candidates, Celery beat, every 6h) only ever
 * proposes here; nothing publishes without an admin picking one via
 * ingestEditorialCandidate. Defaults to status="new" server-side. */
export function listEditorialCandidates(params: ListEditorialCandidatesParams = {}) {
  const qs = new URLSearchParams();
  if (params.status !== undefined) qs.set("status", params.status);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<EditorialCandidateOut[]>(`/api/v1/editorial-candidates${suffix}`);
}

/** Manually fires the same RSS-discovery pass the (now-fixed) Celery beat
 * schedule runs every 6h, instead of waiting for the next tick — backs
 * the "Làm mới" button's actual re-scan, not just a re-fetch of whatever
 * candidates already exist. Fire-and-forget: no job to poll, so callers
 * just wait a few seconds and refetch listEditorialCandidates. */
export const triggerEditorialDiscovery = () =>
  apiFetch<{ status: string }>(`/api/v1/editorial-candidates/discover`, { method: "POST" });

export const dismissEditorialCandidate = (candidateId: string) =>
  apiFetch<EditorialCandidateOut>(
    `/api/v1/editorial-candidates/${encodeURIComponent(candidateId)}/dismiss`,
    { method: "POST" },
  );

/** Same underlying flow as manually submitting a URL via POST
 * /imports?kind=editorial_article — just pre-filled from the candidate. */
export const ingestEditorialCandidate = (candidateId: string) =>
  apiFetch<ImportBatchAccepted>(
    `/api/v1/editorial-candidates/${encodeURIComponent(candidateId)}/ingest`,
    { method: "POST" },
  );
