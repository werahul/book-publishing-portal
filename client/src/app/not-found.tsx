import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold text-emerald-700">404</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">We couldn&apos;t find that page</h1>
        <p className="mt-1 text-sm text-slate-500">It may have been moved, or you may not have access to it.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline">
          Back to your dashboard →
        </Link>
      </div>
    </div>
  );
}
