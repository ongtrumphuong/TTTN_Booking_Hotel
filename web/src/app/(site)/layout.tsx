import { Suspense } from "react";
import { ChatWidget } from "@/components/assistant/chat-widget";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { RootShell } from "@/components/root-shell";
import { BASE_METADATA } from "@/lib/site";

export const metadata = BASE_METADATA;

/**
 * Root layout của giao diện KHÁCH: thanh menu, chân trang và trợ lý ảo đặt phòng.
 * Quản trị viên và đối tác không vào được khu vực này (xem src/proxy.ts) và có root layout riêng.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </RootShell>
  );
}
