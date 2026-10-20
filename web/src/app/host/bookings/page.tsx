import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { BookingsView } from "@/components/admin/bookings-view";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Đơn đặt phòng" };

async function Content({ searchParams }: Pick<PageProps<"/host/bookings">, "searchParams">) {
  const user = await requireHost("/host/bookings");
  return <BookingsView searchParams={searchParams} user={user} />;
}

export default function HostBookingsPage(props: PageProps<"/host/bookings">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
