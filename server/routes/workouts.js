'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth, planOf, checkQuota, rateLimit } = require('../auth');
const { getAIConfig } = require('../ai');
const { chatJSON, AIError } = require('../ai');
const prompts = require('../prompts');
const { scheduleSlots, todayWorkout, nextWorkout } = require('../schedule');
const { slugify } = require('../seed');
const { todayISO } = require('../time');

const router = express.Router();

function parsePlan(row) {
  if (!row) return null;
  let plan_json = {};
  try { plan_json = JSON.parse(row.plan_json); } catch { plan_json = {}; }
  return { ...row, plan_json };
}

function summaryOfPlan(plan) {
  if (!plan?.weekly_schedule) return '';
  return plan.weekly_schedule.map((d) => `${d.title}: ` + d.exercises.map((e) => `${e.name} ${e.sets}x${e.reps}`).join('; ')).join('\n');
}

router.get('/', requireAuth, async (req, res) => {
  const rows = await db.prepare('SELECT id, name, goal, level, modality, split, days_per_week, minutes, provider, model, status, created_at FROM workouts WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ workouts: rows });
});

router.get('/active', requireAuth, async (req, res) => {
  const row = await db.prepare("SELECT * FROM workouts WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(req.user.id);
  if (!row) return res.json({ workout: null });
  const workout = parsePlan(row);
  res.json({
    workout: { ...workout, slots: scheduleSlots(workout.plan_json.weekly_schedule || []) },
    today: todayWorkout(workout.plan_json),
    next: nextWorkout(workout.plan_json),
  });
});

router.get('/:id', requireAuth, async (req, res) => {
  const row = await db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Treino não encontrado.' });
  const workout = parsePlan(row);
  res.json({
    workout: { ...workout, slots: scheduleSlots(workout.plan_json.weekly_schedule || []) },
    today: todayWorkout(workout.plan_json),
    next: nextWorkout(workout.plan_json),
  });
});

/* ------------------------------- Geração com IA real ------------------------------- */
router.post('/generate', requireAuth, rateLimit({ windowMs: 60000, max: 6 }), async (req, res) => {
  const cfg = await getAIConfig();
  if (!cfg.provider || !cfg.apiKey) {
    return res.status(503).json({
      error: 'A IA ainda não está configurada. Peça a um administrador para configurar o provedor e a chave no Painel Admin > Integração com IA.',
      code: 'AI_NOT_CONFIGURED',
    });
  }
  const quota = await checkQuota(req.user, 'workout');
  if (!quota.ok) {
    return res.status(402).json({
      error: `Você atingiu o limite de ${quota.limit} treinos gerados por mês no plano ${planOf(req.user).name}. Faça upgrade para continuar.`,
      code: 'QUOTA_EXCEEDED', upgrade: true, quota,
    });
  }

  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) return res.status(400).json({ error: 'Complete seu perfil antes de gerar um treino.', code: 'PROFILE_REQUIRED' });
  const required = ['goal', 'level', 'days_per_week', 'minutes_per_session'];
  const missing = required.filter((k) => !profile[k]);
  if (missing.length) return res.status(400).json({ error: 'Complete seu perfil: objetivo, nível, dias e tempo por treino são obrigatórios.', code: 'PROFILE_INCOMPLETE', missing });

  const modality = String(req.body?.modality || 'musculacao');
  const notes = String(req.body?.notes || '').slice(0, 500);
  const current = await db.prepare("SELECT * FROM workouts WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(req.user.id);

  const { system, user } = prompts.buildWorkoutPrompt(profile, {
    modality, notes,
    previousPlanSummary: current ? summaryOfPlan(parsePlan(current).plan_json).slice(0, 2500) : '',
    regenerateNotes: notes,
  });

  try {
    const raw = await chatJSON({ system, user, maxTokens: 8192, feature: 'workout', userId: req.user.id });
    const plan = prompts.applyGuardrails(raw, profile);

    const name = plan.split_name || `Programa ${prompts.GOAL_LABELS[profile.goal] || ''}`.trim();
    await db.prepare("UPDATE workouts SET status = 'archived' WHERE user_id = ? AND status = 'active'").run(req.user.id);
    const info = await db.prepare(`INSERT INTO workouts (user_id, name, goal, level, modality, split, days_per_week, minutes, plan_json, provider, model, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?, 'active')`).run(
      req.user.id, name.slice(0, 120), profile.goal, profile.level, modality, plan.split_name || '',
      plan.weekly_schedule.length, profile.minutes_per_session, JSON.stringify(plan), cfg.provider, cfg.model
    );
    const row = await db.prepare('SELECT * FROM workouts WHERE id = ?').get(info.lastInsertRowid);
    const workout = parsePlan(row);
    res.status(201).json({
      workout: { ...workout, slots: scheduleSlots(workout.plan_json.weekly_schedule) },
      today: todayWorkout(workout.plan_json),
      next: nextWorkout(workout.plan_json),
      quota: await checkQuota(req.user, 'workout'),
      message: 'Treino gerado com sucesso.',
    });
  } catch (e) {
    if (e instanceof AIError) return res.status(502).json({ error: e.message, code: e.code || 'AI_ERROR' });
    return res.status(500).json({ error: 'Não foi possível gerar o treino: ' + e.message });
  }
});

router.post('/:id/activate', requireAuth, async (req, res) => {
  const row = await db.prepare('SELECT id FROM workouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Treino não encontrado.' });
  await db.prepare("UPDATE workouts SET status = 'archived' WHERE user_id = ?").run(req.user.id);
  await db.prepare("UPDATE workouts SET status = 'active' WHERE id = ?").run(row.id);
  res.json({ ok: true, message: 'Treino ativado.' });
});

router.patch('/:id', requireAuth, async (req, res) => {
  const row = await db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Treino não encontrado.' });
  const name = String(req.body?.name || '').trim();
  if (name.length >= 2) await db.prepare('UPDATE workouts SET name = ? WHERE id = ?').run(name.slice(0, 120), row.id);
  res.json({ ok: true, message: 'Treino atualizado.' });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true, message: 'Treino excluído.' });
});

