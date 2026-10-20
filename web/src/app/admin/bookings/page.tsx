import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { BookingsView } from "@/components/admin/bookings-view";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Quản lý đơn đặt phòng" };

async function Content({ searchParams }: Pick<PageProps<"/admin/bookings">, "searchParams">) {
  const user = await requireAdmin("/admin/bookings");
  return <BookingsView searchParams={searchParams} user={user} />;
}

export default function AdminBookingsPage(props: PageProps<"/admin/bookings">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
