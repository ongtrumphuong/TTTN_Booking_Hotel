"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { listUnsettled, sumRows } from "@/lib/settlement";

export type PartnerState = { error?: string; ok?: boolean };

function refresh() {
  updateTag("hotels");
  revalidatePath("/admin/partners");
  revalidatePath("/admin/hotels");
  revalidatePath("/admin/payouts");
  revalidatePath("/host");
}

/** Duyệt khách sạn của đối tác: từ lúc này khách sạn hiển thị công khai. */
export async function approveHotelAction(hotelId: string): Promise<PartnerState> {
  await requireAdmin("/admin/partners");
  const res = await prisma.hotel.updateMany({ where: { id: hotelId, ownerId: { not: null } }, data: { approval: "APPROVED", approvalNote: null, isActive: true } });
  if (res.count === 0) return { error: "Không tìm thấy khách sạn của đối tác." };
  refresh();
  return { ok: true };
}

export async function rejectHotelAction(hotelId: string, note: string): Promise<PartnerState> {
  await requireAdmin("/admin/partners");
  const reason = String(note ?? "").trim().slice(0, 300);
  if (reason.length < 3) return { error: "Vui lòng nhập lý do từ chối (ít nhất 3 ký tự) để đối tác chỉnh sửa." };
  const res = await prisma.hotel.updateMany({ where: { id: hotelId, ownerId: { not: null } }, data: { approval: "REJECTED", approvalNote: reason, isActive: false } });
  if (res.count === 0) return { error: "Không tìm thấy khách sạn của đối tác." };
  refresh();
  return { ok: true };
}

const commissionSchema = z.coerce.number().int().min(0, "Hoa hồng từ 0% đến 50%").max(50, "Hoa hồng từ 0% đến 50%");

/** Đổi hoa hồng của khách sạn. Chỉ áp dụng cho các đơn đặt sau này; đơn cũ giữ tỷ lệ đã chốt lúc đặt. */
export async function setCommissionAction(hotelId: string, percent: string): Promise<PartnerState> {
  await requireAdmin("/admin/partners");
  const parsed = commissionSchema.safeParse(percent);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.hotel.update({ where: { id: hotelId }, data: { commissionPercent: parsed.data } });
  refresh();
  return { ok: true };
}

/** Gán khách sạn cho một đối tác theo email (hoặc để trống để chuyển về khách sạn do sàn tự vận hành). */
export async function assignOwnerAction(hotelId: string, ownerEmail: string): Promise<PartnerState> {
  await requireAdmin("/admin/partners");
  const email = String(ownerEmail ?? "").trim().toLowerCase();
  if (!email) {
    await prisma.hotel.update({ where: { id: hotelId }, data: { ownerId: null, approval: "APPROVED", approvalNote: null } });
  } else {
    const owner = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!owner || owner.role !== "HOST") return { error: "Không có đối tác nào dùng email này. Người dùng cần đăng ký làm đối tác trước." };
    await prisma.hotel.update({ where: { id: hotelId }, data: { ownerId: owner.id } });
  }
  refresh();
  return { ok: true };
}

/**
 * Tạo đợt chi trả cho đối tác: gộp mọi đơn chưa đối soát có doanh thu, tính hoa hồng theo tỷ lệ đã chốt lúc đặt.
 * Làm trong giao dịch Serializable và gắn đơn bằng điều kiện `payoutId = null` để hai lần bấm cùng lúc không chi trả trùng một đơn.
 */
export async function createPayoutAction(ownerId: string, note: string): Promise<PartnerState> {
  const admin = await requireAdmin("/admin/payouts");
  const cleanNote = String(note ?? "").trim().slice(0, 300) || null;

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const owner = await tx.user.findUnique({ where: { id: ownerId }, select: { role: true } });
        if (!owner || owner.role !== "HOST") return false;
        const rows = await listUnsettled(tx, ownerId);
        if (rows.length === 0) return false;
        const sum = sumRows(rows);
        const payout = await tx.payout.create({
          data: { ownerId, gross: sum.gross, commission: sum.commission, amount: sum.payout, bookingCount: rows.length, note: cleanNote, createdById: admin.id },
        });
        const linked = await tx.booking.updateMany({ where: { id: { in: rows.map((r) => r.id) }, payoutId: null }, data: { payoutId: payout.id } });
        if (linked.count !== rows.length) throw new Error("CONFLICT");
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!created) return { error: "Không có đơn nào cần đối soát cho đối tác này." };
  } catch (e) {
    if (e instanceof Error && e.message === "CONFLICT") return { error: "Dữ liệu vừa thay đổi, vui lòng thử lại." };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return { error: "Hệ thống đang bận, vui lòng thử lại." };
    throw e;
  }
  refresh();
  revalidatePath("/host/payouts");
  return { ok: true };
}
