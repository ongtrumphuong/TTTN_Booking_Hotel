import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { ReviewsView } from "@/components/admin/reviews-view";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Đánh giá của khách" };

async function Content({ searchParams }: Pick<PageProps<"/host/reviews">, "searchParams">) {
  const user = await requireHost("/host/reviews");
  return <ReviewsView searchParams={searchParams} user={user} />;
}

export default function HostReviewsPage(props: PageProps<"/host/reviews">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
