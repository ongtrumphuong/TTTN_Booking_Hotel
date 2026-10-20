import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { RootShell } from "@/components/root-shell";
import { StaffTopBar, StaffTopBarFallback } from "@/components/staff-topbar";
import { requireHost } from "@/lib/session";
import { BASE_METADATA, NOINDEX } from "@/lib/site";

export const metadata: Metadata = { ...BASE_METADATA, robots: NOINDEX };

async function HostGuard({ children }: { children: React.ReactNode }) {
  await requireHost("/host");
  return <>{children}</>;
}

/** Root layout riêng của đối tác: có thanh trên và menu riêng, không có thanh menu/chân trang/trợ lý ảo của khách. */
export default function HostLayout({ children }: LayoutProps<"/host">) {
  return (
    <RootShell>
      <Suspense fallback={<StaffTopBarFallback />}>
        <StaffTopBar base="/host" />
      </Suspense>
      <main className="flex-1">
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
      </main>
    </RootShell>
  );
}
