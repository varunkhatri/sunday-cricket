import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { getMatchBundle, getPlayerNames } from "@/lib/data/queries";
import {
  addBall, addPlayerToTeam, ConflictError, endInnings, setCommonPlayer, setOvers, undoLast, type BallInput,
} from "@/lib/data/matchOps";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const bundle = await getMatchBundle(params.id);
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ bundle }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Only the admin can score" }, { status: 401 });
  let body: { action?: string; ball?: BallInput; overs?: number; teamId?: string; playerId?: string | null; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    if (body.action === "add" && body.ball) await addBall(params.id, body.ball);
    else if (body.action === "undo") await undoLast(params.id);
    else if (body.action === "end_innings") await endInnings(params.id);
    else if (body.action === "set_overs") await setOvers(params.id, Number(body.overs));
    else if (body.action === "set_common") await setCommonPlayer(params.id, body.playerId || null);
    else if (body.action === "add_player")
      await addPlayerToTeam(params.id, String(body.teamId ?? ""), { playerId: body.playerId || undefined, name: body.name });
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const bundle = await getMatchBundle(params.id);
    const status = e instanceof ConflictError ? 409 : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error", bundle }, { status });
  }
  revalidatePath("/", "layout");
  const [bundle, names] = await Promise.all([getMatchBundle(params.id), getPlayerNames()]);
  return NextResponse.json({ bundle, names });
}
