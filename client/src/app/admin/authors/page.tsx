import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatINR, formatNumber } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthorSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Authors · BookLeaf Support" };

export default function AuthorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Authors</h1>
        <p className="text-sm text-slate-500">Every BookLeaf author with portfolio and royalty totals.</p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />}>
        <AuthorsTable />
      </Suspense>
    </div>
  );
}

async function AuthorsTable() {
  const { data: authors } = await serverFetch<ApiData<AuthorSummary[]>>("/authors");

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2 font-medium">Author</th>
            <th className="px-4 py-2 font-medium">City</th>
            <th className="px-4 py-2 text-right font-medium">Books</th>
            <th className="px-4 py-2 text-right font-medium">Copies sold</th>
            <th className="px-4 py-2 text-right font-medium">Royalty paid</th>
            <th className="px-4 py-2 text-right font-medium">Royalty pending</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {authors.map((author) => (
            <tr key={author.id}>
              <td className="px-4 py-2">
                <Link href={`/admin/tickets?authorId=${author.id}&status=all`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                  {author.name}
                </Link>
                <p className="text-xs text-slate-500">
                  {author.authorProfile.externalId} · {author.email}
                </p>
              </td>
              <td className="px-4 py-2 text-slate-700">{author.authorProfile.city ?? "—"}</td>
              <td className="px-4 py-2 text-right">
                {author.stats.books}
                {author.stats.inProduction > 0 && (
                  <span className="ml-1 text-xs text-amber-700">({author.stats.inProduction} in production)</span>
                )}
              </td>
              <td className="px-4 py-2 text-right">{formatNumber(author.stats.copiesSold)}</td>
              <td className="px-4 py-2 text-right">{formatINR(author.stats.royaltyPaid)}</td>
              <td className="px-4 py-2 text-right">{formatINR(author.stats.royaltyPending)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
