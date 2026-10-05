import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { openDatabase } from './db/database';

// Not PORT: tools that run both apps together often set PORT for the frontend.
const port = Number(process.env.API_PORT ?? 3001);
const dbFile = process.env.DB_FILE ?? path.resolve(import.meta.dirname, '../data/tasks.db');

mkdirSync(path.dirname(dbFile), { recursive: true });
const db = openDatabase(dbFile);

const server = createApp(db).listen(port, () => {
  console.log(`API listening on http://localhost:${port} (database: ${dbFile})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
