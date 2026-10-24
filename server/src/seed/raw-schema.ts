import { z } from 'zod';
import { PRINT_PARTNERS } from '@bookleaf/shared';

/**
 * Strict schema of BookLeaf's sample JSON exactly as delivered (snake_case).
 * If the file ever deviates (new field, unexpected null, bad date) the seed
 * aborts with a precise message instead of writing partial data.
 */

const isoDate = z.iso.date(); // "YYYY-MM-DD"
const nonNegative = z.number().nonnegative();

export const rawBookSchema = z
  .object({
    book_id: z.string().regex(/^BK\d+$/),
    title: z.string().min(1),
    isbn: z.string().min(1),
    genre: z.string().min(1),
    publication_date: isoDate.nullable(),
    status: z.string().min(1),
    mrp: nonNegative.nullable(),
    author_royalty_per_copy: nonNegative.nullable(),
    total_copies_sold: z.number().int().nonnegative(),
    total_royalty_earned: nonNegative,
    royalty_paid: nonNegative,
    royalty_pending: nonNegative,
    last_royalty_payout_date: isoDate.nullable(),
    print_partner: z.enum(PRINT_PARTNERS).nullable(),
    available_on: z.array(z.string().min(1)),
  })
  .strict();

export const rawAuthorSchema = z
  .object({
    author_id: z.string().regex(/^AUTH\d+$/),
    name: z.string().min(1),
    email: z.email(),
    phone: z.string().min(1),
    city: z.string().min(1),
    joined_date: isoDate,
    books: z.array(rawBookSchema),
  })
  .strict();

export const rawDatasetSchema = z.object({ authors: z.array(rawAuthorSchema).min(1) }).strict();

export type RawBook = z.infer<typeof rawBookSchema>;
export type RawAuthor = z.infer<typeof rawAuthorSchema>;
export type RawDataset = z.infer<typeof rawDatasetSchema>;
