import { formatBytes, formatDateTime } from "@/lib/format";
import type { AuthorTicket, TicketMessage } from "@/lib/types";
import { Icon } from "./icons";
import { Avatar, LogoMark, Prose } from "./ui";

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
    <ol className="space-y-5">
      <li>
        <Bubble
          mine={viewer === "author"}
          name={viewer === "author" ? "You" : authorName}
          avatarName={authorName}
          role="author"
          at={ticket.createdAt}
          label="Original request"
        >
          <Prose>{ticket.description}</Prose>
          {ticket.attachments.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {ticket.attachments.map((a, i) => (
                <li
                  key={`${a.name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600"
                >
                  <Icon name="paperclip" className="size-3.5 text-stone-400" />
                  {a.name} <span className="text-stone-400">({formatBytes(a.size)})</span>
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
            avatarName={m.sender.name}
            role={m.senderRole}
            at={m.createdAt}
            ai={viewer === "admin" && m.aiAssisted}
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
  avatarName,
  role,
  at,
  label,
  ai,
  children,
}: {
  mine: boolean;
  name: string;
  avatarName: string;
  role: "author" | "admin";
  at: string;
  label?: string;
  ai?: boolean;
  children: React.ReactNode;
}) {
  const staff = role === "admin";
  const surface = staff
    ? "border-leaf-200/80 bg-linear-to-br from-leaf-50 to-white"
    : "border-stone-200/80 bg-white";
  const corner = mine ? "rounded-tr-sm" : "rounded-tl-sm";

  return (
    <div className={`flex animate-rise items-start gap-3 ${mine ? "flex-row-reverse" : ""}`}>
      {staff ? <LogoMark className="mt-0.5 size-8 rounded-full" /> : <span className="mt-0.5"><Avatar name={avatarName} /></span>}
      <div className={`w-full max-w-2xl rounded-2xl border p-4 shadow-soft ${surface} ${corner}`}>
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          <span className="font-semibold text-stone-800">{name}</span>
          {staff && <span className="font-medium text-leaf-700">BookLeaf Support</span>}
          {label && <span className="rounded-full bg-stone-100 px-2 py-px font-medium text-stone-600">{label}</span>}
          {ai && (
            <span className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-indigo-50 to-violet-50 px-2 py-px font-medium text-indigo-700 ring-1 ring-indigo-200">
              <Icon name="sparkles" className="size-3" />
              AI-assisted
            </span>
          )}
          <time dateTime={at} className="ml-auto tabular-nums">
            {formatDateTime(at)}
          </time>
        </div>
        {children}
      </div>
    </div>
  );
}
