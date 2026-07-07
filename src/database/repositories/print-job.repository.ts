import type { FindJobsOptions, JobStatus, PaginatedResult, PrintJob } from '../../queue/print-job.types.js';
import type { DatabaseService } from '../database.service.js';

interface PrintJobRow {
  id: string;
  printer_id: string | null;
  application_id: string | null;
  type: string;
  payload: string;
  status: string;
  priority: number;
  retry_count: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

function mapRowToPrintJob(row: PrintJobRow): PrintJob {
  return {
    id: row.id,
    printerId: row.printer_id,
    applicationId: row.application_id,
    type: row.type,
    payload: row.payload,
    status: row.status as JobStatus,
    priority: row.priority,
    retryCount: row.retry_count,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

/** Only these — never a raw client-supplied string — may become an ORDER BY column, to rule out injection. */
const SORT_COLUMNS: Record<NonNullable<FindJobsOptions['sortBy']>, string> = {
  createdAt: 'created_at',
  priority: 'priority',
  status: 'status',
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/** All SQL for the `print_jobs` table lives here — services never touch SQL directly. */
export class PrintJobRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getInstance();
  }

  create(job: PrintJob): void {
    this.db
      .prepare(
        `INSERT INTO print_jobs
           (id, printer_id, application_id, type, payload, status, priority, retry_count, error, created_at, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        job.id,
        job.printerId,
        job.applicationId,
        job.type,
        job.payload,
        job.status,
        job.priority,
        job.retryCount,
        job.error,
        job.createdAt,
        job.startedAt,
        job.finishedAt,
      );
  }

  update(job: PrintJob): void {
    this.db
      .prepare(
        `UPDATE print_jobs
         SET printer_id = ?, application_id = ?, type = ?, payload = ?, status = ?, priority = ?, retry_count = ?,
             error = ?, started_at = ?, finished_at = ?
         WHERE id = ?`,
      )
      .run(
        job.printerId,
        job.applicationId,
        job.type,
        job.payload,
        job.status,
        job.priority,
        job.retryCount,
        job.error,
        job.startedAt,
        job.finishedAt,
        job.id,
      );
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM print_jobs WHERE id = ?').run(id);
  }

  findById(id: string): PrintJob | undefined {
    const row = this.db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id) as PrintJobRow | undefined;
    return row ? mapRowToPrintJob(row) : undefined;
  }

  /** Simple, unpaginated lookup — used internally by recovery/cleanup, not by the rich list API. */
  findAll(status?: JobStatus): PrintJob[] {
    const rows = status
      ? (this.db
          .prepare('SELECT * FROM print_jobs WHERE status = ? ORDER BY priority DESC, created_at ASC')
          .all(status) as PrintJobRow[])
      : (this.db.prepare('SELECT * FROM print_jobs ORDER BY priority DESC, created_at ASC').all() as PrintJobRow[]);
    return rows.map(mapRowToPrintJob);
  }

  /** The rich list used by GET /jobs — filtering, sorting, and pagination (Step 4). */
  findPaginated(options: FindJobsOptions): PaginatedResult<PrintJob> {
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options.printerId) {
      conditions.push('printer_id = ?');
      params.push(options.printerId);
    }
    if (options.applicationId) {
      conditions.push('application_id = ?');
      params.push(options.applicationId);
    }
    if (options.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }
    if (options.createdFrom) {
      conditions.push('created_at >= ?');
      params.push(options.createdFrom);
    }
    if (options.createdTo) {
      conditions.push('created_at <= ?');
      params.push(options.createdTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = SORT_COLUMNS[options.sortBy ?? 'createdAt'];
    const sortDirection = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(options.offset ?? 0, 0);

    const total = (
      this.db.prepare(`SELECT COUNT(*) AS count FROM print_jobs ${whereClause}`).get(...params) as { count: number }
    ).count;

    const rows = this.db
      .prepare(`SELECT * FROM print_jobs ${whereClause} ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as PrintJobRow[];

    return { items: rows.map(mapRowToPrintJob), total, limit, offset };
  }

  /** Deletes all jobs in the given status and returns how many rows were removed. */
  deleteByStatus(status: JobStatus): number {
    return this.db.prepare('DELETE FROM print_jobs WHERE status = ?').run(status).changes;
  }
}
