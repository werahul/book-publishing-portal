import type { Request, Response } from 'express';
import type { ListBooksQuery } from '@bookleaf/shared';
import { currentUser } from '../../middleware/auth';
import * as bookService from './book.service';

export async function list(req: Request, res: Response) {
  const books = await bookService.listBooks(currentUser(req), req.query as ListBooksQuery);
  res.json({ data: books, meta: { count: books.length } });
}

export async function getById(req: Request<{ id: string }>, res: Response) {
  const book = await bookService.getBook(currentUser(req), req.params.id);
  res.json({ data: book });
}
