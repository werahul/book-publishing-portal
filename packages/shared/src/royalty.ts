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
