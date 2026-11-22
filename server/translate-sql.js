'use strict';
/* Tradução de SQL escrita para SQLite → PostgreSQL.
   Cobre apenas os construtos que o FitAI realmente usa (verificado por varredura no código):
   placeholders ?, lastInsertRowid, datetime('now'), strftime, COLLATE NOCASE, INSERT OR IGNORE. */

const MAX_DEPTH = 6;

/** Constrói a expressão de lista de colunas a partir de PRAGMA/table_info. */
function insertReturning(sql) {
  return /^\s*INSERT\s/i.test(sql) && !/\bRETURNING\b/i.test(sql);
}

function translate(sql) {
  let out = sql;

  // COLLATE NOCASE
  out = out.replace(/\s+COLLATE\s+NOCASE/gi, '');

  // datetime('now') → (now() at time zone 'utc')
  out = out.replace(/datetime\(\s*'now'\s*\)/gi, "(now() at time zone 'utc')");
  // datetime('now','-14 days') → (now() at time zone 'utc') - interval '14 days'
  out = out.replace(/datetime\(\s*'now'\s*,\s*'([+-]?)(\d+)\s+days?'\s*\)/gi,
    (_, sign, n) => `((now() at time zone 'utc') ${sign === '-' ? '-' : '+'} interval '${n} days')`);

  // strftime('%Y-%m', x) → to_char(x, 'YYYY-MM');  date(x) → (x)::date
  out = out.replace(/strftime\(\s*'%Y-%m'\s*,\s*([^)]+)\)/gi, "to_char(($1)::timestamp, 'YYYY-MM')");
  out = out.replace(/(?<![\w.])date\(\s*([^)]*?)\s*\)/gi, '(($1)::timestamp)::date');

  // INSERT OR IGNORE INTO x (...) VALUES (...) → INSERT INTO x (...) VALUES (...) ON CONFLICT DO NOTHING
  const hadIgnore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(out);
  out = out.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
  if (hadIgnore && !/ON\s+CONFLICT/i.test(out)) {
    out = out.replace(/;\s*$/, '') + ' ON CONFLICT DO NOTHING' + (/;\s*$/.test(out) ? ';' : '');
  }

  // LIKE → ILIKE: no SQLite LIKE ignora caixa por padrão; no Postgres não.
  // Mantém o comportamento original (busca "supino" encontra "Supino reto").
  out = out.replace(/\bNOT\s+LIKE\b/gi, 'NOT ILIKE');
  out = out.replace(/(?<!I)\bLIKE\b/gi, 'ILIKE');

  // GROUP_CONCAT(a, b) → string_agg(a, b)
  out = out.replace(/GROUP_CONCAT\(([^,]+),\s*([^)]+)\)/gi, 'string_agg($1, $2)');

  return out;
}

/** Converte um ? em $n respeitando strings e identificadores entre aspas. */
function toNumberedParams(sql) {
  let n = 0;
  let out = '';
  let i = 0;
  let quote = null;
  while (i < sql.length) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote) {
        if (sql[i + 1] === quote) { out += sql[i + 1]; i += 2; continue; }
        quote = null;
      }
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; out += ch; i++; continue; }
    if (ch === '?') { out += '$' + (++n); i++; continue; }
    out += ch;
    i++;
  }
  return out;
}

module.exports = { translate, toNumberedParams, insertReturning, MAX_DEPTH };
