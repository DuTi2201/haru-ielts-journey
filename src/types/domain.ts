export type UserRole = "learner" | "editor" | "admin";
export type LearningGoal = "talk" | "topik1" | "topik4" | "topik5" | "topik6";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type AsyncViewState = "default" | "loading" | "empty" | "error" | "success";
export type WaitLevel = 0 | 1 | 2 | 3 | 4;
export type WritingStatus =
  | "uploaded"
  | "image_rejected"
  | "transcribing"
  | "awaiting_confirmation"
  | "grading"
  | "graded"
  | "revising"
  | "revised"
  | "rewriting";
export type ImportBatchStatus =
  | "queued"
  | "extracting"
  | "validating"
  | "awaiting_review"
  | "confirmed"
  | "cancelled"
  | "rolled_back";

export interface Profile {
  id: string;
  displayName: string;
  goal: LearningGoal;
  examDate: string | null;
  dailyMinutes: number;
}
export interface UserRoleRecord {
  id: string;
  userId: string;
  role: UserRole;
}
export interface LectureAudio {
  id: string;
  cacheKey: string;
  opusPath: string;
  aacPath: string | null;
  promptVersion: string;
  voice: string;
  durationSec: number;
  createdAt: string;
}
export interface CorpusItem {
  id: string;
  filmId: string;
  textKo: string;
  kind: string;
  level: string;
  register: string;
  topicIds: number[];
  embedding: number[] | null;
}
export interface LearningEvent {
  learnerId: string;
  occurredAt: string;
  eventId: string;
  eventType: string;
  skill: string;
  value: number;
  payload: Record<string, unknown>;
}
export interface ExamPaper {
  id: string;
  examKind: string;
  sessionLabel: string;
  ownerId: string;
  fileHash: string;
  answerStatus: string;
  importJobId: string | null;
  promptVersion: string;
}
export interface QuestionType {
  id: string;
  skill: string;
  code: string;
  nameKo: string;
  nameVi: string;
  active: boolean;
}
export interface ExamPassage {
  id: string;
  paperId: string;
  kind: string;
  bodyKo: string;
  chartData: unknown | null;
  imageKey: string | null;
  audioKey: string | null;
  sourcePage: number;
  sourceBbox: unknown;
  embedding: number[] | null;
}
export interface ExamItem {
  id: string;
  paperId: string;
  passageId: string | null;
  number: number;
  qtypeId: string;
  stemKo: string;
  options: unknown;
  answer: number | null;
  answerSource: "editor" | "ai_guess" | null;
  difficultyEst: number;
  confidence: number;
  importItemId: string | null;
  embedding: number[] | null;
}
export interface ExamItemTag {
  itemId: string;
  tagKind: string;
  refId: string;
  score: number;
  source: string;
}
export interface VocabItem {
  id: string;
  learnerId: string;
  termKo: string;
  meaningVi: string;
  topicId: number | null;
  level: string;
}
export interface ItemState {
  id: string;
  learnerId: string;
  vocabItemId: string;
  srsStage: number;
  nextReviewAt: string;
  ease: number;
}
export interface ImportItem {
  id: string;
  importBatchId: string;
  kind: string;
  status: "pending" | "flagged_yellow" | "flagged_red" | "confirmed" | "rejected";
  payload: Record<string, unknown>;
  confidence: number;
}
export interface WritingSubmission {
  id: string;
  learnerId: string;
  promptId: string;
  status: WritingStatus;
  imageKey: string;
  transcript: string | null;
  createdAt: string;
}
export interface WritingScore {
  id: string;
  submissionId: string;
  criteria: Record<string, unknown>;
  scoreRange: string;
  priorityFixes: unknown[];
}
export interface ErrorLog {
  id: string;
  learnerId: string;
  skill: string;
  errorType: string;
  exampleKo: string;
  createdAt: string;
}
export interface Job {
  id: string;
  ownerId: string;
  type: string;
  status: JobStatus;
  progress: number;
  step: string;
  result: unknown | null;
  error: unknown | null;
  createdAt: string;
  updatedAt: string;
}

export const WRITING_TRANSITIONS: Readonly<Record<WritingStatus, readonly WritingStatus[]>> = {
  uploaded: ["image_rejected", "transcribing"],
  image_rejected: ["uploaded"],
  transcribing: ["awaiting_confirmation"],
  awaiting_confirmation: ["grading"],
  grading: ["graded"],
  graded: ["revising"],
  revising: ["revised"],
  revised: ["rewriting"],
  rewriting: ["grading"],
};
export const IMPORT_TRANSITIONS: Readonly<Record<ImportBatchStatus, readonly ImportBatchStatus[]>> =
  {
    queued: ["extracting", "cancelled"],
    extracting: ["validating", "cancelled"],
    validating: ["awaiting_review", "cancelled"],
    awaiting_review: ["confirmed", "cancelled"],
    confirmed: ["rolled_back"],
    cancelled: [],
    rolled_back: [],
  };
