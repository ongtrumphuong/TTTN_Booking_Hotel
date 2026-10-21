import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

type Role = "USER" | "ADMIN" | "HOST";
const session = vi.hoisted(() => ({ user: { id: "", name: "Người dùng", role: "USER" as Role, email: "u@test.local" } }));
class Denied extends Error {}
vi.mock("@/lib/session", () => ({
  requireUser: async () => session.user,
  requireAdmin: async () => {
    if (session.user.role !== "ADMIN") throw new Denied("admin only");
    return session.user;
  },
  requireHost: async () => {
    if (session.user.role !== "HOST") throw new Denied("host only");
    return session.user;
  },
  requireStaff: async () => {
    if (session.user.role === "USER") throw new Denied("staff only");
    return session.user;
  },
  getCurrentUser: async () => (session.user.id ? session.user : null),
  safeRedirect: (p: string) => p,
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void Promise.resolve(fn()).catch(() => {}), connection: async () => {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendBookingCancelled: vi.fn(), sendRefundCompleted: vi.fn(), sendBookingConfirmation: vi.fn(), sendPasswordResetEmail: vi.fn(), sendStaffNotice: vi.fn(), sendNotice: vi.fn(async () => ({ sent: true })) }));

import { createDisputeAction, markDisputeRefundedAction, resolveDisputeAction, respondDisputeAction } from "@/app/actions/dispute";
import { createPayoutAction } from "@/app/actions/partner";
import { GET as exportSettlement } from "@/app/api/export/settlement/route";
import { bookingCode } from "@/lib/booking";
import { listDeductions, listUnsettled, netPayout, sumRows } from "@/lib/settlement";

const as = (u: { id: string; name: string }, role: Role) => (session.user = { id: u.id, name: u.name, role, email: `${u.id}@test.local` });
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const GOOD = { category: "ROOM_MISMATCH", description: "Phòng không có ban công như trong ảnh quảng cáo." };

beforeEach(resetDb);

async function setup() {
  const admin = await mkUser({ role: "ADMIN" });
  const owner = await mkUser({ role: "HOST" as never });
  const other = await mkUser({ role: "HOST" as never });
  const guest = await mkUser({ name: "Khách Khiếu Nại" });
  const stranger = await mkUser();
  const hotel = await mkHotel({ name: "KS Đối tác" });
  await prisma.hotel.update({ where: { id: hotel.id }, data: { ownerId: owner.id, commissionPercent: 10 } });
  const own = await mkHotel({ name: "KS của sàn" });
  // Đơn đã hoàn tất, đã thanh toán, trả phòng hôm qua.
  const done = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(-3), checkOut: daysFromToday(-1), status: "COMPLETED", paymentStatus: "PAID", total: 2_000_000, code: bookingCode() });
  await prisma.booking.update({ where: { id: done.id }, data: { commissionPercent: 10 } });
  return { admin, owner, other, guest, stranger, hotel, own, done };
}

