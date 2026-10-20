"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

/** Đánh dấu đã đọc tất cả thông báo của chính người dùng. */
export async function markAllReadAction() {
  const user = await requireStaff("/admin");
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/admin", "layout");
  revalidatePath("/host", "layout");
}
