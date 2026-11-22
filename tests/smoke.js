/* Teste funcional completo da API FitAI (roda contra o servidor local).
   Uso: node tests/smoke.js [http://127.0.0.1:3000] */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';
let pass = 0, fail = 0;
const results = [];

async function call(method, url, body, cookie) {
  const res = await fetch(BASE + url, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const t = await res.text();
  try { data = t ? JSON.parse(t) : null; } catch { data = { raw: t }; }
  return { status: res.status, data, headers: res.headers };
}
function check(name, cond, extra = '') {
  if (cond) { pass++; results.push(`  ✓ ${name}`); }
  else { fail++; results.push(`  ✗ ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(email, password) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await call('POST', '/api/auth/login', { email, password });
    if (r.status === 429) { // rate limit de login: aguarda a janela
      const wait = (parseInt(r.headers.get('retry-after') || '5', 10) + 1) * 1000;
      console.log(`  (rate limit de login — aguardando ${wait / 1000}s)`);
      await sleep(wait);
      continue;
    }
    return { cookie: (r.headers.get('set-cookie') || '').split(';')[0], r };
  }
  throw new Error('login bloqueado por rate limit');
}

(async () => {
  console.log('\n=== FitAI · teste funcional ===\n');

  // ---------- estado inicial: admin garante IA e Pix desligados ----------
  const adminBoot = await login('admin@fitai.com', 'Admin@123456');
  check('login admin (bootstrap)', adminBoot.r.status === 200);
  await call('PUT', '/api/admin/ai', { provider: 'openai', clear_key: true }, adminBoot.cookie);
  await call('PUT', '/api/admin/payments-config', { pix_key: '', card_enabled: false }, adminBoot.cookie);

  // ---------- públicos ----------
  const health = await call('GET', '/api/public/health');
  check('health responde', health.status === 200 && health.data.ok);
  const site = await call('GET', '/api/public/site');
  check('site público: modalidades', site.data.modalities?.length === 9, `(${site.data.modalities?.length})`);
  check('site público: planos', site.data.plans?.length === 3);
  check('site público: exercícios >= 65', site.data.stats?.exercises >= 65);
  const spa = await fetch(BASE + '/treinos');
  check('SPA fallback serve index.html', (await spa.text()).includes('FitAI'));

  // ---------- auth ----------
  const bad = await call('POST', '/api/auth/login', { email: 'demo@fitai.com', password: 'errada' });
  check('login com senha errada é rejeitado (401)', bad.status === 401);
  const weak = await call('POST', '/api/auth/register', { name: 'Teste', email: `t${Date.now()}@x.com`, password: '123' });
  check('cadastro com senha fraca é rejeitado (400)', weak.status === 400);

  const demo = await login('demo@fitai.com', 'Demo@123456');
  check('login demo retorna cookie', !!demo.cookie && demo.r.status === 200);
  const me = await call('GET', '/api/auth/me', null, demo.cookie);
  check('me retorna usuário e perfil', me.data.user?.email === 'demo@fitai.com' && !!me.data.profile);

  const unauth = await call('GET', '/api/dashboard');
  check('dashboard sem sessão exige login (401)', unauth.status === 401);

  // ---------- isolamento de dados ----------
  const nu = await call('POST', '/api/auth/register', { name: 'Novo Usuário', email: `novo${Date.now()}@teste.com`, password: 'Senha12345', age: 16 });
  const nuCookie = (nu.headers.get('set-cookie') || '').split(';')[0];
  check('cadastro válido cria usuário (201)', nu.status === 201);
  const createdUserIds = [nu.data.user?.id].filter(Boolean);
  const nuDash = await call('GET', '/api/dashboard', null, nuCookie);
  check('novo usuário vê dashboard vazio (isolamento)', nuDash.data.stats?.total_sessions === 0);
  const nuSessions = await call('GET', '/api/sessions', null, nuCookie);
  check('novo usuário não vê sessões de outros', (nuSessions.data.sessions || []).length === 0);

  // ---------- perfil ----------
  const profSave = await call('PUT', '/api/profile', {
    age: 30, sex: 'M', height_cm: 180, weight_kg: 90, goal: 'hipertrofia', level: 'avancado',
    days_per_week: 5, minutes_per_session: 75, location: 'academia',
    equipment: ['Barra', 'Halteres', 'Máquina'], focus_muscles: ['Peito'], injuries: 'dor no ombro',
  }, nuCookie);
  check('perfil é salvo', profSave.status === 200 && profSave.data.profile.goal === 'hipertrofia');
  const wlog = await call('POST', '/api/profile/weight', { weight_kg: 89.5 }, nuCookie);
  check('registro de peso', wlog.status === 200);
  const goal = await call('POST', '/api/profile/goals', { title: 'Supino 100kg', target: 100, current: 60, unit: 'kg' }, nuCookie);
  check('criação de meta', goal.status === 201);

  // ---------- biblioteca ----------
  const lib = await call('GET', '/api/exercises?muscle=Peito', null, nuCookie);
  check('filtro por músculo', lib.data.exercises?.length > 0 && lib.data.exercises.every((e) => e.primary_muscle === 'Peito'));
  const libQ = await call('GET', '/api/exercises?q=agachamento', null, nuCookie);
  check('busca textual', libQ.data.exercises?.length > 0);
  const detail = await call('GET', '/api/exercises/' + lib.data.exercises[0].id, null, demo.cookie);
  check('detalhe do exercício com execução (Pro)', !!detail.data.exercise.instructions);
  const detailFree = await call('GET', '/api/exercises/' + lib.data.exercises[0].id, null, nuCookie);
  check('plano gratuito recebe detalhe', detailFree.status === 200 && !!detailFree.data.exercise.name);

  // ---------- cotas e IA não configurada ----------
  const gen = await call('POST', '/api/workouts/generate', { modality: 'musculacao' }, nuCookie);
  check('geração sem IA configurada é bloqueada (503)', gen.status === 503 && gen.data.code === 'AI_NOT_CONFIGURED', `(${gen.status} ${gen.data.code})`);
  const chatFree = await call('POST', '/api/chat', { message: 'oi' }, demo.cookie);
  check('chat exige configuração de IA (503)', chatFree.status === 503);

  // ---------- sessões e estatísticas (demo, plano pro) ----------
  const sess = await call('POST', '/api/sessions', {
    name: 'Treino teste', day_key: 'A', performed_at: '2026-11-20 19:00:00', duration_min: 55, effort: 8,
    sets: [{ exercise_name: 'Supino reto com barra', set_number: 1, reps: 8, weight_kg: 70 }, { exercise_name: 'Supino reto com barra', set_number: 2, reps: 8, weight_kg: 70 }],
  }, demo.cookie);
  check('registro de treino com séries', sess.status === 201);
  const dash = await call('GET', '/api/dashboard', null, demo.cookie);
  check('dashboard retorna estatísticas', dash.data.stats?.total_sessions > 0);
  check('dashboard retorna semana', (dash.data.weekly || []).length === 7);
  check('dashboard retorna evolução de peso', (dash.data.weights || []).length >= 2);
  const report = await call('GET', '/api/dashboard/report', null, demo.cookie);
  check('relatório (plano Pro) acessível', report.status === 200 && report.data.months?.length === 6);
  const reportFree = await call('GET', '/api/dashboard/report', null, nuCookie);
  check('relatório bloqueado no plano gratuito (402)', reportFree.status === 402);

  // ---------- cobrança ----------
  const billing = await call('GET', '/api/billing', null, demo.cookie);
  check('planos listados', billing.data.plans?.length === 3);
  const pixOff = await call('POST', '/api/billing/checkout', { plan: 'pro', method: 'pix' }, demo.cookie);
  check('Pix sem chave configurada é bloqueado (503)', pixOff.status === 503 && pixOff.data.code === 'PIX_NOT_CONFIGURED');
  const badPlan = await call('POST', '/api/billing/checkout', { plan: 'free', method: 'pix' }, demo.cookie);
  check('plano inválido rejeitado', badPlan.status === 400);

  // ---------- admin ----------
  const admin = adminBoot;
  check('login admin', admin.r.status === 200);
  const forbidden = await call('GET', '/api/admin/stats', null, demo.cookie);
  check('usuário comum não acessa admin (403)', forbidden.status === 403);
  const adminAi = await call('PUT', '/api/admin/ai', { provider: 'openai', model: 'gpt-4o-mini', base_url: 'https://api.openai.com/v1', api_key: 'sk-teste-nao-real', temperature: 0.5 }, admin.cookie);
  check('admin salva configuração de IA', adminAi.status === 200);
  const aiCfg = await call('GET', '/api/admin/ai', null, admin.cookie);
  check('chave de IA é mascarada', aiCfg.data.config.api_key_masked.includes('•') && !aiCfg.data.config.api_key_masked.includes('sk-teste-nao-real'));
  const pixCfg = await call('PUT', '/api/admin/payments-config', { pix_key: 'pagamentos@fitai.app', pix_holder: 'FITAI', pix_city: 'SERRA TALHADA' }, admin.cookie);
  check('admin salva chave Pix', pixCfg.status === 200);
  const pixOn = await call('POST', '/api/billing/checkout', { plan: 'pro', method: 'pix' }, demo.cookie);
  check('checkout Pix gera BR Code', pixOn.status === 201 && pixOn.data.pix?.payload?.startsWith('000201'));
  check('BR Code tem CRC16 de 4 dígitos', /6304[0-9A-F]{4}$/.test(pixOn.data.pix?.payload || ''));
  const qr = await call('GET', '/api/billing/pix-qr/' + pixOn.data.intent.id, null, demo.cookie);
  check('QR Code Pix gerado (data URL PNG)', (qr.data.qr || '').startsWith('data:image/png;base64,'));
  const confirm = await call('POST', '/api/admin/payments/' + pixOn.data.intent.id + '/confirm', {}, admin.cookie);
  check('admin confirma pagamento', confirm.status === 200);
  const userAfter = await call('GET', '/api/auth/me', null, demo.cookie);
  check('plano do usuário é ativado após confirmação', ['pro', 'premium'].includes(userAfter.data.user.plan));
  const adminEx = await call('POST', '/api/admin/exercises', { name: 'Exercício Teste QA', primary_muscle: 'Peito', equipment: 'Halteres', difficulty: 'Iniciante' }, admin.cookie);
  check('admin cria exercício', adminEx.status === 201);
  const delEx = await call('DELETE', '/api/admin/exercises/' + adminEx.data.exercise.id, null, admin.cookie);
  check('admin exclui exercício', delEx.status === 200);
  const stats = await call('GET', '/api/admin/stats', null, admin.cookie);
  check('estatísticas administrativas', stats.data.stats?.users >= 3);

  // ---------- recuperação de senha ----------
  let forgot = await call('POST', '/api/auth/forgot-password', { email: 'demo@fitai.com' });
  if (forgot.status === 429) {
    const wait = (parseInt(forgot.headers.get('retry-after') || '30', 10) + 1) * 1000;
    console.log(`  (rate limit de recuperação — aguardando ${wait / 1000}s)`);
    await sleep(wait);
    forgot = await call('POST', '/api/auth/forgot-password', { email: 'demo@fitai.com' });
  }
  check('recuperação gera token', !!forgot.data.reset_token, `(${forgot.status})`);
  const reset = await call('POST', '/api/auth/reset-password', { token: forgot.data.reset_token, password: 'NovaSenha123' });
  check('redefinição de senha', reset.status === 200);
  const loginNew = await login('demo@fitai.com', 'NovaSenha123');
  check('login com nova senha', loginNew.r.status === 200);
  await call('POST', '/api/auth/reset-password', { token: forgot.data.reset_token, password: 'Outra12345' });
  const reuse = await call('POST', '/api/auth/reset-password', { token: forgot.data.reset_token, password: 'Outra12345' });
  check('token de reset é de uso único', reuse.status === 400);
  // volta a senha demo
  const adminReset = await call('PATCH', '/api/admin/users/' + demo.r.data.user.id, { new_password: 'Demo@123456' }, admin.cookie);
  check('admin redefine senha de usuário', adminReset.status === 200);

  // ---------- guardrails (função pura) ----------
  const { applyGuardrails } = require('../server/prompts');
  const plan = applyGuardrails({
    split_name: 'Teste', weekly_schedule: [{
      day: 'A', title: 'Teste', exercises: [
        { name: 'Agachamento com salto', sets: 3, reps: '10', muscle: 'Pernas' },
        { name: 'Leg press 45°', sets: 4, reps: '10', muscle: 'Pernas' },
        { name: 'Levantamento terra com barra', sets: 3, reps: '5', muscle: 'Corpo inteiro' },
      ],
    }],
  }, { injuries: 'dor no joelho e lombar', age: 16 });
  const names = plan.weekly_schedule[0].exercises.map((e) => e.name);
  check('guardrail remove exercício contraindicado p/ joelho', !names.includes('Agachamento com salto'));
  check('guardrail remove exercício contraindicado p/ lombar', !names.includes('Levantamento terra com barra'));
  check('guardrail mantém exercício seguro', names.includes('Leg press 45°'));
  check('guardrail adiciona aviso para menor de idade', plan.notices.some((n) => /menor de idade/i.test(n)));
  check('guardrail adiciona disclaimer', plan.notices.some((n) => /não substitui/i.test(n)));

  // ---------- limpeza: restaura o estado de entrega ----------
  await call('PUT', '/api/admin/ai', { provider: 'openai', clear_key: true }, admin.cookie);
  await call('PUT', '/api/admin/payments-config', { pix_key: '', card_enabled: false }, admin.cookie);
  await call('PATCH', '/api/admin/users/' + demo.r.data.user.id, { plan: 'pro' }, admin.cookie);
  for (const id of createdUserIds) await call('DELETE', '/api/admin/users/' + id, null, admin.cookie);
  if (sess.data?.id) await call('DELETE', '/api/sessions/' + sess.data.id, null, demo.cookie);

  console.log(results.join('\n'));
  console.log(`\n${pass} passaram · ${fail} falharam\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
