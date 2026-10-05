import { z } from 'zod';
import { TASK_STATUSES } from '@mtm/shared';

export const createTaskBody = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).default(''),
});

export const updateStatusBody = z.object({
  status: z.enum(TASK_STATUSES),
});

export const taskIdParam = z.coerce.number().int().positive();

/** Throws a ZodError, which the error handler turns into a 400. */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return schema.parse(value);
}
