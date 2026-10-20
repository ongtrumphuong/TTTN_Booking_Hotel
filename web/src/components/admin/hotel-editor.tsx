import Link from "next/link";
import { notFound } from "next/navigation";
import { HotelForm } from "@/components/admin/hotel-form";
import { RoomBlocks } from "@/components/admin/room-blocks";
import { RoomForm } from "@/components/admin/room-form";
import { ToggleButton } from "@/components/admin/toggle-button";
import { canManageHotel } from "@/lib/access";
import { formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

/** Trang sửa khách sạn dùng chung cho quản trị viên (/admin) và đối tác (/host); quyền theo từng khách sạn được kiểm tra ở đây. */
export async function HotelEditor({ id, user }: { id: string; user: Pick<SessionUser, "id" | "role"> }) {
  const base = user.role === "ADMIN" ? "/admin" : "/host";
  if (!(await canManageHotel(user, id))) {
    // Không phân biệt "không tồn tại" với "không phải của bạn" để không lộ khách sạn của người khác.
    return (
      <div role="alert" className="rounded-3xl border border-border bg-white p-8 text-center">
        <p className="font-display text-xl font-semibold">Không tìm thấy khách sạn</p>
        <p className="mt-1 text-sm text-muted">Khách sạn không tồn tại hoặc không thuộc quyền quản lý của bạn.</p>
        <Link href={`${base}/hotels`} className="mt-4 inline-block font-semibold text-brand hover:underline">← Danh sách khách sạn</Link>
      </div>
    );
  }

  const hotel = await prisma.hotel.findUnique({
    where: { id },
    include: {
      rooms: {
        orderBy: { pricePerNight: "asc" },
        include: { blocks: { where: { endDate: { gt: new Date() } }, orderBy: { startDate: "asc" } } },
      },
    },
  });
  if (!hotel) notFound();

  return (
    <>
      <Link href={`${base}/hotels`} className="text-sm font-semibold text-muted hover:text-foreground">← Danh sách khách sạn</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">{hotel.name}</h1>
      </div>

      {hotel.ownerId && hotel.approval === "PENDING" && (
        <div role="status" className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <b>Đang chờ sàn duyệt.</b> Khách sạn chưa hiển thị công khai cho đến khi quản trị viên duyệt.
        </div>
      )}
      {hotel.ownerId && hotel.approval === "REJECTED" && (
        <div role="alert" className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          <b>Khách sạn bị từ chối:</b> {hotel.approvalNote ?? "không có lý do."} Sửa lại thông tin rồi lưu để gửi duyệt lại.
        </div>
      )}
      <HotelForm hotel={hotel} />

      <h2 className="mb-3 mt-10 text-xl font-extrabold">Loại phòng <span className="text-base font-medium text-muted">({hotel.rooms.length})</span></h2>
      <div className="space-y-3">
        {hotel.rooms.map((r) => (
          <details key={r.id} className="rounded-3xl border border-border bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
              <span>
                <span className="font-bold">{r.name}</span>
                <span className="ml-2 text-sm text-muted">{formatVND(r.pricePerNight)}/đêm · {r.quantity} phòng · {r.capacity} khách</span>
              </span>
              <ToggleButton kind="room" id={r.id} active={r.isActive} />
            </summary>
            <div className="border-t border-border p-4">
              <RoomForm hotelId={hotel.id} room={r} />
              <RoomBlocks roomId={r.id} quantity={r.quantity} blocks={r.blocks.map((b) => ({ id: b.id, start: b.startDate.toISOString().slice(0, 10), end: new Date(b.endDate.getTime() - 86_400_000).toISOString().slice(0, 10), rooms: b.rooms, reason: b.reason }))} />
            </div>
          </details>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-white p-5">
        <h3 className="mb-3 font-bold">Thêm loại phòng mới</h3>
        <RoomForm hotelId={hotel.id} />
      </div>
    </>
  );
}
