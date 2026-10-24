import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@bookleaf/shared";
import { homeFor } from "@/lib/routes";
import { verifySession } from "@/lib/session";

/**
 * Route guard (Next 16 "proxy", formerly middleware). UX only:
 * - logged-out visitors → /login
 * - each role is kept inside its own portal (/author or /admin)
 * Real authorization happens in the API on every request.
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (pathname === "/login") {
    // ?reauth=1 means the API rejected a token that still verifies here
    // (e.g. the user was deleted). Drop it so we don't bounce back into the portal.
    if (searchParams.has("reauth")) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
    return session ? redirectTo(homeFor(session.role)) : NextResponse.next();
  }

  if (!session) return redirectTo("/login");

  const home = homeFor(session.role);
  const insideOwnPortal = pathname === home || pathname.startsWith(`${home}/`);
  return insideOwnPortal ? NextResponse.next() : redirectTo(home);
}

export const config = {
  matcher: ["/", "/login", "/author/:path*", "/admin/:path*"],
};
