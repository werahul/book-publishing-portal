import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthUser } from "@/lib/types";
import { LogoutButton } from "./logout-button";
import { NavLinks, type NavItem } from "./nav-links";

type Portal = "author" | "admin";

const PORTAL_LABEL: Record<Portal, string> = { author: "Author Portal", admin: "Support Console" };

const NAV: Record<Portal, NavItem[]> = {
  author: [
    { href: "/author", label: "Dashboard", exact: true },
    { href: "/author/books", label: "My Books" },
    { href: "/author/tickets", label: "My Tickets" },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/tickets", label: "Ticket Queue" },
    { href: "/admin/authors", label: "Authors" },
  ],
};

/** Shared chrome for both portals. The static frame prerenders; the user menu streams in. */
export function PortalShell({ portal, children }: { portal: Portal; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href={`/${portal}`} className="flex items-center gap-2">
            <span className="text-lg font-semibold text-emerald-700">BookLeaf</span>
            <span className="hidden text-sm text-slate-500 sm:inline">{PORTAL_LABEL[portal]}</span>
          </Link>
          <Suspense fallback={<div className="h-8 w-40 animate-pulse rounded bg-slate-100" />}>
            <UserMenu />
          </Suspense>
        </div>
        <div className="mx-auto max-w-6xl px-2">
          <NavLinks items={NAV[portal]} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

async function UserMenu() {
  const { data } = await serverFetch<ApiData<{ user: AuthUser }>>("/auth/me");
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium text-slate-900">{data.user.name}</p>
        <p className="text-xs text-slate-500">{data.user.email}</p>
      </div>
      <LogoutButton />
    </div>
  );
}
