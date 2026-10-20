import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { HotelEditor } from "@/components/admin/hotel-editor";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Chỉnh sửa khách sạn" };

async function Content({ params }: Pick<PageProps<"/host/hotels/[id]">, "params">) {
  const { id } = await params;
  const user = await requireHost(`/host/hotels/${id}`);
  return <HotelEditor id={id} user={user} />;
}

export default function HostEditHotelPage(props: PageProps<"/host/hotels/[id]">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content params={props.params} />
    </Suspense>
  );
}
