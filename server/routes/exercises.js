'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth, planOf } = require('../auth');

const router = express.Router();

function shape(row, plan) {
  const out = {
    ...row,
    secondary_muscles: safeParse(row.secondary_muscles, []),
    modalities: safeParse(row.modalities, []),
    is_premium: !!row.is_premium,
  };
  if (!plan.full_library && out.is_premium) {
    out.locked = true;
    out.instructions = '';
    out.common_errors = '';
    out.tips = '';
  }
  return out;
}
function safeParse(s, def) { try { const v = JSON.parse(s); return v ?? def; } catch { return def; } }

router.get('/', requireAuth, async (req, res) => {
  const { q, muscle, equipment, modality, difficulty, premium, limit } = req.query;
  const plan = planOf(req.user);
  const where = ['is_active = 1'];
  const params = [];
  if (q) { where.push('(name LIKE ? OR primary_muscle LIKE ? OR equipment LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (muscle) { where.push('primary_muscle = ?'); params.push(muscle); }
  if (equipment) { where.push('equipment = ?'); params.push(equipment); }
  if (difficulty) { where.push('difficulty = ?'); params.push(difficulty); }
  if (modality) { where.push('modalities LIKE ?'); params.push(`%"${modality}"%`); }
  if (premium === '0') where.push('is_premium = 0');
  const lim = Math.min(300, parseInt(limit || '300', 10) || 300);
  const rows = await db.prepare(`SELECT * FROM exercises WHERE ${where.join(' AND ')} ORDER BY primary_muscle, name LIMIT ?`).all(...params, lim);
  const muscles = (await db.prepare('SELECT DISTINCT primary_muscle m FROM exercises WHERE is_active = 1 ORDER BY m').all()).map((r) => r.m);
  const equipments = (await db.prepare('SELECT DISTINCT equipment e FROM exercises WHERE is_active = 1 ORDER BY e').all()).map((r) => r.e);
  const modalities = await db.prepare('SELECT slug, name FROM modalities WHERE is_active = 1 ORDER BY name').all();
  res.json({
    exercises: rows.map((r) => shape(r, plan)),
    facets: { muscles, equipments, modalities, difficulties: ['Iniciante', 'Intermediário', 'Avançado'] },
    plan: { id: plan.id, full_library: plan.full_library },
    total: rows.length,
  });
});

router.get('/:id', requireAuth, async (req, res) => {
  const row = await db.prepare('SELECT * FROM exercises WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Exercício não encontrado.' });
  const plan = planOf(req.user);
  const ex = shape(row, plan);
  // histórico pessoal de cargas neste exercício
  const history = await db.prepare(`SELECT MAX(weight_kg) max_weight, MAX(reps) max_reps, COUNT(*) sets,
      (SELECT MAX(date(s2.performed_at)) FROM set_logs l2 JOIN sessions s2 ON s2.id = l2.session_id
        WHERE l2.user_id = ? AND lower(l2.exercise_name) = lower(?)) last_date
    FROM set_logs l JOIN sessions s ON s.id = l.session_id
    WHERE l.user_id = ? AND lower(l.exercise_name) = lower(?)`)
    .get(req.user.id, row.name, req.user.id, row.name);
  res.json({ exercise: ex, history });
});

module.exports = router;
