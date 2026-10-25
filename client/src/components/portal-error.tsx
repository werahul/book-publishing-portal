"use client";

import { useEffect } from "react";
import { Icon } from "./icons";

/** Friendly fallback when a portal page fails (e.g. the API is unreachable). */
export function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="animate-rise rounded-2xl border border-red-200 bg-white p-10 text-center shadow-soft">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
        <Icon name="alert" className="size-6" />
      </span>
      <p className="font-display text-lg font-semibold text-stone-900">We couldn&apos;t load this page.</p>
      <p className="mt-1 text-sm text-stone-500">
        This is usually temporary. Please try again — if it keeps happening, contact support@bookleaf.com.
      </p>
      <button
        type="button"
        onClick={reset}
        className="btn btn-primary mt-5"
      >
        Try again
      </button>
    </div>
  );
}
