import type { ErrorRequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody, ErrorCode } from '@mtm/shared';
import { AppError } from '../errors';

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNKNOWN_ACTOR: 400,
  TASK_NOT_FOUND: 404,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  INTERNAL_ERROR: 500,
};

function send(res: Response, code: ErrorCode, message: string, details?: unknown) {
  const body: ApiErrorBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  res.status(HTTP_STATUS[code]).json(body);
}

const isMalformedJson = (err: unknown) =>
  typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return send(res, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    return send(res, 'VALIDATION_ERROR', issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join('; '), issues);
  }
  if (isMalformedJson(err)) {
    return send(res, 'VALIDATION_ERROR', 'Request body must be valid JSON');
  }
  console.error(err);
  send(res, 'INTERNAL_ERROR', 'Something went wrong');
};
