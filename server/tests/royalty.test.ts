import { isBelowPayoutThreshold, nextPayoutWindow, payoutStatus } from '@bookleaf/shared';

const day = (iso: string) => iso.slice(0, 10);

describe('nextPayoutWindow (quarterly, paid within 45 days)', () => {
  it.each([
    ['2026-10-24', '2026-09-30', '2026-11-14'],
    ['2026-11-14', '2026-09-30', '2026-11-14'], // last day of the window still counts
    ['2026-11-15', '2026-12-31', '2027-02-14'],
    ['2026-02-15', '2026-03-31', '2026-05-15'],
  ])('on %s → quarter ending %s, paid by %s', (today, quarterEnd, payoutBy) => {
    const window = nextPayoutWindow(new Date(`${today}T10:00:00Z`));
    expect(day(window.quarterEnd.toISOString())).toBe(quarterEnd);
    expect(day(window.payoutBy.toISOString())).toBe(payoutBy);
  });
});

describe('isBelowPayoutThreshold (₹1,000)', () => {
  it.each([
    [0, false],
    [850, true],
    [999, true],
    [1000, false],
  ])('%i → %s', (pending, expected) => {
    expect(isBelowPayoutThreshold(pending)).toBe(expected);
  });
});

describe('payoutStatus (is BookLeaf behind on a payout?)', () => {
  const on = (iso: string) => new Date(`${iso}T10:00:00Z`);
  const TODAY = on('2026-10-24'); // last closed window: quarter ending 2026-06-30, due 2026-08-14

  it('flags a payable balance with no payout since before the last closed window', () => {
    const status = payoutStatus(3570, on('2025-10-15'), on('2023-06-20'), TODAY);
    expect(status.overdue).toBe(true);
    expect(day(status.missed!.quarterEnd.toISOString())).toBe('2026-06-30');
    expect(day(status.missed!.payoutBy.toISOString())).toBe('2026-08-14');
  });

  it.each([
    ['below the ₹1,000 threshold (rolls over)', 850, '2025-10-15', '2023-06-20'],
    ['paid after the last closed quarter ended', 3570, '2026-08-01', '2023-06-20'],
    ['never paid, but only published this quarter', 3570, null, '2026-08-10'],
  ])('is not overdue when %s', (_label, pending, lastPaid, published) => {
    expect(payoutStatus(pending, lastPaid ? on(lastPaid) : null, on(published), TODAY).overdue).toBe(false);
  });

  it('treats a never-paid book live before the last closed quarter as overdue', () => {
    expect(payoutStatus(1200, null, on('2026-01-15'), TODAY).overdue).toBe(true);
  });
});
