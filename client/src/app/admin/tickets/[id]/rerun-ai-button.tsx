"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ApiError, apiFetch } from "@/lib/api";

/** Re-runs AI classification for a ticket whose background pass failed or never finished. */
export function RerunAiButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();

  async function rerun() {
    setRunning(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${ticketId}/classify`, { method: "POST" });
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not re-run the AI.");
    } finally {
      setRunning(false);
    }
  }

  const busy = running || refreshing;
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={rerun}
        disabled={busy}
        className="btn btn-ai btn-sm"
      >
        <Icon name="sparkles" className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Classifying…" : "Re-run AI triage"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
