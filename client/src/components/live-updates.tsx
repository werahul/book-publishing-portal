"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { subscribeToTickets } from "@/lib/realtime";

/** Polling interval used only while the socket is down (or never connected). */
const POLL_MS = 15_000;
/** Bursts of events (e.g. reply + status change) collapse into one refresh. */
const DEBOUNCE_MS = 300;

/**
 * Keeps the current page fresh without a reload. Socket events trigger a
 * `router.refresh()`: server components re-fetch through the REST API, and
 * client state (e.g. a half-written reply) is preserved. Falls back to polling
 * when the socket can't connect.
 *
 * Pass `ticketId` on a ticket page to ignore events for other tickets.
 */
export function LiveUpdates({ ticketId }: { ticketId?: string }) {
  const router = useRouter();

  useEffect(() => {
    let connected = false;
    let lostConnection = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => startTransition(() => router.refresh()), DEBOUNCE_MS);
    };

    const unsubscribe = subscribeToTickets(
      (event) => {
        if (!ticketId || event.ticketId === ticketId) refresh();
      },
      (isConnected) => {
        // Back online after a gap: we may have missed events, so catch up once.
        if (isConnected && lostConnection) refresh();
        lostConnection = !isConnected;
        connected = isConnected;
      },
    );

    const poll = setInterval(() => {
      if (!connected && document.visibilityState === "visible") refresh();
    }, POLL_MS);

    return () => {
      unsubscribe();
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [router, ticketId]);

  return null;
}
