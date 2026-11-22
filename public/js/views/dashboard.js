/* ============================================================
   Dashboard — visão geral
   ============================================================ */
async function renderDashboard(root) {
  root.innerHTML = appShell({
    title: 'Visão geral', crumb: `Olá, ${(App.user?.name || '').split(' ')[0]}`,
    actions: `<a href="/treinos" data-link class="btn btn-dark btn-sm">${icon('dumbbell')} Meus treinos</a>
      <button class="btn btn-primary btn-sm" id="dash-generate">${icon('sparkles')} Novo treino IA</button>`,
    content: skeletonDash(),
  });
  bindShell();
  document.getElementById('dash-generate').onclick = () => navigate('/treinos?gerar=1');

  let data;
  try {
    data = await API.get('/api/dashboard');
  } catch (e) {
    document.getElementById('app-content').innerHTML = `<div class="alert alert-danger">${icon('alert')}<div>${esc(e.message)}</div></div>`;
    return;
  }
  const content = document.getElementById('app-content');
  const st = data.stats;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const first = (App.user?.name || '').split(' ')[0];

  const today = data.today;
  const todayCard = data.workout && today ? `
    <div class="today-card">
      <div class="today-head">
        <div>
          <span class="badge badge-lime badge-sm">${icon('calendar')} Treino de hoje · ${esc(today.weekday_name)}</span>
          <h3>${esc(today.workout.title)}</h3>
          <div class="today-meta">
            <span>${icon('clock')}${today.workout.estimated_minutes} min</span>
            <span>${icon('dumbbell')}${today.workout.exercises.length} exercícios</span>
            <span>${icon('flame')}${esc((today.workout.focus || []).join(' · ') || 'corpo inteiro')}</span>
          </div>
        </div>
        <div class="avatar avatar-lg" style="flex:none">${esc(today.workout.day)}</div>
      </div>
      <div class="ex-list-mini">
        ${today.workout.exercises.slice(0, 6).map((ex, i) => `
          <div class="ex-row-mini">
            <span class="num">${i + 1}</span>
            <span class="name">${esc(ex.name)}</span>
            <span class="sets">${ex.sets} × ${esc(ex.reps)}</span>
          </div>`).join('')}
        ${today.workout.exercises.length > 6 ? `<div class="ex-row-mini" style="justify-content:center;color:var(--text-3);font-size:12px">+ ${today.workout.exercises.length - 6} exercícios</div>` : ''}
      </div>
      <div class="row wrap">
        <a href="/treinos" data-link class="btn btn-primary">${icon('play')} Iniciar treino</a>
        <a href="/treinos" data-link class="btn btn-ghost">Ver programa completo</a>
      </div>
    </div>` : data.workout ? `
    <div class="today-card" style="border-color:var(--border)">
      <span class="badge badge-sm mb2">${icon('moon')} Dia de descanso</span>
      <h3 style="margin-top:10px">Hoje é dia de recuperação</h3>
      <p class="muted fs14" style="max-width:460px">Recuperação faz parte do treino: sono, hidratação e mobilidade leve ajudam seu corpo a se adaptar ao estímulo.</p>
      ${data.next ? `<div class="ex-list-mini" style="margin-bottom:0">
        <div class="ex-row-mini" style="background:rgba(198,244,50,.06)"><span class="num" style="background:var(--lime-dim);color:var(--lime)">${esc(data.next.day)}</span>
        <span class="name">Próximo: ${esc(data.next.workout.title)}</span>
        <span class="sets">${esc(data.next.weekday_name)}${data.next.offset === 1 ? ' · amanhã' : ''}</span></div></div>` : ''}
      <div class="row mt3"><a href="/treinos" data-link class="btn btn-ghost">Antecipar um treino</a></div>
    </div>` : `
    <div class="today-card">
      <span class="badge badge-sm mb2">${icon('sparkles')} Primeiro passo</span>
      <h3 style="margin-top:10px">Você ainda não tem um programa ativo</h3>
      <p class="muted fs14">Complete seu perfil e deixe a IA montar seu treino personalizado em segundos.</p>
      <a href="/treinos?gerar=1" data-link class="btn btn-primary mt2">${icon('sparkles')} Gerar meu treino com IA</a>
    </div>`;

  const weights = data.weights || [];
  const weightChart = weights.length >= 2
    ? Charts.line({
      points: weights.slice(-16).map((w) => ({ y: w.weight_kg, xLabel: fmt.date(w.date), label: fmt.date(w.date) })),
      width: 640, height: 210, yFmt: (v) => fmt.num(v, 1) + ' kg',
    })
    : `<div class="chart-empty">Registre seu peso por 2 dias ou mais para ver a evolução</div>`;

  const loadKeys = Object.keys(data.load_series || {}).slice(0, 3);
  const loadChart = loadKeys.length
    ? loadKeys.map((k) => {
      const series = data.load_series[k];
      if (series.length < 2) return '';
      return `<div class="mb2"><div class="row-between mb2"><strong class="fs13">${esc(k)}</strong>
        <span class="fs12 dim">${fmt.num(series[series.length - 1].weight, 1)} kg · ${series.length} registros</span></div>
        ${Charts.line({ points: series.map((s) => ({ y: s.weight, xLabel: fmt.date(s.date), label: fmt.date(s.date) })), width: 640, height: 160, yFmt: (v) => fmt.num(v, 0) + ' kg', color: '#6ea8ff' })}</div>`;
    }).join('')
    : `<div class="chart-empty">Registre cargas ao concluir treinos para ver a evolução</div>`;

  content.innerHTML = `
    <div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px" id="stat-row">
      <div class="card stat-card">
        <span class="stat-icon">${icon('fire')}</span>
        <span class="stat-label">Treinos concluídos</span>
        <span class="stat-value">${fmt.num(st.total_sessions)}</span>
        <span class="stat-sub">${st.sessions_7d} nos últimos 7 dias</span>
      </div>
      <div class="card stat-card">
        <span class="stat-icon">${icon('zap')}</span>
        <span class="stat-label">Volume · 28 dias</span>
        <span class="stat-value">${fmt.volume(st.volume_28d)}</span>
        <span class="stat-sub">${st.sessions_28d} sessões registradas</span>
      </div>
      <div class="card stat-card">
        <span class="stat-icon">${icon('target')}</span>
        <span class="stat-label">Adesão ao plano</span>
        <span class="stat-value">${st.adherence != null ? fmt.pct(st.adherence) : '—'}</span>
        <span class="stat-sub">${data.workout ? `Meta: ${data.workout.days_per_week}x por semana` : 'Sem plano ativo'}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-icon">${icon('clock')}</span>
        <span class="stat-label">Duração média</span>
        <span class="stat-value">${st.avg_duration_28d || '—'}<small style="font-size:15px;color:var(--text-3);font-weight:400">${st.avg_duration_28d ? ' min' : ''}</small></span>
        <span class="stat-sub">Por sessão nas últimas 4 semanas</span>
      </div>
    </div>

    <div class="dash-grid">
      <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
        ${todayCard}

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('calendar')} Sua semana</h3>
            ${data.workout ? `<span class="fs12 dim">${esc(data.workout.name)}</span>` : ''}</div>
          <div class="week-grid">
            ${(data.weekly || []).map((d) => `
              <div class="day-cell ${d.planned ? 'planned' : 'rest'} ${d.done ? 'done' : ''} ${d.is_today ? 'today' : ''}">
                <span class="wd">${esc(d.weekday.slice(0, 3))}</span>
                <span class="dd">${String(parseDate(d.date)?.getDate() || '').padStart(2, '0')}</span>
                <span class="tag">${d.planned ? esc(String(d.planned).replace(/^[A-Z]\s*[—–-]\s*/, '')) : 'descanso'}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('trending')} Evolução de peso</h3>
            <button class="btn btn-ghost btn-sm" id="add-weight">${icon('plus')} Registrar peso</button></div>
          ${weightChart}
          ${weights.length ? `<div class="row-between fs12 dim mt2"><span>Inicial: ${fmt.num(weights[0].weight_kg, 1)} kg (${fmt.date(weights[0].date)})</span>
            <span>Atual: <strong style="color:var(--lime)">${fmt.num(weights[weights.length - 1].weight_kg, 1)} kg</strong></span></div>` : ''}
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('dumbbell')} Evolução de cargas</h3>
            <a href="/progresso" data-link class="fs12 lime" style="font-weight:600">Ver detalhes →</a></div>
          ${loadChart}
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('clock')} Histórico recente</h3>
            <a href="/progresso" data-link class="fs12 lime" style="font-weight:600">Ver tudo →</a></div>
          ${data.recent.length ? data.recent.map((s) => `
            <div class="activity-item">
              <div class="activity-icon">${icon('checkCircle')}</div>
              <div class="body"><strong>${esc(s.name)}</strong>
                <span>${fmt.date(s.performed_at)} · ${fmt.time(s.performed_at)} · ${s.duration_min || '?'} min · ${s.sets} séries</span></div>
              <span class="vol">${fmt.volume(s.volume)}</span>
            </div>`).join('') : `<div class="empty"><div class="empty-icon">${icon('dumbbell')}</div><h4>Nenhum treino registrado</h4><p>Conclua um treino para começar seu histórico.</p></div>`}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('target')} Metas</h3>
            <button class="btn btn-ghost btn-sm" id="add-goal">${icon('plus')} Nova</button></div>
          <div id="goals-list">${renderGoals(data.goals)}</div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('chart')} Frequência · 8 semanas</h3></div>
          ${Charts.bars({
            values: data.freq.map((f) => f.sessions),
            labels: data.freq.map((f) => fmt.date(f.week_end)),
            height: 130, unit: ' treinos',
          })}
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('sparkles')} Seu plano</h3></div>
          <div class="kv"><span>Assinatura</span><span>${badgePlan(App.user.plan)}</span></div>
          <div class="kv"><span>Treinos gerados<span class="dim"> (mês)</span></span>
            <span>${data.quota.workouts.used} / ${data.quota.workouts.limit >= 100000 ? '∞' : data.quota.workouts.limit}</span></div>
          <div class="kv"><span>Mensagens no Personal IA</span>
            <span>${data.quota.chats.used} / ${data.quota.chats.limit >= 100000 ? '∞' : data.quota.chats.limit}</span></div>
          <a href="/planos" data-link class="btn ${App.user.plan === 'free' ? 'btn-primary' : 'btn-ghost'} btn-block mt2">
            ${App.user.plan === 'free' ? 'Fazer upgrade para Pro' : 'Gerenciar assinatura'}</a>
        </div>

        <div class="card" style="border-color:rgba(198,244,50,.22);background:linear-gradient(150deg,rgba(198,244,50,.08),transparent 60%),var(--surface)">
          <div class="row mb2"><div class="feature-icon" style="margin:0;width:36px;height:36px">${icon('chat')}</div>
            <strong class="fs14">Personal IA</strong></div>
          <p class="fs13 muted" style="margin:0 0 14px">Dúvidas sobre execução, substituições ou divisão de treino? Pergunte ao seu treinador IA.</p>
          <a href="/personal-ia" data-link class="btn btn-primary btn-block btn-sm">${icon('chat')} Abrir chat</a>
        </div>

        ${!data.ai_configured ? `<div class="alert alert-warn">${icon('alert')}<div><strong>IA não configurada.</strong> Um administrador precisa configurar a chave de IA no painel admin para gerar treinos.</div></div>` : ''}
      </div>
    </div>`;

  bindDash();

  function bindDash() {
    document.getElementById('add-weight').onclick = () => {
      const el = openModal(`
        <div class="modal-head"><h3>Registrar peso</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
        <div class="form-grid">
          <div class="field"><label>Peso</label><div class="measure-input"><input class="input" id="w-val" type="number" step="0.1" min="25" max="350" placeholder="82.4" value="${weights.length ? weights[weights.length - 1].weight_kg : ''}"><span class="unit">kg</span></div></div>
          <div class="field"><label>Data</label><input class="input" id="w-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field full"><label>Observação (opcional)</label><input class="input" id="w-note" placeholder="Ex.: em jejum, pela manhã"></div>
        </div>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button>
        <button class="btn btn-primary" id="w-save">Salvar</button></div>`, { onMount(m) {
        m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
        m.querySelector('#w-save').onclick = async () => {
          const v = Number(m.querySelector('#w-val').value);
          if (!v) { toast('Informe o peso.', 'warn'); return; }
          try {
            await API.post('/api/profile/weight', { weight_kg: v, date: m.querySelector('#w-date').value, note: m.querySelector('#w-note').value });
            closeModal(); toast('Peso registrado.'); renderDashboard(root);
          } catch (e) { toast(e.message, 'error'); }
        };
      } });
    };

    document.getElementById('add-goal').onclick = () => {
      const el = openModal(`
        <div class="modal-head"><h3>Nova meta</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
        <div class="form-grid">
          <div class="field full"><label>Título da meta</label><input class="input" id="g-title" placeholder="Ex.: Supino reto — 100 kg"></div>
          <div class="field"><label>Valor atual</label><input class="input" id="g-current" type="number" step="0.5" placeholder="60"></div>
          <div class="field"><label>Valor alvo</label><input class="input" id="g-target" type="number" step="0.5" placeholder="100"></div>
          <div class="field"><label>Unidade</label><input class="input" id="g-unit" placeholder="kg, treinos, cm"></div>
          <div class="field"><label>Prazo (opcional)</label><input class="input" id="g-deadline" type="date"></div>
        </div>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button>
        <button class="btn btn-primary" id="g-save">Criar meta</button></div>`, { onMount(m) {
        m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
        m.querySelector('#g-save').onclick = async () => {
          const title = m.querySelector('#g-title').value.trim();
          if (!title) { toast('Informe o título.', 'warn'); return; }
          try {
            await API.post('/api/profile/goals', {
              title, current: Number(m.querySelector('#g-current').value) || 0,
              target: Number(m.querySelector('#g-target').value) || null,
              unit: m.querySelector('#g-unit').value, deadline: m.querySelector('#g-deadline').value,
            });
            closeModal(); toast('Meta criada.'); renderDashboard(root);
          } catch (e) { toast(e.message, 'error'); }
        };
      } });
    };

    document.querySelectorAll('[data-goal-update]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.goalUpdate;
      const input = document.getElementById('goal-input-' + id);
      try {
        await API.patch('/api/profile/goals/' + id, { current: Number(input.value) });
        toast('Meta atualizada.'); renderDashboard(root);
      } catch (e) { toast(e.message, 'error'); }
    });
    document.querySelectorAll('[data-goal-complete]').forEach((b) => b.onclick = async () => {
      try { await API.patch('/api/profile/goals/' + b.dataset.goalComplete, { status: 'completed' }); toast('Meta concluída! 🎉'); renderDashboard(root); }
      catch (e) { toast(e.message, 'error'); }
    });
  }
}

function renderGoals(goals) {
  if (!goals || !goals.length) {
    return `<div class="empty" style="padding:24px 10px"><div class="empty-icon">${icon('target')}</div><h4>Sem metas ainda</h4><p>Crie metas de carga, peso ou frequência.</p></div>`;
  }
  return goals.map((g) => {
    const pct = g.target ? Math.min(100, Math.round((Number(g.current) / Number(g.target)) * 100)) : 0;
    const done = g.status === 'completed' || pct >= 100;
    return `<div class="goal-row">
      <div class="top"><strong>${esc(g.title)}</strong>
        ${done ? '<span class="badge badge-lime badge-sm">Concluída</span>' : `<span>${fmt.num(g.current, 0)} / ${fmt.num(g.target, 0)} ${esc(g.unit || '')}</span>`}</div>
      <div class="progress"><span style="width:${done ? 100 : pct}%"></span></div>
      <div class="row-between">
        <span class="fs11 dim">${g.deadline ? 'Prazo: ' + fmt.date(g.deadline) : 'Sem prazo'} · ${pct}%</span>
        ${!done ? `<div class="row" style="gap:6px">
          <input class="rec-input" id="goal-input-${g.id}" style="width:64px;height:26px" placeholder="${g.current}">
          <button class="btn btn-ghost" style="height:26px;padding:0 10px;font-size:11px" data-goal-update="${g.id}">Atualizar</button>
          <button class="btn btn-ghost" style="height:26px;padding:0 8px;font-size:11px" data-goal-complete="${g.id}" title="Marcar como concluída">${icon('check')}</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function skeletonDash() {
  return `<div class="grid g4 mb3">${[1, 2, 3, 4].map(() => '<div class="skeleton" style="height:110px"></div>').join('')}</div>
    <div class="dash-grid"><div class="skeleton" style="height:380px"></div><div class="skeleton" style="height:280px"></div></div>`;
}

route('/app', (root) => withAuth(async () => {
  await loadSession();
  if (!profileComplete()) { navigate('/onboarding'); return; }
  renderDashboard(root);
}));

window.renderGoals = renderGoals;
