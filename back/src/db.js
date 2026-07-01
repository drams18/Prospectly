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
ensureColumn('parcours', 'has_booking', 'INTEGER');
ensureColumn('parcours', 'booking_type', 'TEXT');
ensureColumn('parcours', 'has_instagram', 'INTEGER');
ensureColumn('parcours', 'is_hot', 'INTEGER');
ensureColumn('parcours', 'wasted_potential', 'INTEGER');

// ─── Pipeline status migration ──────────────────────────────────────────────────

ensureColumn('parcours', 'pipeline_status', "TEXT CHECK(pipeline_status IN ('new','contacted','interested','converted','refused')) DEFAULT 'new'");

// Migrate existing data: visit_status = 'visited' -> contacted, else new
(function migratePipelineStatus() {
  const colInfo = db.prepare("PRAGMA table_info('parcours')").all();
  const hasPipelineStatus = colInfo.some(c => c.name === 'pipeline_status');
  if (!hasPipelineStatus) return;
  
  // Check if migration is needed (any row with pipeline_status = 'new' and visit_status != 'pending')
  const needsMigration = db.prepare(`
    SELECT 1 FROM parcours WHERE pipeline_status = 'new' AND visit_status = 'visited' LIMIT 1
  `).get();
  
  if (needsMigration) {
    db.exec(`
      UPDATE parcours 
      SET pipeline_status = 'contacted' 
      WHERE pipeline_status = 'new' AND visit_status = 'visited'
    `);
  }
})();

// ─── Actions table ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prospect_id INTEGER NOT NULL REFERENCES parcours(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('call','sms','visit','note','status_change')),
    content TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_actions_prospect 
  ON actions(prospect_id, created_at DESC);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_actions_user 
  ON actions(user_id);
`);

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
        pipeline_status TEXT CHECK(pipeline_status IN ('new','contacted','interested','converted','refused')) DEFAULT 'new',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Migrate data: all old statuses -> 'not_done', 'done' stays 'done'
    db.exec(`
      INSERT INTO parcours_new (id, user_id, name, address, phone, score, status, website, rating, reviews, google_maps_url, notes, visit_status, is_favorite, lat, lng, pipeline_status, created_at, updated_at)
      SELECT id, user_id, name, address, phone, score,
        CASE status
          WHEN 'done' THEN 'done'
          WHEN 'visited' THEN 'done'
          WHEN 'interested' THEN 'done'
          ELSE 'not_done'
        END,
        website, rating, reviews, google_maps_url, notes, visit_status,
        COALESCE(is_favorite, 0), lat, lng,
        COALESCE(pipeline_status, 'new'),
        created_at, updated_at
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

// ─── Scripts de prospection ─────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('call','sms','email')),
    category TEXT NOT NULL,
    label TEXT,
    subject TEXT,
    content TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );
