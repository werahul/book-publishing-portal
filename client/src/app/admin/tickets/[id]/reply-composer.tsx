"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { TICKET_STATUS_LABELS, createMessageSchema, type TicketStatus } from "@bookleaf/shared";
import { Icon } from "@/components/icons";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AiDraft, ApiData } from "@/lib/types";

type AfterSend = "" | Extract<TicketStatus, "resolved" | "closed">;

/** The editor's text, plus the AI draft it started from (null = written by hand). */
interface Editor {
  body: string;
  fromDraft: string | null;
}

type DraftState =
  | { kind: "idle" } // nothing requested, e.g. we replied last
  | { kind: "loading"; regenerate: boolean }
  | { kind: "ready"; draft: AiDraft }
  | { kind: "error"; message: string };

const isUntouched = (editor: Editor) => editor.body.trim() === "" || editor.body === editor.fromDraft;

function initialState(initialDraft: AiDraft | null, awaitingReply: boolean): { editor: Editor; draft: DraftState } {
  if (initialDraft) {
    return { editor: { body: initialDraft.body, fromDraft: initialDraft.body }, draft: { kind: "ready", draft: initialDraft } };
  }
  return { editor: { body: "", fromDraft: null }, draft: awaitingReply ? { kind: "loading", regenerate: false } : { kind: "idle" } };
}

interface Props {
  ticketId: string;
  authorFirstName: string;
  status: TicketStatus;
  /** Cached draft from the ticket payload, so a revisit pre-fills instantly. */
  initialDraft: AiDraft | null;
  /** The author spoke last (or nobody has replied yet), so a draft is wanted straight away. */
  awaitingReply: boolean;
  /** Changes whenever a message is added to the thread (e.g. arrives live). */
  threadKey: string;
}

/**
 * The agent's reply box. When the ticket is waiting on us, it opens pre-filled
 * with an AI draft grounded in the knowledge base. The agent edits it and sends;
 * nothing is ever sent automatically. If the AI is unavailable, the box works as
 * a plain manual editor.
 */
