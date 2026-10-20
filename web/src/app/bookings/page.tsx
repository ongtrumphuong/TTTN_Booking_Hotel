import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { STATUS_LABEL } from "@/lib/booking";
import { formatDate, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Đặt phòng của tôi" };

async function PaymentNotice({ searchParams }: Pick<PageProps<"/bookings">, "searchParams">) {
  const sp = await searchParams;
  if (sp.payment !== "invalid") return null;
  return (
    <div role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      Không xác minh được kết quả thanh toán. Nếu tài khoản ngân hàng đã bị trừ tiền, vui lòng liên hệ hỗ trợ kèm mã đặt phòng.
    </div>
  );
}

async function List() {
  const user = await requireUser("/bookings");
  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { room: { include: { hotel: { select: { name: true, city: true } } } } },
  });

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
        <p className="font-bold">Bạn chưa có đơn đặt phòng nào</p>
        <Link href="/hotels" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">
          Tìm khách sạn
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {bookings.map((b) => {
        const s = STATUS_LABEL[b.status];
        return (
          <li key={b.id}>
            <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5 transition hover:shadow-md">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted">{b.code}</p>
                <p className="font-bold">{b.room.hotel.name} <span className="font-normal text-muted">· {b.room.hotel.city}</span></p>
                <p className="text-sm text-muted">{b.room.name} × {b.rooms} · {formatDate(b.checkIn)} → {formatDate(b.checkOut)}</p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>{s.text}</span>
                <p className="mt-2 font-extrabold text-brand">{formatVND(b.totalPrice)}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function BookingsPage(props: PageProps<"/bookings">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-extrabold">Đặt phòng của tôi</h1>
      <Suspense fallback={null}>
        <PaymentNotice searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-border" />}>
        <List />
      </Suspense>
    </div>
  );
}
