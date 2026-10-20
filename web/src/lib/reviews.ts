import "server-only";
import { prisma } from "./prisma";

/** Khách chỉ được đánh giá khách sạn mà mình đã hoàn tất kỳ lưu trú. */
export async function canReviewHotel(userId: string, hotelId: string) {
  const stayed = await prisma.booking.findFirst({
    where: { userId, status: "COMPLETED", room: { hotelId } },
    select: { id: true },
  });
  return !!stayed;
}
