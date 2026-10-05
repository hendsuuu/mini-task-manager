import type { RequestHandler, Response } from 'express';
import { ACTOR_HEADER, type User } from '@mtm/shared';
import { AppError } from '../errors';

/**
 * Who is making the change travels in a header, like an auth identity would,
 * rather than in each request body. Swapping this for real auth later only
 * touches this file.
 */
export function requireActor(users: readonly User[]): RequestHandler {
  const known = new Set(users.map((user) => user.id));

  return (req, res, next) => {
    const actor = req.get(ACTOR_HEADER)?.trim();
    if (!actor) {
      throw new AppError('UNKNOWN_ACTOR', `The ${ACTOR_HEADER} header is required for changes`);
    }
    if (!known.has(actor)) {
      throw new AppError('UNKNOWN_ACTOR', `Unknown actor "${actor}"`);
    }
    res.locals.actor = actor;
    next();
  };
}

export function actorOf(res: Response): string {
  return res.locals.actor as string;
}
