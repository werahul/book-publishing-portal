import { ROYALTY_PAYOUT_THRESHOLD_INR } from './constants';

/** Royalties are paid within this many days of a calendar quarter ending (BookLeaf Royalty Policy). */
export const PAYOUT_WINDOW_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PayoutWindow {
  /** Last day of the quarter the payout covers (UTC midnight). */
  quarterEnd: Date;
  /** Latest date the payout is due (quarter end + 45 days). */
  payoutBy: Date;
}

/**
 * The next payout the author can expect as of `today`: the earliest quarter whose
 * 45-day payment window hasn't passed yet.
 * e.g. 24 Oct 2026 → quarter ending 30 Sep 2026, paid by 14 Nov 2026.
 */
export function nextPayoutWindow(today: Date = new Date()): PayoutWindow {
  const year = today.getUTCFullYear();
  const startOfToday = Date.UTC(year, today.getUTCMonth(), today.getUTCDate());

  for (const y of [year - 1, year, year + 1]) {
    for (const month of [2, 5, 8, 11]) {
      // Day 0 of the following month = last day of this quarter's final month.
      const quarterEnd = new Date(Date.UTC(y, month + 1, 0));
      const payoutBy = new Date(quarterEnd.getTime() + PAYOUT_WINDOW_DAYS * DAY_MS);
      if (payoutBy.getTime() >= startOfToday) return { quarterEnd, payoutBy };
    }
  }
  throw new Error('unreachable: a payout window always exists within a year');
}

/** Accumulated royalties below the threshold roll over to the next quarter. */
export function isBelowPayoutThreshold(pendingInr: number): boolean {
  return pendingInr > 0 && pendingInr < ROYALTY_PAYOUT_THRESHOLD_INR;
}

export interface PayoutStatus {
  /** Pending is payable (≥ threshold) but the last payout window that has already closed was missed. */
  overdue: boolean;
  /** The missed window, when overdue. */
  missed: PayoutWindow | null;
}

/**
 * Whether BookLeaf appears to be behind on a book's royalties as of `today`.
 * The most recent window whose 45-day deadline has passed is the quarter before
 * `nextPayoutWindow(today)`; if pending is above the threshold and nothing has been
 * paid since that quarter ended (or ever, for a book live before it), that payout was missed.
 * e.g. on 24 Oct 2026, ₹3,570 pending and last paid 15 Oct 2025 → the quarter ending
 * 30 Jun 2026 (due 14 Aug 2026) was missed.
 */
export function payoutStatus(
  pendingInr: number,
  lastPayoutDate: Date | null,
  publicationDate: Date | null,
  today: Date = new Date(),
): PayoutStatus {
  const notOverdue: PayoutStatus = { overdue: false, missed: null };
  if (pendingInr < ROYALTY_PAYOUT_THRESHOLD_INR) return notOverdue;

  const next = nextPayoutWindow(today);
  // Day 0 of the month two before next.quarterEnd's month = last day of the previous quarter.
  const quarterEnd = new Date(Date.UTC(next.quarterEnd.getUTCFullYear(), next.quarterEnd.getUTCMonth() - 2, 0));
  const since = lastPayoutDate ?? publicationDate;
  if (!since || new Date(since).getTime() >= quarterEnd.getTime()) return notOverdue;

  return { overdue: true, missed: { quarterEnd, payoutBy: new Date(quarterEnd.getTime() + PAYOUT_WINDOW_DAYS * DAY_MS) } };
}
