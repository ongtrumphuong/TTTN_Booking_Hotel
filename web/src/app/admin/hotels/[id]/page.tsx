import { Suspense } from "react";
import { AdminFallback } from "@/components/admin/fallback";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HotelForm } from "@/components/admin/hotel-form";
import { RoomBlocks } from "@/components/admin/room-blocks";
import { RoomForm } from "@/components/admin/room-form";
import { ToggleButton } from "@/components/admin/toggle-button";
import { formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Chỉnh sửa khách sạn" };

async function EditHotel({ params }: Pick<PageProps<"/admin/hotels/[id]">, "params">) {
  const { id } = await params;
  await requireAdmin(`/admin/hotels/${id}`);

  const hotel = await prisma.hotel.findUnique({
    where: { id },
    include: {
      rooms: {
        orderBy: { pricePerNight: "asc" },
        include: { blocks: { where: { endDate: { gt: new Date() } }, orderBy: { startDate: "asc" } } },
      },
    },
  });
  if (!hotel) notFound();

  return (
    <>
      <Link href="/admin/hotels" className="text-sm font-semibold text-muted hover:text-foreground">← Danh sách khách sạn</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{hotel.name}</h1>
        <Link href={`/hotels/${hotel.slug}`} className="text-sm font-semibold text-brand hover:underline">Xem trang công khai →</Link>
      </div>

      <HotelForm hotel={hotel} />

      <h2 className="mb-3 mt-10 text-xl font-extrabold">Loại phòng <span className="text-base font-medium text-muted">({hotel.rooms.length})</span></h2>
      <div className="space-y-3">
        {hotel.rooms.map((r) => (
          <details key={r.id} className="rounded-2xl border border-border bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
              <span>
                <span className="font-bold">{r.name}</span>
                <span className="ml-2 text-sm text-muted">{formatVND(r.pricePerNight)}/đêm · {r.quantity} phòng · {r.capacity} khách</span>
              </span>
              <ToggleButton kind="room" id={r.id} active={r.isActive} />
            </summary>
            <div className="border-t border-border p-4">
              <RoomForm hotelId={hotel.id} room={r} />
              <RoomBlocks roomId={r.id} quantity={r.quantity} blocks={r.blocks.map((b) => ({ id: b.id, start: b.startDate.toISOString().slice(0, 10), end: new Date(b.endDate.getTime() - 86_400_000).toISOString().slice(0, 10), rooms: b.rooms, reason: b.reason }))} />
            </div>
          </details>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-white p-5">
        <h3 className="mb-3 font-bold">Thêm loại phòng mới</h3>
        <RoomForm hotelId={hotel.id} />
      </div>
    </>
  );
}

export default function EditHotelPage(props: PageProps<"/admin/hotels/[id]">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <EditHotel params={props.params} />
    </Suspense>
  );
}
