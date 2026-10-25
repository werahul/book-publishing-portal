import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS, type TicketEventPayload } from "@bookleaf/shared";
import { apiFetch } from "./api";
import type { ApiData, SocketToken } from "./types";

/**
 * Browser-side Socket.IO connection, shared by every subscriber in the tab.
 *
 * The Next.js rewrite can't proxy WebSockets, so the socket goes straight to the
 * API. The session cookie is httpOnly, so we trade it (same-origin) for a 60-second
 * handshake token; the server also tells us where to connect, which keeps the
 * API URL out of NEXT_PUBLIC_ env vars.
 */

let socketPromise: Promise<Socket> | null = null;

const fetchToken = () => apiFetch<ApiData<SocketToken>>("/auth/socket-token").then((res) => res.data);

function getSocket(): Promise<Socket> {
  socketPromise ??= fetchToken()
    .then(({ url, token }) => {
      let firstToken: string | null = token;
      return io(url, {
        // Runs on every (re)connect attempt. Tokens expire quickly, so reconnects fetch a fresh one.
        auth: (cb) => {
          if (firstToken) {
            cb({ token: firstToken });
            firstToken = null;
            return;
          }
          fetchToken().then(
            (fresh) => cb({ token: fresh.token }),
            () => cb({}),
          );
        },
        reconnectionDelayMax: 10_000,
      });
    })
    .catch((err: unknown) => {
      socketPromise = null; // let the next subscriber retry
      throw err;
    });
  return socketPromise;
}

/** Close the shared connection, e.g. on logout, so the next user doesn't inherit its rooms. */
export function disconnectRealtime(): void {
  const pending = socketPromise;
  socketPromise = null;
  void pending?.then(
    (socket) => socket.disconnect(),
    () => undefined,
  );
}

/**
 * Listen for ticket events. `onConnectionChange` reports socket health so the
 * caller can fall back to polling. Returns an unsubscribe function.
 */
export function subscribeToTickets(
  listener: (payload: TicketEventPayload) => void,
  onConnectionChange: (connected: boolean) => void,
): () => void {
  let socket: Socket | null = null;
  let active = true;
  const onUp = () => onConnectionChange(true);
  const onDown = () => onConnectionChange(false);

  getSocket().then(
    (s) => {
      if (!active) return;
      socket = s;
      s.on(SOCKET_EVENTS.ticketUpdated, listener);
      s.on(SOCKET_EVENTS.ticketMessage, listener);
      s.on("connect", onUp);
      s.on("disconnect", onDown);
      s.on("connect_error", onDown);
      onConnectionChange(s.connected);
    },
    () => onConnectionChange(false),
  );

  return () => {
    active = false;
    socket?.off(SOCKET_EVENTS.ticketUpdated, listener);
    socket?.off(SOCKET_EVENTS.ticketMessage, listener);
    socket?.off("connect", onUp);
    socket?.off("disconnect", onDown);
    socket?.off("connect_error", onDown);
  };
}
