import {
  ACTOR_HEADER,
  type ApiErrorBody,
  type AuditLog,
  type CreateTaskRequest,
  type Task,
  type TaskStatus,
  type UpdateStatusRequest,
  type UpdateStatusResponse,
  type User,
} from '@mtm/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  options: { actor?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.actor) headers[ACTOR_HEADER] = options.actor;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, error?.code ?? 'INTERNAL_ERROR', error?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  listUsers: () => request<User[]>('GET', '/users'),
  listTasks: () => request<Task[]>('GET', '/tasks'),
  createTask: (input: CreateTaskRequest, actor: string) =>
    request<Task>('POST', '/tasks', { actor, body: input }),
  updateStatus: (id: number, status: TaskStatus, actor: string) =>
    request<UpdateStatusResponse>('PUT', `/tasks/${id}/status`, {
      actor,
      body: { status } satisfies UpdateStatusRequest,
    }),
  deleteTask: (id: number, actor: string) => request<void>('DELETE', `/tasks/${id}`, { actor }),
  listAuditLogs: (id: number) => request<AuditLog[]>('GET', `/tasks/${id}/audit-logs`),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'Cannot reach the API. Is the backend running?';
  return error instanceof Error ? error.message : String(error);
}
