import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/session";
import Link from "next/link";
import { listDeductions, listUnsettled, sumDeductions, sumRows } from "@/lib/settlement";

export const metadata: Metadata = { title: "Đối soát & chi trả" };

async function Payouts() {
  const user = await requireHost("/host/payouts");
  const [rows, deductions, history] = await Promise.all([
    listUnsettled(prisma, user.id),
    listDeductions(prisma, user.id),
    prisma.payout.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const sum = sumRows(rows);
  const deducted = sumDeductions(deductions);

  return (
    <>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Đối soát &amp; chi trả</h1>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/settlement?unsettled=1" className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5">Xuất CSV đơn chưa đối soát</a>
          <a href="/api/export/payouts" className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5">Xuất CSV lịch sử chi trả</a>
        </div>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Sàn thu tiền của khách và chi trả cho bạn sau khi trừ hoa hồng. Chỉ đơn đã hoàn tất (khách đã trả phòng) và phí hủy muộn được tính vào đối soát.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Tổng thu chưa đối soát</p><p className="mt-1 text-2xl font-extrabold">{formatVND(sum.gross)}</p></div>
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Hoa hồng sàn</p><p className="mt-1 text-2xl font-extrabold">-{formatVND(sum.commission)}</p></div>
        <div className="rounded-3xl border border-border bg-white p-5"><p className="text-sm text-muted">Khoản trừ khiếu nại</p><p className="mt-1 text-2xl font-extrabold">-{formatVND(deducted)}</p></div>
        <div className="rounded-3xl border border-brand/30 bg-brand/5 p-5"><p className="text-sm text-muted">Bạn sẽ nhận</p><p className="mt-1 text-2xl font-extrabold text-brand">{formatVND(sum.payout - deducted)}</p></div>
      </div>
      {deductions.length > 0 && (
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50/60 p-5 text-sm">
          <p className="font-bold text-red-800">Khoản trừ do khiếu nại đã được sàn quyết định ({deductions.length})</p>
          <ul className="mt-1 space-y-0.5 text-red-900">
            {deductions.map((d) => <li key={d.id}>Đơn <span className="font-mono text-xs font-semibold">{d.bookingCode}</span> ({d.hotelName}): -{formatVND(d.amount)}</li>)}
          </ul>
          <p className="mt-2 text-xs text-red-800">Các khoản này được trừ vào đợt chi trả kế tiếp. Xem chi tiết ở mục Khiếu nại.</p>
        </div>
      )}

      <h2 className="font-display mb-3 text-xl font-semibold">Đơn chưa đối soát <span className="text-base font-medium text-muted">({rows.length})</span></h2>
      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Mã đơn</th><th className="px-4 py-3">Khách sạn</th><th className="px-4 py-3">Thu</th><th className="px-4 py-3">Hoa hồng</th><th className="px-4 py-3">Bạn nhận</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Không có đơn nào chờ đối soát.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-mono text-xs font-semibold">{r.code}</td>
                <td className="px-4 py-3">{r.hotelName}</td>
                <td className="px-4 py-3">{formatVND(r.gross)}</td>
                <td className="px-4 py-3 text-muted">{formatVND(r.commission)} ({r.commissionPercent}%)</td>
                <td className="px-4 py-3 font-bold">{formatVND(r.payout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display mb-3 mt-8 text-xl font-semibold">Lịch sử chi trả</h2>
      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Thời điểm</th><th className="px-4 py-3">Số đơn</th><th className="px-4 py-3">Tổng thu</th><th className="px-4 py-3">Hoa hồng</th><th className="px-4 py-3">Trừ khiếu nại</th><th className="px-4 py-3">Đã nhận</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Chưa có đợt chi trả nào.</td></tr>}
            {history.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3 text-xs">{formatDateTime(h.createdAt)}</td>
                <td className="px-4 py-3">{h.bookingCount}</td>
                <td className="px-4 py-3">{formatVND(h.gross)}</td>
                <td className="px-4 py-3">{formatVND(h.commission)}</td>
                <td className="px-4 py-3">{h.deductions > 0 ? `-${formatVND(h.deductions)}` : "—"}</td>
                <td className="px-4 py-3 font-bold">{formatVND(h.amount)}</td>
                <td className="px-4 py-3 text-xs text-muted">{h.note ?? "—"}</td>
                <td className="px-4 py-3 text-right"><Link href={`/host/payouts/${h.id}`} className="text-xs font-bold text-brand hover:underline">Chi tiết</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function HostPayoutsPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Payouts />
    </Suspense>
  );
}
