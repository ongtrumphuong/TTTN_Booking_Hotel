import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { ApprovalButtons, AssignOwnerForm, CommissionEditor } from "@/components/admin/partner-controls";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Đối tác khách sạn" };

const APPROVAL = {
  PENDING: { text: "Chờ duyệt", cls: "bg-amber-100 text-amber-800" },
  APPROVED: { text: "Đã duyệt", cls: "bg-emerald-100 text-emerald-800" },
  REJECTED: { text: "Bị từ chối", cls: "bg-red-100 text-red-700" },
} as const;

async function Partners() {
  await requireAdmin("/admin/partners");
  const [partners, pending, all] = await Promise.all([
    prisma.user.findMany({
      where: { role: "HOST" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, phone: true, hotels: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, city: true, approval: true, approvalNote: true, isActive: true, commissionPercent: true } } },
    }),
    prisma.hotel.findMany({ where: { approval: "PENDING", ownerId: { not: null } }, orderBy: { createdAt: "asc" }, include: { owner: { select: { name: true, email: true } }, rooms: { select: { id: true } } } }),
    prisma.hotel.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <h1 className="font-display mb-2 text-3xl font-semibold">Đối tác khách sạn</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Sàn trung gian: đối tác tự đăng ký, tự đăng khách sạn và phòng; quản trị viên duyệt trước khi hiển thị và đặt hoa hồng cho từng khách sạn.
      </p>

      <section className="mb-8 rounded-3xl border border-border bg-white p-5" aria-labelledby="pending-title">
        <h2 id="pending-title" className="font-display mb-3 text-xl font-semibold">Chờ duyệt <span className="text-base font-medium text-muted">({pending.length})</span></h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Không có khách sạn nào đang chờ duyệt.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{h.name} <span className="font-normal text-muted">· {h.city} · {h.rooms.length} loại phòng</span></p>
                  <p className="text-xs text-muted">Đối tác: {h.owner?.name} ({h.owner?.email})</p>
                </div>
                <ApprovalButtons hotelId={h.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 rounded-3xl border border-border bg-white p-5" aria-labelledby="partners-title">
        <h2 id="partners-title" className="font-display mb-3 text-xl font-semibold">Danh sách đối tác <span className="text-base font-medium text-muted">({partners.length})</span></h2>
        {partners.length === 0 ? (
          <p className="text-sm text-muted">Chưa có đối tác. Người dùng đăng ký tại trang <b>/partner/register</b>, hoặc bạn đổi vai trò ở mục Người dùng.</p>
        ) : (
          <div className="space-y-5">
            {partners.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border p-4">
                <p className="font-bold">{p.name} <span className="font-normal text-muted">· {p.email}{p.phone ? ` · ${p.phone}` : ""}</span></p>
                {p.hotels.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Chưa có khách sạn.</p>
                ) : (
                  <table className="mt-3 w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted">
                      <tr><th className="py-2">Khách sạn</th><th className="py-2">Trạng thái</th><th className="py-2">Hoa hồng</th><th className="py-2" /></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {p.hotels.map((h) => (
                        <tr key={h.id} className="align-top">
                          <td className="py-2.5 font-semibold">{h.name} <span className="font-normal text-muted">· {h.city}</span></td>
                          <td className="py-2.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${APPROVAL[h.approval].cls}`}>{APPROVAL[h.approval].text}</span>
                            {h.approval === "REJECTED" && h.approvalNote && <p className="mt-1 max-w-56 text-xs text-muted">{h.approvalNote}</p>}
                          </td>
                          <td className="py-2.5"><CommissionEditor hotelId={h.id} percent={h.commissionPercent} /></td>
                          <td className="py-2.5 text-right">{h.approval !== "APPROVED" && <ApprovalButtons hotelId={h.id} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-white p-5" aria-labelledby="assign-title">
        <h2 id="assign-title" className="font-display mb-1 text-xl font-semibold">Gán khách sạn cho đối tác</h2>
        <p className="mb-3 text-sm text-muted">Dùng để chuyển khách sạn có sẵn của sàn cho một đối tác quản lý (đối tác phải đăng ký trước).</p>
        <AssignOwnerForm hotels={all} />
      </section>
    </>
  );
}

export default function PartnersPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Partners />
    </Suspense>
  );
}
