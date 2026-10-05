import { useState } from 'react';
import { nextStatus, STATUS_LABELS, type Task, type TaskStatus } from '@mtm/shared';
import { formatDateTime } from '../format';
import { AuditLogList } from './AuditLogList';
import { StatusBadge } from './StatusBadge';
import { StatusSteps } from './StatusSteps';

interface Props {
  task: Task;
  busy: boolean;
  onChangeStatus: (task: Task, status: TaskStatus) => void;
  onDelete: (task: Task) => void;
}

export function TaskItem({ task, busy, onChangeStatus, onDelete }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  // The UI only ever offers the next step; the backend still validates it.
  const next = nextStatus(task.status);

  return (
    <li className="task">
      <div className="task__header">
        <h3 className="task__title">{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>
      {task.description && <p className="task__description">{task.description}</p>}
      <StatusSteps status={task.status} />

      <div className="task__actions">
        {next ? (
          <button type="button" className="button button--primary" disabled={busy} onClick={() => onChangeStatus(task, next)}>
            Move to {STATUS_LABELS[next]} →
          </button>
        ) : (
          <span className="task__finished">Finished</span>
        )}
        <button
          type="button"
          className="button"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((shown) => !shown)}
        >
          {showHistory ? 'Hide history' : 'Show history'}
        </button>
        <button type="button" className="button button--danger" disabled={busy} onClick={() => onDelete(task)}>
          Delete
        </button>
        <span className="task__meta" title={task.updatedAt}>
          Updated {formatDateTime(task.updatedAt)}
        </span>
      </div>

      {showHistory && <AuditLogList task={task} />}
    </li>
  );
}
