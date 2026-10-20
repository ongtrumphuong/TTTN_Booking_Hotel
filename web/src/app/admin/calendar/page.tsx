import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { OccupancyCalendar } from "@/components/admin/occupancy-calendar";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Lịch phòng" };

async function Content({ searchParams }: Pick<PageProps<"/admin/calendar">, "searchParams">) {
  const user = await requireAdmin("/admin/calendar");
  return <OccupancyCalendar user={user} searchParams={searchParams} base="/admin" />;
}

export default function CalendarPage(props: PageProps<"/admin/calendar">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
