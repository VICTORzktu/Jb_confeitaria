/* ============================================================
   Painel administrativo
   ============================================================ */
const ADMIN_TABS = [
  { id: 'visao', label: 'Visão geral', icon: 'grid' },
  { id: 'usuarios', label: 'Usuários', icon: 'users' },
  { id: 'exercicios', label: 'Exercícios', icon: 'dumbbell' },
  { id: 'modalidades', label: 'Modalidades', icon: 'list' },
  { id: 'conteudos', label: 'Conteúdos', icon: 'library' },
  { id: 'planos', label: 'Planos e assinaturas', icon: 'creditCard' },
  { id: 'pagamentos', label: 'Config. de pagamentos', icon: 'pix' },
  { id: 'ia', label: 'Integração com IA', icon: 'cpu' },
];

async function renderAdmin(root) {
  const params = new URLSearchParams(location.search);
  let tab = params.get('tab') || 'visao';
  if (!ADMIN_TABS.find((t) => t.id === tab)) tab = 'visao';

  root.innerHTML = appShell({
    title: 'Painel administrativo', crumb: 'FitAI Admin',
    actions: `<span class="badge badge-lime badge-sm">${icon('shield')} Administrador</span>`,
    content: `<div class="admin-layout">
      <nav class="admin-nav" id="admin-nav">
        ${ADMIN_TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === tab ? 'active' : ''}">${icon(t.icon)}${t.label}</button>`).join('')}
      </nav>
      <div id="admin-content"><div class="skeleton" style="height:300px"></div></div>
    </div>`,
  });
  bindShell();

  document.querySelectorAll('#admin-nav [data-tab]').forEach((b) => b.onclick = () => {
    tab = b.dataset.tab;
    document.querySelectorAll('#admin-nav [data-tab]').forEach((x) => x.classList.toggle('active', x === b));
    history.replaceState({}, '', '/admin?tab=' + tab);
    renderTab(tab);
  });

  async function renderTab(t) {
    const el = document.getElementById('admin-content');
    el.innerHTML = `<div class="skeleton" style="height:300px"></div>`;
    try {
      if (t === 'visao') await renderOverview(el);
      if (t === 'usuarios') await renderUsers(el);
      if (t === 'exercicios') await renderExercises(el);
      if (t === 'modalidades') await renderModalities(el);
      if (t === 'conteudos') await renderContent(el);
      if (t === 'planos') await renderAdminPlans(el);
      if (t === 'pagamentos') await renderPaymentsConfig(el);
      if (t === 'ia') await renderAI(el);
    } catch (e) {
      el.innerHTML = `<div class="alert alert-danger">${icon('alert')}<div>${esc(e.message)}</div></div>`;
    }
  }

  /* ----------------------------- Visão geral ----------------------------- */
  async function renderOverview(el) {
    const { stats: s, recentSignups, daily } = await API.get('/api/admin/stats');
    el.innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px">
        <div class="card stat-card"><span class="stat-icon">${icon('users')}</span><span class="stat-label">Usuários</span><span class="stat-value">${s.users}</span><span class="stat-sub">${s.active_7d} ativos nos últimos 7 dias</span></div>
        <div class="card stat-card"><span class="stat-icon">${icon('dumbbell')}</span><span class="stat-label">Treinos gerados</span><span class="stat-value">${s.workouts}</span><span class="stat-sub">${s.sessions} sessões concluídas</span></div>
        <div class="card stat-card"><span class="stat-icon">${icon('cpu')}</span><span class="stat-label">Chamadas de IA</span><span class="stat-value">${s.ai_calls}</span><span class="stat-sub">${s.ai_errors} erros · ${s.ai_configured ? 'configurada' : 'não configurada'}</span></div>
        <div class="card stat-card"><span class="stat-icon">${icon('creditCard')}</span><span class="stat-label">Receita confirmada</span><span class="stat-value">${fmt.brl(s.revenue_cents)}</span><span class="stat-sub">${s.pending_payments} pagamentos pendentes</span></div>
      </div>
      <div class="split-2">
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('chart')} Sessões por dia · 14 dias</h3></div>
          ${daily.length ? Charts.bars({ values: daily.map((d) => d.c), labels: daily.map((d) => d.d.slice(5)), height: 170, unit: ' sessões' }) : '<div class="chart-empty">Sem sessões registradas</div>'}
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('users')} Distribuição de planos</h3></div>
          <div class="row" style="gap:24px;align-items:center">
            ${Charts.donut({ size: 150, segments: [
              { label: 'Gratuito', value: s.free_users, color: '#6f7b75' },
              { label: 'Pro', value: s.pro_users, color: '#c6f432' },
              { label: 'Premium', value: s.premium_users, color: '#b18cff' },
            ] })}
            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="legend"><span><i style="background:#6f7b75"></i>Gratuito · <strong style="color:var(--text)">${s.free_users}</strong></span></div>
              <div class="legend"><span><i style="background:#c6f432"></i>Pro · <strong style="color:var(--text)">${s.pro_users}</strong></span></div>
              <div class="legend"><span><i style="background:#b18cff"></i>Premium · <strong style="color:var(--text)">${s.premium_users}</strong></span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="split-2 mt3">
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('user')} Cadastros recentes</h3></div>
          ${recentSignups.map((u) => `<div class="list-item">
            <div class="avatar">${initials(u.name)}</div>
            <div class="grow" style="min-width:0"><strong class="fs13" style="display:block">${esc(u.name)}</strong><span class="fs12 dim">${esc(u.email)}</span></div>
            ${badgePlan(u.plan)}</div>`).join('')}
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('shield')} Estado do sistema</h3></div>
          <div class="kv"><span>Integração de IA</span><span class="badge badge-sm ${s.ai_configured ? 'badge-lime' : 'badge-red'}">${s.ai_configured ? s.ai_provider : 'Não configurada'}</span></div>
          <div class="kv"><span>Exercícios na biblioteca</span><span>${s.exercises}</span></div>
          <div class="kv"><span>Mensagens no Personal IA</span><span>${s.chats}</span></div>
          <div class="kv"><span>Administradores</span><span>${s.admins}</span></div>
          ${!s.ai_configured ? `<button class="btn btn-primary btn-block btn-sm mt2" id="go-ai">${icon('cpu')} Configurar IA agora</button>` : ''}
        </div>
      </div>`;
    document.getElementById('go-ai')?.addEventListener('click', () => { document.querySelector('[data-tab="ia"]').click(); });
  }

  /* ----------------------------- Usuários ----------------------------- */
  async function renderUsers(el) {
    const { users } = await API.get('/api/admin/users');
    el.innerHTML = `
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('users')} Usuários (${users.length})</h3>
          <div class="input-icon" style="width:240px">${icon('search')}<input class="input" id="adm-user-search" placeholder="Buscar por nome ou e-mail" style="height:36px;font-size:13px"></div></div>
        <div class="table-wrap"><table id="users-table">
          <thead><tr><th>Usuário</th><th>Plano</th><th>Papel</th><th>Sessões</th><th>Último treino</th><th>Cadastro</th><th></th></tr></thead>
          <tbody>${users.map((u) => `
            <tr data-row="${u.id}">
              <td><div class="row" style="gap:10px"><div class="avatar" style="width:30px;height:30px;font-size:11px">${initials(u.name)}</div>
                <div><strong style="display:block;font-size:13px">${esc(u.name)}</strong><span class="fs11 dim">${esc(u.email)}</span></div></div></td>
              <td>${badgePlan(u.plan)}</td>
              <td>${u.role === 'admin' ? '<span class="badge badge-sm badge-blue">Admin</span>' : '<span class="fs12 dim">Aluno</span>'}</td>
              <td>${u.sessions}</td>
              <td class="fs12 dim nowrap">${u.last_session ? fmt.date(u.last_session) : '—'}</td>
              <td class="fs12 dim nowrap">${fmt.date(u.created_at)}</td>
              <td><div class="row" style="gap:4px;justify-content:flex-end">
                <button class="btn-icon" data-edit-user="${u.id}" title="Editar">${icon('edit')}</button>
                <button class="btn-icon" data-del-user="${u.id}" title="Excluir">${icon('trash')}</button>
              </div></td>
            </tr>`).join('')}</tbody>
        </table></div>
      </div>`;

    const search = document.getElementById('adm-user-search');
    search.oninput = () => {
      const q = search.value.toLowerCase();
      document.querySelectorAll('#users-table tbody tr').forEach((tr) => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };

    document.querySelectorAll('[data-edit-user]').forEach((b) => b.onclick = () => {
      const u = users.find((x) => x.id === Number(b.dataset.editUser));
      openModal(`
        <div class="modal-head"><h3>Editar usuário</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
        <div class="fs13 muted mb2">${esc(u.email)} · cadastrado em ${fmt.date(u.created_at)}</div>
        <div class="field"><label>Nome</label><input class="input" id="eu-name" value="${esc(u.name)}"></div>
        <div class="form-grid mt2">
          <div class="field"><label>Plano</label><select class="select" id="eu-plan">
            ${['free', 'pro', 'premium'].map((p) => `<option value="${p}" ${u.plan === p ? 'selected' : ''}>${p === 'free' ? 'Gratuito' : p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select></div>
          <div class="field"><label>Papel</label><select class="select" id="eu-role">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>Aluno</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option></select></div>
        </div>
        <div class="field mt2"><label>Redefinir senha (opcional)</label><input class="input" id="eu-pwd" placeholder="Nova senha (mín. 8 caracteres)"></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="eu-save">Salvar</button></div>`,
        { onMount(m) {
          m.querySelectorAll('[data-close]').forEach((x) => x.onclick = closeModal);
          m.querySelector('#eu-save').onclick = async () => {
            try {
              const body = { name: m.querySelector('#eu-name').value, plan: m.querySelector('#eu-plan').value, role: m.querySelector('#eu-role').value };
              if (m.querySelector('#eu-pwd').value) body.new_password = m.querySelector('#eu-pwd').value;
              await API.patch('/api/admin/users/' + u.id, body);
              closeModal(); toast('Usuário atualizado.'); renderTab('usuarios');
            } catch (e) { toast(e.message, 'error'); }
          };
        } });
    });
    document.querySelectorAll('[data-del-user]').forEach((b) => b.onclick = async () => {
      const ok = await confirmModal({ title: 'Excluir usuário', message: 'Todos os dados do usuário (treinos, histórico, mensagens) serão removidos permanentemente.', confirmText: 'Excluir', danger: true });
      if (!ok) return;
      try { await API.del('/api/admin/users/' + b.dataset.delUser); toast('Usuário excluído.'); renderTab('usuarios'); }
      catch (e) { toast(e.message, 'error'); }
    });
  }

  /* ----------------------------- Exercícios ----------------------------- */
  async function renderExercises(el) {
    const { exercises } = await API.get('/api/admin/exercises');
    el.innerHTML = `
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('dumbbell')} Exercícios (${exercises.length})</h3>
          <button class="btn btn-primary btn-sm" id="adm-new-ex">${icon('plus')} Novo exercício</button></div>
        <div class="input-icon mb2">${icon('search')}<input class="input" id="adm-ex-search" placeholder="Buscar exercício..." style="height:38px;font-size:13px"></div>
        <div class="table-wrap"><table id="ex-table">
          <thead><tr><th>Exercício</th><th>Músculo</th><th>Equipamento</th><th>Dificuldade</th><th>Premium</th><th>Ativo</th><th></th></tr></thead>
          <tbody>${exercises.map((ex) => `<tr>
            <td><strong style="font-size:13px">${esc(ex.name)}</strong></td>
            <td class="fs12 dim">${esc(ex.primary_muscle)}</td>
            <td class="fs12 dim">${esc(ex.equipment)}</td>
            <td><span class="badge badge-sm">${esc(ex.difficulty)}</span></td>
            <td>${ex.is_premium ? '<span class="badge badge-purple badge-sm">Premium</span>' : '<span class="fs12 dim">—</span>'}</td>
            <td><button class="toggle ${ex.is_active ? 'on' : ''}" data-toggle-ex="${ex.id}"></button></td>
            <td><div class="row" style="gap:4px;justify-content:flex-end">
              <button class="btn-icon" data-edit-ex="${ex.id}">${icon('edit')}</button>
              <button class="btn-icon" data-del-ex="${ex.id}">${icon('trash')}</button></div></td>
          </tr>`).join('')}</tbody></table></div>
      </div>`;

    const search = document.getElementById('adm-ex-search');
    search.oninput = () => { const q = search.value.toLowerCase(); document.querySelectorAll('#ex-table tbody tr').forEach((tr) => tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'); };
    document.getElementById('adm-new-ex').onclick = () => exerciseForm(null);
    document.querySelectorAll('[data-edit-ex]').forEach((b) => b.onclick = () => exerciseForm(exercises.find((e) => e.id === Number(b.dataset.editEx))));
    document.querySelectorAll('[data-toggle-ex]').forEach((b) => b.onclick = async () => {
      const ex = exercises.find((e) => e.id === Number(b.dataset.toggleEx));
      await API.patch('/api/admin/exercises/' + ex.id, { is_active: !ex.is_active });
      b.classList.toggle('on'); toast('Status atualizado.');
    });
    document.querySelectorAll('[data-del-ex]').forEach((b) => b.onclick = async () => {
      const ok = await confirmModal({ title: 'Excluir exercício', message: 'A biblioteca perderá este exercício. Deseja continuar?', confirmText: 'Excluir', danger: true });
      if (!ok) return;
      await API.del('/api/admin/exercises/' + b.dataset.delEx);
      toast('Exercício excluído.'); renderTab('exercicios');
    });

    function exerciseForm(ex) {
      const isNew = !ex;
      const { modalities } = window.__modalitiesCache || { modalities: [] };
      openModal(`
        <div class="modal-head"><h3>${isNew ? 'Novo exercício' : 'Editar exercício'}</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
        <div class="form-row">
          <div class="field full"><label>Nome</label><input class="input" id="ef-name" value="${esc(ex?.name || '')}"></div>
          <div class="field"><label>Músculo principal</label><input class="input" id="ef-primary" value="${esc(ex?.primary_muscle || '')}" list="muscle-list" placeholder="Ex.: Peito">
            <datalist id="muscle-list">${MUSCLES.map((m) => `<option value="${m}">`).join('')}</datalist></div>
          <div class="field"><label>Equipamento</label><input class="input" id="ef-equipment" value="${esc(ex?.equipment || '')}" list="equip-list">
            <datalist id="equip-list">${EQUIPMENTS.map((m) => `<option value="${m}">`).join('')}</datalist></div>
          <div class="field"><label>Dificuldade</label><select class="select" id="ef-difficulty">${['Iniciante', 'Intermediário', 'Avançado'].map((d) => `<option ${ex?.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          <div class="field"><label>Músculos secundários (separados por vírgula)</label><input class="input" id="ef-secondary" value="${esc((ex?.secondary_muscles || []).join(', '))}"></div>
          <div class="field full"><label>Execução correta</label><textarea class="textarea" id="ef-instructions">${esc(ex?.instructions || '')}</textarea></div>
          <div class="field full"><label>Erros comuns</label><textarea class="textarea" id="ef-errors">${esc(ex?.common_errors || '')}</textarea></div>
          <div class="field full"><label>Dica</label><input class="input" id="ef-tips" value="${esc(ex?.tips || '')}"></div>
          <div class="field full"><label>URL de vídeo (opcional)</label><input class="input" id="ef-video" value="${esc(ex?.video_url || '')}" placeholder="https://..."></div>
          <div class="field"><label>Exercício premium</label><label class="row fs13 muted" style="gap:8px;cursor:pointer"><input type="checkbox" id="ef-premium" ${ex?.is_premium ? 'checked' : ''} style="accent-color:var(--lime);width:16px;height:16px">Restrito a planos pagos</label></div>
        </div>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="ef-save">${isNew ? 'Criar exercício' : 'Salvar'}</button></div>`,
        { size: 'modal-lg', onMount(m) {
          m.querySelectorAll('[data-close]').forEach((x) => x.onclick = closeModal);
          m.querySelector('#ef-save').onclick = async () => {
            const body = {
              name: m.querySelector('#ef-name').value, primary_muscle: m.querySelector('#ef-primary').value,
              equipment: m.querySelector('#ef-equipment').value, difficulty: m.querySelector('#ef-difficulty').value,
              secondary_muscles: m.querySelector('#ef-secondary').value.split(',').map((s) => s.trim()).filter(Boolean),
              instructions: m.querySelector('#ef-instructions').value, common_errors: m.querySelector('#ef-errors').value,
              tips: m.querySelector('#ef-tips').value, video_url: m.querySelector('#ef-video').value,
              is_premium: m.querySelector('#ef-premium').checked,
            };
            try {
              if (isNew) await API.post('/api/admin/exercises', body);
              else await API.patch('/api/admin/exercises/' + ex.id, body);
              closeModal(); toast(isNew ? 'Exercício criado.' : 'Exercício atualizado.'); renderTab('exercicios');
            } catch (e) { toast(e.message, 'error'); }
          };
        } });
    }
  }

  /* ----------------------------- Modalidades ----------------------------- */
  async function renderModalities(el) {
    const { modalities } = await API.get('/api/admin/modalities');
    window.__modalitiesCache = { modalities };
    el.innerHTML = `
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('list')} Modalidades (${modalities.length})</h3>
          <button class="btn btn-primary btn-sm" id="adm-new-mod">${icon('plus')} Nova modalidade</button></div>
        <div class="grid g2">
          ${modalities.map((m) => `
            <div class="card card-tight" style="display:flex;gap:12px;align-items:flex-start">
              <div class="feature-icon" style="margin:0;width:36px;height:36px;flex:none">${icon(m.icon || 'dumbbell')}</div>
              <div class="grow" style="min-width:0">
                <div class="row" style="gap:8px"><strong class="fs13">${esc(m.name)}</strong>
                  ${m.is_active ? '<span class="badge badge-lime badge-sm">Ativa</span>' : '<span class="badge badge-sm">Inativa</span>'}</div>
                <p class="fs12 dim" style="margin:4px 0 0">${esc(m.description || 'Sem descrição')}</p>
              </div>
              <button class="btn-icon" data-del-mod="${m.id}">${icon('trash')}</button>
            </div>`).join('')}
        </div>
      </div>`;
    document.getElementById('adm-new-mod').onclick = () => {
      openModal(`<div class="modal-head"><h3>Nova modalidade</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
        <div class="field"><label>Nome</label><input class="input" id="nm-name" placeholder="Ex.: Natação"></div>
        <div class="field mt2"><label>Descrição</label><textarea class="textarea" id="nm-desc" placeholder="Breve descrição"></textarea></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="nm-save">Criar</button></div>`,
        { onMount(m) {
          m.querySelectorAll('[data-close]').forEach((x) => x.onclick = closeModal);
          m.querySelector('#nm-save').onclick = async () => {
            try { await API.post('/api/admin/modalities', { name: m.querySelector('#nm-name').value, description: m.querySelector('#nm-desc').value }); closeModal(); toast('Modalidade criada.'); renderTab('modalidades'); }
            catch (e) { toast(e.message, 'error'); }
          };
        } });
    };
    document.querySelectorAll('[data-del-mod]').forEach((b) => b.onclick = async () => {
      const ok = await confirmModal({ title: 'Excluir modalidade', message: 'Deseja remover esta modalidade?', confirmText: 'Excluir', danger: true });
      if (!ok) return;
      await API.del('/api/admin/modalities/' + b.dataset.delMod); toast('Modalidade excluída.'); renderTab('modalidades');
    });
  }

  /* ----------------------------- Conteúdos ----------------------------- */
  async function renderContent(el) {
    const { content } = await API.get('/api/admin/content');
    el.innerHTML = `
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('library')} Conteúdos (${content.length})</h3>
          <button class="btn btn-primary btn-sm" id="adm-new-content">${icon('plus')} Novo conteúdo</button></div>
        ${content.map((c) => `
          <div class="list-item" style="align-items:flex-start">
            <div class="activity-icon">${icon(c.kind === 'aviso' ? 'alert' : 'library')}</div>
            <div class="grow" style="min-width:0"><strong class="fs13" style="display:block">${esc(c.title)}</strong>
              <span class="fs12 dim" style="display:block;max-width:640px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.body)}</span>
              <span class="badge badge-sm mt1">${esc(c.kind)}</span>
              ${c.is_published ? '' : '<span class="badge badge-sm badge-orange">Rascunho</span>'}</div>
            <button class="btn-icon" data-del-content="${c.id}">${icon('trash')}</button>
          </div>`).join('') || '<div class="empty"><p>Nenhum conteúdo.</p></div>'}
      </div>`;
    document.getElementById('adm-new-content').onclick = () => {
      openModal(`<div class="modal-head"><h3>Novo conteúdo</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
        <div class="field"><label>Título</label><input class="input" id="nc-title"></div>
        <div class="field mt2"><label>Tipo</label><select class="select" id="nc-kind"><option value="artigo">Artigo</option><option value="aviso">Aviso</option><option value="dica">Dica</option></select></div>
        <div class="field mt2"><label>Conteúdo</label><textarea class="textarea" id="nc-body" style="min-height:160px"></textarea></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="nc-save">Publicar</button></div>`,
        { onMount(m) {
          m.querySelectorAll('[data-close]').forEach((x) => x.onclick = closeModal);
          m.querySelector('#nc-save').onclick = async () => {
            try { await API.post('/api/admin/content', { title: m.querySelector('#nc-title').value, kind: m.querySelector('#nc-kind').value, body: m.querySelector('#nc-body').value }); closeModal(); toast('Conteúdo publicado.'); renderTab('conteudos'); }
            catch (e) { toast(e.message, 'error'); }
          };
        } });
    };
    document.querySelectorAll('[data-del-content]').forEach((b) => b.onclick = async () => {
      await API.del('/api/admin/content/' + b.dataset.delContent); toast('Conteúdo removido.'); renderTab('conteudos');
    });
  }

  /* ----------------------------- Planos e assinaturas ----------------------------- */
  async function renderAdminPlans(el) {
    const data = await API.get('/api/admin/plans');
    el.innerHTML = `
      <div class="grid g3 mb3">
        ${data.plans.map((p) => `<div class="card">
          <div class="row-between"><strong style="font-family:var(--font-display)">${p.name}</strong>${p.id !== 'free' ? `<span class="fs12 dim">${data.subscriptions.find((s) => s.plan === p.id)?.c || 0} assinantes</span>` : `<span class="fs12 dim">${data.subscriptions.find((s) => s.plan === 'free')?.c || 0} usuários</span>`}</div>
          <div class="price mt2" style="font-family:var(--font-display);font-size:26px">${p.id === 'free' ? 'Gratuito' : fmt.brl(data.prices[p.id])}<small style="font-size:12px;color:var(--text-3)">${p.id === 'free' ? '' : '/mês'}</small></div>
          ${p.id !== 'free' ? `<div class="field mt2"><label class="fs12">Alterar preço (centavos)</label>
            <div class="row" style="gap:6px"><input class="input" type="number" id="price-${p.id}" value="${data.prices[p.id]}" style="height:36px;font-size:13px">
            <button class="btn btn-dark btn-sm" data-save-price="${p.id}">Salvar</button></div></div>` : '<p class="fs12 dim mt2">Plano base, sempre disponível.</p>'}
        </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-head"><h3 class="card-title">${icon('creditCard')} Pagamentos</h3></div>
        ${data.payments.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Ref</th><th>Usuário</th><th>Plano</th><th>Valor</th><th>Método</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
          <tbody>${data.payments.map((p) => {
            const st = { paid: ['Pago', 'badge-lime'], awaiting_payment: ['Aguardando', 'badge-orange'], pending: ['Pendente', 'badge-orange'], cancelled: ['Cancelado', 'badge-red'] }[p.status] || ['—', ''];
            return `<tr><td class="mono fs12">${esc(p.ref)}</td>
              <td><strong class="fs13">${esc(p.user_name)}</strong><span class="fs11 dim" style="display:block">${esc(p.user_email)}</span></td>
              <td>${esc(p.plan)}</td><td>${fmt.brl(p.amount_cents)}</td><td>${p.method}</td>
              <td><span class="badge badge-sm ${st[1]}">${st[0]}</span></td><td class="fs12 dim nowrap">${fmt.date(p.created_at)}</td>
              <td><div class="row" style="gap:4px">${p.status !== 'paid' ? `<button class="btn btn-primary btn-sm" data-confirm-pay="${p.id}">Confirmar</button><button class="btn-icon" data-cancel-pay="${p.id}">${icon('x')}</button>` : `<span class="fs11 dim">${fmt.date(p.paid_at)}</span>`}</div></td></tr>`;
          }).join('')}</tbody></table></div>` : '<div class="empty"><div class="empty-icon">' + icon('creditCard') + '</div><h4>Nenhum pagamento</h4><p>Os pagamentos dos usuários aparecerão aqui.</p></div>'}
      </div>`;

    document.querySelectorAll('[data-save-price]').forEach((b) => b.onclick = async () => {
      const id = b.dataset.savePrice;
      try {
        await API.put('/api/admin/plans/' + id + '/price', { price_cents: Number(document.getElementById('price-' + id).value) });
        toast('Preço atualizado.'); renderTab('planos');
      } catch (e) { toast(e.message, 'error'); }
    });
    document.querySelectorAll('[data-confirm-pay]').forEach((b) => b.onclick = async () => {
      const ok = await confirmModal({ title: 'Confirmar pagamento', message: 'Confirme somente após verificar o recebimento. O plano será ativado por 30 dias.', confirmText: 'Confirmar pagamento' });
      if (!ok) return;
      try { const r = await API.post('/api/admin/payments/' + b.dataset.confirmPay + '/confirm'); toast(r.message); renderTab('planos'); }
      catch (e) { toast(e.message, 'error'); }
    });
    document.querySelectorAll('[data-cancel-pay]').forEach((b) => b.onclick = async () => {
      await API.post('/api/admin/payments/' + b.dataset.cancelPay + '/cancel');
      toast('Cobrança cancelada.'); renderTab('planos');
    });
  }

  /* ----------------------------- Config. de pagamentos ----------------------------- */
  async function renderPaymentsConfig(el) {
    const cfg = await API.get('/api/admin/payments-config');
    el.innerHTML = `
      <div class="split-2">
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('pix')} Pix (BR Code)</h3><span class="badge badge-sm ${cfg.pix_key ? 'badge-lime' : 'badge-orange'}">${cfg.pix_key ? 'Configurado' : 'Não configurado'}</span></div>
          <p class="fs13 muted" style="margin-top:0">Informe a chave Pix que receberá os pagamentos. O sistema gera o BR Code EMV com QR Code e código copia-e-cola automaticamente.</p>
          <div class="field"><label>Chave Pix (CPF/CNPJ, e-mail, telefone ou aleatória)</label><input class="input" id="pay-pix-key" value="${esc(cfg.pix_key)}" placeholder="pagamentos@fitai.app"></div>
          <div class="form-row mt2">
            <div class="field"><label>Nome do recebedor</label><input class="input" id="pay-pix-holder" value="${esc(cfg.pix_holder)}" maxlength="25" placeholder="FITAI"></div>
            <div class="field"><label>Cidade</label><input class="input" id="pay-pix-city" value="${esc(cfg.pix_city)}" maxlength="15" placeholder="SAO PAULO"></div>
          </div>
          <button class="btn btn-primary mt3" id="save-pix">${icon('check')} Salvar configuração Pix</button>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('creditCard')} Cartão de crédito</h3></div>
          <p class="fs13 muted" style="margin-top:0">A estrutura de cobrança por cartão está implementada no backend (criação de intenção de pagamento, status e webhook-ready). Informe o provedor (ex.: Stripe, Mercado Pago, Pagar.me, Asaas) para ativar.</p>
          <div class="field"><label>Provedor</label><input class="input" id="pay-card-provider" value="${esc(cfg.card_provider)}" placeholder="stripe / mercadopago / pagarme"></div>
          <div class="field mt2"><label>Status da integração</label>
            <select class="select" id="pay-card-status">
              <option value="not_configured" ${cfg.card_provider_status === 'not_configured' ? 'selected' : ''}>Não configurada</option>
              <option value="sandbox" ${cfg.card_provider_status === 'sandbox' ? 'selected' : ''}>Sandbox / testes</option>
              <option value="live" ${cfg.card_provider_status === 'live' ? 'selected' : ''}>Produção</option>
            </select></div>
          <div class="alert alert-info mt2">${icon('info')}<div style="font-size:12px">Chaves de PSP devem ficar em variáveis de ambiente no servidor, nunca no navegador. O arquivo <span class="inline-code">.env.example</span> documenta as variáveis.</div></div>
          <button class="btn btn-dark mt2" id="save-card">${icon('check')} Salvar configuração de cartão</button>
        </div>
      </div>`;
    document.getElementById('save-pix').onclick = async () => {
      try {
        await API.put('/api/admin/payments-config', { pix_key: document.getElementById('pay-pix-key').value, pix_holder: document.getElementById('pay-pix-holder').value, pix_city: document.getElementById('pay-pix-city').value });
        toast('Configuração Pix salva.'); renderTab('pagamentos');
      } catch (e) { toast(e.message, 'error'); }
    };
    document.getElementById('save-card').onclick = async () => {
      try {
        await API.put('/api/admin/payments-config', { card_provider: document.getElementById('pay-card-provider').value, card_provider_status: document.getElementById('pay-card-status').value });
        toast('Configuração de cartão salva.');
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  /* ----------------------------- Integração com IA ----------------------------- */
  async function renderAI(el) {
    const data = await API.get('/api/admin/ai');
    const c = data.config;
    el.innerHTML = `
      <div class="grid g2" style="align-items:start">
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('cpu')} Configuração do provedor</h3>
            <span class="badge badge-sm ${c.configured ? 'badge-lime' : 'badge-orange'}">${c.configured ? 'Configurada' : 'Não configurada'}</span></div>
          <div class="field"><label>Provedor de IA</label>
            <select class="select" id="ai-provider">
              <option value="">— Selecione —</option>
              ${data.providers.map((p) => `<option value="${p.id}" ${c.provider === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
            <span class="hint">A chave é armazenada apenas no servidor e nunca é enviada ao navegador.</span></div>
          <div class="field mt2"><label>Modelo</label>
            <input class="input" id="ai-model" value="${esc(c.model)}" placeholder="ex.: gpt-4o-mini">
            <span class="hint" id="ai-default-model"></span></div>
          <div class="field mt2"><label>Chave de API ${c.has_key ? `<span class="lime">(atual: ${esc(c.api_key_masked)})</span>` : ''}</label>
            <input class="input" type="password" id="ai-key" placeholder="${c.has_key ? 'Deixe em branco para manter a chave atual' : 'sk-...'}">
            ${c.has_key ? `<label class="row fs12 dim mt1" style="gap:7px;cursor:pointer"><input type="checkbox" id="ai-clear-key" style="accent-color:var(--lime)">Remover chave salva</label>` : ''}</div>
          <div class="field mt2"><label>URL base (opcional)</label>
            <input class="input" id="ai-base" value="${esc(c.base_url)}" placeholder="https://api.openai.com/v1"></div>
          <div class="field mt2"><label>Gateway / proxy reverso (opcional)</label>
            <input class="input" id="ai-proxy" value="${esc(c.proxy_url || '')}" placeholder="https://gateway.exemplo.com/v1 (compatível com OpenAI)">
            <span class="hint">Se preenchido, as chamadas vão para este endpoint compatível com OpenAI em vez do provedor direto. Útil para centralizar chaves em um gateway.</span></div>
          <div class="field mt2"><label>Token do gateway ${c.has_proxy_token ? `<span class="lime">(${esc(c.proxy_token_masked)})</span>` : ''}</label>
            <input class="input" type="password" id="ai-proxy-token" placeholder="${c.has_proxy_token ? 'Deixe em branco para manter' : 'opcional'}"></div>
          <div class="field mt2"><label>Temperatura: <span id="temp-val" class="lime">${c.temperature}</span></label>
            <input type="range" id="ai-temp" min="0" max="1.2" step="0.1" value="${c.temperature}"></div>
          <div class="row mt3 wrap" style="gap:8px">
            <button class="btn btn-primary grow" id="save-ai">${icon('check')} Salvar configuração</button>
            <button class="btn btn-dark" id="test-ai">${icon('zap')} Testar conexão</button>
          </div>
          <div id="ai-test-result" class="mt2"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:18px">
          <div class="card">
            <div class="card-head"><h3 class="card-title">${icon('chart')} Uso da IA</h3></div>
            ${data.usage.length ? data.usage.map((u) => `<div class="kv"><span>${u.feature === 'workout' ? 'Geração de treinos' : u.feature === 'chat' ? 'Personal IA (chat)' : u.feature === 'substitute' ? 'Substituições' : 'Progressão'}</span>
              <span>${u.total} chamadas · ${u.ok_count} ok</span></div>`).join('') : '<p class="fs13 dim">Nenhuma chamada registrada ainda.</p>'}
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">${icon('alert')} Erros recentes</h3></div>
            ${data.recentErrors.length ? data.recentErrors.map((e) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
              <div class="fs12" style="color:#ffb3ba">${esc(e.error || 'erro desconhecido')}</div>
              <div class="fs11 dim">${esc(e.feature)} · ${esc(e.provider || '—')} · ${fmt.date(e.created_at)} ${fmt.time(e.created_at)}</div></div>`).join('') : '<p class="fs13 dim">Nenhum erro registrado.</p>'}
          </div>
          <div class="card card-tight">
            <div class="row mb2">${icon('shield')}<strong class="fs12">Boas práticas</strong></div>
            <ul class="fs12 dim" style="display:flex;flex-direction:column;gap:6px;padding-left:14px;list-style:disc">
              <li>Use chaves com escopo mínimo e monitore o consumo.</li>
              <li>Em produção, prefira variáveis de ambiente (.env).</li>
              <li>O FitAI aplica filtros de segurança em todo plano gerado.</li>
            </ul>
          </div>
        </div>
      </div>`;

    const providerSel = document.getElementById('ai-provider');
    const modelInput = document.getElementById('ai-model');
    const baseInput = document.getElementById('ai-base');
    const defaultHint = document.getElementById('ai-default-model');
    function applyProviderDefaults() {
      const p = data.providers.find((x) => x.id === providerSel.value);
      if (p) {
        defaultHint.textContent = `Padrão: ${p.default_model}`;
        if (!modelInput.value || data.providers.some((x) => x.default_model === modelInput.value)) modelInput.value = p.default_model;
        if (!baseInput.value || data.providers.some((x) => x.base_url === baseInput.value)) baseInput.value = p.base_url;
      }
    }
    providerSel.onchange = applyProviderDefaults;
    applyProviderDefaults();

    document.getElementById('ai-temp').oninput = (e) => document.getElementById('temp-val').textContent = e.target.value;

    document.getElementById('save-ai').onclick = async (e) => {
      const btn = e.currentTarget;
      setLoading(btn, true, 'Salvando...');
      try {
        await API.put('/api/admin/ai', {
          provider: providerSel.value, model: modelInput.value, base_url: baseInput.value,
          temperature: Number(document.getElementById('ai-temp').value),
          api_key: document.getElementById('ai-key').value || undefined,
          clear_key: document.getElementById('ai-clear-key')?.checked || false,
          proxy_url: document.getElementById('ai-proxy').value,
          proxy_token: document.getElementById('ai-proxy-token').value || undefined,
        });
        setLoading(btn, false);
        toast('Configuração de IA salva.');
        renderTab('ia');
      } catch (err) { setLoading(btn, false); toast(err.message, 'error'); }
    };

    document.getElementById('test-ai').onclick = async (e) => {
      const btn = e.currentTarget;
      const out = document.getElementById('ai-test-result');
      setLoading(btn, true, 'Testando...');
      out.innerHTML = '';
      try {
        const r = await API.post('/api/admin/ai/test');
        setLoading(btn, false);
        out.innerHTML = r.ok
          ? `<div class="alert alert-lime">${icon('checkCircle')}<div><strong>Conexão funcionando!</strong><br>Provedor: ${esc(r.provider)} · Modelo: ${esc(r.model)} · Latência: ${r.latency_ms}ms<br><span class="fs12">Resposta: "${esc(r.sample)}"</span></div></div>`
          : `<div class="alert alert-danger">${icon('alert')}<div><strong>Falha na conexão:</strong> ${esc(r.error)}</div></div>`;
      } catch (err) {
        setLoading(btn, false);
        out.innerHTML = `<div class="alert alert-danger">${icon('alert')}<div>${esc(err.message)}</div></div>`;
      }
    };
  }

  await renderTab(tab);
}

route('/admin', (root) => withAuth(() => {
  if (App.user?.role !== 'admin') { navigate('/app'); return; }
  renderAdmin(root);
}));
