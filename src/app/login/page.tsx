import { redirect } from "next/navigation";
import ActionForm, { Submit } from "@/components/ActionForm";
import { login } from "@/app/admin/actions";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (isAdmin()) redirect("/admin");
  const next = searchParams.next?.startsWith("/admin") ? searchParams.next : "/admin";
  return (
    <div className="mx-auto max-w-sm">
      <div className="card p-6">
        <div className="text-center text-5xl">🧢</div>
        <h1 className="h1 mt-2 text-center">Umpire login</h1>
        <p className="mt-1 text-center text-sm muted">Only the admin can score matches. Everyone else can view without logging in.</p>
        <ActionForm action={login} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block"><span className="label">Username</span><input name="username" className="input" autoComplete="username" autoCapitalize="none" required /></label>
          <label className="block"><span className="label">Password</span><input name="password" type="password" className="input" autoComplete="current-password" required /></label>
          <Submit className="btn-primary w-full" pendingText="Checking…">Log in</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
