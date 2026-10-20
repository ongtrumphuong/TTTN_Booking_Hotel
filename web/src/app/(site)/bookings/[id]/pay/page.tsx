import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { BookingSteps } from "@/components/booking-steps";
import { PayForm } from "@/components/pay-form";
import { holdExpired } from "@/lib/booking";
import { policyText } from "@/lib/cancellation";
import { formatDate, formatVND } from "@/lib/format";
import { isVnpayConfigured } from "@/lib/payments/vnpay";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Thanh toán", robots: NOINDEX };

const PAY_ERRORS: Record<string, string> = {
  cancelled: "Bạn đã hủy thanh toán trên VNPay. Đơn vẫn được giữ phòng, bạn có thể thanh toán lại.",
  failed: "Thanh toán chưa thành công. Đơn vẫn được giữ phòng, vui lòng thử lại.",
};

async function PayContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/bookings/${id}/pay`);
  const booking = await prisma.booking.findFirst({
    where: { id, userId: user.id },
    include: { room: { include: { hotel: true } } },
  });
  if (!booking) notFound();
  if (booking.status !== "PENDING" || booking.paymentStatus !== "UNPAID") redirect(`/bookings/${id}`);

  const expired = holdExpired(booking.createdAt);

  return (
    <>
    <BookingSteps current={2} />
    <div className="grid gap-8 md:grid-cols-[1fr_360px]">
      <div className="rounded-3xl border border-border bg-white p-6">
        <h1 className="font-display text-3xl font-semibold">Thanh toán</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Mã đơn: <b>{booking.code}</b></p>
        {sp.error && PAY_ERRORS[sp.error] && (
          <div role="alert" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{PAY_ERRORS[sp.error]}</div>
        )}
        {expired ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Đơn đã quá thời gian giữ phòng. Vui lòng đặt lại.
          </div>
        ) : (
          <PayForm bookingId={booking.id} total={booking.totalPrice} mode={isVnpayConfigured() ? "vnpay" : "simulated"} />
        )}
      </div>
      <aside className="h-fit space-y-2 overflow-hidden rounded-3xl border border-border bg-white text-sm md:sticky md:top-24">
        {booking.room.images[0] && (
          <div className="relative aspect-video bg-border">
            <Image src={booking.room.images[0]} alt={booking.room.name} fill sizes="360px" className="object-cover" />
          </div>
        )}
        <div className="space-y-2 p-5">
        <p className="font-display text-lg font-semibold">{booking.room.hotel.name}</p>
        <p className="text-muted">{booking.room.name} × {booking.rooms}</p>
        <p className="border-t border-border pt-2">{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</p>
        {booking.discount > 0 && (
          <div className="space-y-1 border-t border-border pt-2">
            <p className="flex justify-between text-muted"><span>Tạm tính</span><span>{formatVND(booking.totalPrice + booking.discount)}</span></p>
            <p className="flex justify-between text-emerald-700"><span>Mã {booking.voucherCode}</span><span>-{formatVND(booking.discount)}</span></p>
          </div>
        )}
        <p className="flex justify-between border-t border-border pt-2 text-base font-extrabold">
          <span>Tổng cộng</span><span className="text-brand">{formatVND(booking.totalPrice)}</span>
        </p>
        <p className="border-t border-border pt-2 text-xs text-muted">
          <b className="text-foreground">Chính sách hủy:</b> {policyText(booking.room.hotel.freeCancelDays, booking.room.hotel.lateCancelFeePercent)}
        </p>
        </div>
      </aside>
    </div>
    </>
  );
}

export default function PayPage(props: PageProps<"/bookings/[id]/pay">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-border" />}>
        <PayContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
