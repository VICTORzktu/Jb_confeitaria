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

  // Monta o WHERE ignorando uma faceta por vez, para que cada opção de filtro
  // mostre quantos exercícios ela encontraria junto dos demais filtros ativos.
  function buildWhere(skip) {
    const where = ['is_active = 1'];
    const params = [];
    if (q) {
      where.push('(name LIKE ? OR primary_muscle LIKE ? OR equipment LIKE ? OR secondary_muscles LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (muscle && skip !== 'muscle') { where.push('primary_muscle = ?'); params.push(muscle); }
    if (equipment && skip !== 'equipment') { where.push('equipment = ?'); params.push(equipment); }
    if (difficulty && skip !== 'difficulty') { where.push('difficulty = ?'); params.push(difficulty); }
    if (modality && skip !== 'modality') { where.push('modalities LIKE ?'); params.push(`%"${modality}"%`); }
    if (premium === '0') where.push('is_premium = 0');
    return { sql: where.join(' AND '), params };
  }

  const lim = Math.min(300, parseInt(limit || '300', 10) || 300);
  const main = buildWhere(null);
  const rows = await db.prepare(`SELECT * FROM exercises WHERE ${main.sql} ORDER BY primary_muscle, name LIMIT ?`).all(...main.params, lim);

  // Facetas com contagem (cada uma calculada sem o próprio filtro)
  const groups = [
    ['muscles', 'primary_muscle', 'muscle'],
    ['equipments', 'equipment', 'equipment'],
    ['difficulties', 'difficulty', 'difficulty'],
  ];
  const facets = {};
  for (const [key, column, skip] of groups) {
    const w = buildWhere(skip);
    const cnt = await db.prepare(`SELECT ${column} AS v, COUNT(*) AS n FROM exercises WHERE ${w.sql} GROUP BY ${column} ORDER BY ${column}`).all(...w.params);
    facets[key] = cnt.filter((r) => r.v != null && r.v !== '').map((r) => ({ value: r.v, count: Number(r.n) }));
  }
  // modalidades: contagem via LIKE no JSON de modalities
  {
    const w = buildWhere('modality');
    const all = await db.prepare(`SELECT modalities FROM exercises WHERE ${w.sql}`).all(...w.params);
    const counts = new Map();
    for (const r of all) {
      let list = [];
      try { list = JSON.parse(r.modalities || '[]'); } catch { list = []; }
      for (const m of list) counts.set(m, (counts.get(m) || 0) + 1);
    }
    facets.modalities = (await db.prepare('SELECT slug, name FROM modalities WHERE is_active = 1 ORDER BY name').all())
      .map((m) => ({ slug: m.slug, name: m.name, count: counts.get(m.slug) || 0 }));
  }
  // Total de exercícios ativos na biblioteca (número fixo, exibido no chip "Todos").
  // As demais opções de filtro usam contagem global, então "Todos" também precisa ser global.
  const totalAll = (await db.prepare('SELECT COUNT(*) c FROM exercises WHERE is_active = 1').get()).c;

  res.json({
    exercises: rows.map((r) => shape(r, plan)),
    facets,
    plan: { id: plan.id, full_library: plan.full_library },
    total: rows.length,
    total_all: Number(totalAll),
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
