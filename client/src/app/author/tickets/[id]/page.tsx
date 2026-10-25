import { Suspense } from "react";
import type { TicketStatus } from "@bookleaf/shared";
import { CategoryLabel, StatusBadge } from "@/components/badges";
import { Icon, type IconName } from "@/components/icons";
import { LiveUpdates } from "@/components/live-updates";
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

const STATUS_ICON: Record<TicketStatus, { icon: IconName; style: string }> = {
  open: { icon: "inbox", style: "border-sky-200 bg-sky-50/70 text-sky-900 [&_svg]:text-sky-600" },
  in_progress: { icon: "pen", style: "border-violet-200 bg-violet-50/70 text-violet-900 [&_svg]:text-violet-600" },
  resolved: { icon: "check", style: "border-leaf-200 bg-leaf-50/70 text-leaf-900 [&_svg]:text-leaf-600" },
  closed: { icon: "lock", style: "border-stone-200 bg-stone-50 text-stone-700 [&_svg]:text-stone-500" },
};

async function TicketDetail({ params, searchParams }: PageProps<"/author/tickets/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { data } = await serverFetch<ApiData<AuthorTicketDetail>>(`/tickets/${id}`);
  const { ticket, messages } = data;

  return (
    <>
      <LiveUpdates ticketId={ticket.id} />
      <PageHeader
        backHref="/author/tickets"
        backLabel="My Tickets"
        title={ticket.subject}
        description={
          <>
            <span className="font-mono">{ticket.ticketNumber}</span> · {ticket.book ? ticket.book.title : "General / Account Level"} · raised{" "}
            {formatDate(ticket.createdAt)} · <CategoryLabel category={ticket.category} />
          </>
        }
        actions={<StatusBadge status={ticket.status} />}
      />

      {query.created === "1" && (
        <p className="mb-4 flex animate-rise items-start gap-2 rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm text-leaf-900">
          <Icon name="check" className="mt-0.5 size-4 text-leaf-600" />
          Thanks — your ticket {ticket.ticketNumber} has been submitted. You&apos;ll see our reply right here.
        </p>
      )}

      <p className={`mb-8 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${STATUS_ICON[ticket.status].style}`}>
        <Icon name={STATUS_ICON[ticket.status].icon} className="mt-0.5 size-4" />
        {STATUS_EXPLAINER[ticket.status]}
      </p>

      <TicketThread ticket={ticket} messages={messages} viewer="author" authorName="You" />

      <Card className="mt-8 p-5">
        {ticket.status === "closed" ? (
          <p className="flex items-center gap-2 text-sm text-stone-500">
            <Icon name="lock" className="size-4" />
            Replies are turned off for closed tickets.
          </p>
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
