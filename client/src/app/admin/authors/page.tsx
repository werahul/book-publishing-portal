import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Avatar, Card, PageHeader, Skeleton } from "@/components/ui";
import { formatINR, formatNumber } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { ApiData, AuthorSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Authors · BookLeaf Support" };

export default function AuthorsPage() {
  return (
    <>
      <PageHeader eyebrow="Directory" title="Authors" description="Every BookLeaf author with portfolio and royalty totals." />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <AuthorsTable />
      </Suspense>
    </>
  );
}

async function AuthorsTable() {
  const { data: authors } = await serverFetch<ApiData<AuthorSummary[]>>("/authors");

  return (
    <Card className="animate-rise overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50/80 text-left text-xs tracking-wider text-stone-500 uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Author</th>
            <th className="px-4 py-3 font-medium">City</th>
            <th className="px-4 py-3 text-right font-medium">Books</th>
            <th className="px-4 py-3 text-right font-medium">Copies sold</th>
            <th className="px-4 py-3 text-right font-medium">Royalty paid</th>
            <th className="px-4 py-3 text-right font-medium">Royalty pending</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {authors.map((author) => (
            <tr key={author.id} className="group transition hover:bg-leaf-50/40">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={author.name} size="lg" />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/tickets?authorId=${author.id}&status=all`}
                      className="font-medium text-stone-900 group-hover:text-leaf-800 hover:underline"
                    >
                      {author.name}
                    </Link>
                    <p className="text-xs text-stone-500">
                      <span className="font-mono">{author.authorProfile.externalId}</span> · {author.email}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-stone-600">
                {author.authorProfile.city ? (
                  <span className="whitespace-nowrap">{author.authorProfile.city}</span>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex items-center gap-1 font-medium tabular-nums">
                  <Icon name="book" className="size-3.5 text-stone-400" />
                  {author.stats.books}
                </span>
                {author.stats.inProduction > 0 && (
                  <span className="mt-0.5 block text-[11px] whitespace-nowrap text-amber-700">
                    {author.stats.inProduction} in production
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatNumber(author.stats.copiesSold)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatINR(author.stats.royaltyPaid)}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className={author.stats.royaltyPending > 0 ? "font-semibold text-amber-700" : "text-stone-400"}>
                  {formatINR(author.stats.royaltyPending)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
