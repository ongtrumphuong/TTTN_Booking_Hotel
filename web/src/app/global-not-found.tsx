import "./globals.css";
import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { NotFoundView } from "@/components/not-found-view";
import { RootShell } from "@/components/root-shell";

export const metadata: Metadata = { title: "Không tìm thấy trang" };

// 404 cho đường dẫn không khớp trang nào (ứng dụng có nhiều root layout nên không có khung chung để dựng 404). Mang khung của khách.
// Quản trị viên và đối tác không bao giờ tới đây vì proxy luôn đưa họ về khu vực của mình.
export default function GlobalNotFound() {
  return (
    <RootShell>
      <Header />
      <main className="flex-1">
        <NotFoundView links={[{ href: "/", label: "Về trang chủ" }, { href: "/hotels", label: "Tìm khách sạn" }]} />
      </main>
      <Footer />
    </RootShell>
  );
}
