import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { CheckInButton } from "@/components/admin/check-in-button";
import { RefundButton } from "@/components/admin/refund-button";
import { SelectAction } from "@/components/admin/select-action";
import { NEXT_STATUS, STATUS_LABEL, needsRefund, paymentLabel, todayUTC } from "@/lib/booking";
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
    include: { user: { select: { name: true, email: true } }, room: { include: { hotel: { select: { name: true } } } } },
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
                  {b.status === "CANCELLED" && b.refundAmount !== null && b.refundAmount < b.totalPrice && <p className="text-xs text-muted">Hủy muộn: {b.refundAmount === 0 ? "giữ toàn bộ tiền" : `hoàn ${formatVND(b.refundAmount)}, giữ ${formatVND(b.totalPrice - b.refundAmount)}`}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_LABEL[b.status].cls}`}>{STATUS_LABEL[b.status].text}</span>
                  {b.checkedInAt && <p className="mt-1 text-xs text-muted">Nhận phòng: {formatDateTime(b.checkedInAt)}</p>}
                  {b.checkedOutAt && <p className="text-xs text-muted">Trả phòng: {formatDateTime(b.checkedOutAt)}</p>}
                </td>
                <td className="px-4 py-3">
                  {isAdmin && needsRefund(b.status, b.paymentStatus, b.refundAmount) ? (
                    <RefundButton bookingId={b.id} />
                  ) : (
                  <div className="space-y-2">
                  {b.status === "CONFIRMED" && !b.checkedInAt && b.checkIn <= today && b.checkOut > today && <CheckInButton bookingId={b.id} />}
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
