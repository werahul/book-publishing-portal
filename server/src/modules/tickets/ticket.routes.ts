import { Router } from 'express';
import {
  createMessageSchema,
  createNoteSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketSchema,
} from '@bookleaf/shared';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './ticket.controller';

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

ticketsRouter.get('/', validate({ query: listTicketsQuerySchema }), controller.list);
ticketsRouter.post('/', requireRole('author'), validate({ body: createTicketSchema }), controller.create);
// Declared before /:id so "stats" isn't parsed as a ticket id.
ticketsRouter.get('/stats', requireRole('admin'), controller.stats);

ticketsRouter.get('/:id', validate({ params: ticketIdParamSchema }), controller.getById);
ticketsRouter.patch(
  '/:id',
  requireRole('admin'),
  validate({ params: ticketIdParamSchema, body: updateTicketSchema }),
  controller.update,
);
ticketsRouter.post(
  '/:id/messages',
  validate({ params: ticketIdParamSchema, body: createMessageSchema }),
  controller.addMessage,
);
ticketsRouter.post(
  '/:id/notes',
  requireRole('admin'),
  validate({ params: ticketIdParamSchema, body: createNoteSchema }),
  controller.addNote,
);
