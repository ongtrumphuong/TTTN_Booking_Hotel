"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { Prisma, type BookingStatus, type Role } from "@prisma/client";import { prisma } from "@/lib/prisma";
import { after } from "next/server";
import { sendBookingCancelled, sendRefundCompleted } from "@/lib/email";
import { requireAdmin } from "@/lib/session";
import { NEXT_STATUS, unavailableQuantity, needsRefund, paymentStatusAfterCancel, todayUTC } from "@/lib/booking";
import { ALLOWED_IMAGE_HOSTS } from "@/lib/image-hosts";
import { normalizeCode } from "@/lib/voucher";
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
  freeCancelDays: z.coerce.number().int().min(0, "Số ngày hủy miễn phí từ 0 đến 60").max(60, "Số ngày hủy miễn phí từ 0 đến 60"),
  lateCancelFeePercent: z.coerce.number().int().min(0, "Phí hủy muộn từ 0% đến 100%").max(100, "Phí hủy muộn từ 0% đến 100%"),
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
    freeCancelDays: fd.get("freeCancelDays") ?? 1,
    lateCancelFeePercent: fd.get("lateCancelFeePercent") ?? 50,
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
          const left = b.room.quantity - (await unavailableQuantity(tx, b.roomId, b.checkIn, b.checkOut));
          if (left < b.rooms) throw new Error("Phòng đã hết trong khoảng ngày này, không thể xác nhận.");
          await tx.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", paymentStatus: "PAID" } });
        } else if (next === "COMPLETED") {
          if (b.checkIn > todayUTC()) throw new Error("Chỉ hoàn tất đơn từ ngày nhận phòng trở đi.");
          await tx.booking.update({ where: { id: b.id }, data: { status: "COMPLETED" } });
        } else {
          await tx.booking.update({
            where: { id: b.id },
            // Quản trị viên hủy đơn là quyết định của khách sạn nên hoàn đủ số tiền đã trả.
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              refundAmount: b.paymentStatus === "PAID" ? b.totalPrice : null,
              paymentStatus: await paymentStatusAfterCancel(tx, b.id, b.paymentStatus),
            },
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

  if (next === "CANCELLED") after(() => sendBookingCancelled(bookingId));
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { ok: true };
}

/** Quản trị viên xác nhận đã hoàn tiền (ngoài hệ thống, ví dụ qua cổng VNPay hoặc chuyển khoản) cho đơn đã hủy. */
export async function markRefundedAction(bookingId: string, note: string): Promise<AdminState> {
  const admin = await requireAdmin("/admin/bookings");
  const cleanNote = String(note ?? "").trim().slice(0, 300);

  const done = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, status: true, paymentStatus: true, refundAmount: true } });
    if (!b || !needsRefund(b.status, b.paymentStatus, b.refundAmount)) return false;
    await tx.booking.update({ where: { id: b.id }, data: { paymentStatus: "REFUNDED" } });
    await tx.payment.updateMany({
      where: { bookingId: b.id, status: "SUCCESS", refundedAt: null },
      data: { refundedAt: new Date(), refundNote: `${admin.name}${cleanNote ? `: ${cleanNote}` : ""}` },
    });
    return true;
  });
  if (!done) return { error: "Đơn này không ở trạng thái chờ hoàn tiền." };
  after(() => sendRefundCompleted(bookingId));

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

/* ---------- Mã giảm giá ---------- */

const optionalDate = (end: boolean) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ")
      .transform((d) => new Date(`${d}T${end ? "23:59:59.999" : "00:00:00.000"}Z`))
      .optional(),
  );

