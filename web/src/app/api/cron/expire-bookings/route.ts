import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { completeFinishedStays, expireStaleBookings } from "@/lib/booking";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false; // chưa cấu hình thì tắt hẳn, không cho ai gọi
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/** Hủy các đơn chờ thanh toán quá hạn giữ phòng và tự hoàn tất các đơn đã ở xong. Gọi định kỳ (ví dụ mỗi 5 phút) bằng cron của hệ thống hoặc dịch vụ lập lịch. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ expired: await expireStaleBookings(prisma), completed: await completeFinishedStays(prisma) });
}
