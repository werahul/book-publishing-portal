"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type UpdateTicketInput,
} from "@bookleaf/shared";
import { SourceBadge } from "@/components/badges";
import { ApiError, apiFetch } from "@/lib/api";
import type { AdminTicket } from "@/lib/types";

const control =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:opacity-60";

/** Status, triage overrides and assignment. Each change is saved immediately. */
export function TicketActions({ ticket, currentAdminId }: { ticket: AdminTicket; currentAdminId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState<keyof UpdateTicketInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startRefresh] = useTransition();

  async function save(patch: UpdateTicketInput) {
    setSaving(Object.keys(patch)[0] as keyof UpdateTicketInput);
    setError(null);
    try {
      await apiFetch(`/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the change.");
    } finally {
      setSaving(null);
    }
  }

  const assignedToMe = ticket.assignee?.id === currentAdminId;

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-red-50 px-2 py-1 text-sm text-red-700">{error}</p>}

      <Row label="Status">
        <select
          value={ticket.status}
          disabled={saving !== null}
          onChange={(e) => save({ status: e.target.value as AdminTicket["status"] })}
          className={control}
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TICKET_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Category" badge={<SourceBadge source={ticket.categorySource} />}>
        <select
          value={ticket.category ?? ""}
          disabled={saving !== null}
          onChange={(e) => save({ category: e.target.value as NonNullable<AdminTicket["category"]> })}
          className={control}
        >
          {!ticket.category && <option value="">Not yet categorised</option>}
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TICKET_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Priority" badge={<SourceBadge source={ticket.prioritySource} />}>
        <select
          value={ticket.priority ?? ""}
          disabled={saving !== null}
          onChange={(e) => save({ priority: e.target.value as NonNullable<AdminTicket["priority"]> })}
          className={control}
        >
          {!ticket.priority && <option value="">Unscored</option>}
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Assignee">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm ${ticket.assignee ? "text-slate-900" : "text-amber-700"}`}>
            {ticket.assignee ? (assignedToMe ? `${ticket.assignee.name} (you)` : ticket.assignee.name) : "Unassigned"}
          </span>
          {assignedToMe ? (
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => save({ assigneeId: null })}
              className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-60"
            >
              Unassign
            </button>
          ) : (
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => save({ assigneeId: currentAdminId })}
              className="rounded-md bg-slate-900 px-2.5 py-1 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {ticket.assignee ? "Take over" : "Assign to me"}
            </button>
          )}
        </div>
      </Row>
    </div>
  );
}

function Row({ label, badge, children }: { label: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {label}
        {badge}
      </div>
      {children}
    </div>
  );
}
