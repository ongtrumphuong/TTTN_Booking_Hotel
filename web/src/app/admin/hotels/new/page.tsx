import { Suspense } from "react";
import { AdminFallback } from "@/components/admin/fallback";
import Link from "next/link";
import type { Metadata } from "next";
import { HotelForm } from "@/components/admin/hotel-form";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Thêm khách sạn" };

async function NewHotel() {
  await requireAdmin("/admin/hotels/new");
  return (
    <>
      <Link href="/admin/hotels" className="text-sm font-semibold text-muted hover:text-foreground">← Danh sách khách sạn</Link>
      <h1 className="font-display mb-6 mt-2 text-3xl font-semibold">Thêm khách sạn</h1>
      <HotelForm />
      <p className="mt-3 text-sm text-muted">Sau khi tạo, bạn có thể thêm các loại phòng ở trang chỉnh sửa.</p>
    </>
  );
}

export default function NewHotelPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <NewHotel />
    </Suspense>
  );
}
