import express from 'express';
import type { DB } from './db/database';
import { AppError } from './errors';
import { errorHandler } from './http/errorHandler';
import { tasksRouter } from './routes/tasks';
import { TaskService } from './services/taskService';
import { USERS } from './users';

export function createApp(db: DB) {
  const service = new TaskService(db);
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/users', (_req, res) => {
    res.json(USERS);
  });
  app.use('/api/tasks', tasksRouter(service, USERS));

  app.use((req, _res, next) => {
    next(new AppError('NOT_FOUND', `No route for ${req.method} ${req.path}`));
  });
  app.use(errorHandler);

  return app;
}
