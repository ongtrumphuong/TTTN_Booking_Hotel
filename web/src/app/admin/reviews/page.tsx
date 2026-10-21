import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { ReviewsView } from "@/components/admin/reviews-view";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Quản lý đánh giá" };

async function Content({ searchParams }: Pick<PageProps<"/admin/reviews">, "searchParams">) {
  const user = await requireAdmin("/admin/reviews");
  return <ReviewsView searchParams={searchParams} user={user} />;
}

export default function AdminReviewsPage(props: PageProps<"/admin/reviews">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
