"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createNoteSchema } from "@bookleaf/shared";
import { ApiError, apiFetch } from "@/lib/api";

/** Internal note — never shown to the author. */
export function NoteForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createNoteSchema.safeParse({ body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Write a note first");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/tickets/${ticketId}/notes`, { method: "POST", body: JSON.stringify(parsed.data) });
      setBody("");
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        aria-label="Internal note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="Context for the team (not visible to the author)…"
        className="field border-amber-200 bg-white hover:border-amber-300 focus:border-amber-400 focus:ring-amber-400/20"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || refreshing}
          className="btn btn-sm bg-amber-100 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200"
        >
          {saving || refreshing ? "Saving…" : "Add internal note"}
        </button>
      </div>
    </form>
  );
}
