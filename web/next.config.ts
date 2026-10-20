import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./src/lib/image-hosts";

// Tiêu đề bảo mật gửi kèm mọi phản hồi. Không đặt Content-Security-Policy đầy đủ vì các đoạn script nội tuyến của Next.js
// cần nonce; chỉ đặt các chỉ thị an toàn và không gây lỗi: chống bị nhúng khung (clickjacking), khóa thẻ base và object.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  // Trình duyệt bỏ qua tiêu đề này khi truy cập bằng http, nên an toàn cho môi trường phát triển.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Có nhiều root layout (khách, quản trị, đối tác) nên cần trang 404 toàn cục riêng: app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  partialPrefetching: true,
  poweredByHeader: false,
  // Bản đóng gói tối giản cho Docker (xem web/Dockerfile). Mặc định tắt vì `next start` không chạy được với chế độ này.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
