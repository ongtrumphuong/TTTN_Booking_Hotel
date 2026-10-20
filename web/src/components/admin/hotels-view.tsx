import Link from "next/link";
import { Plus } from "lucide-react";
import { ToggleButton } from "@/components/admin/toggle-button";
import { formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

const APPROVAL = {
  PENDING: { text: "Chờ duyệt", cls: "bg-amber-100 text-amber-800" },
  REJECTED: { text: "Bị từ chối", cls: "bg-red-100 text-red-700" },
} as const;

/** Danh sách khách sạn dùng chung: quản trị viên thấy tất cả (kèm đối tác sở hữu), đối tác chỉ thấy khách sạn của mình. */
export async function HotelsView({ user }: { user: Pick<SessionUser, "id" | "role"> }) {
  const isAdmin = user.role === "ADMIN";
  const base = isAdmin ? "/admin" : "/host";
  const hotels = await prisma.hotel.findMany({
    where: isAdmin ? {} : { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { rooms: { select: { pricePerNight: true } }, owner: { select: { name: true } } },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">
          {isAdmin ? "Khách sạn" : "Khách sạn của tôi"} <span className="text-base font-medium text-muted">({hotels.length})</span>
        </h1>
        <Link href={`${base}/hotels/new`} className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-dark">
          <Plus size={16} aria-hidden /> Thêm khách sạn
        </Link>
      </div>
      {!isAdmin && (
        <p className="mb-4 rounded-2xl bg-brand/10 px-4 py-3 text-sm text-brand-dark">
          Khách sạn mới cần được quản trị viên sàn duyệt trước khi hiển thị cho khách. Sau khi duyệt, bạn tự bật/tắt hiển thị và quản lý phòng, giá, lịch chặn.
        </p>
      )}

      <div className="overflow-x-auto rounded-3xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-sand text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Khách sạn</th>
              <th className="px-4 py-3">Thành phố</th>
              {isAdmin && <th className="px-4 py-3">Đối tác</th>}
              <th className="px-4 py-3">Phòng</th>
              <th className="px-4 py-3">Giá từ</th>
              <th className="px-4 py-3">Hiển thị</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {hotels.length === 0 && (
              <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center text-muted">Chưa có khách sạn nào.</td></tr>
            )}
            {hotels.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3 font-semibold">{h.name} <span className="font-normal text-muted">· {h.starRating}★</span></td>
                <td className="px-4 py-3">{h.city}</td>
                {isAdmin && <td className="px-4 py-3">{h.owner ? <span>{h.owner.name} <span className="text-xs text-muted">({h.commissionPercent}%)</span></span> : <span className="text-muted">Sàn tự vận hành</span>}</td>}
                <td className="px-4 py-3">{h.rooms.length}</td>
                <td className="px-4 py-3">{h.rooms.length ? formatVND(Math.min(...h.rooms.map((r) => r.pricePerNight))) : "—"}</td>
                <td className="px-4 py-3">
                  {h.approval !== "APPROVED" ? (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${APPROVAL[h.approval].cls}`}>{APPROVAL[h.approval].text}</span>
                  ) : (
                    <ToggleButton kind="hotel" id={h.id} active={h.isActive} />
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`${base}/hotels/${h.id}`} className="font-semibold text-brand hover:underline">Chỉnh sửa</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
