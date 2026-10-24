import Link from "next/link";
import { Suspense } from "react";
import { PRIORITIES, PRIORITY_LABELS, STALE_TICKET_HOURS } from "@bookleaf/shared";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { ButtonLink, Card, PageHeader, Skeleton, StatCard } from "@/components/ui";
import { formatAge } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { AdminTicket, ApiData, ListMeta, TicketStats } from "@/lib/types";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="Support dashboard"
        description="What needs the team's attention right now."
        actions={<ButtonLink href="/admin/tickets">Open ticket queue</ButtonLink>}
      />
      <div className="space-y-8">
        <Suspense fallback={<Skeleton className="h-48" />}>
          <QueueStats />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <NeedsAttention />
        </Suspense>
      </div>
    </>
  );
}

const ACTIVE = "status=open,in_progress";

async function QueueStats() {
  const { data: s } = await serverFetch<ApiData<TicketStats>>("/tickets/stats");
  const active = s.byStatus.open + s.byStatus.in_progress;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Open" value={s.byStatus.open} hint="Not yet picked up" href="/admin/tickets?status=open" />
        <StatCard label="In progress" value={s.byStatus.in_progress} href="/admin/tickets?status=in_progress" />
        <StatCard
          label="Unassigned"
          value={s.activeUnassigned}
          hint="Active, no owner"
          href={`/admin/tickets?${ACTIVE}&assignee=unassigned`}
          tone={s.activeUnassigned > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Stale"
          value={s.activeStale}
          hint={`No activity > ${STALE_TICKET_HOURS}h`}
          href={`/admin/tickets?${ACTIVE}&sort=idle`}
          tone={s.activeStale > 0 ? "danger" : "default"}
        />
        <StatCard label="Assigned to me" value={s.assignedToMe} href={`/admin/tickets?${ACTIVE}&assignee=me`} />
      </div>

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Active tickets by priority ({active})</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {PRIORITIES.map((p) => {
            const n = s.activeByPriority[p];
            if (!active || !n) return null;
            const colour = { critical: "bg-red-600", high: "bg-orange-400", medium: "bg-amber-300", low: "bg-slate-300" }[p];
            return <div key={p} className={colour} style={{ width: `${(n / active) * 100}%` }} title={`${PRIORITY_LABELS[p]}: ${n}`} />;
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {PRIORITIES.map((p) => (
            <Link key={p} href={`/admin/tickets?${ACTIVE}&priority=${p}`} className="flex items-center gap-2 hover:underline">
              <PriorityBadge priority={p} />
              <span className="text-slate-700">{s.activeByPriority[p]}</span>
            </Link>
          ))}
        </div>
      </Card>
    </section>
  );
}

async function NeedsAttention() {
  const { data: tickets, meta } = await serverFetch<ApiData<AdminTicket[], ListMeta>>(`/tickets?${ACTIVE}&limit=6`);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Needs attention</h2>
        <Link href="/admin/tickets" className="text-sm text-emerald-700 hover:underline">
          Full queue ({meta?.total ?? 0} active) →
        </Link>
      </div>
      {tickets.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-slate-500">Inbox zero — no active tickets. 🎉</Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <Link key={t.id} href={`/admin/tickets/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <PriorityBadge priority={t.priority} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{t.subject}</p>
                <p className="text-xs text-slate-500">
                  {t.ticketNumber} · {t.author.name} · {t.assignee ? `with ${t.assignee.name}` : "unassigned"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                {t.isStale && <span className="rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700">Stale</span>}
                <span title="Age">{formatAge(t.createdAt)}</span>
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}
