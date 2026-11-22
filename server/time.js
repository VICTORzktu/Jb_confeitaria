'use strict';
/* Utilidades de data/hora no fuso local (America/Sao_Paulo por padrão) */

const TZ = process.env.APP_TZ || 'America/Sao_Paulo';

function parts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
  const out = { year: 0, month: 0, day: 0, weekday: 0 };
  for (const p of fmt.formatToParts(date)) {
    if (p.type === 'year') out.year = Number(p.value);
    if (p.type === 'month') out.month = Number(p.value);
    if (p.type === 'day') out.day = Number(p.value);
    if (p.type === 'weekday') {
      const wd = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6 }[p.value.toLowerCase().replace('.', '')];
      out.weekday = wd == null ? 0 : wd;
    }
  }
  return out;
}

/* "YYYY-MM-DD" local */
function todayISO(date = new Date()) {
  const p = parts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/* dia da semana local (0=domingo) */
function weekday(date = new Date()) {
  return parts(date).weekday;
}

function nowLocalString() {
  return todayISO() + ' ' + new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour12: false });
}

module.exports = { TZ, todayISO, weekday, nowLocalString, parts };
