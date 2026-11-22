'use strict';
/* Driver PostgreSQL com a mesma API do better-sqlite3 usada no projeto.
   Objetivo: trocar o banco sem reescrever as rotas.

   Diferença estrutural: better-sqlite3 é síncrono, o driver pg é assíncrono.
   Aqui os métodos expostos (.get/.all/.run) são assíncronos — por isso as rotas
   passaram a usar `await` (ver README, seção "Banco de dados"). */

const { Pool, types } = require('pg');
const { translate, toNumberedParams } = require('./translate-sql');

// COUNT(*) volta como string no pg por padrão (bigint). O app espera número.
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  family: 4,
});

pool.on('error', (err) => console.error('[pg] erro no pool:', err.message));

function normalizeParams(params) {
  return params.map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  });
}


/* ------------------------------ Schema (Postgres) ------------------------------
   Equivalente ao DDL do db.js (SQLite), com tipos nativos do Postgres:
   - SERIAL no lugar de AUTOINCREMENT
   - TIMESTAMP nas colunas de data/hora (permite comparação e ORDER BY corretos)
   - índice único em lower(email) para manter a semântica de COLLATE NOCASE
   Executado uma vez na inicialização; é idempotente (IF NOT EXISTS). */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc'),
  last_login_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER, sex TEXT, height_cm INTEGER, weight_kg DOUBLE PRECISION,
  goal TEXT, level TEXT, days_per_week INTEGER, minutes_per_session INTEGER, location TEXT,
  equipment TEXT NOT NULL DEFAULT '[]',
  focus_muscles TEXT NOT NULL DEFAULT '[]',
  injuries TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS weight_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL, weight_kg DOUBLE PRECISION NOT NULL, note TEXT,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, metric TEXT NOT NULL DEFAULT 'custom',
  target DOUBLE PRECISION, current DOUBLE PRECISION DEFAULT 0, unit TEXT DEFAULT '',
  deadline DATE, status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, goal TEXT, level TEXT, modality TEXT, split TEXT,
  days_per_week INTEGER, minutes INTEGER,
  plan_json TEXT NOT NULL, provider TEXT, model TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  day_key TEXT, name TEXT,
  performed_at TIMESTAMP NOT NULL,
  duration_min INTEGER, effort INTEGER, notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS set_logs (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL, exercise_id INTEGER, set_number INTEGER,
  reps INTEGER, weight_kg DOUBLE PRECISION,
  completed INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, slug TEXT UNIQUE, primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL DEFAULT '', modalities TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL DEFAULT 'Iniciante',
  instructions TEXT NOT NULL DEFAULT '', common_errors TEXT NOT NULL DEFAULT '',
  tips TEXT NOT NULL DEFAULT '', video_url TEXT, image_key TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS modalities (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT 'dumbbell',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  feature TEXT NOT NULL, provider TEXT, model TEXT,
  ok INTEGER NOT NULL DEFAULT 1, error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT );

CREATE TABLE IF NOT EXISTS payment_intents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL, amount_cents INTEGER NOT NULL, method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', provider TEXT, pix_payload TEXT,
  ref TEXT UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc'),
  paid_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL, used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE TABLE IF NOT EXISTS content (
  id SERIAL PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'artigo', is_published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT (now() at time zone 'utc')
);

CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_setlogs_user    ON set_logs(user_id, exercise_name);
CREATE INDEX IF NOT EXISTS idx_chat_user       ON chat_messages(user_id, id);
CREATE INDEX IF NOT EXISTS idx_ai_usage        ON ai_usage(user_id, feature, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_user    ON payment_intents(user_id, status);
`;

let _schemaReady = null;
/** Garante o schema (idempotente) antes da primeira consulta. */
function ensureSchema() {
  if (!_schemaReady) _schemaReady = pool.query(SCHEMA_SQL).catch((e) => {
    _schemaReady = null;
    throw e;
  });
  return _schemaReady;
}

const RETURNING = ' RETURNING *';

function prepare(rawSql) {
  let sql = translate(rawSql).trim().replace(/;+\s*$/, ''); // sem ';' final (RETURNING precisa vir antes)
  const isInsert = /^\s*INSERT\s/i.test(sql);
  // INSERT sem RETURNING: precisamos do id (lastInsertRowid) → adiciona RETURNING
  const base = (isInsert && !/\bRETURNING\b/i.test(sql)) ? sql + RETURNING : sql;

  async function exec(params = []) {
    await ensureSchema();
    let sql = toNumberedParams(base);
    let vals = normalizeParams(params);
    try {
      return await pool.query(sql, vals);
    } catch (err) {
      // Retry para "column x is of type integer but expression is of type text"
      // Não aplicável de forma genérica; apenas garante que o erro sobe com contexto.
      err.sql = sql;
      throw err;
    }
  }

  return {
    /** Retorna a primeira linha ou undefined. */
    async get(...params) {
      const r = await exec(params);
      return r.rows[0];
    },
    /** Retorna todas as linhas. */
    async all(...params) {
      const r = await exec(params);
      return r.rows;
    },
    /** Executa e devolve { changes, lastInsertRowid } (compatível com better-sqlite3). */
    async run(...params) {
      const r = await exec(params);
      return {
        changes: r.rowCount,
        lastInsertRowid: r.rows[0] ? r.rows[0].id : undefined,
      };
    },
  };
}

/** Executa múltiplos statements (DDL). */
async function exec(sql) {
  return pool.query(sql);
}

/** Transação. Assinatura idêntica à do driver SQLite (db.js):
    recebe a função e devolve o resultado — o chamador NÃO chama tx() depois. */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn();
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

const db = {
  prepare,
  exec,
  transaction,
  /** Compatibilidade com db.pragma() do SQLite (no-op no Postgres). */
  pragma() { return undefined; },
  async close() { await pool.end(); },
  pool,
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
  try {
    const v = await getSetting(key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

module.exports = { db, pool, getSetting, setSetting, getJSONSetting, ensureSchema };
