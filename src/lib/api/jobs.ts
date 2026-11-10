import { apiFetch } from "./client";
import type { JobOut } from "./types";

export const getJob = (jobId: string) =>
  apiFetch<JobOut>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
