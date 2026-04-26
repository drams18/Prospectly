import jwt from 'jsonwebtoken';
import { createRequire } from 'module';
import db from './db.js';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId, username) {
  return jwt.sign({ sub: userId, username }, JWT_SECRET, { expiresIn: '365d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

export function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function createUser(username, password_hash) {
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, password_hash);
  return result.lastInsertRowid;
}
