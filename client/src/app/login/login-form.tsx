"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { loginSchema, type Role } from "@bookleaf/shared";
import { ApiError, apiFetch } from "@/lib/api";
import { homeFor } from "@/lib/routes";
import type { ApiData, AuthUser } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { LOGIN_PORTALS } from "./portals";

type FieldErrors = Partial<Record<"email" | "password", string>>;

/** An error belongs to the tab it happened on, so switching tabs clears it without an effect. */
interface FormError {
  portal: Role;
  message: string;
  /** Set when the account belongs to the other tab (403 WRONG_PORTAL). */
  switchTo?: Role;
}

const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS !== "false";

export function LoginForm({ portal, onSwitchPortal }: { portal: Role; onSwitchPortal: (portal: Role) => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [pending, setPending] = useState(false);
  const config = LOGIN_PORTALS[portal];
  const error = formError?.portal === portal ? formError : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Same schema the API validates with (@bookleaf/shared).
    const parsed = loginSchema.safeParse({ email, password, portal });
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
      if (err instanceof ApiError) {
        const switchTo = err.code === "WRONG_PORTAL" ? (portal === "admin" ? "author" : "admin") : undefined;
        setFormError({ portal, message: err.message, switchTo });
      } else {
        setFormError({ portal, message: "Could not reach the server. Please try again." });
      }
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1.5">
              <p>{error.message}</p>
              {error.switchTo && (
                // Credentials stay filled in, so the next click on "Sign in" just works.
                <button
                  type="button"
                  onClick={() => onSwitchPortal(error.switchTo!)}
                  className="inline-flex items-center gap-1 font-medium text-red-800 underline underline-offset-2 hover:text-red-900"
                >
                  Switch to {LOGIN_PORTALS[error.switchTo].tabLabel} sign-in
                  <Icon name="arrowRight" className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <Field label="Email" error={fieldErrors.email}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={config.emailPlaceholder}
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

        <button type="submit" disabled={pending} className={`btn w-full py-2.5 ${config.submitClass}`}>
          {pending ? "Signing in…" : config.submitLabel}
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
          <ul key={portal} className="animate-rise space-y-2">
            {config.demoAccounts.map((account) => {
              const selected = email === account.email;
              return (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                    }}
                    className={`group flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition hover:-translate-y-px hover:shadow-soft ${
                      selected ? config.selectedClass : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <Avatar name={account.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-stone-900">{account.name}</span>
                      <span className="block text-xs text-stone-500">{account.note}</span>
                    </span>
                    <Icon name="arrowRight" className="size-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />
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
