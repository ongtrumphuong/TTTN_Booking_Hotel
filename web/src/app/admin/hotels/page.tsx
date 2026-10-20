import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { HotelsView } from "@/components/admin/hotels-view";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Quản lý khách sạn" };

async function Content() {
  const user = await requireAdmin("/admin/hotels");
  return <HotelsView user={user} />;
}

export default function AdminHotelsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content />
    </Suspense>
  );
}
