import { TICKET_CATEGORIES, type Priority, type TicketCategory } from '@bookleaf/shared';

/**
 * Deterministic keyword classifier. It gives every new ticket a sensible category
 * and priority instantly and without network calls, and it is the safety net when
 * the LLM is down, rate-limited or returns invalid output (source = "fallback").
 */

export interface Classification {
  category: TicketCategory;
  priority: Priority;
  reasoning: string;
}

const CATEGORY_SIGNALS: Record<Exclude<TicketCategory, 'general_inquiry'>, RegExp[]> = {
  royalty_payments: [
    /royalt/i,
    /payout/i,
    /\bpaid\b|\bpayment/i,
    /bank (account|details|transfer)/i,
    /earning/i,
    /₹\s?\d|\brs\.?\s?\d|\binr\b/i,
  ],
  isbn_metadata: [/\bisbn/i, /barcode/i, /imprint/i, /metadata/i, /wrong (book|title|author|cover) (is )?(linked|shown|listed)/i],
  printing_quality: [
    /print(ing)? quality/i,
    /misprint/i,
    /blurr?(y|ed)/i,
    /binding/i,
    /misalign/i,
    /defect/i,
    /author cop(y|ies)/i,
    /reprint/i,
    /(torn|missing|smudged|faded) pages?/i,
  ],
  distribution_availability: [
    /unavailable/i,
    /out of stock/i,
    /not (listed|showing|visible|available)/i,
    /\blisting/i,
    /(amazon|flipkart)(?!.*isbn)/i,
    /\bstock\b/i,
  ],
  book_status_production: [
    /typesetting/i,
    /proof ?read/i,
    /cover design/i,
    /\bproduction\b/i,
    /manuscript/i,
    /\bediting\b/i,
    /when will (my|the) book/i,
    /(status|progress) of my book/i,
  ],
};

const NOT_RECEIVED = /(not|never|haven'?t|hasn'?t|didn'?t|no)\b.{0,40}\b(receiv|paid|payment|royalt|credited)/i;
const LONG_WAIT = /\b([4-9]|1[0-2]|four|five|six|seven|eight|nine|ten|eleven|twelve|several|many)\s+months?\b/i;
const LEGAL_OR_FRAUD = /\b(legal|lawyer|lawsuit|fraud|scam|police|consumer (court|forum)|cheat(ed|ing)?)\b/i;
const URGENT = /\b(urgent|asap|immediately|emergency)\b/i;
const PRINT_DEFECT = /(defect|blurr?(y|ed)|misprint|misalign|binding|damaged|torn|smudged)/i;
const HOW_TO = /\b(can i|how (do|can) i|is it possible|could you (tell|explain)|update (my )?(bio|description|photo|author))\b/i;

export function classifyByKeywords(input: { subject: string; description: string }): Classification {
  // Normalise typographic apostrophes (phones and Word type "haven’t", not "haven't").
  const text = `${input.subject}\n${input.description}`.replace(/[‘’ʼ]/g, "'");

  // Category: the one with the most matching signals; ties resolve in TICKET_CATEGORIES order.
  let category: TicketCategory = 'general_inquiry';
  let best = 0;
  for (const candidate of TICKET_CATEGORIES) {
    if (candidate === 'general_inquiry') continue;
    const score = CATEGORY_SIGNALS[candidate].filter((rx) => rx.test(text)).length;
    if (score > best) {
      best = score;
      category = candidate;
    }
  }

  const { priority, why } = scorePriority(text, category);
  return {
    category,
    priority,
    reasoning: `Keyword fallback: ${best > 0 ? `${best} signal(s) for this category` : 'no category signals'}; ${why}.`,
  };
}

function scorePriority(text: string, category: TicketCategory): { priority: Priority; why: string } {
  if (LEGAL_OR_FRAUD.test(text)) return { priority: 'critical', why: 'legal/fraud language' };
  if (category === 'royalty_payments' && NOT_RECEIVED.test(text) && LONG_WAIT.test(text)) {
    return { priority: 'critical', why: 'royalty not received for several months' };
  }
  // KB policy: ISBN errors are always treated as high priority.
  if (category === 'isbn_metadata') return { priority: 'high', why: 'ISBN issues are high priority by policy' };
  if (category === 'printing_quality' && PRINT_DEFECT.test(text)) return { priority: 'high', why: 'reported print defect' };
  if (category === 'royalty_payments' && NOT_RECEIVED.test(text)) return { priority: 'high', why: 'royalty not received' };
  if (URGENT.test(text)) return { priority: 'high', why: 'author marked it urgent' };
  if (category === 'general_inquiry' && HOW_TO.test(text)) return { priority: 'low', why: 'how-to question' };
  return { priority: 'medium', why: 'default' };
}
