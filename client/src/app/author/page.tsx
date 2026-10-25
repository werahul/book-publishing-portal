import Link from "next/link";
import { Suspense } from "react";
import { ReplyNudge, StatusBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { BookCover, ButtonLink, Card, Hero, SectionHeading, Skeleton, StatCard, TextLink } from "@/components/ui";
import { formatAge, formatINR, formatNumber } from "@/lib/format";
import { explainPending, summarise } from "@/lib/royalty";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthorTicket, AuthUser, Book, ListMeta } from "@/lib/types";

export default function AuthorDashboard() {
  return (
    <>
      <Suspense fallback={<WelcomeHero name={null} />}>
        <Welcome />
      </Suspense>
      <div className="space-y-10">
        <Suspense fallback={<Skeleton className="h-36" />}>
          <RoyaltyOverview />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-48" />}>
          <ActiveTickets />
        </Suspense>
      </div>
    </>
  );
}

async function Welcome() {
  const { data } = await serverFetch<ApiData<{ user: AuthUser }>>("/auth/me");
  return <WelcomeHero name={data.user.name.split(" ")[0] ?? data.user.name} />;
}

function WelcomeHero({ name }: { name: string | null }) {
  return (
    <Hero
      eyebrow="Author Portal"
      title={name ? `Welcome back, ${name}` : "Welcome back"}
      description="Your books, royalties and support requests at a glance."
      actions={
        <>
          <ButtonLink href="/author/tickets/new" variant="light" icon="plus">
            Raise a support request
          </ButtonLink>
          <ButtonLink href="/author/books" variant="glass" icon="book">
            My books
          </ButtonLink>
        </>
      }
    />
  );
}

async function RoyaltyOverview() {
  const { data: books } = await serverFetch<ApiData<Book[]>>("/books");
  const s = summarise(books);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Books"
          icon="book"
          value={s.books}
          hint={s.inProduction > 0 ? `${s.published} live · ${s.inProduction} in production` : `${s.published} live`}
          href="/author/books"
        />
        <StatCard label="Copies sold" icon="trending" value={formatNumber(s.copiesSold)} hint="All platforms" />
        <StatCard label="Royalty earned" icon="wallet" value={formatINR(s.earned)} hint={`${formatINR(s.paid)} paid to you`} />
        <StatCard label="Pending payout" icon="clock" value={formatINR(s.pending)} hint="Calculated quarterly" />
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-leaf-200/70 bg-linear-to-r from-leaf-50 to-amber-50/60 px-4 py-3 text-sm text-leaf-900">
        <Icon name="info" className="mt-0.5 size-4 text-leaf-600" />
        <p>{explainPending(s.pending)}</p>
      </div>
      {books.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto pt-1 pb-1">
          {books.map((b) => (
            <Link
              key={b.id}
              href="/author/books"
              title={b.title}
              className="transition duration-200 hover:-translate-y-1 hover:rotate-[-2deg]"
            >
              <BookCover title={b.title} />
            </Link>
          ))}
          <span className="pl-2 text-xs text-stone-400">Your shelf</span>
        </div>
      )}
    </section>
  );
}

async function ActiveTickets() {
  const { data: tickets, meta } = await serverFetch<ApiData<AuthorTicket[], ListMeta>>(
    "/tickets?status=open,in_progress&sort=updated&limit=5",
  );

  return (
    <section className="animate-rise">
      <SectionHeading title="Open support requests" icon="ticket" action={<TextLink href="/author/tickets">View all tickets</TextLink>} />
      {tickets.length === 0 ? (
        <Card className="flex items-center gap-4 px-5 py-6 text-sm text-stone-500">
          <span className="grid size-10 place-items-center rounded-xl bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100">
            <Icon name="check" className="size-5" />
          </span>
          <p>
            No open requests. If something isn&apos;t right with a book or payment,{" "}
            <Link href="/author/tickets/new" className="font-medium text-leaf-700 hover:underline">
              let us know
            </Link>
            .
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-stone-100 overflow-hidden">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/author/tickets/${t.id}`}
              className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-leaf-50/50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-900 group-hover:text-leaf-800">{t.subject}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  <span className="font-mono">{t.ticketNumber}</span> · {t.book?.title ?? "General / Account"} · updated{" "}
                  {formatAge(t.lastActivityAt)} ago
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {t.lastReplyRole === "admin" && <ReplyNudge>New reply</ReplyNudge>}
                <StatusBadge status={t.status} />
                <Icon name="arrowRight" className="size-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-leaf-600" />
              </div>
            </Link>
          ))}
          {meta && meta.total > tickets.length && (
            <p className="bg-stone-50/60 px-5 py-2 text-xs text-stone-500">+ {meta.total - tickets.length} more open</p>
          )}
        </Card>
      )}
    </section>
  );
}
