'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth, planOf, checkQuota, rateLimit } = require('../auth');
const { getAIConfig, chatText, AIError } = require('../ai');
const prompts = require('../prompts');
const { parsePlan } = require('./workouts');

const router = express.Router();

async function chatContext(userId, profile) {
  const workoutRow = await db.prepare("SELECT * FROM workouts WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(userId);
  const workout = workoutRow ? parsePlan(workoutRow) : null;
  let program = '';
  if (workout) {
    program = `${workout.name} (${workout.plan_json.split_name || workout.split || ''}, ${workout.days_per_week}x/semana). ` +
      (workout.plan_json.weekly_schedule || []).map((d) => `${d.day}: ${d.exercises.map((e) => e.name).join(', ')}`).join(' | ');
  }
  const sessions = await db.prepare(`SELECT date(performed_at) d, name, duration_min, effort FROM sessions WHERE user_id = ? ORDER BY performed_at DESC LIMIT 6`).all(userId);
  const recentSessions = sessions.map((s) => `${s.d}: ${s.name} (${s.duration_min || '?'} min, RPE ${s.effort || '?'})`).join('\n');
  const progress = (await db.prepare(`SELECT exercise_name, MAX(weight_kg) mw FROM set_logs WHERE user_id = ? AND weight_kg > 0 GROUP BY exercise_name ORDER BY mw DESC LIMIT 8`)
    .all(userId)).map((r) => `${r.exercise_name}: ${r.mw} kg`).join('\n');
  const weights = await db.prepare('SELECT date, weight_kg FROM weight_logs WHERE user_id = ? ORDER BY date DESC LIMIT 5').all(userId);
  const weightTrend = weights.reverse().map((w) => `${w.date}: ${w.weight_kg} kg`).join(', ');
  const lib = (await db.prepare('SELECT name FROM exercises WHERE is_active = 1 ORDER BY name').all()).map((r) => r.name);
  return { program, recentSessions, progress, weightTrend, exerciseLibrary: lib.join('; ') };
}

router.get('/history', requireAuth, async (req, res) => {
  const messages = await (await db.prepare('SELECT id, role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 60').all(req.user.id)).reverse();
  res.json({ messages, quota: await checkQuota(req.user, 'chat') });
});

router.post('/', requireAuth, rateLimit({ windowMs: 60000, max: 15 }), async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escreva uma mensagem.' });
  if (message.length > 2000) return res.status(400).json({ error: 'Mensagem muito longa (máx. 2000 caracteres).' });
  const plan = planOf(req.user);
  if (plan.chats <= 0) return res.status(402).json({ error: 'O chat com o Personal IA está disponível nos planos Pro e Premium.', code: 'UPGRADE_REQUIRED', upgrade: true });
  const quota = await checkQuota(req.user, 'chat');
  if (!quota.ok) {
    return res.status(402).json({ error: `Você atingiu o limite de ${quota.limit} mensagens por mês no plano ${plan.name}.`, code: 'QUOTA_EXCEEDED', upgrade: true, quota });
  }
  const cfg = await getAIConfig();
  if (!cfg.provider || !cfg.apiKey) return res.status(503).json({ error: 'O Personal IA não está configurado no servidor. Avise um administrador.', code: 'AI_NOT_CONFIGURED' });

  const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
  const history = await (await db.prepare('SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 12').all(req.user.id)).reverse();

  await db.prepare('INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)').run(req.user.id, 'user', message);
  const system = prompts.buildChatSystemPrompt(profile, await chatContext(req.user.id, profile));
  const messages = [...history, { role: 'user', content: message }];

  try {
    const reply = await chatText({ system, messages, maxTokens: 1200, feature: 'chat', userId: req.user.id });
    await db.prepare('INSERT INTO chat_messages (user_id, role, content) VALUES (?,?,?)').run(req.user.id, 'assistant', reply);
    res.json({ reply, quota: await checkQuota(req.user, 'chat') });
  } catch (e) {
    // remove a mensagem do usuário se a IA falhou, para permitir reenviar
    await db.prepare("DELETE FROM chat_messages WHERE id = (SELECT id FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 1)").run(req.user.id);
    if (e instanceof AIError) return res.status(502).json({ error: e.message, code: e.code || 'AI_ERROR' });
    return res.status(500).json({ error: 'Falha ao consultar o Personal IA.' });
  }
});

router.delete('/history', requireAuth, async (req, res) => {
  await db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
