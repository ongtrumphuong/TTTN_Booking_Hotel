import type { Metadata } from "next";

export const SITE_NAME = "Không Gian Số Stay";

/** URL gốc của website (APP_URL). Dùng cho liên kết chuẩn, sitemap, ảnh chia sẻ và dữ liệu có cấu trúc. */
export function siteUrl() {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

/** Biến đường dẫn tương đối (ví dụ ảnh tải lên) thành địa chỉ tuyệt đối. */
export function absoluteUrl(pathOrUrl: string) {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${siteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Trang riêng tư hoặc không có giá trị tìm kiếm: không cho công cụ tìm kiếm lập chỉ mục. */
export const NOINDEX: NonNullable<Metadata["robots"]> = { index: false, follow: false };

// Hai ký tự phân tách dòng của Unicode, viết bằng mã thoát để không chèn nguyên văn vào mã nguồn.
const LINE_SEP = new RegExp(String.fromCharCode(0x2028), "g");
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), "g");

/** Chuỗi JSON cho thẻ <script type="application/ld+json">; thoát "<" để dữ liệu do người dùng nhập không đóng được thẻ script. */
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(LINE_SEP, "\\u2028").replace(PARA_SEP, "\\u2029");
}
