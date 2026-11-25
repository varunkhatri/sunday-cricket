"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Crops the picture to a centred square and shrinks it, so it's small and looks right in round frames. */
async function squareJpeg(file: File, size = 512): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = Math.min(size, side);
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read that picture"))), "image/jpeg", 0.88));
}

/** Super admin: choose / change / remove a player's profile picture. */
export default function PlayerPhotoUploader({ playerId, hasPhoto }: { playerId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (init: RequestInit) => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/players/${playerId}/photo`, init).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return setErr((await res?.json().catch(() => ({})))?.error ?? "That didn't work — check your signal and try again");
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Choose a profile picture"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const blob = await squareJpeg(f);
            const fd = new FormData();
            fd.set("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
            await send({ method: "POST", body: fd });
          } catch (x) {
            setErr((x as Error).message);
          }
        }} />
      <button type="button" className="btn-ghost px-3 py-1.5 text-sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Saving…" : hasPhoto ? "📷 Change picture" : "📷 Add picture"}
      </button>
      {hasPhoto && !busy && (
        <button type="button" className="rounded-lg px-2 py-1.5 text-sm text-red-700 hover:bg-red-50"
          onClick={() => { if (confirm("Remove this player's picture?")) send({ method: "DELETE" }); }}>
          Remove
        </button>
      )}
      {err && <p role="alert" className="w-full text-sm text-red-700">{err}</p>}
    </div>
  );
}
