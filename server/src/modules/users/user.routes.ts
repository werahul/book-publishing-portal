import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import * as controller from './user.controller';

export const authorsRouter = Router();

authorsRouter.use(requireAuth, requireRole('admin'));
authorsRouter.get('/', controller.listAuthors);

export const adminsRouter = Router();

adminsRouter.use(requireAuth, requireRole('admin'));
adminsRouter.get('/', controller.listAdmins);
