import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

type Role = "USER" | "ADMIN" | "HOST";
const session = vi.hoisted(() => ({ user: { id: "", name: "Người dùng", role: "ADMIN" as Role, email: "u@test.local" } }));
vi.mock("@/lib/session", () => ({
  requireUser: async () => session.user,
  requireAdmin: async () => {
    if (session.user.role !== "ADMIN") throw new Error("admin only");
    return session.user;
  },
  requireStaff: async () => {
    if (session.user.role === "USER") throw new Error("staff only");
    return session.user;
  },
  getCurrentUser: async () => (session.user.id ? session.user : null),
  safeRedirect: (p: string) => p,
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {}, connection: async () => {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendBookingCancelled: vi.fn(), sendRefundCompleted: vi.fn(), sendBookingConfirmation: vi.fn(), sendPasswordResetEmail: vi.fn(), sendStaffNotice: vi.fn() }));

import { markRefundedAction, replyReviewAction, updateRoomAction } from "@/app/actions/admin";
import { setCommissionAction } from "@/app/actions/partner";
import { GET as exportBookings } from "@/app/api/export/bookings/route";
import { GET as exportPayouts } from "@/app/api/export/payouts/route";
import { notifyNewReview } from "@/lib/notify";

const as = (u: { id: string; name: string }, role: Role) => (session.user = { id: u.id, name: u.name, role, email: `${u.id}@test.local` });

beforeEach(resetDb);

async function setup() {
  const admin = await mkUser({ role: "ADMIN" });
  const owner = await mkUser({ role: "HOST" as never });
  const other = await mkUser({ role: "HOST" as never });
  const guest = await mkUser({ name: "Khách =Cmd" });
  const mine = await mkHotel({ name: "KS của tôi" });
  const theirs = await mkHotel({ name: "KS người khác" });
  await prisma.hotel.update({ where: { id: mine.id }, data: { ownerId: owner.id } });
  await prisma.hotel.update({ where: { id: theirs.id }, data: { ownerId: other.id } });
  return { admin, owner, other, guest, mine, theirs };
}

describe("phản hồi đánh giá", () => {
  it("chủ khách sạn và quản trị viên phản hồi được; đối tác khác bị từ chối; gỡ phản hồi bằng nội dung trống", async () => {
    const { admin, owner, other, guest, mine } = await setup();
    const rv = await prisma.review.create({ data: { hotelId: mine.id, userId: guest.id, rating: 5, comment: "Rất tốt, sẽ quay lại." } });

    as(other, "HOST");
    expect(await replyReviewAction(rv.id, "Cảm ơn")).toMatchObject({ error: expect.stringContaining("quyền") });
    expect((await prisma.review.findUniqueOrThrow({ where: { id: rv.id } })).reply).toBeNull();

    as(owner, "HOST");
    expect(await replyReviewAction(rv.id, "  Cảm ơn quý khách đã lưu trú!  ")).toEqual({ ok: true });
    const after1 = await prisma.review.findUniqueOrThrow({ where: { id: rv.id } });
    expect(after1.reply).toBe("Cảm ơn quý khách đã lưu trú!");
    expect(after1.repliedAt).not.toBeNull();

    as(admin, "ADMIN");
    expect(await replyReviewAction(rv.id, "")).toEqual({ ok: true });
    expect(await prisma.review.findUniqueOrThrow({ where: { id: rv.id } })).toMatchObject({ reply: null, repliedAt: null });
  });

  it("kiểm tra độ dài; đánh giá không tồn tại báo như không có quyền; khách không phản hồi được", async () => {
    const { owner, guest, mine } = await setup();
    const rv = await prisma.review.create({ data: { hotelId: mine.id, userId: guest.id, rating: 4, comment: "Phòng sạch sẽ, yên tĩnh." } });
    as(owner, "HOST");
    expect((await replyReviewAction(rv.id, "ok")).error).toMatch(/tối thiểu/);
    expect((await replyReviewAction(rv.id, "x".repeat(1001))).error).toMatch(/tối đa/);
    expect((await replyReviewAction("khong-co", "Cảm ơn bạn")).error).toMatch(/quyền/);
    as(guest, "USER");
    await expect(replyReviewAction(rv.id, "Tự khen")).rejects.toThrow();
  });

  it("đánh giá mới báo cho chủ khách sạn", async () => {
    const { owner, guest, mine } = await setup();
    await notifyNewReview(mine.id, guest.name, 4);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: owner.id } });
    expect(n).toMatchObject({ kind: "REVIEW_NEW", href: "/host/reviews" });
  });
});

