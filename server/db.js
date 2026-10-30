import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { mkdirSync } from "node:fs";
const postgres = Boolean(process.env.DATABASE_URL);
let pool, sqlite;
if (postgres)
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: true },
  });
else {
  mkdirSync(process.env.DATA_DIR || "data", { recursive: true });
  sqlite = new DatabaseSync(`${process.env.DATA_DIR || "data"}/nexora.sqlite`);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
}
// Each statement gets its own positional parameter counter.
export async function db(sql, values = []) {
  if (postgres) {
    let n = 0;
    return (
      await pool.query(
        sql.replace(/\?/g, () => `$${++n}`),
        values,
      )
    ).rows;
  }
  return sqlite.prepare(sql).all(...values);
}
export async function init() {
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS missions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,priority TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,event TEXT NOT NULL,created_at TEXT NOT NULL)`,
  ])
    await db(sql);
}
export async function close() {
  if (pool) await pool.end();
  else sqlite.close();
}
