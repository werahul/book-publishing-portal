import { isBelowPayoutThreshold, nextPayoutWindow } from '@bookleaf/shared';

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
