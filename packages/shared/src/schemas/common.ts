import { z } from 'zod';

/** 24-char hex MongoDB ObjectId. */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id');
