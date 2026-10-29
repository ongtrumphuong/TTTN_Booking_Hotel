import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { CheckInButton } from "@/components/admin/check-in-button";
import { NoShowButton } from "@/components/admin/no-show-button";
import { RefundButton } from "@/components/admin/refund-button";
import { SelectAction } from "@/components/admin/select-action";
import { NEXT_STATUS, STATUS_LABEL, needsRefund, paymentLabel, statusLabel, todayUTC } from "@/lib/booking";
import { canMarkNoShow, noShowQuote } from "@/lib/lifecycle";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";


const FILTERS: { value: BookingStatus | "ALL" | "REFUND"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ thanh toán" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "COMPLETED", label: "Hoàn tất" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "REFUND", label: "Cần hoàn tiền" },
];

const ACTION_LABEL: Record<BookingStatus, string> = {
  PENDING: "Chờ thanh toán",
  CONFIRMED: "Xác nhận (đã nhận tiền)",
  COMPLETED: "Hoàn tất (khách trả phòng)",
  CANCELLED: "Hủy đơn",
};

type SP = Record<string, string | string[] | undefined>;

/** Nội dung hộp xác nhận báo "không đến": nêu số tiền giữ lại và hoàn, tính bằng đúng công thức server dùng. */
function noShowConfirm(b: { code: string; totalPrice: number; paymentStatus: string; checkIn: Date; room: { hotel: { freeCancelDays: number; lateCancelFeePercent: number } } }) {
  const paid = b.paymentStatus === "PAID" ? b.totalPrice : 0;
  const q = noShowQuote({ checkIn: b.checkIn, paid, freeCancelDays: b.room.hotel.freeCancelDays, lateFeePercent: b.room.hotel.lateCancelFeePercent });
  return paid > 0
    ? `Báo khách không đến đơn ${b.code}? Khách sạn giữ ${formatVND(q.fee)}, hoàn khách ${formatVND(q.refund)}. Không hoàn tác được.`
    : `Báo khách không đến đơn ${b.code}? Đơn chưa thanh toán nên không phát sinh phí. Không hoàn tác được.`;
}

/**
 * Danh sách đơn đặt phòng dùng chung. Quản trị viên thấy mọi đơn và xử lý hoàn tiền; đối tác chỉ thấy đơn của khách sạn mình
 * và không xác nhận thanh toán hay hoàn tiền được (tiền do sàn thu và hoàn).
 */
export async function BookingsView({ searchParams, user }: { searchParams: Promise<SP>; user: Pick<SessionUser, "id" | "role"> }) {
  const isAdmin = user.role === "ADMIN";
  const base = isAdmin ? "/admin" : "/host";
  const sp = await searchParams;
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const picked = FILTERS.find((f) => f.value === raw && f.value !== "ALL")?.value;
  const status = picked && picked !== "REFUND" ? (picked as BookingStatus) : undefined;
  const refundOnly = isAdmin && picked === "REFUND";
  const scope = isAdmin ? {} : { room: { hotel: { ownerId: user.id } } };

  const today = todayUTC();
  const bookings = await prisma.booking.findMany({
    where: { ...scope, ...(refundOnly ? { status: "CANCELLED", paymentStatus: "PAID", OR: [{ refundAmount: null }, { refundAmount: { gt: 0 } }] } : status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true } }, room: { include: { hotel: { select: { name: true, freeCancelDays: true, lateCancelFeePercent: true } } } } },
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Đơn đặt phòng</h1>
        <a
          href={`/api/export/bookings${refundOnly ? "?status=REFUND" : status ? `?status=${status}` : ""}`}
          className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5"
        >
          Xuất CSV{refundOnly ? " (cần hoàn tiền)" : status ? ` (${STATUS_LABEL[status]?.text.toLowerCase()})` : ""}
        </a>
      </div>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {FILTERS.filter((f) => isAdmin || f.value !== "REFUND").map((f) => {
          const active = (refundOnly ? "REFUND" : (status ?? "ALL")) === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === "ALL" ? `${base}/bookings` : `${base}/bookings?status=${f.value}`}
              className={`rounded-full border px-3 py-1.5 font-medium ${active ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Khách</th>
              <th className="px-4 py-3">Phòng</th>
              <th className="px-4 py-3">Ngày ở</th>
              <th className="px-4 py-3">Tổng tiền</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Đổi trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bookings.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Không có đơn nào.</td></tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id} className="align-top">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{b.code}</td>
                <td className="px-4 py-3"><p className="font-semibold">{b.user.name}</p><p className="text-xs text-muted">{b.user.email}</p></td>
                <td className="px-4 py-3"><p className="font-semibold">{b.room.hotel.name}</p><p className="text-xs text-muted">{b.room.name} × {b.rooms}</p></td>
                <td className="px-4 py-3 text-xs">{formatDate(b.checkIn)}<br />→ {formatDate(b.checkOut)}</td>
                <td className="px-4 py-3">
                  <p className="font-bold">{formatVND(b.totalPrice)}</p>
                  {b.voucherCode && <p className="text-xs text-emerald-700">Mã {b.voucherCode}: -{formatVND(b.discount)}</p>}
                  <p className={`text-xs ${needsRefund(b.status, b.paymentStatus, b.refundAmount) ? "font-bold text-amber-700" : "text-muted"}`}>
                    {paymentLabel(b.status, b.paymentStatus, b.refundAmount)}
                    {needsRefund(b.status, b.paymentStatus, b.refundAmount) && ` ${formatVND(b.refundAmount ?? b.totalPrice)}`}
                  </p>
                  {b.status === "CANCELLED" && b.refundAmount !== null && b.refundAmount < b.totalPrice && <p className="text-xs text-muted">{b.noShow ? "Không đến" : "Hủy muộn"}: {b.refundAmount === 0 ? "giữ toàn bộ tiền" : `hoàn ${formatVND(b.refundAmount)}, giữ ${formatVND(b.totalPrice - b.refundAmount)}`}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusLabel(b.status, b.noShow).cls}`}>{statusLabel(b.status, b.noShow).text}</span>
                  {b.checkedInAt && <p className="mt-1 text-xs text-muted">Nhận phòng: {formatDateTime(b.checkedInAt)}</p>}
                  {b.checkedOutAt && <p className="text-xs text-muted">Trả phòng: {formatDateTime(b.checkedOutAt)}</p>}
                </td>
                <td className="px-4 py-3">
                  {isAdmin && needsRefund(b.status, b.paymentStatus, b.refundAmount) ? (
                    <RefundButton bookingId={b.id} />
                  ) : (
                  <div className="space-y-2">
                  {b.status === "CONFIRMED" && !b.checkedInAt && b.checkIn <= today && b.checkOut > today && <CheckInButton bookingId={b.id} />}
                  {canMarkNoShow(b, today) && <NoShowButton bookingId={b.id} confirmText={noShowConfirm(b)} />}
                  <SelectAction
                    target={{ kind: "booking-status", id: b.id }}
                    options={NEXT_STATUS[b.status].filter((s) => !(s === "CANCELLED" && b.checkedInAt) && (isAdmin || s !== "CONFIRMED")).map((s) => ({ value: s, label: ACTION_LABEL[s] }))}
                    confirmMessages={{ CANCELLED: `Hủy đơn ${b.code}? Đơn đã thanh toán sẽ được đánh dấu hoàn tiền.` }}
                  />
                  </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