/* ------------------------------- Substituição de exercício ------------------------------- */
router.post('/:id/substitute', requireAuth, rateLimit({ windowMs: 60000, max: 12 }), async (req, res) => {
  const row = await db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Treino não encontrado.' });
  const quota = await checkQuota(req.user, 'substitute');
  if (!quota.ok) return res.status(402).json({ error: `Limite de substituições do plano ${planOf(req.user).name} atingido neste mês.`, code: 'QUOTA_EXCEEDED', upgrade: true, quota });
  const cfg = await getAIConfig();
  if (!cfg.provider || !cfg.apiKey) return res.status(503).json({ error: 'A IA não está configurada no servidor.', code: 'AI_NOT_CONFIGURED' });

  const { day_index, ex_index, reason } = req.body || {};
  const workout = parsePlan(row);
  const day = workout.plan_json.weekly_schedule?.[day_index];
  const ex = day?.exercises?.[ex_index];
  if (!ex) return res.status(400).json({ error: 'Exercício não encontrado no treino.' });

  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
  const { system, user } = prompts.buildSubstitutionPrompt(ex, String(reason || '').slice(0, 300), profile, workout.plan_json.split_name);

  try {
    const data = await chatJSON({ system, user, maxTokens: 1200, feature: 'substitute', userId: req.user.id });
    // aplica guardrails no substituto
    const fake = { weekly_schedule: [{ day: day.day, title: day.title, exercises: [{ ...data, name: data.name }] }], notices: [], safety_notes: [] };
    prompts.applyGuardrails(fake, profile);
    const safeEx = fake.weekly_schedule[0]?.exercises[0];
    if (!safeEx) {
      return res.status(422).json({ error: 'A alternativa sugerida não é compatível com suas limitações. Tente outro motivo ou consulte um profissional.' });
    }
    safeEx.why = data.why || safeEx.why;
    safeEx.how = data.how || safeEx.how;
    workout.plan_json.weekly_schedule[day_index].exercises[ex_index] = safeEx;
    await db.prepare('UPDATE workouts SET plan_json = ? WHERE id = ?').run(JSON.stringify(workout.plan_json), row.id);
    res.json({
      exercise: safeEx,
      replaced: ex.name,
      explanation: data.explanation || data.why || '',
      quota: await checkQuota(req.user, 'substitute'),
      message: `${ex.name} substituído com sucesso.`,
    });
  } catch (e) {
    if (e instanceof AIError) return res.status(502).json({ error: e.message, code: e.code || 'AI_ERROR' });
    return res.status(500).json({ error: 'Falha ao substituir exercício: ' + e.message });
  }
});

