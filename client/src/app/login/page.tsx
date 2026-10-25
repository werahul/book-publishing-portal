import type { Metadata } from "next";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · BookLeaf Support" };

const HIGHLIGHTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "wallet", title: "Royalties, explained", text: "See what you've earned, what's been paid and when the next payout lands." },
  { icon: "book", title: "Every title in one place", text: "Track each book from manuscript to published & live." },
  { icon: "message", title: "A team that answers", text: "Raise a request and follow our reply right here, usually within a business day." },
];

export default function LoginPage() {
  return (
    <div className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-leaf-950 via-leaf-800 to-leaf-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-leaf-400/20 blur-3xl" />
          <div className="absolute right-0 bottom-0 size-80 rounded-full bg-amber-200/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <Icon name="leaf" strokeWidth={0.75} className="absolute -right-20 -bottom-16 size-[26rem] animate-float text-white/[0.07]" />
          <Icon name="leaf" strokeWidth={1} className="absolute top-1/3 right-24 size-20 rotate-[60deg] text-white/10" />
        </div>

        <div className="relative">
          <Logo inverted />
        </div>

        <div className="relative max-w-md space-y-8">
          <h2 className="font-display text-4xl leading-tight font-semibold tracking-tight text-balance xl:text-5xl">
            Your book&apos;s journey, <span className="text-leaf-200 italic">in one place.</span>
          </h2>
          <ul className="space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                  <Icon name={h.icon} className="size-5 text-leaf-100" />
                </span>
                <div>
                  <p className="font-medium">{h.title}</p>
                  <p className="text-sm text-leaf-100/75">{h.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-leaf-100/60">BookLeaf Publishing · Author Support</p>
      </aside>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="mb-6 space-y-1.5">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">Welcome back</h1>
            <p className="text-sm text-stone-500">Sign in to track your books, royalties and support requests.</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
