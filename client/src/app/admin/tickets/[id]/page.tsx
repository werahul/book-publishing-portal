import Link from "next/link";
import { Suspense } from "react";
import { PRIORITY_LABELS, TICKET_CATEGORY_LABELS } from "@bookleaf/shared";
import { PriorityBadge, StageBadge, StatusBadge } from "@/components/badges";
import { Icon, type IconName } from "@/components/icons";
import { LiveUpdates } from "@/components/live-updates";
import { TicketThread } from "@/components/ticket-thread";
import { Avatar, BookCover, Card, PageHeader, Prose, Skeleton } from "@/components/ui";
import { formatAge, formatDate, formatDateTime, formatINR } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { AdminTicket, AdminTicketDetail, ApiData, AuthUser, Book, TicketNote } from "@/lib/types";
import { NoteForm } from "./note-form";
import { ReplyComposer } from "./reply-composer";
import { RerunAiButton } from "./rerun-ai-button";
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
      <LiveUpdates ticketId={ticket.id} />
      <PageHeader
        backHref="/admin/tickets"
        backLabel="Ticket queue"
        title={ticket.subject}
        description={
          <>
            <span className="font-mono">{ticket.ticketNumber}</span> · {ticket.author.name} ·{" "}
            {ticket.book ? ticket.book.title : "General / Account Level"} · opened {formatAge(ticket.createdAt)} ago
            {ticket.isStale && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                <Icon name="flame" className="size-3" />
                Stale
              </span>
            )}
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
          <Card className="p-5">
            <ReplyComposer
              ticketId={ticket.id}
              authorFirstName={firstName}
              status={ticket.status}
              initialDraft={ticket.ai.draft ?? null}
              awaitingReply={ticket.lastReplyRole !== "admin"}
              threadKey={messages.at(-1)?.id ?? "no-messages"}
            />
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="animate-rise p-4">
            <PanelTitle icon="ticket">Ticket</PanelTitle>
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
    <div className="animate-rise rounded-xl bg-linear-to-br from-indigo-300 via-violet-300 to-leaf-300 p-px shadow-soft">
      <div className="space-y-2.5 rounded-[11px] bg-linear-to-br from-white via-white to-indigo-50/60 p-4 text-sm">
        <PanelTitle icon="sparkles" tone="ai">
          AI triage
        </PanelTitle>
        {c ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800 ring-1 ring-indigo-200">
                {TICKET_CATEGORY_LABELS[c.category]}
              </span>
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-violet-200">
                {PRIORITY_LABELS[c.priority]} priority
              </span>
            </div>
            {c.reasoning && (
              <blockquote className="border-l-2 border-indigo-200 pl-3 text-xs leading-relaxed text-stone-600 italic">
                {c.reasoning}
              </blockquote>
            )}
          </>
        ) : ticket.ai.state === "failed" ? (
          <p className="flex items-start gap-2 text-amber-800">
            <Icon name="alert" className="mt-0.5 size-4 text-amber-600" />
            <span>
              AI classification failed{ticket.ai.error ? `: ${ticket.ai.error}` : ""}. Triage came from keyword rules.
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-2 text-stone-500">
            <span className="relative mt-1.5 flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-indigo-500" />
            </span>
            AI review in progress. The current category and priority come from keyword rules and update here automatically.
          </p>
        )}
        {(ticket.categorySource === "admin" || ticket.prioritySource === "admin") && (
          <p className="flex items-center gap-1.5 text-xs text-stone-500">
            <Icon name="pen" className="size-3.5" />
            Manually overridden by the team.
          </p>
        )}
        {ticket.ai.state !== "done" && <RerunAiButton ticketId={ticket.id} />}
      </div>
    </div>
  );
}

function AuthorPanel({ ticket, books, activeTickets, totalTickets }: { ticket: AdminTicket; books: Book[]; activeTickets: number; totalTickets: number }) {
  return (
    <Card className="animate-rise space-y-3 p-4 text-sm">
      <div className="flex items-start gap-3">
        <Avatar name={ticket.author.name} size="lg" />
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-stone-900">{ticket.author.name}</h2>
          <p className="truncate text-xs text-stone-500">
            <span className="font-mono">{ticket.author.externalId}</span> · {ticket.author.email}
          </p>
          <Link
            href={`/admin/tickets?authorId=${ticket.author.id}&status=all`}
            className="group mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-leaf-700 hover:text-leaf-800"
          >
            {totalTickets} ticket{totalTickets === 1 ? "" : "s"} ({activeTickets} active)
            <Icon name="arrowRight" className="size-3 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
      <ul className="space-y-2">
        {books.map((b) => {
          const related = b.id === ticket.book?.id;
          return (
            <li
              key={b.id}
              className={`rounded-lg border p-2.5 ${related ? "border-leaf-300 bg-leaf-50/60 ring-4 ring-leaf-500/5" : "border-stone-200"}`}
            >
              <div className="flex items-start gap-2.5">
                <BookCover title={b.title} size="sm" />
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">
                    {b.title}
                    {related && (
                      <span className="ml-1.5 rounded-full bg-leaf-600 px-1.5 py-px align-middle text-[9px] font-semibold tracking-wide text-white uppercase">
                        this ticket
                      </span>
                    )}
                  </p>
                  <div className="mt-1">
                    <StageBadge stage={b.stage} />
                  </div>
                </div>
              </div>
              {b.stage === "published_live" ? (
                <dl className="mt-2 grid grid-cols-3 gap-1 text-xs">
                  <Stat label="Sold" value={b.copiesSold.toLocaleString("en-IN")} />
                  <Stat label="Paid" value={formatINR(b.royalty.paid)} />
                  <Stat label="Pending" value={formatINR(b.royalty.pending)} />
                  <div className="col-span-3 text-stone-500">
                    Last payout: {b.lastRoyaltyPayoutDate ? formatDate(b.lastRoyaltyPayoutDate) : "never"} · {b.availableOn.join(", ")}
                  </div>
                </dl>
              ) : (
                <p className="mt-1 text-xs text-stone-500">Not yet on sale.</p>
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
    <div className="animate-rise space-y-3 rounded-xl border border-amber-200/80 bg-linear-to-b from-amber-50/80 to-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <PanelTitle icon="lock" tone="note">
          Internal notes
        </PanelTitle>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
          Team only
        </span>
      </div>
      {notes.length === 0 ? (
        <p className="text-xs text-stone-500">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-amber-200/70 bg-white p-2.5 shadow-xs">
              <Prose>{n.body}</Prose>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-500">
                <Avatar name={n.admin.name} size="sm" />
                {n.admin.name} · {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <NoteForm ticketId={ticketId} />
    </div>
  );
}

const PANEL_TONES = { default: "text-leaf-600", ai: "text-indigo-600", note: "text-amber-600" };

function PanelTitle({ icon, tone = "default", children }: { icon: IconName; tone?: keyof typeof PANEL_TONES; children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
      <Icon name={icon} className={`size-4 ${PANEL_TONES[tone]}`} />
      {children}
    </h2>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900">{value}</dd>
    </div>
  );
}
