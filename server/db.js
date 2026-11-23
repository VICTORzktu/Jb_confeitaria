'use strict';
/* Camada de banco com dois drivers:
   - PostgreSQL (DATABASE_URL definido) → server/db-pg.js
   - SQLite (padrão local)             → better-sqlite3

   Os métodos do driver Postgres são assíncronos (.get/.all/.run retornam Promises).
   Para manter um único código de rotas, o driver SQLite abaixo é exposto pela mesma
   interface assíncrona, e as rotas usam `await` em todas as chamadas. */

const USE_PG = !!process.env.DATABASE_URL;

if (USE_PG) {
  const { db, getSetting, setSetting, getJSONSetting } = require('./db-pg');
  module.exports = { db, getSetting, setSetting, getJSONSetting, USE_PG };
  return;
}

const Database = require('better-sqlite3');
const { DB_PATH } = require('./config');

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER,
  sex TEXT,
  height_cm INTEGER,
  weight_kg REAL,
  goal TEXT,
  level TEXT,
  days_per_week INTEGER,
  minutes_per_session INTEGER,
  location TEXT,
  equipment TEXT NOT NULL DEFAULT '[]',
  focus_muscles TEXT NOT NULL DEFAULT '[]',
  injuries TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  note TEXT,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric TEXT NOT NULL DEFAULT 'custom',
  target REAL,
  current REAL DEFAULT 0,
  unit TEXT DEFAULT '',
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  level TEXT,
  modality TEXT,
  split TEXT,
  days_per_week INTEGER,
  minutes INTEGER,
  plan_json TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  day_key TEXT,
  name TEXT,
  performed_at TEXT NOT NULL,
  duration_min INTEGER,
  effort INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS set_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_id INTEGER,
  set_number INTEGER,
  reps INTEGER,
  weight_kg REAL,
  completed INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL DEFAULT '',
  modalities TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL DEFAULT 'Iniciante',
  instructions TEXT NOT NULL DEFAULT '',
  common_errors TEXT NOT NULL DEFAULT '',
  tips TEXT NOT NULL DEFAULT '',
  video_url TEXT,
  image_key TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modalities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'dumbbell',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  ok INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  pix_payload TEXT,
  ref TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'artigo',
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_setlogs_user ON set_logs(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id, id);
CREATE INDEX IF NOT EXISTS idx_ai_usage ON ai_usage(user_id, feature, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_intents(user_id, status);
`);

/* ------------------- Interface assíncrona sobre o better-sqlite3 ------------------- */
const db = {
  prepare(sql) {
    const stmt = sqlite.prepare(sql);
    return {
      async get(...params) { return stmt.get(...params); },
      async all(...params) { return stmt.all(...params); },
      async run(...params) { return stmt.run(...params); },
    };
  },
  async exec(sql) { return sqlite.exec(sql); },
  // better-sqlite3 NÃO aceita função async dentro de .transaction() — ele exige
  // execução síncrona e aborta com "Transaction function cannot return a promise".
  // Como a interface acima é assíncrona, emulamos a transação com BEGIN/COMMIT.
  async transaction(fn) {
    sqlite.exec('BEGIN');
    try {
      const result = await fn();
      sqlite.exec('COMMIT');
      return result;
    } catch (e) {
      try { sqlite.exec('ROLLBACK'); } catch { /* transação já encerrada */ }
      throw e;
    }
  },
  pragma(...args) { return sqlite.pragma(...args); },
  async close() { return sqlite.close(); },
  raw: sqlite,
};

/* ----------------------------- Settings helpers ----------------------------- */
async function getSetting(key, fallback = null) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
async function setSetting(key, value) {
  await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? '' : String(value));
}
async function getJSONSetting(key, fallback = null) {
  try { const v = await getSetting(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}

module.exports = { db, getSetting, setSetting, getJSONSetting, USE_PG };
