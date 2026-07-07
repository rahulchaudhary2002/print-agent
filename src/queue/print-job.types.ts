export type JobStatus = 'pending' | 'queued' | 'rendering' | 'printing' | 'completed' | 'failed' | 'cancelled';

/** `PrintJob.type` for jobs whose `payload` is a serialized PrintDocument rather than raw text. */
export const DOCUMENT_JOB_TYPE = 'document';

export interface PrintJob {
  id: string;
  printerId: string | null;
  /** Which registered Application created this job (Step 15) — `null` for direct/local calls. */
  applicationId: string | null;
  type: string;
  payload: string;
  status: JobStatus;
  priority: number;
  retryCount: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CreateJobInput {
  printerId?: string | null | undefined;
  applicationId?: string | null | undefined;
  type: string;
  payload: string;
  priority?: number | undefined;
}

export type JobSortField = 'createdAt' | 'priority' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface FindJobsOptions {
  status?: JobStatus | undefined;
  printerId?: string | undefined;
  applicationId?: string | undefined;
  type?: string | undefined;
  /** Inclusive ISO-8601 bounds on `createdAt`. */
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
  sortBy?: JobSortField | undefined;
  sortOrder?: SortOrder | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