export function ReplyComposer({ ticketId, authorFirstName, status, initialDraft, awaitingReply, threadKey }: Props) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor>(() => initialState(initialDraft, awaitingReply).editor);
  const [draft, setDraft] = useState<DraftState>(() => initialState(initialDraft, awaitingReply).draft);
  const [seenThreadKey, setSeenThreadKey] = useState(threadKey);
  const [threadMoved, setThreadMoved] = useState(false);
  const [after, setAfter] = useState<AfterSend>("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  // A message was added (it arrived live, or we just sent one). If the editor holds
  // nothing of the agent's own, re-sync with the server; otherwise keep their text
  // and offer a fresh draft instead of overwriting it.
  if (threadKey !== seenThreadKey) {
    setSeenThreadKey(threadKey);
    if (isUntouched(editor)) {
      const next = initialState(initialDraft, awaitingReply);
      setEditor(next.editor);
      setDraft(next.draft);
      setThreadMoved(false);
    } else if (awaitingReply) {
      setThreadMoved(true);
    }
  }

  useEffect(() => {
    if (draft.kind !== "loading") return;
    let cancelled = false;
    const { regenerate } = draft;
    apiFetch<ApiData<AiDraft, { cached: boolean }>>(`/tickets/${ticketId}/ai-draft`, { method: regenerate ? "POST" : "GET" }).then(
      ({ data }) => {
        if (cancelled) return;
        setDraft({ kind: "ready", draft: data });
        // An explicit regenerate replaces the text; an automatic load never clobbers the agent's typing.
        setEditor((prev) => (regenerate || isUntouched(prev) ? { body: data.body, fromDraft: data.body } : prev));
        if (regenerate) setThreadMoved(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setDraft({
          kind: "error",
          message: err instanceof ApiError ? err.message : "The AI draft could not be loaded.",
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [draft, ticketId]);

  if (status === "closed") {
    return (
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <Icon name="lock" className="size-4" />
        This ticket is closed. Reopen it (set the status to In Progress) to reply.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createMessageSchema.safeParse({ body: editor.body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Write a reply first");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await apiFetch(`/tickets/${ticketId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: parsed.data.body, aiAssisted: editor.fromDraft !== null }),
      });
      if (after) await apiFetch(`/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ status: after }) });
      setEditor({ body: "", fromDraft: null });
      setDraft({ kind: "idle" });
      setThreadMoved(false);
      setAfter("");
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const busy = sending || refreshing;
  const loadingDraft = draft.kind === "loading";
  const edited = editor.fromDraft !== null && editor.body !== editor.fromDraft;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="admin-reply" className="flex items-center gap-2 font-display text-lg font-semibold text-stone-900">
          <Icon name="message" className="size-5 text-leaf-600" />
          Reply to {authorFirstName}
        </label>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">Visible to the author</span>
      </div>

      {threadMoved && (
        <div className="flex animate-rise flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span>{authorFirstName} sent a new message while you were writing.</span>
          <SmallButton onClick={() => setDraft({ kind: "loading", regenerate: true })} disabled={loadingDraft}>
            Redraft with AI (replaces your text)
          </SmallButton>
        </div>
      )}

      <DraftBar
        draft={draft}
        edited={edited}
        usingDraft={editor.fromDraft !== null}
        onDraft={() => setDraft({ kind: "loading", regenerate: false })}
        onRegenerate={() => setDraft({ kind: "loading", regenerate: true })}
        onUse={(d) => setEditor({ body: d.body, fromDraft: d.body })}
        onDiscard={() => {
          setEditor({ body: "", fromDraft: null });
          setDraft({ kind: "idle" });
        }}
      />

      <textarea
        id="admin-reply"
        value={editor.body}
        onChange={(e) => {
          const body = e.target.value;
          // Clearing the box entirely means the agent is now writing their own reply.
          setEditor((prev) => ({ body, fromDraft: body.trim() === "" ? null : prev.fromDraft }));
        }}
        rows={10}
        maxLength={10000}
        placeholder={loadingDraft ? "Drafting a reply… or start typing to write your own." : `Hi ${authorFirstName},\n\n`}
        className={`field leading-relaxed ${editor.fromDraft !== null ? "border-indigo-200 bg-indigo-50/20 focus:border-indigo-400 focus:ring-indigo-400/15" : ""}`}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-sm text-stone-600">
          and
          <select
            value={after}
            onChange={(e) => setAfter(e.target.value as AfterSend)}
            className="field w-auto px-2.5 py-1.5"
          >
            <option value="">keep status{status === "open" ? " (moves to In Progress)" : ""}</option>
            <option value="resolved">mark {TICKET_STATUS_LABELS.resolved}</option>
            <option value="closed">mark {TICKET_STATUS_LABELS.closed}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
        >
          {busy ? "Sending…" : "Send reply"}
          {!busy && <Icon name="arrowRight" className="size-4" />}
        </button>
      </div>
    </form>
  );
}

function DraftBar({
  draft,
  edited,
  usingDraft,
  onDraft,
  onRegenerate,
  onUse,
  onDiscard,
}: {
  draft: DraftState;
  edited: boolean;
  usingDraft: boolean;
  onDraft: () => void;
  onRegenerate: () => void;
  onUse: (draft: AiDraft) => void;
  onDiscard: () => void;
}) {
  switch (draft.kind) {
    case "idle":
      return (
        <div className="flex justify-end">
          <SmallButton onClick={onDraft}>
            <Icon name="sparkles" className="size-3.5" />
            Draft a reply with AI
          </SmallButton>
        </div>
      );
    case "loading":
      return (
        <p
          role="status"
          className="relative flex items-center gap-2 overflow-hidden rounded-lg bg-linear-to-r from-indigo-50 to-violet-50 px-3 py-2.5 text-sm text-indigo-800 ring-1 ring-indigo-100"
        >
          <Icon name="sparkles" className="relative size-4" />
          <span className="relative">Drafting a reply from the BookLeaf knowledge base…</span>
        </p>
      );
    case "error":
      return (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>
            <strong>AI draft unavailable.</strong> {draft.message}
          </span>
          <SmallButton onClick={onDraft}>Try again</SmallButton>
        </div>
      );
    case "ready":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-linear-to-r from-indigo-50 to-violet-50 px-3 py-2 text-xs text-indigo-900 ring-1 ring-indigo-100">
          <span className="flex items-start gap-2">
            <Icon name="sparkles" className="mt-px size-4 text-indigo-600" />
            <span>
              <strong className="font-semibold">AI draft{edited && " (edited)"}</strong> · {draft.draft.model} ·{" "}
              {formatDateTime(draft.draft.generatedAt)}. Check facts and tone before sending.
            </span>
          </span>
          <span className="flex gap-1.5">
            {!usingDraft && <SmallButton onClick={() => onUse(draft.draft)}>Use draft</SmallButton>}
            <SmallButton onClick={onRegenerate}>Regenerate</SmallButton>
            {usingDraft && <SmallButton onClick={onDiscard}>Discard</SmallButton>}
          </span>
        </div>
      );
  }
}

function SmallButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn btn-ai btn-sm"
    >
      {children}
    </button>
  );
}
