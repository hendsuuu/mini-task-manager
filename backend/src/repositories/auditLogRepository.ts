import type { AuditAction, AuditLog, TaskStatus } from '@mtm/shared';
import type { DB } from '../db/database';

interface AuditLogRow {
  id: number;
  task_id: number;
  task_title: string;
  actor: string;
  action: AuditAction;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  created_at: string;
}

const toAuditLog = (row: AuditLogRow): AuditLog => ({
  id: row.id,
  taskId: row.task_id,
  taskTitle: row.task_title,
  actor: row.actor,
  action: row.action,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  createdAt: row.created_at,
});

export type NewAuditLog = Omit<AuditLog, 'id'>;

/**
 * Append-only by design: there is no update or delete method, and the
 * database triggers reject such statements anyway (see db/database.ts).
 */
export class AuditLogRepository {
  private readonly appendStmt;
  private readonly listByTaskStmt;

  constructor(db: DB) {
    this.appendStmt = db.prepare<
      [number, string, string, AuditAction, TaskStatus | null, TaskStatus | null, string],
      AuditLogRow
    >(
      `INSERT INTO audit_logs (task_id, task_title, actor, action, from_status, to_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    );
    this.listByTaskStmt = db.prepare<[number], AuditLogRow>(
      'SELECT * FROM audit_logs WHERE task_id = ? ORDER BY id ASC',
    );
  }

  append(entry: NewAuditLog): AuditLog {
    const row = this.appendStmt.get(
      entry.taskId,
      entry.taskTitle,
      entry.actor,
      entry.action,
      entry.fromStatus,
      entry.toStatus,
      entry.createdAt,
    );
    return toAuditLog(row!);
  }

  /** Oldest first. */
  listByTask(taskId: number): AuditLog[] {
    return this.listByTaskStmt.all(taskId).map(toAuditLog);
  }
}
