import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { dataMode } from "./data/store";

export const COOKIE = "sc_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — the umpire stays logged in on their phone

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (dataMode() === "local") return "local-dev-secret-change-me";
  throw new Error("SESSION_SECRET must be set (at least 16 characters)");
}

function credentials() {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (u && p) return { u, p };
  if (dataMode() === "local") return { u: "admin", p: "admin" };
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set");
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkCredentials(username: string, password: string) {
  const c = credentials();
  // evaluate both to avoid leaking which one was wrong via timing
  const okU = safeEq(username.trim().toLowerCase(), c.u.trim().toLowerCase());
  const okP = safeEq(password, c.p);
  return okU && okP;
}

export function makeSessionToken() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined | null) {
  if (!token) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  if (!safeEq(sig, sign(payload))) return false;
  const exp = Number(payload.split(".")[1]);
  return Number.isFinite(exp) && exp > Date.now() / 1000;
}

export function isAdmin() {
  return verifyToken(cookies().get(COOKIE)?.value);
}

export class NotAdminError extends Error {
  constructor() {
    super("Only the admin can do that");
  }
}

export function requireAdmin() {
  if (!isAdmin()) throw new NotAdminError();
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.DATA_MODE !== "local",
  path: "/",
  maxAge: MAX_AGE,
};
