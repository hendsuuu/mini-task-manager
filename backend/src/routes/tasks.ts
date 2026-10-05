import { Router } from 'express';
import type { User } from '@mtm/shared';
import { actorOf, requireActor } from '../http/actor';
import { createTaskBody, parse, taskIdParam, updateStatusBody } from '../http/validation';
import type { TaskService } from '../services/taskService';

/** HTTP only: parse the request, call the service, shape the response. */
export function tasksRouter(service: TaskService, users: readonly User[]): Router {
  const router = Router();
  const withActor = requireActor(users);

  router.get('/', (_req, res) => {
    res.json(service.listTasks());
  });

  router.post('/', withActor, (req, res) => {
    const input = parse(createTaskBody, req.body);
    res.status(201).json(service.createTask(input, actorOf(res)));
  });

  router.put('/:id/status', withActor, (req, res) => {
    const id = parse(taskIdParam, req.params.id);
    const { status } = parse(updateStatusBody, req.body);
    res.json(service.changeStatus(id, status, actorOf(res)));
  });

  router.delete('/:id', withActor, (req, res) => {
    service.deleteTask(parse(taskIdParam, req.params.id), actorOf(res));
    res.status(204).end();
  });

  // Read-only on purpose: no route can change or remove an audit entry.
  router.get('/:id/audit-logs', (req, res) => {
    res.json(service.listAuditLogs(parse(taskIdParam, req.params.id)));
  });

  return router;
}
