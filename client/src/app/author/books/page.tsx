import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PRODUCTION_STAGES, PRODUCTION_STAGE_LABELS } from "@bookleaf/shared";
import { StageBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { BookCover, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { bookPayoutStatus, explainPending, stageProgress, summarise } from "@/lib/royalty";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, Book } from "@/lib/types";

export const metadata: Metadata = { title: "My Books · BookLeaf" };

export default function MyBooksPage() {
  return (
    <>
      <PageHeader eyebrow="Your library" title="My Books" description="Publication details, sales and royalties for each of your titles." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <BookList />
      </Suspense>
    </>
  );
}

async function BookList() {
  const { data: books } = await serverFetch<ApiData<Book[]>>("/books");

  if (books.length === 0) {
    return <EmptyState icon="book" title="No books yet" description="Once your manuscript is with BookLeaf, it will show up here." />;
  }

  const { pending } = summarise(books);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-leaf-200/70 bg-linear-to-r from-leaf-50 to-amber-50/60 px-4 py-3 text-sm text-leaf-900">
        <Icon name="info" className="mt-0.5 size-4 text-leaf-600" />
        <p>{explainPending(pending)}</p>
      </div>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const live = book.stage === "published_live";
  return (
    <Card className="animate-rise p-5 transition duration-200 hover:shadow-lift sm:p-6">
      <div className="flex gap-5">
        <div className="hidden sm:block">
          <BookCover title={book.title} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold tracking-tight text-stone-900">{book.title}</h2>
              <p className="text-sm text-stone-500">
                {book.genre} · <span className="font-mono text-xs">ISBN {book.isbn}</span>
              </p>
            </div>
            <StageBadge stage={book.stage} />
          </div>

          {live ? <LiveDetails book={book} /> : <ProductionDetails book={book} />}

          <div className="mt-4 flex justify-end border-t border-stone-100 pt-3">
            <Link
              href={`/author/tickets/new?bookId=${book.id}`}
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-leaf-700 hover:text-leaf-800"
            >
              <Icon name="message" className="size-4" />
              Get help with this book
              <Icon name="arrowRight" className="size-3.5 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function LiveDetails({ book }: { book: Book }) {
  const payout = bookPayoutStatus(book);
  const payoutTone = { ok: "text-leaf-700", info: "text-sky-700", muted: "text-stone-500" }[payout.tone];

  return (
    <>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Field label="Published" value={formatDate(book.publicationDate)} />
        <Field label="MRP" value={formatINR(book.mrp)} />
        <Field label="Copies sold" value={formatNumber(book.copiesSold)} />
        <Field label="Royalty per copy" value={formatINR(book.royaltyPerCopy)} />
      </dl>

      <div className="mt-4 grid grid-cols-3 divide-x divide-stone-200/70 rounded-xl bg-linear-to-r from-stone-50 to-leaf-50/60 py-3 text-center text-sm ring-1 ring-stone-200/60">
        <Money label="Total earned" value={book.royalty.earned} />
        <Money label="Paid to you" value={book.royalty.paid} />
        <Money label="Pending" value={book.royalty.pending} highlight={book.royalty.pending > 0} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className={`font-medium ${payoutTone}`}>
          {payout.label}
          {book.lastRoyaltyPayoutDate && (
            <span className="font-normal text-stone-500"> · last payout {formatDate(book.lastRoyaltyPayoutDate)}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          {book.availableOn.map((platform) => (
            <span key={platform} className="rounded-full bg-white px-2 py-0.5 text-stone-600 ring-1 ring-stone-200">
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
      <div className="flex justify-between text-xs text-stone-500">
        <span>
          Stage {step} of {total}: <span className="font-medium text-stone-700">{PRODUCTION_STAGE_LABELS[book.stage]}</span>
        </span>
        <span>Next: Published &amp; Live</span>
      </div>
      <div className="flex gap-1" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        {PRODUCTION_STAGES.map((s, i) => (
          <div
            key={s}
            title={PRODUCTION_STAGE_LABELS[s]}
            className={`h-2 flex-1 rounded-full ${
              i + 1 < step ? "bg-linear-to-r from-amber-400 to-amber-500" : i + 1 === step ? "bg-amber-400" : "bg-stone-200"
            }`}
          />
        ))}
      </div>
      <ol className="flex flex-wrap gap-x-1.5 gap-y-1 text-[11px]" aria-label="Production stages">
        {PRODUCTION_STAGES.map((s, i) => (
          <li
            key={s}
            aria-current={i + 1 === step ? "step" : undefined}
            className={i + 1 < step ? "text-stone-600" : i + 1 === step ? "font-semibold text-amber-800" : "text-stone-400"}
          >
            {i + 1 < step && "✓ "}
            {PRODUCTION_STAGE_LABELS[s]}
            {i < PRODUCTION_STAGES.length - 1 && <span className="ml-1.5 text-stone-300">→</span>}
          </li>
        ))}
      </ol>
      <p className="text-sm text-stone-500">
        Your book is still in production. Price, sales and royalty figures will appear here once it&apos;s published
        and live. We&apos;ll email you as it moves through each stage.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function Money({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`font-display text-lg font-semibold tabular-nums ${highlight ? "text-amber-700" : "text-stone-900"}`}>{formatINR(value)}</p>
    </div>
  );
}
