const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "—" for values that don't apply yet (e.g. MRP of a book still in production). */
export function formatINR(value: number | null): string {
  return value === null ? "—" : inr.format(value);
}

/** Calendar dates (publication, payout) — stored as UTC midnight. */
export function formatDate(iso: string | Date | null): string {
  return iso ? dateFormat.format(new Date(iso)) : "—";
}

/** Timestamps (messages, activity), shown in IST — BookLeaf's operating timezone. */
export function formatDateTime(iso: string): string {
  return `${dateTimeFormat.format(new Date(iso))} IST`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

/** "just now", "5m", "3h", "2d" — compact age for queues and lists. */
export function formatAge(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
