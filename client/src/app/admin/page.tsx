import Link from "next/link";
import { Suspense } from "react";
import { PRIORITIES, PRIORITY_LABELS, STALE_TICKET_HOURS } from "@bookleaf/shared";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { LiveUpdates } from "@/components/live-updates";
import { Avatar, ButtonLink, Card, Hero, SectionHeading, Skeleton, StatCard, TextLink } from "@/components/ui";
import { formatAge } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { AdminTicket, ApiData, AuthUser, ListMeta, TicketStats } from "@/lib/types";

export default function AdminDashboard() {
  return (
    <>
      <LiveUpdates />
      <div className="space-y-10">
        <Suspense
          fallback={
            <div>
              <DashboardHero name={null} />
              <Skeleton className="h-48" />
            </div>
          }
        >
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

function DashboardHero({ name, summary }: { name: string | null; summary?: string }) {
  return (
    <Hero
      tone="ink"
      eyebrow="Support Console"
      title={name ? `Hello, ${name}` : "Support dashboard"}
      description={summary ?? "What needs the team's attention right now."}
      actions={
        <ButtonLink href="/admin/tickets" variant="light" icon="inbox">
          Open ticket queue
        </ButtonLink>
      }
    />
  );
}

async function QueueStats() {
  const [{ data: s }, { data: me }] = await Promise.all([
    serverFetch<ApiData<TicketStats>>("/tickets/stats"),
    serverFetch<ApiData<{ user: AuthUser }>>("/auth/me"),
  ]);
  const active = s.byStatus.open + s.byStatus.in_progress;
  const summary =
    active === 0
      ? "The queue is empty. Nothing is waiting on the team."
      : `${active} active ticket${active === 1 ? "" : "s"} · ${s.activeUnassigned} unassigned · ${s.activeStale} stale.`;

  return (
    <section className="space-y-4">
      <DashboardHero name={me.user.name.split(" ")[0] ?? me.user.name} summary={summary} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Open" icon="inbox" value={s.byStatus.open} hint="Not yet picked up" href="/admin/tickets?status=open" />
        <StatCard label="In progress" icon="pen" value={s.byStatus.in_progress} href="/admin/tickets?status=in_progress" />
        <StatCard
          label="Unassigned"
          icon="userPlus"
          value={s.activeUnassigned}
          hint="Active, no owner"
          href={`/admin/tickets?${ACTIVE}&assignee=unassigned`}
          tone={s.activeUnassigned > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Stale"
          icon="flame"
          value={s.activeStale}
          hint={`No activity > ${STALE_TICKET_HOURS}h`}
          href={`/admin/tickets?${ACTIVE}&sort=idle`}
          tone={s.activeStale > 0 ? "danger" : "default"}
        />
        <StatCard label="Assigned to me" icon="userCheck" value={s.assignedToMe} href={`/admin/tickets?${ACTIVE}&assignee=me`} />
      </div>

      <Card className="animate-rise p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="font-display text-lg font-semibold text-stone-900">Active tickets by priority</p>
          <p className="font-display text-2xl font-semibold text-stone-900 tabular-nums">{active}</p>
        </div>
        <div className="flex h-3.5 gap-1 overflow-hidden rounded-full bg-stone-100">
          {PRIORITIES.map((p) => {
            const n = s.activeByPriority[p];
            if (!active || !n) return null;
            const colour = {
              critical: "bg-linear-to-r from-red-600 to-rose-500",
              high: "bg-linear-to-r from-orange-500 to-orange-400",
              medium: "bg-linear-to-r from-amber-400 to-amber-300",
              low: "bg-stone-300",
            }[p];
            return (
              <div
                key={p}
                className={`${colour} rounded-full`}
                style={{ width: `${(n / active) * 100}%` }}
                title={`${PRIORITY_LABELS[p]}: ${n}`}
              />
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRIORITIES.map((p) => (
            <Link
              key={p}
              href={`/admin/tickets?${ACTIVE}&priority=${p}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-stone-200/80 px-3 py-2 text-sm transition hover:border-leaf-200 hover:bg-leaf-50/40"
            >
              <PriorityBadge priority={p} />
              <span className="font-semibold text-stone-800 tabular-nums">{s.activeByPriority[p]}</span>
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
    <section className="animate-rise">
      <SectionHeading
        title="Needs attention"
        icon="flame"
        action={<TextLink href="/admin/tickets">Full queue ({meta?.total ?? 0} active)</TextLink>}
      />
      {tickets.length === 0 ? (
        <Card className="px-4 py-12 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100">
            <Icon name="check" className="size-6" />
          </span>
          <p className="font-display text-lg font-semibold text-stone-900">No active tickets</p>
          <p className="text-sm text-stone-500">New tickets will appear here as authors raise them.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-stone-100 overflow-hidden">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/admin/tickets/${t.id}`}
              className={`group flex items-center gap-3 border-l-[3px] px-4 py-3.5 transition hover:bg-leaf-50/40 ${
                t.priority === "critical" ? "border-l-red-500" : "border-l-transparent"
              }`}
            >
              <Avatar name={t.author.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900 group-hover:text-leaf-800">{t.subject}</p>
                <p className="text-xs text-stone-500">
                  <span className="font-mono">{t.ticketNumber}</span> · {t.author.name} ·{" "}
                  {t.assignee ? `with ${t.assignee.name}` : <span className="text-amber-700">unassigned</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-stone-500">
                {t.isStale && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 ring-1 ring-red-200">
                    <Icon name="flame" className="size-3" />
                    Stale
                  </span>
                )}
                <span title="Age" className="hidden tabular-nums sm:inline">
                  {formatAge(t.createdAt)}
                </span>
                <PriorityBadge priority={t.priority} />
                <span className="hidden md:inline-flex">
                  <StatusBadge status={t.status} />
                </span>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}
