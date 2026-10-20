import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Đăng ký", robots: NOINDEX };

export default function RegisterPage(props: PageProps<"/register">) {
  return <AuthShell mode="register" searchParams={props.searchParams} />;
}
