"use client";

import { useEffect } from "react";

/** Friendly fallback when a portal page fails (e.g. the API is unreachable). */
export function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-lg border border-red-200 bg-white p-8 text-center">
      <p className="font-medium text-slate-900">We couldn&apos;t load this page.</p>
      <p className="mt-1 text-sm text-slate-500">
        This is usually temporary. Please try again — if it keeps happening, contact support@bookleaf.com.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Try again
      </button>
    </div>
  );
}
