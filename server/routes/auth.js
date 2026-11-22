'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const { signToken, setAuthCookie, clearAuthCookie, requireAuth, rateLimit, planOf } = require('../auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, plan: u.plan,
    plan_expires_at: u.plan_expires_at, created_at: u.created_at,
  };
}

router.post('/register', rateLimit({ windowMs: 60000, max: 10 }), async (req, res) => {
  const { name, email, password, age } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanName.length < 2) return res.status(400).json({ error: 'Informe seu nome completo.' });
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: 'A senha deve conter letras e números.' });

  const exists = await db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (exists) return res.status(409).json({ error: 'Já existe uma conta com este e-mail. Faça login.' });

  const hash = bcrypt.hashSync(String(password), 10);
  const info = await db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?,?,?)").run(cleanName, cleanEmail, hash);
  const n = Number(age);
  if (Number.isFinite(n) && n >= 12 && n <= 100) {
    await db.prepare('INSERT INTO profiles (user_id, age) VALUES (?, ?)').run(info.lastInsertRowid, Math.round(n));
  }
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = signToken(user);
  setAuthCookie(res, token);
  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id);
  res.status(201).json({ user: publicUser(user), profile: profile || null, plan: planOf(user), token });
});

router.post('/login', rateLimit({ windowMs: 60000, max: 12 }), async (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  await db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  const token = signToken(user);
  setAuthCookie(res, token);
  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id);
  // O token também vai no corpo: o cliente usa Authorization: Bearer apenas quando o cookie
  // não pode ser gravado (iframe de terceiros, Safari/ITP). O cookie httpOnly continua sendo o padrão.
  res.json({ user: publicUser(user), profile: profile || null, plan: planOf(user), token });
});

router.post('/logout', async (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  // Endpoint de sessão: visitante recebe 200 com user:null (sem poluir o console do navegador).
  if (!req.user) return res.json({ user: null, profile: null, plan: null });
  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
  res.json({ user: publicUser(req.user), profile: profile || null, plan: planOf(req.user) });
});

/* Solicitação de recuperação - token exibido apenas em dev (sem serviço de e-mail configurado) */
router.post('/forgot-password', rateLimit({ windowMs: 300000, max: 5 }), async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  const generic = { ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos instruções de recuperação.' };
  if (!user) return res.json(generic);
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?,?,?)').run(token, user.id, expires);
  // Em produção, enviar por e-mail (SMTP). Sem serviço configurado, devolvemos o link para o próprio usuário.
  res.json({ ...generic, reset_token: token, reset_url: `/redefinir-senha?token=${token}` });
});

router.post('/reset-password', rateLimit({ windowMs: 300000, max: 10 }), async (req, res) => {
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token inválido.' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
  const row = await db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').get(String(token));
  if (!row) return res.status(400).json({ error: 'Token inválido ou já utilizado.' });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Token expirado. Solicite novamente.' });
  const hash = bcrypt.hashSync(String(password), 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);
  await db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').run(String(token));
  res.json({ ok: true, message: 'Senha redefinida com sucesso. Faça login.' });
});

/* Alterar senha (logado) */
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current_password || ''), user.password_hash)) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  if (!new_password || String(new_password).length < 8) return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' });
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(new_password), 10), user.id);
  res.json({ ok: true, message: 'Senha alterada com sucesso.' });
});

/* Excluir conta (LGPD) */
router.delete('/account', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(400).json({ error: 'Senha incorreta.' });
  }
  await db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  clearAuthCookie(res);
  res.json({ ok: true, message: 'Conta e dados excluídos.' });
});

module.exports = { router, publicUser };
