import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TICKET_STATUSES, TICKET_STATUS_LABELS, type TicketStatus } from "@bookleaf/shared";
import { CategoryLabel, ReplyNudge, StatusBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { LiveUpdates } from "@/components/live-updates";
import { ButtonLink, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { formatAge, formatDate } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthorTicket, ListMeta } from "@/lib/types";

export const metadata: Metadata = { title: "My Tickets · BookLeaf" };

export default function MyTicketsPage({ searchParams }: PageProps<"/author/tickets">) {
  return (
    <>
      <LiveUpdates />
      <PageHeader
        eyebrow="Support"
        title="My Tickets"
        description="Every support request you've raised with BookLeaf, and our replies."
        actions={
          <ButtonLink href="/author/tickets/new" icon="plus">
            New ticket
          </ButtonLink>
        }
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
          <EmptyState icon="ticket" title={`No ${TICKET_STATUS_LABELS[status].toLowerCase()} tickets`} />
        ) : (
          <EmptyState
            icon="message"
            title="You haven't raised any tickets yet"
            description="Questions about royalties, ISBNs, printing or your book's progress? Our team usually replies within one business day."
            action={
              <ButtonLink href="/author/tickets/new" icon="plus">
                Raise your first ticket
              </ButtonLink>
            }
          />
        )
      ) : (
        <Card className="animate-rise divide-y divide-stone-100 overflow-hidden">
          {tickets.map((t) => {
            const replied = t.lastReplyRole === "admin" && t.status !== "closed";
            return (
              <Link
                key={t.id}
                href={`/author/tickets/${t.id}`}
                className={`group block border-l-[3px] px-5 py-4 transition hover:bg-leaf-50/50 ${replied ? "border-l-leaf-500" : "border-l-transparent"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-900 group-hover:text-leaf-800">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      <span className="font-mono">{t.ticketNumber}</span> · {t.book?.title ?? "General / Account Level"} ·{" "}
                      <CategoryLabel category={t.category} />
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={t.status} />
                    {replied && <ReplyNudge>BookLeaf replied</ReplyNudge>}
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
                  <Icon name="clock" className="size-3.5" />
                  Raised {formatDate(t.createdAt)} · last update {formatAge(t.lastActivityAt)} ago
                </p>
              </Link>
            );
          })}
        </Card>
      )}
      {meta && meta.total > tickets.length && (
        <p className="text-xs text-stone-500">
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
    <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-white/70 p-1 shadow-soft ring-1 ring-stone-200/80">
      {tabs.map((tab) => {
        const active = tab.status === current;
        return (
          <Link
            key={tab.label}
            href={tab.status ? `/author/tickets?status=${tab.status}` : "/author/tickets"}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1 text-sm font-medium transition ${
              active ? "bg-leaf-700 text-white shadow-sm" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
