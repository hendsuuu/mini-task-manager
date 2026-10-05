import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLog, Task } from '@mtm/shared';
import { createApp } from '../src/app';
import { openDatabase, type DB } from '../src/db/database';

let db: DB;
let api: ReturnType<typeof request>;

beforeEach(() => {
  db = openDatabase();
  api = request(createApp(db));
});

const ACTOR = 'john.doe';

async function createTask(title = 'Prepare Invoice', actor = ACTOR): Promise<Task> {
  const res = await api.post('/api/tasks').set('X-Actor', actor).send({ title });
  expect(res.status).toBe(201);
  return res.body;
}

const setStatus = (id: number, status: string, actor = ACTOR) =>
  api.put(`/api/tasks/${id}/status`).set('X-Actor', actor).send({ status });

async function logsOf(id: number): Promise<AuditLog[]> {
  const res = await api.get(`/api/tasks/${id}/audit-logs`);
  expect(res.status).toBe(200);
  return res.body;
}

describe('creating tasks', () => {
  it('starts in to_do and records who created it', async () => {
    const task = await createTask();
    expect(task).toMatchObject({ title: 'Prepare Invoice', description: '', status: 'to_do' });

    const [log, ...rest] = await logsOf(task.id);
    expect(rest).toHaveLength(0);
    expect(log).toMatchObject({ action: 'task_created', actor: ACTOR, fromStatus: null, toStatus: 'to_do' });
  });

  it('lists tasks newest first', async () => {
    await createTask('First');
    await createTask('Second');
    const res = await api.get('/api/tasks');
    expect(res.body.map((t: Task) => t.title)).toEqual(['Second', 'First']);
  });

  it('rejects a blank title', async () => {
    const res = await api.post('/api/tasks').set('X-Actor', ACTOR).send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed JSON', async () => {
    const res = await api
      .post('/api/tasks')
      .set('X-Actor', ACTOR)
      .set('Content-Type', 'application/json')
      .send('{"title":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('actor', () => {
  it('is required for every change', async () => {
    const task = await createTask();
    const responses = await Promise.all([
      api.post('/api/tasks').send({ title: 'x' }),
      api.put(`/api/tasks/${task.id}/status`).send({ status: 'pending' }),
      api.delete(`/api/tasks/${task.id}`),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('UNKNOWN_ACTOR');
    }
  });

  it('must be one of the predefined users', async () => {
    const res = await api.post('/api/tasks').set('X-Actor', 'mallory').send({ title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_ACTOR');
  });

  it('lists the predefined users', async () => {
    const res = await api.get('/api/users');
    expect(res.body.map((u: { id: string }) => u.id)).toContain(ACTOR);
  });
});

describe('changing status', () => {
  it('walks the whole flow and logs every step in order', async () => {
    const task = await createTask();
    for (const [status, actor] of [
      ['pending', 'jane.smith'],
      ['in_progress', 'john.doe'],
      ['done', 'budi.santoso'],
    ] as const) {
      const res = await setStatus(task.id, status, actor);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ changed: true, task: { status } });
    }

    const logs = await logsOf(task.id);
    expect(logs.map((l) => [l.actor, l.fromStatus, l.toStatus])).toEqual([
      ['john.doe', null, 'to_do'],
      ['jane.smith', 'to_do', 'pending'],
      ['john.doe', 'pending', 'in_progress'],
      ['budi.santoso', 'in_progress', 'done'],
    ]);
    // Chronological: ids strictly increase, timestamps never go backwards.
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i]!.id).toBeGreaterThan(logs[i - 1]!.id);
      expect(logs[i]!.createdAt >= logs[i - 1]!.createdAt).toBe(true);
    }
  });

  it('is idempotent: the same status twice writes no new log', async () => {
    const task = await createTask();
    await setStatus(task.id, 'pending');

    const again = await setStatus(task.id, 'pending', 'jane.smith');
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ changed: false, task: { status: 'pending' } });
    expect(await logsOf(task.id)).toHaveLength(2); // created + one change
  });

  it('keeps the task timestamp and the log entry in sync', async () => {
    const task = await createTask();
    const res = await setStatus(task.id, 'pending');
    const last = (await logsOf(task.id)).at(-1)!;
    expect(last.createdAt).toBe(res.body.task.updatedAt);
  });

  it.each([
    ['to_do', 'in_progress', 'skipping a step'],
    ['to_do', 'done', 'jumping to the end'],
  ])('rejects %s → %s (%s)', async (_from, to) => {
    const task = await createTask();
    const res = await setStatus(task.id, to);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'to_do', to, allowed: 'pending' } });
    expect(await logsOf(task.id)).toHaveLength(1);
    expect((await api.get('/api/tasks')).body[0].status).toBe('to_do');
  });

  it('rejects going backwards and anything after done', async () => {
    const task = await createTask();
    for (const status of ['pending', 'in_progress', 'done']) await setStatus(task.id, status);

    expect((await setStatus(task.id, 'in_progress')).status).toBe(409);
    expect((await setStatus(task.id, 'to_do')).status).toBe(409);
    expect((await setStatus(task.id, 'done')).body.changed).toBe(false);
    expect(await logsOf(task.id)).toHaveLength(4);
  });

  it('rejects unknown status values', async () => {
    const task = await createTask();
    const res = await setStatus(task.id, 'archived');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a task that does not exist', async () => {
    expect((await setStatus(999, 'pending')).status).toBe(404);
    expect((await setStatus(0, 'pending')).status).toBe(400);
  });

  it('turns a stale double click into a no-op instead of a second log', async () => {
    // Two people looking at the same "to_do" task both press "move to pending".
    const task = await createTask();
    const [first, second] = await Promise.all([
      setStatus(task.id, 'pending', 'john.doe'),
      setStatus(task.id, 'pending', 'jane.smith'),
    ]);
    expect([first.body.changed, second.body.changed].sort()).toEqual([false, true]);
    expect(await logsOf(task.id)).toHaveLength(2);
  });
});

