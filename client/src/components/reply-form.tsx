"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createMessageSchema } from "@bookleaf/shared";
import { ApiError, apiFetch } from "@/lib/api";
import { Icon } from "./icons";

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
      <label htmlFor="reply" className="flex items-center gap-2 font-display text-lg font-semibold text-stone-900">
        <Icon name="message" className="size-5 text-leaf-600" />
        Add a reply
      </label>
      <textarea
        id="reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={10000}
        placeholder="Share more details or answer our questions…"
        className="field leading-relaxed"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-stone-500">{hint}</p>
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
        >
          {busy ? "Sending…" : "Send reply"}
          {!busy && <Icon name="arrowRight" className="size-4" />}
        </button>
      </div>
    </form>
  );
}
