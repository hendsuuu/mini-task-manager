import { useEffect, useState } from 'react';
import type { AuditLog, Task } from '@mtm/shared';
import { api, errorMessage } from '../api';
import { formatDateTime } from '../format';

function Describe({ log }: { log: AuditLog }) {
  const actor = <strong>"{log.actor}"</strong>;
  const task = <>Task "{log.taskTitle}"</>;
  switch (log.action) {
    case 'task_created':
      return (
        <>
          User {actor} created {task} with status <code>"{log.toStatus}"</code>
        </>
      );
    case 'status_changed':
      return (
        <>
          User {actor} changed {task} status from <code>"{log.fromStatus}"</code> to{' '}
          <code>"{log.toStatus}"</code>
        </>
      );
    case 'task_deleted':
      return (
        <>
          User {actor} deleted {task} (status was <code>"{log.fromStatus}"</code>)
        </>
      );
  }
}

/**
 * Oldest first, as the API returns it. Refetches whenever the task's
 * updatedAt moves, i.e. whenever a new entry can exist.
 */
export function AuditLogList({ task }: { task: Task }) {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listAuditLogs(task.id)
      .then((result) => {
        if (!cancelled) {
          setLogs(result);
          setError(null);
        }
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [task.id, task.updatedAt]);

  if (error) return <p className="history__message history__message--error">{error}</p>;
  if (!logs) return <p className="history__message">Loading history…</p>;

  return (
    <ol className="history" aria-label={`History of ${task.title}`}>
      {logs.map((log) => (
        <li key={log.id} className="history__entry">
          <time dateTime={log.createdAt} title={log.createdAt}>
            {formatDateTime(log.createdAt)}
          </time>
          <span>
            <Describe log={log} />
          </span>
        </li>
      ))}
    </ol>
  );
}
