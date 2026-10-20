import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { RootShell } from "@/components/root-shell";
import { StaffTopBar, StaffTopBarFallback } from "@/components/staff-topbar";
import { requireAdmin } from "@/lib/session";
import { BASE_METADATA, NOINDEX } from "@/lib/site";

export const metadata: Metadata = { ...BASE_METADATA, robots: NOINDEX };

async function AdminGuard({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  return <>{children}</>;
}

/** Root layout riêng của quản trị viên sàn: có thanh trên và menu riêng, không có thanh menu/chân trang/trợ lý ảo của khách. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <RootShell>
      <Suspense fallback={<StaffTopBarFallback />}>
        <StaffTopBar base="/admin" />
      </Suspense>
      <main className="flex-1">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-8 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="min-w-0 md:sticky md:top-24 md:self-start">
            <p className="font-display mb-3 hidden px-2 text-xl font-semibold md:block">Quản trị</p>
            <Suspense fallback={<div className="h-10 animate-pulse rounded-xl bg-border md:h-44" />}>
              <AdminNav />
            </Suspense>
          </aside>
          <div className="min-w-0">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-border" />}>
              <AdminGuard>{children}</AdminGuard>
            </Suspense>
          </div>
        </div>
      </main>
    </RootShell>
  );
}
