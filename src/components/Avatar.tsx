/** A player's profile picture, or their initials when there isn't one. */
export default function Avatar({ name, url, size = 32, className = "" }: { name: string; url?: string | null; size?: number; className?: string }) {
  const initials = (name || "?").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} loading="lazy" style={style}
      className={`inline-block shrink-0 rounded-full bg-pitch-100 object-cover ring-1 ring-black/10 ${className}`} />
  ) : (
    <span aria-hidden style={style}
      className={`inline-grid shrink-0 place-items-center rounded-full bg-pitch font-display font-bold leading-none text-white ${className}`}>
      {initials}
    </span>
  );
}

/** The big picture on award cards: the player's photo with the award emoji as a badge, or just the emoji. */
export function AwardFace({ name, url, emoji, badge }: { name: string; url?: string | null; emoji: string; badge?: string }) {
  if (!url)
    return (
      <div className="relative shrink-0 text-5xl drop-shadow sm:text-6xl" aria-hidden>
        {emoji}
        {badge && <span className="absolute -bottom-1 -right-2 text-2xl">{badge}</span>}
      </div>
    );
  return (
    <div className="relative shrink-0" aria-hidden>
      <Avatar name={name} url={url} size={72} className="ring-[3px] ring-white shadow-card" />
      <span className="absolute -bottom-1 -right-2 text-3xl drop-shadow">{emoji}</span>
    </div>
  );
}
