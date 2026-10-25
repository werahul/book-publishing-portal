import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, Book } from "@/lib/types";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "New ticket · BookLeaf" };

const TIPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "book", title: "Pick the book", text: "We'll pull up its stage, sales and royalty history straight away." },
  { icon: "wallet", title: "Include the numbers", text: "Dates, amounts, order or transaction IDs help us check records fast." },
  { icon: "paperclip", title: "Mention screenshots", text: "List what you can share; we'll ask for files if we need them." },
  { icon: "clock", title: "We usually reply within a business day", text: "You'll see our answer on the ticket, live." },
];

export default function NewTicketPage({ searchParams }: PageProps<"/author/tickets/new">) {
  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Raise a support request"
        description="Tell us what's going on — the more detail you share, the faster we can help."
        backHref="/author/tickets"
        backLabel="My Tickets"
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="animate-rise p-6 sm:p-7">
          <Suspense fallback={<Skeleton className="h-80 border-0" />}>
            <FormWithBooks searchParams={searchParams} />
          </Suspense>
        </Card>
        <aside className="animate-rise rounded-xl border border-leaf-200/70 bg-linear-to-b from-leaf-50 to-white/60 p-5">
          <p className="mb-4 font-display text-lg font-semibold text-leaf-900">Get help faster</p>
          <ul className="space-y-4">
            {TIPS.map((tip) => (
              <li key={tip.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-leaf-600 shadow-soft ring-1 ring-leaf-100">
                  <Icon name={tip.icon} className="size-4" />
                </span>
                <div className="text-sm">
                  <p className="font-medium text-stone-900">{tip.title}</p>
                  <p className="text-stone-500">{tip.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

async function FormWithBooks({ searchParams }: Pick<PageProps<"/author/tickets/new">, "searchParams">) {
  const [{ data: books }, params] = await Promise.all([serverFetch<ApiData<Book[]>>("/books"), searchParams]);
  const requested = typeof params.bookId === "string" ? params.bookId : "";
  // Only preselect a book the author actually owns.
  const initialBookId = books.some((b) => b.id === requested) ? requested : "";

  return (
    <NewTicketForm
      books={books.map((b) => ({ id: b.id, title: b.title, inProduction: b.stage !== "published_live" }))}
      initialBookId={initialBookId}
    />
  );
}
