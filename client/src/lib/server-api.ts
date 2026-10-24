import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ApiError, parseApiResponse } from "./api";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Fetch from Server Components. Calls Express directly (no rewrite hop) and
 * forwards the user's cookies. Must be rendered inside <Suspense> (cacheComponents).
 */
export async function serverFetch<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}/api/v1${path}`, { headers: { cookie: cookieHeader } });

  try {
    return await parseApiResponse<T>(res);
  } catch (err) {
    if (err instanceof ApiError) {
      // The proxy let us through but the API disagrees (expired, deleted user…): start over.
      if (err.status === 401) redirect("/login?reauth=1");
      // Missing — or another author's — resource (the API never says which).
      if (err.status === 404 || err.status === 400) notFound();
    }
    throw err;
  }
}
