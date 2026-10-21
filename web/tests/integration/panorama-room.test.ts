import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkHotel, mkUser, prisma, resetDb } from "../helpers/db";

type Role = "USER" | "ADMIN" | "HOST";
const session = vi.hoisted(() => ({ user: { id: "", name: "Admin", role: "ADMIN" as Role, email: "a@test.local" } }));
vi.mock("@/lib/session", () => ({
  requireUser: async () => session.user,
  requireAdmin: async () => session.user,
  requireStaff: async () => session.user,
  getCurrentUser: async () => session.user,
  safeRedirect: (p: string) => p,
}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendBookingCancelled: vi.fn(), sendRefundCompleted: vi.fn(), sendBookingConfirmation: vi.fn(), sendPasswordResetEmail: vi.fn(), sendStaffNotice: vi.fn() }));

import { updateRoomAction } from "@/app/actions/admin";

const form = (panoramaUrl?: string) => {
  const f = new FormData();
  const base: Record<string, string> = {
    name: "Phòng thử",
    description: "Mô tả phòng thử nghiệm",
    pricePerNight: "1200000",
    weekendPercent: "0",
    capacity: "2",
    bedType: "1 giường đôi",
    quantity: "3",
    images: "https://images.unsplash.com/photo-1",
    amenities: "",
    highlights: "",
  };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  if (panoramaUrl !== undefined) f.set("panoramaUrl", panoramaUrl);
  return f;
};

let roomId: string;
beforeEach(async () => {
  await resetDb();
  const admin = await mkUser({ role: "ADMIN" });
  session.user = { id: admin.id, name: "Admin", role: "ADMIN", email: admin.email };
  roomId = (await mkHotel()).rooms[0].id;
});

describe("ảnh 360° của loại phòng", () => {
  it("lưu ảnh mẫu hợp lệ; để trống thì xóa; không gửi trường thì thành trống", async () => {
    expect(await updateRoomAction(roomId, {}, form("/panoramas/cabin.jpg"))).toEqual({ ok: true });
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).panoramaUrl).toBe("/panoramas/cabin.jpg");

    expect(await updateRoomAction(roomId, {}, form(""))).toEqual({ ok: true });
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).panoramaUrl).toBeNull();
  });

  it("từ chối URL lạ và không đổi dữ liệu", async () => {
    await updateRoomAction(roomId, {}, form("/panoramas/cabin.jpg"));
    for (const bad of ["https://evil.example.com/x.jpg", "/panoramas/../.env", "javascript:alert(1)"]) {
      const r = await updateRoomAction(roomId, {}, form(bad));
      expect(r.error, bad).toMatch(/360/);
    }
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).panoramaUrl).toBe("/panoramas/cabin.jpg");
  });
});
