import type { Request, Response } from 'express';
import type {
  CreateMessageInput,
  CreateNoteInput,
  CreateTicketInput,
  ListTicketsQuery,
  UpdateTicketInput,
} from '@bookleaf/shared';
import { currentUser } from '../../middleware/auth';
import * as ticketService from './ticket.service';

type IdParams = Request<{ id: string }>;

export async function list(req: Request, res: Response) {
  const { items, meta } = await ticketService.listTickets(currentUser(req), req.query as unknown as ListTicketsQuery);
  res.json({ data: items, meta });
}

export async function create(req: Request, res: Response) {
  const ticket = await ticketService.createTicket(currentUser(req), req.body as CreateTicketInput);
  res.status(201).json({ data: ticket });
}

export async function stats(req: Request, res: Response) {
  res.json({ data: await ticketService.getStats(currentUser(req)) });
}

export async function getById(req: IdParams, res: Response) {
  res.json({ data: await ticketService.getTicketDetail(currentUser(req), req.params.id) });
}

export async function update(req: IdParams, res: Response) {
  const ticket = await ticketService.updateTicket(currentUser(req), req.params.id, req.body as UpdateTicketInput);
  res.json({ data: ticket });
}

export async function addMessage(req: IdParams, res: Response) {
  const message = await ticketService.addMessage(currentUser(req), req.params.id, req.body as CreateMessageInput);
  res.status(201).json({ data: message });
}

export async function addNote(req: IdParams, res: Response) {
  const { body } = req.body as CreateNoteInput;
  res.status(201).json({ data: await ticketService.addNote(currentUser(req), req.params.id, body) });
}
