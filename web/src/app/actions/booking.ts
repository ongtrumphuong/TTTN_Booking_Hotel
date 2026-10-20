"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation } from "@/lib/email";
import { isVnpayConfigured } from "@/lib/payments/vnpay";
import { requireUser } from "@/lib/session";
import { PENDING_HOLD_MINUTES, bookedQuantity, bookingCode, parseStay, paymentStatusAfterCancel, todayUTC } from "@/lib/booking";

export type BookingState = { error?: string };

const createSchema = z.object({
  roomId: z.string().min(1),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.coerce.number().int().min(1).max(20),
  rooms: z.coerce.number().int().min(1).max(10),
  note: z.string().trim().max(500).optional(),
});

export async function createBookingAction(_: BookingState, formData: FormData): Promise<BookingState> {
  const input = createSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Thông tin đặt phòng không hợp lệ." };
  const { roomId, guests, rooms, note } = input.data;

  const stay = parseStay(input.data.checkIn, input.data.checkOut);
  if (!stay) return { error: "Ngày nhận/trả phòng không hợp lệ." };
  if (stay.checkIn < todayUTC()) return { error: "Ngày nhận phòng không được ở trong quá khứ." };

  const returnTo = `/book/${roomId}?checkIn=${input.data.checkIn}&checkOut=${input.data.checkOut}&guests=${guests}`;
  const user = await requireUser(returnTo);

  let bookingId: string;
  try {
    // Serializable để hai người đặt cùng lúc không vượt quá số phòng còn lại.
    bookingId = await prisma.$transaction(
      async (tx) => {
        const room = await tx.room.findFirst({ where: { id: roomId, isActive: true, hotel: { isActive: true } } });
        if (!room) throw new Error("ROOM_NOT_FOUND");
        if (guests > room.capacity * rooms) throw new Error("TOO_MANY_GUESTS");

        const left = room.quantity - (await bookedQuantity(tx, room.id, stay.checkIn, stay.checkOut));
        if (left < rooms) throw new Error("SOLD_OUT");

        const booking = await tx.booking.create({
          data: {
            code: bookingCode(),
            userId: user.id,
            roomId: room.id,
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            guests,
            rooms,
            totalPrice: room.pricePerNight * stay.nights * rooms, // giá luôn tính ở server
            note: note || null,
          },
        });
        return booking.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "ROOM_NOT_FOUND") return { error: "Loại phòng này không còn khả dụng." };
      if (e.message === "TOO_MANY_GUESTS") return { error: "Số khách vượt quá sức chứa của phòng đã chọn." };
      if (e.message === "SOLD_OUT") return { error: "Rất tiếc, phòng vừa hết trong khoảng ngày bạn chọn." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return { error: "Hệ thống đang bận, vui lòng thử lại." };
    }
    throw e;
  }

  redirect(`/bookings/${bookingId}/pay`);
}

const METHODS = ["card", "ewallet", "bank"] as const;

export async function payBookingAction(bookingId: string, _: BookingState, formData: FormData): Promise<BookingState> {
  const user = await requireUser(`/bookings/${bookingId}/pay`);
  const method = z.enum(METHODS).safeParse(formData.get("method"));
  if (!method.success) return { error: "Vui lòng chọn phương thức thanh toán." };

  if (isVnpayConfigured()) return { error: "Hệ thống đang dùng cổng thanh toán VNPay. Vui lòng thanh toán qua VNPay." };

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId: user.id } });
  if (!booking) return { error: "Không tìm thấy đơn đặt phòng." };
  if (booking.status !== "PENDING" || booking.paymentStatus !== "UNPAID") redirect(`/bookings/${bookingId}`);

  if (booking.createdAt.getTime() < Date.now() - PENDING_HOLD_MINUTES * 60_000) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    return { error: `Đơn đã quá thời gian giữ phòng (${PENDING_HOLD_MINUTES} phút). Vui lòng đặt lại.` };
  }

  // Thanh toán giả lập: không thu tiền thật, không nhận thông tin thẻ. Chỉ hoạt động khi chưa cấu hình VNPay,
  // để khi chạy thật không ai bỏ qua bước trả tiền bằng cách gọi thẳng hành động này.
  const confirmed = await prisma.$transaction(async (tx) => {
    const res = await tx.booking.updateMany({
      where: { id: booking.id, status: "PENDING", paymentStatus: "UNPAID" },
      data: { paymentStatus: "PAID", status: "CONFIRMED" },
    });
    if (res.count === 0) return false;
    await tx.payment.create({
      data: {
        bookingId: booking.id,
        provider: "SIMULATED",
        txnRef: `SIM${booking.code.replace(/[^A-Za-z0-9]/g, "")}${Date.now().toString(36).toUpperCase()}`,
        amount: booking.totalPrice,
        status: "SUCCESS",
        method: method.data,
        paidAt: new Date(),
      },
    });
    return true;
  });
  if (confirmed) after(() => sendBookingConfirmation(booking.id));
  revalidatePath("/bookings");
  redirect(`/bookings/${bookingId}?paid=1`);
}

export async function cancelBookingAction(bookingId: string) {
  const user = await requireUser("/bookings");
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId: user.id } });

  if (booking && (booking.status === "PENDING" || booking.status === "CONFIRMED") && booking.checkIn > todayUTC()) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", paymentStatus: await paymentStatusAfterCancel(prisma, booking.id, booking.paymentStatus) },
    });
  }
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
}
