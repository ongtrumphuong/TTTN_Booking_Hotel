import "server-only";
import { prisma } from "@/lib/prisma";
import { sendStaffNotice } from "@/lib/email";
import { formatDate, formatVND } from "@/lib/format";

export type NoticeInput = { kind: string; title: string; body: string; href?: string };

/** Tạo thông báo trong ứng dụng cho nhiều người nhận. */
export async function notifyUsers(userIds: string[], n: NoticeInput) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, kind: n.kind, title: n.title, body: n.body, href: n.href ?? null })) });
}

const appBase = () => (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Báo cho bên vận hành khách sạn khi đơn mới được thanh toán hoặc đơn đã thanh toán bị hủy:
 * khách sạn của đối tác thì báo đối tác (thông báo + email); khách sạn do sàn tự vận hành thì báo các quản trị viên.
 * Không bao giờ ném lỗi để không làm hỏng luồng thanh toán/hủy đơn.
 */
export async function notifyBookingEvent(bookingId: string, event: "PAID" | "CANCELLED" | "RESCHEDULED") {
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: { select: { name: true } }, room: { select: { name: true, hotel: { select: { name: true, ownerId: true, owner: { select: { name: true, email: true } } } } } } },
    });
    if (!b) return;
    if ((event === "PAID" || event === "RESCHEDULED") && b.status !== "CONFIRMED") return;
    if (event === "CANCELLED" && b.status !== "CANCELLED") return;

    const owner = b.room.hotel.owner;
    const recipients = b.room.hotel.ownerId
      ? [b.room.hotel.ownerId]
      : (await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })).map((u) => u.id);
    const base = b.room.hotel.ownerId ? "/host" : "/admin";
    const paid = event === "PAID";

    const summary = `${b.code} · ${b.user.name} · ${b.room.name} × ${b.rooms} · ${formatDate(b.checkIn)} → ${formatDate(b.checkOut)} · ${formatVND(b.totalPrice)}`;
    const moved = event === "RESCHEDULED";
    const title = paid ? `Đơn mới tại ${b.room.hotel.name}` : moved ? `Khách đổi ngày ở tại ${b.room.hotel.name}` : `Đơn bị hủy tại ${b.room.hotel.name}`;
    await notifyUsers(recipients, { kind: paid ? "BOOKING_PAID" : moved ? "BOOKING_RESCHEDULED" : "BOOKING_CANCELLED", title, body: summary, href: `${base}/bookings` });

    if (owner) {
      await sendStaffNotice(owner.email, {
        subject: `${paid ? "Đơn mới" : moved ? "Khách đổi ngày" : "Đơn bị hủy"} ${b.code} - ${b.room.hotel.name}`,
        heading: paid ? "Bạn có đơn đặt phòng mới" : moved ? "Một đơn đặt phòng đã đổi ngày ở" : "Một đơn đặt phòng đã bị hủy",
        guestName: owner.name,
        intro: paid
          ? "khách sạn của bạn vừa có một đơn đặt phòng đã thanh toán."
          : moved
            ? "một khách vừa đổi ngày ở của đơn tại khách sạn của bạn. Ngày dưới đây là ngày mới."
            : "một đơn đặt phòng đã thanh toán tại khách sạn của bạn vừa bị hủy.",
        rows: [
          ["Mã đặt phòng", b.code],
          ["Khách", b.user.name],
          ["Loại phòng", `${b.room.name} × ${b.rooms}`],
          ["Nhận phòng", formatDate(b.checkIn)],
          ["Trả phòng", formatDate(b.checkOut)],
          ["Giá trị đơn", formatVND(b.totalPrice)],
        ],
        link: `${appBase()}/host/bookings`,
      });
    }
  } catch (e) {
    console.error("[notify] Gửi thông báo đơn thất bại:", e instanceof Error ? e.message : e);
  }
}

/** Báo các quản trị viên có khách sạn của đối tác đang chờ duyệt. */
export async function notifyHotelPending(hotelId: string) {
  try {
    const h = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { name: true, city: true, owner: { select: { name: true } } } });
    if (!h) return;
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await notifyUsers(admins.map((a) => a.id), {
      kind: "HOTEL_PENDING",
      title: "Khách sạn chờ duyệt",
      body: `${h.name} (${h.city}) của đối tác ${h.owner?.name ?? "—"} đang chờ duyệt.`,
      href: "/admin/partners",
    });
  } catch (e) {
    console.error("[notify] Gửi thông báo duyệt khách sạn thất bại:", e instanceof Error ? e.message : e);
  }
}

/** Báo đối tác kết quả duyệt khách sạn. */
export async function notifyHotelDecision(hotelId: string, approved: boolean, note?: string | null) {
  try {
    const h = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { name: true, ownerId: true } });
    if (!h?.ownerId) return;
    await notifyUsers([h.ownerId], {
      kind: approved ? "HOTEL_APPROVED" : "HOTEL_REJECTED",
      title: approved ? "Khách sạn đã được duyệt" : "Khách sạn bị từ chối",
      body: approved ? `${h.name} đã hiển thị công khai và nhận đặt phòng.` : `${h.name}: ${note || "không có lý do"}. Hãy chỉnh sửa rồi gửi duyệt lại.`,
      href: `/host/hotels/${hotelId}`,
    });
  } catch (e) {
    console.error("[notify] Gửi thông báo kết quả duyệt thất bại:", e instanceof Error ? e.message : e);
  }
}

/** Báo chủ khách sạn (hoặc các quản trị viên nếu là khách sạn của sàn) có đánh giá mới để kịp phản hồi. */
export async function notifyNewReview(hotelId: string, guestName: string, rating: number) {
  try {
    const h = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { name: true, ownerId: true } });
    if (!h) return;
    const recipients = h.ownerId ? [h.ownerId] : (await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })).map((u) => u.id);
    await notifyUsers(recipients, {
      kind: "REVIEW_NEW",
      title: `Đánh giá mới tại ${h.name}`,
      body: `${guestName} đánh giá ${rating}/5 sao. Hãy phản hồi để khách thấy bạn quan tâm.`,
      href: h.ownerId ? "/host/reviews" : "/admin/reviews",
    });
  } catch (e) {
    console.error("[notify] Gửi thông báo đánh giá mới thất bại:", e instanceof Error ? e.message : e);
  }
}
