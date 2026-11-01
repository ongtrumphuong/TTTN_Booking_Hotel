import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bookingCode, expireStaleBookings, parseStay, todayUTC, unavailableQuantity } from "@/lib/booking";
import { stayPrice } from "@/lib/pricing";
import { loadRoomPricing } from "@/lib/pricing-db";
import { checkVoucher } from "@/lib/voucher";

export type CreateBookingInput = {
  userId: string;
  roomId: string;
  checkIn: string; // yyyy-mm-dd
  checkOut: string;
  guests: number;
  rooms: number;
  note?: string;
  voucher?: string;
};

export type CreateBookingResult = { ok: true; bookingId: string } | { ok: false; error: string };

/**
 * Số lần thử tối đa khi giao dịch Serializable bị hủy do xung đột (P2034). Xung đột không có nghĩa là hết phòng:
 * PostgreSQL hủy một trong các giao dịch chạy cùng lúc dù phòng còn trống, nên thử lại là đúng; mỗi lần thử đều kiểm tra lại phòng trống từ đầu.
 * Chọn 10 theo thí nghiệm `tests/perf/concurrency.test.ts` (kết quả ở docs/data/concurrency.json): 20 khách cùng đặt một loại phòng đủ chỗ
 * thì 1 lần thử được ~2 đơn, 4 lần thử ~8 đơn, 10 lần thử ~19 đơn (tổng thời gian ~1 s); không cấu hình nào bán vượt phòng.
 */
export const BOOKING_MAX_ATTEMPTS = 10;

const pause = (attempt: number) => new Promise((resolve) => setTimeout(resolve, 15 * attempt + Math.random() * 25));

/**
 * Tạo đơn "Chờ thanh toán" (giữ phòng 30 phút). Dùng chung cho form đặt phòng và nút xác nhận của trợ lý ảo, nên mọi đường đặt phòng
 * đều qua cùng một chỗ kiểm tra: ngày hợp lệ, còn phòng (trừ phòng bị chặn), sức chứa, mã giảm giá, giá tính ở máy chủ,
 * hoa hồng chốt lúc đặt, và giao dịch Serializable để hai người đặt cùng lúc không vượt quá số phòng.
 * `options.maxAttempts` chỉ để thí nghiệm so sánh (đặt 1 là không thử lại); mặc định dùng BOOKING_MAX_ATTEMPTS.
 */
export async function createPendingBooking(input: CreateBookingInput, options: { maxAttempts?: number } = {}): Promise<CreateBookingResult> {
  const { userId, roomId, guests, rooms, note, voucher } = input;
  const stay = parseStay(input.checkIn, input.checkOut);
  if (!stay) return { ok: false, error: "Ngày nhận/trả phòng không hợp lệ." };
  if (stay.checkIn < todayUTC()) return { ok: false, error: "Ngày nhận phòng không được ở trong quá khứ." };
  if (!Number.isInteger(guests) || guests < 1 || guests > 20 || !Number.isInteger(rooms) || rooms < 1 || rooms > 10) {
    return { ok: false, error: "Thông tin đặt phòng không hợp lệ." };
  }

  await expireStaleBookings(prisma); // trả lại phòng của các đơn đã quá hạn giữ chỗ

  const maxAttempts = Math.max(1, options.maxAttempts ?? BOOKING_MAX_ATTEMPTS);
  for (let attempt = 1; ; attempt++) {
    try {
      // Serializable để hai người đặt cùng lúc không vượt quá số phòng còn lại.
      const bookingId = await prisma.$transaction(
        async (tx) => {
          const room = await tx.room.findFirst({
            where: { id: roomId, isActive: true, hotel: { isActive: true } },
            include: { hotel: { select: { ownerId: true, commissionPercent: true } } },
          });
          if (!room) throw new Error("ROOM_NOT_FOUND");
          if (guests > room.capacity * rooms) throw new Error("TOO_MANY_GUESTS");

          const left = room.quantity - (await unavailableQuantity(tx, room.id, stay.checkIn, stay.checkOut));
          if (left < rooms) throw new Error("SOLD_OUT");

          // Giá luôn tính ở server: từng đêm có thể khác nhau (cuối tuần, mùa cao điểm, ngày lễ).
          const subtotal = stayPrice(await loadRoomPricing(tx, room, stay.checkIn, stay.checkOut), stay.checkIn, stay.checkOut) * rooms;
          let discount = 0;
          let voucherCode: string | null = null;
          if (voucher) {
            const check = await checkVoucher(tx, voucher, userId, subtotal);
            if (!check.ok) throw new Error(`VOUCHER:${check.error}`);
            discount = check.discount;
            voucherCode = check.voucher.code;
          }

          const booking = await tx.booking.create({
            data: {
              code: bookingCode(),
              userId: userId,
              roomId: room.id,
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              guests,
              rooms,
              totalPrice: subtotal - discount,
              discount,
              voucherCode,
              // Chốt tỷ lệ hoa hồng tại thời điểm đặt; khách sạn do sàn tự vận hành không có hoa hồng.
              commissionPercent: room.hotel.ownerId ? room.hotel.commissionPercent : 0,
              note: note || null,
            },
          });
          return booking.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { ok: true, bookingId };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
        // Xung đột giao dịch: thử lại (kiểm tra phòng trống lại từ đầu); hết số lần thử mới báo bận.
        if (attempt < maxAttempts) {
          await pause(attempt);
          continue;
        }
        return { ok: false, error: "Hệ thống đang bận, vui lòng thử lại." };
      }
      if (e instanceof Error) {
        if (e.message === "ROOM_NOT_FOUND") return { ok: false, error: "Loại phòng này không còn khả dụng." };
        if (e.message === "TOO_MANY_GUESTS") return { ok: false, error: "Số khách vượt quá sức chứa của phòng đã chọn." };
        if (e.message.startsWith("VOUCHER:")) return { ok: false, error: e.message.slice(8) };
        if (e.message === "SOLD_OUT") return { ok: false, error: "Rất tiếc, phòng vừa hết trong khoảng ngày bạn chọn." };
      }
      throw e;
    }
  }
}
