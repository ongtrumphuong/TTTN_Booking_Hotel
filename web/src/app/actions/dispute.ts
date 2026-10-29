"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NO_ACCESS, canManageHotel } from "@/lib/access";
import { audit } from "@/lib/audit";
import { todayUTC } from "@/lib/booking";
import { CATEGORIES, canDispute, isFinal, maxDisputeRefund, validateResolution, type DisputeCategoryKey } from "@/lib/dispute";
import { sendNotice } from "@/lib/email";
import { formatVND } from "@/lib/format";
import { notifyUsers } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff, requireUser } from "@/lib/session";

export type DisputeState = { error?: string; ok?: boolean };

const appBase = () => (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

function refresh(bookingId?: string) {
  revalidatePath("/admin/disputes");
  revalidatePath("/host/disputes");
  revalidatePath("/admin/payouts");
  revalidatePath("/host/payouts");
  if (bookingId) revalidatePath(`/bookings/${bookingId}`);
}

async function adminIds() {
  return (await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })).map((u) => u.id);
}

const createSchema = z.object({
  category: z.enum(CATEGORIES as [DisputeCategoryKey, ...DisputeCategoryKey[]], { message: "Vui lòng chọn loại vấn đề." }),
  description: z.string().trim().min(20, "Mô tả tối thiểu 20 ký tự để sàn và khách sạn hiểu rõ vấn đề.").max(2000, "Mô tả tối đa 2000 ký tự."),
});

/** Khách gửi khiếu nại về một đơn của mình (đã nhận phòng, trong hạn). Báo cho khách sạn và sàn. */
export async function createDisputeAction(bookingId: string, _: DisputeState, fd: FormData): Promise<DisputeState> {
  const user = await requireUser(`/bookings/${bookingId}`);
  const parsed = createSchema.safeParse({ category: fd.get("category"), description: fd.get("description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  const b = await prisma.booking.findFirst({
    where: { id: bookingId, userId: user.id },
    include: { dispute: { select: { id: true } }, room: { select: { name: true, hotelId: true, hotel: { select: { name: true, ownerId: true } } } } },
  });
  if (!b) return { error: "Không tìm thấy đơn đặt phòng." };
  const eligible = canDispute(b, todayUTC(), !!b.dispute);
  if (!eligible.ok) return { error: eligible.reason };

  try {
    await prisma.dispute.create({ data: { bookingId: b.id, userId: user.id, hotelId: b.room.hotelId, category: parsed.data.category, description: parsed.data.description } });
  } catch (e) {
    // Hai lần gửi cùng lúc: ràng buộc duy nhất theo đơn chỉ cho một khiếu nại.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Đơn này đã có khiếu nại." };
    throw e;
  }

  const recipients = b.room.hotel.ownerId ? [b.room.hotel.ownerId, ...(await adminIds())] : await adminIds();
  after(() =>
    notifyUsers(recipients, {
      kind: "DISPUTE_NEW",
      title: `Khiếu nại mới tại ${b.room.hotel.name}`,
      body: `${user.name} khiếu nại đơn ${b.code}. ${b.room.hotel.ownerId ? "Đối tác hãy phản hồi để sàn xem xét." : "Sàn sẽ xử lý."}`,
      href: b.room.hotel.ownerId ? "/host/disputes" : "/admin/disputes",
    }),
  );
  refresh(b.id);
  return { ok: true };
}

const responseSchema = z.string().trim().min(10, "Phản hồi tối thiểu 10 ký tự.").max(2000, "Phản hồi tối đa 2000 ký tự.");

/** Khách sạn (đối tác) phản hồi khiếu nại. Chuyển sang "Sàn đang xem xét"; sửa lại được cho đến khi sàn quyết định. */
export async function respondDisputeAction(disputeId: string, text: string): Promise<DisputeState> {
  const user = await requireStaff("/host/disputes");
  const d = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { booking: { select: { code: true } }, hotel: { select: { name: true } } } });
  if (!d || !(await canManageHotel(user, d.hotelId))) return { error: NO_ACCESS };
  if (user.role !== "HOST") return { error: "Phản hồi khiếu nại là việc của khách sạn; quản trị viên xử lý ở bước quyết định." };
  if (isFinal(d.status)) return { error: "Khiếu nại này đã được sàn xử lý xong." };
  const parsed = responseSchema.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Điều kiện status trong where để không ghi đè khi sàn vừa quyết định xong.
  const res = await prisma.dispute.updateMany({
    where: { id: disputeId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
    data: { hostResponse: parsed.data, hostRespondedAt: new Date(), status: "UNDER_REVIEW" },
  });
  if (res.count === 0) return { error: "Khiếu nại này đã được sàn xử lý xong." };
  await audit(user, "DISPUTE", `Phản hồi khiếu nại đơn ${d.booking.code}`, { type: "Dispute", id: disputeId });
  const admins = await adminIds();
  after(() => notifyUsers(admins, { kind: "DISPUTE_RESPONDED", title: "Đối tác đã phản hồi khiếu nại", body: `${d.hotel.name} phản hồi khiếu nại đơn ${d.booking.code}. Sàn hãy xem xét và quyết định.`, href: "/admin/disputes" }));
  refresh();
  return { ok: true };
}