`);

(function seedScripts() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM scripts').get();
  if (count > 0) return;

  const insert = db.prepare(
    'INSERT INTO scripts (type, category, label, subject, content, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const rows = [
    // Appel — accroches
    ['call', 'accroche', null, null, "Bonjour, je vous appelle pas pour vous vendre quoi que ce soit, j'ai juste une question rapide, vous avez trente secondes ?", 1],
    ['call', 'accroche', null, null, "Salut, désolé de vous déranger en plein service, je fais vite : est-ce que les gens vous trouvent facilement sur Google ?", 2],
    ['call', 'accroche', null, null, "Bonjour, je passe un coup de fil éclair — c'est vous qui vous occupez de la partie communication ou site internet ici ?", 3],
    ['call', 'accroche', null, null, "Bonjour, je suis tombé sur votre établissement en cherchant sur Google et je me suis dit que je pouvais vous faire gagner du temps sur un truc, vous avez deux minutes ?", 4],

    // Appel — corps du message
    ['call', 'corps', null, null, "En fait j'aide les commerces du coin à avoir plus de clients grâce à internet : un site simple, être mieux visible sur Google, et pouvoir prendre des rendez-vous tout seul sans passer son temps au téléphone. Je regarde en ce moment ce qui pourrait être amélioré, rien d'obligatoire, juste pour voir si ça peut vous servir.", 1],

    // Appel — questions ouvertes
    ['call', 'question', null, null, "Est-ce que c'est un sujet qui vous parle en ce moment ?", 1],
    ['call', 'question', null, null, "Vous diriez que c'est plutôt le site, la visibilité sur Google, ou les rendez-vous qui vous embête le plus ?", 2],
    ['call', 'question', null, null, "Ça vous dérange si je vous montre rapidement ce que ça donnerait chez vous ?", 3],

    // Appel — objections
    ['call', 'objection', 'Je suis occupé.', null, "Pas de souci, je vous laisse tranquille. Je vous envoie un message et vous regardez quand vous avez cinq minutes ?", 1],
    ['call', 'objection', 'On a déjà un site.', null, "Ah nickel. Il vous ramène des clients ou il sert plutôt de carte de visite ? La plupart des sites que je croise sont juste là pour faire joli, sans vraiment convertir.", 2],
    ['call', 'objection', 'Ça ne nous intéresse pas.', null, "Pas de souci du tout. Juste par curiosité, c'est parce que quelqu'un s'en occupe déjà, ou c'est pas une priorité en ce moment ?", 3],
    ['call', 'objection', 'Envoyez-moi un mail.', null, "Avec plaisir, c'est à quelle adresse ? ... Parfait, je vous envoie ça dans la journée.", 4],

    // SMS — variantes
    ['sms', 'variante', 'Variante 1', null, "Bonjour, je travaille sur la visibilité en ligne des commerces du coin. J'ai regardé rapidement et il y a deux ou trois trucs simples à améliorer. Ça vous dit que je vous montre en 2 minutes ?", 1],
    ['sms', 'variante', 'Variante 2', null, "Bonjour, petit message rapide : je crois que vous perdez des clients à cause de votre présence sur Google. Rien de grave, ça se corrige vite. Vous voulez que je vous explique comment ?", 2],
    ['sms', 'variante', 'Variante 3', null, "Bonjour, je passe régulièrement dans le coin et je me demandais pourquoi vous n'apparaissiez pas mieux sur Google. J'ai une idée simple pour ça, dispo pour en discuter deux minutes ?", 3],
    ['sms', 'variante', 'Variante 4', null, "Bonjour, j'aide des commerces à avoir plus de rendez-vous sans effort supplémentaire, juste en améliorant leur site et leur visibilité. Ça vous parle ou pas du tout en ce moment ?", 4],
    ['sms', 'variante', 'Variante 5', null, "Bonjour, question rapide : les gens arrivent facilement à vous trouver ou à prendre rendez-vous en ligne ? Si c'est pas le cas j'ai une solution simple à vous montrer, ça vous dit ?", 5],

    // Email — versions
    ['email', 'standard', 'Standard', 'Une question rapide sur votre visibilité en ligne',
      "Bonjour,\n\nPetit message direct : je remarque souvent des commerces qui perdent des clients sans le savoir, à cause d'un site vieillissant, d'une mauvaise visibilité sur Google, ou de rendez-vous encore pris à la main.\n\nJe ne sais pas si c'est votre cas, mais je peux regarder ça en deux minutes et vous dire honnêtement si ça vaut le coup d'améliorer quelque chose, ou pas.\n\nÇa vous dit qu'on en parle cette semaine ?", 1],
    ['email', 'professionnelle', 'Professionnelle', 'Amélioration de votre visibilité en ligne — 2 minutes',
      "Bonjour,\n\nJe me permets de vous contacter au sujet de votre présence en ligne. Après un rapide coup d'œil, plusieurs points pourraient être optimisés : la visibilité sur Google, la prise de rendez-vous en ligne, et la conversion des visiteurs en clients.\n\nJe ne cherche pas à vous vendre quoi que ce soit dans l'immédiat, simplement à savoir si le sujet vous intéresse, et si oui, à vous montrer concrètement ce qui pourrait être amélioré.\n\nAuriez-vous quelques minutes cette semaine pour en discuter ?", 2],
    ['email', 'decontractee', 'Décontractée', 'Petite question sur votre site (ou son absence)',
      "Salut,\n\nJe te contacte vite fait : j'aide des commerces à avoir plus de clients grâce à un site simple, une meilleure visibilité sur Google et des rendez-vous pris automatiquement.\n\nPas de blabla commercial, juste une question : ça t'intéresse d'en parler deux minutes cette semaine ?", 3],
    ['email', 'courte', 'Très courte', '2 minutes ?',
      "Bonjour,\n\nJe pense pouvoir vous aider à avoir plus de clients grâce à votre présence en ligne. Ça vous dit qu'on en parle deux minutes cette semaine ?", 4],
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(...item);
  });
  insertMany(rows);
})();

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export default db;