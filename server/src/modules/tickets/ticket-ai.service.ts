import { PRIORITY_RANK, SOCKET_EVENTS, type ProductionStage, type TicketCategory } from '@bookleaf/shared';
import { Errors } from '../../lib/app-error';
import { logger } from '../../lib/logger';
import { emitTicketEvent } from '../../realtime/realtime';
import { AiError, describeAiFailure } from '../ai/ai.provider';
import { classifyWithAi } from '../ai/classify';
import { draftReply, MAX_MESSAGES, type DraftContext } from '../ai/draft';
import { Book, type BookRecord } from '../books/book.model';
import { User } from '../users/user.model';
import { Message } from './message.model';
import { Ticket, type TicketRecord } from './ticket.model';

/**
 * Persistence around the AI module: applying classifications and caching drafts.
 * The prompts themselves live in modules/ai and never touch the database.
 */

// ── Classification ───────────────────────────────────────────────────────────

export type ClassificationOutcome = { ok: true } | { ok: false; error: string };

/**
 * Runs the LLM classifier and applies its verdict. Never throws for AI failures:
 * the keyword triage stays in place and the ticket is marked `ai.state = 'failed'`.
 */
export async function runClassification(ticketId: string): Promise<ClassificationOutcome> {
  const ticket = await Ticket.findById(ticketId)
    .populate<{ book: { title: string; stage: ProductionStage } | null }>('book', 'title stage')
    .lean();
  if (!ticket) return { ok: false, error: 'Ticket not found' };

  let outcome: ClassificationOutcome;
  try {
    const result = await classifyWithAi({
      subject: ticket.subject,
      description: ticket.description,
      book: ticket.book ? { title: ticket.book.title, stage: ticket.book.stage } : null,
    });

    // The raw verdict is always recorded, even when an admin decision outranks it.
    await Ticket.updateOne(
      { _id: ticket._id },
      { $set: { 'ai.state': 'done', 'ai.error': null, 'ai.classification': { ...result, at: new Date() } } },
    );
    // Conditional writes: an admin override (even one made while the model was thinking) always wins.
    await Ticket.updateOne(
      { _id: ticket._id, categorySource: { $ne: 'admin' } },
      { $set: { category: result.category, categorySource: 'ai' } },
    );
    await Ticket.updateOne(
      { _id: ticket._id, prioritySource: { $ne: 'admin' } },
      { $set: { priority: result.priority, priorityRank: PRIORITY_RANK[result.priority], prioritySource: 'ai' } },
    );
    outcome = { ok: true };
  } catch (err) {
    if (!(err instanceof AiError)) logger.error(`[ai] classification crashed for ${ticket.ticketNumber}`, err);
    else logger.warn(`[ai] classification failed for ${ticket.ticketNumber}: ${err.message}`);
    const error = describeAiFailure(err);
    await Ticket.updateOne({ _id: ticket._id }, { $set: { 'ai.state': 'failed', 'ai.error': error } });
    outcome = { ok: false, error };
  }

  emitTicketEvent(SOCKET_EVENTS.ticketUpdated, ticket);
  return outcome;
}

// ── Drafts ───────────────────────────────────────────────────────────────────

export interface DraftDto {
  body: string;
  model: string;
  generatedAt: Date;
}

/**
 * Cache misses being generated right now, per ticket. Concurrent opens of the same
 * ticket (two admins, or a double-mounted component) share one model call.
 * In-process only, which is fine for a single API instance.
 */
const inFlight = new Map<string, Promise<DraftDto>>();

/** The cached draft, generating (and caching) one on a miss. */
export async function getDraft(ticketId: string): Promise<{ draft: DraftDto; cached: boolean }> {
  const ticket = await Ticket.findById(ticketId).lean<TicketRecord>();
  if (!ticket) throw Errors.notFound('Ticket');

  const cached = ticket.ai?.draft;
  if (cached) return { draft: { body: cached.body, model: cached.model, generatedAt: cached.generatedAt }, cached: true };

  let pending = inFlight.get(ticketId);
  if (!pending) {
    pending = generateAndCache(ticket).finally(() => inFlight.delete(ticketId));
    inFlight.set(ticketId, pending);
  }
  return { draft: await pending, cached: false };
}

/** Explicit admin request: always calls the model and replaces the cache. */
export async function regenerateDraft(ticketId: string): Promise<DraftDto> {
  const ticket = await Ticket.findById(ticketId).lean<TicketRecord>();
  if (!ticket) throw Errors.notFound('Ticket');
  return generateAndCache(ticket);
}

async function generateAndCache(ticket: TicketRecord): Promise<DraftDto> {
  if (ticket.status === 'closed') {
    throw Errors.ticketClosed('This ticket is closed. Reopen it before drafting a reply.');
  }

  let result: { body: string; model: string };
  try {
    result = await draftReply(await loadDraftContext(ticket));
  } catch (err) {
    if (!(err instanceof AiError)) throw err; // a bug, not an outage: let the error handler log it
    logger.warn(`[ai] draft failed for ${ticket.ticketNumber}: ${err.message}`);
    throw Errors.aiUnavailable(`${describeAiFailure(err)}. You can still write a reply manually.`);
  }

  const draft: DraftDto = { ...result, generatedAt: new Date() };
  // Only cache if the ticket hasn't moved on meanwhile (e.g. the author replied mid-generation);
  // otherwise the next request should draft against the newer thread.
  await Ticket.updateOne({ _id: ticket._id, lastActivityAt: ticket.lastActivityAt }, { $set: { 'ai.draft': draft } });
  return draft;
}

/** Only what the prompt needs: this ticket's book, the author's name and the latest few messages. */
async function loadDraftContext(ticket: TicketRecord): Promise<DraftContext> {
  const [author, book, recent] = await Promise.all([
    User.findById(ticket.author).select('name').lean(),
    ticket.book ? Book.findById(ticket.book).lean<BookRecord>() : null,
    Message.find({ ticket: ticket._id })
      .sort({ createdAt: -1 })
      .limit(MAX_MESSAGES)
      .select('senderRole body createdAt')
      .lean(),
  ]);

  return {
    today: new Date(),
    authorName: author?.name ?? 'there',
    ticket: {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      category: (ticket.category as TicketCategory | null) ?? null,
      status: ticket.status,
      createdAt: ticket.createdAt,
    },
    book: book
      ? {
          externalId: book.externalId,
          title: book.title,
          isbn: book.isbn,
          stage: book.stage,
          publicationDate: book.publicationDate ?? null,
          mrp: book.mrp ?? null,
          royaltyPerCopy: book.royaltyPerCopy ?? null,
          copiesSold: book.copiesSold,
          royalty: {
            earned: book.royalty?.earned ?? 0,
            paid: book.royalty?.paid ?? 0,
            pending: book.royalty?.pending ?? 0,
          },
          lastRoyaltyPayoutDate: book.lastRoyaltyPayoutDate ?? null,
          printPartner: book.printPartner ?? null,
          availableOn: book.availableOn,
        }
      : null,
    messages: recent.reverse().map((m) => ({ senderRole: m.senderRole, body: m.body, createdAt: m.createdAt })),
  };
}
