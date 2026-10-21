import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { formatDate, formatVND } from "@/lib/format";

/** Trả về null khi chưa cấu hình SMTP: hệ thống bỏ qua việc gửi email, đặt phòng vẫn bình thường. */
function createTransport(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
}

export const isEmailConfigured = () => !!process.env.SMTP_HOST?.trim();

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export type ConfirmationData = {
  code: string;
  guestName: string;
  hotelName: string;
  hotelAddress: string;
  roomName: string;
  rooms: number;
  guests: number;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  totalPrice: number;
  note: string | null;
  link: string;
};

/** Nội dung email xác nhận. Mọi dữ liệu do người dùng nhập đều được thoát ký tự HTML. */
export function buildConfirmationEmail(d: ConfirmationData) {
  const subject = `Xác nhận đặt phòng ${d.code} - ${d.hotelName}`;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:#5b6b86;width:140px">${label}</td><td style="padding:6px 0;font-weight:600">${value}</td></tr>`;

  const html = `<!doctype html><html lang="vi"><body style="margin:0;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#0f1b33">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#0b5fff;color:#fff;border-radius:16px 16px 0 0;padding:20px 24px">
    <div style="font-size:18px;font-weight:700">Không Gian Số Stay</div>
    <div style="opacity:.85;font-size:13px">Xác nhận đặt phòng thành công</div>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f3;border-top:0;border-radius:0 0 16px 16px;padding:24px">
    <p style="margin:0 0 16px">Xin chào <b>${esc(d.guestName)}</b>, đơn đặt phòng của bạn đã được xác nhận.</p>
    <p style="margin:0 0 16px;font-size:13px;color:#5b6b86">Mã đặt phòng</p>
    <p style="margin:-8px 0 20px;font-size:24px;font-weight:800;letter-spacing:1px;color:#0b5fff">${esc(d.code)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row("Khách sạn", esc(d.hotelName))}
      ${row("Địa chỉ", esc(d.hotelAddress))}
      ${row("Loại phòng", `${esc(d.roomName)} × ${d.rooms}`)}
      ${row("Nhận phòng", esc(formatDate(d.checkIn)))}
      ${row("Trả phòng", esc(formatDate(d.checkOut)))}
      ${row("Số đêm / khách", `${d.nights} đêm / ${d.guests} khách`)}
      ${d.note ? row("Yêu cầu", esc(d.note)) : ""}
      ${row("Tổng thanh toán", esc(formatVND(d.totalPrice)))}
    </table>
    <p style="margin:24px 0 8px"><a href="${esc(d.link)}" style="display:inline-block;background:#0b5fff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Xem chi tiết đặt phòng</a></p>
    <p style="margin:16px 0 0;font-size:12px;color:#5b6b86">Vui lòng xuất trình mã đặt phòng khi nhận phòng. Bạn có thể hủy miễn phí trong mục "Đặt phòng của tôi" trước ngày nhận phòng.</p>
  </div>
</div></body></html>`;

  const text = [
    `Xin chào ${d.guestName}, đơn đặt phòng của bạn đã được xác nhận.`,
    `Mã đặt phòng: ${d.code}`,
    `Khách sạn: ${d.hotelName} - ${d.hotelAddress}`,
    `Phòng: ${d.roomName} x ${d.rooms}`,
    `Nhận phòng: ${formatDate(d.checkIn)} | Trả phòng: ${formatDate(d.checkOut)} (${d.nights} đêm, ${d.guests} khách)`,
    `Tổng thanh toán: ${formatVND(d.totalPrice)}`,
    `Chi tiết: ${d.link}`,
  ].join("\n");

  return { subject, html, text };
}

