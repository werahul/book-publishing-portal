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

const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  in_progress: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  closed: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`${base} ${STATUS_STYLES[status]}`}>{TICKET_STATUS_LABELS[status]}</span>;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  medium: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  low: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className={`${base} bg-slate-50 text-slate-400 ring-1 ring-slate-200`}>Unscored</span>;
  return <span className={`${base} ${PRIORITY_STYLES[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function CategoryLabel({ category }: { category: TicketCategory | null }) {
  return <span className="text-slate-600">{category ? TICKET_CATEGORY_LABELS[category] : "Not yet categorised"}</span>;
}

const SOURCE_LABEL: Record<DecisionSource, { text: string; title: string; style: string }> = {
  ai: { text: "AI", title: "Set by the AI classifier", style: "bg-indigo-50 text-indigo-700" },
  admin: { text: "Manual", title: "Set by a team member", style: "bg-slate-100 text-slate-600" },
  fallback: { text: "Auto", title: "Set by keyword rules (AI unavailable or pending)", style: "bg-amber-50 text-amber-700" },
};

/** Who decided a category/priority — so agents know what to double-check. */
export function SourceBadge({ source }: { source: DecisionSource | null }) {
  if (!source) return null;
  const s = SOURCE_LABEL[source];
  return (
    <span title={s.title} className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${s.style}`}>
      {s.text}
    </span>
  );
}

export function StageBadge({ stage }: { stage: ProductionStage }) {
  const live = stage === "published_live";
  return (
    <span
      className={`${base} ${live ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"}`}
    >
      {live ? PRODUCTION_STAGE_LABELS[stage] : `In production · ${PRODUCTION_STAGE_LABELS[stage]}`}
    </span>
  );
}
