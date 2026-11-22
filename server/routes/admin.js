'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, getSetting, setSetting } = require('../db');
const { requireAdmin, planOf } = require('../auth');
const { PLANS, AI_PROVIDERS } = require('../config');
const { getAIConfig, isConfigured, testConnection, invalidateAIConfigCache } = require('../ai');
const { slugify } = require('../seed');

const router = express.Router();

function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '••••';
  return k.slice(0, 4) + '••••••••' + k.slice(-4);
}

/* ------------------------------- Estatísticas ------------------------------- */
router.get('/stats', requireAdmin, async (req, res) => {
  const count = async (sql, ...p) => (await db.prepare(sql).get(...p)).c;
  const stats = {
    users: await count('SELECT COUNT(*) c FROM users'),
    admins: await count("SELECT COUNT(*) c FROM users WHERE role = 'admin'"),
    pro_users: await count("SELECT COUNT(*) c FROM users WHERE plan = 'pro'"),
    premium_users: await count("SELECT COUNT(*) c FROM users WHERE plan = 'premium'"),
    free_users: await count("SELECT COUNT(*) c FROM users WHERE plan = 'free'"),
    active_7d: await count("SELECT COUNT(DISTINCT user_id) c FROM sessions WHERE performed_at >= datetime('now','-7 days')"),
    sessions: await count('SELECT COUNT(*) c FROM sessions'),
    workouts: await count('SELECT COUNT(*) c FROM workouts'),
    exercises: await count('SELECT COUNT(*) c FROM exercises'),
    chats: await count("SELECT COUNT(*) c FROM chat_messages WHERE role = 'user'"),
    ai_calls: await count('SELECT COUNT(*) c FROM ai_usage'),
    ai_errors: await count('SELECT COUNT(*) c FROM ai_usage WHERE ok = 0'),
    revenue_cents: (await db.prepare("SELECT COALESCE(SUM(amount_cents),0) v FROM payment_intents WHERE status = 'paid'").get()).v,
    pending_payments: await count("SELECT COUNT(*) c FROM payment_intents WHERE status IN ('pending','awaiting_payment')"),
    ai_configured: isConfigured(await getAIConfig()),
    ai_provider: (await getAIConfig()).provider || null,
    plan_distribution: await db.prepare('SELECT plan, COUNT(*) c FROM users GROUP BY plan').all(),
  };
  const recentSignups = await db.prepare('SELECT id, name, email, plan, created_at FROM users ORDER BY id DESC LIMIT 6').all();
  const daily = await db.prepare(`SELECT date(performed_at) d, COUNT(*) c FROM sessions
    WHERE performed_at >= datetime('now','-14 days') GROUP BY date(performed_at) ORDER BY d`).all();
  res.json({ stats, recentSignups, daily });
});

/* ------------------------------- Usuários ------------------------------- */
router.get('/users', requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const where = q ? 'WHERE name LIKE ? OR email LIKE ?' : '';
  const rows = await db.prepare(`SELECT id, name, email, role, plan, plan_expires_at, created_at, last_login_at FROM users ${where} ORDER BY id DESC LIMIT 200`)
    .all(...(q ? [`%${q}%`, `%${q}%`] : []));
  const counts = await db.prepare(`SELECT s.user_id, COUNT(*) sessions, MAX(s.performed_at) last_session FROM sessions s GROUP BY s.user_id`).all();
  const byUser = Object.fromEntries(counts.map((c) => [c.user_id, c]));
  res.json({ users: rows.map((u) => ({ ...u, sessions: byUser[u.id]?.sessions || 0, last_session: byUser[u.id]?.last_session || null })) });
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  const updates = [];
  const params = [];
  if (req.body?.plan && PLANS[req.body.plan]) {
    updates.push('plan = ?'); params.push(req.body.plan);
    if (req.body.plan !== 'free') {
      const expires = new Date(Date.now() + 30 * 864e5).toISOString();
      updates.push('plan_expires_at = ?'); params.push(expires);
    } else {
      updates.push('plan_expires_at = NULL');
    }
  }
  if (req.body?.role && ['user', 'admin'].includes(req.body.role)) {
    if (user.role === 'admin' && req.body.role === 'user') {
      const admins = (await db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get()).c;
      if (admins <= 1) return res.status(400).json({ error: 'Não é possível remover o último administrador.' });
    }
    updates.push('role = ?'); params.push(req.body.role);
  }
  if (req.body?.name && String(req.body.name).trim().length >= 2) {
    updates.push('name = ?'); params.push(String(req.body.name).trim());
  }
  if (req.body?.new_password) {
    if (String(req.body.new_password).length < 8) return res.status(400).json({ error: 'Senha muito curta.' });
    updates.push('password_hash = ?'); params.push(bcrypt.hashSync(String(req.body.new_password), 10));
  }
  if (!updates.length) return res.status(400).json({ error: 'Nada para atualizar.' });
  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params, id);
  res.json({ user: await db.prepare('SELECT id, name, email, role, plan, plan_expires_at, created_at FROM users WHERE id = ?').get(id), message: 'Usuário atualizado.' });
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Você não pode excluir sua própria conta por aqui.' });
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true, message: 'Usuário excluído.' });
});

