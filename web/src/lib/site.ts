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

/** Metadata nền của toàn ứng dụng; mỗi root layout dùng lại và ghi đè phần cần khác (ví dụ robots cho khu vực quản lý). */
export const BASE_METADATA: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "vi_VN" },
  twitter: { card: "summary_large_image" },
  title: {
    default: "Không Gian Số Stay – Đặt phòng khách sạn dễ dàng",
    template: "%s | Không Gian Số Stay",
  },
  description: "Tìm và đặt khách sạn tại Việt Nam với giá tốt, xác nhận nhanh chóng cùng Không Gian Số Stay.",
};
