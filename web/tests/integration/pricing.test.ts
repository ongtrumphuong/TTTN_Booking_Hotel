import { beforeEach, describe, expect, it } from "vitest";
import { mkHotel, mkUser, prisma, resetDb } from "../helpers/db";
import { createPendingBooking } from "@/lib/booking-create";
import { isoDate } from "@/lib/booking";
import { nightlyPrices } from "@/lib/pricing";
import { loadRoomPricing } from "@/lib/pricing-db";

beforeEach(resetDb);

const DAY = 86_400_000;
/** Ngày UTC gần nhất trong tương lai (sau ít nhất `min` ngày) rơi vào thứ `weekday` (0 = Chủ nhật). */
function nextWeekday(weekday: number, min = 3) {
  const t = new Date(`${isoDate(new Date())}T00:00:00.000Z`).getTime() + min * DAY;
  let d = new Date(t);
  while (d.getUTCDay() !== weekday) d = new Date(d.getTime() + DAY);
  return d;
}

describe("giá theo mùa trong đơn đặt phòng", () => {
  it("đơn tính từng đêm: cuối tuần được phụ thu, ngày thường giữ giá gốc", async () => {
    const hotel = await mkHotel({ rooms: [{ price: 1_000_000 }] });
    const room = hotel.rooms[0];
    await prisma.room.update({ where: { id: room.id }, data: { weekendPercent: 20 } });
    const user = await mkUser();

    const friday = nextWeekday(5);
    const checkOut = new Date(friday.getTime() + 3 * DAY); // đêm Sáu, Bảy, Chủ nhật
    const r = await createPendingBooking({ userId: user.id, roomId: room.id, checkIn: isoDate(friday), checkOut: isoDate(checkOut), guests: 2, rooms: 1 });
    expect(r.ok).toBe(true);
    const b = await prisma.booking.findFirstOrThrow({ where: { userId: user.id } });
    expect(b.totalPrice).toBe(1_200_000 + 1_200_000 + 1_000_000);
  });

  it("quy tắc theo mùa cộng vào đúng các đêm và nhân với số phòng", async () => {
    const hotel = await mkHotel({ rooms: [{ price: 1_000_000 }] });
    const room = hotel.rooms[0];
    const user = await mkUser();
    const monday = nextWeekday(1);
    await prisma.priceRule.create({ data: { roomId: room.id, name: "Lễ", startDate: monday, endDate: new Date(monday.getTime() + DAY), percent: 50 } });

    const checkOut = new Date(monday.getTime() + 2 * DAY); // đêm thứ Hai (lễ +50%), thứ Ba (giá gốc)
    const r = await createPendingBooking({ userId: user.id, roomId: room.id, checkIn: isoDate(monday), checkOut: isoDate(checkOut), guests: 2, rooms: 2 });
    expect(r.ok).toBe(true);
    const b = await prisma.booking.findFirstOrThrow({ where: { userId: user.id } });
    expect(b.totalPrice).toBe((1_500_000 + 1_000_000) * 2);
  });

  it("quy tắc ngoài kỳ lưu trú không ảnh hưởng; sửa quy tắc sau không đổi giá đơn đã đặt", async () => {
    const hotel = await mkHotel({ rooms: [{ price: 800_000 }] });
    const room = hotel.rooms[0];
    const user = await mkUser();
    const monday = nextWeekday(1, 5);
    const far = new Date(monday.getTime() + 30 * DAY);
    await prisma.priceRule.create({ data: { roomId: room.id, name: "Xa", startDate: far, endDate: new Date(far.getTime() + DAY), percent: 100 } });
    const checkOut = new Date(monday.getTime() + DAY);
    await createPendingBooking({ userId: user.id, roomId: room.id, checkIn: isoDate(monday), checkOut: isoDate(checkOut), guests: 2, rooms: 1 });
    await prisma.priceRule.updateMany({ data: { percent: 200 } });
    const b = await prisma.booking.findFirstOrThrow({ where: { userId: user.id } });
    expect(b.totalPrice).toBe(800_000);
  });

  it("loadRoomPricing chỉ nạp quy tắc chạm vào kỳ lưu trú", async () => {
    const hotel = await mkHotel({ rooms: [{ price: 500_000 }] });
    const room = hotel.rooms[0];
    const monday = nextWeekday(1);
    await prisma.priceRule.createMany({
      data: [
        { roomId: room.id, name: "Trong", startDate: monday, endDate: new Date(monday.getTime() + DAY), percent: 10 },
        { roomId: room.id, name: "Ngoài", startDate: new Date(monday.getTime() + 10 * DAY), endDate: new Date(monday.getTime() + 11 * DAY), percent: 10 },
      ],
    });
    const p = await loadRoomPricing(prisma, room, monday, new Date(monday.getTime() + 2 * DAY));
    expect(p.rules.map((r) => r.name)).toEqual(["Trong"]);
    expect(nightlyPrices(p, monday, new Date(monday.getTime() + 2 * DAY)).map((n) => n.price)).toEqual([550_000, 500_000]);
  });
});
