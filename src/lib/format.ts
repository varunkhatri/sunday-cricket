export function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}
export function fmtMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
export const f1 = (n: number | null | undefined) => (n == null || !isFinite(n) ? "–" : n.toFixed(1));
export const f2 = (n: number | null | undefined) => (n == null || !isFinite(n) ? "–" : n.toFixed(2));
export const signed = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2);
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
