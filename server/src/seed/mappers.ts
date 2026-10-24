import {
  PRODUCTION_STAGE_LABELS,
  PRODUCTION_STAGES,
  type PrintPartner,
  type ProductionStage,
} from '@bookleaf/shared';
import type { RawAuthor, RawBook } from './raw-schema';

// Pure functions: raw dataset (snake_case) → model-ready objects (camelCase).

const STAGE_BY_LABEL = new Map<string, ProductionStage>(
  PRODUCTION_STAGES.map((stage) => [PRODUCTION_STAGE_LABELS[stage].toLowerCase(), stage]),
);

/**
 * "Published & Live" → published_live, "In Production - Cover Design" → cover_design.
 * Unknown labels throw: guessing would silently mis-report a book's status to its author.
 */
export function mapStatusToStage(label: string): ProductionStage {
  const normalised = label
    .trim()
    .replace(/^in production\s*[-–—]\s*/i, '')
    .toLowerCase();
  const stage = STAGE_BY_LABEL.get(normalised);
  if (!stage) throw new Error(`Unknown book status "${label}"`);
  return stage;
}

/** Dataset dates are calendar dates; store them as UTC midnight. */
export function parseDate(value: string): Date;
export function parseDate(value: string | null): Date | null;
export function parseDate(value: string | null): Date | null {
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

export interface SeedAuthor {
  email: string;
  name: string;
  role: 'author';
  authorProfile: { externalId: string; phone: string; city: string; joinedDate: Date };
}

export interface SeedBook {
  externalId: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: Date | null;
  stage: ProductionStage;
  mrp: number | null;
  royaltyPerCopy: number | null;
  copiesSold: number;
  royalty: { earned: number; paid: number; pending: number };
  lastRoyaltyPayoutDate: Date | null;
  printPartner: PrintPartner | null;
  availableOn: string[];
}

export function mapAuthor(raw: RawAuthor): SeedAuthor {
  return {
    email: raw.email.trim().toLowerCase(),
    name: raw.name.trim(),
    role: 'author',
    authorProfile: {
      externalId: raw.author_id,
      phone: raw.phone,
      city: raw.city,
      joinedDate: parseDate(raw.joined_date),
    },
  };
}

export function mapBook(raw: RawBook): SeedBook {
  return {
    externalId: raw.book_id,
    title: raw.title,
    isbn: raw.isbn,
    genre: raw.genre,
    publicationDate: parseDate(raw.publication_date),
    stage: mapStatusToStage(raw.status),
    mrp: raw.mrp,
    royaltyPerCopy: raw.author_royalty_per_copy,
    copiesSold: raw.total_copies_sold,
    royalty: {
      earned: raw.total_royalty_earned,
      paid: raw.royalty_paid,
      pending: raw.royalty_pending,
    },
    lastRoyaltyPayoutDate: parseDate(raw.last_royalty_payout_date),
    printPartner: raw.print_partner,
    availableOn: raw.available_on,
  };
}

/** Data-quality checks. Reported as warnings, never fatal: the dataset is the source of truth. */
export function integrityWarnings(book: SeedBook): string[] {
  const warnings: string[] = [];
  const { earned, paid, pending } = book.royalty;

  if (earned !== paid + pending) {
    warnings.push(`${book.externalId}: earned (${earned}) ≠ paid (${paid}) + pending (${pending})`);
  }
  if (book.royaltyPerCopy !== null && earned !== book.copiesSold * book.royaltyPerCopy) {
    warnings.push(
      `${book.externalId}: earned (${earned}) ≠ copiesSold (${book.copiesSold}) × royaltyPerCopy (${book.royaltyPerCopy})`,
    );
  }
  if (book.stage !== 'published_live' && (book.copiesSold > 0 || earned > 0)) {
    warnings.push(`${book.externalId}: in production (${book.stage}) but has sales/royalties`);
  }
  return warnings;
}
