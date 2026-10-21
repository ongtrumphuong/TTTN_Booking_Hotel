import Link from "next/link";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";
import { listPayoutLines, sumRows } from "@/lib/settlement";

const KIND = { COMPLETED: "Đơn hoàn tất", LATE_CANCEL: "Phí hủy muộn" } as const;

/** Chi tiết một đợt chi trả: từng đơn, hoa hồng đã chốt và các khoản trừ do khiếu nại. Quản trị viên xem mọi đợt; đối tác chỉ đợt của mình. */
export async function PayoutDetail({ id, user }: { id: string; user: Pick<SessionUser, "id" | "role"> }) {
  const base = user.role === "ADMIN" ? "/admin" : "/host";
  const payout = await prisma.payout.findFirst({
    where: { id, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) },
    include: { owner: { select: { name: true, email: true } } },
  });
  if (!payout) {
    // Không phân biệt "không tồn tại" với "của người khác".
    return (
      <div role="alert" className="rounded-3xl border border-border bg-white p-8 text-center">
        <p className="font-display text-xl font-semibold">Không tìm thấy đợt chi trả</p>
        <Link href={`${base}/payouts`} className="mt-4 inline-block font-semibold text-brand hover:underline">← Đối soát &amp; chi trả</Link>
      </div>
    );
  }

  const [rows, disputes] = await Promise.all([
    listPayoutLines(prisma, payout.id),
    prisma.dispute.findMany({ where: { payoutId: payout.id }, select: { id: true, partnerBearsAmount: true, booking: { select: { code: true } }, hotel: { select: { name: true } } } }),
  ]);
  const sum = sumRows(rows);

  return (
    <>
      <Link href={`${base}/payouts`} className="text-sm font-semibold text-muted hover:text-foreground">← Đối soát &amp; chi trả</Link>
      <div className="mb-5 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Chi tiết đợt chi trả</h1>
          <p className="text-sm text-muted">{formatDateTime(payout.createdAt)}{user.role === "ADMIN" ? ` · ${payout.owner.name} (${payout.owner.email})` : ""}{payout.note ? ` · ${payout.note}` : ""}</p>
        </div>
        <a href={`/api/export/settlement?payout=${payout.id}`} className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5">Xuất CSV chi tiết</a>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Tổng thu ({payout.bookingCount} đơn)</p><p className="mt-1 text-xl font-extrabold">{formatVND(payout.gross)}</p></div>
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Hoa hồng sàn</p><p className="mt-1 text-xl font-extrabold">-{formatVND(payout.commission)}</p></div>
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Khoản trừ khiếu nại</p><p className="mt-1 text-xl font-extrabold">-{formatVND(payout.deductions)}</p></div>
        <div className="rounded-3xl border border-brand/30 bg-brand/5 p-5"><p className="text-sm text-muted">{user.role === "ADMIN" ? "Đã chi trả" : "Bạn đã nhận"}</p><p className="mt-1 text-xl font-extrabold text-brand">{formatVND(payout.amount)}</p></div>
      </div>
      <p className="mb-6 text-xs text-muted">Công thức: tổng thu − hoa hồng sàn − khoản trừ khiếu nại = số tiền chi trả. Hoa hồng của từng đơn theo tỷ lệ đã chốt lúc khách đặt phòng.</p>

      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Mã đơn</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3">Khách sạn / khách</th><th className="px-4 py-3">Ngày ở</th><th className="px-4 py-3">Thu</th><th className="px-4 py-3">Hoa hồng</th><th className="px-4 py-3">Nhận</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-mono text-xs font-semibold">{r.code}</td>
                <td className="px-4 py-3">{KIND[r.kind]}</td>
                <td className="px-4 py-3"><p>{r.hotelName}</p><p className="text-xs text-muted">{r.guestName}</p></td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDate(r.checkIn)} → {formatDate(r.checkOut)}</td>
                <td className="px-4 py-3">{formatVND(r.gross)}</td>
                <td className="px-4 py-3 text-muted">{formatVND(r.commission)} ({r.commissionPercent}%)</td>
                <td className="px-4 py-3 font-bold">{formatVND(r.payout)}</td>
              </tr>
            ))}
            {disputes.map((d) => (
              <tr key={d.id} className="bg-red-50/50">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{d.booking.code}</td>
                <td className="px-4 py-3 text-red-700">Trừ khiếu nại</td>
                <td className="px-4 py-3">{d.hotel.name}</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3 font-bold text-red-700">-{formatVND(d.partnerBearsAmount)}</td>
              </tr>
            ))}
            {rows.length === 0 && disputes.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Đợt này không có dòng nào.</td></tr>}
          </tbody>
          <tfoot className="border-t border-border bg-sand/60 text-sm font-bold">
            <tr><td className="px-4 py-3" colSpan={4}>Tổng</td><td className="px-4 py-3">{formatVND(sum.gross)}</td><td className="px-4 py-3">{formatVND(sum.commission)}</td><td className="px-4 py-3">{formatVND(payout.amount)}</td></tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
