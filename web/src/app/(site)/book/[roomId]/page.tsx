import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { BookingForm } from "@/components/booking-form";
import { BookingSteps } from "@/components/booking-steps";
import { unavailableQuantity, parseStay, todayUTC } from "@/lib/booking";
import { policyText } from "@/lib/cancellation";
import { formatDate, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Đặt phòng", robots: NOINDEX };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

async function BookContent({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<SP> }) {
  const [{ roomId }, sp] = await Promise.all([params, searchParams]);
  const checkInStr = one(sp.checkIn);
  const checkOutStr = one(sp.checkOut);
  const guests = Math.min(Math.max(Number(one(sp.guests)) || 2, 1), 20);

  await requireUser(`/book/${roomId}?checkIn=${checkInStr}&checkOut=${checkOutStr}&guests=${guests}`);

  const room = await prisma.room.findFirst({
    where: { id: roomId, isActive: true, hotel: { isActive: true } },
    include: { hotel: true },
  });
  if (!room) notFound();

  const stay = parseStay(checkInStr, checkOutStr);
  if (!stay || stay.checkIn < todayUTC()) redirect(`/hotels/${room.hotel.slug}#rooms`);

  const left = room.quantity - (await unavailableQuantity(prisma, room.id, stay.checkIn, stay.checkOut));
  const maxRooms = Math.min(left, 5);
  const fits = left > 0 && guests <= room.capacity;

  return (
    <>
    <BookingSteps current={1} />
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="rounded-3xl border border-border bg-white p-6">
        <h1 className="font-display text-3xl font-semibold">Xác nhận đặt phòng</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Kiểm tra thông tin rồi tiếp tục thanh toán. Phòng được giữ 30 phút sau khi tạo đơn.</p>
        {fits ? (
          <BookingForm
            roomId={room.id}
            checkIn={checkInStr}
            checkOut={checkOutStr}
            guests={guests}
            nights={stay.nights}
            pricePerNight={room.pricePerNight}
            maxRooms={maxRooms}
          />
        ) : (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {left <= 0 ? "Phòng đã hết trong khoảng ngày này." : "Số khách vượt quá sức chứa của phòng."}{" "}
            <Link href={`/hotels/${room.hotel.slug}#rooms`} className="underline">Chọn lại</Link>
          </div>
        )}
      </div>

      <aside className="h-fit overflow-hidden rounded-3xl border border-border bg-white lg:sticky lg:top-24">
        <div className="relative aspect-video bg-border">
          <Image src={room.images[0]} alt={room.name} fill sizes="380px" className="object-cover" />
        </div>
        <div className="space-y-3 p-5 text-sm">
          <div>
            <p className="font-bold">{room.hotel.name}</p>
            <p className="text-muted">{room.name} · {room.bedType}</p>
          </div>
          <dl className="space-y-1.5 border-t border-border pt-3">
            <div className="flex justify-between"><dt className="text-muted">Nhận phòng</dt><dd className="font-semibold">{formatDate(stay.checkIn)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Trả phòng</dt><dd className="font-semibold">{formatDate(stay.checkOut)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Số khách</dt><dd className="font-semibold">{guests}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Đơn giá</dt><dd className="font-semibold">{formatVND(room.pricePerNight)}/đêm</dd></div>
          </dl>
          <p className="border-t border-border pt-3 text-xs text-muted">
            <b className="text-foreground">Chính sách hủy:</b> {policyText(room.hotel.freeCancelDays, room.hotel.lateCancelFeePercent)}
          </p>
        </div>
      </aside>
    </div>
    </>
  );
}

export default function BookPage(props: PageProps<"/book/[roomId]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-border" />}>
        <BookContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
