import { nextStatus, type ErrorCode, type TaskStatus } from '@mtm/shared';

/** An expected failure with a stable code; the HTTP layer maps the code to a status. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const taskNotFound = (id: number) => new AppError('TASK_NOT_FOUND', `Task ${id} was not found`);

export function invalidTransition(from: TaskStatus, to: TaskStatus): AppError {
  const allowed = nextStatus(from);
  const hint = allowed
    ? `The only allowed next status is "${allowed}".`
    : `"${from}" is the final status.`;
  return new AppError('INVALID_TRANSITION', `Cannot change status from "${from}" to "${to}". ${hint}`, {
    from,
    to,
    allowed,
  });
}
