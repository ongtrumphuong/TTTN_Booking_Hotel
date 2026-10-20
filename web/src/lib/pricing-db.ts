import "server-only";
import type { Prisma } from "@prisma/client";
import type { RoomPricing } from "@/lib/pricing";

type Db = Pick<Prisma.TransactionClient, "priceRule">;
type RoomPriceFields = { id: string; pricePerNight: number; weekendPercent: number };

/** Nạp các quy tắc giá chạm vào kỳ lưu trú và ghép với giá gốc/phụ thu cuối tuần của từng phòng. */
export async function loadPricing(db: Db, rooms: RoomPriceFields[], checkIn: Date, checkOut: Date): Promise<Map<string, RoomPricing>> {
  const rules = rooms.length
    ? await db.priceRule.findMany({
        where: { roomId: { in: rooms.map((r) => r.id) }, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
        orderBy: { startDate: "asc" },
      })
    : [];
  const map = new Map<string, RoomPricing>();
  for (const r of rooms) {
    map.set(r.id, {
      base: r.pricePerNight,
      weekendPercent: r.weekendPercent,
      rules: rules.filter((x) => x.roomId === r.id).map((x) => ({ name: x.name, startDate: x.startDate, endDate: x.endDate, percent: x.percent })),
    });
  }
  return map;
}

export async function loadRoomPricing(db: Db, room: RoomPriceFields, checkIn: Date, checkOut: Date): Promise<RoomPricing> {
  return (await loadPricing(db, [room], checkIn, checkOut)).get(room.id)!;
}
