"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { Prisma, type BookingStatus, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAllowedPanorama } from "@/lib/panorama";
import { notifyBookingEvent, notifyHotelPending } from "@/lib/notify";
import { readTicket } from "@/lib/ticket";
import { after } from "next/server";
import { sendBookingCancelled, sendRefundCompleted } from "@/lib/email";
import { NO_ACCESS, baseFor, canManageBooking, canManageHotel, canManageRoom } from "@/lib/access";
import { requireAdmin, requireStaff } from "@/lib/session";
import { NEXT_STATUS, STATUS_LABEL, unavailableQuantity, needsRefund, paymentStatusAfterCancel, todayUTC } from "@/lib/booking";
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
  highlights: z.array(z.string().max(60)).max(10, "Tối đa 10 điểm nổi bật"),
  latitude: optionalNumber(z.number().min(-90).max(90)),
  longitude: optionalNumber(z.number().min(-180).max(180)),
  freeCancelDays: z.coerce.number().int().min(0, "Số ngày hủy miễn phí từ 0 đến 60").max(60, "Số ngày hủy miễn phí từ 0 đến 60"),
  lateCancelFeePercent: z.coerce.number().int().min(0, "Phí hủy muộn từ 0% đến 100%").max(100, "Phí hủy muộn từ 0% đến 100%"),
});

const roomSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập tên phòng").max(80),
  description: z.string().trim().min(5, "Mô tả tối thiểu 5 ký tự").max(1000),
  pricePerNight: z.coerce.number().int().min(10_000, "Giá tối thiểu 10.000 ₫").max(100_000_000),
  weekendPercent: z.coerce.number().int().min(-50, "Phụ thu cuối tuần từ -50% đến 200%").max(200, "Phụ thu cuối tuần từ -50% đến 200%"),
  capacity: z.coerce.number().int().min(1).max(10),
  bedType: z.string().trim().min(2, "Vui lòng nhập loại giường").max(60),
  sizeM2: optionalNumber(z.number().int().min(1).max(1000)),
  quantity: z.coerce.number().int().min(1).max(200),
  panoramaUrl: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().max(500).refine(isAllowedPanorama, "Ảnh 360° phải là ảnh tải lên, ảnh mẫu của hệ thống hoặc URL https từ máy chủ ảnh được phép.").nullable(),
  ),
  images: z.array(imageUrl).min(1, "Cần ít nhất 1 ảnh").max(10),
  amenities: z.array(z.string().max(40)).max(30),
  highlights: z.array(z.string().max(60)).max(10, "Tối đa 10 điểm nổi bật"),
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
    highlights: lines(fd.get("highlights"), /[\r\n,]+/),
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
    weekendPercent: fd.get("weekendPercent") || 0,
    panoramaUrl: fd.get("panoramaUrl") ?? "",
    capacity: fd.get("capacity"),
    bedType: fd.get("bedType"),
    sizeM2: fd.get("sizeM2"),
    quantity: fd.get("quantity"),
    images: lines(fd.get("images"), /\r?\n/),
    amenities: lines(fd.get("amenities"), /[\r\n,]+/),
    highlights: lines(fd.get("highlights"), /[\r\n,]+/),
  });
}

function refreshCatalog() {
  updateTag("hotels");
  revalidatePath("/admin/hotels");
  revalidatePath("/host/hotels");
}

/** Làm mới trang sửa khách sạn ở cả hai khu vực (quản trị và đối tác). */
function refreshHotelPage(hotelId: string) {
  revalidatePath(`/admin/hotels/${hotelId}`);
  revalidatePath(`/host/hotels/${hotelId}`);
}

/* ---------- Khách sạn ---------- */