describe("khách gửi khiếu nại", () => {
  it("gửi được cho đơn của mình đã diễn ra; mỗi đơn chỉ một lần; báo cho đối tác và quản trị viên", async () => {
    const { admin, owner, guest, done } = await setup();
    as(guest, "USER");
    expect(await createDisputeAction(done.id, {}, fd(GOOD))).toEqual({ ok: true });
    const d = await prisma.dispute.findUniqueOrThrow({ where: { bookingId: done.id } });
    expect(d).toMatchObject({ status: "OPEN", category: "ROOM_MISMATCH", userId: guest.id });
    expect(await createDisputeAction(done.id, {}, fd(GOOD))).toMatchObject({ error: "Đơn này đã có khiếu nại." });
    await new Promise((r) => setTimeout(r, 50));
    expect(await prisma.notification.count({ where: { userId: owner.id, kind: "DISPUTE_NEW" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: admin.id, kind: "DISPUTE_NEW" } })).toBe(1);
  });

  it("từ chối: mô tả quá ngắn, loại sai, đơn của người khác, đơn chưa diễn ra, đơn chưa thanh toán", async () => {
    const { guest, stranger, hotel, done } = await setup();
    as(guest, "USER");
    expect((await createDisputeAction(done.id, {}, fd({ ...GOOD, description: "ngắn" }))).error).toMatch(/tối thiểu/);
    expect((await createDisputeAction(done.id, {}, fd({ ...GOOD, category: "LUNG" }))).error).toMatch(/loại vấn đề/);
    const future = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(5), checkOut: daysFromToday(7), status: "CONFIRMED", paymentStatus: "PAID", code: bookingCode() });
    expect((await createDisputeAction(future.id, {}, fd(GOOD))).error).toMatch(/từ ngày nhận phòng/);
    const unpaid = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(-3), checkOut: daysFromToday(-2), status: "PENDING", code: bookingCode() });
    expect((await createDisputeAction(unpaid.id, {}, fd(GOOD))).error).toMatch(/đã thanh toán/);
    as(stranger, "USER");
    expect((await createDisputeAction(done.id, {}, fd(GOOD))).error).toMatch(/Không tìm thấy/);
    expect(await prisma.dispute.count()).toBe(0);
  });
});

describe("đối tác phản hồi", () => {
  it("chỉ chủ khách sạn phản hồi được; chuyển sang 'sàn đang xem xét'; sửa lại được; quản trị viên không phản hồi thay", async () => {
    const { admin, owner, other, guest, done } = await setup();
    as(guest, "USER");
    await createDisputeAction(done.id, {}, fd(GOOD));
    const d = await prisma.dispute.findUniqueOrThrow({ where: { bookingId: done.id } });

    as(other, "HOST");
    expect(await respondDisputeAction(d.id, "Không phải khách sạn của tôi, thử phản hồi")).toMatchObject({ error: expect.stringContaining("quyền") });

    as(owner, "HOST");
    expect((await respondDisputeAction(d.id, "ngắn")).error).toMatch(/tối thiểu/);
    expect(await respondDisputeAction(d.id, "Phòng có ban công, ảnh chụp từ tầng 3; khách ở phòng tầng 2.")).toEqual({ ok: true });
    let after = await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } });
    expect(after.status).toBe("UNDER_REVIEW");
    expect(after.hostResponse).toContain("tầng 3");
    expect(await respondDisputeAction(d.id, "Cập nhật: khách sạn xin lỗi và đề nghị hoàn một phần.")).toEqual({ ok: true });
    after = await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } });
    expect(after.hostResponse).toContain("Cập nhật");

    as(admin, "ADMIN");
    expect((await respondDisputeAction(d.id, "Quản trị viên viết thay đối tác")).error).toMatch(/việc của khách sạn/);
  });
});

