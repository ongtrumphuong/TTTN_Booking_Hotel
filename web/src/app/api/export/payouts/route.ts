import { NextResponse, connection } from "next/server";
import { isoDate } from "@/lib/booking";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/** Xuất lịch sử các đợt chi trả ra CSV. Quản trị viên: mọi đối tác; đối tác: chỉ của mình. */
export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "HOST")) return NextResponse.json({ error: "Bạn không có quyền xuất dữ liệu." }, { status: 403 });

  const payouts = await prisma.payout.findMany({
    where: user.role === "ADMIN" ? {} : { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { owner: { select: { name: true, email: true } } },
  });
  const header = ["Mã đợt", "Ngày tạo", "Đối tác", "Email đối tác", "Số đơn", "Doanh thu (₫)", "Hoa hồng sàn (₫)", "Khuyến mãi sàn chịu (₫)", "Trừ khiếu nại (₫)", "Số tiền chi trả (₫)", "Ghi chú"];
  const rows = payouts.map((p) => [p.id, isoDate(p.createdAt), p.owner.name, p.owner.email, p.bookingCount, p.gross, p.commission, p.promoCost, p.deductions, p.amount, p.note]);
  return csvResponse(toCsv(header, rows), `chi-tra-${isoDate(new Date()).replace(/-/g, "")}.csv`);
}