/* ------------------------------- Progressão inteligente ------------------------------- */
router.get('/:id/progress-data', requireAuth, async (req, res) => {
  const row = await db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Treino não encontrado.' });
  const workout = parsePlan(row);
  const since = todayISO(new Date(Date.now() - 28 * 864e5));
  const sessions = await db.prepare(`SELECT s.id, s.performed_at, s.name, s.duration_min, s.effort,
      COUNT(l.id) sets, SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END) completed_sets
    FROM sessions s LEFT JOIN set_logs l ON l.session_id = s.id
    WHERE s.user_id = ? AND s.performed_at >= ? GROUP BY s.id ORDER BY s.performed_at DESC`).all(req.user.id, since);
  const loadRows = await db.prepare(`SELECT exercise_name, MAX(weight_kg) max_weight, MAX(reps) max_reps, COUNT(*) sets
    FROM set_logs WHERE user_id = ? GROUP BY exercise_name ORDER BY sets DESC LIMIT 12`).all(req.user.id);
  res.json({ workout: { id: workout.id, name: workout.name, analysis: workout.plan_json.progression_analysis || null }, sessions, loads: loadRows });
});

router.post('/:id/progress', requireAuth, rateLimit({ windowMs: 60000, max: 6 }), async (req, res) => {
  const config = planOf(req.user);
  if (!config.progression_ai) {
    return res.status(402).json({ error: 'A análise inteligente de progressão está disponível nos planos Pro e Premium.', code: 'UPGRADE_REQUIRED', upgrade: true });
  }
  const row = await db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Treino não encontrado.' });
  const cfg = await getAIConfig();
  if (!cfg.provider || !cfg.apiKey) return res.status(503).json({ error: 'A IA não está configurada no servidor.', code: 'AI_NOT_CONFIGURED' });

  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
  const since = new Date(Date.now() - 28 * 864e5).toISOString();
  const sessions = await db.prepare(`SELECT performed_at, name, duration_min, effort FROM sessions WHERE user_id = ? AND performed_at >= ? ORDER BY performed_at DESC`).all(req.user.id, since);
  const loads = await db.prepare(`SELECT exercise_name, MAX(weight_kg) max_weight, MAX(reps) max_reps, AVG(weight_kg) avg_weight, COUNT(*) sets
    FROM set_logs WHERE user_id = ? GROUP BY exercise_name ORDER BY sets DESC LIMIT 15`).all(req.user.id);
  const weights = await db.prepare('SELECT date, weight_kg FROM weight_logs WHERE user_id = ? ORDER BY date DESC LIMIT 10').all(req.user.id);
  const stats = { sessions_28d: sessions.length, sessions, loads, weight_logs: weights };

  const workout = parsePlan(row);
  const { system, user } = prompts.buildProgressionPrompt(profile, workout, stats);
  try {
    const analysis = await chatJSON({ system, user, maxTokens: 2000, feature: 'progression', userId: req.user.id });
    analysis.generated_at = new Date().toISOString();
    workout.plan_json.progression_analysis = analysis;
    await db.prepare('UPDATE workouts SET plan_json = ? WHERE id = ?').run(JSON.stringify(workout.plan_json), row.id);
    res.json({ analysis, message: 'Análise de progressão gerada.' });
  } catch (e) {
    if (e instanceof AIError) return res.status(502).json({ error: e.message, code: e.code || 'AI_ERROR' });
    return res.status(500).json({ error: 'Falha na análise: ' + e.message });
  }
});

module.exports = { router, parsePlan, summaryOfPlan };
