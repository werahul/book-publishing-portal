import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalShell portal="admin">{children}</PortalShell>;
}
