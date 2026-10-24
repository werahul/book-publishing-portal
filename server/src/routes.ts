import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { booksRouter } from './modules/books/book.routes';
import { healthRouter } from './modules/health/health.routes';
import { ticketsRouter } from './modules/tickets/ticket.routes';
import { authorsRouter } from './modules/users/user.routes';

/** Mounted at /api/v1. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/books', booksRouter);
apiRouter.use('/authors', authorsRouter);
apiRouter.use('/tickets', ticketsRouter);
