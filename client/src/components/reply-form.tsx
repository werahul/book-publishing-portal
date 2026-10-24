"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createMessageSchema } from "@bookleaf/shared";
import { ApiError, apiFetch } from "@/lib/api";

/** Author follow-up box on their own ticket. */
export function ReplyForm({ ticketId, hint }: { ticketId: string; hint?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createMessageSchema.safeParse({ body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please write a message");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await apiFetch(`/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ body: parsed.data.body }) });
      setBody("");
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const busy = sending || refreshing;
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="reply" className="block text-sm font-medium text-slate-700">
        Add a reply
      </label>
      <textarea
        id="reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={10000}
        placeholder="Share more details or answer our questions…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{hint}</p>
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
