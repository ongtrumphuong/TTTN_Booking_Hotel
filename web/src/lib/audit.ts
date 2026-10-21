import "server-only";
import { prisma } from "@/lib/prisma";

export type AuditActor = { id: string; name: string; role: string };

/** Nhóm thao tác để lọc ở trang nhật ký. */
export const AUDIT_ACTIONS = {
  BOOKING_STATUS: "Đổi trạng thái đơn",
  BOOKING_CHECKIN: "Nhận phòng",
  REFUND_DONE: "Xác nhận hoàn tiền",
  PAYOUT_CREATE: "Tạo đợt chi trả",
  COMMISSION: "Đổi hoa hồng",
  HOTEL_APPROVE: "Duyệt khách sạn",
  HOTEL_REJECT: "Từ chối khách sạn",
  HOTEL_TOGGLE: "Ẩn/hiện khách sạn",
  OWNER_ASSIGN: "Gán chủ khách sạn",
  ROOM_PRICE: "Đổi giá phòng",
  PRICE_RULE: "Quy tắc giá",
  USER_ROLE: "Đổi vai trò người dùng",
  VOUCHER: "Mã giảm giá",
  REVIEW_MOD: "Kiểm duyệt đánh giá",
  REVIEW_REPLY: "Phản hồi đánh giá",
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;

/**
 * Ghi nhật ký một thao tác nhạy cảm (chỉ ghi thêm). Lưu cả tên và vai trò lúc làm để về sau vẫn đọc được dù tài khoản bị đổi/xóa.
 * Không bao giờ ném lỗi: ghi nhật ký thất bại không được làm hỏng thao tác chính.
 */
export async function audit(actor: AuditActor, action: AuditAction, summary: string, target?: { type: string; id: string }) {
  try {
    await prisma.auditLog.create({
      data: { actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, targetType: target?.type ?? null, targetId: target?.id ?? null, summary: summary.slice(0, 500) },
    });
  } catch (e) {
    console.error("[audit] Ghi nhật ký thất bại:", e instanceof Error ? e.message : e);
  }
}
