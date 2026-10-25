import type { Server as HttpServer } from 'node:http';
import type { Types } from 'mongoose';
import { Server } from 'socket.io';
import type { Role, SocketEvent, TicketEventPayload } from '@bookleaf/shared';
import { env } from '../config/env';
import { verifySocketToken } from '../lib/jwt';
import { logger } from '../lib/logger';
import { User } from '../modules/users/user.model';

/**
 * Socket.IO push channel. Events are invalidation-only ({ ticketId, ticketNumber }):
 * clients re-fetch through the REST API, so access control and DTO whitelisting
 * live in exactly one place and nothing admin-only can leak over the socket.
 *
 * Rooms: `user:<id>` (each user's own tickets) and `admins` (the whole queue).
 */

export const ADMINS_ROOM = 'admins';
export const userRoom = (userId: string) => `user:${userId}`;

type ServerToClientEvents = Record<SocketEvent, (payload: TicketEventPayload) => void>;
type ClientToServerEvents = Record<string, never>;
interface SocketData {
  userId: string;
  role: Role;
}

let io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> | null = null;

export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    serveClient: false,
    // Auth is the handshake token, not cookies, so no credentials are needed cross-origin.
    cors: { origin: env.CLIENT_ORIGIN },
  });

  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    try {
      if (typeof token !== 'string' || !token) throw new Error('missing token');
      const { userId, role } = verifySocketToken(token);
      // Same rule as requireAuth: a deleted user's token stops working immediately.
      if (!(await User.exists({ _id: userId, role }))) throw new Error('unknown user');
      socket.data.userId = userId;
      socket.data.role = role;
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join(userRoom(socket.data.userId));
    if (socket.data.role === 'admin') void socket.join(ADMINS_ROOM);
  });

  logger.info('[realtime] Socket.IO attached');
  return io;
}

/** Disconnects every client and closes the underlying HTTP server. */
export async function closeRealtime(): Promise<void> {
  const server = io;
  io = null;
  if (server) await server.close();
}

interface TicketRef {
  _id: Types.ObjectId | string;
  ticketNumber: string;
  author: Types.ObjectId | string | { _id: Types.ObjectId };
}

/**
 * Tell the support team, and unless `adminsOnly` the ticket's author, that a ticket changed.
 * A no-op when Socket.IO isn't running (e.g. Supertest), so services can call it unconditionally.
 */
export function emitTicketEvent(event: SocketEvent, ticket: TicketRef, options: { adminsOnly?: boolean } = {}): void {
  if (!io) return;
  const authorId = String(typeof ticket.author === 'object' && '_id' in ticket.author ? ticket.author._id : ticket.author);
  const payload: TicketEventPayload = { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber };
  const rooms = options.adminsOnly ? [ADMINS_ROOM] : [ADMINS_ROOM, userRoom(authorId)];
  io.to(rooms).emit(event, payload);
}
