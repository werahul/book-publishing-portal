import { z } from 'zod';
import { objectIdSchema } from './common';

/** A book can be addressed by its ObjectId or its dataset id (e.g. "BK001"). */
export const bookIdParamSchema = z.object({
  id: z.union([objectIdSchema, z.string().regex(/^BK\d+$/i, 'Must be a valid book id')]),
});

export const listBooksQuerySchema = z.object({
  /** Admin-only filter; ignored for authors (their scope always wins). */
  authorId: objectIdSchema.optional(),
});

export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;