/** Gửi email xác nhận cho đơn đã thanh toán. Không bao giờ ném lỗi ra ngoài: gửi thất bại không được làm hỏng đặt phòng. */
export async function sendBookingConfirmation(bookingId: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const transport = createTransport();
    if (!transport) return { sent: false, reason: "SMTP chưa được cấu hình" };

    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: { select: { name: true, email: true } }, room: { include: { hotel: { select: { name: true, address: true, city: true } } } } },
    });
    if (!b || b.status !== "CONFIRMED") return { sent: false, reason: "Đơn không ở trạng thái đã xác nhận" };

    const appUrl = (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
    const nights = Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000);
    const mail = buildConfirmationEmail({
      code: b.code,
      guestName: b.user.name,
      hotelName: b.room.hotel.name,
      hotelAddress: `${b.room.hotel.address}, ${b.room.hotel.city}`,
      roomName: b.room.name,
      rooms: b.rooms,
      guests: b.guests,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights,
      totalPrice: b.totalPrice,
      note: b.note,
      link: `${appUrl}/bookings/${b.id}`,
    });

    await transport.sendMail({
      from: process.env.EMAIL_FROM?.trim() || "Không Gian Số Stay <no-reply@localhost>",
      to: b.user.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] Gửi email xác nhận thất bại:", e instanceof Error ? e.message : e);
    return { sent: false, reason: "Gửi thất bại" };
  }
}

/**
 * Gửi liên kết đặt lại mật khẩu. Khi chưa cấu hình SMTP, ở môi trường phát triển in liên kết ra console để thử nghiệm;
 * ở production tuyệt đối không ghi liên kết vào log vì ai đọc được log sẽ chiếm được tài khoản.
 */
