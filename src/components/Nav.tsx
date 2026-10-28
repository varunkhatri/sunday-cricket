"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/actions";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/history", label: "History" },
  { href: "/stats", label: "Stats" },
  { href: "/captains", label: "Captains" },
  { href: "/players", label: "Players" },
];

export default function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <header className="sticky top-0 z-30 bg-pitch pt-[env(safe-area-inset-top)] text-white shadow-md">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-lg font-extrabold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo-128.png" alt="" width={34} height={34} className="h-[34px] w-[34px] shrink-0 rounded-[9px] ring-1 ring-white/20" />
          <span>Sunday Cricket</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {admin ? (
            <>
              <Link href="/admin" className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${path.startsWith("/admin") ? "bg-gold text-pitch-900" : "bg-white/10 hover:bg-white/20"}`}>
                <span className="sm:hidden">Umpire</span><span className="hidden sm:inline">Umpire desk</span>
              </Link>
              <form action={logout}>
                <button className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm text-white/70 hover:text-white">Log out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:text-white">
              Admin
            </Link>
          )}
        </div>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2 text-sm [scrollbar-width:none]">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition ${active(l.href) ? "bg-white text-pitch" : "text-white/80 hover:bg-white/10"}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
