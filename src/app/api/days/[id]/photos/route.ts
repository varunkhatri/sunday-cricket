import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { store } from "@/lib/data/store";
import type { MatchDay, Photo } from "@/lib/types";

export const dynamic = "force-dynamic";
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Only the admin can upload photos" }, { status: 401 });
  const day = await store().get<MatchDay>("match_days", params.id);
  if (!day) return NextResponse.json({ error: "Day not found" }, { status: 404 });
  const existing = await store().list<Photo>("photos", { match_day_id: params.id });
  if (existing.length >= 4) return NextResponse.json({ error: "Max 4 photos per day — delete one first" }, { status: 400 });

  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Please upload a JPG, PNG, WebP or GIF" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large (max 4 MB)" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const { path, url } = await store().uploadFile(file.name || "photo.jpg", buf, file.type);
  try {
    await store().insert("photos", {
      match_day_id: params.id,
      path,
      url,
      caption: String(fd.get("caption") ?? "").trim().slice(0, 200) || null,
      sort: existing.reduce((m, p) => Math.max(m, p.sort), -1) + 1,
    });
  } catch (e) {
    await store().deleteFile(path).catch(() => undefined);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
