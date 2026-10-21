"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { notifyNewReview } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { canReviewHotel } from "@/lib/reviews";
import { getCurrentUser, requireUser } from "@/lib/session";

export type FavoriteResult = { needLogin?: boolean; favorited?: boolean; error?: string };
export type ReviewState = { error?: string; ok?: boolean };

export async function toggleFavoriteAction(hotelId: string): Promise<FavoriteResult> {
  const user = await getCurrentUser();
  if (!user) return { needLogin: true };

  const hotel = await prisma.hotel.findFirst({ where: { id: hotelId, isActive: true }, select: { id: true } });
  if (!hotel) return { error: "Khách sạn không tồn tại." };

  const key = { userId_hotelId: { userId: user.id, hotelId } };
  const existing = await prisma.favorite.findUnique({ where: key });
  if (existing) await prisma.favorite.delete({ where: key });
  else await prisma.favorite.create({ data: { userId: user.id, hotelId } });

  revalidatePath("/favorites");
  return { favorited: !existing };
}

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Vui lòng chọn số sao").max(5),
  comment: z.string().trim().min(10, "Nhận xét tối thiểu 10 ký tự").max(1000, "Nhận xét tối đa 1000 ký tự"),
});

// Mỗi khách một đánh giá cho mỗi khách sạn: gửi lại sẽ cập nhật đánh giá cũ.
export async function submitReviewAction(hotelId: string, _: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await requireUser(`/hotels`);
  const parsed = reviewSchema.safeParse({ rating: formData.get("rating"), comment: formData.get("comment") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };

  if (!(await canReviewHotel(user.id, hotelId))) {
    return { error: "Bạn chỉ có thể đánh giá khách sạn sau khi đã hoàn tất kỳ lưu trú." };
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { slug: true } });
  if (!hotel) return { error: "Khách sạn không tồn tại." };

  const existed = await prisma.review.findUnique({ where: { hotelId_userId: { hotelId, userId: user.id } }, select: { id: true } });
  await prisma.review.upsert({
    where: { hotelId_userId: { hotelId, userId: user.id } },
    create: { hotelId, userId: user.id, ...parsed.data },
    update: parsed.data,
  });

  if (!existed) after(() => notifyNewReview(hotelId, user.name, parsed.data.rating));
  updateTag("hotels"); // điểm trung bình và danh sách đánh giá nằm trong dữ liệu được cache
  revalidatePath(`/hotels/${hotel.slug}`);
  return { ok: true };
}
