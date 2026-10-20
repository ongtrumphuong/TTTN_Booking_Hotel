import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireHost } from "@/lib/session";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { robots: NOINDEX };

async function HostGuard({ children }: { children: React.ReactNode }) {
  await requireHost("/host");
  return <>{children}</>;
}

export default function HostLayout({ children }: LayoutProps<"/host">) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0 md:sticky md:top-24 md:self-start">
        <p className="font-display mb-3 hidden px-2 text-xl font-semibold md:block">Đối tác</p>
        <Suspense fallback={<div className="h-10 animate-pulse rounded-xl bg-border md:h-44" />}>
          <AdminNav variant="host" />
        </Suspense>
      </aside>
      <div className="min-w-0">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-border" />}>
          <HostGuard>{children}</HostGuard>
        </Suspense>
      </div>
    </div>
  );
}
