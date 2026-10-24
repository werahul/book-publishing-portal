import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PRODUCTION_STAGE_LABELS } from "@bookleaf/shared";
import { StageBadge } from "@/components/badges";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { bookPayoutStatus, explainPending, stageProgress, summarise } from "@/lib/royalty";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, Book } from "@/lib/types";

export const metadata: Metadata = { title: "My Books · BookLeaf" };

export default function MyBooksPage() {
  return (
    <>
      <PageHeader title="My Books" description="Publication details, sales and royalties for each of your titles." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <BookList />
      </Suspense>
    </>
  );
}

async function BookList() {
  const { data: books } = await serverFetch<ApiData<Book[]>>("/books");

  if (books.length === 0) {
    return <EmptyState title="No books yet" description="Once your manuscript is with BookLeaf, it will show up here." />;
  }

  const { pending } = summarise(books);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{explainPending(pending)}</p>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const live = book.stage === "published_live";
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{book.title}</h2>
          <p className="text-sm text-slate-500">
            {book.genre} · ISBN {book.isbn}
          </p>
        </div>
        <StageBadge stage={book.stage} />
      </div>

      {live ? <LiveDetails book={book} /> : <ProductionDetails book={book} />}

      <div className="mt-4 flex justify-end">
        <Link href={`/author/tickets/new?bookId=${book.id}`} className="text-sm font-medium text-emerald-700 hover:underline">
          Get help with this book →
        </Link>
      </div>
    </Card>
  );
}

function LiveDetails({ book }: { book: Book }) {
  const payout = bookPayoutStatus(book);
  const payoutTone = { ok: "text-emerald-700", info: "text-sky-700", muted: "text-slate-500" }[payout.tone];

  return (
    <>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Field label="Published" value={formatDate(book.publicationDate)} />
        <Field label="MRP" value={formatINR(book.mrp)} />
        <Field label="Copies sold" value={formatNumber(book.copiesSold)} />
        <Field label="Royalty per copy" value={formatINR(book.royaltyPerCopy)} />
      </dl>

      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-md bg-slate-50 py-3 text-center text-sm">
        <Money label="Total earned" value={book.royalty.earned} />
        <Money label="Paid to you" value={book.royalty.paid} />
        <Money label="Pending" value={book.royalty.pending} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className={`font-medium ${payoutTone}`}>
          {payout.label}
          {book.lastRoyaltyPayoutDate && (
            <span className="font-normal text-slate-500"> · last payout {formatDate(book.lastRoyaltyPayoutDate)}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          {book.availableOn.map((platform) => (
            <span key={platform} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
              {platform}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function ProductionDetails({ book }: { book: Book }) {
  const { step, total } = stageProgress(book.stage);
  return (
    <div className="mt-4 space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>
          Stage {step} of {total}: <span className="font-medium text-slate-700">{PRODUCTION_STAGE_LABELS[book.stage]}</span>
        </span>
        <span>Next: Published &amp; Live</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <p className="text-sm text-slate-500">
        Your book is still in production. Price, sales and royalty figures will appear here once it&apos;s published
        and live. We&apos;ll email you as it moves through each stage.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{formatINR(value)}</p>
    </div>
  );
}
