import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? resolve(__dirname, '../data/prospectly.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    start_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS parcours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    score INTEGER,
    status TEXT CHECK(status IN ('todo','done','not_done')) DEFAULT 'todo',
    website TEXT,
    rating REAL,
    reviews INTEGER,
    google_maps_url TEXT,
    notes TEXT,
    visit_status TEXT CHECK(visit_status IN ('pending','visited','absent')) DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

ensureColumn('parcours', 'notes', 'TEXT');
ensureColumn('parcours', 'visit_status', "TEXT CHECK(visit_status IN ('pending','visited','absent')) DEFAULT 'pending'");

// Migration: Update status column constraint and migrate old statuses
// Check if we need to migrate old status values
const statusCheck = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='parcours'").get();
if (statusCheck && statusCheck.sql && statusCheck.sql.includes("'visited','interested','not_interested'")) {
  // Need to recreate table with new constraint and migrate data
  db.exec(`
    CREATE TABLE parcours_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      score INTEGER,
      status TEXT CHECK(status IN ('todo','done','not_done')) DEFAULT 'todo',
      website TEXT,
      rating REAL,
      reviews INTEGER,
      google_maps_url TEXT,
      notes TEXT,
      visit_status TEXT CHECK(visit_status IN ('pending','visited','absent')) DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  // Migrate data: visited/interested -> done, not_interested -> not_done, todo -> todo
  db.exec(`
    INSERT INTO parcours_new (id, user_id, name, address, phone, score, status, website, rating, reviews, google_maps_url, notes, visit_status, created_at, updated_at)
    SELECT id, user_id, name, address, phone, score,
      CASE status
        WHEN 'visited' THEN 'done'
        WHEN 'interested' THEN 'done'
        WHEN 'not_interested' THEN 'not_done'
        ELSE 'todo'
      END,
      website, rating, reviews, google_maps_url, notes, visit_status, created_at, updated_at
    FROM parcours;
  `);
  
  db.exec('DROP TABLE parcours;');
  db.exec('ALTER TABLE parcours_new RENAME TO parcours;');
  
  // Recreate index
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_parcours_user_name_address
    ON parcours(user_id, name, address);
  `);
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_parcours_user_name_address
  ON parcours(user_id, name, address);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export default db;