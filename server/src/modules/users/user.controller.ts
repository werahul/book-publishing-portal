import type { Request, Response } from 'express';
import * as userService from './user.service';

export async function listAuthors(_req: Request, res: Response) {
  const authors = await userService.listAuthorsWithStats();
  res.json({ data: authors, meta: { count: authors.length } });
}

export async function listAdmins(_req: Request, res: Response) {
  const admins = await userService.listAdmins();
  res.json({ data: admins, meta: { count: admins.length } });
}
