'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const { todayISO } = require('../time');

const router = express.Router();

/* Registra um treino concluído com séries (peso/reps por exercício) */
router.post('/', requireAuth, async (req, res) => {
  const { workout_id, day_key, name, performed_at, duration_min, effort, notes, sets } = req.body || {};
  const cleanName = String(name || 'Treino').slice(0, 160);
  const dateStr = /^\d{4}-\d{2}-\d{2}/.test(performed_at || '') ? performed_at : todayISO() + ' 12:00:00';
  if (workout_id) {
    const owns = await db.prepare('SELECT id FROM workouts WHERE id = ? AND user_id = ?').get(workout_id, req.user.id);
    if (!owns) return res.status(403).json({ error: 'Treino inválido.' });
  }
  const dur = Number(duration_min);
  const eff = Number(effort);
  const info = await db.prepare(`INSERT INTO sessions (user_id, workout_id, day_key, name, performed_at, duration_min, effort, notes)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    req.user.id, workout_id || null, String(day_key || '').slice(0, 10) || null, cleanName, dateStr,
    Number.isFinite(dur) ? Math.min(300, Math.max(1, Math.round(dur))) : null,
    Number.isFinite(eff) ? Math.min(10, Math.max(1, Math.round(eff))) : null,
    String(notes || '').slice(0, 800) || null
  );
  const insSet = db.prepare(`INSERT INTO set_logs (session_id, user_id, exercise_name, exercise_id, set_number, reps, weight_kg, completed)
    VALUES (?,?,?,?,?,?,?,?)`);
  if (Array.isArray(sets)) {
    await db.transaction(async () => {
      for (const s of sets.slice(0, 120)) {
        if (!s || !s.exercise_name) continue;
        const reps = Number(s.reps); const w = Number(s.weight_kg);
        await insSet.run(info.lastInsertRowid, req.user.id, String(s.exercise_name).slice(0, 120), s.exercise_id || null,
          Number.isFinite(Number(s.set_number)) ? Math.round(Number(s.set_number)) : 1,
          Number.isFinite(reps) ? Math.min(200, Math.max(0, Math.round(reps))) : null,
          Number.isFinite(w) ? Math.min(500, Math.max(0, Math.round(w * 2) / 2)) : null,
          s.completed === false ? 0 : 1);
      }
    });
  }
  res.status(201).json({ ok: true, id: info.lastInsertRowid, message: 'Treino registrado. Bom trabalho!' });
});

router.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit || '50', 10) || 50);
  const rows = await db.prepare(`SELECT s.*, w.name workout_name,
      (SELECT COUNT(*) FROM set_logs l WHERE l.session_id = s.id) sets,
      (SELECT COALESCE(SUM(l.reps * COALESCE(l.weight_kg,0)),0) FROM set_logs l WHERE l.session_id = s.id) volume
    FROM sessions s LEFT JOIN workouts w ON w.id = s.workout_id
    WHERE s.user_id = ? ORDER BY s.performed_at DESC LIMIT ?`).all(req.user.id, limit);
  res.json({ sessions: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const s = await db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: 'Sessão não encontrada.' });
  const sets = await db.prepare('SELECT * FROM set_logs WHERE session_id = ? ORDER BY exercise_name, set_number').all(s.id);
  res.json({ session: s, sets });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
