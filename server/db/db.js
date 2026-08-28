import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "app.db");
export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);

export function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

export function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}