export async function createHotelAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireStaff("/admin/hotels");
  const parsed = hotelInput(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const base = slugify(parsed.data.name) || "khach-san";
  let slug = base;
  for (let i = 2; await prisma.hotel.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;

  // Khách sạn của đối tác bị ẩn và chờ quản trị viên duyệt; khách sạn do quản trị viên tạo là của sàn và hiển thị ngay.
  const ownership = user.role === "HOST" ? { ownerId: user.id, isActive: false, approval: "PENDING" as const } : {};
  const hotel = await prisma.hotel.create({ data: { ...parsed.data, slug, ...ownership } });
  if (user.role === "HOST") after(() => notifyHotelPending(hotel.id));
  refreshCatalog();
  redirect(`${baseFor(user)}/hotels/${hotel.id}`);
}

export async function updateHotelAction(id: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireStaff("/admin/hotels");
  if (!(await canManageHotel(user, id))) return { error: NO_ACCESS };
  const parsed = hotelInput(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    // Đối tác sửa lại khách sạn bị từ chối coi như gửi duyệt lại.
    const resubmit = user.role === "HOST" ? { approval: "PENDING" as const, approvalNote: null } : {};
    const current = await prisma.hotel.findUnique({ where: { id }, select: { approval: true } });
    await prisma.hotel.update({ where: { id }, data: { ...parsed.data, ...(current?.approval === "REJECTED" ? resubmit : {}) } });
    if (user.role === "HOST" && current?.approval === "REJECTED") after(() => notifyHotelPending(id));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return { error: "Không tìm thấy khách sạn." };
    throw e;
  }
  refreshCatalog();
  refreshHotelPage(id);
  return { ok: true };
}

export async function toggleHotelAction(id: string) {
  const user = await requireStaff("/admin/hotels");
  if (!(await canManageHotel(user, id))) return;
  const hotel = await prisma.hotel.findUnique({ where: { id }, select: { isActive: true, approval: true } });
  // Khách sạn của đối tác chưa được duyệt thì chỉ quản trị viên mới bật hiển thị được.
  if (hotel && (user.role === "ADMIN" || hotel.approval === "APPROVED")) await prisma.hotel.update({ where: { id }, data: { isActive: !hotel.isActive } });
  refreshCatalog();
}

/* ---------- Phòng ---------- */

export async function createRoomAction(hotelId: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireStaff("/admin/hotels");
  if (!(await canManageHotel(user, hotelId))) return { error: NO_ACCESS };
  const parsed = roomInput(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await prisma.hotel.findUnique({ where: { id: hotelId }, select: { id: true } }))) return { error: "Không tìm thấy khách sạn." };

  await prisma.room.create({ data: { ...parsed.data, hotelId } });
  refreshCatalog();
  refreshHotelPage(hotelId);
  return { ok: true };
}

export async function updateRoomAction(roomId: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireStaff("/admin/hotels");
  if (!(await canManageRoom(user, roomId))) return { error: NO_ACCESS };
  const parsed = roomInput(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    const room = await prisma.room.update({ where: { id: roomId }, data: parsed.data });
    refreshHotelPage(room.hotelId);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return { error: "Không tìm thấy phòng." };
    throw e;
  }
  refreshCatalog();
  return { ok: true };
}

export async function toggleRoomAction(roomId: string) {
  const user = await requireStaff("/admin/hotels");
  if (!(await canManageRoom(user, roomId))) return;
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { isActive: true, hotelId: true } });
  if (room) {
    await prisma.room.update({ where: { id: roomId }, data: { isActive: !room.isActive } });
    refreshHotelPage(room.hotelId);
  }
  refreshCatalog();
}

/* ---------- Đơn đặt phòng ---------- */

/** Lễ tân xác nhận khách đã nhận phòng. Chỉ đơn đã xác nhận, từ ngày nhận phòng trở đi và trước ngày trả phòng. */
export async function checkInBookingAction(bookingId: string): Promise<AdminState> {
  const user = await requireStaff("/admin/bookings");
  if (!(await canManageBooking(user, bookingId))) return { error: NO_ACCESS };
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, checkIn: true, checkOut: true, checkedInAt: true } });
  if (!b) return { error: "Không tìm thấy đơn đặt phòng." };
  if (b.status !== "CONFIRMED") return { error: "Chỉ đơn đã xác nhận mới nhận phòng được." };
  if (b.checkedInAt) return { error: "Khách đã nhận phòng rồi." };
  if (b.checkIn > todayUTC()) return { error: "Chưa đến ngày nhận phòng." };
  if (b.checkOut <= todayUTC()) return { error: "Đã quá ngày trả phòng của đơn này." };

  // Điều kiện trong where để hai lần bấm cùng lúc chỉ ghi một lần.
  const res = await prisma.booking.updateMany({ where: { id: bookingId, status: "CONFIRMED", checkedInAt: null }, data: { checkedInAt: new Date() } });
  if (res.count === 0) return { error: "Khách đã nhận phòng rồi." };
  revalidatePath("/admin/bookings");
  revalidatePath("/host/bookings");
  return { ok: true };
}

