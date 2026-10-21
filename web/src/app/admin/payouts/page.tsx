import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { PayoutButton } from "@/components/admin/partner-controls";
import { formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import Link from "next/link";
import { listDeductions, listUnsettled, sumDeductions, sumRows } from "@/lib/settlement";

export const metadata: Metadata = { title: "Đối soát & chi trả" };

async function Payouts() {
  await requireAdmin("/admin/payouts");
  const [partners, history] = await Promise.all([
    prisma.user.findMany({ where: { role: "HOST" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.payout.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { owner: { select: { name: true } } } }),
  ]);
  const rows = await Promise.all(
    partners.map(async (p) => {
      const [unsettled, deductions] = await Promise.all([listUnsettled(prisma, p.id), listDeductions(prisma, p.id)]);
      const sum = sumRows(unsettled);
      const deducted = sumDeductions(deductions);
      return { partner: p, sum, count: unsettled.length, deducted, net: sum.payout - deducted, hasItems: unsettled.length + deductions.length > 0 };
    }),
  );
  const totalCommission = rows.reduce((s, r) => s + r.sum.commission, 0) + history.reduce((s, h) => s + h.commission, 0);
  const totalPromo = rows.reduce((s, r) => s + r.sum.promo, 0) + history.reduce((s, h) => s + h.promoCost, 0);

  return (
    <>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Đối soát &amp; chi trả</h1>
        <a href="/api/export/payouts" className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5">Xuất CSV lịch sử chi trả</a>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Sàn thu tiền của khách. Với mỗi đối tác: doanh thu từ đơn đã hoàn tất (và phí hủy muộn khách sạn được giữ) trừ hoa hồng của sàn là số tiền sàn chi trả.
        Hoa hồng tính theo tỷ lệ đã chốt tại thời điểm khách đặt phòng, trên giá phòng trước giảm giá. Mã giảm giá do sàn tạo nên <b>sàn chịu</b>: đối tác vẫn nhận như khi khách không dùng mã.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Hoa hồng sàn (đã + chưa chi trả)</p><p className="mt-1 text-2xl font-extrabold text-brand">{formatVND(totalCommission)}</p></div>
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Khuyến mãi sàn chịu</p><p className="mt-1 text-2xl font-extrabold">-{formatVND(totalPromo)}</p><p className="mt-0.5 text-xs text-muted">Thu nhập ròng của sàn: {formatVND(totalCommission - totalPromo)}</p></div>
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Cần chi trả cho đối tác</p><p className="mt-1 text-2xl font-extrabold">{formatVND(rows.reduce((s, r) => s + r.net, 0))}</p></div>
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
              <th className="px-4 py-3">Trừ khiếu nại</th>
              <th className="px-4 py-3">Chi trả đối tác</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Chưa có đối tác.</td></tr>}
            {rows.map(({ partner, sum, count, deducted, net, hasItems }) => (
              <tr key={partner.id} className="align-top">
                <td className="px-4 py-3"><p className="font-semibold">{partner.name}</p><p className="text-xs text-muted">{partner.email}</p></td>
                <td className="px-4 py-3">{count}</td>
                <td className="px-4 py-3">{formatVND(sum.gross)}</td>
                <td className="px-4 py-3 text-brand">{formatVND(sum.commission)}</td>
                <td className="px-4 py-3">{deducted > 0 ? `-${formatVND(deducted)}` : "—"}</td>
                <td className="px-4 py-3 font-bold">{formatVND(net)}</td>
                <td className="px-4 py-3 text-right"><PayoutButton ownerId={partner.id} amountLabel={formatVND(net)} disabled={!hasItems || net < 0} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display mb-3 mt-8 text-xl font-semibold">Lịch sử chi trả</h2>
      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Thời điểm</th><th className="px-4 py-3">Đối tác</th><th className="px-4 py-3">Số đơn</th><th className="px-4 py-3">Tổng thu</th><th className="px-4 py-3">Hoa hồng</th><th className="px-4 py-3">Trừ khiếu nại</th><th className="px-4 py-3">Đã chi</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">Chưa có đợt chi trả nào.</td></tr>}
            {history.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3 text-xs">{formatDateTime(h.createdAt)}</td>
                <td className="px-4 py-3 font-semibold">{h.owner.name}</td>
                <td className="px-4 py-3">{h.bookingCount}</td>
                <td className="px-4 py-3">{formatVND(h.gross)}</td>
                <td className="px-4 py-3">{formatVND(h.commission)}</td>
                <td className="px-4 py-3">{h.deductions > 0 ? `-${formatVND(h.deductions)}` : "—"}</td>
                <td className="px-4 py-3 font-bold">{formatVND(h.amount)}</td>
                <td className="px-4 py-3 text-xs text-muted">{h.note ?? "—"}</td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/payouts/${h.id}`} className="text-xs font-bold text-brand hover:underline">Chi tiết</Link></td>
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
