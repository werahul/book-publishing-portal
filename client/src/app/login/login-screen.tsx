"use client";

import { useState } from "react";
import type { Role } from "@bookleaf/shared";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/ui";
import { loginPathFor } from "@/lib/routes";
import { LoginForm } from "./login-form";
import { LOGIN_PORTALS, PORTAL_ORDER, type LoginPortalConfig } from "./portals";

/**
 * Sign-in with an Author / BookLeaf Team toggle. The tab is kept in the URL
 * (`?as=team`) via the native History API, which Next's router stays in sync with,
 * so switching is instant and the team can bookmark their link.
 */
export function LoginScreen({ initialPortal }: { initialPortal: Role }) {
  const [portal, setPortal] = useState<Role>(initialPortal);
  const config = LOGIN_PORTALS[portal];

  function switchTo(next: Role) {
    setPortal(next);
    window.history.replaceState(null, "", loginPathFor(next));
  }

  return (
    <div className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel key={portal} config={config} />

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <PortalToggle portal={portal} onChange={switchTo} />

          <div key={portal} className="mt-8 mb-6 animate-rise space-y-2">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1 ${config.badgeClass}`}>
              {config.badge}
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">{config.title}</h1>
            <p className="text-sm text-stone-500">{config.subtitle}</p>
          </div>

          <LoginForm portal={portal} onSwitchPortal={switchTo} />
        </div>
      </div>
    </div>
  );
}

function PortalToggle({ portal, onChange }: { portal: Role; onChange: (portal: Role) => void }) {
  return (
    <div role="tablist" aria-label="Sign in as" className="grid grid-cols-2 gap-1 rounded-full bg-stone-900/[0.05] p-1 ring-1 ring-stone-900/5">
      {PORTAL_ORDER.map((p) => {
        const active = p === portal;
        const { tabLabel, tabIcon } = LOGIN_PORTALS[p];
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !active && onChange(p)}
            className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition ${
              active
                ? p === "admin"
                  ? "bg-stone-900 text-white shadow-soft"
                  : "bg-white text-leaf-800 shadow-soft ring-1 ring-stone-200"
                : "text-stone-600 hover:bg-white/60 hover:text-stone-900"
            }`}
          >
            <Icon name={tabIcon} className={`size-4 ${active ? (p === "admin" ? "text-indigo-200" : "text-leaf-600") : "text-stone-400"}`} />
            {tabLabel}
          </button>
        );
      })}
    </div>
  );
}

function BrandPanel({ config }: { config: LoginPortalConfig }) {
  const { panel, highlights } = config;
  return (
    <aside className={`relative hidden overflow-hidden bg-linear-to-br p-12 text-white lg:flex lg:flex-col lg:justify-between ${panel.background}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className={`absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl ${panel.glowA}`} />
        <div className={`absolute right-0 bottom-0 size-80 rounded-full blur-3xl ${panel.glowB}`} />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <Icon name={panel.motif} strokeWidth={0.75} className="absolute -right-20 -bottom-16 size-[26rem] text-white/[0.07]" />
        <Icon name={panel.motif} strokeWidth={1} className="absolute top-1/3 right-24 size-20 rotate-[60deg] text-white/10" />
      </div>

      <div className="relative">
        <Logo inverted />
      </div>

      <div className="relative max-w-md animate-rise space-y-8">
        <h2 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance xl:text-5xl">
          {panel.headline} <span className={`italic ${panel.accentClass}`}>{panel.headlineAccent}</span>
        </h2>
        <ul className="space-y-5">
          {highlights.map((h) => (
            <li key={h.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <Icon name={h.icon} className={`size-5 ${panel.iconClass}`} />
              </span>
              <div>
                <p className="font-medium">{h.title}</p>
                <p className={`text-sm ${panel.mutedClass}`}>{h.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className={`relative text-xs ${panel.mutedClass}`}>{panel.footer}</p>
    </aside>
  );
}
