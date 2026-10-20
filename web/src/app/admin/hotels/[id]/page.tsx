import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { HotelEditor } from "@/components/admin/hotel-editor";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Chỉnh sửa khách sạn" };

async function EditHotel({ params }: Pick<PageProps<"/admin/hotels/[id]">, "params">) {
  const { id } = await params;
  const user = await requireAdmin(`/admin/hotels/${id}`);
  return <HotelEditor id={id} user={user} />;
}

export default function EditHotelPage(props: PageProps<"/admin/hotels/[id]">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <EditHotel params={props.params} />
    </Suspense>
  );
}
