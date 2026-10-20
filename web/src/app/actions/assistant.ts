"use server";

import { redirect } from "next/navigation";
import { verifyProposal } from "@/lib/assistant/proposal";
import { createPendingBooking } from "@/lib/booking-create";
import { requireUser } from "@/lib/session";

export type ConfirmState = { error?: string };

/**
 * Khách xác nhận giữ phòng mà trợ lý đã đề xuất. Chỉ chạy khi khách tự bấm nút ở trang xác nhận; trợ lý không gọi được hàm này.
 * Mọi thông tin được lấy từ token có chữ ký rồi kiểm tra lại như một lần đặt phòng bình thường (còn phòng, sức chứa, giá tính ở máy chủ).
 */
export async function confirmProposalAction(token: string): Promise<ConfirmState> {
  const proposal = verifyProposal(token);
  if (!proposal) return { error: "Đề xuất đã hết hạn hoặc không hợp lệ. Hãy nhờ trợ lý tìm lại." };
  const user = await requireUser(`/assistant/confirm?t=${encodeURIComponent(token)}`);

  const result = await createPendingBooking({ userId: user.id, ...proposal });
  if (!result.ok) return { error: result.error };
  redirect(`/bookings/${result.bookingId}/pay`);
}
