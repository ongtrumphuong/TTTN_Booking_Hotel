import { notFound } from "next/navigation";

/** Bắt mọi đường dẫn không tồn tại trong khu vực này để hiện trang 404 đúng khung (không dùng 404 của giao diện khách). */
export default function CatchAll() {
  notFound();
}
