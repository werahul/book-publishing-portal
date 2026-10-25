import { z } from 'zod';
import { ROLES } from '../constants';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(128, 'Password is too long'),
  /** The sign-in tab the user chose. Optional: API clients may omit it and sign in with any role. */
  portal: z.enum(ROLES).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
