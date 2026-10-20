import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { CheckInDesk } from "@/components/admin/checkin-desk";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Nhận phòng (quét vé)" };

async function Content() {
  await requireAdmin("/admin/checkin");
  return (
    <>
      <h1 className="font-display mb-1 text-3xl font-semibold">Nhận phòng (quét vé)</h1>
      <p className="mb-6 text-sm text-muted">Quét mã QR trên vé điện tử của khách hoặc nhập mã đặt phòng để làm thủ tục nhận phòng.</p>
      <CheckInDesk />
    </>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content />
    </Suspense>
  );
}
