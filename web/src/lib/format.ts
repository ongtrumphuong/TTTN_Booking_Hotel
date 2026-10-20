export function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

/** Ngày lưu ở UTC nên luôn hiển thị theo UTC để không bị lệch ngày. */
export function formatDate(d: Date) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Thời điểm thực tế (nhận phòng, trả phòng) hiển thị theo giờ Việt Nam. */
export function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(d);
}
