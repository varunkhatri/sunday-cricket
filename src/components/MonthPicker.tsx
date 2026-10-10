"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fmtMonth } from "@/lib/format";

export default function MonthPicker({ months, allowAll = true }: { months: string[]; allowAll?: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [custom, setCustom] = useState(!!(sp.get("from") || sp.get("to")));
  const current = custom ? "custom" : sp.get("month") ?? (allowAll ? "all" : months[0] ?? "");
  const go = (q: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    ["month", "from", "to"].forEach((k) => next.delete(k));
    Object.entries(q).forEach(([k, v]) => v && next.set(k, v));
    router.push(`${path}?${next.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-40">
        <span className="label">Period</span>
        <select
          className="input"
          value={current}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") return setCustom(true);
            setCustom(false);
            go(v === "all" ? {} : { month: v });
          }}
        >
          {allowAll && <option value="all">All time</option>}
          {months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          {allowAll && <option value="custom">Custom dates…</option>}
        </select>
      </label>
      {custom && (
        <>
          <label><span className="label">From</span><input type="date" className="input" defaultValue={sp.get("from") ?? ""} onChange={(e) => go({ from: e.target.value, to: sp.get("to") ?? "" })} /></label>
          <label><span className="label">To</span><input type="date" className="input" defaultValue={sp.get("to") ?? ""} onChange={(e) => go({ from: sp.get("from") ?? "", to: e.target.value })} /></label>
        </>
      )}
    </div>
  );
}
