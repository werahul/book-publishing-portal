import { z } from 'zod';
import { PRIORITIES, TICKET_CATEGORIES, TICKET_STATUSES } from '../constants';
import { objectIdSchema } from './common';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

export const ticketIdParamSchema = z.object({ id: objectIdSchema });

// ── Create (author) ──────────────────────────────────────────────────────────

/** Attachment metadata only — file upload itself is out of scope (see docs/01-requirements.md §5). */
export const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative().max(MAX_ATTACHMENT_BYTES, 'Attachments must be 10 MB or smaller'),
  mimeType: z.string().trim().min(1).max(100),
});

export const createTicketSchema = z.object({
  /** null = "General / Account Level". */
  bookId: objectIdSchema.nullable().default(null),
  subject: z
    .string()
    .trim()
    .min(5, 'Subject must be at least 5 characters')
    .max(150, 'Subject must be 150 characters or fewer'),
  description: z
    .string()
    .trim()
    .min(20, 'Please describe the issue in at least 20 characters')
    .max(5000, 'Description must be 5,000 characters or fewer'),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS, `Attach at most ${MAX_ATTACHMENTS} files`).default([]),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

// ── List / queue ─────────────────────────────────────────────────────────────

/** Accepts "open,in_progress" (comma-separated) so the queue can show several statuses at once. */
function csvOf<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).min(1));
}

export const TICKET_SORTS = ['urgency', 'newest', 'oldest', 'updated', 'idle'] as const;
export type TicketSort = (typeof TICKET_SORTS)[number];

export const listTicketsQuerySchema = z.object({
  status: csvOf(TICKET_STATUSES).optional(),
  category: csvOf(TICKET_CATEGORIES).optional(),
  /** Admin-only filters below; ignored for authors. */
  priority: csvOf(PRIORITIES).optional(),
  assignee: z.union([z.literal('me'), z.literal('unassigned'), objectIdSchema]).optional(),
  authorId: objectIdSchema.optional(),
  /** Created-on date range, inclusive ("YYYY-MM-DD"). */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(TICKET_SORTS).default('urgency'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

// ── Update (admin) ───────────────────────────────────────────────────────────

export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    /** null unassigns. */
    assigneeId: objectIdSchema.nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.values(patch).some((v) => v !== undefined), {
    message: 'Provide at least one field to update',
  });

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

// ── Messages & notes ─────────────────────────────────────────────────────────

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(10000, 'Message is too long'),
  /** Admin only: the reply started from the AI draft. Ignored for authors. */
  aiAssisted: z.boolean().default(false),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const createNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note cannot be empty').max(5000, 'Note is too long'),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
