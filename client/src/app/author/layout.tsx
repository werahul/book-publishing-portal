import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";

export default function AuthorLayout({ children }: { children: ReactNode }) {
  return <PortalShell portal="author">{children}</PortalShell>;
}
