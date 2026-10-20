import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export { prisma };

export const DAY = 86_400_000;
export const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
export const daysFromToday = (n: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + n * DAY);
};

/** Xóa sạch mọi bảng giữa các bài kiểm thử. */
export async function resetDb() {
  // Chốt chặn thứ hai: dù env.ts đã kiểm tra, vẫn xác nhận lại tên cơ sở dữ liệu đang kết nối trước khi xóa.
  const [{ current_database: name }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (!name.endsWith("_test")) throw new Error(`Từ chối xóa dữ liệu: đang kết nối "${name}", không phải cơ sở dữ liệu kiểm thử.`);
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Payment","Booking","Review","Favorite","Room","Hotel","RateLimit","Payout","Voucher","PasswordResetToken","RoomBlock","PriceRule","Notification","User" RESTART IDENTITY CASCADE',
  );
}

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export function mkUser(over: Partial<{ email: string; name: string; role: "USER" | "ADMIN" }> = {}) {
  const n = uid();
  return prisma.user.create({
    data: { email: over.email ?? `u${n}@test.local`, name: over.name ?? `Người dùng ${n}`, role: over.role ?? "USER", passwordHash: "x" },
  });
}

type RoomSpec = { name?: string; price?: number; capacity?: number; quantity?: number; active?: boolean };

export async function mkHotel(
  over: Partial<{ slug: string; name: string; city: string; stars: number; amenities: string[]; active: boolean; rooms: RoomSpec[]; lat: number; lng: number }> = {},
) {
  const n = uid();
  const rooms = over.rooms ?? [{}];
  return prisma.hotel.create({
    data: {
      slug: over.slug ?? `ks-${n}`,
      name: over.name ?? `Khách sạn ${n}`,
      description: "Mô tả thử nghiệm cho khách sạn.",
      address: "1 Đường Thử, Quận Test",
      city: over.city ?? "Hà Nội",
      starRating: over.stars ?? 3,
      amenities: over.amenities ?? [],
      images: ["https://picsum.photos/seed/t/100/100"],
      isActive: over.active ?? true,
      latitude: over.lat ?? null,
      longitude: over.lng ?? null,
      rooms: {
        create: rooms.map((r, i) => ({
          name: r.name ?? `Phòng ${i + 1}`,
          description: "Phòng thử nghiệm",
          pricePerNight: r.price ?? 1_000_000,
          capacity: r.capacity ?? 2,
          bedType: "1 giường đôi",
          images: ["https://picsum.photos/seed/r/100/100"],
          quantity: r.quantity ?? 5,
          isActive: r.active ?? true,
        })),
      },
    },
    include: { rooms: true },
  });
}

export function mkBooking(o: {
  userId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  rooms?: number;
  total?: number;
  createdAt?: Date;
  code?: string;
}) {
  return prisma.booking.create({
    data: {
      code: o.code ?? `KGS-T${uid().toUpperCase()}`,
      userId: o.userId,
      roomId: o.roomId,
      checkIn: o.checkIn,
      checkOut: o.checkOut,
      guests: 2,
      rooms: o.rooms ?? 1,
      totalPrice: o.total ?? 2_000_000,
      status: o.status ?? "PENDING",
      paymentStatus: o.paymentStatus ?? "UNPAID",
      createdAt: o.createdAt,
    },
  });
}
