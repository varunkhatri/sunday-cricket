import Link from "next/link";
import DayView from "@/components/DayView";
import { getDayFull, getPlayerNames, listDays } from "@/lib/data/queries";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [days, names] = await Promise.all([listDays(), getPlayerNames()]);
  const admin = isAdmin();
  if (!days.length)
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="text-6xl">🏏</div>
        <h1 className="h1 mt-3">Welcome to Sunday Cricket</h1>
        <p className="mt-2 muted">No matches have been scored yet. Once the umpire sets up a Sunday, live scores, reports and stats will show up right here.</p>
        {admin && <Link href="/admin" className="btn-primary mt-5">Set up the first Sunday</Link>}
      </div>
    );
  const data = await getDayFull(days[0].id);
  return (
    <>
      <DayView data={data!} names={names} admin={admin} />
      {days.length > 1 && (
        <p className="mt-8 text-center"><Link href="/history" className="btn-ghost">See previous Sundays →</Link></p>
      )}
    </>
  );
}
