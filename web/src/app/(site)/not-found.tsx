import type { Metadata } from "next";
import { NotFoundView } from "@/components/not-found-view";

export const metadata: Metadata = { title: "Không tìm thấy trang" };

// 404 khi một trang khách gọi notFound() (ví dụ khách sạn không tồn tại); tự có khung khách vì nằm trong root layout của (site).
export default function NotFound() {
  return <NotFoundView links={[{ href: "/", label: "Về trang chủ" }, { href: "/hotels", label: "Tìm khách sạn" }]} />;
}
