import db from './db.js';

const TTL_MS = 24 * 60 * 60 * 1000;

export function cacheGet(key) {
  const row = db.prepare('SELECT data, created_at FROM cache WHERE key = ?').get(key);
  if (!row) return null;
  if (Date.now() - row.created_at > TTL_MS) {
    db.prepare('DELETE FROM cache WHERE key = ?').run(key);
    return null;
  }
  return JSON.parse(row.data);
}

export function cacheSet(key, data) {
  db.prepare('INSERT OR REPLACE INTO cache (key, data, created_at) VALUES (?, ?, ?)')
    .run(key, JSON.stringify(data), Date.now());
}
