import { NextResponse, connection, type NextRequest } from "next/server";
import type { BookingStatus, Prisma } from "@prisma/client";
import { STATUS_LABEL, isoDate, paymentLabel } from "@/lib/booking";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 5000;

/** Xuất đơn đặt phòng ra CSV. Quản trị viên: mọi đơn; đối tác: chỉ đơn của khách sạn mình. Lọc theo trạng thái và ngày tạo đơn. */
export async function GET(req: NextRequest) {
  await connection();
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "HOST")) return NextResponse.json({ error: "Bạn không có quyền xuất dữ liệu." }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const status = q.get("status") ?? "";
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";

  const where: Prisma.BookingWhereInput = user.role === "ADMIN" ? {} : { room: { hotel: { ownerId: user.id } } };
  if (status === "REFUND") {
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Bộ lọc này chỉ dành cho quản trị viên." }, { status: 403 });
    Object.assign(where, { status: "CANCELLED", paymentStatus: "PAID", OR: [{ refundAmount: null }, { refundAmount: { gt: 0 } }] });
  } else if (status) {
    if (!(STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
    where.status = status as BookingStatus;
  }
  if (from || to) {
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return NextResponse.json({ error: "Ngày không hợp lệ (dạng yyyy-mm-dd)." }, { status: 400 });
    where.createdAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) } : {}),
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { user: { select: { name: true, email: true } }, room: { select: { name: true, hotel: { select: { name: true } } } } },
  });

  const header = ["Mã đặt phòng", "Ngày tạo", "Khách", "Email khách", "Khách sạn", "Loại phòng", "Số phòng", "Số khách", "Nhận phòng", "Trả phòng", "Số đêm", "Trạng thái", "Thanh toán", "Mã giảm giá", "Giảm giá (₫)", "Tổng tiền (₫)", "Hoa hồng sàn (%)", "Hoàn tiền (₫)"];
  const rows = bookings.map((b) => [
    b.code,
    isoDate(b.createdAt),
    b.user.name,
    b.user.email,
    b.room.hotel.name,
    b.room.name,
    b.rooms,
    b.guests,
    isoDate(b.checkIn),
    isoDate(b.checkOut),
    Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000),
    STATUS_LABEL[b.status]?.text ?? b.status,
    paymentLabel(b.status, b.paymentStatus, b.refundAmount),
    b.voucherCode,
    b.discount,
    b.totalPrice,
    b.commissionPercent,
    b.refundAmount,
  ]);
  return csvResponse(toCsv(header, rows), `don-dat-phong-${isoDate(new Date()).replace(/-/g, "")}.csv`);
}
