/**
 * Domain enums shared by the API and the web client.
 * Values are stable machine identifiers; *_LABELS hold the human-readable text
 * used in the UI and in AI prompts.
 */

export const SESSION_COOKIE_NAME = 'bl_token';

/** Royalties below this amount roll over to the next quarter (BookLeaf Royalty Policy). */
export const ROYALTY_PAYOUT_THRESHOLD_INR = 1000;

// ── Users ────────────────────────────────────────────────────────────────────
export const ROLES = ['author', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// ── Books ────────────────────────────────────────────────────────────────────
/** Ordered as in the Knowledge Base "Production Stages" section. */
export const PRODUCTION_STAGES = [
  'manuscript_received',
  'editing',
  'cover_design',
  'typesetting',
  'proofreading',
  'isbn_assignment',
  'printing',
  'distribution_setup',
  'published_live',
] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const PRODUCTION_STAGE_LABELS: Record<ProductionStage, string> = {
  manuscript_received: 'Manuscript Received',
  editing: 'Editing',
  cover_design: 'Cover Design',
  typesetting: 'Typesetting',
  proofreading: 'Proofreading',
  isbn_assignment: 'ISBN Assignment',
  printing: 'Printing',
  distribution_setup: 'Distribution Setup',
  published_live: 'Published & Live',
};

export const PRINT_PARTNERS = ['In-House', 'Repro India', 'Epitome Books'] as const;
export type PrintPartner = (typeof PRINT_PARTNERS)[number];

// ── Tickets ──────────────────────────────────────────────────────────────────
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const TICKET_CATEGORIES = [
  'royalty_payments',
  'isbn_metadata',
  'printing_quality',
  'distribution_availability',
  'book_status_production',
  'general_inquiry',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  royalty_payments: 'Royalty & Payments',
  isbn_metadata: 'ISBN & Metadata Issues',
  printing_quality: 'Printing & Quality',
  distribution_availability: 'Distribution & Availability',
  book_status_production: 'Book Status & Production Updates',
  general_inquiry: 'General Inquiry',
};

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Numeric rank stored alongside priority so the queue can sort "most urgent first". 0 = not yet scored. */
export const PRIORITY_RANK: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Who decided a ticket's category / priority. */
export const DECISION_SOURCES = ['ai', 'admin', 'fallback'] as const;
export type DecisionSource = (typeof DECISION_SOURCES)[number];

export const AI_STATES = ['pending', 'done', 'failed'] as const;
export type AiState = (typeof AI_STATES)[number];

/** Statuses that still need work from the support team. */
export const ACTIVE_TICKET_STATUSES = ['open', 'in_progress'] as const satisfies readonly TicketStatus[];

/** An active ticket with no activity for this long is flagged as stale in the queue. */
export const STALE_TICKET_HOURS = 48;

// ── Real-time ────────────────────────────────────────────────────────────────
/**
 * Socket.IO events. They only tell a client that something changed (payload:
 * `TicketEventPayload`); the client re-fetches through the REST API, so access
 * control and DTO whitelisting stay in one place.
 */
export const SOCKET_EVENTS = {
  ticketUpdated: 'ticket:updated',
  ticketMessage: 'ticket:message',
} as const;
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface TicketEventPayload {
  ticketId: string;
  ticketNumber: string;
}
