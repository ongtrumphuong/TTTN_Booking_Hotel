import "@/app/globals.css";
import { beVietnam, playfair } from "@/lib/fonts";

/**
 * Khung <html>/<body> dùng chung. Ứng dụng có BA root layout riêng (giao diện khách ở app/(site), quản trị ở app/admin, đối tác ở app/host).
 * Chuyển giữa các khu vực này luôn tải lại cả trang, nên khung và trạng thái của khu vực này không bao giờ còn sót lại ở khu vực kia.
 */
export function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${playfair.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
