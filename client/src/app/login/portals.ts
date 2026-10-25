import type { Role } from "@bookleaf/shared";
import type { IconName } from "@/components/icons";

export interface DemoAccount {
  name: string;
  note: string;
  email: string;
  password: string;
}

/**
 * Copy and theme for each sign-in tab. Both tabs post to the same endpoint and
 * get the same session cookie; only the look and the `portal` hint differ.
 * Class names are written out in full so Tailwind can see them.
 */
export interface LoginPortalConfig {
  tabLabel: string;
  tabIcon: IconName;
  /** Small chip above the form heading. */
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
  emailPlaceholder: string;
  submitLabel: string;
  submitClass: string;
  /** Ring on the selected demo account. */
  selectedClass: string;
  panel: {
    background: string;
    glowA: string;
    glowB: string;
    motif: IconName;
    headline: string;
    headlineAccent: string;
    accentClass: string;
    iconClass: string;
    mutedClass: string;
    footer: string;
  };
  highlights: { icon: IconName; title: string; text: string }[];
  demoAccounts: DemoAccount[];
}

export const LOGIN_PORTALS: Record<Role, LoginPortalConfig> = {
  author: {
    tabLabel: "Author",
    tabIcon: "book",
    badge: "Author portal",
    badgeClass: "bg-leaf-50 text-leaf-700 ring-leaf-200",
    title: "Welcome back",
    subtitle: "Sign in to track your books, royalties and support requests.",
    emailPlaceholder: "you@example.com",
    submitLabel: "Sign in",
    submitClass: "btn-primary",
    selectedClass: "border-leaf-400 ring-4 ring-leaf-500/10",
    panel: {
      background: "from-leaf-950 via-leaf-800 to-leaf-600",
      glowA: "bg-leaf-400/20",
      glowB: "bg-amber-200/10",
      motif: "leaf",
      headline: "Your book's journey,",
      headlineAccent: "in one place.",
      accentClass: "text-leaf-200",
      iconClass: "text-leaf-100",
      mutedClass: "text-leaf-100/75",
      footer: "BookLeaf Publishing · Author Support",
    },
    highlights: [
      { icon: "wallet", title: "Royalties, explained", text: "See what you've earned, what's been paid and when the next payout lands." },
      { icon: "book", title: "Every title in one place", text: "Track each book from manuscript to published & live." },
      { icon: "message", title: "A team that answers", text: "Raise a request and follow our reply right here, usually within a business day." },
    ],
    demoAccounts: [
      { name: "Priya Sharma", note: "Live books & royalties", email: "priya.sharma@email.com", password: "Author@123" },
      { name: "Sneha Kulkarni", note: "Book in production", email: "sneha.kulkarni@email.com", password: "Author@123" },
      { name: "Kavita Deshmukh", note: "Payout below the ₹1,000 threshold", email: "kavita.deshmukh@email.com", password: "Author@123" },
    ],
  },
  admin: {
    tabLabel: "BookLeaf Team",
    tabIcon: "inbox",
    badge: "Internal · Team only",
    badgeClass: "bg-stone-900 text-indigo-100 ring-stone-900",
    title: "Team sign in",
    subtitle: "Sign in to the support console to work the ticket queue.",
    emailPlaceholder: "name@bookleaf.com",
    submitLabel: "Sign in to the console",
    submitClass: "btn-team",
    selectedClass: "border-indigo-400 ring-4 ring-indigo-500/10",
    panel: {
      background: "from-stone-950 via-stone-900 to-indigo-950",
      glowA: "bg-indigo-500/20",
      glowB: "bg-violet-400/10",
      motif: "sparkles",
      headline: "The support console,",
      headlineAccent: "built for fast answers.",
      accentClass: "text-indigo-200",
      iconClass: "text-indigo-200",
      mutedClass: "text-stone-300/75",
      footer: "BookLeaf Publishing · Internal tools",
    },
    highlights: [
      { icon: "flame", title: "Urgent first", text: "One queue for every author, sorted by priority and age, with stale tickets flagged." },
      { icon: "sparkles", title: "AI-drafted replies", text: "Every ticket is triaged, and a draft grounded in BookLeaf policy is ready to edit." },
      { icon: "lock", title: "Notes that stay internal", text: "Share context with the team. Authors never see it." },
    ],
    demoAccounts: [
      { name: "Aisha Verma", note: "Support Lead", email: "admin@bookleaf.com", password: "Admin@123" },
      { name: "Rahul Mehta", note: "Support Agent", email: "support@bookleaf.com", password: "Admin@123" },
    ],
  },
};

export const PORTAL_ORDER: Role[] = ["author", "admin"];
