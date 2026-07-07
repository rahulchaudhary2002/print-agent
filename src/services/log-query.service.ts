import { promises as fs } from 'node:fs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
  module: string | null;
  meta: Record<string, unknown>;
}

export interface LogQueryFilters {
  level?: LogLevel | undefined;
  module?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
}

const PINO_LEVEL_TO_NAME: Record<number, LogLevel | undefined> = {
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
};

const RESERVED_KEYS = new Set(['level', 'time', 'pid', 'hostname', 'msg', 'module']);
const DEFAULT_LIMIT = 200;

/**
 * Reads and filters the pino JSON-lines log file LoggerService writes to. A separate service
 * (not LoggerService itself) because writing and querying logs are different responsibilities —
 * LoggerService never needs to know its own output is later parsed back.
 */
export class LogQueryService {
  constructor(private readonly logFilePath: string) {}

  async query(filters: LogQueryFilters = {}): Promise<LogEntry[]> {
    const entries = await this.readEntries();
    const filtered = entries.filter((entry) => this.matches(entry, filters));
    const limit = filters.limit ?? DEFAULT_LIMIT;
    return filtered.slice(-limit).reverse();
  }

  async latest(count: number): Promise<LogEntry[]> {
    const entries = await this.readEntries();
    return entries.slice(-count).reverse();
  }

  async errors(filters: Omit<LogQueryFilters, 'level'> = {}): Promise<LogEntry[]> {
    return this.query({ ...filters, level: 'error' });
  }

  async clear(): Promise<void> {
    await fs.writeFile(this.logFilePath, '', 'utf-8');
  }

  private matches(entry: LogEntry, filters: LogQueryFilters): boolean {
    if (filters.level && entry.level !== filters.level) {
      return false;
    }
    if (filters.module && entry.module !== filters.module) {
      return false;
    }
    if (filters.from && entry.time < filters.from) {
      return false;
    }
    if (filters.to && entry.time > filters.to) {
      return false;
    }
    return true;
  }

  private async readEntries(): Promise<LogEntry[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.logFilePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const entries: LogEntry[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) {
        continue;
      }
      const entry = this.parseLine(line);
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }

  private parseLine(line: string): LogEntry | null {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const level = PINO_LEVEL_TO_NAME[parsed['level'] as number];
      if (!level) {
        return null;
      }
      const meta: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!RESERVED_KEYS.has(key)) {
          meta[key] = value;
        }
      }
      return {
        time: typeof parsed['time'] === 'string' ? parsed['time'] : new Date().toISOString(),
        level,
        message: typeof parsed['msg'] === 'string' ? parsed['msg'] : '',
        module: typeof parsed['module'] === 'string' ? parsed['module'] : null,
        meta,
      };
    } catch {
      return null;
    }
  }
}
