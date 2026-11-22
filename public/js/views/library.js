/* ============================================================
   Biblioteca de exercícios
   ============================================================ */
async function renderLibrary(root) {
  const filters = { q: '', muscle: '', equipment: '', modality: '', difficulty: '' };
  root.innerHTML = appShell({
    title: 'Biblioteca de exercícios', crumb: 'Execução, músculos e equipamentos',
    actions: `<div class="input-icon" style="width:min(300px,40vw)">${icon('search')}<input class="input" id="lib-search" placeholder="Buscar exercício..." style="height:38px;font-size:13px"></div>`,
    content: `<div class="library-layout">
      <aside id="lib-filters"><div class="skeleton" style="height:400px"></div></aside>
      <div><div id="lib-results"><div class="ex-library-grid">${Array(6).fill('<div class="skeleton" style="height:210px"></div>').join('')}</div></div></div>
    </div>`,
  });
  bindShell();
  let facets = null;

  async function load() {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    try {
      const data = await API.get('/api/exercises' + (qs ? '?' + qs : ''));
      facets = data.facets;
      renderFilters(data);
      renderResults(data);
    } catch (e) {
      document.getElementById('lib-results').innerHTML = `<div class="alert alert-danger">${icon('alert')}<div>${esc(e.message)}</div></div>`;
    }
  }

  function renderFilters(data) {
    const hasPremium = !data.plan.full_library;
    document.getElementById('lib-filters').innerHTML = `
      <div class="filters">
        <div class="filter-group">
          <h5>Músculo principal</h5>
          <div class="filter-list">
            <button class="filter-opt ${!filters.muscle ? 'active' : ''}" data-f="muscle" data-v="">Todos</button>
            ${facets.muscles.map((m) => `<button class="filter-opt ${filters.muscle === m ? 'active' : ''}" data-f="muscle" data-v="${esc(m)}">${esc(m)}</button>`).join('')}
          </div>
        </div>
        <div class="filter-group">
          <h5>Equipamento</h5>
          <div class="filter-list">
            <button class="filter-opt ${!filters.equipment ? 'active' : ''}" data-f="equipment" data-v="">Todos</button>
            ${facets.equipments.map((e) => `<button class="filter-opt ${filters.equipment === e ? 'active' : ''}" data-f="equipment" data-v="${esc(e)}">${esc(e)}</button>`).join('')}
          </div>
        </div>
        <div class="filter-group">
          <h5>Modalidade</h5>
          <div class="filter-list">
            <button class="filter-opt ${!filters.modality ? 'active' : ''}" data-f="modality" data-v="">Todas</button>
            ${facets.modalities.map((m) => `<button class="filter-opt ${filters.modality === m.slug ? 'active' : ''}" data-f="modality" data-v="${esc(m.slug)}">${esc(m.name)}</button>`).join('')}
          </div>
        </div>
        <div class="filter-group">
          <h5>Dificuldade</h5>
          <div class="filter-list">
            <button class="filter-opt ${!filters.difficulty ? 'active' : ''}" data-f="difficulty" data-v="">Todas</button>
            ${facets.difficulties.map((d) => `<button class="filter-opt ${filters.difficulty === d ? 'active' : ''}" data-f="difficulty" data-v="${esc(d)}">${esc(d)}</button>`).join('')}
          </div>
        </div>
        ${hasPremium ? `<div class="card card-tight" style="background:linear-gradient(160deg,rgba(198,244,50,.08),transparent),var(--surface)">
          <div class="row mb2">${icon('lock')}<strong class="fs12">Biblioteca completa</strong></div>
          <p class="fs12 dim" style="margin:0 0 10px">Desbloqueie exercícios premium com instruções completas.</p>
          <a href="/planos" data-link class="btn btn-primary btn-sm btn-block">Ver planos</a></div>` : ''}
      </div>`;

    document.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => {
      filters[b.dataset.f] = b.dataset.v;
      load();
    });
  }

  function renderResults(data) {
    document.getElementById('lib-results').innerHTML = `
      <div class="row-between mb2 wrap">
        <span class="fs13 dim"><strong style="color:var(--text)">${data.total}</strong> exercício${data.total === 1 ? '' : 's'} encontrado${data.total === 1 ? '' : 's'}</span>
        <span class="fs12 dim">${data.plan.full_library ? '✓ Biblioteca completa desbloqueada' : 'Plano gratuito · exercícios premium bloqueados'}</span>
      </div>
      ${data.exercises.length ? `<div class="ex-library-grid">
        ${data.exercises.map((ex) => `
          <div class="ex-library-card" data-ex="${ex.id}">
            <div class="ex-library-img">
              ${muscleFigure(ex.primary_muscle)}
              <span class="ex-muscle-tag">${esc(ex.primary_muscle)}</span>
              ${ex.locked ? `<div class="lock">${icon('lock')}</div>` : ''}
            </div>
            <div class="ex-library-body">
              <h4>${esc(ex.name)}</h4>
              <div class="meta">
                <span>${esc(ex.primary_muscle)}</span><span>·</span><span>${esc(ex.equipment)}</span>
              </div>
              <div class="row-between mt1">
                <span class="badge badge-sm ${ex.difficulty === 'Iniciante' ? 'badge-lime' : ex.difficulty === 'Avançado' ? 'badge-orange' : ''}">${esc(ex.difficulty)}</span>
                <span class="ex-difficulty">${[1, 2, 3].map((i) => `<i class="${i <= (ex.difficulty === 'Iniciante' ? 1 : ex.difficulty === 'Intermediário' ? 2 : 3) ? 'on' : ''}"></i>`).join('')}</span>
              </div>
            </div>
          </div>`).join('')}</div>`
      : `<div class="empty"><div class="empty-icon">${icon('search')}</div><h4>Nenhum exercício encontrado</h4><p>Ajuste os filtros ou busque por outro termo.</p><button class="btn btn-ghost btn-sm" id="clear-filters">Limpar filtros</button></div>`}`;
    if (document.getElementById('clear-filters')) {
      document.getElementById('clear-filters').onclick = () => { Object.keys(filters).forEach((k) => { if (k !== 'q') filters[k] = ''; }); load(); };
    }
    document.querySelectorAll('[data-ex]').forEach((card) => card.onclick = () => openExercise(card.dataset.ex));
  }

  async function openExercise(id) {
    try {
      const { exercise: ex, history } = await API.get('/api/exercises/' + id);
      if (ex.locked) {
        upgradeModal('Conteúdo completo deste exercício');
      }
      openModal(`
        <div class="modal-head">
          <div><span class="badge badge-lime badge-sm">${esc(ex.primary_muscle)}</span>
          <h3 style="margin:8px 0 0">${esc(ex.name)}</h3></div>
          <button class="btn-icon" data-close>${icon('x')}</button>
        </div>
        <div style="position:relative;height:170px;border-radius:16px;background:radial-gradient(120% 100% at 50% 0%,rgba(198,244,50,.16),transparent 60%),var(--surface-2);display:grid;place-items:center;margin-bottom:18px;border:1px solid var(--border)">
          ${muscleFigure(ex.primary_muscle)}
          <span style="position:absolute;bottom:10px;right:12px" class="badge badge-sm">${esc(ex.difficulty)}</span>
        </div>
        <div class="row wrap fs12 dim mb3" style="gap:16px">
          <span class="row" style="gap:6px">${icon(equipIcon(ex.equipment))}${esc(ex.equipment)}</span>
          <span class="row" style="gap:6px">${icon('target')}${esc(ex.primary_muscle)}</span>
          ${ex.secondary_muscles.length ? `<span class="row" style="gap:6px">${icon('list')}${esc(ex.secondary_muscles.join(', '))}</span>` : ''}
          ${ex.modalities.length ? `<span class="row" style="gap:6px">${icon('grid')}${esc(ex.modalities.length)} modalidade${ex.modalities.length > 1 ? 's' : ''}</span>` : ''}
        </div>
        ${history?.max_weight > 0 ? `<div class="card card-tight mb2" style="border-color:rgba(198,244,50,.3)">
          <div class="row-between"><strong class="fs13">${icon('award')} Seu recorde</strong>
          <span class="fs13 lime" style="font-weight:600">${fmt.num(history.max_weight, 1)} kg × ${history.max_reps} reps</span></div>
          <span class="fs11 dim">${history.sets} séries registradas${history.last_date ? ' · último em ' + fmt.date(history.last_date) : ''}</span>
        </div>` : ''}
        ${ex.instructions ? `<div class="mb3"><strong class="fs13">Modo correto de execução</strong><p class="fs13 muted" style="margin:.5em 0 0;line-height:1.65">${esc(ex.instructions)}</p></div>`
          : ex.locked ? `<div class="alert alert-warn mb2">${icon('lock')}<div>Instruções completas disponíveis nos planos Pro e Premium.</div></div>` : ''}
        ${ex.common_errors ? `<div class="mb3"><strong class="fs13">Erros comuns</strong><p class="fs13 muted" style="margin:.5em 0 0;line-height:1.65">${esc(ex.common_errors)}</p></div>` : ''}
        ${ex.tips ? `<div class="alert alert-lime mb2">${icon('sparkles')}<div><strong>Dica de execução:</strong> ${esc(ex.tips)}</div></div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Fechar</button>
          <a href="/personal-ia?q=${encodeURIComponent('Como executar corretamente o ' + ex.name + '?')}" data-link class="btn btn-primary">${icon('chat')} Perguntar ao Personal IA</a>
        </div>`, { size: 'modal-lg', onMount(m) {
        m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
      } });
    } catch (e) { toast(e.message, 'error'); }
  }

  const search = document.getElementById('lib-search');
  let t;
  search.oninput = () => { clearTimeout(t); t = setTimeout(() => { filters.q = search.value.trim(); load(); }, 320); };
  await load();
}

route('/biblioteca', (root) => withAuth(() => renderLibrary(root)));
