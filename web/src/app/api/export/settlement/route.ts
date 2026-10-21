import { NextResponse, connection, type NextRequest } from "next/server";
import { isoDate } from "@/lib/booking";
import { csvResponse, toCsv, type CsvValue } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { listDeductions, listPayoutLines, listUnsettled, type SettleRow } from "@/lib/settlement";

const KIND = { COMPLETED: "Đơn hoàn tất", LATE_CANCEL: "Phí hủy muộn" } as const;

const HEADER = ["Loại", "Mã đơn", "Khách sạn", "Khách", "Nhận phòng", "Trả phòng", "Thu, giá trước giảm (₫)", "Giảm giá sàn chịu (₫)", "Hoa hồng (%)", "Hoa hồng (₫)", "Đối tác nhận (₫)"];

const lineOf = (r: SettleRow): CsvValue[] => [KIND[r.kind], r.code, r.hotelName, r.guestName, isoDate(r.checkIn), isoDate(r.checkOut), r.gross, r.promo, r.commissionPercent, r.commission, r.payout];

/**
 * Xuất đối soát chi tiết từng đơn để đối tác/sàn đối chiếu sổ sách.
 *  - ?payout=<id>: các dòng của một đợt chi trả đã tạo;
 *  - ?unsettled=1: các đơn chưa đối soát của đối tác (quản trị viên thêm &owner=<id>).
 * Quản trị viên xem được mọi đối tác; đối tác chỉ dữ liệu của mình.
 */
export async function GET(req: NextRequest) {
  await connection();
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "HOST")) return NextResponse.json({ error: "Bạn không có quyền xuất dữ liệu." }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const payoutId = q.get("payout");
  const date = isoDate(new Date()).replace(/-/g, "");

  if (payoutId) {
    const payout = await prisma.payout.findFirst({ where: { id: payoutId, ...(user.role === "ADMIN" ? {} : { ownerId: user.id }) }, select: { id: true } });
    if (!payout) return NextResponse.json({ error: "Không tìm thấy đợt chi trả." }, { status: 404 });
    const [rows, disputes] = await Promise.all([
      listPayoutLines(prisma, payout.id),
      prisma.dispute.findMany({ where: { payoutId: payout.id }, select: { partnerBearsAmount: true, booking: { select: { code: true } }, hotel: { select: { name: true } } } }),
    ]);
    const lines = [
      ...rows.map(lineOf),
      ...disputes.map((d): CsvValue[] => ["Trừ khiếu nại", d.booking.code, d.hotel.name, "", "", "", "", "", "", "", -d.partnerBearsAmount]),
    ];
    return csvResponse(toCsv(HEADER, lines), `doi-soat-dot-chi-tra-${date}.csv`);
  }

  if (q.get("unsettled") === "1") {
    const ownerId = user.role === "ADMIN" ? q.get("owner") : user.id;
    if (!ownerId) return NextResponse.json({ error: "Quản trị viên cần chỉ định đối tác (owner)." }, { status: 400 });
    const [rows, deductions] = await Promise.all([listUnsettled(prisma, ownerId), listDeductions(prisma, ownerId)]);
    const lines = [...rows.map(lineOf), ...deductions.map((d): CsvValue[] => ["Trừ khiếu nại", d.bookingCode, d.hotelName, "", "", "", "", "", "", "", -d.amount])];
    return csvResponse(toCsv(HEADER, lines), `doi-soat-chua-chi-tra-${date}.csv`);
  }

  return NextResponse.json({ error: "Thiếu tham số: dùng ?payout=<id> hoặc ?unsettled=1." }, { status: 400 });
}
