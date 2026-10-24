import { formatBytes, formatDateTime } from "@/lib/format";
import type { AuthorTicket, TicketMessage } from "@/lib/types";
import { Prose } from "./ui";

/**
 * The public conversation: the author's original query followed by every reply.
 * `viewer` decides which side is "me" (right-aligned) and whether AI markers show.
 */
export function TicketThread({
  ticket,
  authorName,
  messages,
  viewer,
}: {
  ticket: AuthorTicket;
  authorName: string;
  messages: TicketMessage[];
  viewer: "author" | "admin";
}) {
  return (
    <ol className="space-y-4">
      <li>
        <Bubble
          mine={viewer === "author"}
          name={viewer === "author" ? "You" : authorName}
          role="author"
          at={ticket.createdAt}
          label="Original request"
        >
          <Prose>{ticket.description}</Prose>
          {ticket.attachments.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {ticket.attachments.map((a, i) => (
                <li key={`${a.name}-${i}`} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                  📎 {a.name} <span className="text-slate-400">({formatBytes(a.size)})</span>
                </li>
              ))}
            </ul>
          )}
        </Bubble>
      </li>
      {messages.map((m) => (
        <li key={m.id}>
          <Bubble
            mine={m.senderRole === viewer}
            name={m.senderRole === viewer && viewer === "author" ? "You" : m.sender.name}
            role={m.senderRole}
            at={m.createdAt}
            label={viewer === "admin" && m.aiAssisted ? "AI-assisted" : undefined}
          >
            <Prose>{m.body}</Prose>
          </Bubble>
        </li>
      ))}
    </ol>
  );
}

function Bubble({
  mine,
  name,
  role,
  at,
  label,
  children,
}: {
  mine: boolean;
  name: string;
  role: "author" | "admin";
  at: string;
  label?: string;
  children: React.ReactNode;
}) {
  const colours = role === "admin" ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`w-full max-w-2xl rounded-lg border p-4 ${colours}`}>
        <div className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span className="font-medium text-slate-800">{name}</span>
          {role === "admin" && <span className="text-emerald-700">BookLeaf Support</span>}
          {label && <span className="rounded bg-slate-100 px-1.5 py-px text-slate-600">{label}</span>}
          <span className="ml-auto">{formatDateTime(at)}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
