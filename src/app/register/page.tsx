import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Đăng ký" };

export default function RegisterPage(props: PageProps<"/register">) {
  return <AuthShell mode="register" searchParams={props.searchParams} />;
}
