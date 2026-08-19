import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), "data", "app.db");

// Ensure data directory exists
const fs = require("fs");
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let sqlite: Database.Database | null = null;
let _db: any = null;

function getDb() {
  if (!_db) {
    try {
      sqlite = new Database(dbPath, {
        timeout: 5000,
        fileMustExist: false
      });
      sqlite.pragma("journal_mode = WAL");
      _db = drizzle(sqlite, { schema });
      initializeTables();
    } catch (error: any) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }
  return _db;
}

function initializeTables() {
  if (!sqlite) return;

  try {
    // Create tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        visible_count INTEGER DEFAULT 5,
        takeover_window_minutes INTEGER,
        started_at INTEGER NOT NULL,
        expected_duration_minutes INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trends (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        name TEXT NOT NULL,
        value INTEGER DEFAULT 0,
        is_hidden INTEGER DEFAULT 0,
        position INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);
  } catch (error) {
    console.error("Failed to create tables:", error);
  }
}

export function getDatabase() {
  return getDb();
}

export const db = new Proxy({} as any, {
  get: (_target, prop: string | symbol) => {
    const database = getDb();
    const value = database[prop];
    return typeof value === 'function' ? value.bind(database) : value;
  },
});

export { schema };
