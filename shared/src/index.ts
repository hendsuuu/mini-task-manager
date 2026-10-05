/**
 * Domain types and rules shared by the backend and the frontend.
 *
 * The status flow lives here so both sides agree on it. The backend is the
 * authority (it rejects bad transitions); the frontend only uses it to decide
 * which button to show.
 */

export const TASK_STATUSES = ['to_do', 'pending', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To do',
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

/** The only status a task may move to next, or null when it is finished. */
export function nextStatus(status: TaskStatus): TaskStatus | null {
  const index = TASK_STATUSES.indexOf(status);
  return TASK_STATUSES[index + 1] ?? null;
}

/**
 * - `unchanged`: same status, a no-op (no audit log is written)
 * - `allowed`: exactly one step forward
 * - `not_allowed`: a skip, a step back, or anything after `done`
 */
export type TransitionKind = 'unchanged' | 'allowed' | 'not_allowed';

export function classifyTransition(from: TaskStatus, to: TaskStatus): TransitionKind {
  if (from === to) return 'unchanged';
  return nextStatus(from) === to ? 'allowed' : 'not_allowed';
}

export interface User {
  /** Username, also what the audit log stores as the actor. */
  id: string;
  name: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export const AUDIT_ACTIONS = ['task_created', 'status_changed', 'task_deleted'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLog {
  /** Monotonic; the log is ordered by it, so equal timestamps still sort correctly. */
  id: number;
  taskId: number;
  /** Title at the time of the event, so the entry still reads correctly on its own. */
  taskTitle: string;
  actor: string;
  action: AuditAction;
  /** null for `task_created`. */
  fromStatus: TaskStatus | null;
  /** null for `task_deleted`. */
  toStatus: TaskStatus | null;
  createdAt: string;
}

/** Header that carries the acting user on every write request. */
export const ACTOR_HEADER = 'X-Actor';

export interface CreateTaskRequest {
  title: string;
  description?: string;
}

export interface UpdateStatusRequest {
  status: TaskStatus;
}

export interface UpdateStatusResponse {
  task: Task;
  /** false when the task already had that status (idempotent no-op). */
  changed: boolean;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ACTOR'
  | 'TASK_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