export async function sendPasswordResetEmail(to: string, name: string, link: string): Promise<{ sent: boolean }> {
  try {
    const transport = createTransport();
    if (!transport) {
      if (process.env.NODE_ENV !== "production") console.info(`[email] SMTP chưa cấu hình. Liên kết đặt lại mật khẩu cho ${to}: ${link}`);
      return { sent: false };
    }
    const html = `<!doctype html><html lang="vi"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f1b33;background:#f7f9fc;margin:0">
<div style="max-width:520px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border:1px solid #e2e8f3;border-radius:16px;padding:24px">
<p>Xin chào <b>${esc(name)}</b>,</p>
<p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Liên kết dưới đây có hiệu lực trong 60 phút và chỉ dùng được một lần.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#0b5fff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Đặt lại mật khẩu</a></p>
<p style="font-size:12px;color:#5b6b86">Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu của bạn vẫn an toàn.</p>
</div></div></body></html>`;
    await transport.sendMail({
      from: process.env.EMAIL_FROM?.trim() || "Không Gian Số Stay <no-reply@localhost>",
      to,
      subject: "Đặt lại mật khẩu - Không Gian Số Stay",
      text: `Xin chào ${name},\nĐặt lại mật khẩu (hiệu lực 60 phút, dùng một lần): ${link}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] Gửi email đặt lại mật khẩu thất bại:", e instanceof Error ? e.message : e);
    return { sent: false };
  }
}

export type NoticeData = {
  subject: string;
  heading: string;
  guestName: string;
  intro: string;
  rows: [label: string, value: string][];
  link: string;
};

/** Email thông báo ngắn (hủy đơn, hoàn tiền). Mọi dữ liệu động đều được thoát ký tự HTML. */
export function buildNoticeEmail(d: NoticeData) {
  const row = ([label, value]: [string, string]) =>
    `<tr><td style="padding:6px 0;color:#5b6b86;width:140px">${esc(label)}</td><td style="padding:6px 0;font-weight:600">${esc(value)}</td></tr>`;
  const html = `<!doctype html><html lang="vi"><body style="margin:0;background:#f7f9fc;font-family:Arial,Helvetica,sans-serif;color:#0f1b33">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#0b5fff;color:#fff;border-radius:16px 16px 0 0;padding:20px 24px">
    <div style="font-size:18px;font-weight:700">Không Gian Số Stay</div>
    <div style="opacity:.85;font-size:13px">${esc(d.heading)}</div>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f3;border-top:0;border-radius:0 0 16px 16px;padding:24px">
    <p style="margin:0 0 16px">Xin chào <b>${esc(d.guestName)}</b>, ${esc(d.intro)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${d.rows.map(row).join("")}</table>
    <p style="margin:24px 0 0"><a href="${esc(d.link)}" style="display:inline-block;background:#0b5fff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Xem chi tiết đặt phòng</a></p>
  </div>
</div></body></html>`;
  const text = [`Xin chào ${d.guestName}, ${d.intro}`, ...d.rows.map(([l, v]) => `${l}: ${v}`), `Chi tiết: ${d.link}`].join("\n");
  return { subject: d.subject, html, text };
}

async function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: { select: { name: true, email: true } }, room: { include: { hotel: { select: { name: true } } } } },
  });
}

async function deliver(to: string, mail: { subject: string; html: string; text: string }, what: string): Promise<{ sent: boolean; reason?: string }> {
  try {
    const transport = createTransport();
    if (!transport) return { sent: false, reason: "SMTP chưa được cấu hình" };
    await transport.sendMail({ from: process.env.EMAIL_FROM?.trim() || "Không Gian Số Stay <no-reply@localhost>", to, ...mail });
    return { sent: true };
  } catch (e) {
    console.error(`[email] Gửi email ${what} thất bại:`, e instanceof Error ? e.message : e);
    return { sent: false, reason: "Gửi thất bại" };
  }
}

const appBase = () => (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

/** Báo hủy đơn, kèm số tiền hoàn nếu đơn đã thanh toán. Không bao giờ ném lỗi. */
export async function sendBookingCancelled(bookingId: string) {
  try {
    const b = await loadBooking(bookingId);
    if (!b || b.status !== "CANCELLED") return { sent: false, reason: "Đơn không ở trạng thái đã hủy" };
    const paid = b.paymentStatus !== "UNPAID";
    const rows: [string, string][] = [
      ["Mã đặt phòng", b.code],
      ["Khách sạn", b.room.hotel.name],
      ["Nhận phòng", formatDate(b.checkIn)],
      ["Trả phòng", formatDate(b.checkOut)],
    ];
    if (paid && b.refundAmount !== null) {
      rows.push(["Hoàn tiền", formatVND(b.refundAmount)]);
      if (b.refundAmount < b.totalPrice) rows.push(["Phí hủy giữ lại", formatVND(b.totalPrice - b.refundAmount)]);
    }
    const mail = buildNoticeEmail({
      subject: `Đã hủy đặt phòng ${b.code} - ${b.room.hotel.name}`,
      heading: "Đơn đặt phòng đã được hủy",
      guestName: b.user.name,
      intro: paid && (b.refundAmount ?? b.totalPrice) > 0 ? "đơn đặt phòng của bạn đã được hủy. Chúng tôi sẽ hoàn tiền và báo lại khi hoàn tất." : "đơn đặt phòng của bạn đã được hủy.",
      rows,
      link: `${appBase()}/bookings/${b.id}`,
    });
    return await deliver(b.user.email, mail, "hủy đơn");
  } catch (e) {
    console.error("[email] Gửi email hủy đơn thất bại:", e instanceof Error ? e.message : e);
    return { sent: false, reason: "Gửi thất bại" };
  }
}

/** Báo đã hoàn tiền xong (admin xác nhận). Không bao giờ ném lỗi. */
export async function sendRefundCompleted(bookingId: string) {
  try {
    const b = await loadBooking(bookingId);
    if (!b || b.paymentStatus !== "REFUNDED") return { sent: false, reason: "Đơn chưa được hoàn tiền" };
    const mail = buildNoticeEmail({
      subject: `Đã hoàn tiền đơn ${b.code} - ${b.room.hotel.name}`,
      heading: "Đã hoàn tiền",
      guestName: b.user.name,
      intro: "chúng tôi đã hoàn tiền cho đơn đặt phòng đã hủy của bạn. Thời gian tiền về tài khoản tùy ngân hàng.",
      rows: [
        ["Mã đặt phòng", b.code],
        ["Khách sạn", b.room.hotel.name],
        ["Số tiền hoàn", formatVND(b.refundAmount ?? b.totalPrice)],
      ],
      link: `${appBase()}/bookings/${b.id}`,
    });
    return await deliver(b.user.email, mail, "hoàn tiền");
  } catch (e) {
    console.error("[email] Gửi email hoàn tiền thất bại:", e instanceof Error ? e.message : e);
    return { sent: false, reason: "Gửi thất bại" };
  }
}

/** Gửi email thông báo cho đối tác/quản trị viên (đơn mới, đơn hủy). Không bao giờ ném lỗi. */
export async function sendStaffNotice(to: string, d: NoticeData) {
  return deliver(to, buildNoticeEmail({ ...d, link: d.link }), "thông báo đối tác");
}

/** Gửi email thông báo ngắn tới bất kỳ ai (khách, đối tác). Không bao giờ ném lỗi. */
export const sendNotice = (to: string, d: NoticeData) => deliver(to, buildNoticeEmail(d), "thông báo");
