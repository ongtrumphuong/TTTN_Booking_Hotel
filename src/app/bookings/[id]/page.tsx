import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { CancelButton } from "@/components/cancel-button";
import { STATUS_LABEL, todayUTC } from "@/lib/booking";
import { formatDate, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Chi tiết đặt phòng" };

const PAYMENT: Record<string, string> = { UNPAID: "Chưa thanh toán", PAID: "Đã thanh toán", REFUNDED: "Đã hoàn tiền" };

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/bookings/${id}`);
  const b = await prisma.booking.findFirst({ where: { id, userId: user.id }, include: { room: { include: { hotel: true } } } });
  if (!b) notFound();

  const status = STATUS_LABEL[b.status];
  const canCancel = (b.status === "PENDING" || b.status === "CONFIRMED") && b.checkIn > todayUTC();

  return (
    <>
      {sp.paid && b.status === "CONFIRMED" && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-900">
          <CheckCircle2 aria-hidden />
          <div>
            <p className="font-bold">Đặt phòng thành công!</p>
            <p className="text-sm">Mã đặt phòng của bạn là {b.code}. Hãy xuất trình mã này khi nhận phòng.</p>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Mã đặt phòng</p>
            <h1 className="text-2xl font-extrabold tracking-wide">{b.code}</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.cls}`}>{status.text}</span>
        </div>

        <div className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
          <div><p className="text-muted">Khách sạn</p><Link href={`/hotels/${b.room.hotel.slug}`} className="font-semibold text-brand hover:underline">{b.room.hotel.name}</Link></div>
          <div><p className="text-muted">Địa chỉ</p><p className="font-semibold">{b.room.hotel.address}, {b.room.hotel.city}</p></div>
          <div><p className="text-muted">Loại phòng</p><p className="font-semibold">{b.room.name} × {b.rooms}</p></div>
          <div><p className="text-muted">Số khách</p><p className="font-semibold">{b.guests}</p></div>
          <div><p className="text-muted">Nhận phòng</p><p className="font-semibold">{formatDate(b.checkIn)}</p></div>
          <div><p className="text-muted">Trả phòng</p><p className="font-semibold">{formatDate(b.checkOut)}</p></div>
          <div><p className="text-muted">Thanh toán</p><p className="font-semibold">{PAYMENT[b.paymentStatus]}</p></div>
          <div><p className="text-muted">Tổng tiền</p><p className="text-lg font-extrabold text-brand">{formatVND(b.totalPrice)}</p></div>
          {b.note && <div className="sm:col-span-2"><p className="text-muted">Yêu cầu</p><p className="font-semibold">{b.note}</p></div>}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
          {b.status === "PENDING" && b.paymentStatus === "UNPAID" && (
            <Link href={`/bookings/${b.id}/pay`} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">Thanh toán ngay</Link>
          )}
          {canCancel && <CancelButton bookingId={b.id} />}
          <Link href="/bookings" className="rounded-lg px-4 py-2 text-sm font-semibold text-muted hover:bg-background">← Tất cả đặt phòng</Link>
        </div>
      </div>
    </>
  );
}

export default function BookingPage(props: PageProps<"/bookings/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-border" />}>
        <Detail params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
