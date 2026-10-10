import { dataMode, readLocalPhoto } from "@/lib/data/store";

export async function GET(_: Request, { params }: { params: { name: string } }) {
  if (dataMode() !== "local") return new Response("Not found", { status: 404 });
  try {
    const data = await readLocalPhoto(params.name);
    const ext = params.name.split(".").pop()?.toLowerCase();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
    return new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
