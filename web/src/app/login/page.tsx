import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function LoginPage(props: PageProps<"/login">) {
  return <AuthShell mode="login" searchParams={props.searchParams} />;
}
