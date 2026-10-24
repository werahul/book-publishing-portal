import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CategoryLabel, PriorityBadge, SourceBadge, StatusBadge } from "@/components/badges";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { formatAge } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { AdminTicket, ApiData, AuthorSummary, ListMeta } from "@/lib/types";
import { QueueFilters, type QueueParams } from "./queue-filters";

export const metadata: Metadata = { title: "Ticket queue · BookLeaf Support" };

const PARAM_KEYS = ["status", "category", "priority", "assignee", "authorId", "from", "to", "q", "sort"] as const;

export default function QueuePage({ searchParams }: PageProps<"/admin/tickets">) {
  return (
    <>
      <PageHeader
        title="Ticket queue"
        description="Unresolved tickets first, then by priority, then oldest — so nothing urgent waits."
      />
      <Suspense fallback={<Skeleton className="h-[28rem]" />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Queue({ searchParams }: Pick<PageProps<"/admin/tickets">, "searchParams">) {
  const raw = await searchParams;
  const params: QueueParams = {};
  for (const key of PARAM_KEYS) {
    const value = raw[key];
    if (typeof value === "string" && value) params[key] = value;
  }
  const page = Math.max(1, Number(raw.page) || 1);

  // Translate UI params into API params: no status = active queue; "all" = no filter.
  const api = new URLSearchParams({ limit: "20", page: String(page) });
  for (const [key, value] of Object.entries(params)) {
    if (key === "status") {
      if (value !== "all") api.set("status", value);
    } else {
      api.set(key, value);
    }
  }
  if (!params.status) api.set("status", "open,in_progress");

  const [{ data: tickets, meta }, authorName] = await Promise.all([
    serverFetch<ApiData<AdminTicket[], ListMeta>>(`/tickets?${api}`),
    params.authorId ? lookupAuthorName(params.authorId) : Promise.resolve(undefined),
  ]);

  return (
    <div className="space-y-4">
      <QueueFilters params={params} authorName={authorName} />

      {tickets.length === 0 ? (
        <EmptyState title="No tickets match these filters" description="Try widening the status or date range." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Ticket</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Assignee</th>
                <th className="px-3 py-2 text-right font-medium">Age</th>
                <th className="px-3 py-2 text-right font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <QueueRow key={t.id} ticket={t} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {meta && <Pagination meta={meta} params={params} />}
    </div>
  );
}

function QueueRow({ ticket: t }: { ticket: AdminTicket }) {
  const href = `/admin/tickets/${t.id}`;
  const awaitingUs = t.isActive && t.lastReplyRole !== "admin";
  const rowAccent = t.priority === "critical" && t.isActive ? "border-l-4 border-l-red-500" : "border-l-4 border-l-transparent";

  return (
    <tr className={`${rowAccent} ${t.isActive ? "" : "text-slate-500"} hover:bg-slate-50`}>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <PriorityBadge priority={t.priority} />
          <SourceBadge source={t.prioritySource} />
        </div>
      </td>
      <td className="max-w-md px-3 py-2.5">
        <Link href={href} className="block">
          <span className="block truncate font-medium text-slate-900 hover:text-emerald-700">{t.subject}</span>
          <span className="block text-xs text-slate-500">
            {t.ticketNumber} · {t.author.name}
            {t.book && <> · {t.book.title}</>}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2.5 text-xs">
        <div className="flex items-center gap-1">
          <CategoryLabel category={t.category} />
          <SourceBadge source={t.categorySource} />
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={t.status} />
          {awaitingUs && <span className="text-[11px] font-medium text-sky-700">Awaiting our reply</span>}
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs">{t.assignee?.name ?? <span className="text-amber-700">Unassigned</span>}</td>
      <td className="px-3 py-2.5 text-right text-xs tabular-nums">{formatAge(t.createdAt)}</td>
      <td className="px-3 py-2.5 text-right text-xs tabular-nums">
        {t.isStale ? (
          <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700" title="No activity for over 48 hours">
            {formatAge(t.lastActivityAt)} · stale
          </span>
        ) : (
          formatAge(t.lastActivityAt)
        )}
      </td>
    </tr>
  );
}

function Pagination({ meta, params }: { meta: ListMeta; params: QueueParams }) {
  const link = (page: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    if (page > 1) q.set("page", String(page));
    return `/admin/tickets${q.size ? `?${q}` : ""}`;
  };
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = (meta.page - 1) * meta.limit + meta.count;

  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <p>
        {from}–{to} of {meta.total} tickets
      </p>
      <div className="flex gap-2">
        {meta.page > 1 && (
          <Link href={link(meta.page - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50">
            ← Previous
          </Link>
        )}
        {meta.page < meta.pages && (
          <Link href={link(meta.page + 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1 hover:bg-slate-50">
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}

async function lookupAuthorName(authorId: string): Promise<string | undefined> {
  const { data } = await serverFetch<ApiData<AuthorSummary[]>>("/authors");
  return data.find((a) => a.id === authorId)?.name;
}