describe("sàn quyết định và trừ vào chi trả", () => {
  async function disputed() {
    const ctx = await setup();
    as(ctx.guest, "USER");
    await createDisputeAction(ctx.done.id, {}, fd(GOOD));
    const dispute = await prisma.dispute.findUniqueOrThrow({ where: { bookingId: ctx.done.id } });
    return { ...ctx, dispute };
  }

  it("chỉ quản trị viên quyết định; kiểm tra số tiền; quyết định xong không đổi được", async () => {
    const { admin, owner, dispute } = await disputed();
    as(owner, "HOST");
    await expect(resolveDisputeAction(dispute.id, { decision: "REFUND", refund: 100_000, partnerBears: 100_000, note: "Tự quyết" })).rejects.toThrow(Denied);

    as(admin, "ADMIN");
    expect((await resolveDisputeAction(dispute.id, { decision: "REFUND", refund: 3_000_000, partnerBears: 0, note: "Hoàn quá số tiền đơn" })).error).toMatch(/vượt quá/);
    expect((await resolveDisputeAction(dispute.id, { decision: "REFUND", refund: 500_000, partnerBears: 600_000, note: "Chia sai phần" })).error).toMatch(/không được lớn hơn/);
    expect((await resolveDisputeAction(dispute.id, { decision: "REFUND", refund: 500_000, partnerBears: 300_000, note: "" })).error).toMatch(/lý do/);
    expect((await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } })).status).toBe("OPEN");

    expect(await resolveDisputeAction(dispute.id, { decision: "REFUND", refund: 500_000, partnerBears: 300_000, note: "Phòng không đúng mô tả, hoàn 500k" })).toEqual({ ok: true });
    expect(await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } })).toMatchObject({ status: "RESOLVED", refundAmount: 500_000, partnerBearsAmount: 300_000, resolvedById: admin.id });
    expect((await resolveDisputeAction(dispute.id, { decision: "REJECT", refund: 0, partnerBears: 0, note: "Đổi ý sau khi đã quyết" })).error).toMatch(/đã được xử lý/);
    const logs = await prisma.auditLog.findMany({ where: { action: "DISPUTE" } });
    expect(logs.some((l) => l.summary.includes("đối tác chịu 300000"))).toBe(true);
  });

  it("bác bỏ không hoàn và không trừ gì", async () => {
    const { admin, owner, dispute } = await disputed();
    as(admin, "ADMIN");
    expect(await resolveDisputeAction(dispute.id, { decision: "REJECT", refund: 999, partnerBears: 999, note: "Khách sạn chứng minh phòng đúng mô tả" })).toEqual({ ok: true });
    expect(await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } })).toMatchObject({ status: "REJECTED", refundAmount: 0, partnerBearsAmount: 0 });
    expect(await listDeductions(prisma, owner.id)).toEqual([]);
  });

  it("khoản đối tác chịu được trừ vào đợt chi trả kế tiếp đúng một lần; phần sàn chịu không trừ", async () => {
    const { admin, owner, dispute, done } = await disputed();
    as(admin, "ADMIN");
    await resolveDisputeAction(dispute.id, { decision: "REFUND", refund: 500_000, partnerBears: 300_000, note: "Chia 300k đối tác, 200k sàn" });

    // Đơn hoàn tất 2.000.000, hoa hồng 10% => đối tác nhận 1.800.000; trừ 300.000 => 1.500.000.
    const rows = await listUnsettled(prisma, owner.id);
    expect(rows.map((r) => r.id)).toEqual([done.id]);
    expect(sumRows(rows)).toEqual({ gross: 2_000_000, commission: 200_000, payout: 1_800_000, promo: 0 });
    const deds = await listDeductions(prisma, owner.id);
    expect(deds).toHaveLength(1);
    expect(netPayout(rows, deds)).toBe(1_500_000);

    expect(await createPayoutAction(owner.id, "Đợt 1")).toEqual({ ok: true });
    const payout = await prisma.payout.findFirstOrThrow({ where: { ownerId: owner.id } });
    expect(payout).toMatchObject({ gross: 2_000_000, commission: 200_000, deductions: 300_000, amount: 1_500_000, bookingCount: 1 });
    expect((await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } })).payoutId).toBe(payout.id);
    expect(await listDeductions(prisma, owner.id)).toEqual([]);
    expect((await createPayoutAction(owner.id, "")).error).toMatch(/Không có đơn/); // không chi trả lần hai
  });

  it("khoản trừ lớn hơn doanh thu thì không tạo đợt chi trả (âm), giữ lại cho kỳ sau", async () => {
    const { admin, owner, hotel, guest } = await setup();
    // Đơn lớn đã nằm trong đợt cũ; khiếu nại mới trừ 900k nhưng chưa có doanh thu mới.
    await prisma.booking.updateMany({ data: { payoutId: (await prisma.payout.create({ data: { ownerId: owner.id, gross: 1, commission: 0, amount: 1, bookingCount: 1, createdById: admin.id } })).id } });
    const b2 = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(-9), checkOut: daysFromToday(-7), status: "CONFIRMED", paymentStatus: "PAID", total: 1_000_000, code: bookingCode() });
    as(guest, "USER");
    await createDisputeAction(b2.id, {}, fd(GOOD));
    const d = await prisma.dispute.findUniqueOrThrow({ where: { bookingId: b2.id } });
    as(admin, "ADMIN");
    await resolveDisputeAction(d.id, { decision: "REFUND", refund: 900_000, partnerBears: 900_000, note: "Lỗi hoàn toàn của khách sạn" });
    const before = await prisma.payout.count();
    expect((await createPayoutAction(owner.id, "")).error).toMatch(/lớn hơn doanh thu/);
    expect(await prisma.payout.count()).toBe(before);
    expect((await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } })).payoutId).toBeNull();
  });

  it("khách sạn của sàn: sàn chịu toàn bộ; xác nhận đã hoàn tiền một lần", async () => {
    const { admin, guest, own } = await setup();
    const b = await mkBooking({ userId: guest.id, roomId: own.rooms[0].id, checkIn: daysFromToday(-3), checkOut: daysFromToday(-1), status: "COMPLETED", paymentStatus: "PAID", total: 800_000, code: bookingCode() });
    as(guest, "USER");
    await createDisputeAction(b.id, {}, fd(GOOD));
    const d = await prisma.dispute.findUniqueOrThrow({ where: { bookingId: b.id } });
    as(admin, "ADMIN");
    expect((await resolveDisputeAction(d.id, { decision: "REFUND", refund: 200_000, partnerBears: 200_000, note: "Thử trừ vào đối tác" })).error).toMatch(/sàn tự vận hành/);
    expect(await resolveDisputeAction(d.id, { decision: "REFUND", refund: 200_000, partnerBears: 0, note: "Sàn hoàn 200k do lỗi dịch vụ" })).toEqual({ ok: true });
    expect(await markDisputeRefundedAction(d.id)).toEqual({ ok: true });
    expect((await prisma.dispute.findUniqueOrThrow({ where: { id: d.id } })).refundedAt).not.toBeNull();
    expect((await markDisputeRefundedAction(d.id)).error).toMatch(/không ở trạng thái/);
  });
});

