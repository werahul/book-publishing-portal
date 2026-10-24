import { Types, type HydratedDocument } from 'mongoose';
import {
  PRIORITY_RANK,
  STALE_TICKET_HOURS,
  type CreateMessageInput,
  type CreateTicketInput,
  type ListTicketsQuery,
  type TicketStatus,
  type UpdateTicketInput,
} from '@bookleaf/shared';
import { scopeByOwner } from '../../lib/access';
import { Errors } from '../../lib/app-error';
import { escapeRegex } from '../../lib/regex';
import type { AuthUser } from '../../types/auth';
import { classifyByKeywords } from '../ai/fallback-classifier';
import { Book, type BookRecord } from '../books/book.model';
import { toBookDto } from '../books/book.dto';
import { User } from '../users/user.model';
import { nextSequence } from './counter.model';
import { InternalNote } from './internal-note.model';
import { Message } from './message.model';
import { Ticket, type TicketRecord } from './ticket.model';
import {
  toAdminTicketDto,
  toAuthorTicketDto,
  toMessageDto,
  toNoteDto,
  type AdminTicketDetailDto,
  type AdminTicketDto,
  type AuthorTicketDetailDto,
  type AuthorTicketDto,
  type MessageDto,
  type NoteDto,
  type PopulatedTicket,
  type PopulatedUser,
} from './ticket.dto';

type TicketDto = AuthorTicketDto | AdminTicketDto;

const BOOK_FIELDS = { path: 'book', select: 'title externalId' } as const;
const ADMIN_POPULATE = [
  { path: 'author', select: 'name email authorProfile.externalId' },
  BOOK_FIELDS,
  { path: 'assignee', select: 'name' },
];

export function formatTicketNumber(seq: number): string {
  return `BL-${1000 + seq}`;
}

/** Shape a ticket for whoever is looking at it. Authors never get admin-only fields. */
function toDto(ticket: PopulatedTicket, viewer: AuthUser): TicketDto {
  return viewer.role === 'admin' ? toAdminTicketDto(ticket) : toAuthorTicketDto(ticket);
}

async function findScoped(user: AuthUser, id: string) {
  return Ticket.findOne({ _id: id, ...scopeByOwner(user) })
    .populate(user.role === 'admin' ? ADMIN_POPULATE : [BOOK_FIELDS])
    .lean<PopulatedTicket>();
}

