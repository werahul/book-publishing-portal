import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

const cardBase = "rounded-xl border border-stone-200/80 bg-white shadow-soft";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-8 animate-rise space-y-3">
      {backHref && (
        <Link
          href={backHref}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-leaf-700"
        >
          <Icon name="arrowLeft" className="size-4 transition group-hover:-translate-x-0.5" />
          {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.16em] text-leaf-600 uppercase">{eyebrow}</p>}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance text-stone-900">{title}</h1>
          {description && <div className="mt-1.5 text-sm text-stone-500">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** The dashboard banner: a deep green panel with drifting leaves. */
export function Hero({
  eyebrow,
  title,
  description,
  actions,
  tone = "leaf",
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: "leaf" | "ink";
  children?: ReactNode;
}) {
  const gradient = tone === "leaf" ? "from-leaf-800 via-leaf-700 to-leaf-500" : "from-stone-900 via-leaf-950 to-leaf-800";
  return (
    <section className={`relative mb-8 animate-rise overflow-hidden rounded-2xl bg-linear-to-br ${gradient} p-6 text-white shadow-lift sm:p-8`}>
      <HeroDecor />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          {eyebrow && <p className="text-xs font-semibold tracking-[0.18em] text-leaf-200 uppercase">{eyebrow}</p>}
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
          {description && <div className="mt-2 text-sm text-leaf-50/85 sm:text-base">{description}</div>}
          {children}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

function HeroDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-24 -right-16 size-72 rounded-full bg-leaf-300/20 blur-3xl" />
      <div className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-amber-200/10 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "18px 18px" }}
      />
      <Icon name="leaf" strokeWidth={1} className="absolute -right-6 -bottom-10 size-56 animate-float text-white/10" />
      <Icon name="leaf" strokeWidth={1.25} className="absolute top-6 right-48 hidden size-16 rotate-45 text-white/10 md:block" />
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${cardBase} ${className}`}>{children}</div>;
}

/** Card section title with an optional icon and right-hand action. */
export function SectionHeading({ title, icon, action }: { title: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-stone-900">
        {icon && <Icon name={icon} className="size-5 text-leaf-600" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1 text-sm font-medium text-leaf-700 hover:text-leaf-800">
      {children}
      <Icon name="arrowRight" className="size-3.5 transition group-hover:translate-x-0.5" />
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "inbox",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="animate-rise rounded-xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-leaf-50 text-leaf-600 ring-1 ring-leaf-100">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="font-display text-lg font-semibold text-stone-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  /** Solid white, for use on the green hero. */
  light: "bg-white text-leaf-800 shadow-md hover:bg-leaf-50",
  /** Translucent, for secondary actions on the hero. */
  glass: "bg-white/10 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  icon,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof BUTTON_VARIANTS;
  icon?: IconName;
}) {
  return (
    <Link href={href} className={`btn ${BUTTON_VARIANTS[variant]}`}>
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </Link>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return (
    <div aria-hidden className={`relative overflow-hidden rounded-xl border border-stone-200/70 bg-white/70 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-stone-100 to-transparent" />
    </div>
  );
}

const STAT_TONES = {
  default: { value: "text-stone-900", icon: "bg-leaf-50 text-leaf-700 ring-leaf-100" },
  warning: { value: "text-amber-700", icon: "bg-amber-50 text-amber-700 ring-amber-100" },
  danger: { value: "text-red-700", icon: "bg-red-50 text-red-600 ring-red-100" },
};

export function StatCard({
  label,
  value,
  hint,
  href,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  icon?: IconName;
  tone?: keyof typeof STAT_TONES;
}) {
  const t = STAT_TONES[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wider text-stone-500 uppercase">{label}</p>
        {icon && (
          <span className={`grid size-9 place-items-center rounded-lg ring-1 transition ${t.icon}`}>
            <Icon name={icon} className="size-[18px]" />
          </span>
        )}
      </div>
      <p className={`mt-1 font-display text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${t.value}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className={`${cardBase} block animate-rise p-4 transition duration-200 hover:-translate-y-0.5 hover:border-leaf-200 hover:shadow-lift`}
    >
      {body}
    </Link>
  ) : (
    <div className={`${cardBase} animate-rise p-4`}>{body}</div>
  );
}

/** Whitespace-preserving text for user-written content (ticket descriptions, replies). */
export function Prose({ children }: { children: string }) {
  return <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-stone-800">{children}</p>;
}

/* ── Brand & identity ─────────────────────────────────────────────────────── */

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl bg-linear-to-br from-leaf-500 to-leaf-800 text-white shadow-glow ring-1 ring-white/20 ring-inset ${className}`}
    >
      <Icon name="leaf" strokeWidth={2} className="size-[55%]" />
    </span>
  );
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`font-display text-xl font-semibold tracking-tight ${inverted ? "text-white" : "text-stone-900"}`}>
        Book<span className={inverted ? "text-leaf-200" : "text-leaf-600"}>Leaf</span>
      </span>
    </span>
  );
}

/** Stable small hash so a name always gets the same colour. */
function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

const AVATAR_TONES = [
  "bg-leaf-100 text-leaf-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
];
const AVATAR_SIZES = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" };

export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof AVATAR_SIZES }) {
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-white ${AVATAR_TONES[hash(name) % AVATAR_TONES.length]} ${AVATAR_SIZES[size]}`}
    >
      {initials(name)}
    </span>
  );
}

const COVER_TONES = [
  "from-leaf-500 to-leaf-900",
  "from-amber-500 to-orange-800",
  "from-sky-600 to-indigo-900",
  "from-rose-500 to-rose-900",
  "from-violet-500 to-violet-900",
  "from-teal-500 to-teal-900",
];
const COVER_SIZES = { sm: "h-11 w-8 text-sm", md: "h-24 w-[4.25rem] text-2xl" };

/** A generated cover: colour from the title, with a spine and the first letter. */
export function BookCover({ title, size = "md" }: { title: string; size?: keyof typeof COVER_SIZES }) {
  return (
    <div
      aria-hidden
      className={`relative shrink-0 overflow-hidden rounded-l-sm rounded-r-md bg-linear-to-br shadow-md ring-1 ring-black/10 ${COVER_TONES[hash(title) % COVER_TONES.length]} ${COVER_SIZES[size]}`}
    >
      <span className="absolute inset-y-0 left-0 w-[12%] bg-black/20" />
      <span className="absolute inset-y-0 left-[12%] w-px bg-white/30" />
      <span className="absolute inset-0 grid place-items-center pl-[12%] font-display font-semibold text-white/95">
        {title.charAt(0)}
      </span>
      {size === "md" && <span className="absolute inset-x-3 bottom-3 ml-[12%] h-px bg-white/40" />}
    </div>
  );
}