describe("xuất CSV đối soát chi tiết", () => {
  const call = (qs: string) => exportSettlement(new NextRequest(`http://localhost/api/export/settlement${qs}`));

  it("đối tác xuất đơn chưa đối soát kèm khoản trừ; đối tác khác không xem được đợt của người khác; thiếu tham số báo lỗi", async () => {
    const { admin, owner, other } = await (async () => {
      const c = await setup();
      as(c.guest, "USER");
      await createDisputeAction(c.done.id, {}, fd(GOOD));
      const dispute = await prisma.dispute.findUniqueOrThrow({ where: { bookingId: c.done.id } });
      as(c.admin, "ADMIN");
      await resolveDisputeAction(dispute.id, { decision: "REFUND", refund: 400_000, partnerBears: 400_000, note: "Đối tác chịu hết" });
      return { ...c, dispute };
    })();

    as(owner, "HOST");
    const text = await (await call("?unsettled=1")).text();
    expect(text).toContain("Đơn hoàn tất");
    expect(text).toContain("Trừ khiếu nại");
    expect(text).toContain("-400000");
    expect(text).toContain("1800000");
    expect((await call("")).status).toBe(400);

    as(admin, "ADMIN");
    await createPayoutAction(owner.id, "");
    const payout = await prisma.payout.findFirstOrThrow({ where: { ownerId: owner.id } });
    expect(await (await call(`?payout=${payout.id}`)).text()).toContain("Trừ khiếu nại");
    expect((await call("?unsettled=1")).status).toBe(400); // quản trị viên cần chỉ định đối tác
    as(other, "HOST");
    expect((await call(`?payout=${payout.id}`)).status).toBe(404);
    as({ id: "", name: "" }, "USER");
    expect((await call(`?payout=${payout.id}`)).status).toBe(403);
  });
});