export async function updateBookingStatusAction(bookingId: string, next: BookingStatus): Promise<AdminState> {
  const user = await requireStaff("/admin/bookings");
  if (!(await canManageBooking(user, bookingId))) return { error: NO_ACCESS };
  // Xác nhận "đã nhận tiền" là việc của sàn (sàn thu tiền của khách qua cổng thanh toán).
  if (user.role === "HOST" && next === "CONFIRMED") return { error: "Chỉ quản trị viên sàn mới xác nhận thanh toán." };

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
          // Trả phòng: nếu chưa ghi nhận nhận phòng thì coi như nhận phòng đúng ngày đặt.
          await tx.booking.update({ where: { id: b.id }, data: { status: "COMPLETED", checkedInAt: b.checkedInAt ?? b.checkIn, checkedOutAt: new Date() } });
        } else {
          if (b.checkedInAt) throw new Error("Khách đã nhận phòng, không thể hủy đơn. Hãy hoàn tất khi khách trả phòng.");
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

  if (next === "CANCELLED") {
    after(() => sendBookingCancelled(bookingId));
    after(() => notifyBookingEvent(bookingId, "CANCELLED"));
  }
  if (next === "CONFIRMED") after(() => notifyBookingEvent(bookingId, "PAID"));
  revalidatePath("/admin/bookings");
  revalidatePath("/host/bookings");
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
  if (role !== "USER" && role !== "ADMIN" && role !== "HOST") return { error: "Vai trò không hợp lệ." };
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
  const user = await requireStaff("/admin/hotels");
  if (!(await canManageRoom(user, roomId))) return { error: NO_ACCESS };
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
  refreshHotelPage(room.hotelId);
  return { ok: true };
}

export async function deleteRoomBlockAction(blockId: string) {
  const user = await requireStaff("/admin/hotels");
  const b = await prisma.roomBlock.findUnique({ where: { id: blockId }, select: { room: { select: { hotelId: true } } } });
  if (!b || !(await canManageHotel(user, b.room.hotelId))) return;
  await prisma.roomBlock.delete({ where: { id: blockId } });
  refreshCatalog();
  refreshHotelPage(b.room.hotelId);
}

/* ---------- Giá theo mùa / ngày lễ ---------- */

const ruleSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập tên (ví dụ Tết Dương lịch)").max(60),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu không hợp lệ"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày kết thúc không hợp lệ"),
  percent: z.coerce.number().int().min(-50, "Điều chỉnh giá từ -50% đến 200%").max(200, "Điều chỉnh giá từ -50% đến 200%"),
});

