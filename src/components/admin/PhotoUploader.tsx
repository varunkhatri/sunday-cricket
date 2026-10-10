"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Shrinks big phone photos before upload so they're quick on mobile data. */
async function resize(file: File, max = 1600): Promise<Blob> {
  if (file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

export default function PhotoUploader({ dayId, remaining }: { dayId: string; remaining: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (remaining <= 0) return <p className="text-sm muted">You&apos;ve added the maximum of 4 photos. Delete one to add another.</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const file = fd.get("file");
        if (!(file instanceof File) || !file.size) return setErr("Choose a photo");
        setBusy(true);
        setErr(null);
        const blob = await resize(file);
        const up = new FormData();
        up.set("file", new File([blob], file.name.replace(/\.\w+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : "." + (file.name.split(".").pop() ?? "jpg")), { type: blob.type || file.type }));
        up.set("caption", String(fd.get("caption") ?? ""));
        const res = await fetch(`/api/days/${dayId}/photos`, { method: "POST", body: up });
        setBusy(false);
        if (!res.ok) return setErr((await res.json().catch(() => ({}))).error ?? "Upload failed");
        form.reset();
        router.refresh();
      }}
    >
      <input type="file" name="file" accept="image/*" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-pitch file:px-3 file:py-2 file:font-semibold file:text-white" />
      <input name="caption" maxLength={200} className="input" placeholder="Caption — e.g. Raj's catch of the season!" />
      <button className="btn-primary" disabled={busy}>{busy ? "Uploading…" : `Upload photo (${remaining} left)`}</button>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
    </form>
  );
}
