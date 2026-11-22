'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { db } = require('./db');
const { runSeed } = require('./seed');
const { attachUser, requireAuth } = require('./auth');

/* O seed é assíncrono (o banco pode ser Postgres). Em serverless não podemos
   bloquear a inicialização, então guardamos a promise e cada requisição que precise
   de dados aguarda essa promise (middleware abaixo). */
const seedReady = (async () => {
  try { await runSeed(); } catch (e) { console.error('[seed]', e.message); }
})();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());

/* Cabeçalhos de segurança
   EMBED_ALLOWED permite exibir o app dentro de um iframe (previews de sandbox).
   Em produção, deixe desligado: o padrão é bloquear framing de outros domínios (anti-clickjacking). */
const EMBED_ALLOWED = process.env.EMBED_ALLOWED !== '0';
app.use((req, res, next) => {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors " + (EMBED_ALLOWED ? "*" : "'self'"),
  ].join('; ');
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': csp,
  });
  // X-Frame-Options não aceita lista de origens; quando o embed é permitido, a CSP frame-ancestors manda.
  if (!EMBED_ALLOWED) res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(attachUser);

/* ------------------------------- API ------------------------------- */
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/profile', require('./routes/profile'));
app.use('/api/workouts', require('./routes/workouts').router);
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/admin', require('./routes/admin'));

/* API pública: modalidades, conteúdos, planos e status da IA (sem dados sensíveis) */
function showDemoAccounts() {
  if (process.env.SHOW_DEMO_ACCOUNTS === '0') return false;
  if (process.env.SHOW_DEMO_ACCOUNTS === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

app.get('/api/public/site', async (req, res, next) => {
  try {
  const { PLANS } = config;
  const { getJSONSetting, getSetting } = require('./db');
  const priceOf = async (id) => {
    const v = await getSetting(`plan_price_${id}`);
    return v != null && v !== '' ? parseInt(v, 10) : PLANS[id].price_cents;
  };
  const plans = [];
  for (const p of Object.values(PLANS)) {
    plans.push({
      id: p.id, name: p.name, price_cents: await priceOf(p.id), features: p.features,
      limits: { generations: p.generations, chats: p.chats }, flags: { progression_ai: p.progression_ai, reports: p.reports, full_library: p.full_library },
    });
  }
  res.json({
    modalities: await db.prepare('SELECT name, slug, description, icon FROM modalities WHERE is_active = 1 ORDER BY id').all(),
    content: await db.prepare('SELECT title, body, kind FROM content WHERE is_published = 1 ORDER BY id DESC LIMIT 6').all(),
    stats: {
      exercises: (await db.prepare('SELECT COUNT(*) c FROM exercises WHERE is_active = 1').get()).c,
      users: Math.max((await db.prepare('SELECT COUNT(*) c FROM users').get()).c, 0),
      sessions: (await db.prepare('SELECT COUNT(*) c FROM sessions').get()).c,
    },
    plans,
    content_extra: await getJSONSetting('landing_extra', null),
    // Contas de demonstração só são divulgadas quando explicitamente habilitado
    // (SHOW_DEMO_ACCOUNTS=1 ou ambiente não-produção).
    demo_access: showDemoAccounts()
      ? { student: { email: process.env.DEMO_EMAIL || 'demo@fitai.com' }, admin: { email: process.env.ADMIN_EMAIL || 'admin@fitai.com' } }
      : null,
  });
  } catch (e) { next(e); }
});

app.get('/api/public/health', async (req, res, next) => {
  try {
    const { isConfigured, getAIConfig } = require('./ai');
    res.json({ ok: true, ai_configured: isConfigured(await getAIConfig()), uptime: process.uptime(), time: new Date().toISOString() });
  } catch (e) { next(e); }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

/* Tratamento central de erros */
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dados inválidos na requisição.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição muito grande.' });
  res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
});

/* ------------------------------- Frontend (SPA) ------------------------------- */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));

/* Fontes servidas localmente (sem CDN externo).
   Ficam em public/fonts (empacotadas) — não dependem de node_modules em runtime,
   o que é essencial em ambientes serverless. */
app.use('/fonts', (req, res, next) => {
  const map = {
    'space-grotesk.woff2': path.join(PUBLIC_DIR, 'fonts', 'space-grotesk-latin-wght-normal.woff2'),
    'inter.woff2': path.join(PUBLIC_DIR, 'fonts', 'inter-latin-400-normal.woff2'),
    'inter-600.woff2': path.join(PUBLIC_DIR, 'fonts', 'inter-latin-600-normal.woff2'),
  };
  const file = map[req.path.replace(/^\//, '')];
  if (file && fs.existsSync(file)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(file);
  }
  next();
});

/* SPA fallback para rotas do app */
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Rota não encontrada.' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Em serverless (Vercel) não abrimos porta: a plataforma invoca o handler.
if (!process.env.VERCEL) {
  const server = app.listen(config.PORT, '0.0.0.0', async () => {
    const { getAIConfig, isConfigured } = require('./ai');
    await seedReady; // o seed precisa terminar antes de servir dados
    const ai = await getAIConfig();
    console.log(`\n  ⚡ FitAI rodando em http://0.0.0.0:${config.PORT}`);
    console.log(`  ├─ IA: ${isConfigured(ai) ? `${ai.provider} / ${ai.model}` : 'NÃO CONFIGURADA (defina no Painel Admin)'}`);
    console.log(`  ├─ Banco: ${process.env.DATABASE_URL ? 'PostgreSQL' : config.DB_PATH}`);
    console.log(`  └─ Admin: ${process.env.ADMIN_EMAIL || 'admin@fitai.com'}\n`);
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

module.exports = app;
