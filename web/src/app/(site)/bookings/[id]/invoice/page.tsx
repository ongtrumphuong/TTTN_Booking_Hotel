import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrintButton } from "@/components/print-button";
import { paymentLabel } from "@/lib/booking";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NOINDEX, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Phiếu thanh toán", robots: NOINDEX };

const METHOD: Record<string, string> = { card: "Thẻ", ewallet: "Ví điện tử", bank: "Chuyển khoản/ngân hàng" };

async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/bookings/${id}/invoice`);
  const b = await prisma.booking.findFirst({
    where: { id, userId: user.id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      room: { include: { hotel: { select: { name: true, address: true, city: true } } } },
      payments: { where: { status: "SUCCESS" }, orderBy: { paidAt: "desc" }, take: 1 },
    },
  });
  // Chỉ đơn đã thanh toán mới có phiếu; đơn khác báo như không tồn tại.
  if (!b || b.paymentStatus === "UNPAID") notFound();

  const nights = Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000);
  const subtotal = b.totalPrice + b.discount;
  const pay = b.payments[0];
  const row = "flex justify-between gap-4 py-1.5";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/bookings/${b.id}`} className="text-sm font-semibold text-muted hover:text-foreground">← Chi tiết đơn</Link>
        <PrintButton />
      </div>

      <article className="rounded-3xl border border-border bg-white p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="font-display text-2xl font-semibold">{SITE_NAME}</p>
            <p className="text-xs text-muted">Nền tảng đặt phòng khách sạn</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-semibold">Phiếu thanh toán</p>
            <p className="text-sm text-muted">Mã đặt phòng <b className="tracking-wide text-foreground">{b.code}</b></p>
            {pay?.paidAt && <p className="text-xs text-muted">Thanh toán lúc {formatDateTime(pay.paidAt)}</p>}
          </div>
        </header>

        <section className="grid gap-5 border-b border-border py-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Khách</p>
            <p className="font-semibold">{b.user.name}</p>
            <p className="text-muted">{b.user.email}</p>
            {b.user.phone && <p className="text-muted">{b.user.phone}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Khách sạn</p>
            <p className="font-semibold">{b.room.hotel.name}</p>
            <p className="text-muted">{b.room.hotel.address}, {b.room.hotel.city}</p>
          </div>
        </section>

        <section className="border-b border-border py-5 text-sm">
          <div className={row}><span className="text-muted">Loại phòng</span><span className="font-semibold">{b.room.name} × {b.rooms}</span></div>
          <div className={row}><span className="text-muted">Nhận phòng</span><span className="font-semibold">{formatDate(b.checkIn)}</span></div>
          <div className={row}><span className="text-muted">Trả phòng</span><span className="font-semibold">{formatDate(b.checkOut)} ({nights} đêm)</span></div>
          <div className={row}><span className="text-muted">Số khách</span><span className="font-semibold">{b.guests}</span></div>
        </section>

        <section className="py-5 text-sm">
          <div className={row}><span className="text-muted">Tiền phòng ({nights} đêm × {b.rooms} phòng)</span><span>{formatVND(subtotal)}</span></div>
          {b.discount > 0 && <div className={row}><span className="text-muted">Giảm giá{b.voucherCode ? ` (${b.voucherCode})` : ""}</span><span className="text-emerald-700">-{formatVND(b.discount)}</span></div>}
          <div className={`${row} mt-2 border-t border-border pt-3 text-base`}><span className="font-semibold">Tổng thanh toán</span><span className="text-xl font-extrabold">{formatVND(b.totalPrice)}</span></div>
          <div className={row}><span className="text-muted">Hình thức</span><span>{pay ? `${pay.provider === "VNPAY" ? "VNPay" : "Thanh toán giả lập"}${pay.method ? ` · ${METHOD[pay.method] ?? pay.method}` : ""}` : "—"}</span></div>
          <div className={row}><span className="text-muted">Trạng thái</span><span className="font-semibold">{paymentLabel(b.status, b.paymentStatus, b.refundAmount)}</span></div>
          {b.refundAmount !== null && b.status === "CANCELLED" && <div className={row}><span className="text-muted">Số tiền hoàn</span><span>{formatVND(b.refundAmount)}</span></div>}
        </section>

        <p className="border-t border-border pt-4 text-xs text-muted">
          Đây là phiếu xác nhận thanh toán đặt phòng do hệ thống cấp, không phải hóa đơn giá trị gia tăng. Cảm ơn bạn đã đặt phòng cùng {SITE_NAME}.
        </p>
      </article>
    </div>
  );
}

export default function InvoicePage(props: PageProps<"/bookings/[id]/invoice">) {
  return (
    <div className="px-4 py-10">
      <Suspense fallback={<div className="mx-auto h-96 max-w-2xl animate-pulse rounded-2xl bg-border" />}>
        <Invoice params={props.params} />
      </Suspense>
    </div>
  );
}
