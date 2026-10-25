"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Icon, type IconName } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
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
    <nav className="flex gap-1 overflow-x-auto rounded-full bg-stone-900/[0.04] p-1 ring-1 ring-stone-900/5 md:w-fit">
      {items.map((item) => {
        const active =
          pathname !== null &&
          (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition ${
              active
                ? "bg-white text-leaf-800 shadow-soft ring-1 ring-stone-200"
                : "text-stone-600 hover:bg-white/60 hover:text-stone-900"
            }`}
          >
            <Icon name={item.icon} className={`size-4 ${active ? "text-leaf-600" : "text-stone-400"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
