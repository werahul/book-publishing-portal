/**
 * Helpers for putting untrusted author text into prompts.
 * Author text is always wrapped in <ticket>…</ticket>; neutralising our own delimiter
 * tags stops a ticket from "closing" its block and smuggling in instructions.
 */

const DELIMITER_TAGS = /<\s*\/?\s*(ticket|kb|facts|message)\b[^>]*>/gi;

export function sanitizeForPrompt(text: string): string {
  return text.replace(DELIMITER_TAGS, '[tag removed]').trim();
}

/** Cut to `max` characters on a word boundary where possible. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd()} …[truncated]`;
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
