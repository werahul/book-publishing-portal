"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_ATTACHMENTS, createTicketSchema, type CreateTicketInput } from "@bookleaf/shared";
import { ApiError, apiFetch } from "@/lib/api";
import { Icon } from "@/components/icons";
import { formatBytes } from "@/lib/format";
import type { ApiData, AuthorTicket } from "@/lib/types";

interface BookOption {
  id: string;
  title: string;
  inProduction: boolean;
}

type FieldErrors = Partial<Record<"bookId" | "subject" | "description" | "attachments", string>>;

const inputClass = "field";

export function NewTicketForm({ books, initialBookId }: { books: BookOption[]; initialBookId: string }) {
  const router = useRouter();
  const [bookId, setBookId] = useState(initialBookId);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    setFiles((prev) => [...prev, ...chosen].slice(0, MAX_ATTACHMENTS));
    event.target.value = "";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const input: CreateTicketInput = {
      bookId: bookId || null,
      subject,
      description,
      // Attachments are metadata only for now (upload is out of scope).
      attachments: files.map((f) => ({ name: f.name, size: f.size, mimeType: f.type || "application/octet-stream" })),
    };

    const parsed = createTicketSchema.safeParse(input);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    setPending(true);
    try {
      const { data } = await apiFetch<ApiData<AuthorTicket>>("/tickets", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      router.push(`/author/tickets/${data.id}?created=1`);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const next: FieldErrors = {};
        for (const d of err.details) next[d.path.replace(/^body\./, "").split(".")[0] as keyof FieldErrors] ??= d.message;
        setErrors(next);
      }
      setFormError(err instanceof ApiError ? err.message : "Could not reach the server. Please try again.");
      setPending(false);
    }
  }

  const selectedBook = books.find((b) => b.id === bookId);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <Icon name="alert" className="mt-0.5 size-4" />
          {formError}
        </p>
      )}

      <Field label="Which book is this about?" htmlFor="ticket-book" error={errors.bookId}>
        <select id="ticket-book" value={bookId} onChange={(e) => setBookId(e.target.value)} className={inputClass}>
          <option value="">General / Account Level</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
              {b.inProduction ? " (in production)" : ""}
            </option>
          ))}
        </select>
        {selectedBook?.inProduction && (
          <p className="mt-1 text-xs text-stone-500">We&apos;ll include this book&apos;s current production stage when we look into it.</p>
        )}
      </Field>

      <Field label="Subject" htmlFor="ticket-subject" error={errors.subject}>
        <input
          id="ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          placeholder="e.g. Royalty for last quarter not received"
          className={inputClass}
        />
      </Field>

      <Field label="Describe the issue" htmlFor="ticket-description" error={errors.description}>
        <textarea
          id="ticket-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={7}
          maxLength={5000}
          placeholder="Include what you expected, what happened, and any dates, amounts or order numbers that help."
          className={`${inputClass} leading-relaxed`}
        />
        <p className="mt-1 text-right text-xs text-stone-400 tabular-nums">{description.trim().length} / 5,000</p>
      </Field>

      <Field label="Attachments (optional)" error={errors.attachments}>
        <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/50 px-3 py-6 text-center text-sm text-stone-500 transition hover:border-leaf-400 hover:bg-leaf-50/50 hover:text-leaf-800">
          <span className="grid size-10 place-items-center rounded-full bg-white text-leaf-600 shadow-soft ring-1 ring-stone-200 transition group-hover:scale-105">
            <Icon name="upload" className="size-5" />
          </span>
          <input type="file" multiple className="sr-only" onChange={onFilesChosen} disabled={files.length >= MAX_ATTACHMENTS} />
          {files.length >= MAX_ATTACHMENTS
            ? `Maximum of ${MAX_ATTACHMENTS} files`
            : "Choose screenshots, photos or documents (up to 10 MB each)"}
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-600">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <Icon name="paperclip" className="size-3.5 text-stone-400" />
                  {file.name} · {formatBytes(file.size)}
                </span>
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="ml-2 text-stone-400 hover:text-red-600">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-stone-400">
          File names are shared with our team; if we need the files themselves we&apos;ll ask you in the ticket.
        </p>
      </Field>

      <div className="flex justify-end gap-2 border-t border-stone-100 pt-5">
        <button type="button" onClick={() => router.back()} className="btn btn-ghost">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Submitting…" : "Submit ticket"}
          {!pending && <Icon name="arrowRight" className="size-4" />}
        </button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
