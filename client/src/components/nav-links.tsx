"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

export interface NavItem {
  href: string;
  label: string;
  /** Match only the exact path (for portal home links). */
  exact?: boolean;
}

/**
 * usePathname() is runtime data, so it must sit inside <Suspense> (cacheComponents).
 * The fallback renders identical links without the active state, so nothing shifts.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  return (
    <Suspense fallback={<NavList items={items} pathname={null} />}>
      <ActiveNavList items={items} />
    </Suspense>
  );
}

function ActiveNavList({ items }: { items: NavItem[] }) {
  return <NavList items={items} pathname={usePathname()} />;
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active =
          pathname !== null &&
          (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
              active ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
