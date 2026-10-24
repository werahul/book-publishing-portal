import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6 space-y-2">
      {backHref && (
        <Link href={backHref} className="text-sm text-slate-500 hover:text-slate-800">
          ← {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white ${className}`}>{children}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Card className="px-6 py-12 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <Link href={href} className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium ${styles}`}>
      {children}
    </Link>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg border border-slate-200 bg-white ${className}`} />;
}

export function StatCard({ label, value, hint, href, tone = "default" }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneStyle = { default: "text-slate-900", warning: "text-amber-700", danger: "text-red-700" }[tone];
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneStyle}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm">
      {body}
    </Link>
  ) : (
    <Card className="p-4">{body}</Card>
  );
}

/** Whitespace-preserving text for user-written content (ticket descriptions, replies). */
export function Prose({ children }: { children: string }) {
  return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{children}</p>;
}
