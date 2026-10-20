import Link from "next/link";
import { Bell, CalendarCheck, Building2, XCircle } from "lucide-react";
import { MarkAllRead } from "@/components/admin/mark-all-read";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

const ICON: Record<string, typeof Bell> = {
  BOOKING_PAID: CalendarCheck,
  BOOKING_CANCELLED: XCircle,
  HOTEL_PENDING: Building2,
  HOTEL_APPROVED: Building2,
  HOTEL_REJECTED: Building2,
};

/** Danh sách thông báo của người đăng nhập, dùng chung cho /admin và /host. */
export async function NotificationsView({ user }: { user: Pick<SessionUser, "id"> }) {
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Thông báo</h1>
          <p className="text-sm text-muted">{unread > 0 ? `${unread} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}</p>
        </div>
        {unread > 0 && <MarkAllRead />}
      </div>
      {items.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white p-10 text-center text-sm text-muted">Chưa có thông báo nào. Đơn mới và kết quả duyệt khách sạn sẽ hiện ở đây.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICON[n.kind] ?? Bell;
            const body = (
              <div className="flex gap-3">
                <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${n.readAt ? "bg-background text-muted" : "bg-brand/10 text-brand"}`}>
                  <Icon size={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    {n.title}
                    {!n.readAt && <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-bold text-white">Mới</span>}
                  </p>
                  <p className="text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id} className={`rounded-2xl border bg-white p-4 ${n.readAt ? "border-border" : "border-brand/30"}`}>
                {n.href ? <Link href={n.href} className="block hover:opacity-90">{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
