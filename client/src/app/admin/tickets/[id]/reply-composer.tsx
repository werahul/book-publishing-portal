"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { TICKET_STATUS_LABELS, createMessageSchema, type TicketStatus } from "@bookleaf/shared";
import { ApiError, apiFetch } from "@/lib/api";

type AfterSend = "" | Extract<TicketStatus, "resolved" | "closed">;

/**
 * The agent's reply box. Sending posts a public message (the author sees it);
 * optionally resolves the ticket in the same action.
 * The AI-drafted reply will pre-fill this editor in the AI phase.
 */
export function ReplyComposer({ ticketId, authorFirstName, status }: { ticketId: string; authorFirstName: string; status: TicketStatus }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [after, setAfter] = useState<AfterSend>("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  if (status === "closed") {
    return <p className="text-sm text-slate-500">This ticket is closed. Reopen it (set the status to In Progress) to reply.</p>;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createMessageSchema.safeParse({ body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Write a reply first");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await apiFetch(`/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: parsed.data.body, aiAssisted: false }),
      });
      if (after) await apiFetch(`/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ status: after }) });
      setBody("");
      setAfter("");
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const busy = sending || refreshing;
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor="admin-reply" className="text-sm font-medium text-slate-700">
          Reply to {authorFirstName}
        </label>
        <span className="text-xs text-slate-400">Visible to the author</span>
      </div>
      <textarea
        id="admin-reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        maxLength={10000}
        placeholder={`Hi ${authorFirstName},\n\n`}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          and
          <select
            value={after}
            onChange={(e) => setAfter(e.target.value as AfterSend)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">keep status{status === "open" ? " (moves to In Progress)" : ""}</option>
            <option value="resolved">mark {TICKET_STATUS_LABELS.resolved}</option>
            <option value="closed">mark {TICKET_STATUS_LABELS.closed}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send reply"}
        </button>
      </div>
    </form>
  );
}
