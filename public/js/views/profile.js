/* ============================================================
   Perfil e ajustes
   ============================================================ */
async function renderProfile(root) {
  root.innerHTML = appShell({
    title: 'Perfil e ajustes', crumb: 'Sua conta',
    content: `<div class="skeleton" style="height:300px"></div>`,
  });
  bindShell();

  await loadSession(true);
  const p = App.profile || {};
  const content = document.getElementById('app-content');
  const equipment = safeList(p.equipment);
  const focus = safeList(p.focus_muscles);

  content.innerHTML = `
    <div class="profile-layout">
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="card profile-card">
          <div class="avatar">${initials(App.user.name)}</div>
          <h3 style="font-size:19px;margin-bottom:2px">${esc(App.user.name)}</h3>
          <p class="fs13 dim" style="margin-bottom:12px">${esc(App.user.email)}</p>
          <div class="row" style="justify-content:center;gap:8px">${badgePlan(App.user.plan)}
            <span class="badge badge-sm">${App.user.role === 'admin' ? 'Admin' : 'Aluno'}</span></div>
          <div class="hr"></div>
          <div class="kv"><span>Membro desde</span><span>${fmt.date(App.user.created_at, { month: 'short', year: 'numeric' })}</span></div>
          <div class="kv"><span>Plano</span><span>${App.plan?.name || 'Gratuito'}</span></div>
          ${App.user.plan_expires_at ? `<div class="kv"><span>Renova em</span><span>${fmt.date(App.user.plan_expires_at)}</span></div>` : ''}
          <button class="btn btn-ghost btn-block btn-sm mt2" id="edit-wizard">${icon('edit')} Editar perfil completo</button>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('lock')} Segurança</h3></div>
          <button class="btn btn-dark btn-block btn-sm" id="change-pwd">${icon('lock')} Alterar senha</button>
          <div class="fs11 dim mt2">Sua senha é protegida com hash bcrypt e a sessão usa cookie httpOnly.</div>
        </div>

        <div class="card danger-zone">
          <h4 class="fs13" style="margin-bottom:6px">Zona de perigo</h4>
          <p class="fs12 dim" style="margin:0 0 12px">A exclusão remove permanentemente sua conta, treinos, histórico e mensagens (LGPD).</p>
          <button class="btn btn-danger btn-block btn-sm" id="delete-account">${icon('trash')} Excluir minha conta</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:18px;min-width:0">
        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('user')} Dados pessoais</h3>
            <span class="fs12 dim">Salvamento automático</span></div>
          <div class="form-grid">
            <div class="field"><label>Nome completo</label><input class="input" id="pf-name" value="${esc(App.user.name)}"></div>
            <div class="field"><label>E-mail</label><input class="input" value="${esc(App.user.email)}" disabled title="O e-mail não pode ser alterado"></div>
            <div class="field"><label>Idade</label><div class="measure-input"><input class="input" type="number" id="pf-age" value="${p.age ?? ''}" min="12" max="100"><span class="unit">anos</span></div></div>
            <div class="field"><label>Sexo biológico</label>
              <select class="select" id="pf-sex">
                <option value="M" ${p.sex === 'M' ? 'selected' : ''}>Masculino</option>
                <option value="F" ${p.sex === 'F' ? 'selected' : ''}>Feminino</option>
                <option value="O" ${p.sex === 'O' ? 'selected' : ''}>Prefiro não informar</option>
              </select></div>
            <div class="field"><label>Altura</label><div class="measure-input"><input class="input" type="number" id="pf-height" value="${p.height_cm ?? ''}" min="100" max="250"><span class="unit">cm</span></div></div>
            <div class="field"><label>Peso atual</label><div class="measure-input"><input class="input" type="number" step="0.1" id="pf-weight" value="${p.weight_kg ?? ''}" min="25" max="350"><span class="unit">kg</span></div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('target')} Objetivos e rotina</h3>
            <a href="/onboarding?edit=1" data-link class="fs12 lime" style="font-weight:600">Assistente completo →</a></div>
          <div class="form-grid">
            <div class="field"><label>Objetivo principal</label>
              <select class="select" id="pf-goal">${GOALS.map((g) => `<option value="${g.id}" ${p.goal === g.id ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div>
            <div class="field"><label>Nível</label>
              <select class="select" id="pf-level">${LEVELS.map((l) => `<option value="${l.id}" ${p.level === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}</select></div>
            <div class="field"><label>Dias por semana</label>
              <select class="select" id="pf-days">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<option value="${d}" ${p.days_per_week === d ? 'selected' : ''}>${d} dia${d > 1 ? 's' : ''}</option>`).join('')}</select></div>
            <div class="field"><label>Tempo por treino</label>
              <select class="select" id="pf-minutes">${[30, 45, 60, 75, 90, 120].map((m) => `<option value="${m}" ${p.minutes_per_session === m ? 'selected' : ''}>${m} minutos</option>`).join('')}</select></div>
            <div class="field"><label>Local de treino</label>
              <select class="select" id="pf-location">${LOCATIONS.map((l) => `<option value="${l.id}" ${p.location === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}</select></div>
            <div class="field"><label>Modalidade preferida</label>
              <select class="select" id="pf-modality">${MODALITIES.map((m) => `<option value="${m.id}" ${(sessionStorage.getItem('fitai_intent_modality') || 'musculacao') === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
            <div class="field full"><label>Equipamentos disponíveis</label>
              <div class="opt-grid" id="pf-equipment">${EQUIPMENTS.map((e) => `<button type="button" class="opt ${equipment.includes(e) ? 'active' : ''}" data-eq="${esc(e)}" style="padding:7px 11px;font-size:12px">${icon(equipIcon(e))}${e}</button>`).join('')}</div></div>
            <div class="field full"><label>Foco muscular (opcional)</label>
              <div class="opt-grid" id="pf-focus">${MUSCLES.map((m) => `<button type="button" class="opt ${focus.includes(m) ? 'active' : ''}" data-fc="${esc(m)}" style="padding:7px 11px;font-size:12px">${m}</button>`).join('')}</div></div>
            <div class="field full"><label>Lesões, limitações ou restrições</label>
              <textarea class="textarea" id="pf-injuries" placeholder="Ex.: dor no joelho, hérnia lombar...">${esc(p.injuries || '')}</textarea>
              <span class="hint">${icon('shield')} Essas informações são usadas para remover exercícios contraindicados automaticamente.</span></div>
          </div>
          <div class="row mt3" style="justify-content:flex-end"><button class="btn btn-primary" id="pf-save">${icon('check')} Salvar alterações</button></div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">${icon('scale')} Histórico de peso</h3>
            <button class="btn btn-ghost btn-sm" id="pf-add-weight">${icon('plus')} Registrar</button></div>
          <div id="weight-history"><div class="skeleton" style="height:100px"></div></div>
        </div>
      </div>
    </div>`;

  // equipamentos / foco
  const eqSet = new Set(equipment);
  const fcSet = new Set(focus);
  document.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => {
    const v = b.dataset.eq;
    if (eqSet.has(v)) { eqSet.delete(v); b.classList.remove('active'); } else { eqSet.add(v); b.classList.add('active'); }
  });
  document.querySelectorAll('[data-fc]').forEach((b) => b.onclick = () => {
    const v = b.dataset.fc;
    if (fcSet.has(v)) { fcSet.delete(v); b.classList.remove('active'); } else { fcSet.add(v); b.classList.add('active'); }
  });

  document.getElementById('edit-wizard').onclick = () => navigate('/onboarding?edit=1');

  document.getElementById('pf-save').onclick = async (e) => {
    const btn = e.currentTarget;
    setLoading(btn, true, 'Salvando...');
    try {
      const name = document.getElementById('pf-name').value.trim();
      if (name && name !== App.user.name) {
        const r = await API.put('/api/profile/account', { name });
        App.user.name = r.user.name;
      }
      const res = await API.put('/api/profile', {
        age: Number(document.getElementById('pf-age').value) || undefined,
        sex: document.getElementById('pf-sex').value,
        height_cm: Number(document.getElementById('pf-height').value) || undefined,
        weight_kg: Number(document.getElementById('pf-weight').value) || undefined,
        goal: document.getElementById('pf-goal').value,
        level: document.getElementById('pf-level').value,
        days_per_week: Number(document.getElementById('pf-days').value),
        minutes_per_session: Number(document.getElementById('pf-minutes').value),
        location: document.getElementById('pf-location').value,
        equipment: [...eqSet], focus_muscles: [...fcSet],
        injuries: document.getElementById('pf-injuries').value,
      });
      App.profile = res.profile;
      sessionStorage.setItem('fitai_intent_modality', document.getElementById('pf-modality').value);
      setLoading(btn, false);
      toast('Perfil atualizado com sucesso.');
      renderProfile(root);
    } catch (err) {
      setLoading(btn, false);
      toast(err.message, 'error');
    }
  };

  // histórico de peso
  API.get('/api/profile/weight').then(({ entries }) => {
    const el = document.getElementById('weight-history');
    if (!el) return;
    el.innerHTML = entries.length
      ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Peso</th><th>Nota</th><th></th></tr></thead><tbody>
          ${entries.slice().reverse().slice(0, 12).map((w) => `<tr><td>${fmt.date(w.date)}</td><td><strong>${fmt.num(w.weight_kg, 1)} kg</strong></td>
          <td class="dim fs12">${esc(w.note || '—')}</td>
          <td><button class="btn-icon" data-del-weight="${w.date}" title="Excluir">${icon('trash')}</button></td></tr>`).join('')}
        </tbody></table></div>`
      : '<p class="fs13 dim">Nenhum registro ainda.</p>';
    el.querySelectorAll('[data-del-weight]').forEach((b) => b.onclick = async () => {
      await API.del('/api/profile/weight/' + b.dataset.delWeight);
      toast('Registro removido.');
      renderProfile(root);
    });
  });

  document.getElementById('pf-add-weight').onclick = () => {
    openModal(`<div class="modal-head"><h3>Registrar peso</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <div class="form-grid">
        <div class="field"><label>Peso</label><div class="measure-input"><input class="input" id="pw2" type="number" step="0.1" placeholder="82.4"><span class="unit">kg</span></div></div>
        <div class="field"><label>Data</label><input class="input" id="pw2d" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="pw2s">Salvar</button></div>`,
      { onMount(m) {
        m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
        m.querySelector('#pw2s').onclick = async () => {
          const v = Number(m.querySelector('#pw2').value);
          if (!v) return toast('Informe o peso.', 'warn');
          await API.post('/api/profile/weight', { weight_kg: v, date: m.querySelector('#pw2d').value });
          closeModal(); toast('Peso registrado.'); renderProfile(root);
        };
      } });
  };

  document.getElementById('change-pwd').onclick = () => {
    openModal(`<div class="modal-head"><h3>Alterar senha</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <div class="field"><label>Senha atual</label><input class="input" type="password" id="cp-old" autocomplete="current-password"></div>
      <div class="field mt2"><label>Nova senha</label><input class="input" type="password" id="cp-new" autocomplete="new-password" placeholder="Mínimo 8 caracteres com letras e números"></div>
      <div class="field mt2"><label>Confirmar nova senha</label><input class="input" type="password" id="cp-new2" autocomplete="new-password"></div>
      <div class="error-text hidden mt2" id="cp-err"></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="cp-save">Alterar senha</button></div>`,
      { onMount(m) {
        m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
        m.querySelector('#cp-save').onclick = async () => {
          const err = m.querySelector('#cp-err');
          err.classList.add('hidden');
          if (m.querySelector('#cp-new').value !== m.querySelector('#cp-new2').value) {
            err.textContent = 'As senhas novas não coincidem.'; err.classList.remove('hidden'); return;
          }
          try {
            await API.post('/api/auth/change-password', { current_password: m.querySelector('#cp-old').value, new_password: m.querySelector('#cp-new').value });
            closeModal(); toast('Senha alterada.');
          } catch (e2) { err.textContent = e2.message; err.classList.remove('hidden'); }
        };
      } });
  };

  document.getElementById('delete-account').onclick = () => {
    openModal(`<div class="modal-head"><h3>Excluir conta</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <div class="alert alert-danger mb2">${icon('alert')}<div>Esta ação é <strong>irreversível</strong>. Todos os seus dados serão apagados permanentemente.</div></div>
      <div class="field"><label>Confirme sua senha para continuar</label><input class="input" type="password" id="del-pwd"></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger" id="del-confirm">Excluir permanentemente</button></div>`,
      { onMount(m) {
        m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
        m.querySelector('#del-confirm').onclick = async () => {
          try {
            await API.del('/api/auth/account', { password: m.querySelector('#del-pwd').value });
            setSession(null);
            closeModal();
            toast('Sua conta foi excluída.');
            navigate('/');
          } catch (e2) { toast(e2.message, 'error'); }
        };
      } });
  };
}

route('/perfil', (root) => withAuth(() => renderProfile(root)));