export type ResolveInput = { decision: "REFUND" | "REJECT"; refund: number; partnerBears: number; note: string };

/**
 * Sàn quyết định khiếu nại: hoàn tiền cho khách (chia phần đối tác chịu và phần sàn chịu) hoặc bác bỏ.
 * Phần đối tác chịu được trừ vào đợt chi trả kế tiếp. Làm trong giao dịch có điều kiện trạng thái để hai quản trị viên không quyết định chồng nhau.
 */
export async function resolveDisputeAction(disputeId: string, input: ResolveInput): Promise<DisputeState> {
  const admin = await requireAdmin("/admin/disputes");
  const d = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { user: { select: { name: true, email: true } }, booking: { select: { id: true, code: true, totalPrice: true, status: true, noShow: true, refundAmount: true } }, hotel: { select: { name: true, ownerId: true } } },
  });
  if (!d) return { error: "Không tìm thấy khiếu nại." };
  if (isFinal(d.status)) return { error: "Khiếu nại này đã được xử lý." };

  const decision = input?.decision === "REFUND" ? "REFUND" : "REJECT";
  const v = validateResolution(
    { decision, refund: Number(input?.refund), partnerBears: Number(input?.partnerBears) || 0, note: String(input?.note ?? "") },
    { totalPrice: d.booking.totalPrice, hasOwner: !!d.hotel.ownerId, maxRefund: maxDisputeRefund(d.booking) },
  );
  if (!v.ok) return { error: v.error };

  const res = await prisma.dispute.updateMany({
    where: { id: disputeId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
    data: {
      status: decision === "REFUND" ? "RESOLVED" : "REJECTED",
      resolution: String(input.note).trim(),
      refundAmount: v.refund,
      partnerBearsAmount: v.partnerBears,
      resolvedAt: new Date(),
      resolvedById: admin.id,
    },
  });
  if (res.count === 0) return { error: "Khiếu nại này đã được xử lý." };

  await audit(
    admin,
    "DISPUTE",
    decision === "REFUND"
      ? `Chấp nhận khiếu nại đơn ${d.booking.code}: hoàn ${v.refund} (đối tác chịu ${v.partnerBears}, sàn chịu ${v.refund - v.partnerBears})`
      : `Bác bỏ khiếu nại đơn ${d.booking.code}`,
    { type: "Dispute", id: disputeId },
  );

  after(async () => {
    await sendNotice(d.user.email, {
      subject: `Kết quả khiếu nại đơn ${d.booking.code}`,
      heading: "Khiếu nại của bạn đã được xử lý",
      guestName: d.user.name,
      intro: decision === "REFUND" ? `chúng tôi chấp nhận khiếu nại và sẽ hoàn ${formatVND(v.refund)} cho bạn. Chúng tôi sẽ báo khi đã hoàn tiền.` : "sau khi xem xét, chúng tôi chưa thể chấp nhận khiếu nại này.",
      rows: [["Mã đặt phòng", d.booking.code], ["Khách sạn", d.hotel.name], ["Lý do", String(input.note).trim()]],
      link: `${appBase()}/bookings/${d.booking.id}`,
    });
    if (d.hotel.ownerId) {
      await notifyUsers([d.hotel.ownerId], {
        kind: "DISPUTE_RESOLVED",
        title: "Khiếu nại đã được sàn quyết định",
        body: decision === "REFUND" ? `Đơn ${d.booking.code}: hoàn khách ${formatVND(v.refund)}, bạn chịu ${formatVND(v.partnerBears)} (trừ vào kỳ chi trả kế tiếp).` : `Đơn ${d.booking.code}: sàn bác bỏ khiếu nại.`,
        href: "/host/disputes",
      });
    }
  });
  refresh(d.booking.id);
  return { ok: true };
}

/** Quản trị viên xác nhận đã hoàn tiền cho khách (ngoài hệ thống, như hoàn tiền khi hủy đơn). */
export async function markDisputeRefundedAction(disputeId: string): Promise<DisputeState> {
  const admin = await requireAdmin("/admin/disputes");
  const d = await prisma.dispute.findUnique({ where: { id: disputeId }, select: { bookingId: true, refundAmount: true, booking: { select: { code: true } } } });
  if (!d) return { error: "Không tìm thấy khiếu nại." };
  const res = await prisma.dispute.updateMany({ where: { id: disputeId, status: "RESOLVED", refundAmount: { gt: 0 }, refundedAt: null }, data: { refundedAt: new Date() } });
  if (res.count === 0) return { error: "Khiếu nại này không ở trạng thái chờ hoàn tiền." };
  await audit(admin, "DISPUTE", `Xác nhận đã hoàn ${d.refundAmount} cho khiếu nại đơn ${d.booking.code}`, { type: "Dispute", id: disputeId });
  refresh(d.bookingId);
  return { ok: true };
}
