import { Router } from 'express';
import { loginSchema } from '@bookleaf/shared';
import { requireAuth } from '../../middleware/auth';
import { loginRateLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import * as controller from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, validate({ body: loginSchema }), controller.login);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);
