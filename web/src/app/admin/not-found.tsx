import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return <NotFoundView links={[{ href: "/admin", label: "Về trang quản trị" }]} />;
}
