import { Router } from 'express';
import { bookIdParamSchema, listBooksQuerySchema } from '@bookleaf/shared';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './book.controller';

export const booksRouter = Router();

booksRouter.use(requireAuth);
booksRouter.get('/', validate({ query: listBooksQuerySchema }), controller.list);
booksRouter.get('/:id', validate({ params: bookIdParamSchema }), controller.getById);
