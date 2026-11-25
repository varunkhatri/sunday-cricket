import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/lib/auth";
import { store } from "@/lib/data/store";
import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Super admin: set a player's profile picture (replaces any previous one). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isSuperAdmin()) return NextResponse.json({ error: "Only the super admin can change profile pictures" }, { status: 401 });
  const player = await store().get<Player>("players", params.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No picture" }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Please use a JPG, PNG or WebP picture" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Picture too large (max 3 MB)" }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const { path, url } = await store().uploadFile(`player-${player.id}.${ext}`, Buffer.from(await file.arrayBuffer()), file.type, "players");
  await store().update("players", player.id, { photo_url: url, photo_path: path });
  if (player.photo_path) await store().deleteFile(player.photo_path).catch(() => undefined);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, url });
}

/** Super admin: remove a player's profile picture. */
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!isSuperAdmin()) return NextResponse.json({ error: "Only the super admin can change profile pictures" }, { status: 401 });
  const player = await store().get<Player>("players", params.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (player.photo_path) await store().deleteFile(player.photo_path).catch(() => undefined);
  await store().update("players", player.id, { photo_url: null, photo_path: null });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