describe("nhật ký thao tác", () => {
  it("ghi lại đổi hoa hồng, đổi giá phòng và xác nhận hoàn tiền kèm người thực hiện", async () => {
    const { admin, guest, mine } = await setup();
    as(admin, "ADMIN");

    await setCommissionAction(mine.id, "15");
    const room = mine.rooms[0];
    const f = new FormData();
    for (const [k, v] of Object.entries({ name: room.name, description: "Mô tả phòng thử", pricePerNight: "2000000", weekendPercent: "10", capacity: "2", bedType: "1 giường đôi", quantity: "5", images: "https://images.unsplash.com/photo-1", amenities: "", highlights: "", panoramaUrl: "" })) f.set(k, v);
    await updateRoomAction(room.id, {}, f);

    const b = await mkBooking({ userId: guest.id, roomId: room.id, checkIn: daysFromToday(3), checkOut: daysFromToday(5), status: "CANCELLED", paymentStatus: "PAID" });
    await prisma.booking.update({ where: { id: b.id }, data: { refundAmount: b.totalPrice } });
    expect(await markRefundedAction(b.id, "Đã chuyển khoản")).toEqual({ ok: true });

    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["COMMISSION", "ROOM_PRICE", "REFUND_DONE"]);
    expect(logs.every((l) => l.actorId === admin.id && l.actorRole === "ADMIN")).toBe(true);
    expect(logs[0].summary).toMatch(/→ 15%/);
    expect(logs[1].summary).toMatch(/2000000/);
    expect(logs[2].summary).toContain("Đã chuyển khoản");
  });

  it("thao tác bị từ chối không để lại nhật ký", async () => {
    const { owner, mine } = await setup();
    as(owner, "HOST");
    await expect(setCommissionAction(mine.id, "20")).rejects.toThrow();
    expect(await prisma.auditLog.count()).toBe(0);
  });
});

describe("xuất CSV", () => {
  const call = (route: typeof exportBookings, qs = "") => route(new NextRequest(`http://localhost/api/export/bookings${qs}`));

  it("chưa đăng nhập hoặc là khách thì bị từ chối", async () => {
    session.user = { id: "", name: "", role: "USER", email: "" };
    expect((await call(exportBookings)).status).toBe(403);
    const { guest } = await setup();
    as(guest, "USER");
    expect((await call(exportBookings)).status).toBe(403);
    expect((await exportPayouts()).status).toBe(403);
  });

  it("đối tác chỉ xuất đơn của khách sạn mình; tệp có BOM, tiêu đề và chặn công thức trong tên khách", async () => {
    const { owner, guest, mine, theirs } = await setup();
    await mkBooking({ userId: guest.id, roomId: mine.rooms[0].id, checkIn: daysFromToday(3), checkOut: daysFromToday(5), status: "CONFIRMED", paymentStatus: "PAID", code: "KGS-MINE0001" });
    await mkBooking({ userId: guest.id, roomId: theirs.rooms[0].id, checkIn: daysFromToday(3), checkOut: daysFromToday(5), status: "CONFIRMED", paymentStatus: "PAID", code: "KGS-THEIRS01" });

    as(owner, "HOST");
    const res = await call(exportBookings);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 để Excel đọc đúng tiếng Việt
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("Mã đặt phòng,")).toBe(true);
    expect(text).toContain("KGS-MINE0001");
    expect(text).not.toContain("KGS-THEIRS01");
    expect(text).toContain("Khách =Cmd"); // chỉ ký tự đầu ô mới bị xét
  });

  it("ô bắt đầu bằng dấu = được vô hiệu hóa; quản trị viên thấy mọi đơn; lọc trạng thái và ngày sai thì báo lỗi", async () => {
    const { admin, mine, theirs } = await setup();
    const evil = await mkUser({ name: "=HYPERLINK(1)" });
    await mkBooking({ userId: evil.id, roomId: mine.rooms[0].id, checkIn: daysFromToday(3), checkOut: daysFromToday(4), status: "CONFIRMED", paymentStatus: "PAID", code: "KGS-AAAA0001" });
    await mkBooking({ userId: evil.id, roomId: theirs.rooms[0].id, checkIn: daysFromToday(3), checkOut: daysFromToday(4), status: "PENDING", code: "KGS-BBBB0002" });
    as(admin, "ADMIN");
    const all = await (await call(exportBookings)).text();
    expect(all).toContain("'=HYPERLINK(1)");
    expect(all).toContain("KGS-AAAA0001");
    expect(all).toContain("KGS-BBBB0002");
    const onlyPending = await (await call(exportBookings, "?status=PENDING")).text();
    expect(onlyPending).toContain("KGS-BBBB0002");
    expect(onlyPending).not.toContain("KGS-AAAA0001");
    expect((await call(exportBookings, "?status=LUNG")).status).toBe(400);
    expect((await call(exportBookings, "?from=abc")).status).toBe(400);
  });

  it("xuất lịch sử chi trả: đối tác chỉ thấy của mình", async () => {
    const { admin, owner, other } = await setup();
    await prisma.payout.createMany({
      data: [
        { ownerId: owner.id, gross: 1000000, commission: 100000, amount: 900000, bookingCount: 2, createdById: admin.id },
        { ownerId: other.id, gross: 2000000, commission: 200000, amount: 1800000, bookingCount: 3, createdById: admin.id },
      ],
    });
    as(owner, "HOST");
    const mine = await (await exportPayouts()).text();
    expect(mine).toContain("900000");
    expect(mine).not.toContain("1800000");
    as(admin, "ADMIN");
    const all = await (await exportPayouts()).text();
    expect(all).toContain("900000");
    expect(all).toContain("1800000");
  });
});
