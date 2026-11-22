'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { todayISO } = require('../time');

const router = express.Router();

const GOALS = ['hipertrofia', 'emagrecimento', 'forca', 'resistencia', 'condicionamento', 'definicao', 'massa', 'desempenho', 'funcional'];
const LEVELS = ['iniciante', 'intermediario', 'avancado'];
const LOCATIONS = ['academia', 'casa', 'ar_livre', 'hotel', 'condominio'];

function normalizeProfile(body) {
  const p = {};
  const age = Number(body.age);
  if (Number.isFinite(age) && age > 0) p.age = Math.min(100, Math.max(12, Math.round(age)));
  if (body.sex && ['M', 'F', 'O'].includes(body.sex)) p.sex = body.sex;
  const h = Number(body.height_cm);
  if (Number.isFinite(h) && h > 0) p.height_cm = Math.min(250, Math.max(100, Math.round(h)));
  const w = Number(body.weight_kg);
  if (Number.isFinite(w) && w > 0) p.weight_kg = Math.min(350, Math.max(25, Math.round(w * 10) / 10));
  if (GOALS.includes(body.goal)) p.goal = body.goal;
  if (LEVELS.includes(body.level)) p.level = body.level;
  const d = Number(body.days_per_week);
  if (Number.isFinite(d) && d > 0) p.days_per_week = Math.min(7, Math.max(1, Math.round(d)));
  const m = Number(body.minutes_per_session);
  if (Number.isFinite(m) && m > 0) p.minutes_per_session = Math.min(150, Math.max(20, Math.round(m)));
  if (LOCATIONS.includes(body.location)) p.location = body.location;
  if (Array.isArray(body.equipment)) p.equipment = JSON.stringify(body.equipment.map(String).slice(0, 20));
  if (Array.isArray(body.focus_muscles)) p.focus_muscles = JSON.stringify(body.focus_muscles.map(String).slice(0, 15));
  if (typeof body.injuries === 'string') p.injuries = body.injuries.slice(0, 800);
  return p;
}

router.get('/', requireAuth, async (req, res) => {
  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
  res.json({ profile: profile || null });
});

router.put('/', requireAuth, async (req, res) => {
  const p = normalizeProfile(req.body || {});
  const existing = await db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(req.user.id);
  const fields = Object.keys(p);
  if (!existing) {
    await db.prepare(`INSERT INTO profiles (user_id, ${fields.join(', ')})
      VALUES (?, ${fields.map(() => '?').join(', ')})`).run(req.user.id, ...fields.map((f) => p[f]));
  } else if (fields.length) {
    await db.prepare(`UPDATE profiles SET ${fields.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE user_id = ?`)
      .run(...fields.map((f) => p[f]), req.user.id);
  }
  // Registro de peso automático no histórico ao atualizar peso no perfil
  if (p.weight_kg) {
    const today = todayISO();
    await db.prepare(`INSERT INTO weight_logs (user_id, date, weight_kg) VALUES (?,?,?)
      ON CONFLICT(user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg`).run(req.user.id, today, p.weight_kg);
  }
  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
  res.json({ profile, message: 'Perfil atualizado com sucesso.' });
});

router.put('/account', requireAuth, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Nome inválido.' });
  await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  const user = await db.prepare('SELECT id, name, email, role, plan, plan_expires_at, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ user, message: 'Dados atualizados.' });
});

/* -------- Peso corporal -------- */
router.get('/weight', requireAuth, async (req, res) => {
  const rows = await db.prepare('SELECT date, weight_kg, note FROM weight_logs WHERE user_id = ? ORDER BY date ASC').all(req.user.id);
  res.json({ entries: rows });
});
router.post('/weight', requireAuth, async (req, res) => {
  const w = Number(req.body?.weight_kg);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date || '') ? req.body.date : todayISO();
  if (!Number.isFinite(w) || w < 25 || w > 350) return res.status(400).json({ error: 'Peso inválido.' });
  await db.prepare(`INSERT INTO weight_logs (user_id, date, weight_kg, note) VALUES (?,?,?,?)
    ON CONFLICT(user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg, note = excluded.note`)
    .run(req.user.id, date, Math.round(w * 10) / 10, String(req.body?.note || '').slice(0, 200) || null);
  await db.prepare('UPDATE profiles SET weight_kg = ? WHERE user_id = ?').run(Math.round(w * 10) / 10, req.user.id);
  res.json({ ok: true, message: 'Peso registrado.' });
});
router.delete('/weight/:date', requireAuth, async (req, res) => {
  await db.prepare('DELETE FROM weight_logs WHERE user_id = ? AND date = ?').run(req.user.id, req.params.date);
  res.json({ ok: true });
});

/* -------- Metas -------- */
router.get('/goals', requireAuth, async (req, res) => {
  const goals = await db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 0 END, created_at DESC").all(req.user.id);
  res.json({ goals });
});
router.post('/goals', requireAuth, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (title.length < 2) return res.status(400).json({ error: 'Informe o título da meta.' });
  const target = Number(req.body?.target);
  const current = Number(req.body?.current);
  const info = await db.prepare('INSERT INTO goals (user_id, title, metric, target, current, unit, deadline) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, title.slice(0, 120), String(req.body?.metric || 'custom').slice(0, 30),
      Number.isFinite(target) ? target : null, Number.isFinite(current) ? current : 0,
      String(req.body?.unit || '').slice(0, 12),
      /^\d{4}-\d{2}-\d{2}$/.test(req.body?.deadline || '') ? req.body.deadline : null);
  const goal = await db.prepare('SELECT * FROM goals WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ goal, message: 'Meta criada.' });
});
router.patch('/goals/:id', requireAuth, async (req, res) => {
  const goal = await db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Meta não encontrada.' });
  const current = Number(req.body?.current);
  const status = ['active', 'completed', 'archived'].includes(req.body?.status) ? req.body.status : goal.status;
  await db.prepare('UPDATE goals SET current = ?, status = ? WHERE id = ?')
    .run(Number.isFinite(current) ? current : goal.current, status, goal.id);
  res.json({ goal: await db.prepare('SELECT * FROM goals WHERE id = ?').get(goal.id), message: 'Meta atualizada.' });
});
router.delete('/goals/:id', requireAuth, async (req, res) => {
  await db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
