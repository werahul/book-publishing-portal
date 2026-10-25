import type { Metadata } from "next";
import { Suspense } from "react";
import { loginPortalFromParam } from "@/lib/routes";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = { title: "Sign in · BookLeaf Support" };

/**
 * One sign-in screen with an Author / BookLeaf Team toggle (`?as=team`).
 * The tab is resolved on the server so a team link never flashes the author theme.
 */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <ResolvedLoginScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function ResolvedLoginScreen({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { as } = await searchParams;
  return <LoginScreen initialPortal={loginPortalFromParam(as)} />;
}