describe('deleting tasks', () => {
  it('hides the task but keeps its full history, plus a deletion entry', async () => {
    const task = await createTask();
    await setStatus(task.id, 'pending');

    const res = await api.delete(`/api/tasks/${task.id}`).set('X-Actor', 'siti.rahma');
    expect(res.status).toBe(204);
    expect((await api.get('/api/tasks')).body).toEqual([]);

    const logs = await logsOf(task.id);
    expect(logs.map((l) => l.action)).toEqual(['task_created', 'status_changed', 'task_deleted']);
    expect(logs.at(-1)).toMatchObject({ actor: 'siti.rahma', fromStatus: 'pending', toStatus: null });
  });

  it('cannot change or delete a deleted task', async () => {
    const task = await createTask();
    await api.delete(`/api/tasks/${task.id}`).set('X-Actor', ACTOR);
    expect((await setStatus(task.id, 'pending')).status).toBe(404);
    expect((await api.delete(`/api/tasks/${task.id}`).set('X-Actor', ACTOR)).status).toBe(404);
    expect(await logsOf(task.id)).toHaveLength(2);
  });
});

describe('audit log immutability', () => {
  it('has no API route that changes or removes entries', async () => {
    const task = await createTask();
    const [put, patch, del] = await Promise.all([
      api.put(`/api/tasks/${task.id}/audit-logs`).set('X-Actor', ACTOR).send({}),
      api.patch(`/api/tasks/${task.id}/audit-logs`).set('X-Actor', ACTOR).send({}),
      api.delete(`/api/tasks/${task.id}/audit-logs`).set('X-Actor', ACTOR),
    ]);
    expect([put.status, patch.status, del.status]).toEqual([404, 404, 404]);
    expect(await logsOf(task.id)).toHaveLength(1);
  });

  it('is enforced by the database even for direct SQL', async () => {
    const task = await createTask();
    expect(() => db.prepare("UPDATE audit_logs SET actor = 'mallory'").run()).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM audit_logs').run()).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id)).toThrow(/FOREIGN KEY/);
    expect(() =>
      db
        .prepare(
          `INSERT INTO audit_logs (task_id, task_title, actor, action, from_status, to_status, created_at)
           VALUES (?, 'x', 'john.doe', 'status_changed', 'pending', 'pending', '2025-01-01T00:00:00.000Z')`,
        )
        .run(task.id),
    ).toThrow(/CHECK/);
    expect((await logsOf(task.id))[0]!.actor).toBe(ACTOR);
  });

  it('rolls the status back when the log entry cannot be written', async () => {
    const task = await createTask();
    db.exec(`CREATE TRIGGER fail_insert BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'disk full'); END`);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await setStatus(task.id, 'pending');
    expect(res.status).toBe(500);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();

    db.exec('DROP TRIGGER fail_insert');
    expect((await api.get('/api/tasks')).body[0].status).toBe('to_do');
    expect(await logsOf(task.id)).toHaveLength(1);
  });
});
