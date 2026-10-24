import Link from "next/link";
import { Suspense } from "react";
import { PRIORITY_LABELS, TICKET_CATEGORY_LABELS } from "@bookleaf/shared";
import { PriorityBadge, StageBadge, StatusBadge } from "@/components/badges";
import { TicketThread } from "@/components/ticket-thread";
import { Card, PageHeader, Prose, Skeleton } from "@/components/ui";
import { formatAge, formatDate, formatDateTime, formatINR } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { AdminTicket, AdminTicketDetail, ApiData, AuthUser, Book, TicketNote } from "@/lib/types";
import { NoteForm } from "./note-form";
import { ReplyComposer } from "./reply-composer";
import { TicketActions } from "./ticket-actions";

export default function AdminTicketPage({ params }: PageProps<"/admin/tickets/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      <TicketWorkspace params={params} />
    </Suspense>
  );
}

async function TicketWorkspace({ params }: Pick<PageProps<"/admin/tickets/[id]">, "params">) {
  const { id } = await params;
  const [{ data }, { data: me }] = await Promise.all([
    serverFetch<ApiData<AdminTicketDetail>>(`/tickets/${id}`),
    serverFetch<ApiData<{ user: AuthUser }>>("/auth/me"),
  ]);
  const { ticket, messages, notes, authorContext } = data;
  const firstName = ticket.author.name.split(" ")[0] ?? ticket.author.name;

  return (
    <>
      <PageHeader
        backHref="/admin/tickets"
        backLabel="Ticket queue"
        title={ticket.subject}
        description={
          <>
            {ticket.ticketNumber} · {ticket.author.name} · {ticket.book ? ticket.book.title : "General / Account Level"} · opened{" "}
            {formatAge(ticket.createdAt)} ago
            {ticket.isStale && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">Stale</span>}
          </>
        }
        actions={
          <>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <TicketThread ticket={ticket} messages={messages} viewer="admin" authorName={ticket.author.name} />
          <Card className="p-4">
            <ReplyComposer ticketId={ticket.id} authorFirstName={firstName} status={ticket.status} />
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <TicketActions ticket={ticket} currentAdminId={me.user.id} />
          </Card>
          <TriagePanel ticket={ticket} />
          <AuthorPanel ticket={ticket} books={authorContext.books} activeTickets={authorContext.activeTickets} totalTickets={authorContext.totalTickets} />
          <NotesPanel ticketId={ticket.id} notes={notes} />
        </aside>
      </div>
    </>
  );
}

/** Why the ticket was triaged the way it was — so agents can trust or correct it. */
function TriagePanel({ ticket }: { ticket: AdminTicket }) {
  const c = ticket.ai.classification;
  return (
    <Card className="space-y-2 p-4 text-sm">
      <h2 className="font-semibold text-slate-900">Triage</h2>
      {c ? (
        <>
          <p className="text-slate-600">
            AI suggested <strong>{TICKET_CATEGORY_LABELS[c.category]}</strong> / <strong>{PRIORITY_LABELS[c.priority]}</strong>
          </p>
          {c.reasoning && <p className="text-xs italic text-slate-500">“{c.reasoning}”</p>}
        </>
      ) : ticket.ai.state === "failed" ? (
        <p className="text-amber-700">AI classification failed{ticket.ai.error ? `: ${ticket.ai.error}` : ""}. Triage came from keyword rules.</p>
      ) : (
        <p className="text-slate-500">AI review pending — current category and priority come from keyword rules.</p>
      )}
      {(ticket.categorySource === "admin" || ticket.prioritySource === "admin") && (
        <p className="text-xs text-slate-500">Manually overridden by the team.</p>
      )}
    </Card>
  );
}

function AuthorPanel({ ticket, books, activeTickets, totalTickets }: { ticket: AdminTicket; books: Book[]; activeTickets: number; totalTickets: number }) {
  return (
    <Card className="space-y-3 p-4 text-sm">
      <div>
        <h2 className="font-semibold text-slate-900">{ticket.author.name}</h2>
        <p className="text-xs text-slate-500">
          {ticket.author.externalId} · {ticket.author.email}
        </p>
        <Link href={`/admin/tickets?authorId=${ticket.author.id}&status=all`} className="text-xs text-emerald-700 hover:underline">
          {totalTickets} ticket{totalTickets === 1 ? "" : "s"} ({activeTickets} active) →
        </Link>
      </div>
      <ul className="space-y-2">
        {books.map((b) => {
          const related = b.id === ticket.book?.id;
          return (
            <li key={b.id} className={`rounded-md border p-2 ${related ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {b.title}
                  {related && <span className="ml-1 text-[10px] font-semibold uppercase text-emerald-700">this ticket</span>}
                </p>
              </div>
              <div className="mt-1">
                <StageBadge stage={b.stage} />
              </div>
              {b.stage === "published_live" ? (
                <dl className="mt-2 grid grid-cols-3 gap-1 text-xs">
                  <Stat label="Sold" value={b.copiesSold.toLocaleString("en-IN")} />
                  <Stat label="Paid" value={formatINR(b.royalty.paid)} />
                  <Stat label="Pending" value={formatINR(b.royalty.pending)} />
                  <div className="col-span-3 text-slate-500">
                    Last payout: {b.lastRoyaltyPayoutDate ? formatDate(b.lastRoyaltyPayoutDate) : "never"} · {b.availableOn.join(", ")}
                  </div>
                </dl>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Not yet on sale.</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function NotesPanel({ ticketId, notes }: { ticketId: string; notes: TicketNote[] }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Internal notes</h2>
        <span className="text-xs text-amber-700">Team only</span>
      </div>
      {notes.length === 0 ? (
        <p className="text-xs text-slate-500">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md bg-amber-50 p-2">
              <Prose>{n.body}</Prose>
              <p className="mt-1 text-[11px] text-slate-500">
                {n.admin.name} · {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <NoteForm ticketId={ticketId} />
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
