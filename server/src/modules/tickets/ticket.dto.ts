import type { Types } from 'mongoose';
import {
  STALE_TICKET_HOURS,
  type AiState,
  type DecisionSource,
  type Priority,
  type Role,
  type TicketCategory,
  type TicketStatus,
} from '@bookleaf/shared';
import type { BookDto } from '../books/book.dto';
import type { InternalNoteRecord } from './internal-note.model';
import type { MessageRecord } from './message.model';
import type { TicketRecord } from './ticket.model';

// ── Populated shapes (what the service selects) ──────────────────────────────

export interface PopulatedBook {
  _id: Types.ObjectId;
  title: string;
  externalId: string;
}
export interface PopulatedAuthor {
  _id: Types.ObjectId;
  name: string;
  email: string;
  authorProfile?: { externalId: string };
}
export interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
}

export type PopulatedTicket = Omit<TicketRecord, 'author' | 'book' | 'assignee'> & {
  author: PopulatedAuthor | Types.ObjectId;
  book: PopulatedBook | null;
  assignee: PopulatedUser | null;
};

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface TicketBookRef {
  id: string;
  externalId: string;
  title: string;
}

/** What an author may see about their own ticket. */
export interface AuthorTicketDto {
  id: string;
  ticketNumber: string;
  book: TicketBookRef | null;
  subject: string;
  description: string;
  attachments: { name: string; size: number; mimeType: string }[];
  status: TicketStatus;
  category: TicketCategory | null;
  lastReplyRole: Role | null;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Full ticket for the support team. */
export interface AdminTicketDto extends AuthorTicketDto {
  author: { id: string; name: string; email: string; externalId: string | null };
  categorySource: DecisionSource | null;
  priority: Priority | null;
  priorityRank: number;
  prioritySource: DecisionSource | null;
  assignee: { id: string; name: string } | null;
  isActive: boolean;
  isStale: boolean;
  ai: {
    state: AiState;
    classification: { category: TicketCategory; priority: Priority; reasoning: string; model: string; at: Date } | null;
    error: string | null;
  };
}

export interface MessageDto {
  id: string;
  body: string;
  senderRole: Role;
  sender: { id: string; name: string };
  createdAt: Date;
  /** Admin view only. */
  aiAssisted?: boolean;
}

export interface NoteDto {
  id: string;
  body: string;
  admin: { id: string; name: string };
  createdAt: Date;
}

export interface AuthorTicketDetailDto {
  ticket: AuthorTicketDto;
  messages: MessageDto[];
}

export interface AdminTicketDetailDto {
  ticket: AdminTicketDto & { ai: AdminTicketDto['ai'] & { draft: { body: string; model: string; generatedAt: Date } | null } };
  messages: MessageDto[];
  notes: NoteDto[];
  /** Everything an agent needs to answer without opening another screen. */
  authorContext: {
    books: BookDto[];
    activeTickets: number;
    totalTickets: number;
  };
}

// ── Mappers ──────────────────────────────────────────────────────────────────

const STALE_MS = STALE_TICKET_HOURS * 60 * 60 * 1000;

function isPopulated<T extends { _id: Types.ObjectId }>(value: T | Types.ObjectId | null | undefined): value is T {
  return typeof value === 'object' && value !== null && 'name' in value;
}

export function toAuthorTicketDto(ticket: PopulatedTicket): AuthorTicketDto {
  return {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    book: ticket.book
      ? { id: String(ticket.book._id), externalId: ticket.book.externalId, title: ticket.book.title }
      : null,
    subject: ticket.subject,
    description: ticket.description,
    attachments: ticket.attachments.map(({ name, size, mimeType }) => ({ name, size, mimeType })),
    status: ticket.status,
    category: (ticket.category as TicketCategory | null) ?? null,
    lastReplyRole: (ticket.lastReplyRole as Role | null) ?? null,
    lastActivityAt: ticket.lastActivityAt,
    resolvedAt: ticket.resolvedAt ?? null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

export function toAdminTicketDto(ticket: PopulatedTicket, now = Date.now()): AdminTicketDto {
  const author = ticket.author;
  const classification = ticket.ai?.classification;
  return {
    ...toAuthorTicketDto(ticket),
    author: isPopulated(author)
      ? {
          id: String(author._id),
          name: author.name,
          email: author.email,
          externalId: author.authorProfile?.externalId ?? null,
        }
      : { id: String(author), name: 'Unknown author', email: '', externalId: null },
    categorySource: (ticket.categorySource as DecisionSource | null) ?? null,
    priority: (ticket.priority as Priority | null) ?? null,
    priorityRank: ticket.priorityRank,
    prioritySource: (ticket.prioritySource as DecisionSource | null) ?? null,
    assignee: ticket.assignee ? { id: String(ticket.assignee._id), name: ticket.assignee.name } : null,
    isActive: ticket.isActive,
    isStale: ticket.isActive && now - new Date(ticket.lastActivityAt).getTime() > STALE_MS,
    ai: {
      state: ticket.ai?.state ?? 'pending',
      classification: classification
        ? {
            category: classification.category,
            priority: classification.priority,
            reasoning: classification.reasoning,
            model: classification.model,
            at: classification.at,
          }
        : null,
      error: ticket.ai?.error ?? null,
    },
  };
}

type PopulatedMessage = Omit<MessageRecord, 'sender'> & { sender: PopulatedUser | Types.ObjectId };

export function toMessageDto(message: PopulatedMessage, viewer: Role): MessageDto {
  const sender = message.sender;
  return {
    id: String(message._id),
    body: message.body,
    senderRole: message.senderRole,
    sender: isPopulated(sender)
      ? { id: String(sender._id), name: sender.name }
      : { id: String(sender), name: message.senderRole === 'admin' ? 'BookLeaf Support' : 'Author' },
    createdAt: message.createdAt,
    ...(viewer === 'admin' && { aiAssisted: message.aiAssisted }),
  };
}

type PopulatedNote = Omit<InternalNoteRecord, 'admin'> & { admin: PopulatedUser | Types.ObjectId };

export function toNoteDto(note: PopulatedNote): NoteDto {
  const admin = note.admin;
  return {
    id: String(note._id),
    body: note.body,
    admin: isPopulated(admin) ? { id: String(admin._id), name: admin.name } : { id: String(admin), name: 'Admin' },
    createdAt: note.createdAt,
  };
}
