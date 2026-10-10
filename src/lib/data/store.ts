import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Table = "players" | "match_days" | "day_teams" | "matches" | "innings" | "balls" | "photos";
export type FilterValue = string | number | boolean | null | (string | number)[];
export type Filter = Record<string, FilterValue>;

export interface Store {
  list<T>(table: Table, filter?: Filter): Promise<T[]>;
  get<T>(table: Table, id: string): Promise<T | null>;
  insert<T>(table: Table, row: Record<string, unknown>): Promise<T>;
  update<T>(table: Table, id: string, patch: Record<string, unknown>): Promise<T>;
  remove(table: Table, filter: Filter): Promise<void>;
  uploadFile(name: string, data: Buffer, contentType: string): Promise<{ path: string; url: string }>;
  deleteFile(path: string): Promise<void>;
}

export const dataMode = () => (process.env.DATA_MODE === "local" ? "local" : "supabase");

/* ---------------- Local JSON store (for trying the app on a laptop) ---------------- */

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PHOTO_DIR = path.join(DATA_DIR, "photos");

type DB = Record<Table, Record<string, unknown>[]>;
const emptyDb = (): DB => ({ players: [], match_days: [], day_teams: [], matches: [], innings: [], balls: [], photos: [] });

function matches(row: Record<string, unknown>, filter?: Filter) {
  if (!filter) return true;
  return Object.entries(filter).every(([k, v]) =>
    Array.isArray(v) ? v.includes(row[k] as string) : row[k] === v,
  );
}

let lock: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = lock.then(fn, fn);
  lock = next.catch(() => undefined);
  return next;
}

async function readDb(): Promise<DB> {
  try {
    return { ...emptyDb(), ...JSON.parse(await fs.readFile(DB_FILE, "utf8")) };
  } catch {
    return emptyDb();
  }
}
async function writeDb(db: DB) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + "." + randomUUID() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, DB_FILE);
}

const localStore: Store = {
  async list<T>(table: Table, filter?: Filter) {
    const db = await readDb();
    return db[table].filter((r) => matches(r, filter)) as T[];
  },
  async get<T>(table: Table, id: string) {
    const db = await readDb();
    return (db[table].find((r) => r.id === id) as T) ?? null;
  },
  insert<T>(table: Table, row: Record<string, unknown>) {
    return serialized(async () => {
      const db = await readDb();
      const full: Record<string, unknown> = { id: randomUUID(), created_at: new Date().toISOString(), ...row };
      if (table === "balls" && db.balls.some((b) => b.innings_id === full.innings_id && b.seq === full.seq))
        throw new Error("duplicate ball");
      if (table === "photos" && db.photos.filter((p) => p.match_day_id === full.match_day_id).length >= 4)
        throw new Error("A day can have at most 4 photos");
      db[table].push(full);
      await writeDb(db);
      return full as T;
    });
  },
  update<T>(table: Table, id: string, patch: Record<string, unknown>) {
    return serialized(async () => {
      const db = await readDb();
      const row = db[table].find((r) => r.id === id);
      if (!row) throw new Error("not found");
      Object.assign(row, patch);
      await writeDb(db);
      return row as T;
    });
  },
  remove(table: Table, filter: Filter) {
    return serialized(async () => {
      const db = await readDb();
      db[table] = db[table].filter((r) => !matches(r, filter));
      await writeDb(db);
    });
  },
  async uploadFile(name, data) {
    await fs.mkdir(PHOTO_DIR, { recursive: true });
    const file = `${randomUUID()}-${name.replace(/[^\w.-]/g, "_")}`;
    await fs.writeFile(path.join(PHOTO_DIR, file), data);
    return { path: file, url: `/api/local-photo/${file}` };
  },
  async deleteFile(p) {
    await fs.rm(path.join(PHOTO_DIR, path.basename(p)), { force: true });
  },
};

export async function readLocalPhoto(file: string) {
  return fs.readFile(path.join(PHOTO_DIR, path.basename(file)));
}

/* ---------------- Supabase store (real deployment) ---------------- */

let sb: SupabaseClient | null = null;
function supa() {
  if (!sb) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see SETUP.md)");
    sb = createClient(url, key, { auth: { persistSession: false } });
  }
  return sb;
}
const BUCKET = "day-photos";

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function applyFilter(q: any, filter?: Filter) {
  for (const [k, v] of Object.entries(filter ?? {})) {
    if (Array.isArray(v)) q = q.in(k, v);
    else if (v === null) q = q.is(k, null);
    else q = q.eq(k, v);
  }
  return q;
}

const supabaseStore: Store = {
  async list<T>(table: Table, filter?: Filter) {
    // split huge IN lists, and page through results (Supabase returns max 1000 rows per request)
    const inKey = Object.entries(filter ?? {}).find(([, v]) => Array.isArray(v) && v.length > 100)?.[0];
    if (inKey) {
      const parts = chunk((filter![inKey] as string[]), 100);
      const res = await Promise.all(parts.map((p) => supabaseStore.list<T>(table, { ...filter, [inKey]: p })));
      return res.flat();
    }
    if (filter && Object.values(filter).some((v) => Array.isArray(v) && v.length === 0)) return [];
    const out: T[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await applyFilter(supa().from(table).select("*"), filter)
        .order("id")
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      out.push(...(data as T[]));
      if (!data || data.length < page) break;
    }
    return out;
  },
  async get<T>(table: Table, id: string) {
    const { data, error } = await supa().from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as T | null;
  },
  async insert<T>(table: Table, row: Record<string, unknown>) {
    const { data, error } = await supa().from(table).insert(row).select("*").single();
    if (error) throw new Error(error.message);
    return data as T;
  },
  async update<T>(table: Table, id: string, patch: Record<string, unknown>) {
    const { data, error } = await supa().from(table).update(patch).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return data as T;
  },
  async remove(table: Table, filter: Filter) {
    if (!filter || Object.keys(filter).length === 0) throw new Error("refusing to delete without a filter");
    const { error } = await applyFilter(supa().from(table).delete(), filter);
    if (error) throw new Error(error.message);
  },
  async uploadFile(name, data, contentType) {
    const p = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supa().storage.from(BUCKET).upload(p, data, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    const { data: pub } = supa().storage.from(BUCKET).getPublicUrl(p);
    return { path: p, url: pub.publicUrl };
  },
  async deleteFile(p) {
    await supa().storage.from(BUCKET).remove([p]);
  },
};

export function store(): Store {
  return dataMode() === "local" ? localStore : supabaseStore;
}
