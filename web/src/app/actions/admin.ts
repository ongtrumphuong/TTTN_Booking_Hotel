"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { Prisma, type BookingStatus, type Role } from "@prisma/client";import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { NEXT_STATUS, bookedQuantity, needsRefund, paymentStatusAfterCancel, todayUTC } from "@/lib/booking";
import { ALLOWED_IMAGE_HOSTS } from "@/lib/image-hosts";
import { slugify } from "@/lib/slug";
import { UPLOAD_URL } from "@/lib/uploads";

export type AdminState = { error?: string; ok?: boolean };

const lines = (v: FormDataEntryValue | null, sep: RegExp) =>
  String(v ?? "")
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);

/** Ảnh hợp lệ: ảnh đã tải lên qua hệ thống, hoặc URL https từ các máy chủ ảnh được phép. */
function isAllowedImage(u: string) {
  if (UPLOAD_URL.test(u)) return true;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}

const imageUrl = z
  .string()
  .max(500)
  .refine(isAllowedImage, `Ảnh phải là ảnh tải lên hoặc URL https từ: ${ALLOWED_IMAGE_HOSTS.join(", ")}`);

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().pipe(schema).optional());

const hotelSchema = z.object({
  name: z.string().trim().min(3, "Tên khách sạn tối thiểu 3 ký tự").max(120),
  city: z.string().trim().min(2, "Vui lòng nhập thành phố").max(60),
  address: z.string().trim().min(5, "Vui lòng nhập địa chỉ").max(200),
  starRating: z.coerce.number().int().min(1).max(5),
  description: z.string().trim().min(10, "Mô tả tối thiểu 10 ký tự").max(3000),
  images: z.array(imageUrl).min(1, "Cần ít nhất 1 ảnh").max(10, "Tối đa 10 ảnh"),
  amenities: z.array(z.string().max(40)).max(30),
  latitude: optionalNumber(z.number().min(-90).max(90)),
  longitude: optionalNumber(z.number().min(-180).max(180)),
});

const roomSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập tên phòng").max(80),
  description: z.string().trim().min(5, "Mô tả tối thiểu 5 ký tự").max(1000),
  pricePerNight: z.coerce.number().int().min(10_000, "Giá tối thiểu 10.000 ₫").max(100_000_000),
  capacity: z.coerce.number().int().min(1).max(10),
  bedType: z.string().trim().min(2, "Vui lòng nhập loại giường").max(60),
  sizeM2: optionalNumber(z.number().int().min(1).max(1000)),
  quantity: z.coerce.number().int().min(1).max(200),
  images: z.array(imageUrl).min(1, "Cần ít nhất 1 ảnh").max(10),
  amenities: z.array(z.string().max(40)).max(30),
});

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Dữ liệu không hợp lệ";
}

function hotelInput(fd: FormData) {
  return hotelSchema.safeParse({
    name: fd.get("name"),
    city: fd.get("city"),
    address: fd.get("address"),
    starRating: fd.get("starRating"),
    description: fd.get("description"),
    images: lines(fd.get("images"), /\r?\n/),
    amenities: lines(fd.get("amenities"), /[\r\n,]+/),
    latitude: fd.get("latitude"),
    longitude: fd.get("longitude"),
  });
}

function roomInput(fd: FormData) {
  return roomSchema.safeParse({
    name: fd.get("name"),
    description: fd.get("description"),
    pricePerNight: fd.get("pricePerNight"),
    capacity: fd.get("capacity"),
    bedType: fd.get("bedType"),
    sizeM2: fd.get("sizeM2"),
    quantity: fd.get("quantity"),
    images: lines(fd.get("images"), /\r?\n/),
    amenities: lines(fd.get("amenities"), /[\r\n,]+/),
  });
}

function refreshCatalog() {
  updateTag("hotels");
  revalidatePath("/admin/hotels");
}

/* ---------- Khách sạn ---------- */

export async function createHotelAction(_: AdminState, fd: FormData): Promise<AdminState> {
  await requireAdmin("/admin/hotels");
  const parsed = hotelInput(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const base = slugify(parsed.data.name) || "khach-san";
  let slug = base;
  for (let i = 2; await prisma.hotel.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  const hotel = await prisma.hotel.create({ data: { ...parsed.data, slug } });
  refreshCatalog();
  redirect(`/admin/hotels/${hotel.id}`);
}

export async function updateHotelAction(id: string, _: AdminState, fd: FormData): Promise<AdminState> {
  await requireAdmin("/admin/hotels");
  const parsed = hotelInput(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    await prisma.hotel.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return { error: "Không tìm thấy khách sạn." };
    throw e;
  }
  refreshCatalog();
  revalidatePath(`/admin/hotels/${id}`);
  return { ok: true };
}

export async function toggleHotelAction(id: string) {
  await requireAdmin("/admin/hotels");
  const hotel = await prisma.hotel.findUnique({ where: { id }, select: { isActive: true } });
  if (hotel) await prisma.hotel.update({ where: { id }, data: { isActive: !hotel.isActive } });
  refreshCatalog();
}

/* ---------- Phòng ---------- */

export async function createRoomAction(hotelId: string, _: AdminState, fd: FormData): Promise<AdminState> {
  await requireAdmin("/admin/hotels");
  const parsed = roomInput(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } }))) return { error: "Không tìm thấy khách sạn." };

  await prisma.room.create({ data: { ...parsed.data, hotelId } });
  refreshCatalog();
  revalidatePath(`/admin/hotels/${hotelId}`);
  return { ok: true };
}

