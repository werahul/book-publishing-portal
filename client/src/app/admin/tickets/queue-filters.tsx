"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
} from "@bookleaf/shared";

/** The raw URL params the queue understands. Absent status = active (open + in progress). */
export interface QueueParams {
  status?: string;
  category?: string;
  priority?: string;
  assignee?: string;
  authorId?: string;
  from?: string;
  to?: string;
  q?: string;
  sort?: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Active (open + in progress)" },
  ...TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABELS[s] })),
  { value: "all", label: "All statuses" },
];

const SORT_OPTIONS = [
  { value: "", label: "Most urgent first" },
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
  { value: "updated", label: "Recently updated" },
  { value: "idle", label: "Longest without activity" },
];

const control =
  "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

/** Filters live in the URL so a filtered queue can be bookmarked or shared with a teammate. */
export function QueueFilters({ params, authorName }: { params: QueueParams; authorName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.q ?? "");

  function update(changes: Partial<QueueParams>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...changes })) {
      if (value) next.set(key, value);
    }
    // Any filter change starts again from page 1.
    startTransition(() => router.replace(next.size ? `${pathname}?${next}` : pathname));
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({ q: search.trim() || undefined });
  }

  const hasFilters = Object.entries(params).some(([k, v]) => v && k !== "sort");

  return (
    <div className={`space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-end gap-2">
        <Select label="Status" value={params.status ?? ""} options={STATUS_OPTIONS} onChange={(status) => update({ status })} />
        <Select
          label="Category"
          value={params.category ?? ""}
          options={[{ value: "", label: "All categories" }, ...TICKET_CATEGORIES.map((c) => ({ value: c, label: TICKET_CATEGORY_LABELS[c] }))]}
          onChange={(category) => update({ category })}
        />
        <Select
          label="Priority"
          value={params.priority ?? ""}
          options={[{ value: "", label: "All priorities" }, ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))]}
          onChange={(priority) => update({ priority })}
        />
        <Select
          label="Assignee"
          value={params.assignee ?? ""}
          options={[
            { value: "", label: "Anyone" },
            { value: "me", label: "Assigned to me" },
            { value: "unassigned", label: "Unassigned" },
          ]}
          onChange={(assignee) => update({ assignee })}
        />
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-500">Created from</span>
          <input type="date" value={params.from ?? ""} max={params.to} onChange={(e) => update({ from: e.target.value })} className={control} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-slate-500">to</span>
          <input type="date" value={params.to ?? ""} min={params.from} onChange={(e) => update({ to: e.target.value })} className={control} />
        </label>
        <Select label="Sort" value={params.sort ?? ""} options={SORT_OPTIONS} onChange={(sort) => update({ sort })} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="flex flex-1 gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, description or ticket number (e.g. BL-1002)"
            className={`${control} min-w-0 flex-1`}
          />
          <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Search
          </button>
        </form>
        {authorName && (
          <span className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
            Author: {authorName}
            <button type="button" aria-label="Clear author filter" onClick={() => update({ authorId: undefined })} className="ml-1 text-slate-300 hover:text-white">
              ✕
            </button>
          </span>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              startTransition(() => router.replace(pathname));
            }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={control}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
