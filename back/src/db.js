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
    status TEXT CHECK(status IN ('done','not_done')) DEFAULT 'not_done',
    website TEXT,
    rating REAL,
    reviews INTEGER,
    google_maps_url TEXT,
    notes TEXT,
    visit_status TEXT CHECK(visit_status IN ('pending','visited','absent')) DEFAULT 'pending',
    is_favorite INTEGER DEFAULT 0,
    lat REAL,
    lng REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS seen_prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    seen_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, name, address)
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    searched_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Column migrations ──────────────────────────────────────────────────────────

ensureColumn('parcours', 'notes', 'TEXT');
ensureColumn('parcours', 'visit_status', "TEXT CHECK(visit_status IN ('pending','visited','absent')) DEFAULT 'pending'");
ensureColumn('parcours', 'is_favorite', 'INTEGER DEFAULT 0');
ensureColumn('parcours', 'lat', 'REAL');
ensureColumn('parcours', 'lng', 'REAL');

// ─── Status migration: normalize to 'done' / 'not_done' only ────────────────────

(function migrateStatus() {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='parcours'").get();
  if (!tableInfo || !tableInfo.sql) return;
  
  // Check if we need to update the status constraint (old values like 'todo', 'visited', 'interested', 'not_interested')
  const hasOldConstraint = tableInfo.sql.includes("'todo'") || tableInfo.sql.includes("'visited'") || 
                           tableInfo.sql.includes("'interested'") || tableInfo.sql.includes("'not_interested'");
  
  if (hasOldConstraint) {
    // Recreate table with new constraint
    db.exec(`
      CREATE TABLE parcours_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        score INTEGER,
        status TEXT CHECK(status IN ('done','not_done')) DEFAULT 'not_done',
        website TEXT,
        rating REAL,
        reviews INTEGER,
        google_maps_url TEXT,
        notes TEXT,
        visit_status TEXT CHECK(visit_status IN ('pending','visited','absent')) DEFAULT 'pending',
        is_favorite INTEGER DEFAULT 0,
        lat REAL,
        lng REAL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    
    // Migrate data: all old statuses -> 'not_done', 'done' stays 'done'
    db.exec(`
      INSERT INTO parcours_new (id, user_id, name, address, phone, score, status, website, rating, reviews, google_maps_url, notes, visit_status, is_favorite, lat, lng, created_at, updated_at)
      SELECT id, user_id, name, address, phone, score,
        CASE status
          WHEN 'done' THEN 'done'
          WHEN 'visited' THEN 'done'
          WHEN 'interested' THEN 'done'
          ELSE 'not_done'
        END,
        website, rating, reviews, google_maps_url, notes, visit_status, 
        COALESCE(is_favorite, 0), lat, lng, created_at, updated_at
      FROM parcours;
    `);
    
    db.exec('DROP TABLE parcours;');
    db.exec('ALTER TABLE parcours_new RENAME TO parcours;');
  }
})();

// ─── Indexes ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_parcours_user_name_address
  ON parcours(user_id, name, address);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_parcours_user_status
  ON parcours(user_id, status);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_parcours_user_favorite
  ON parcours(user_id, is_favorite);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export default db;