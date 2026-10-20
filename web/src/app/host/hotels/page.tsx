import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { HotelsView } from "@/components/admin/hotels-view";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Khách sạn của tôi" };

async function Content() {
  const user = await requireHost("/host/hotels");
  return <HotelsView user={user} />;
}

export default function HostHotelsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content />
    </Suspense>
  );
}
