'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { db } = require('./db');
const { JWT_SECRET, JWT_TTL_DAYS, PLANS } = require('./config');

const COOKIE_NAME = 'fitai_token';

function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: `${JWT_TTL_DAYS}d` });
}

function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function getToken(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function cookieOptions(maxAgeDays = JWT_TTL_DAYS) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/* Carrega o usuário em req.user se houver token válido (assíncrono: o banco pode ser Postgres) */
async function attachUser(req, res, next) {
  req.user = null;
  const token = getToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.prepare('SELECT id, name, email, role, plan, plan_expires_at, created_at, last_login_at FROM users WHERE id = ?').get(payload.uid);
    if (user) {
      // Expiração de plano pago -> volta ao gratuito
      if (user.plan !== 'free' && user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) {
        await db.prepare("UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE id = ?").run(user.id);
        user.plan = 'free';
        user.plan_expires_at = null;
      }
      req.user = user;
    }
  } catch { /* token inválido/expirado */ }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Você precisa entrar na sua conta para continuar.', code: 'AUTH_REQUIRED' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.', code: 'AUTH_REQUIRED' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito a administradores.', code: 'FORBIDDEN' });
  next();
}

function planOf(user) {
  return PLANS[user?.plan] || PLANS.free;
}

/* --------------------------- Rate limit simples em memória --------------------------- */
const buckets = new Map();
function rateLimit({ windowMs = 60000, max = 60, keyFn } = {}) {
  return (req, res, next) => {
    const key = (keyFn ? keyFn(req) : req.ip) + ':' + req.path;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now > b.reset) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
    b.count++;
    if (b.count > max) {
      res.set('Retry-After', Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um instante e tente novamente.', code: 'RATE_LIMIT' });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
}, 60000).unref();

/* --------------------------- Cota mensal de IA --------------------------- */
function startOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
}

async function usageThisMonth(userId, feature) {
  const row = await db.prepare(`SELECT COUNT(*) c FROM ai_usage
    WHERE user_id = ? AND feature = ? AND ok = 1 AND created_at >= ?`)
    .get(userId, feature, startOfMonthISO());
  return row.c;
}

async function checkQuota(user, feature) {
  const plan = planOf(user);
  const limits = { workout: plan.generations, chat: plan.chats, substitute: plan.substitutes };
  const limit = limits[feature];
  if (limit == null) return { ok: true, used: 0, limit: null };
  const used = await usageThisMonth(user.id, feature);
  return { ok: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = {
  signToken, setAuthCookie, clearAuthCookie, attachUser, requireAuth, requireAdmin,
  planOf, rateLimit, checkQuota, usageThisMonth, safeEqual, COOKIE_NAME,
};
