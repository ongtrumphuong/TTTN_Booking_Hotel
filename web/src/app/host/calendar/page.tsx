import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { OccupancyCalendar } from "@/components/admin/occupancy-calendar";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Lịch phòng" };

async function Content({ searchParams }: Pick<PageProps<"/host/calendar">, "searchParams">) {
  const user = await requireHost("/host/calendar");
  return <OccupancyCalendar user={user} searchParams={searchParams} base="/host" />;
}

export default function CalendarPage(props: PageProps<"/host/calendar">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
