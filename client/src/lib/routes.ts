import type { Role } from "@bookleaf/shared";

/** Landing page of each portal. */
export function homeFor(role: Role): "/admin" | "/author" {
  return role === "admin" ? "/admin" : "/author";
}

/** The sign-in screen with the matching tab selected (`/login?as=team` for the support team). */
export function loginPathFor(role: Role): "/login" | "/login?as=team" {
  return role === "admin" ? "/login?as=team" : "/login";
}

/** Reads the `?as=` login param: "team" selects the admin tab, anything else the author tab. */
export function loginPortalFromParam(value: string | string[] | undefined): Role {
  return value === "team" ? "admin" : "author";
}
