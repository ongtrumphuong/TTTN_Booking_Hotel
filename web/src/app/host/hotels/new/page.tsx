import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { HotelForm } from "@/components/admin/hotel-form";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Thêm khách sạn" };

async function Content() {
  await requireHost("/host/hotels/new");
  return (
    <>
      <Link href="/host/hotels" className="text-sm font-semibold text-muted hover:text-foreground">← Khách sạn của tôi</Link>
      <h1 className="font-display mb-6 mt-2 text-3xl font-semibold">Thêm khách sạn</h1>
      <HotelForm />
      <p className="mt-3 text-sm text-muted">Sau khi tạo, hãy thêm các loại phòng ở trang chỉnh sửa. Khách sạn sẽ hiển thị sau khi quản trị viên sàn duyệt.</p>
    </>
  );
}

export default function HostNewHotelPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content />
    </Suspense>
  );
}
