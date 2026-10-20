import type { Metadata } from "next";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
