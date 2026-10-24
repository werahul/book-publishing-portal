import {
  PRODUCTION_STAGES,
  ROYALTY_PAYOUT_THRESHOLD_INR,
  isBelowPayoutThreshold,
  nextPayoutWindow,
  type ProductionStage,
} from "@bookleaf/shared";
import { formatDate, formatINR } from "./format";
import type { Book } from "./types";

export interface RoyaltySummary {
  books: number;
  published: number;
  inProduction: number;
  copiesSold: number;
  earned: number;
  paid: number;
  pending: number;
}

export function summarise(books: Book[]): RoyaltySummary {
  return books.reduce<RoyaltySummary>(
    (acc, b) => ({
      books: acc.books + 1,
      published: acc.published + (b.stage === "published_live" ? 1 : 0),
      inProduction: acc.inProduction + (b.stage === "published_live" ? 0 : 1),
      copiesSold: acc.copiesSold + b.copiesSold,
      earned: acc.earned + b.royalty.earned,
      paid: acc.paid + b.royalty.paid,
      pending: acc.pending + b.royalty.pending,
    }),
    { books: 0, published: 0, inProduction: 0, copiesSold: 0, earned: 0, paid: 0, pending: 0 },
  );
}

/**
 * Plain-language explanation of an author's pending royalties, following the
 * BookLeaf Royalty Policy (quarterly, paid within 45 days, ₹1,000 minimum).
 * The threshold applies to the account's accumulated total, not per book.
 */
export function explainPending(totalPending: number, today = new Date()): string {
  if (totalPending === 0) return "You're all caught up — every royalty earned so far has been paid.";
  const { quarterEnd, payoutBy } = nextPayoutWindow(today);
  if (isBelowPayoutThreshold(totalPending)) {
    return `${formatINR(totalPending)} is below the ${formatINR(ROYALTY_PAYOUT_THRESHOLD_INR)} minimum payout, so it rolls over to the next quarter and is paid once your total crosses ${formatINR(ROYALTY_PAYOUT_THRESHOLD_INR)}.`;
  }
  return `Royalties up to ${formatDate(quarterEnd)} are paid by bank transfer by ${formatDate(payoutBy)}.`;
}

/** Short per-book payout status for the My Books page. */
export function bookPayoutStatus(book: Book): { label: string; tone: "ok" | "info" | "muted" } {
  if (book.stage !== "published_live") return { label: "Not yet on sale", tone: "muted" };
  if (book.royalty.earned === 0) return { label: "No sales yet", tone: "muted" };
  if (book.royalty.pending === 0) return { label: "All paid", tone: "ok" };
  if (book.royalty.paid === 0) return { label: "No payout yet", tone: "info" };
  return { label: "Payout pending", tone: "info" };
}

/** 1-based position in the production pipeline, e.g. Cover Design → 3 of 9. */
export function stageProgress(stage: ProductionStage): { step: number; total: number } {
  return { step: PRODUCTION_STAGES.indexOf(stage) + 1, total: PRODUCTION_STAGES.length };
}
