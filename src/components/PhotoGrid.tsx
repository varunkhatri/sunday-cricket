import type { Photo } from "@/lib/types";

export default function PhotoGrid({ photos }: { photos: Photo[] }) {
  if (!photos.length) return null;
  return (
    <div className={`grid gap-3 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {photos.map((p) => (
        <figure key={p.id} className="card overflow-hidden">
          <a href={p.url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? "Photo of the day"} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          </a>
          {p.caption && <figcaption className="px-3 py-2 text-sm">{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
