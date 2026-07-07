import type { DatabaseService } from '../database.service.js';

export interface PrintJobEventRecord {
  id: string;
  jobId: string;
  eventType: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface PrintJobEventRow {
  id: string;
  job_id: string;
  event_type: string;
  message: string | null;
  metadata: string | null;
  created_at: string;
}

function mapRowToEvent(row: PrintJobEventRow): PrintJobEventRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    eventType: row.event_type,
    message: row.message,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    createdAt: row.created_at,
  };
}

/** All SQL for the `print_job_events` table — the durable trail behind the in-memory PipelineEventEmitter. */
export class PrintJobEventRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getInstance();
  }

  create(event: PrintJobEventRecord): void {
    this.db
      .prepare(
        `INSERT INTO print_job_events (id, job_id, event_type, message, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.jobId,
        event.eventType,
        event.message,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.createdAt,
      );
  }

  findByJobId(jobId: string): PrintJobEventRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM print_job_events WHERE job_id = ? ORDER BY created_at ASC')
      .all(jobId) as PrintJobEventRow[];
    return rows.map(mapRowToEvent);
  }
}
