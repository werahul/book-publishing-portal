import type { Role } from "@bookleaf/shared";

/** Landing page of each portal. */
export function homeFor(role: Role): "/admin" | "/author" {
  return role === "admin" ? "/admin" : "/author";
}
