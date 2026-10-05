import type { Task, TaskStatus } from '@mtm/shared';
import type { DB } from '../db/database';

interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** SQL access for tasks. "Active" means not soft-deleted. */
export class TaskRepository {
  private readonly listActiveStmt;
  private readonly findActiveStmt;
  private readonly existsStmt;
  private readonly insertStmt;
  private readonly updateStatusStmt;
  private readonly softDeleteStmt;

  constructor(db: DB) {
    this.listActiveStmt = db.prepare<[], TaskRow>(
      'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY id DESC',
    );
    this.findActiveStmt = db.prepare<[number], TaskRow>(
      'SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL',
    );
    this.existsStmt = db.prepare<[number], { found: 1 }>('SELECT 1 AS found FROM tasks WHERE id = ?');
    this.insertStmt = db.prepare<[string, string, TaskStatus, string, string], TaskRow>(
      `INSERT INTO tasks (title, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
    );
    // Compare-and-set on the old status: the update only lands if nobody moved the task first.
    this.updateStatusStmt = db.prepare<[TaskStatus, string, number, TaskStatus]>(
      `UPDATE tasks SET status = ?, updated_at = ?
       WHERE id = ? AND status = ? AND deleted_at IS NULL`,
    );
    this.softDeleteStmt = db.prepare<[string, number]>(
      'UPDATE tasks SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    );
  }

  listActive(): Task[] {
    return this.listActiveStmt.all().map(toTask);
  }

  findActive(id: number): Task | undefined {
    const row = this.findActiveStmt.get(id);
    return row && toTask(row);
  }

  /** True for soft-deleted tasks too: their history is still readable. */
  exists(id: number): boolean {
    return this.existsStmt.get(id) !== undefined;
  }

  insert(title: string, description: string, status: TaskStatus, now: string): Task {
    return toTask(this.insertStmt.get(title, description, status, now, now)!);
  }

  /** Returns false when the task was not in `from` (or is gone), so nothing changed. */
  updateStatus(id: number, from: TaskStatus, to: TaskStatus, now: string): boolean {
    return this.updateStatusStmt.run(to, now, id, from).changes === 1;
  }

  softDelete(id: number, now: string): boolean {
    return this.softDeleteStmt.run(now, id).changes === 1;
  }
}
