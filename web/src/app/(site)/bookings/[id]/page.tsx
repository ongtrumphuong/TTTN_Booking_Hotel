import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { BookingSteps } from "@/components/booking-steps";
import { DisputeSection } from "@/components/dispute-section";
import { TicketQr } from "@/components/ticket-qr";
import { CancelButton } from "@/components/cancel-button";
import { needsRefund, isoDate, paymentLabel, statusLabel, todayUTC } from "@/lib/booking";
import { RescheduleForm } from "@/components/reschedule-form";
import { cancelQuote, policyText } from "@/lib/cancellation";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Chi tiết đặt phòng", robots: NOINDEX };

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; payment?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/bookings/${id}`);
  const b = await prisma.booking.findFirst({ where: { id, userId: user.id }, include: { room: { include: { hotel: true } }, dispute: true } });
  if (!b) notFound();

  const status = statusLabel(b.status, b.noShow);
  const today = todayUTC();
  const canCancel = (b.status === "PENDING" || b.status === "CONFIRMED") && b.checkIn > todayUTC() && !b.checkedInAt;
  const { freeCancelDays, lateCancelFeePercent } = b.room.hotel;
  const quote = cancelQuote({ checkIn: b.checkIn, today: todayUTC(), paid: b.paymentStatus === "PAID" ? b.totalPrice : 0, freeCancelDays, lateFeePercent: lateCancelFeePercent });
  const confirmText =
    b.paymentStatus !== "PAID"
      ? "Bạn chắc chắn muốn hủy đơn đặt phòng này?"
      : quote.free
        ? `Hủy đơn này sẽ được hoàn đủ ${formatVND(quote.refund)}. Bạn chắc chắn muốn hủy?`
        : `Đã quá hạn hủy miễn phí: khách sạn giữ ${formatVND(quote.fee)}, bạn được hoàn ${formatVND(quote.refund)}. Bạn vẫn muốn hủy?`;
  // Chỉ để quyết định có hiện nút đổi ngày; luật đầy đủ (giá, phòng trống) do server kiểm tra khi bấm.
  const canReschedule =
    (b.status === "PENDING" || b.status === "CONFIRMED") &&
    !b.checkedInAt &&
    b.dateChanges < 1 &&
    b.checkIn > today &&
    (b.paymentStatus !== "PAID" || Math.round((b.checkIn.getTime() - today.getTime()) / 86_400_000) >= freeCancelDays);
  const refunding = needsRefund(b.status, b.paymentStatus, b.refundAmount);

  return (
    <>
      {sp.payment === "refund" && (
        <div role="alert" className="mb-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold">Chúng tôi đã nhận thanh toán nhưng không giữ được phòng.</p>
          <p>Đơn đã được hủy và bộ phận hỗ trợ sẽ hoàn tiền cho bạn. Xin lỗi vì sự bất tiện này.</p>
        </div>
      )}
      {sp.paid && b.status === "CONFIRMED" && <BookingSteps current={3} />}
      {sp.paid && b.status === "CONFIRMED" && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-900">
          <CheckCircle2 aria-hidden />
          <div>
            <p className="font-bold">Đặt phòng thành công!</p>
            <p className="text-sm">Mã đặt phòng của bạn là {b.code}. Hãy xuất trình mã này khi nhận phòng.</p>
          </div>
        </div>
      )}
      {refunding && (
        <div role="status" className="mb-6 rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-bold">Đơn đã hủy, đang chờ hoàn tiền.</p>
          <p>Bộ phận hỗ trợ sẽ hoàn lại {formatVND(b.refundAmount ?? b.totalPrice)} về phương thức bạn đã dùng và cập nhật trạng thái tại đây.</p>
        </div>
      )}
      {b.status === "CONFIRMED" && !b.checkedInAt && <div className="mb-6"><TicketQr code={b.code} /></div>}
      <div className="rounded-3xl border border-border bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Mã đặt phòng</p>
            <h1 className="font-display text-3xl font-semibold tracking-wide">{b.code}</h1>
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
          {b.checkedInAt && <div><p className="text-muted">Đã nhận phòng lúc</p><p className="font-semibold">{formatDateTime(b.checkedInAt)}</p></div>}
          {b.checkedOutAt && <div><p className="text-muted">Đã trả phòng lúc</p><p className="font-semibold">{formatDateTime(b.checkedOutAt)}</p></div>}
          <div><p className="text-muted">Thanh toán</p><p className="font-semibold">{paymentLabel(b.status, b.paymentStatus, b.refundAmount)}</p></div>
          {b.discount > 0 && <div><p className="text-muted">Mã giảm giá {b.voucherCode}</p><p className="font-semibold text-emerald-700">-{formatVND(b.discount)}</p></div>}
          {b.status === "CANCELLED" && b.refundAmount !== null && b.refundAmount < b.totalPrice && (
            <div className="sm:col-span-2">
              <p className="text-muted">Hoàn tiền</p>
              <p className="font-semibold">
                {b.noShow ? "Khách sạn ghi nhận bạn không đến nhận phòng. " : ""}
                {b.refundAmount === 0
                  ? "Không được hoàn tiền theo chính sách hủy muộn."
                  : `Hoàn ${formatVND(b.refundAmount)}; khách sạn giữ ${formatVND(b.totalPrice - b.refundAmount)} theo chính sách hủy muộn.`}
              </p>
            </div>
          )}
          <div><p className="text-muted">Tổng tiền</p><p className="text-lg font-extrabold text-brand">{formatVND(b.totalPrice)}</p></div>
          {b.note && <div className="sm:col-span-2"><p className="text-muted">Yêu cầu</p><p className="font-semibold">{b.note}</p></div>}
        </div>

        {canCancel && <p className="mt-6 rounded-xl bg-background px-4 py-3 text-xs text-muted">Chính sách hủy: {policyText(freeCancelDays, lateCancelFeePercent)}</p>}
        {canReschedule && (
          <p className="mt-3 rounded-xl bg-background px-4 py-3 text-xs text-muted">
            Đổi ngày ở: được đổi 1 lần, không mất phí{freeCancelDays > 0 && b.paymentStatus === "PAID" ? `, trước ngày nhận phòng ít nhất ${freeCancelDays} ngày` : ""}. Đơn đã thanh toán hoặc có mã giảm giá chỉ đổi được sang ngày có cùng giá.
          </p>
        )}
        {b.dateChanges > 0 && <p className="mt-3 text-xs text-muted">Đơn này đã đổi ngày ở 1 lần.</p>}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
          {b.status === "PENDING" && b.paymentStatus === "UNPAID" && (
            <Link href={`/bookings/${b.id}/pay`} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark">Thanh toán ngay</Link>
          )}
          {b.paymentStatus !== "UNPAID" && (
            <Link href={`/bookings/${b.id}/invoice`} className="rounded-lg border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5">Xem phiếu thanh toán</Link>
          )}
          {canReschedule && <RescheduleForm bookingId={b.id} checkIn={isoDate(b.checkIn)} checkOut={isoDate(b.checkOut)} min={isoDate(today)} />}
          {canCancel && <CancelButton bookingId={b.id} confirmText={confirmText} />}
          <Link href="/bookings" className="rounded-lg px-4 py-2 text-sm font-semibold text-muted hover:bg-background">← Tất cả đặt phòng</Link>
        </div>
      </div>
      <DisputeSection booking={b} dispute={b.dispute} />
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
