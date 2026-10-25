import {
  PRIORITY_LABELS,
  PRODUCTION_STAGE_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  type DecisionSource,
  type Priority,
  type ProductionStage,
  type TicketCategory,
  type TicketStatus,
} from "@bookleaf/shared";
import { Icon } from "./icons";

const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";
const dot = "size-1.5 shrink-0 rounded-full";

const STATUS_STYLES: Record<TicketStatus, { pill: string; dot: string }> = {
  open: { pill: "bg-sky-50 text-sky-700 ring-1 ring-sky-200", dot: "bg-sky-500" },
  in_progress: { pill: "bg-violet-50 text-violet-700 ring-1 ring-violet-200", dot: "bg-violet-500" },
  resolved: { pill: "bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200", dot: "bg-leaf-500" },
  closed: { pill: "bg-stone-100 text-stone-600 ring-1 ring-stone-200", dot: "bg-stone-400" },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`${base} ${s.pill}`}>
      <span className={`${dot} ${s.dot}`} />
      {TICKET_STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "bg-linear-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-red-600/30",
  high: "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
  medium: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  low: "bg-stone-100 text-stone-600 ring-1 ring-stone-200",
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className={`${base} border border-dashed border-stone-300 bg-stone-50 text-stone-400`}>Unscored</span>;
  return (
    <span className={`${base} ${PRIORITY_STYLES[priority]}`}>
      {priority === "critical" ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-white" />
        </span>
      ) : (
        <PriorityBars priority={priority} />
      )}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** Tiny signal-strength glyph: one, two or three filled bars. */
function PriorityBars({ priority }: { priority: Exclude<Priority, "critical"> }) {
  const level = { low: 1, medium: 2, high: 3 }[priority];
  return (
    <span aria-hidden className="flex h-2.5 items-end gap-px">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`w-[3px] rounded-sm ${n <= level ? "bg-current" : "bg-current opacity-25"}`} style={{ height: `${n * 33}%` }} />
      ))}
    </span>
  );
}

export function CategoryLabel({ category }: { category: TicketCategory | null }) {
  return <span className="text-stone-600">{category ? TICKET_CATEGORY_LABELS[category] : "Not yet categorised"}</span>;
}

const SOURCE_LABEL: Record<DecisionSource, { text: string; title: string; style: string }> = {
  ai: { text: "AI", title: "Set by the AI classifier", style: "bg-linear-to-r from-indigo-50 to-violet-50 text-indigo-700 ring-1 ring-indigo-200" },
  admin: { text: "Manual", title: "Set by a team member", style: "bg-stone-100 text-stone-600 ring-1 ring-stone-200" },
  fallback: { text: "Auto", title: "Set by keyword rules (AI unavailable or pending)", style: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
};

/** Who decided a category/priority — so agents know what to double-check. */
export function SourceBadge({ source }: { source: DecisionSource | null }) {
  if (!source) return null;
  const s = SOURCE_LABEL[source];
  return (
    <span
      title={s.title}
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase ${s.style}`}
    >
      {source === "ai" && <Icon name="sparkles" className="size-2.5" strokeWidth={2} />}
      {s.text}
    </span>
  );
}

export function StageBadge({ stage }: { stage: ProductionStage }) {
  const live = stage === "published_live";
  return (
    <span
      className={`${base} ${live ? "bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`}
    >
      <span className={`${dot} ${live ? "bg-leaf-500" : "animate-pulse bg-amber-500"}`} />
      {live ? PRODUCTION_STAGE_LABELS[stage] : `In production · ${PRODUCTION_STAGE_LABELS[stage]}`}
    </span>
  );
}

/** "BookLeaf replied" / "Awaiting our reply" style nudge. */
export function ReplyNudge({ children, tone = "leaf" }: { children: string; tone?: "leaf" | "sky" }) {
  const style = tone === "leaf" ? "bg-leaf-600 text-white shadow-sm shadow-leaf-600/30" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style}`}>
      <Icon name="message" className="size-3" strokeWidth={2} />
      {children}
    </span>
  );
}
