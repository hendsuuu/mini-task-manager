import { useEffect, useState } from 'react';
import type { CreateTaskRequest, Task, TaskStatus, User } from '@mtm/shared';
import { api, ApiError, errorMessage } from './api';
import { ActorSelect } from './components/ActorSelect';
import { CreateTaskForm } from './components/CreateTaskForm';
import { TaskItem } from './components/TaskItem';

export function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [actor, setActor] = useState('');
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listUsers(), api.listTasks()])
      .then(([loadedUsers, loadedTasks]) => {
        setUsers(loadedUsers);
        setActor(loadedUsers[0]?.id ?? '');
        setTasks(loadedTasks);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  /**
   * Runs one change, then reloads the list from the server whether it worked
   * or not, so the screen always shows the server's state (for example after
   * someone else already moved the task).
   */
  async function mutate(change: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    let ok = true;
    try {
      await change();
    } catch (err) {
      ok = false;
      const stale = err instanceof ApiError && err.code === 'INVALID_TRANSITION';
      setError(stale ? `${errorMessage(err)} The list now shows the latest status.` : errorMessage(err));
    }
    try {
      setTasks(await api.listTasks());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return ok;
  }

  const createTask = (input: CreateTaskRequest) => mutate(() => api.createTask(input, actor));
  const changeStatus = (task: Task, status: TaskStatus) => mutate(() => api.updateStatus(task.id, status, actor));
  const deleteTask = (task: Task) => {
    if (window.confirm(`Delete "${task.title}"? Its history is kept.`)) {
      void mutate(() => api.deleteTask(task.id, actor));
    }
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1>Mini Task Manager</h1>
          <p className="subtitle">Every status change is recorded with who made it and when.</p>
        </div>
        {users.length > 0 && <ActorSelect users={users} value={actor} onChange={setActor} />}
      </header>

      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button type="button" className="button button--ghost" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <main>
        <CreateTaskForm busy={busy || !actor} onCreate={createTask} />

        <section aria-labelledby="tasks-heading">
          <h2 id="tasks-heading">Tasks{tasks ? ` (${tasks.length})` : ''}</h2>
          {tasks === null ? (
            <p className="empty">{error ? 'Could not load tasks.' : 'Loading…'}</p>
          ) : tasks.length === 0 ? (
            <p className="empty">No tasks yet. Add one above.</p>
          ) : (
            <ul className="task-list">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  busy={busy || !actor}
                  onChangeStatus={changeStatus}
                  onDelete={deleteTask}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
