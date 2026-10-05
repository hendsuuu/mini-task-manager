import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from '@mtm/shared';

/** The fixed flow, with the steps already reached filled in. */
export function StatusSteps({ status }: { status: TaskStatus }) {
  const current = TASK_STATUSES.indexOf(status);
  return (
    <ol className="steps" aria-label={`Status: ${STATUS_LABELS[status]}`}>
      {TASK_STATUSES.map((step, index) => (
        <li
          key={step}
          className={index < current ? 'step step--past' : index === current ? 'step step--current' : 'step'}
          aria-current={index === current ? 'step' : undefined}
        >
          {STATUS_LABELS[step]}
        </li>
      ))}
    </ol>
  );
}
