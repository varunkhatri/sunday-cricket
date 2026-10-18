import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { store, type Table } from "@/lib/data/store";
import { londonToday } from "@/lib/lock";

export const dynamic = "force-dynamic";

/** Admin-only: download every table as one JSON file, as a safety copy of the whole history. */
export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "Only the admin can download a backup" }, { status: 401 });
  const tables: Table[] = ["players", "match_days", "day_teams", "matches", "innings", "balls", "photos"];
  const data = Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await store().list(t)] as const)));
  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 1), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sunday-cricket-backup-${londonToday()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
