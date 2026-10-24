import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TICKET_STATUSES, TICKET_STATUS_LABELS, type TicketStatus } from "@bookleaf/shared";
import { CategoryLabel, StatusBadge } from "@/components/badges";
import { ButtonLink, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { formatAge, formatDate } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthorTicket, ListMeta } from "@/lib/types";

export const metadata: Metadata = { title: "My Tickets · BookLeaf" };

export default function MyTicketsPage({ searchParams }: PageProps<"/author/tickets">) {
  return (
    <>
      <PageHeader
        title="My Tickets"
        description="Every support request you've raised with BookLeaf, and our replies."
        actions={<ButtonLink href="/author/tickets/new">New ticket</ButtonLink>}
      />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <TicketList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TicketList({ searchParams }: Pick<PageProps<"/author/tickets">, "searchParams">) {
  const raw = (await searchParams).status;
  const status = TICKET_STATUSES.includes(raw as TicketStatus) ? (raw as TicketStatus) : undefined;

  const query = new URLSearchParams({ limit: "50", ...(status && { status }) });
  const { data: tickets, meta } = await serverFetch<ApiData<AuthorTicket[], ListMeta>>(`/tickets?${query}`);

  return (
    <div className="space-y-4">
      <StatusTabs current={status} />
      {tickets.length === 0 ? (
        status ? (
          <EmptyState title={`No ${TICKET_STATUS_LABELS[status].toLowerCase()} tickets`} />
        ) : (
          <EmptyState
            title="You haven't raised any tickets yet"
            description="Questions about royalties, ISBNs, printing or your book's progress? Our team usually replies within one business day."
            action={<ButtonLink href="/author/tickets/new">Raise your first ticket</ButtonLink>}
          />
        )
      ) : (
        <Card className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <Link key={t.id} href={`/author/tickets/${t.id}`} className="block px-4 py-3 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.ticketNumber} · {t.book?.title ?? "General / Account Level"} · <CategoryLabel category={t.category} />
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={t.status} />
                  {t.lastReplyRole === "admin" && t.status !== "closed" && (
                    <span className="text-xs font-medium text-emerald-700">BookLeaf replied</span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Raised {formatDate(t.createdAt)} · last update {formatAge(t.lastActivityAt)} ago
              </p>
            </Link>
          ))}
        </Card>
      )}
      {meta && meta.total > tickets.length && (
        <p className="text-xs text-slate-500">
          Showing your {tickets.length} most relevant tickets of {meta.total}.
        </p>
      )}
    </div>
  );
}

function StatusTabs({ current }: { current?: TicketStatus }) {
  const tabs: { label: string; status?: TicketStatus }[] = [
    { label: "All" },
    ...TICKET_STATUSES.map((s) => ({ label: TICKET_STATUS_LABELS[s], status: s })),
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.status === current;
        return (
          <Link
            key={tab.label}
            href={tab.status ? `/author/tickets?status=${tab.status}` : "/author/tickets"}
            className={`rounded-full px-3 py-1 text-sm ${
              active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
