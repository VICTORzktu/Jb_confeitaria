/* ============================================================
   Progresso — evolução, histórico e recordes
   ============================================================ */
async function renderProgress(root) {
  root.innerHTML = appShell({
    title: 'Progresso', crumb: 'Evolução e histórico',
    content: `<div class="grid g4 mb3">${[1, 2, 3, 4].map(() => '<div class="skeleton" style="height:104px"></div>').join('')}</div>
      <div class="skeleton" style="height:300px;margin-bottom:18px"></div><div class="skeleton" style="height:260px"></div>`,
  });
  bindShell();

  let dash, sessions, report = null;
  try {
    [dash, sessions] = await Promise.all([API.get('/api/dashboard'), API.get('/api/sessions?limit=100')]);
    if (App.user.plan !== 'free') {
      try { report = await API.get('/api/dashboard/report'); } catch {}
    }
  } catch (e) {
    document.getElementById('app-content').innerHTML = `<div class="alert alert-danger">${icon('alert')}<div>${esc(e.message)}</div></div>`;
    return;
  }

  const st = dash.stats;
  const weights = dash.weights || [];
  const content = document.getElementById('app-content');
  const weightDelta = weights.length >= 2 ? weights[weights.length - 1].weight_kg - weights[0].weight_kg : null;

  content.innerHTML = `
    <div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px">
      <div class="card stat-card"><span class="stat-icon">${icon('fire')}</span><span class="stat-label">Total de treinos</span><span class="stat-value">${st.total_sessions}</span><span class="stat-sub">${st.sessions_28d} nos últimos 28 dias</span></div>
      <div class="card stat-card"><span class="stat-icon">${icon('zap')}</span><span class="stat-label">Volume · 28 dias</span><span class="stat-value">${fmt.volume(st.volume_28d)}</span><span class="stat-sub">soma de séries × reps × carga</span></div>
      <div class="card stat-card"><span class="stat-icon">${icon('scale')}</span><span class="stat-label">Peso atual</span>
        <span class="stat-value">${weights.length ? fmt.num(weights[weights.length - 1].weight_kg, 1) + ' kg' : '—'}</span>
        <span class="stat-sub">${weightDelta != null ? (weightDelta > 0 ? '+' : '') + fmt.num(weightDelta, 1) + ' kg desde o início' : 'registre seu peso'}</span></div>
      <div class="card stat-card"><span class="stat-icon">${icon('target')}</span><span class="stat-label">Adesão</span><span class="stat-value">${st.adherence != null ? st.adherence + '%' : '—'}</span><span class="stat-sub">${dash.workout ? 'meta de ' + dash.workout.days_per_week + 'x/semana' : 'sem plano ativo'}</span></div>
    </div>

    <div class="split-2">
      <div class="card chart-card">
        <div class="card-head"><h3 class="card-title">${icon('trending')} Peso corporal</h3>
          <button class="btn btn-ghost btn-sm" id="pg-weight">${icon('plus')} Registrar</button></div>
        ${weights.length >= 2 ? Charts.line({ points: weights.map((w) => ({ y: w.weight_kg, xLabel: fmt.date(w.date), label: fmt.date(w.date) })), width: 620, height: 230, yFmt: (v) => fmt.num(v, 1) + ' kg' })
          : `<div class="chart-empty">Registre seu peso em pelo menos 2 datas.</div>`}
      </div>
      <div class="card chart-card">
        <div class="card-head"><h3 class="card-title">${icon('chart')} Frequência semanal</h3></div>
        ${Charts.bars({ values: dash.freq.map((f) => f.sessions), labels: dash.freq.map((f) => fmt.date(f.week_end)), height: 200, unit: ' treinos' })}
        <div class="legend mt2"><span><i style="background:var(--lime)"></i>Treinos concluídos por semana</span></div>
      </div>
    </div>

    <div class="split-2 mt3">
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('dumbbell')} Evolução de cargas</h3></div>
        <div id="loads-chart">${Object.keys(dash.load_series || {}).slice(0, 4).map((k) => {
          const s = dash.load_series[k];
          if (s.length < 2) return '';
          return `<div class="mb3"><div class="row-between mb2"><strong class="fs13">${esc(k)}</strong><span class="fs12 dim">atual ${fmt.num(s[s.length - 1].weight, 1)} kg</span></div>
            ${Charts.line({ points: s.map((p) => ({ y: p.weight, xLabel: fmt.date(p.date), label: fmt.date(p.date) })), width: 620, height: 130, yFmt: (v) => fmt.num(v, 0) + 'kg', color: '#6ea8ff' })}</div>`;
        }).join('') || '<div class="chart-empty">Conclua treinos registrando cargas para acompanhar sua evolução.</div>'}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('award')} Recordes pessoais</h3></div>
        ${report?.prs?.length ? `<div class="pr-grid">${report.prs.map((p) => `
          <div class="pr-card"><div class="name">${esc(p.exercise_name)}</div>
          <div class="val">${fmt.num(p.max_weight, 1)} <small>kg</small></div></div>`).join('')}</div>`
        : `<div class="chart-empty">Seus recordes aparecem aqui conforme você registra cargas.</div>`}
      </div>
    </div>

    ${report ? `
    <div class="card mt3">
      <div class="card-head"><h3 class="card-title">${icon('chart')} Relatório mensal (últimos 6 meses)</h3><span class="badge badge-lime badge-sm">${icon('sparkles')} Pro</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Mês</th><th>Sessões</th><th>Volume</th><th>Duração média</th><th>RPE médio</th></tr></thead>
          <tbody>${report.months.map((m) => `<tr>
            <td style="text-transform:capitalize">${new Date(m.month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</td>
            <td>${m.sessions}</td><td>${fmt.volume(m.volume)}</td><td>${m.avg_duration || '—'} min</td><td>${m.avg_effort || '—'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
      ${report.muscle?.filter((m) => m.muscle).length ? `<div class="mt3"><h4 class="fs13 mb2" style="font-family:var(--font-display)">Distribuição por grupo muscular</h4>
        <div class="row wrap" style="gap:10px">${report.muscle.filter((m) => m.muscle).map((m) => `<span class="badge">${esc(m.muscle)}: ${m.sets} séries</span>`).join('')}</div></div>` : ''}
    </div>` : ''}

    <div class="card mt3">
      <div class="card-head"><h3 class="card-title">${icon('clock')} Histórico completo</h3>
        <span class="fs12 dim">${sessions.sessions.length} sessões</span></div>
      ${sessions.sessions.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Treino</th><th>Duração</th><th>RPE</th><th>Séries</th><th>Volume</th><th></th></tr></thead>
        <tbody>${sessions.sessions.map((s) => `<tr>
          <td class="nowrap">${fmt.date(s.performed_at)} <span class="dim fs12">${fmt.time(s.performed_at)}</span></td>
          <td>${esc(s.name)}</td>
          <td>${s.duration_min || '—'} min</td>
          <td>${s.effort ? `<span class="badge badge-sm ${s.effort >= 9 ? 'badge-orange' : s.effort >= 7 ? '' : 'badge-lime'}">${s.effort}/10</span>` : '—'}</td>
          <td>${s.sets}</td>
          <td>${fmt.volume(s.volume)}</td>
          <td><div class="row" style="gap:4px;justify-content:flex-end">
            <button class="btn-icon" data-session-view="${s.id}" title="Ver detalhes">${icon('eye')}</button>
            <button class="btn-icon" data-session-del="${s.id}" title="Excluir">${icon('trash')}</button>
          </div></td>
        </tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><div class="empty-icon">${icon('dumbbell')}</div><h4>Nenhum treino registrado</h4><p>Conclua um treino para construir seu histórico.</p><a href="/treinos" data-link class="btn btn-primary btn-sm mt2">Ir para meus treinos</a></div>`}
    </div>`;

  document.getElementById('pg-weight').onclick = () => {
    openModal(`
      <div class="modal-head"><h3>Registrar peso</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <div class="form-grid">
        <div class="field"><label>Peso</label><div class="measure-input"><input class="input" id="pw-val" type="number" step="0.1" min="25" max="350" placeholder="82.4" value="${weights.length ? weights[weights.length - 1].weight_kg : ''}"><span class="unit">kg</span></div></div>
        <div class="field"><label>Data</label><input class="input" id="pw-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="pw-save">Salvar</button></div>`,
      { onMount(m) {
        m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
        m.querySelector('#pw-save').onclick = async () => {
          const v = Number(m.querySelector('#pw-val').value);
          if (!v) return toast('Informe o peso.', 'warn');
          try { await API.post('/api/profile/weight', { weight_kg: v, date: m.querySelector('#pw-date').value }); closeModal(); toast('Peso registrado.'); renderProgress(root); }
          catch (e) { toast(e.message, 'error'); }
        };
      } });
  };

  document.querySelectorAll('[data-session-view]').forEach((b) => b.onclick = async () => {
    try {
      const { session, sets } = await API.get('/api/sessions/' + b.dataset.sessionView);
      const byEx = {};
      sets.forEach((s) => { (byEx[s.exercise_name] = byEx[s.exercise_name] || []).push(s); });
      openModal(`
        <div class="modal-head"><div><span class="badge badge-lime badge-sm">${fmt.dateFull(session.performed_at)}</span><h3 style="margin:8px 0 0">${esc(session.name)}</h3></div><button class="btn-icon" data-close>${icon('x')}</button></div>
        <div class="row wrap fs13 muted mb3" style="gap:16px">
          <span class="row" style="gap:6px">${icon('clock')}${session.duration_min || '—'} min</span>
          <span class="row" style="gap:6px">${icon('flame')}RPE ${session.effort || '—'}</span>
          <span class="row" style="gap:6px">${icon('dumbbell')}${sets.length} séries</span>
        </div>
        ${Object.entries(byEx).map(([name, arr]) => `
          <div class="rec-ex-block"><div class="rec-ex-head"><span>${esc(name)}</span><span class="rec-progress">${arr.length} séries</span></div>
          <table class="rec-set-table"><tbody>${arr.sort((a, b) => a.set_number - b.set_number).map((s) => `<tr>
            <td class="dim" style="width:30px">#${s.set_number}</td><td>${s.reps ?? '—'} reps</td><td>${s.weight_kg ? fmt.num(s.weight_kg, 1) + ' kg' : 'peso do corpo'}</td><td>${s.completed ? icon('check') : ''}</td>
          </tr>`).join('')}</tbody></table></div>`).join('')}
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Fechar</button></div>`, { onMount(m) { m.querySelectorAll('[data-close]').forEach((x) => x.onclick = closeModal); } });
    } catch (e) { toast(e.message, 'error'); }
  });

  document.querySelectorAll('[data-session-del]').forEach((b) => b.onclick = async () => {
    const ok = await confirmModal({ title: 'Excluir sessão', message: 'Este registro de treino será removido do seu histórico.', confirmText: 'Excluir', danger: true });
    if (!ok) return;
    try { await API.del('/api/sessions/' + b.dataset.sessionDel); toast('Sessão excluída.'); renderProgress(root); }
    catch (e) { toast(e.message, 'error'); }
  });
}

route('/progresso', (root) => withAuth(() => renderProgress(root)));
