import { Suspense } from "react";
import { CategoryLabel, StatusBadge } from "@/components/badges";
import { ReplyForm } from "@/components/reply-form";
import { TicketThread } from "@/components/ticket-thread";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthorTicketDetail } from "@/lib/types";

export default function AuthorTicketPage({ params, searchParams }: PageProps<"/author/tickets/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <TicketDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS_EXPLAINER = {
  open: "We've received your request and a member of our team will pick it up shortly.",
  in_progress: "Our team is working on this. We'll update you here.",
  resolved: "We believe this is sorted. If anything is still wrong, just reply and the ticket will reopen.",
  closed: "This ticket is closed. If you need more help, please raise a new ticket.",
} as const;

async function TicketDetail({ params, searchParams }: PageProps<"/author/tickets/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { data } = await serverFetch<ApiData<AuthorTicketDetail>>(`/tickets/${id}`);
  const { ticket, messages } = data;

  return (
    <>
      <PageHeader
        backHref="/author/tickets"
        backLabel="My Tickets"
        title={ticket.subject}
        description={
          <>
            {ticket.ticketNumber} · {ticket.book ? ticket.book.title : "General / Account Level"} · raised{" "}
            {formatDate(ticket.createdAt)} · <CategoryLabel category={ticket.category} />
          </>
        }
        actions={<StatusBadge status={ticket.status} />}
      />

      {query.created === "1" && (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Thanks — your ticket {ticket.ticketNumber} has been submitted. You&apos;ll see our reply right here.
        </p>
      )}

      <p className="mb-6 text-sm text-slate-600">{STATUS_EXPLAINER[ticket.status]}</p>

      <TicketThread ticket={ticket} messages={messages} viewer="author" authorName="You" />

      <Card className="mt-6 p-4">
        {ticket.status === "closed" ? (
          <p className="text-sm text-slate-500">Replies are turned off for closed tickets.</p>
        ) : (
          <ReplyForm
            ticketId={ticket.id}
            hint={ticket.status === "resolved" ? "Replying will reopen this ticket." : undefined}
          />
        )}
      </Card>
    </>
  );
}
