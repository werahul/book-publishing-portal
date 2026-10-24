import { classifyByKeywords } from '../src/modules/ai/fallback-classifier';

// The sample queries from the BookLeaf Knowledge Base, plus the brief's priority examples.
describe('classifyByKeywords', () => {
  it.each([
    [
      "I published my book 4 months ago and still haven't received any royalty. What's going on?",
      'royalty_payments',
      'critical',
    ],
    ['My royalty amount seems too low. I sold 200 copies but only received ₹3,000.', 'royalty_payments', 'medium'],
    ['My book is showing a different ISBN on Amazon than what’s on the physical copy.', 'isbn_metadata', 'high'],
    [
      'I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.',
      'printing_quality',
      'high',
    ],
    ['My book is published but it’s showing as “Currently Unavailable” on Amazon.', 'distribution_availability', 'medium'],
    ["It's been 3 weeks and my book is still in typesetting. When will it be done?", 'book_status_production', 'medium'],
    ['Can I update my author bio?', 'general_inquiry', 'low'],
  ])('%s → %s / %s', (description, category, priority) => {
    const result = classifyByKeywords({ subject: '', description });
    expect(result.category).toBe(category);
    expect(result.priority).toBe(priority);
    expect(result.reasoning).toMatch(/^Keyword fallback/);
  });

  it('ranks "no royalty for 6 months" above "update my bio"', () => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    const royalty = classifyByKeywords({ subject: '', description: "I haven't received any royalty for 6 months" });
    const bio = classifyByKeywords({ subject: '', description: 'Can I update my author bio?' });
    expect(rank[royalty.priority]).toBeGreaterThan(rank[bio.priority]);
  });

  it('escalates legal or fraud language to critical', () => {
    expect(classifyByKeywords({ subject: 'Fraud', description: 'I will contact my lawyer about this.' }).priority).toBe('critical');
  });
});
