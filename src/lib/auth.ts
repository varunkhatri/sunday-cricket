import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { dataMode } from "./data/store";

export const COOKIE = "sc_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — the umpire stays logged in on their phone

/**
 * Two roles:
 *  - "super" (super admin): everything, including correcting previous Sundays (after unlocking them).
 *  - "staff" (admin): everything for today's games, but previous Sundays are read-only.
 */
export type Role = "super" | "staff";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (dataMode() === "local") return "local-dev-secret-change-me";
  throw new Error("SESSION_SECRET must be set (at least 16 characters)");
}

function accounts(): { role: Role; u: string; p: string }[] {
  const list: { role: Role; u: string; p: string }[] = [];
  // the original admin login is the super admin
  const su = process.env.ADMIN_USERNAME;
  const sp = process.env.ADMIN_PASSWORD;
  if (su && sp) list.push({ role: "super", u: su, p: sp });
  else if (dataMode() === "local") list.push({ role: "super", u: "admin", p: "admin" });
  else throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set");
  // optional second login with the "admin" role
  const au = process.env.SECOND_ADMIN_USERNAME;
  const ap = process.env.SECOND_ADMIN_PASSWORD;
  if (au && ap) list.push({ role: "staff", u: au, p: ap });
  else if (dataMode() === "local") list.push({ role: "staff", u: "umpire", p: "umpire" });
  return list;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Returns the role for these credentials, or null. */
export function checkCredentials(username: string, password: string): Role | null {
  let found: Role | null = null;
  for (const a of accounts()) {
    // compare every account fully so timing doesn't leak which part was wrong
    const okU = safeEq(username.trim().toLowerCase(), a.u.trim().toLowerCase());
    const okP = safeEq(password, a.p);
    if (okU && okP && !found) found = a.role;
  }
  return found;
}

export function makeSessionToken(role: Role) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `${role}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function roleFromToken(token: string | undefined | null): Role | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!safeEq(sig, sign(payload))) return null;
  const [r, e] = payload.split(".");
  const exp = Number(e);
  if (!Number.isFinite(exp) || exp <= Date.now() / 1000) return null;
  if (r === "super" || r === "admin") return "super"; // "admin" = logins from before roles existed
  if (r === "staff") return "staff";
  return null;
}

/** The signed-in role for this request (null = viewer). */
export function currentRole(): Role | null {
  return roleFromToken(cookies().get(COOKIE)?.value);
}

/**
 * Role for permission checks inside shared server code. Outside a web request (e.g. the demo
 * seed script) there is no login, and those scripts are run by the owner, so they act as super admin.
 */
export function actingRole(): Role | null {
  try {
    return currentRole();
  } catch {
    return "super";
  }
}

export function isAdmin() {
  return currentRole() !== null;
}

export function isSuperAdmin() {
  return currentRole() === "super";
}

export class NotAdminError extends Error {
  constructor(msg = "Only the admin can do that") {
    super(msg);
  }
}

export function requireAdmin() {
  if (!isAdmin()) throw new NotAdminError();
}

export function requireSuperAdmin() {
  if (!isSuperAdmin()) throw new NotAdminError("Only the super admin can do that");
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.DATA_MODE !== "local",
  path: "/",
  maxAge: MAX_AGE,
};
