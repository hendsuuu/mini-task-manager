import { useState, type FormEvent } from 'react';
import type { CreateTaskRequest } from '@mtm/shared';

interface Props {
  busy: boolean;
  /** Resolves true when the task was created, so the form can clear. */
  onCreate: (input: CreateTaskRequest) => Promise<boolean>;
}

export function CreateTaskForm({ busy, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (await onCreate({ title: title.trim(), description: description.trim() })) {
      setTitle('');
      setDescription('');
    }
  }

  return (
    <form className="card create-form" onSubmit={submit}>
      <h2>New task</h2>
      <label>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Prepare Invoice"
          maxLength={200}
          required
        />
      </label>
      <label>
        <span>
          Description <span className="optional">(optional)</span>
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
        />
      </label>
      <button type="submit" className="button button--primary" disabled={busy || !title.trim()}>
        Add task
      </button>
    </form>
  );
}
