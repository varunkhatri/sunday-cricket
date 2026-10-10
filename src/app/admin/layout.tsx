import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAdmin()) {
    const path = headers().get("x-pathname") ?? "/admin";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return <>{children}</>;
}
