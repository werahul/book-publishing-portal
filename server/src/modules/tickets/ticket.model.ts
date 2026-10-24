import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import {
  ACTIVE_TICKET_STATUSES,
  AI_STATES,
  ROLES,
  DECISION_SOURCES,
  PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
} from '@bookleaf/shared';


const attachmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true },
  },
  { _id: false },
);

const aiSchema = new Schema(
  {
    state: { type: String, enum: AI_STATES, default: 'pending' },
    // The raw AI verdict, kept even after an admin override (useful to measure accuracy).
    classification: {
      type: new Schema(
        {
          category: { type: String, enum: TICKET_CATEGORIES, required: true },
          priority: { type: String, enum: PRIORITIES, required: true },
          reasoning: { type: String, default: '' },
          model: { type: String, required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    // Cached draft reply. Admin-only — never serialised to authors.
    draft: {
      type: new Schema(
        {
          body: { type: String, required: true },
          model: { type: String, required: true },
          generatedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    error: { type: String, default: null },
  },
  { _id: false },
);

const ticketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** null = "General / Account Level". */
    book: { type: Schema.Types.ObjectId, ref: 'Book', default: null },
    subject: { type: String, required: true, trim: true, minlength: 5, maxlength: 150 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
    attachments: { type: [attachmentSchema], default: [] },

    status: { type: String, enum: TICKET_STATUSES, default: 'open' },
    /**
     * Derived from `status` (open / in_progress) by the pre-validate hook. Stored so the
     * queue can sort "unresolved first" with an index instead of an aggregation.
     */
    isActive: { type: Boolean, default: true },

    category: { type: String, enum: [...TICKET_CATEGORIES, null], default: null },
    categorySource: { type: String, enum: [...DECISION_SOURCES, null], default: null },
    priority: { type: String, enum: [...PRIORITIES, null], default: null },
    /** Sortable mirror of `priority` (critical 4 … low 1, 0 = unscored). */
    priorityRank: { type: Number, default: 0, min: 0, max: 4 },
    prioritySource: { type: String, enum: [...DECISION_SOURCES, null], default: null },

    ai: { type: aiSchema, default: () => ({}) },

    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    /** Bumped on every reply or status change; drives "stale" highlighting. */
    lastActivityAt: { type: Date, default: () => new Date() },
    /** Who spoke last in the public thread (null = no replies yet). */
    lastReplyRole: { type: String, enum: [...ROLES, null], default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ticketSchema.pre('validate', function () {
  this.isActive = (ACTIVE_TICKET_STATUSES as readonly string[]).includes(this.status);
});

ticketSchema.index({ author: 1, createdAt: -1 }); // author: "My Tickets"
ticketSchema.index({ isActive: -1, priorityRank: -1, createdAt: 1 }); // admin queue: unresolved, urgent, oldest
ticketSchema.index({ status: 1, lastActivityAt: 1 }); // status filters + stale detection
ticketSchema.index({ category: 1 });
ticketSchema.index({ assignee: 1 });

export type TicketRecord = InferSchemaType<typeof ticketSchema> & { _id: Types.ObjectId };
export const Ticket = model('Ticket', ticketSchema);
