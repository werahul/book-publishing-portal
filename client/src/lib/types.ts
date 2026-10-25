import type {
  AiState,
  DecisionSource,
  PrintPartner,
  Priority,
  ProductionStage,
  Role,
  TicketCategory,
  TicketStatus,
} from "@bookleaf/shared";

// JSON shapes returned by the API (dates arrive as ISO strings). See docs/04-api.md.

export interface ApiData<T, M = { count: number }> {
  data: T;
  meta?: M;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  authorProfile?: {
    externalId: string;
    phone: string | null;
    city: string | null;
    joinedDate: string | null;
  };
}

export interface Book {
  id: string;
  externalId: string;
  authorId: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  stage: ProductionStage;
  mrp: number | null;
  royaltyPerCopy: number | null;
  copiesSold: number;
  royalty: { earned: number; paid: number; pending: number };
  lastRoyaltyPayoutDate: string | null;
  printPartner: PrintPartner | null;
  availableOn: string[];
}

export interface AuthorSummary {
  id: string;
  name: string;
  email: string;
  authorProfile: NonNullable<AuthUser["authorProfile"]>;
  stats: {
    books: number;
    published: number;
    inProduction: number;
    copiesSold: number;
    royaltyEarned: number;
    royaltyPaid: number;
    royaltyPending: number;
  };
}

/** A support teammate, as listed by GET /admins (the assignee picker). */
export interface AdminSummary {
  id: string;
  name: string;
}

// ── Tickets ──────────────────────────────────────────────────────────────────

export interface ListMeta {
  count: number;
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Attachment {
  name: string;
  size: number;
  mimeType: string;
}

export interface AuthorTicket {
  id: string;
  ticketNumber: string;
  book: { id: string; externalId: string; title: string } | null;
  subject: string;
  description: string;
  attachments: Attachment[];
  status: TicketStatus;
  category: TicketCategory | null;
  lastReplyRole: Role | null;
  lastActivityAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTicket extends AuthorTicket {
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
    classification: {
      category: TicketCategory;
      priority: Priority;
      reasoning: string;
      model: string;
      at: string;
    } | null;
    error: string | null;
    /** Admin detail view only: the cached AI draft, if one has been generated. */
    draft?: AiDraft | null;
  };
}

/** GET/POST /tickets/:id/ai-draft. `meta.cached` says whether the model was called. */
export interface AiDraft {
  body: string;
  model: string;
  generatedAt: string;
}

/** GET /auth/socket-token */
export interface SocketToken {
  token: string;
  url: string;
  expiresIn: number;
}

export interface TicketMessage {
  id: string;
  body: string;
  senderRole: Role;
  sender: { id: string; name: string };
  createdAt: string;
  aiAssisted?: boolean;
}

export interface TicketNote {
  id: string;
  body: string;
  admin: { id: string; name: string };
  createdAt: string;
}

export interface AuthorTicketDetail {
  ticket: AuthorTicket;
  messages: TicketMessage[];
}

export interface AdminTicketDetail {
  ticket: AdminTicket;
  messages: TicketMessage[];
  notes: TicketNote[];
  authorContext: { books: Book[]; activeTickets: number; totalTickets: number };
}

export interface TicketStats {
  byStatus: Record<TicketStatus, number>;
  activeByPriority: Record<Priority | "unscored", number>;
  activeUnassigned: number;
  activeStale: number;
  assignedToMe: number;
}
