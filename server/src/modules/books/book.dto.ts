import type { ProductionStage, PrintPartner } from '@bookleaf/shared';
import type { BookRecord } from './book.model';

export interface BookDto {
  id: string;
  externalId: string;
  authorId: string;
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

export function toBookDto(book: BookRecord): BookDto {
  return {
    id: String(book._id),
    externalId: book.externalId,
    authorId: String(book.author),
    title: book.title,
    isbn: book.isbn,
    genre: book.genre,
    publicationDate: book.publicationDate ?? null,
    stage: book.stage,
    mrp: book.mrp ?? null,
    royaltyPerCopy: book.royaltyPerCopy ?? null,
    copiesSold: book.copiesSold,
    royalty: {
      earned: book.royalty?.earned ?? 0,
      paid: book.royalty?.paid ?? 0,
      pending: book.royalty?.pending ?? 0,
    },
    lastRoyaltyPayoutDate: book.lastRoyaltyPayoutDate ?? null,
    printPartner: (book.printPartner as PrintPartner | null | undefined) ?? null,
    availableOn: [...book.availableOn],
  };
}
