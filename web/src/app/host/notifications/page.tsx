import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { NotificationsView } from "@/components/admin/notifications-view";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Thông báo" };

async function Content() {
  const user = await requireHost("/host/notifications");
  return <NotificationsView user={user} />;
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content />
    </Suspense>
  );
}
