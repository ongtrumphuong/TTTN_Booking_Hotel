import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { PayoutButton } from "@/components/admin/partner-controls";
import { formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { listUnsettled, sumRows } from "@/lib/settlement";

export const metadata: Metadata = { title: "Đối soát & chi trả" };

async function Payouts() {
  await requireAdmin("/admin/payouts");
  const [partners, history] = await Promise.all([
    prisma.user.findMany({ where: { role: "HOST" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.payout.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { owner: { select: { name: true } } } }),
  ]);
  const rows = await Promise.all(
    partners.map(async (p) => {
      const unsettled = await listUnsettled(prisma, p.id);
      return { partner: p, sum: sumRows(unsettled), count: unsettled.length };
    }),
  );
  const totalCommission = rows.reduce((s, r) => s + r.sum.commission, 0) + history.reduce((s, h) => s + h.commission, 0);

  return (
    <>
      <h1 className="font-display mb-2 text-3xl font-semibold">Đối soát &amp; chi trả</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Sàn thu tiền của khách. Với mỗi đối tác: doanh thu từ đơn đã hoàn tất (và phí hủy muộn khách sạn được giữ) trừ hoa hồng của sàn là số tiền sàn chi trả.
        Hoa hồng tính theo tỷ lệ đã chốt tại thời điểm khách đặt phòng.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Hoa hồng sàn (đã + chưa chi trả)</p><p className="mt-1 text-2xl font-extrabold text-brand">{formatVND(totalCommission)}</p></div>
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Cần chi trả cho đối tác</p><p className="mt-1 text-2xl font-extrabold">{formatVND(rows.reduce((s, r) => s + r.sum.payout, 0))}</p></div>
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Đã chi trả</p><p className="mt-1 text-2xl font-extrabold">{formatVND(history.reduce((s, h) => s + h.amount, 0))}</p></div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Đối tác</th>
              <th className="px-4 py-3">Đơn chưa đối soát</th>
              <th className="px-4 py-3">Tổng thu</th>
              <th className="px-4 py-3">Hoa hồng sàn</th>
              <th className="px-4 py-3">Chi trả đối tác</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Chưa có đối tác.</td></tr>}
            {rows.map(({ partner, sum, count }) => (
              <tr key={partner.id} className="align-top">
                <td className="px-4 py-3"><p className="font-semibold">{partner.name}</p><p className="text-xs text-muted">{partner.email}</p></td>
                <td className="px-4 py-3">{count}</td>
                <td className="px-4 py-3">{formatVND(sum.gross)}</td>
                <td className="px-4 py-3 text-brand">{formatVND(sum.commission)}</td>
                <td className="px-4 py-3 font-bold">{formatVND(sum.payout)}</td>
                <td className="px-4 py-3 text-right"><PayoutButton ownerId={partner.id} amountLabel={formatVND(sum.payout)} disabled={count === 0} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display mb-3 mt-8 text-xl font-semibold">Lịch sử chi trả</h2>
      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Thời điểm</th><th className="px-4 py-3">Đối tác</th><th className="px-4 py-3">Số đơn</th><th className="px-4 py-3">Tổng thu</th><th className="px-4 py-3">Hoa hồng</th><th className="px-4 py-3">Đã chi</th><th className="px-4 py-3">Ghi chú</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Chưa có đợt chi trả nào.</td></tr>}
            {history.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3 text-xs">{formatDateTime(h.createdAt)}</td>
                <td className="px-4 py-3 font-semibold">{h.owner.name}</td>
                <td className="px-4 py-3">{h.bookingCount}</td>
                <td className="px-4 py-3">{formatVND(h.gross)}</td>
                <td className="px-4 py-3">{formatVND(h.commission)}</td>
                <td className="px-4 py-3 font-bold">{formatVND(h.amount)}</td>
                <td className="px-4 py-3 text-xs text-muted">{h.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PayoutsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Payouts />
    </Suspense>
  );
}
