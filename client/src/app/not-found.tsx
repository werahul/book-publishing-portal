import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="animate-rise text-center">
        <div className="relative mx-auto mb-6 w-fit">
          <p className="font-display text-8xl font-semibold tracking-tighter text-leaf-900/10">404</p>
          <Icon name="leaf" strokeWidth={1.5} className="absolute inset-0 m-auto size-12 text-leaf-600" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">We can&apos;t find that page</h1>
        <p className="mt-1 text-sm text-stone-500">It may have been moved, or you may not have access to it.</p>
        <Link href="/" className="btn btn-primary mt-6">
          <Icon name="arrowLeft" className="size-4" />
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}
