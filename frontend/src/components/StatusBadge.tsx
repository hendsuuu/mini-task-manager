import { STATUS_LABELS, type TaskStatus } from '@mtm/shared';

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>;
}