/* ------------------------------- Exercícios ------------------------------- */
router.get('/exercises', requireAdmin, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM exercises ORDER BY id DESC').all();
  res.json({ exercises: rows.map((r) => ({ ...r, secondary_muscles: jparse(r.secondary_muscles), modalities: jparse(r.modalities) })) });
});

router.post('/exercises', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (name.length < 3) return res.status(400).json({ error: 'Informe o nome do exercício.' });
  if (!b.primary_muscle) return res.status(400).json({ error: 'Informe o músculo principal.' });
  const slug = slugify(name);
  if (await db.prepare('SELECT id FROM exercises WHERE slug = ?').get(slug)) return res.status(409).json({ error: 'Já existe um exercício com esse nome.' });
  const info = await db.prepare(`INSERT INTO exercises (name, slug, primary_muscle, secondary_muscles, equipment, modalities, difficulty, instructions, common_errors, tips, video_url, is_premium)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(name, slug, b.primary_muscle,
    JSON.stringify(Array.isArray(b.secondary_muscles) ? b.secondary_muscles : []),
    String(b.equipment || 'Peso do corpo'), JSON.stringify(Array.isArray(b.modalities) ? b.modalities : []),
    ['Iniciante', 'Intermediário', 'Avançado'].includes(b.difficulty) ? b.difficulty : 'Iniciante',
    String(b.instructions || ''), String(b.common_errors || ''), String(b.tips || ''),
    String(b.video_url || '') || null, b.is_premium ? 1 : 0);
  res.status(201).json({ exercise: await db.prepare('SELECT * FROM exercises WHERE id = ?').get(info.lastInsertRowid), message: 'Exercício criado.' });
});

router.patch('/exercises/:id', requireAdmin, async (req, res) => {
  const ex = await db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Exercício não encontrado.' });
  const b = req.body || {};
  const fields = [];
  const params = [];
  const strFields = ['name', 'primary_muscle', 'equipment', 'difficulty', 'instructions', 'common_errors', 'tips', 'video_url'];
  for (const f of strFields) if (typeof b[f] === 'string') { fields.push(`${f} = ?`); params.push(b[f]); }
  if (Array.isArray(b.secondary_muscles)) { fields.push('secondary_muscles = ?'); params.push(JSON.stringify(b.secondary_muscles)); }
  if (Array.isArray(b.modalities)) { fields.push('modalities = ?'); params.push(JSON.stringify(b.modalities)); }
  if (b.is_premium !== undefined) { fields.push('is_premium = ?'); params.push(b.is_premium ? 1 : 0); }
  if (b.is_active !== undefined) { fields.push('is_active = ?'); params.push(b.is_active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar.' });
  await db.prepare(`UPDATE exercises SET ${fields.join(', ')} WHERE id = ?`).run(...params, ex.id);
  res.json({ exercise: await db.prepare('SELECT * FROM exercises WHERE id = ?').get(ex.id), message: 'Exercício atualizado.' });
});

router.delete('/exercises/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM exercises WHERE id = ?').run(req.params.id);
  res.json({ ok: true, message: 'Exercício excluído.' });
});

/* ------------------------------- Modalidades ------------------------------- */
router.get('/modalities', requireAdmin, async (req, res) => {
  res.json({ modalities: await db.prepare('SELECT * FROM modalities ORDER BY name').all() });
});
router.post('/modalities', requireAdmin, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Informe o nome da modalidade.' });
  const slug = slugify(name);
  if (await db.prepare('SELECT id FROM modalities WHERE slug = ?').get(slug)) return res.status(409).json({ error: 'Modalidade já existe.' });
  const info = await db.prepare('INSERT INTO modalities (name, slug, description, icon) VALUES (?,?,?,?)')
    .run(name, slug, String(req.body?.description || ''), String(req.body?.icon || 'dumbbell'));
  res.status(201).json({ modality: await db.prepare('SELECT * FROM modalities WHERE id = ?').get(info.lastInsertRowid), message: 'Modalidade criada.' });
});
router.patch('/modalities/:id', requireAdmin, async (req, res) => {
  const b = req.body || {};
  await db.prepare('UPDATE modalities SET name = COALESCE(?, name), description = COALESCE(?, description), icon = COALESCE(?, icon), is_active = COALESCE(?, is_active) WHERE id = ?')
    .run(b.name || null, b.description ?? null, b.icon || null, b.is_active === undefined ? null : (b.is_active ? 1 : 0), req.params.id);
  res.json({ modality: await db.prepare('SELECT * FROM modalities WHERE id = ?').get(req.params.id), message: 'Modalidade atualizada.' });
});
router.delete('/modalities/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM modalities WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ------------------------------- Conteúdos ------------------------------- */
router.get('/content', requireAdmin, async (req, res) => {
  res.json({ content: await db.prepare('SELECT * FROM content ORDER BY id DESC').all() });
});
router.post('/content', requireAdmin, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (title.length < 3) return res.status(400).json({ error: 'Informe o título.' });
  const info = await db.prepare('INSERT INTO content (title, body, kind, is_published) VALUES (?,?,?,?)')
    .run(title, String(req.body?.body || ''), String(req.body?.kind || 'artigo'), req.body?.is_published === false ? 0 : 1);
  res.status(201).json({ content: await db.prepare('SELECT * FROM content WHERE id = ?').get(info.lastInsertRowid), message: 'Conteúdo criado.' });
});
router.patch('/content/:id', requireAdmin, async (req, res) => {
  const b = req.body || {};
  await db.prepare('UPDATE content SET title = COALESCE(?, title), body = COALESCE(?, body), kind = COALESCE(?, kind), is_published = COALESCE(?, is_published) WHERE id = ?')
    .run(b.title || null, b.body ?? null, b.kind || null, b.is_published === undefined ? null : (b.is_published ? 1 : 0), req.params.id);
  res.json({ ok: true, message: 'Conteúdo atualizado.' });
});
router.delete('/content/:id', requireAdmin, async (req, res) => {
  await db.prepare('DELETE FROM content WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ------------------------------- Planos e assinaturas ------------------------------- */
router.get('/plans', requireAdmin, async (req, res) => {
  const subs = await db.prepare(`SELECT plan, COUNT(*) c FROM users GROUP BY plan`).all();
  const payments = await db.prepare(`SELECT p.*, u.name user_name, u.email user_email FROM payment_intents p
    JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC LIMIT 100`).all();
  const prices = {};
  for (const id of Object.keys(PLANS)) {
    const v = await getSetting(`plan_price_${id}`);
    prices[id] = v != null && v !== '' ? parseInt(v, 10) : PLANS[id].price_cents;
  }
  res.json({ plans: Object.values(PLANS), subscriptions: subs, payments, prices });
});

router.put('/plans/:id/price', requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!PLANS[id] || id === 'free') return res.status(400).json({ error: 'Plano inválido.' });
  const cents = parseInt(req.body?.price_cents, 10);
  if (!Number.isFinite(cents) || cents < 100 || cents > 1000000) return res.status(400).json({ error: 'Preço inválido.' });
  // reflete no runtime
  PLANS[id].price_cents = cents;
  await setSetting(`plan_price_${id}`, cents);
  res.json({ ok: true, message: 'Preço atualizado.' });
});

router.post('/payments/:id/confirm', requireAdmin, async (req, res) => {
  const intent = await db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(req.params.id);
  if (!intent) return res.status(404).json({ error: 'Pagamento não encontrado.' });
  if (intent.status === 'paid') return res.status(400).json({ error: 'Pagamento já confirmado.' });
  const expires = new Date(Date.now() + (req.body?.days || 30) * 864e5).toISOString();
  await db.prepare("UPDATE payment_intents SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(intent.id);
  await db.prepare('UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?').run(intent.plan, expires, intent.user_id);
  res.json({ ok: true, message: `Pagamento confirmado. Plano ${PLANS[intent.plan]?.name} ativado por 30 dias.` });
});

router.post('/payments/:id/cancel', requireAdmin, async (req, res) => {
  await db.prepare("UPDATE payment_intents SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ------------------------------- IA ------------------------------- */
router.get('/ai', requireAdmin, async (req, res) => {
  const cfg = await getAIConfig();
  const usage = await db.prepare(`SELECT feature, COUNT(*) total, SUM(ok) ok_count FROM ai_usage GROUP BY feature`).all();
  const recentErrors = await db.prepare(`SELECT feature, provider, model, error, created_at FROM ai_usage WHERE ok = 0 ORDER BY id DESC LIMIT 10`).all();
  res.json({
    config: {
      provider: cfg.provider || '',
      model: cfg.model || '',
      base_url: cfg.baseUrl || '',
      temperature: cfg.temperature,
      api_key_masked: maskKey(cfg.apiKey),
      has_key: !!cfg.apiKey,
      configured: isConfigured(cfg),
      proxy_url: cfg.proxyUrl || '',
      proxy_token_masked: maskKey(cfg.proxyToken),
      has_proxy_token: !!cfg.proxyToken,
    },
    providers: Object.entries(AI_PROVIDERS).map(([id, p]) => ({ id, label: p.label, default_model: p.defaultModel, base_url: p.baseUrl })),
    usage, recentErrors,
  });
});

router.put('/ai', requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (b.provider !== undefined) {
    if (b.provider && !AI_PROVIDERS[b.provider]) return res.status(400).json({ error: 'Provedor inválido.' });
    await setSetting('ai_provider', b.provider);
    if (b.provider && !b.model) await setSetting('ai_model', AI_PROVIDERS[b.provider].defaultModel);
    if (b.provider && !b.base_url) await setSetting('ai_base_url', AI_PROVIDERS[b.provider].baseUrl);
  }
  if (b.model !== undefined) await setSetting('ai_model', String(b.model).slice(0, 120));
  if (b.base_url !== undefined) await setSetting('ai_base_url', String(b.base_url).slice(0, 300));
  if (b.temperature !== undefined) {
    const t = parseFloat(b.temperature);
    if (Number.isFinite(t) && t >= 0 && t <= 1.5) await setSetting('ai_temperature', String(t));
  }
  if (typeof b.api_key === 'string' && b.api_key.trim() && !b.api_key.includes('•')) {
    await setSetting('ai_api_key', b.api_key.trim());
  }
  if (b.clear_key) await setSetting('ai_api_key', '');
  if (b.proxy_url !== undefined) await setSetting('ai_proxy_url', String(b.proxy_url).trim().slice(0, 300));
  if (typeof b.proxy_token === 'string' && b.proxy_token.trim() && !b.proxy_token.includes('•')) {
    await setSetting('ai_proxy_token', b.proxy_token.trim());
  }
  if (b.clear_proxy_token) await setSetting('ai_proxy_token', '');
  invalidateAIConfigCache(); // o GET /ai seguinte já reflete o que foi salvo
  res.json({ ok: true, message: 'Configuração de IA salva.' });
});

router.post('/ai/test', requireAdmin, async (req, res) => {
  try {
    const result = await testConnection();
    res.json(result);
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

/* ------------------------------- Pagamentos (config) ------------------------------- */
router.get('/payments-config', requireAdmin, async (req, res) => {
  res.json({
    pix_key: await getSetting('pix_key', ''),
    pix_holder: await getSetting('pix_holder', ''),
    pix_city: await getSetting('pix_city', ''),
    card_provider_status: await getSetting('card_provider_status', 'not_configured'),
    card_provider: await getSetting('card_provider', ''),
  });
});
router.put('/payments-config', requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (b.pix_key !== undefined) await setSetting('pix_key', String(b.pix_key).slice(0, 120));
  if (b.pix_holder !== undefined) await setSetting('pix_holder', String(b.pix_holder).slice(0, 25));
  if (b.pix_city !== undefined) await setSetting('pix_city', String(b.pix_city).slice(0, 15));
  if (b.card_provider !== undefined) await setSetting('card_provider', String(b.card_provider).slice(0, 40));
  if (b.card_provider_status !== undefined) await setSetting('card_provider_status', String(b.card_provider_status).slice(0, 40));
  res.json({ ok: true, message: 'Configuração de pagamentos salva.' });
});

function jparse(s) { try { return JSON.parse(s); } catch { return []; } }

module.exports = router;
