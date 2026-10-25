"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { loginSchema } from "@bookleaf/shared";
import { ApiError, apiFetch } from "@/lib/api";
import { homeFor } from "@/lib/routes";
import type { ApiData, AuthUser } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui";

type FieldErrors = Partial<Record<"email" | "password", string>>;

const DEMO_ACCOUNTS = [
  { name: "Priya Sharma", role: "Author", note: "Live books & royalties", email: "priya.sharma@email.com", password: "Author@123" },
  { name: "Sneha Kulkarni", role: "Author", note: "Book in production", email: "sneha.kulkarni@email.com", password: "Author@123" },
  { name: "Support Lead", role: "Admin", note: "Support console", email: "admin@bookleaf.com", password: "Admin@123" },
];
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS !== "false";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Same schema the API validates with (@bookleaf/shared).
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setPending(true);
    try {
      const { data } = await apiFetch<ApiData<{ user: AuthUser }>>("/auth/login", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      router.replace(homeFor(data.user.role));
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not reach the server. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <Icon name="alert" className="mt-0.5 size-4" />
            {formError}
          </p>
        )}

        <Field label="Email" error={fieldErrors.email}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="field py-2.5 text-base sm:text-sm"
          />
        </Field>

        <Field label="Password" error={fieldErrors.password}>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="field py-2.5 text-base sm:text-sm"
          />
        </Field>

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary w-full py-2.5"
        >
          {pending ? "Signing in…" : "Sign in"}
          {!pending && <Icon name="arrowRight" className="size-4" />}
        </button>
      </form>

      {SHOW_DEMO && (
        <div>
          <div className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-wider text-stone-400 uppercase">
            <span className="h-px flex-1 bg-stone-200" />
            Try a demo account
            <span className="h-px flex-1 bg-stone-200" />
          </div>
          <ul className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => {
              const selected = email === account.email;
              return (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                    }}
                    className={`group flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition hover:-translate-y-px hover:border-leaf-300 hover:shadow-soft ${
                      selected ? "border-leaf-400 ring-4 ring-leaf-500/10" : "border-stone-200"
                    }`}
                  >
                    <Avatar name={account.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-stone-900">{account.name}</span>
                      <span className="block text-xs text-stone-500">{account.note}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                        account.role === "Admin" ? "bg-stone-900 text-leaf-100" : "bg-leaf-50 text-leaf-700"
                      }`}
                    >
                      {account.role}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {children}
      {error && <span className="block text-sm text-red-600">{error}</span>}
    </label>
  );
}