export async function updateRoomAction(roomId: string, _: AdminState, fd: FormData): Promise<AdminState> {
  await requireAdmin("/admin/hotels");
  const parsed = roomInput(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    const room = await prisma.room.update({ where: { id: roomId }, data: parsed.data });
    revalidatePath(`/admin/hotels/${room.hotelId}`);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return { error: "Không tìm thấy phòng." };
    throw e;
  }
  refreshCatalog();
  return { ok: true };
}

export async function toggleRoomAction(roomId: string) {
  await requireAdmin("/admin/hotels");
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { isActive: true, hotelId: true } });
  if (room) {
    await prisma.room.update({ where: { id: roomId }, data: { isActive: !room.isActive } });
    revalidatePath(`/admin/hotels/${room.hotelId}`);
  }
  refreshCatalog();
}

/* ---------- Đơn đặt phòng ---------- */

export async function updateBookingStatusAction(bookingId: string, next: BookingStatus): Promise<AdminState> {
  await requireAdmin("/admin/bookings");

  try {
    await prisma.$transaction(
      async (tx) => {
        const b = await tx.booking.findUnique({ where: { id: bookingId }, include: { room: true } });
        if (!b) throw new Error("Không tìm thấy đơn đặt phòng.");
        if (!NEXT_STATUS[b.status].includes(next)) throw new Error("Không thể chuyển sang trạng thái này.");

        if (next === "CONFIRMED") {
          // Đơn chờ có thể đã hết hạn giữ phòng: kiểm tra lại còn phòng trước khi xác nhận.
          const left = b.room.quantity - (await bookedQuantity(tx, b.roomId, b.checkIn, b.checkOut));
          if (left < b.rooms) throw new Error("Phòng đã hết trong khoảng ngày này, không thể xác nhận.");
          await tx.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", paymentStatus: "PAID" } });
        } else if (next === "COMPLETED") {
          if (b.checkIn > todayUTC()) throw new Error("Chỉ hoàn tất đơn từ ngày nhận phòng trở đi.");
          await tx.booking.update({ where: { id: b.id }, data: { status: "COMPLETED" } });
        } else {
          await tx.booking.update({
            where: { id: b.id },
            data: { status: "CANCELLED", paymentStatus: await paymentStatusAfterCancel(tx, b.id, b.paymentStatus) },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof Error && !(e instanceof Prisma.PrismaClientKnownRequestError)) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return { error: "Hệ thống đang bận, vui lòng thử lại." };
    throw e;
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { ok: true };
}

/** Quản trị viên xác nhận đã hoàn tiền (ngoài hệ thống, ví dụ qua cổng VNPay hoặc chuyển khoản) cho đơn đã hủy. */
export async function markRefundedAction(bookingId: string, note: string): Promise<AdminState> {
  const admin = await requireAdmin("/admin/bookings");
  const cleanNote = String(note ?? "").trim().slice(0, 300);

  const done = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, status: true, paymentStatus: true } });
    if (!b || !needsRefund(b.status, b.paymentStatus)) return false;
    await tx.booking.update({ where: { id: b.id }, data: { paymentStatus: "REFUNDED" } });
    await tx.payment.updateMany({
      where: { bookingId: b.id, status: "SUCCESS", refundedAt: null },
      data: { refundedAt: new Date(), refundNote: `${admin.name}${cleanNote ? `: ${cleanNote}` : ""}` },
    });
    return true;
  });
  if (!done) return { error: "Đơn này không ở trạng thái chờ hoàn tiền." };

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { ok: true };
}

/* ---------- Đánh giá ---------- */

async function refreshReviews(hotelId: string) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId }, select: { slug: true } });
  updateTag("hotels"); // điểm trung bình và danh sách đánh giá nằm trong dữ liệu được cache
  revalidatePath("/admin/reviews");
  if (hotel) revalidatePath(`/hotels/${hotel.slug}`);
}

export async function toggleReviewHiddenAction(reviewId: string): Promise<AdminState> {
  await requireAdmin("/admin/reviews");
  const r = await prisma.review.findUnique({ where: { id: reviewId }, select: { isHidden: true, hotelId: true } });
  if (!r) return { error: "Không tìm thấy đánh giá." };
  await prisma.review.update({ where: { id: reviewId }, data: { isHidden: !r.isHidden } });
  await refreshReviews(r.hotelId);
  return { ok: true };
}

export async function deleteReviewAction(reviewId: string): Promise<AdminState> {
  await requireAdmin("/admin/reviews");
  const r = await prisma.review.findUnique({ where: { id: reviewId }, select: { hotelId: true } });
  if (!r) return { error: "Không tìm thấy đánh giá." };
  await prisma.review.delete({ where: { id: reviewId } });
  await refreshReviews(r.hotelId);
  return { ok: true };
}

/* ---------- Người dùng ---------- */

export async function updateUserRoleAction(userId: string, role: Role): Promise<AdminState> {
  const admin = await requireAdmin("/admin/users");
  if (role !== "USER" && role !== "ADMIN") return { error: "Vai trò không hợp lệ." };
  if (userId === admin.id) return { error: "Bạn không thể đổi vai trò của chính mình." };

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
  return { ok: true };
}