async function loadDto(user: AuthUser, id: string): Promise<TicketDto> {
  const ticket = await findScoped(user, id);
  if (!ticket) throw Errors.notFound('Ticket');
  return toDto(ticket, user);
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createTicket(user: AuthUser, input: CreateTicketInput): Promise<TicketDto> {
  if (input.bookId) {
    const ownsBook = await Book.exists({ _id: input.bookId, author: user.id });
    if (!ownsBook) {
      throw Errors.validation([
        { path: 'body.bookId', message: 'Choose one of your books, or General / Account Level' },
      ]);
    }
  }

  // Instant, offline classification so the ticket is triaged from the first second.
  // The LLM refines it asynchronously in the AI phase (docs/02-architecture.md §4).
  const triage = classifyByKeywords(input);

  const ticket = await Ticket.create({
    ticketNumber: formatTicketNumber(await nextSequence('ticket')),
    author: user.id,
    book: input.bookId,
    subject: input.subject,
    description: input.description,
    attachments: input.attachments,
    category: triage.category,
    categorySource: 'fallback',
    priority: triage.priority,
    priorityRank: PRIORITY_RANK[triage.priority],
    prioritySource: 'fallback',
    ai: { state: 'pending' },
  });

  return loadDto(user, String(ticket._id));
}

// ── List / queue ─────────────────────────────────────────────────────────────

export interface TicketListMeta {
  count: number;
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const SORTS = {
  urgency: { isActive: -1, priorityRank: -1, createdAt: 1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  updated: { lastActivityAt: -1, _id: -1 },
  idle: { lastActivityAt: 1, _id: 1 }, // longest without activity first
} as const;

export async function listTickets(
  user: AuthUser,
  query: ListTicketsQuery,
): Promise<{ items: TicketDto[]; meta: TicketListMeta }> {
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = { $in: query.status };
  if (query.category) filter.category = { $in: query.category };
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from && { $gte: new Date(`${query.from}T00:00:00.000Z`) }),
      // `to` is inclusive: everything before the start of the next day.
      ...(query.to && { $lt: new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + 86_400_000) }),
    };
  }
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ subject: rx }, { ticketNumber: rx }, { description: rx }];
  }

  // Priority and assignment are internal; authors can't filter (or infer) by them.
  if (user.role === 'admin') {
    if (query.priority) filter.priority = { $in: query.priority };
    if (query.assignee === 'me') filter.assignee = user.id;
    else if (query.assignee === 'unassigned') filter.assignee = null;
    else if (query.assignee) filter.assignee = query.assignee;
    if (query.authorId) filter.author = query.authorId;
  }

  const scoped = { ...filter, ...scopeByOwner(user) };
  const sort =
    user.role === 'author' && query.sort === 'urgency'
      ? { isActive: -1 as const, lastActivityAt: -1 as const, _id: -1 as const } // authors: active first, recent first
      : SORTS[query.sort];

  const [tickets, total] = await Promise.all([
    Ticket.find(scoped)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate(user.role === 'admin' ? ADMIN_POPULATE : [BOOK_FIELDS])
      .lean<PopulatedTicket[]>(),
    Ticket.countDocuments(scoped),
  ]);

  return {
    items: tickets.map((t) => toDto(t, user)),
    meta: {
      count: tickets.length,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

// ── Detail ───────────────────────────────────────────────────────────────────

export async function getTicketDetail(
  user: AuthUser,
  id: string,
): Promise<AuthorTicketDetailDto | AdminTicketDetailDto> {
  const ticket = await findScoped(user, id);
  if (!ticket) throw Errors.notFound('Ticket');

  const messages = (
    await Message.find({ ticket: ticket._id })
      .sort({ createdAt: 1 })
      .populate<{ sender: PopulatedUser }>('sender', 'name')
      .lean()
  ).map((m) => toMessageDto(m, user.role));

  if (user.role !== 'admin') return { ticket: toAuthorTicketDto(ticket), messages };

  // Admin-only from here: internal notes and the author's account context.
  const adminTicket = toAdminTicketDto(ticket);
  const authorId = adminTicket.author.id;
  const [notes, books, activeTickets, totalTickets] = await Promise.all([
    InternalNote.find({ ticket: ticket._id })
      .sort({ createdAt: 1 })
      .populate<{ admin: PopulatedUser }>('admin', 'name')
      .lean(),
    Book.find({ author: authorId }).sort({ externalId: 1 }).lean<BookRecord[]>(),
    Ticket.countDocuments({ author: authorId, isActive: true }),
    Ticket.countDocuments({ author: authorId }),
  ]);

  const draft = ticket.ai?.draft;
  return {
    ticket: {
      ...adminTicket,
      ai: {
        ...adminTicket.ai,
        draft: draft ? { body: draft.body, model: draft.model, generatedAt: draft.generatedAt } : null,
      },
    },
    messages,
    notes: notes.map(toNoteDto),
    authorContext: { books: books.map(toBookDto), activeTickets, totalTickets },
  };
}

// ── Update (admin) ───────────────────────────────────────────────────────────

function applyStatus(ticket: HydratedDocument<TicketRecord>, status: TicketStatus): void {
  ticket.status = status;
  const done = status === 'resolved' || status === 'closed';
  ticket.resolvedAt = done ? (ticket.resolvedAt ?? new Date()) : null;
}

export async function updateTicket(user: AuthUser, id: string, patch: UpdateTicketInput): Promise<TicketDto> {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw Errors.notFound('Ticket');

  if (patch.status && patch.status !== ticket.status) applyStatus(ticket, patch.status);

  // Overrides are recorded as admin decisions; the original AI verdict stays in ticket.ai.
  if (patch.category) {
    ticket.category = patch.category;
    ticket.categorySource = 'admin';
  }
  if (patch.priority) {
    ticket.priority = patch.priority;
    ticket.priorityRank = PRIORITY_RANK[patch.priority];
    ticket.prioritySource = 'admin';
  }

  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId !== null && !(await User.exists({ _id: patch.assigneeId, role: 'admin' }))) {
      throw Errors.validation([{ path: 'body.assigneeId', message: 'Tickets can only be assigned to BookLeaf admins' }]);
    }
    ticket.set('assignee', patch.assigneeId);
  }

  ticket.lastActivityAt = new Date();
  await ticket.save();
  return loadDto(user, id);
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function addMessage(user: AuthUser, id: string, input: CreateMessageInput): Promise<MessageDto> {
  const ticket = await Ticket.findOne({ _id: id, ...scopeByOwner(user) });
  if (!ticket) throw Errors.notFound('Ticket');
  if (ticket.status === 'closed') throw Errors.ticketClosed();

  const message = await Message.create({
    ticket: ticket._id,
    sender: user.id,
    senderRole: user.role,
    body: input.body,
    aiAssisted: user.role === 'admin' && input.aiAssisted,
  });

  // Sensible defaults so agents don't have to touch the status for the common flows:
  // an admin answering a new ticket starts working on it; an author replying to a
  // resolved ticket reopens it.
  if (user.role === 'admin' && ticket.status === 'open') applyStatus(ticket, 'in_progress');
  if (user.role === 'author' && ticket.status === 'resolved') applyStatus(ticket, 'open');

  ticket.lastActivityAt = message.createdAt;
  ticket.lastReplyRole = user.role;
  await ticket.save();

  return toMessageDto({ ...message.toObject(), sender: { _id: message.sender, name: user.name } }, user.role);
}

// ── Internal notes (admin) ───────────────────────────────────────────────────

export async function addNote(user: AuthUser, id: string, body: string): Promise<NoteDto> {
  if (!(await Ticket.exists({ _id: id }))) throw Errors.notFound('Ticket');
  const note = await InternalNote.create({ ticket: id, admin: user.id, body });
  return toNoteDto({ ...note.toObject(), admin: { _id: note.admin, name: user.name } });
}

// ── Queue stats (admin) ──────────────────────────────────────────────────────

export interface TicketStatsDto {
  byStatus: Record<TicketStatus, number>;
  activeByPriority: { critical: number; high: number; medium: number; low: number; unscored: number };
  activeUnassigned: number;
  activeStale: number;
  assignedToMe: number;
}

export async function getStats(user: AuthUser): Promise<TicketStatsDto> {
  const staleBefore = new Date(Date.now() - STALE_TICKET_HOURS * 60 * 60 * 1000);
  const [facets] = await Ticket.aggregate<{
    byStatus: { _id: TicketStatus; n: number }[];
    byPriority: { _id: string | null; n: number }[];
    unassigned: { n: number }[];
    stale: { n: number }[];
    mine: { n: number }[];
  }>([
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
        byPriority: [{ $match: { isActive: true } }, { $group: { _id: '$priority', n: { $sum: 1 } } }],
        unassigned: [{ $match: { isActive: true, assignee: null } }, { $count: 'n' }],
        stale: [{ $match: { isActive: true, lastActivityAt: { $lt: staleBefore } } }, { $count: 'n' }],
        // Aggregations bypass Mongoose casting, so the id must be an ObjectId here.
        mine: [{ $match: { isActive: true, assignee: new Types.ObjectId(user.id) } }, { $count: 'n' }],
      },
    },
  ]);

  const count = (rows: { _id: unknown; n: number }[] | undefined, key: unknown) =>
    rows?.find((r) => r._id === key)?.n ?? 0;

  return {
    byStatus: {
      open: count(facets?.byStatus, 'open'),
      in_progress: count(facets?.byStatus, 'in_progress'),
      resolved: count(facets?.byStatus, 'resolved'),
      closed: count(facets?.byStatus, 'closed'),
    },
    activeByPriority: {
      critical: count(facets?.byPriority, 'critical'),
      high: count(facets?.byPriority, 'high'),
      medium: count(facets?.byPriority, 'medium'),
      low: count(facets?.byPriority, 'low'),
      unscored: count(facets?.byPriority, null),
    },
    activeUnassigned: facets?.unassigned[0]?.n ?? 0,
    activeStale: facets?.stale[0]?.n ?? 0,
    assignedToMe: facets?.mine[0]?.n ?? 0,
  };
}
