import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/badges";
import { ButtonLink, Card, PageHeader, Skeleton, StatCard } from "@/components/ui";
import { formatAge, formatINR, formatNumber } from "@/lib/format";
import { explainPending, summarise } from "@/lib/royalty";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthorTicket, Book, ListMeta } from "@/lib/types";

export default function AuthorDashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your books, royalties and support requests at a glance."
        actions={<ButtonLink href="/author/tickets/new">Raise a support request</ButtonLink>}
      />
      <div className="space-y-8">
        <Suspense fallback={<Skeleton className="h-28" />}>
          <RoyaltyOverview />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48" />}>
          <ActiveTickets />
        </Suspense>
      </div>
    </>
  );
}

async function RoyaltyOverview() {
  const { data: books } = await serverFetch<ApiData<Book[]>>("/books");
  const s = summarise(books);

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Books"
          value={s.books}
          hint={s.inProduction > 0 ? `${s.published} live · ${s.inProduction} in production` : `${s.published} live`}
          href="/author/books"
        />
        <StatCard label="Copies sold" value={formatNumber(s.copiesSold)} hint="All platforms" />
        <StatCard label="Royalty earned" value={formatINR(s.earned)} hint={`${formatINR(s.paid)} paid to you`} />
        <StatCard label="Pending payout" value={formatINR(s.pending)} hint="Calculated quarterly" />
      </div>
      <p className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        {explainPending(s.pending)}
      </p>
    </section>
  );
}

async function ActiveTickets() {
  const { data: tickets, meta } = await serverFetch<ApiData<AuthorTicket[], ListMeta>>(
    "/tickets?status=open,in_progress&sort=updated&limit=5",
  );

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Open support requests</h2>
        <Link href="/author/tickets" className="text-sm text-emerald-700 hover:underline">
          View all tickets →
        </Link>
      </div>
      {tickets.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-slate-500">
          No open requests. If something isn&apos;t right with a book or payment,{" "}
          <Link href="/author/tickets/new" className="text-emerald-700 hover:underline">
            let us know
          </Link>
          .
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <Link key={t.id} href={`/author/tickets/${t.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{t.subject}</p>
                <p className="text-xs text-slate-500">
                  {t.ticketNumber} · {t.book?.title ?? "General / Account"} · updated {formatAge(t.lastActivityAt)} ago
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {t.lastReplyRole === "admin" && (
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">New reply</span>
                )}
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
          {meta && meta.total > tickets.length && (
            <p className="px-4 py-2 text-xs text-slate-500">+ {meta.total - tickets.length} more open</p>
          )}
        </Card>
      )}
    </section>
  );
}