/** Thêm quy tắc giá: các đêm từ ngày bắt đầu đến hết ngày kết thúc được cộng (+) hoặc giảm (-) theo phần trăm giá gốc. */
export async function createPriceRuleAction(roomId: string, _: AdminState, fd: FormData): Promise<AdminState> {
  const user = await requireStaff("/admin/hotels");
  if (!(await canManageRoom(user, roomId))) return { error: NO_ACCESS };
  const parsed = ruleSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.percent === 0) return { error: "Mức điều chỉnh phải khác 0%." };

  const start = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
  const lastNight = new Date(`${parsed.data.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(lastNight.getTime())) return { error: "Ngày không hợp lệ." };
  if (lastNight < start) return { error: "Ngày kết thúc phải từ ngày bắt đầu trở đi." };
  if (lastNight < todayUTC()) return { error: "Không thể đặt giá cho khoảng thời gian đã qua." };
  if ((lastNight.getTime() - start.getTime()) / 86_400_000 > 365) return { error: "Mỗi quy tắc tối đa 1 năm." };

  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { hotelId: true } });
  if (!room) return { error: "Không tìm thấy phòng." };
  if ((await prisma.priceRule.count({ where: { roomId } })) >= 30) return { error: "Mỗi loại phòng tối đa 30 quy tắc giá." };

  await prisma.priceRule.create({
    data: { roomId, name: parsed.data.name, startDate: start, endDate: new Date(lastNight.getTime() + 86_400_000), percent: parsed.data.percent },
  });
  refreshCatalog();
  refreshHotelPage(room.hotelId);
  return { ok: true };
}

export async function deletePriceRuleAction(ruleId: string) {
  const user = await requireStaff("/admin/hotels");
  const r = await prisma.priceRule.findUnique({ where: { id: ruleId }, select: { room: { select: { hotelId: true } } } });
  if (!r || !(await canManageHotel(user, r.room.hotelId))) return;
  await prisma.priceRule.delete({ where: { id: ruleId } });
  refreshCatalog();
  refreshHotelPage(r.room.hotelId);
}

/* ---------- Quầy lễ tân: quét vé, nhận phòng ---------- */

export type TicketLookup =
  | { error: string }
  | {
      booking: {
        id: string;
        code: string;
        guestName: string;
        guestPhone: string | null;
        hotelName: string;
        roomName: string;
        rooms: number;
        guests: number;
        checkIn: string;
        checkOut: string;
        status: BookingStatus;
        statusLabel: { text: string; cls: string };
        paymentStatus: string;
        checkedInAt: string | null;
        checkedOutAt: string | null;
        note: string | null;
        canCheckIn: boolean;
        reason: string | null;
      };
    };

/** Tìm đơn từ nội dung quét được hoặc mã gõ tay; chỉ trả về đơn thuộc khách sạn mà người dùng được quản lý. */
export async function lookupTicketAction(raw: string): Promise<TicketLookup> {
  const user = await requireStaff("/admin/checkin");
  const code = readTicket(raw);
  if (!code) return { error: "Mã vé không hợp lệ. Hãy quét lại hoặc nhập đúng mã đặt phòng (dạng KGS-XXXXXXXX)." };
  const b = await prisma.booking.findUnique({
    where: { code },
    include: { user: { select: { name: true, phone: true } }, room: { select: { name: true, hotelId: true, hotel: { select: { name: true } } } } },
  });
  // Không phân biệt "không tồn tại" với "của khách sạn khác" để không lộ đơn của người khác.
  if (!b || !(await canManageHotel(user, b.room.hotelId))) return { error: "Không tìm thấy đơn này trong khách sạn bạn quản lý." };

  let reason: string | null = null;
  if (b.status !== "CONFIRMED") reason = b.status === "PENDING" ? "Đơn chưa thanh toán." : b.status === "CANCELLED" ? "Đơn đã hủy." : "Đơn đã hoàn tất.";
  else if (b.checkedInAt) reason = "Khách đã nhận phòng rồi.";
  else if (b.checkIn > todayUTC()) reason = "Chưa đến ngày nhận phòng.";
  else if (b.checkOut <= todayUTC()) reason = "Đã quá ngày trả phòng của đơn này.";

  return {
    booking: {
      id: b.id,
      code: b.code,
      guestName: b.user.name,
      guestPhone: b.user.phone,
      hotelName: b.room.hotel.name,
      roomName: b.room.name,
      rooms: b.rooms,
      guests: b.guests,
      checkIn: b.checkIn.toISOString(),
      checkOut: b.checkOut.toISOString(),
      status: b.status,
      statusLabel: STATUS_LABEL[b.status],
      paymentStatus: b.paymentStatus,
      checkedInAt: b.checkedInAt?.toISOString() ?? null,
      checkedOutAt: b.checkedOutAt?.toISOString() ?? null,
      note: b.note,
      canCheckIn: reason === null,
      reason,
    },
  };
}
