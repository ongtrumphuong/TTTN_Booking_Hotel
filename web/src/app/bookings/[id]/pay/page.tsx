import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { PayForm } from "@/components/pay-form";
import { PENDING_HOLD_MINUTES } from "@/lib/booking";
import { formatDate, formatVND } from "@/lib/format";
import { isVnpayConfigured } from "@/lib/payments/vnpay";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Thanh toán" };

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

  const expired = booking.createdAt.getTime() < Date.now() - PENDING_HOLD_MINUTES * 60_000;

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_360px]">
      <div className="rounded-2xl border border-border bg-white p-6">
        <h1 className="text-2xl font-extrabold">Thanh toán</h1>
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
      <aside className="h-fit space-y-2 rounded-2xl border border-border bg-white p-5 text-sm">
        <p className="font-bold">{booking.room.hotel.name}</p>
        <p className="text-muted">{booking.room.name} × {booking.rooms}</p>
        <p className="border-t border-border pt-2">{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</p>
        <p className="flex justify-between border-t border-border pt-2 text-base font-extrabold">
          <span>Tổng cộng</span><span className="text-brand">{formatVND(booking.totalPrice)}</span>
        </p>
      </aside>
    </div>
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
