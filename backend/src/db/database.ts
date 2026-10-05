import Database from 'better-sqlite3';
import { TASK_STATUSES } from '@mtm/shared';

export type DB = Database.Database;

const statuses = TASK_STATUSES.map((status) => `'${status}'`).join(', ');

/**
 * The audit log's guarantees are enforced here, not only in application code:
 *
 * - triggers reject every UPDATE and DELETE on `audit_logs`, whoever sends it;
 * - the CHECK on `audit_logs` only accepts well-formed entries, so a no-op
 *   status change (from = to) can never be stored;
 * - `ON DELETE RESTRICT` stops a task from being hard-deleted while it has log
 *   entries (every task has at least its "created" entry), so tasks are
 *   soft-deleted instead;
 * - AUTOINCREMENT never reuses ids, so `id` gives a strict chronological order.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL CHECK (status IN (${statuses})),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL REFERENCES tasks (id) ON DELETE RESTRICT,
  task_title  TEXT NOT NULL,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  from_status TEXT CHECK (from_status IN (${statuses})),
  to_status   TEXT CHECK (to_status IN (${statuses})),
  created_at  TEXT NOT NULL,
  CHECK (
    (action = 'task_created'   AND from_status IS NULL     AND to_status IS NOT NULL) OR
    (action = 'status_changed' AND from_status IS NOT NULL AND to_status IS NOT NULL AND from_status <> to_status) OR
    (action = 'task_deleted'   AND from_status IS NOT NULL AND to_status IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS audit_logs_by_task ON audit_logs (task_id, id);

CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only: UPDATE is not allowed');
END;

CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only: DELETE is not allowed');
END;
`;

/** Opens (and if needed creates) the database. Defaults to an in-memory one, used by the tests. */
export function openDatabase(filename = ':memory:'): DB {
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  if (!db.memory) db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}