const voucherSchema = z
  .object({
    code: z.string().transform(normalizeCode).pipe(z.string().regex(/^[A-Z0-9_-]{3,20}$/, "Mã gồm 3–20 ký tự chữ, số, gạch ngang hoặc gạch dưới")),
    description: z.string().trim().max(120).default(""),
    kind: z.enum(["PERCENT", "AMOUNT"]),
    value: z.coerce.number().int().min(1, "Mức giảm phải lớn hơn 0"),
    maxDiscount: optionalNumber(z.number().int().min(1000)),
    minSubtotal: z.coerce.number().int().min(0).default(0),
    usageLimit: optionalNumber(z.number().int().min(1)),
    perUserLimit: z.coerce.number().int().min(1).max(100).default(1),
    startsAt: optionalDate(false),
    endsAt: optionalDate(true),
  })
  .refine((v) => v.kind !== "PERCENT" || v.value <= 100, { message: "Giảm theo phần trăm tối đa 100%", path: ["value"] })
  .refine((v) => !v.startsAt || !v.endsAt || v.startsAt <= v.endsAt, { message: "Ngày kết thúc phải sau ngày bắt đầu", path: ["endsAt"] });

export async function createVoucherAction(_: AdminState, fd: FormData): Promise<AdminState> {
  await requireAdmin("/admin/vouchers");
  const parsed = voucherSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { kind, value, ...rest } = parsed.data;

  try {
    await prisma.voucher.create({ data: { ...rest, percentOff: kind === "PERCENT" ? value : null, amountOff: kind === "AMOUNT" ? value : null } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Mã giảm giá này đã tồn tại." };
    throw e;
  }
  revalidatePath("/admin/vouchers");
  return { ok: true };
}

export async function toggleVoucherAction(id: string) {
  await requireAdmin("/admin/vouchers");
  const v = await prisma.voucher.findUnique({ where: { id }, select: { isActive: true } });
  if (v) await prisma.voucher.update({ where: { id }, data: { isActive: !v.isActive } });
  revalidatePath("/admin/vouchers");
}

/* ---------- Chặn phòng (bảo trì, ngày không bán) ---------- */

const blockSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu không hợp lệ"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc không hợp lệ"),
  rooms: z.coerce.number().int().min(1, "Số phòng chặn tối thiểu 1").max(200),
  reason: z.string().trim().max(120).optional(),
});

/** Chặn `rooms` phòng của một loại phòng từ ngày bắt đầu đến hết ngày kết thúc (đêm cuối là đêm của ngày kết thúc). */
export async function createRoomBlockAction(roomId: string, _: AdminState, fd: FormData): Promise<AdminState> {
  await requireAdmin("/admin/hotels");
  const parsed = blockSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const start = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
  const lastNight = new Date(`${parsed.data.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(lastNight.getTime())) return { error: "Ngày không hợp lệ." };
  if (lastNight < start) return { error: "Ngày kết thúc phải từ ngày bắt đầu trở đi." };
  if (lastNight < todayUTC()) return { error: "Không thể chặn phòng cho khoảng thời gian đã qua." };
  if ((lastNight.getTime() - start.getTime()) / 86_400_000 > 365) return { error: "Mỗi lần chỉ chặn tối đa 1 năm." };

  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { hotelId: true, quantity: true } });
  if (!room) return { error: "Không tìm thấy phòng." };
  if (parsed.data.rooms > room.quantity) return { error: `Loại phòng này chỉ có ${room.quantity} phòng.` };

  await prisma.roomBlock.create({
    data: { roomId, startDate: start, endDate: new Date(lastNight.getTime() + 86_400_000), rooms: parsed.data.rooms, reason: parsed.data.reason || null },
  });
  refreshCatalog();
  revalidatePath(`/admin/hotels/${room.hotelId}`);
  return { ok: true };
}

export async function deleteRoomBlockAction(blockId: string) {
  await requireAdmin("/admin/hotels");
  const b = await prisma.roomBlock.findUnique({ where: { id: blockId }, select: { room: { select: { hotelId: true } } } });
  if (!b) return;
  await prisma.roomBlock.delete({ where: { id: blockId } });
  refreshCatalog();
  revalidatePath(`/admin/hotels/${b.room.hotelId}`);
}
