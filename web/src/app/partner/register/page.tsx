import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Đăng ký đối tác", robots: NOINDEX };

export default function PartnerRegisterPage(props: PageProps<"/partner/register">) {
  return <AuthShell mode="register" partner searchParams={props.searchParams} />;
}
