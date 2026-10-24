import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, Book } from "@/lib/types";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "New ticket · BookLeaf" };

export default function NewTicketPage({ searchParams }: PageProps<"/author/tickets/new">) {
  return (
    <>
      <PageHeader
        title="Raise a support request"
        description="Tell us what's going on — the more detail you share, the faster we can help."
        backHref="/author/tickets"
        backLabel="My Tickets"
      />
      <Card className="max-w-2xl p-6">
        <Suspense fallback={<Skeleton className="h-80 border-0" />}>
          <FormWithBooks searchParams={searchParams} />
        </Suspense>
      </Card>
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
