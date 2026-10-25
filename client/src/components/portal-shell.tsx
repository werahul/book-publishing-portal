import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthUser } from "@/lib/types";
import { LogoutButton } from "./logout-button";
import { NavLinks, type NavItem } from "./nav-links";
import { Avatar, Logo } from "./ui";

type Portal = "author" | "admin";

const PORTAL_LABEL: Record<Portal, string> = { author: "Author Portal", admin: "Support Console" };
const PORTAL_CHIP: Record<Portal, string> = {
  author: "bg-leaf-50 text-leaf-700 ring-leaf-200",
  admin: "bg-stone-900 text-leaf-100 ring-stone-900",
};

const NAV: Record<Portal, NavItem[]> = {
  author: [
    { href: "/author", label: "Dashboard", icon: "dashboard", exact: true },
    { href: "/author/books", label: "My Books", icon: "book" },
    { href: "/author/tickets", label: "My Tickets", icon: "ticket" },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
    { href: "/admin/tickets", label: "Ticket Queue", icon: "inbox" },
    { href: "/admin/authors", label: "Authors", icon: "users" },
  ],
};

/** Shared chrome for both portals. The static frame prerenders; the user menu streams in. */
export function PortalShell({ portal, children }: { portal: Portal; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-paper/75 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={`/${portal}`} className="flex items-center gap-3">
            <Logo />
            <span
              className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1 sm:inline ${PORTAL_CHIP[portal]}`}
            >
              {PORTAL_LABEL[portal]}
            </span>
          </Link>
          <div className="order-last -mx-1 w-full md:order-none md:mx-0 md:w-auto">
            <NavLinks items={NAV[portal]} />
          </div>
          <div className="ml-auto">
            <Suspense fallback={<div className="h-9 w-44 animate-pulse rounded-full bg-stone-200/60" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-stone-200/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-stone-400">
          <span>BookLeaf Publishing · {PORTAL_LABEL[portal]}</span>
          <a href="mailto:support@bookleaf.com" className="hover:text-leaf-700">
            support@bookleaf.com
          </a>
        </div>
      </footer>
    </div>
  );
}

async function UserMenu() {
  const { data } = await serverFetch<ApiData<{ user: AuthUser }>>("/auth/me");
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/80 py-1 pr-1 pl-1 shadow-soft ring-1 ring-stone-200/80">
      <Avatar name={data.user.name} />
      <div className="hidden pr-1 leading-tight sm:block">
        <p className="text-sm font-medium text-stone-900">{data.user.name}</p>
        <p className="text-[11px] text-stone-500">{data.user.email}</p>
      </div>
      <LogoutButton portal={data.user.role} />
    </div>
  );
}
