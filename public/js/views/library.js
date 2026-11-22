/* ============================================================
   Biblioteca de exercícios — v2
   Mudanças de interface:
   - Busca fixa no topo (antes ficava espremida no topbar)
   - Filtros em chips horizontais com contagem (antes era uma
     coluna vertical de 3 blocos que ocupava a tela no celular)
   - Painel de filtros vira bottom-sheet no celular
   - Ordenação (nome / dificuldade / músculo)
   - Contador "x de y" e chips de filtros ativos removíveis
   - Cards acessíveis (button, foco visível, Enter/Espaço)
   - Ilustração maior, badge de dificuldade sem sobreposição
   ============================================================ */

const LIB_MUSCLE_ICON = {
  'Peito': 'chest', 'Costas': 'back', 'Pernas': 'legs', 'Glúteos': 'glutes',
  'Ombros': 'shoulders', 'Bíceps': 'biceps', 'Tríceps': 'triceps', 'Abdômen': 'abs',
  'Core': 'abs', 'Cardio': 'heart', 'Corpo inteiro': 'body', 'Lombar': 'back',
  'Panturrilha': 'legs',
};

async function renderLibrary(root) {
  const filters = { q: '', muscle: '', equipment: '', modality: '', difficulty: '' };
  const state = { sort: 'muscle', view: 'grid', data: null };

  root.innerHTML = appShell({
    title: 'Biblioteca de exercícios', crumb: 'Execução, músculos e equipamentos',
    content: `
      <div class="lib-toolbar">
        <label class="lib-search">
          ${icon('search')}
          <input id="lib-search" type="search" class="lib-search-input" placeholder="Buscar por nome, músculo ou equipamento" autocomplete="off" aria-label="Buscar exercícios">
          <button class="lib-search-clear" id="lib-clear" aria-label="Limpar busca" hidden>${icon('x')}</button>
        </label>
        <div class="lib-toolbar-right">
          <div class="lib-sort" role="group" aria-label="Ordenar">
            <button class="lib-sort-opt" data-sort="muscle" aria-pressed="true">Músculo</button>
            <button class="lib-sort-opt" data-sort="name" aria-pressed="false">A–Z</button>
            <button class="lib-sort-opt" data-sort="difficulty" aria-pressed="false">Nível</button>
          </div>
          <button class="lib-filter-btn" id="lib-open-filters" aria-expanded="false">
            ${icon('filter')} Filtros <span class="lib-filter-count" id="lib-filter-count" hidden>0</span>
          </button>
        </div>
      </div>

      <div class="lib-chips" id="lib-chips" aria-label="Filtros rápidos"></div>
      <div class="lib-active" id="lib-active" hidden></div>

      <div class="row-between mb2 wrap lib-summary" id="lib-summary"></div>
      <div id="lib-results" aria-live="polite" aria-busy="true">
        <div class="ex-library-grid">${Array(9).fill('<div class="skeleton" style="height:250px;border-radius:16px"></div>').join('')}</div>
      </div>`,
  });
  bindShell();

  /* ---------------------------- filtros (sheet) ---------------------------- */
  const sheet = document.createElement('div');
  sheet.className = 'lib-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="lib-sheet-backdrop" data-close-sheet></div>
    <div class="lib-sheet-panel" role="dialog" aria-modal="true" aria-label="Filtros da biblioteca">
      <div class="lib-sheet-head">
        <h3>Filtros</h3>
        <button class="btn-icon" data-close-sheet aria-label="Fechar filtros">${icon('x')}</button>
      </div>
      <div class="lib-sheet-body" id="lib-sheet-body"></div>
      <div class="lib-sheet-foot">
        <button class="btn btn-ghost" id="lib-reset">Limpar tudo</button>
        <button class="btn btn-primary" data-close-sheet id="lib-apply">Ver resultados</button>
      </div>
    </div>`;
  document.body.appendChild(sheet);

  function openSheet() {
    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('open'));
    document.getElementById('lib-open-filters').setAttribute('aria-expanded', 'true');
    sheet.querySelector('[data-close-sheet]')?.focus();
  }
  function closeSheet() {
    sheet.classList.remove('open');
    setTimeout(() => { sheet.hidden = true; }, 200);
    document.getElementById('lib-open-filters')?.setAttribute('aria-expanded', 'false');
  }
  sheet.querySelectorAll('[data-close-sheet]').forEach((b) => (b.onclick = closeSheet));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  document.getElementById('lib-open-filters').onclick = openSheet;

  /* ------------------------------- carregamento ------------------------------- */
  let reqSeq = 0;
  async function load() {
    const seq = ++reqSeq;
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    const results = document.getElementById('lib-results');
    if (state.data) results.setAttribute('aria-busy', 'true');
    results.classList.add('is-loading');
    try {
      const data = await API.get('/api/exercises' + (qs ? '?' + qs : ''));
      if (seq !== reqSeq) return; // resposta antiga: descarta
      state.data = data;
      renderChips(data);
      renderActive();
      renderSheetBody(data);
      renderSummary(data);
      renderResults(data);
    } catch (e) {
      if (seq !== reqSeq) return;
      results.innerHTML = `<div class="alert alert-danger">${icon('alert')}<div>${esc(e.message)}</div></div>`;
    } finally {
      if (seq === reqSeq) { results.classList.remove('is-loading'); results.setAttribute('aria-busy', 'false'); }
    }
  }

  /* ------------------------- chips horizontais (topo) ------------------------- */
  function renderChips(data) {
    const wrap = document.getElementById('lib-chips');
    const activeCount = ['muscle', 'equipment', 'modality', 'difficulty'].filter((k) => filters[k]).length;
    const badge = document.getElementById('lib-filter-count');
    badge.hidden = activeCount === 0;
    badge.textContent = activeCount;

    // chips priorizam os músculos com mais exercícios (não a ordem alfabética)
    const topMuscles = data.facets.muscles
      .filter((m) => m.count > 0)
      .slice()
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'pt-BR'))
      .slice(0, 8);
    wrap.innerHTML = `
      <button class="chip ${!filters.muscle ? 'active' : ''}" data-f="muscle" data-v="">
        ${icon('grid')} Todos <span class="chip-n">${data.total_all}</span>
      </button>
      ${topMuscles.map((m) => `
        <button class="chip ${filters.muscle === m.value ? 'active' : ''}" data-f="muscle" data-v="${esc(m.value)}">
          ${esc(m.value)} <span class="chip-n">${m.count}</span>
        </button>`).join('')}
      <button class="chip chip-more" id="lib-chip-more">${icon('filter')} Mais filtros</button>`;
    wrap.querySelectorAll('[data-f]').forEach((b) => {
      b.onclick = () => { filters[b.dataset.f] = b.dataset.v; load(); };
    });
    document.getElementById('lib-chip-more').onclick = openSheet;
  }

  /* --------------------------- filtros ativos (removíveis) --------------------------- */
  function renderActive() {
    const box = document.getElementById('lib-active');
    const labels = { muscle: 'Músculo', equipment: 'Equipamento', modality: 'Modalidade', difficulty: 'Nível' };
    const clean = (v) => (v === '' ? '' : v);
    const items = ['muscle', 'equipment', 'modality', 'difficulty']
      .filter((k) => filters[k])
      .map((k) => `<button class="active-pill" data-clear="${k}">${esc(String(clean(filters[k])))} ${icon('x')}</button>`);
    if (filters.q) items.unshift(`<button class="active-pill" data-clear="q">“${esc(filters.q)}” ${icon('x')}</button>`);
    box.hidden = items.length === 0;
    box.innerHTML = items.length
      ? `${items.join('')}<button class="active-clear" id="lib-clear-all">Limpar tudo</button>`
      : '';
    box.querySelectorAll('[data-clear]').forEach((b) => {
      b.onclick = () => {
        filters[b.dataset.clear] = '';
        if (b.dataset.clear === 'q') { const inp = document.getElementById('lib-search'); if (inp) inp.value = ''; syncClearBtn(); }
        load();
      };
    });
    const clearAll = document.getElementById('lib-clear-all');
    if (clearAll) clearAll.onclick = resetAll;
    void labels;
  }

  /* ------------------------- painel de filtros (sheet) ------------------------- */
  function renderSheetBody(data) {
    const group = (key, title, options, renderLabel) => `
      <section class="lib-fgroup">
        <h4>${title}</h4>
        <div class="lib-fopts">
          <button class="lib-fopt ${!filters[key] ? 'active' : ''}" data-f="${key}" data-v="">Todos</button>
          ${options.map((o) => `
            <button class="lib-fopt ${filters[key] === o.value ? 'active' : ''} ${o.count === 0 ? 'empty' : ''}" data-f="${key}" data-v="${esc(o.value)}">
              <span>${esc(renderLabel ? renderLabel(o) : o.value)}</span><span class="lib-fopt-n">${o.count}</span>
            </button>`).join('')}
        </div>
      </section>`;

    const body = document.getElementById('lib-sheet-body');
    body.innerHTML = `
      ${group('muscle', 'Músculo principal', data.facets.muscles)}
      ${group('equipment', 'Equipamento', data.facets.equipments)}
      ${group('modality', 'Modalidade', data.facets.modalities.map((m) => ({ value: m.slug, count: m.count, name: m.name })), (o) => o.name)}
      ${group('difficulty', 'Nível', data.facets.difficulties)}
      ${!data.plan.full_library ? `<div class="lib-upsell">
        <div class="row" style="gap:8px">${icon('lock')}<strong class="fs13">Biblioteca completa</strong></div>
        <p class="fs12 dim" style="margin:6px 0 10px">Instruções detalhadas de todos os exercícios nos planos Pro e Premium.</p>
        <a href="/planos" data-link class="btn btn-primary btn-sm btn-block">Ver planos</a>
      </div>` : ''}`;
    body.querySelectorAll('[data-f]').forEach((b) => {
      b.onclick = () => { filters[b.dataset.f] = b.dataset.v; load(); };
    });
  }

  function resetAll() {
    Object.keys(filters).forEach((k) => (filters[k] = ''));
    const inp = document.getElementById('lib-search'); if (inp) inp.value = '';
    syncClearBtn();
    load();
  }
  document.getElementById('lib-reset').onclick = resetAll;

  /* ------------------------------- resumo ------------------------------- */
  function renderSummary(data) {
    const el = document.getElementById('lib-summary');
    const shown = data.exercises.length;
    const total = data.total_all ?? shown;
    const hasFilter = ['q', 'muscle', 'equipment', 'modality', 'difficulty'].some((k) => filters[k]);
    el.innerHTML = `
      <span class="fs13 dim">
        ${hasFilter
          ? `<strong style="color:var(--text)">${shown}</strong> de ${total} exercício${total === 1 ? '' : 's'}`
          : `<strong style="color:var(--text)">${total}</strong> exercício${total === 1 ? '' : 's'} na biblioteca`}
      </span>
      <span class="fs12 dim row" style="gap:6px">
        ${data.plan.full_library ? `${icon('check')} Biblioteca completa` : `${icon('lock')} Plano gratuito`}
      </span>`;
  }

  /* ------------------------------- resultados ------------------------------- */
  const DIFF = { 'Iniciante': 1, 'Intermediário': 2, 'Avançado': 3 };
  function sortList(list) {
    const arr = [...list];
    if (state.sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else if (state.sort === 'difficulty') arr.sort((a, b) => (DIFF[a.difficulty] || 1) - (DIFF[b.difficulty] || 1) || a.name.localeCompare(b.name, 'pt-BR'));
    else arr.sort((a, b) => a.primary_muscle.localeCompare(b.primary_muscle, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'));
    return arr;
  }

  // Mensagem de vazio que cita exatamente o que está filtrando — evita o usuário
  // achar que a biblioteca "sumiu" quando a busca e um filtro se contradizem.
  function emptyHint() {
    const parts = [];
    if (filters.q) parts.push(`a busca “${esc(filters.q)}”`);
    if (filters.muscle) parts.push(`o músculo ${esc(filters.muscle)}`);
    if (filters.equipment) parts.push(`o equipamento ${esc(filters.equipment)}`);
    if (filters.difficulty) parts.push(`o nível ${esc(filters.difficulty)}`);
    if (filters.modality) {
      const m = state.data?.facets?.modalities?.find((x) => x.slug === filters.modality);
      parts.push(`a modalidade ${esc(m ? m.name : filters.modality)}`);
    }
    if (!parts.length) return 'A biblioteca não retornou resultados. Tente novamente.';
    if (parts.length === 1) return `Nenhum resultado para ${parts[0]}.`;
    const last = parts.pop();
    return `Nenhum resultado para ${parts.join(', ')} e ${last}.`;
  }

  function renderResults(data) {
    const box = document.getElementById('lib-results');
    if (!data.exercises.length) {
      box.innerHTML = `<div class="empty">
        <div class="empty-icon">${icon('search')}</div>
        <h4>Nenhum exercício encontrado</h4>
        <p>${emptyHint()}</p>
        <button class="btn btn-ghost btn-sm" id="lib-empty-reset">Limpar filtros</button>
      </div>`;
      const b = document.getElementById('lib-empty-reset'); if (b) b.onclick = resetAll;
      return;
    }
    box.innerHTML = `<div class="ex-library-grid">
      ${sortList(data.exercises).map((ex) => {
        const d = DIFF[ex.difficulty] || 1;
        return `
        <button class="ex-library-card" data-ex="${ex.id}" aria-label="${esc(ex.name)}, ${esc(ex.primary_muscle)}, ${esc(ex.difficulty)}">
          <div class="ex-library-img">
            ${muscleFigure(ex.primary_muscle)}
            ${ex.locked ? `<span class="ex-lock">${icon('lock')} Premium</span>` : ''}
            <span class="ex-diff-dots" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span>
          </div>
          <div class="ex-library-body">
            <h4>${esc(ex.name)}</h4>
            <div class="meta">
              <span class="ex-muscle-pill">${esc(ex.primary_muscle)}</span>
              <span>${esc(ex.equipment)}</span>
            </div>
          </div>
        </button>`;
      }).join('')}
    </div>`;
    box.querySelectorAll('[data-ex]').forEach((card) => {
      card.onclick = () => openExercise(card.dataset.ex);
    });
  }

  /* ------------------------------- detalhe ------------------------------- */
  async function openExercise(id) {
    try {
      const { exercise: ex, history } = await API.get('/api/exercises/' + id);
      if (ex.locked) upgradeModal('Conteúdo completo deste exercício');
      const d = DIFF[ex.difficulty] || 1;
      openModal(`
        <div class="modal-head">
          <div>
            <span class="badge badge-lime badge-sm">${esc(ex.primary_muscle)}</span>
            <h3 style="margin:8px 0 0">${esc(ex.name)}</h3>
          </div>
          <button class="btn-icon" data-close aria-label="Fechar">${icon('x')}</button>
        </div>
        <div class="ex-detail-hero">
          ${muscleFigure(ex.primary_muscle)}
          <div class="ex-detail-hero-meta">
            <span class="badge badge-sm">${esc(ex.difficulty)}</span>
            <span class="ex-diff-dots" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= d ? 'on' : ''}"></i>`).join('')}</span>
          </div>
        </div>
        <div class="ex-detail-facts">
          <span>${icon(equipIcon(ex.equipment))}${esc(ex.equipment)}</span>
          <span>${icon('target')}${esc(ex.primary_muscle)}</span>
          ${ex.secondary_muscles.length ? `<span>${icon('list')}${esc(ex.secondary_muscles.join(', '))}</span>` : ''}
          ${ex.modalities.length ? `<span>${icon('grid')}${ex.modalities.length} modalidade${ex.modalities.length > 1 ? 's' : ''}</span>` : ''}
        </div>
        ${history?.max_weight > 0 ? `<div class="card card-tight mb2 ex-record">
          <div class="row-between">
            <strong class="fs13">${icon('award')} Seu recorde</strong>
            <span class="fs13 lime" style="font-weight:600">${fmt.num(history.max_weight, 1)} kg × ${history.max_reps} reps</span>
          </div>
          <span class="fs11 dim">${history.sets} séries registradas${history.last_date ? ' · último em ' + fmt.date(history.last_date) : ''}</span>
        </div>` : ''}
        ${ex.instructions ? `<div class="mb3"><strong class="fs13">Modo correto de execução</strong><p class="fs13 muted" style="margin:.5em 0 0;line-height:1.65">${esc(ex.instructions)}</p></div>`
          : ex.locked ? `<div class="alert alert-warn mb2">${icon('lock')}<div>Instruções completas disponíveis nos planos Pro e Premium.</div></div>` : ''}
        ${ex.common_errors ? `<div class="mb3"><strong class="fs13">Erros comuns</strong><p class="fs13 muted" style="margin:.5em 0 0;line-height:1.65">${esc(ex.common_errors)}</p></div>` : ''}
        ${ex.tips ? `<div class="alert alert-lime mb2">${icon('sparkles')}<div><strong>Dica de execução:</strong> ${esc(ex.tips)}</div></div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Fechar</button>
          <a href="/personal-ia?q=${encodeURIComponent('Como executar corretamente o ' + ex.name + '?')}" data-link class="btn btn-primary">${icon('chat')} Perguntar ao Personal IA</a>
        </div>`, {
        size: 'modal-lg',
        onMount(m) { m.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal)); },
      });
    } catch (e) { toast(e.message, 'error'); }
  }

  /* ------------------------------- busca ------------------------------- */
  const search = document.getElementById('lib-search');
  const clearBtn = document.getElementById('lib-clear');
  function syncClearBtn() { clearBtn.hidden = !search.value; }
  let t;
  search.addEventListener('input', () => {
    syncClearBtn();
    clearTimeout(t);
    t = setTimeout(() => { filters.q = search.value.trim(); load(); }, 260);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(t); filters.q = search.value.trim(); load(); }
    if (e.key === 'Escape') { search.value = ''; syncClearBtn(); filters.q = ''; load(); }
  });
  clearBtn.onclick = () => { search.value = ''; syncClearBtn(); filters.q = ''; search.focus(); load(); };

  document.querySelectorAll('[data-sort]').forEach((b) => {
    b.onclick = () => {
      state.sort = b.dataset.sort;
      document.querySelectorAll('[data-sort]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (state.data) renderResults(state.data);
    };
  });

  await load();
}

route('/biblioteca', (root) => withAuth(() => renderLibrary(root)));
