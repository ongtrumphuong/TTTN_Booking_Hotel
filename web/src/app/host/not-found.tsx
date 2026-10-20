import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return <NotFoundView links={[{ href: "/host", label: "Về khu vực đối tác" }]} />;
}
