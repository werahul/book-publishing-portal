"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { disconnectRealtime } from "@/lib/realtime";
import { Icon } from "./icons";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    disconnectRealtime();
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      // Even if the request failed, leave the portal; the proxy re-checks the cookie.
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      title="Sign out"
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
    >
      <Icon name="logout" className="size-4" />
      <span className="hidden lg:inline">{pending ? "Signing out…" : "Sign out"}</span>
      <span className="sr-only lg:hidden">Sign out</span>
    </button>
  );
}
