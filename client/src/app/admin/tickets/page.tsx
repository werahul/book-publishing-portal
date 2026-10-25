import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CategoryLabel, PriorityBadge, ReplyNudge, SourceBadge, StatusBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { LiveUpdates } from "@/components/live-updates";
import { Avatar, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { formatAge } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { AdminTicket, ApiData, AuthorSummary, ListMeta } from "@/lib/types";
import { QueueFilters, type QueueParams } from "./queue-filters";

export const metadata: Metadata = { title: "Ticket queue · BookLeaf Support" };

const PARAM_KEYS = ["status", "category", "priority", "assignee", "authorId", "from", "to", "q", "sort"] as const;

export default function QueuePage({ searchParams }: PageProps<"/admin/tickets">) {
  return (
    <>
      <LiveUpdates />
      <PageHeader
        eyebrow="Support Console"
        title="Ticket queue"
        description="Most urgent first, then oldest, so nothing important sits waiting."
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
        <EmptyState icon="search" title="No tickets match these filters" description="Try widening the status or date range." />
      ) : (
        <Card className="animate-rise overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50/80 text-left text-xs tracking-wider text-stone-500 uppercase">
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
            <tbody className="divide-y divide-stone-100">
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
  const rowAccent =
    t.priority === "critical" && t.isActive
      ? "border-l-[3px] border-l-red-500 bg-red-50/30"
      : "border-l-[3px] border-l-transparent";

  return (
    <tr className={`group transition ${rowAccent} ${t.isActive ? "" : "text-stone-500 opacity-75"} hover:bg-leaf-50/40`}>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <PriorityBadge priority={t.priority} />
          <SourceBadge source={t.prioritySource} />
        </div>
      </td>
      <td className="max-w-md px-3 py-3">
        <Link href={href} className="flex items-center gap-3">
          <Avatar name={t.author.name} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-stone-900 group-hover:text-leaf-800">{t.subject}</span>
            <span className="block truncate text-xs text-stone-500">
              <span className="font-mono">{t.ticketNumber}</span> · {t.author.name}
              {t.book && <> · {t.book.title}</>}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-3 text-xs">
        <div className="flex items-center gap-1">
          <CategoryLabel category={t.category} />
          <SourceBadge source={t.categorySource} />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={t.status} />
          {awaitingUs && <ReplyNudge tone="sky">Awaiting our reply</ReplyNudge>}
        </div>
      </td>
      <td className="px-3 py-3 text-xs">
        {t.assignee ? (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Avatar name={t.assignee.name} size="sm" />
            {t.assignee.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-amber-700">
            <Icon name="userPlus" className="size-3.5" />
            Unassigned
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right text-xs tabular-nums">{formatAge(t.createdAt)}</td>
      <td className="px-3 py-3 text-right text-xs tabular-nums">
        {t.isStale ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium whitespace-nowrap text-red-700 ring-1 ring-red-200"
            title="No activity for over 48 hours"
          >
            <Icon name="flame" className="size-3" />
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
    <div className="flex items-center justify-between text-sm text-stone-600">
      <p className="tabular-nums">
        {from}–{to} of {meta.total} tickets
      </p>
      <div className="flex gap-2">
        {meta.page > 1 && (
          <Link href={link(meta.page - 1)} className="btn btn-secondary btn-sm">
            <Icon name="arrowLeft" className="size-3.5" />
            Previous
          </Link>
        )}
        {meta.page < meta.pages && (
          <Link href={link(meta.page + 1)} className="btn btn-secondary btn-sm">
            Next
            <Icon name="arrowRight" className="size-3.5" />
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
