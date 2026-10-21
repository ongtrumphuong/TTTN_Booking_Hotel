import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { daysFromToday, mkBooking, mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

type Role = "USER" | "ADMIN" | "HOST";
const session = vi.hoisted(() => ({ user: { id: "", name: "Người dùng", role: "ADMIN" as Role, email: "u@test.local" } }));
vi.mock("@/lib/session", () => ({
  requireAdmin: async () => session.user,
  requireUser: async () => session.user,
  requireStaff: async () => session.user,
  getCurrentUser: async () => (session.user.id ? session.user : null),
  safeRedirect: (p: string) => p,
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {}, connection: async () => {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendStaffNotice: vi.fn(), sendNotice: vi.fn() }));

import { createPayoutAction } from "@/app/actions/partner";
import { GET as exportSettlement } from "@/app/api/export/settlement/route";
import { bookingCode } from "@/lib/booking";
import { listUnsettled, sumRows } from "@/lib/settlement";

beforeEach(resetDb);

describe("đối soát khi khách dùng mã giảm giá của sàn", () => {
  it("đối tác nhận theo giá trước giảm; sàn chịu mã giảm và ghi vào đợt chi trả", async () => {
    const admin = await mkUser({ role: "ADMIN" });
    const owner = await mkUser({ role: "HOST" as never });
    const guest = await mkUser();
    const hotel = await mkHotel();
    await prisma.hotel.update({ where: { id: hotel.id }, data: { ownerId: owner.id } });
    session.user = { id: admin.id, name: "Admin", role: "ADMIN", email: "a@test.local" };

    // Đơn A: giá phòng 1.000.000, khách dùng mã giảm 200.000 nên trả 800.000. Đơn B: không dùng mã, 500.000.
    const a = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(-5), checkOut: daysFromToday(-3), status: "COMPLETED", paymentStatus: "PAID", total: 800_000, code: bookingCode() });
    await prisma.booking.update({ where: { id: a.id }, data: { discount: 200_000, voucherCode: "GIAM200", commissionPercent: 10 } });
    const b = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(-9), checkOut: daysFromToday(-8), status: "COMPLETED", paymentStatus: "PAID", total: 500_000, code: bookingCode() });
    await prisma.booking.update({ where: { id: b.id }, data: { commissionPercent: 10 } });

    const rows = await listUnsettled(prisma, owner.id);
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ gross: 1_000_000, promo: 200_000, commission: 100_000, payout: 900_000 });
    expect(rows.find((r) => r.id === b.id)).toMatchObject({ gross: 500_000, promo: 0, commission: 50_000, payout: 450_000 });
    expect(sumRows(rows)).toEqual({ gross: 1_500_000, commission: 150_000, payout: 1_350_000, promo: 200_000 });

    expect(await createPayoutAction(owner.id, "Đợt có mã giảm")).toEqual({ ok: true });
    const payout = await prisma.payout.findFirstOrThrow({ where: { ownerId: owner.id } });
    expect(payout).toMatchObject({ gross: 1_500_000, commission: 150_000, promoCost: 200_000, deductions: 0, amount: 1_350_000 });
    // Sàn thu của khách 1.300.000 nhưng chi cho đối tác 1.350.000: thu nhập ròng của sàn = hoa hồng 150.000 − khuyến mãi 200.000.
    expect(payout.commission - payout.promoCost).toBe(-50_000);
  });

  it("CSV đối soát có cột giảm giá sàn chịu; CSV chi trả có khuyến mãi và khoản trừ", async () => {
    const admin = await mkUser({ role: "ADMIN" });
    const owner = await mkUser({ role: "HOST" as never });
    const guest = await mkUser();
    const hotel = await mkHotel();
    await prisma.hotel.update({ where: { id: hotel.id }, data: { ownerId: owner.id } });
    const a = await mkBooking({ userId: guest.id, roomId: hotel.rooms[0].id, checkIn: daysFromToday(-5), checkOut: daysFromToday(-3), status: "COMPLETED", paymentStatus: "PAID", total: 800_000, code: "KGS-PROMO001" });
    await prisma.booking.update({ where: { id: a.id }, data: { discount: 200_000, commissionPercent: 10 } });

    session.user = { id: owner.id, name: "Chủ", role: "HOST", email: "h@test.local" };
    const text = await (await exportSettlement(new NextRequest("http://localhost/api/export/settlement?unsettled=1"))).text();
    expect(text).toContain("Giảm giá sàn chịu (₫)");
    expect(text).toContain("KGS-PROMO001");
    expect(text).toContain(",1000000,200000,10,100000,900000"); // thu, giảm giá sàn chịu, hoa hồng %, hoa hồng, đối tác nhận
    void admin;
  });
});
