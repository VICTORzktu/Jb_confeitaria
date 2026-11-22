'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth, planOf, usageThisMonth } = require('../auth');
const { getAIConfig, isConfigured } = require('../ai');
const { scheduleSlots, todayWorkout, nextWorkout, WEEKDAY_NAMES } = require('../schedule');
const { parsePlan } = require('./workouts');
const { todayISO, weekday: localWeekday } = require('../time');

const router = express.Router();

function isoDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return todayISO(d);
}

router.get('/', requireAuth, async (req, res) => {
  const uid = req.user.id;
  const plan = planOf(req.user);

  const workoutRow = await db.prepare("SELECT * FROM workouts WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(uid);
  const workout = workoutRow ? parsePlan(workoutRow) : null;
  const today = workout ? todayWorkout(workout.plan_json) : null;
  const next = workout ? nextWorkout(workout.plan_json) : null;
  const slots = workout ? scheduleSlots(workout.plan_json.weekly_schedule || []) : [];

  const totalSessions = (await db.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id = ?').get(uid)).c;
  const sessions7 = (await db.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id = ? AND performed_at >= ?').get(uid, isoDaysAgo(7))).c;
  const sessions28 = (await db.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id = ? AND performed_at >= ?').get(uid, isoDaysAgo(28))).c;
  const volume28 = (await db.prepare(`SELECT COALESCE(SUM(l.reps * COALESCE(l.weight_kg,0)),0) v FROM set_logs l
    JOIN sessions s ON s.id = l.session_id WHERE s.user_id = ? AND s.performed_at >= ?`).get(uid, isoDaysAgo(28))).v;
  const duration28 = (await db.prepare('SELECT COALESCE(AVG(duration_min),0) d FROM sessions WHERE user_id = ? AND performed_at >= ? AND duration_min IS NOT NULL').get(uid, isoDaysAgo(28))).d;

  const recent = await db.prepare(`SELECT s.id, s.name, s.performed_at, s.duration_min, s.effort,
      (SELECT COUNT(*) FROM set_logs l WHERE l.session_id = s.id) sets,
      (SELECT COALESCE(SUM(l.reps * COALESCE(l.weight_kg,0)),0) FROM set_logs l WHERE l.session_id = s.id) volume
    FROM sessions s WHERE s.user_id = ? ORDER BY s.performed_at DESC LIMIT 8`).all(uid);

  const weights = await db.prepare('SELECT date, weight_kg FROM weight_logs WHERE user_id = ? ORDER BY date ASC LIMIT 120').all(uid);
  const goals = await db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 0 END, created_at DESC LIMIT 8").all(uid);

  // frequência nas últimas 8 semanas
  const freq = [];
  for (let w = 7; w >= 0; w--) {
    const start = isoDaysAgo(w * 7 + 6);
    const end = isoDaysAgo(w * 7);
    const c = (await db.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id = ? AND date(performed_at) BETWEEN ? AND ?').get(uid, start, end)).c;
    freq.push({ week_start: start, week_end: end, sessions: c });
  }

  // evolução de cargas (top exercícios)
  const loads = await db.prepare(`SELECT l.exercise_name, MAX(l.weight_kg) max_weight, COUNT(*) sets, MAX(date(s.performed_at)) last_date
    FROM set_logs l JOIN sessions s ON s.id = l.session_id
    WHERE l.user_id = ? AND l.weight_kg > 0 GROUP BY l.exercise_name ORDER BY sets DESC LIMIT 6`).all(uid);
  const loadSeries = {};
  for (const l of loads) {
    loadSeries[l.exercise_name] = await db.prepare(`SELECT date(s.performed_at) date, MAX(l.weight_kg) weight
      FROM set_logs l JOIN sessions s ON s.id = l.session_id
      WHERE l.user_id = ? AND l.exercise_name = ? AND l.weight_kg > 0 GROUP BY date(s.performed_at) ORDER BY date ASC LIMIT 40`)
      .all(uid, l.exercise_name);
  }

  // adesão: % de treinos realizados vs. dias planejados nas últimas 4 semanas
  const planned = (workout?.days_per_week || 0) * 4;
  const adherence = planned > 0 ? Math.min(100, Math.round((sessions28 / planned) * 100)) : null;

  res.json({
    user: { name: req.user.name, plan: req.user.plan, plan_name: plan.name },
    workout: workout ? { id: workout.id, name: workout.name, split: workout.split, days_per_week: workout.days_per_week, created_at: workout.created_at, summary: workout.plan_json.summary } : null,
    slots, today, next,
    stats: {
      total_sessions: totalSessions,
      sessions_7d: sessions7,
      sessions_28d: sessions28,
      volume_28d: Math.round(volume28),
      avg_duration_28d: Math.round(duration28),
      adherence,
      streak_weeks: freq.filter((f) => f.sessions > 0).length,
    },
    recent, weights, goals, freq, loads, load_series: loadSeries,
    weekly: buildWeeklyGrid(workout, recent),
    quota: {
      workouts: { used: await usageThisMonth(uid, 'workout'), limit: plan.generations },
      chats: { used: await usageThisMonth(uid, 'chat'), limit: plan.chats },
    },
    ai_configured: isConfigured(await getAIConfig()),
  });
});

function buildWeeklyGrid(workout, recent) {
  // grade da semana atual: cada dia com treino planejado e se foi concluído
  const slots = workout ? scheduleSlots(workout.plan_json.weekly_schedule || []) : [];
  const todayWd = localWeekday();
  const monday = new Date();
  monday.setDate(monday.getDate() - ((todayWd + 6) % 7));
  const doneDays = new Set();
  for (const r of recent) {
    const d = String(r.performed_at).slice(0, 10);
    const dt = new Date(d + 'T12:00:00');
    if (dt >= monday) doneDays.add(dt.getDay());
  }
  const grid = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday); dt.setDate(monday.getDate() + i);
    const wd = dt.getDay();
    const slot = slots.find((s) => s.weekday_index === wd);
    grid.push({
      date: todayISO(dt),
      weekday: WEEKDAY_NAMES[wd],
      is_today: wd === todayWd,
      planned: slot ? (slot.workout?.title || null) : null,
      day_key: slot ? slot.day : null,
      done: doneDays.has(wd),
      is_past: dt < new Date(new Date().toDateString()),
    });
  }
  return grid;
}

/* Relatório detalhado (Pro/Premium) */
router.get('/report', requireAuth, async (req, res) => {
  const plan = planOf(req.user);
  if (!plan.reports) return res.status(402).json({ error: 'Relatórios detalhados estão disponíveis nos planos Pro e Premium.', code: 'UPGRADE_REQUIRED', upgrade: true });
  const uid = req.user.id;
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = await db.prepare(`SELECT COUNT(*) sessions, COALESCE(AVG(duration_min),0) avg_duration, COALESCE(AVG(effort),0) avg_effort
      FROM sessions WHERE user_id = ? AND strftime('%Y-%m', performed_at) = ?`).get(uid, key);
    const vol = (await db.prepare(`SELECT COALESCE(SUM(l.reps * COALESCE(l.weight_kg,0)),0) volume FROM set_logs l
      JOIN sessions s ON s.id = l.session_id WHERE s.user_id = ? AND strftime('%Y-%m', s.performed_at) = ?`).get(uid, key)).volume;
    months.push({ month: key, ...row, avg_duration: Math.round(row.avg_duration), avg_effort: Math.round(row.avg_effort * 10) / 10, volume: Math.round(vol) });
  }
  const muscle = await db.prepare(`SELECT e.primary_muscle muscle, COUNT(*) sets, COALESCE(SUM(l.reps * COALESCE(l.weight_kg,0)),0) volume
    FROM set_logs l LEFT JOIN exercises e ON lower(e.name) = lower(l.exercise_name)
    WHERE l.user_id = ? GROUP BY e.primary_muscle ORDER BY sets DESC`).all(uid);
  const prs = await db.prepare(`SELECT l.exercise_name, MAX(l.weight_kg) max_weight, MAX(l.reps) max_reps
    FROM set_logs l WHERE l.user_id = ? AND l.weight_kg > 0 GROUP BY l.exercise_name ORDER BY max_weight DESC LIMIT 12`).all(uid);
  res.json({ months, muscle, prs });
});

module.exports = router;
