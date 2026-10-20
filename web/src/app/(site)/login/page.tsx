import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Đăng nhập", robots: NOINDEX };

export default function LoginPage(props: PageProps<"/login">) {
  return <AuthShell mode="login" searchParams={props.searchParams} />;
}
