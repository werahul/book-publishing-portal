import type { AuthorProfileDto } from '../../types/auth';
import { Book } from '../books/book.model';
import { User } from './user.model';

export interface AuthorSummaryDto {
  id: string;
  name: string;
  email: string;
  authorProfile: AuthorProfileDto;
  stats: {
    books: number;
    published: number;
    inProduction: number;
    copiesSold: number;
    royaltyEarned: number;
    royaltyPaid: number;
    royaltyPending: number;
  };
}

/** Every author with portfolio totals, aggregated in one round-trip. Admin-only (enforced by the route). */
export async function listAuthorsWithStats(): Promise<AuthorSummaryDto[]> {
  const rows = await User.aggregate<Omit<AuthorSummaryDto, 'id'> & { _id: unknown }>([
    { $match: { role: 'author' } },
    {
      $lookup: {
        from: Book.collection.name,
        localField: '_id',
        foreignField: 'author',
        as: 'books',
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        authorProfile: 1,
        stats: {
          books: { $size: '$books' },
          published: {
            $size: { $filter: { input: '$books', cond: { $eq: ['$$this.stage', 'published_live'] } } },
          },
          copiesSold: { $sum: '$books.copiesSold' },
          royaltyEarned: { $sum: '$books.royalty.earned' },
          royaltyPaid: { $sum: '$books.royalty.paid' },
          royaltyPending: { $sum: '$books.royalty.pending' },
        },
      },
    },
    { $addFields: { 'stats.inProduction': { $subtract: ['$stats.books', '$stats.published'] } } },
    { $sort: { name: 1 } },
  ]);

  return rows.map(({ _id, ...rest }) => ({ id: String(_id), ...rest }));
}
