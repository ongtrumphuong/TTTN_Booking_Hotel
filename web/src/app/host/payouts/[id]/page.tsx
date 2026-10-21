import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminFallback } from "@/components/admin/fallback";
import { PayoutDetail } from "@/components/admin/payout-detail";
import { requireHost } from "@/lib/session";

export const metadata: Metadata = { title: "Chi tiết đợt chi trả" };

async function Content({ params }: Pick<PageProps<"/host/payouts/[id]">, "params">) {
  const { id } = await params;
  const user = await requireHost(`/host/payouts/${id}`);
  return <PayoutDetail id={id} user={user} />;
}

export default function PayoutDetailPage(props: PageProps<"/host/payouts/[id]">) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Content params={props.params} />
    </Suspense>
  );
}
