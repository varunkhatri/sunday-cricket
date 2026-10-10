/** Renders the simple match-report format: "# headline", "**bold line**", paragraphs and "- " bullets. */
export default function Summary({ text, compact = false }: { text: string | null; compact?: boolean }) {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: number) => {
    if (bullets.length) {
      out.push(
        <ul key={"u" + k} className="mt-3 space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="rounded-lg bg-pitch-50 px-3 py-2 text-[15px] leading-snug">{b}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  blocks.forEach((b, i) => {
    if (b.startsWith("- ")) {
      bullets.push(...b.split("\n").map((l) => l.replace(/^- /, "")));
      return;
    }
    flush(i);
    if (b.startsWith("# "))
      out.push(<h3 key={i} className={`font-display font-extrabold leading-tight text-pitch-900 ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>{b.slice(2)}</h3>);
    else if (/^\*\*.*\*\*$/.test(b))
      out.push(<p key={i} className="mt-1 font-semibold text-gold-700">{b.slice(2, -2)}</p>);
    else out.push(<p key={i} className="mt-3 text-[15px] leading-relaxed text-ink/85">{b}</p>);
  });
  flush(blocks.length);
  return <div>{out}</div>;
}
