import {
  classifyTransition,
  type AuditLog,
  type Task,
  type TaskStatus,
  type UpdateStatusResponse,
} from '@mtm/shared';
import type { DB } from '../db/database';
import { invalidTransition, taskNotFound } from '../errors';
import { AuditLogRepository } from '../repositories/auditLogRepository';
import { TaskRepository } from '../repositories/taskRepository';

export type Clock = () => Date;

/**
 * All task rules live here. Every write changes the task and appends its
 * audit entry inside one transaction, so either both happen or neither does.
 */
export class TaskService {
  private readonly tasks: TaskRepository;
  private readonly logs: AuditLogRepository;

  constructor(
    private readonly db: DB,
    private readonly clock: Clock = () => new Date(),
  ) {
    this.tasks = new TaskRepository(db);
    this.logs = new AuditLogRepository(db);
  }

  listTasks(): Task[] {
    return this.tasks.listActive();
  }

  createTask(input: { title: string; description: string }, actor: string): Task {
    return this.db.transaction(() => {
      const now = this.now();
      const task = this.tasks.insert(input.title, input.description, 'to_do', now);
      this.logs.append({
        taskId: task.id,
        taskTitle: task.title,
        actor,
        action: 'task_created',
        fromStatus: null,
        toStatus: task.status,
        createdAt: now,
      });
      return task;
    })();
  }

  /**
   * Idempotent: asking for the status the task already has changes nothing
   * and writes no log entry. IMMEDIATE takes the write lock before the read,
   * so the status checked is still the status when the update lands.
   */
  changeStatus(id: number, to: TaskStatus, actor: string): UpdateStatusResponse {
    return this.db.transaction(() => {
      const task = this.tasks.findActive(id);
      if (!task) throw taskNotFound(id);

      const transition = classifyTransition(task.status, to);
      if (transition === 'unchanged') return { task, changed: false };
      if (transition === 'not_allowed') throw invalidTransition(task.status, to);

      const now = this.now();
      if (!this.tasks.updateStatus(id, task.status, to, now)) {
        // Unreachable while the write lock is held; guards against a future refactor.
        throw new Error(`Task ${id} changed during the status update`);
      }
      this.logs.append({
        taskId: id,
        taskTitle: task.title,
        actor,
        action: 'status_changed',
        fromStatus: task.status,
        toStatus: to,
        createdAt: now,
      });
      return { task: { ...task, status: to, updatedAt: now }, changed: true };
    }).immediate();
  }

  /** Soft delete: the task leaves the list, its history stays. */
  deleteTask(id: number, actor: string): void {
    this.db.transaction(() => {
      const task = this.tasks.findActive(id);
      if (!task) throw taskNotFound(id);

      const now = this.now();
      this.tasks.softDelete(id, now);
      this.logs.append({
        taskId: id,
        taskTitle: task.title,
        actor,
        action: 'task_deleted',
        fromStatus: task.status,
        toStatus: null,
        createdAt: now,
      });
    }).immediate();
  }

  /** Works for deleted tasks too, so their history can still be read. */
  listAuditLogs(taskId: number): AuditLog[] {
    if (!this.tasks.exists(taskId)) throw taskNotFound(taskId);
    return this.logs.listByTask(taskId);
  }

  private now(): string {
    return this.clock().toISOString();
  }
}
