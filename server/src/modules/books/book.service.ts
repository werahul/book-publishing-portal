import type { ListBooksQuery } from '@bookleaf/shared';
import { Errors } from '../../lib/app-error';
import { scopeByOwner } from '../../lib/access';
import type { AuthUser } from '../../types/auth';
import { Book, type BookRecord } from './book.model';
import { toBookDto, type BookDto } from './book.dto';

export async function listBooks(user: AuthUser, query: ListBooksQuery): Promise<BookDto[]> {
  const filter = {
    // Admin-only filter. Spread first so an author's ownership scope always overrides it.
    ...(query.authorId && { author: query.authorId }),
    ...scopeByOwner(user),
  };
  const books = await Book.find(filter).sort({ externalId: 1 }).lean<BookRecord[]>();
  return books.map(toBookDto);
}

/**
 * `idOrExternalId` is an ObjectId or a dataset id ("BK001").
 * A book owned by another author yields 404, never 403, so authors can't probe for ids.
 */
export async function getBook(user: AuthUser, idOrExternalId: string): Promise<BookDto> {
  // Strict 24-hex check: mongoose.isValidObjectId() also accepts any 12-char string.
  const idFilter = /^[a-f\d]{24}$/i.test(idOrExternalId)
    ? { _id: idOrExternalId }
    : { externalId: idOrExternalId.toUpperCase() };

  const book = await Book.findOne({ ...idFilter, ...scopeByOwner(user) }).lean<BookRecord>();
  if (!book) throw Errors.notFound('Book');
  return toBookDto(book);
}
