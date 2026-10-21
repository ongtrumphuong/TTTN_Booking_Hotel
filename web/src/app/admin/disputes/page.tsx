import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { DisputesView } from "@/components/admin/disputes-view";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Khiếu nại" };

async function Content({ searchParams }: Pick<PageProps<"/admin/disputes">, "searchParams">) {
  const user = await requireAdmin("/admin/disputes");
  return <DisputesView searchParams={searchParams} user={user} />;
}

export default function DisputesPage(props: PageProps<"/admin/disputes">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
