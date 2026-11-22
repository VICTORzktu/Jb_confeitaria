/* ============================================================
   Onboarding — formulário inteligente em etapas
   ============================================================ */
const GOALS = [
  { id: 'hipertrofia', label: 'Hipertrofia muscular', icon: 'dumbbell', desc: 'Ganho de massa com foco em volume e tensão' },
  { id: 'emagrecimento', label: 'Emagrecimento', icon: 'flame', desc: 'Redução de gordura com preservação de massa' },
  { id: 'forca', label: 'Ganho de força', icon: 'zap', desc: 'Cargas altas e baixas repetições' },
  { id: 'resistencia', label: 'Resistência muscular', icon: 'activity', desc: 'Mais repetições e capacidade de trabalho' },
  { id: 'condicionamento', label: 'Condicionamento físico', icon: 'heart', desc: 'Fôlego, energia e saúde geral' },
  { id: 'definicao', label: 'Definição muscular', icon: 'target', desc: 'Mais densidade e contorno muscular' },
  { id: 'massa', label: 'Ganho de massa muscular', icon: 'weight', desc: 'Foco em volume com déficit calórico controlado' },
  { id: 'desempenho', label: 'Desempenho esportivo', icon: 'run', desc: 'Força, potência e prevenção para seu esporte' },
  { id: 'funcional', label: 'Treinamento funcional', icon: 'activity', desc: 'Movimentos que transferem para o dia a dia' },
];
const LEVELS = [
  { id: 'iniciante', label: 'Iniciante', desc: 'Menos de 6 meses de treino regular', icon: 'body' },
  { id: 'intermediario', label: 'Intermediário', desc: 'De 6 meses a 2 anos de treino', icon: 'dumbbell' },
  { id: 'avancado', label: 'Avançado', desc: 'Mais de 2 anos e bom domínio técnico', icon: 'award' },
];
const LOCATIONS = [
  { id: 'academia', label: 'Academia', icon: 'machine' },
  { id: 'casa', label: 'Em casa', icon: 'home' },
  { id: 'ar_livre', label: 'Ao ar livre', icon: 'sun' },
  { id: 'hotel', label: 'Hotel / quarto', icon: 'moon' },
  { id: 'condominio', label: 'Academia de condomínio', icon: 'grid' },
];
const EQUIPMENTS = ['Barra', 'Halteres', 'Cabo/Polia', 'Máquina', 'Banco', 'Kettlebell', 'Barra fixa', 'Elástico', 'Corda', 'Esteira', 'Bicicleta', 'Caixa/Plyo box', 'TRX', 'Peso do corpo'];
const MUSCLES = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Panturrilha', 'Abdômen', 'Core'];
const MODALITIES = [
  { id: 'musculacao', label: 'Musculação' }, { id: 'casa', label: 'Treino em casa' }, { id: 'calistenia', label: 'Calistenia' },
  { id: 'cross', label: 'Cross training' }, { id: 'funcional', label: 'Funcional' }, { id: 'hiit', label: 'HIIT' },
  { id: 'cardio', label: 'Cardio' }, { id: 'pesos-livres', label: 'Pesos livres' }, { id: 'maquinas', label: 'Máquinas' },
];

const WIZARD_STEPS = [
  { key: 'dados', title: 'Vamos te conhecer', sub: 'Esses dados ajudam a IA a calibrar volume, intensidade e recomendações para o seu corpo.' },
  { key: 'objetivo', title: 'Qual é o seu objetivo principal?', sub: 'A IA vai priorizar repetições, descanso e organização do treino com base nisso.' },
  { key: 'nivel', title: 'Qual é a sua experiência com treino?', sub: 'Seja honesto: iniciantes progridem mais rápido com volume e complexidade menores.' },
  { key: 'rotina', title: 'Como é a sua rotina de treino?', sub: 'A disponibilidade define a divisão semanal e o tempo de cada sessão.' },
  { key: 'local', title: 'Onde você treina e com o quê?', sub: 'Vamos usar apenas os equipamentos que você realmente tem acesso.' },
  { key: 'foco', title: 'Foco muscular e limitações', sub: 'Prioridades musculares e restrições físicas — aqui a segurança entra em primeiro lugar.' },
];

function stateDefaults() {
  const p = App.profile || {};
  return {
    age: p.age ?? '',
    sex: p.sex ?? 'M',
    height_cm: p.height_cm ?? '',
    weight_kg: p.weight_kg ?? '',
    goal: p.goal ?? '',
    level: p.level ?? '',
    days_per_week: p.days_per_week ?? 4,
    minutes_per_session: p.minutes_per_session ?? 60,
    location: p.location ?? '',
    equipment: p.equipment ? JSON.parse(typeof p.equipment === 'string' ? p.equipment : '[]') : [],
    focus_muscles: p.focus_muscles ? JSON.parse(typeof p.focus_muscles === 'string' ? p.focus_muscles : '[]') : [],
    injuries: p.injuries ?? '',
    modality: sessionStorage.getItem('fitai_intent_modality') || 'musculacao',
  };
}

function renderOnboarding(root) {
  const isEdit = new URLSearchParams(location.search).get('edit') === '1';
  const state = stateDefaults();
  if (state.location === 'academia' && !state.equipment.length) state.equipment = ['Barra', 'Halteres', 'Cabo/Polia', 'Máquina', 'Banco'];
  let step = 0;

  root.innerHTML = `
  <div class="wizard-wrap">
    <div class="wizard-top container" style="width:100%">
      <a href="/" data-link class="logo"><span class="logo-mark">${icon('logo')}</span>Fit<em>AI</em></a>
      <div class="wizard-progress" id="wizard-progress">
        ${WIZARD_STEPS.map(() => '<div class="seg"><i></i></div>').join('')}
      </div>
      <a href="${isEdit ? '/perfil' : '/app'}" data-link class="btn btn-ghost btn-sm">${isEdit ? 'Cancelar' : 'Sair'}</a>
    </div>
    <div class="wizard-body" id="wizard-body"></div>
  </div>`;

  const body = root.querySelector('#wizard-body');
  const progress = root.querySelector('#wizard-progress');

  function updateProgress() {
    [...progress.children].forEach((seg, i) => {
      seg.className = 'seg' + (i < step ? ' done' : i === step ? ' current' : '');
    });
  }

  function stepValid() {
    switch (WIZARD_STEPS[step].key) {
      case 'dados': return state.age && state.height_cm && state.weight_kg;
      case 'objetivo': return !!state.goal;
      case 'nivel': return !!state.level;
      case 'rotina': return state.days_per_week >= 1 && state.minutes_per_session >= 20;
      case 'local': return !!state.location;
      case 'foco': return true;
      default: return true;
    }
  }

  function renderStep() {
    const s = WIZARD_STEPS[step];
    const last = step === WIZARD_STEPS.length - 1;
    body.innerHTML = `
      <div class="wizard-step">
        <div class="row mb2" style="gap:10px"><span class="badge badge-lime">Etapa ${step + 1} de ${WIZARD_STEPS.length}</span>${step === 0 ? '<span class="badge">≈ 2 minutos</span>' : ''}</div>
        <h2>${s.title}</h2><p>${s.sub}</p>
        <div id="step-content">${stepContent(s.key)}</div>
        <div class="wizard-nav">
          <button class="btn btn-ghost" id="wz-back" ${step === 0 ? 'disabled' : ''}>${icon('chevronLeft')} Voltar</button>
          <div class="row" style="gap:10px">
            ${!last ? `<button class="btn btn-ghost" id="wz-next">Continuar ${icon('chevronRight')}</button>` : ''}
          </div>
        </div>
      </div>`;
    bindStep();
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function stepContent(key) {
    if (key === 'dados') {
      return `<div class="form-grid">
        <div class="field"><label>Idade</label><div class="measure-input"><input class="input" type="number" id="wz-age" min="12" max="100" value="${state.age}" placeholder="28"><span class="unit">anos</span></div></div>
        <div class="field"><label>Sexo biológico</label>
          <div class="opt-grid" id="wz-sex">
            ${[['M', 'Masculino'], ['F', 'Feminino'], ['O', 'Prefiro não informar']].map(([v, l]) => `<button type="button" class="opt ${state.sex === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="field"><label>Altura</label><div class="measure-input"><input class="input" type="number" id="wz-height" min="100" max="250" value="${state.height_cm}" placeholder="178"><span class="unit">cm</span></div></div>
        <div class="field"><label>Peso atual</label><div class="measure-input"><input class="input" type="number" id="wz-weight" min="25" max="350" step="0.1" value="${state.weight_kg}" placeholder="82.4"><span class="unit">kg</span></div></div>
        <div class="full alert alert-info">${icon('info')}<div>Usamos esses dados apenas para calibrar volume e recomendações — não calculamos dietas nem fazemos diagnósticos.</div></div>
      </div>`;
    }
    if (key === 'objetivo') {
      return `<div class="grid g3" id="wz-goals">${GOALS.map((g) => `
        <button type="button" class="card card-tight" data-goal="${g.id}" style="text-align:left;cursor:pointer;border-color:${state.goal === g.id ? 'var(--lime)' : 'var(--border)'};background:${state.goal === g.id ? 'var(--lime-dim)' : 'var(--surface)'}">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;color:${state.goal === g.id ? 'var(--lime)' : 'var(--text-2)'}">${icon(g.icon)}<strong style="font-size:13.5px;font-family:var(--font-display)">${g.label}</strong></div>
          <span class="fs12 dim">${g.desc}</span>
        </button>`).join('')}</div>`;
    }
    if (key === 'nivel') {
      return `<div class="grid g3" id="wz-levels">${LEVELS.map((l) => `
        <button type="button" class="card card-tight" data-level="${l.id}" style="text-align:left;cursor:pointer;border-color:${state.level === l.id ? 'var(--lime)' : 'var(--border)'};background:${state.level === l.id ? 'var(--lime-dim)' : 'var(--surface)'}">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px;color:${state.level === l.id ? 'var(--lime)' : 'var(--text-2)'}">${icon(l.icon)}<strong style="font-size:13.5px;font-family:var(--font-display)">${l.label}</strong></div>
          <span class="fs12 dim">${l.desc}</span>
        </button>`).join('')}</div>`;
    }
    if (key === 'rotina') {
      return `<div class="split-2">
        <div class="card">
          <label class="label">Quantos dias por semana pode treinar?</label>
          <div class="row mt2" style="justify-content:space-between">
            <strong id="days-val" style="font-family:var(--font-display);font-size:28px">${state.days_per_week}<span class="fs13 dim" style="font-weight:400"> dias</span></strong>
          </div>
          <div class="row mt2" style="gap:4px">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<button type="button" class="chip ${state.days_per_week === d ? 'active' : ''}" style="flex:1;justify-content:center;padding:0" data-days="${d}">${d}</button>`).join('')}</div>
          <p class="hint mt2">Com 2 a 3 dias priorizamos Full Body. Com 4+, divisões como Upper/Lower ou PPL.</p>
        </div>
        <div class="card">
          <label class="label">Tempo disponível por treino</label>
          <div class="row mt2" style="justify-content:space-between">
            <strong id="min-val" style="font-family:var(--font-display);font-size:28px">${state.minutes_per_session}<span class="fs13 dim" style="font-weight:400"> min</span></strong>
          </div>
          <input type="range" min="20" max="120" step="5" value="${state.minutes_per_session}" id="wz-minutes" class="mt2">
          <p class="hint mt2">A IA calcula séries, descanso e aquecimento para caber no tempo real que você tem.</p>
        </div>
        <div class="card full">
          <label class="label">Modalidade preferida</label>
          <div class="opt-grid mt2">${MODALITIES.map((m) => `<button type="button" class="opt ${state.modality === m.id ? 'active' : ''}" data-mod="${m.id}">${m.label}</button>`).join('')}</div>
        </div>
      </div>`;
    }
    if (key === 'local') {
      return `<div class="mb3"><label class="label mb2" style="display:block">Local de treino</label>
        <div class="opt-grid">${LOCATIONS.map((l) => `<button type="button" class="opt ${state.location === l.id ? 'active' : ''}" data-loc="${l.id}">${icon(l.icon)}${l.label}</button>`).join('')}</div></div>
        <div class="card">
          <label class="label">Equipamentos disponíveis</label>
          <div class="opt-grid mt2" id="wz-equipment">${EQUIPMENTS.map((e) => `<button type="button" class="opt ${state.equipment.includes(e) ? 'active' : ''}" data-equip="${e}">${icon(equipIcon(e))}${e}</button>`).join('')}</div>
          <p class="hint mt2">${icon('info')} Se não marcar nada, o plano usará peso do corpo.</p>
        </div>`;
    }
    // foco
    return `<div class="card mb3">
        <label class="label">Grupos musculares que gostaria de priorizar (opcional)</label>
        <div class="opt-grid mt2" id="wz-muscles">${MUSCLES.map((m) => `<button type="button" class="opt ${state.focus_muscles.includes(m) ? 'active' : ''}" data-muscle="${m}">${icon(muscleIcon(m))}${m}</button>`).join('')}</div>
      </div>
      <div class="card">
        <label class="label" for="wz-injuries">Lesões, limitações ou restrições físicas</label>
        <textarea class="textarea mt2" id="wz-injuries" placeholder="Ex.: dor no joelho esquerdo ao agachar, hérnia lombar diagnosticada, cirurgia no ombro...">${esc(state.injuries)}</textarea>
        <div class="alert alert-warn mt2">${icon('alert')}<div>Se você relatou algo aqui, removemos automaticamente exercícios contraindicados. Mesmo assim, o FitAI <strong>não substitui</strong> avaliação médica ou de profissional de educação física. Em caso de dor, consulte um profissional.</div></div>
        <div class="summary-list mt3" id="wz-summary"></div>
      </div>`;
  }

  function bindStep() {
    const key = WIZARD_STEPS[step].key;
    if (key === 'dados') {
      body.querySelector('#wz-age').oninput = (e) => state.age = e.target.value;
      body.querySelector('#wz-height').oninput = (e) => state.height_cm = e.target.value;
      body.querySelector('#wz-weight').oninput = (e) => state.weight_kg = e.target.value;
      body.querySelectorAll('#wz-sex .opt').forEach((b) => b.onclick = () => {
        state.sex = b.dataset.v;
        body.querySelectorAll('#wz-sex .opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    }
    if (key === 'objetivo') {
      body.querySelectorAll('[data-goal]').forEach((b) => b.onclick = () => {
        state.goal = b.dataset.goal;
        bindRender('objetivo');
      });
    }
    if (key === 'nivel') {
      body.querySelectorAll('[data-level]').forEach((b) => b.onclick = () => {
        state.level = b.dataset.level;
        bindRender('nivel');
      });
    }
    if (key === 'rotina') {
      body.querySelectorAll('[data-days]').forEach((b) => b.onclick = () => {
        state.days_per_week = Number(b.dataset.days);
        body.querySelector('#days-val').innerHTML = `${state.days_per_week}<span class="fs13 dim" style="font-weight:400"> dias</span>`;
        body.querySelectorAll('[data-days]').forEach((x) => x.classList.toggle('active', x === b));
      });
      const range = body.querySelector('#wz-minutes');
      range.oninput = () => {
        state.minutes_per_session = Number(range.value);
        body.querySelector('#min-val').innerHTML = `${state.minutes_per_session}<span class="fs13 dim" style="font-weight:400"> min</span>`;
      };
      body.querySelectorAll('[data-mod]').forEach((b) => b.onclick = () => {
        state.modality = b.dataset.mod;
        body.querySelectorAll('[data-mod]').forEach((x) => x.classList.toggle('active', x === b));
      });
    }
    if (key === 'local') {
      body.querySelectorAll('[data-loc]').forEach((b) => b.onclick = () => {
        state.location = b.dataset.loc;
        if (state.location === 'academia' && !state.equipment.length) state.equipment = ['Barra', 'Halteres', 'Cabo/Polia', 'Máquina', 'Banco'];
        if (state.location !== 'academia') state.equipment = state.equipment.filter((e) => e !== 'Máquina' && e !== 'Cabo/Polia');
        bindRender('local');
      });
      body.querySelectorAll('[data-equip]').forEach((b) => b.onclick = () => {
        const v = b.dataset.equip;
        if (state.equipment.includes(v)) { state.equipment = state.equipment.filter((x) => x !== v); b.classList.remove('active'); }
        else { state.equipment.push(v); b.classList.add('active'); }
      });
    }
    if (key === 'foco') {
      body.querySelectorAll('[data-muscle]').forEach((b) => b.onclick = () => {
        const v = b.dataset.muscle;
        if (state.focus_muscles.includes(v)) { state.focus_muscles = state.focus_muscles.filter((x) => x !== v); b.classList.remove('active'); }
        else { state.focus_muscles.push(v); b.classList.add('active'); }
      });
      const ta = body.querySelector('#wz-injuries');
      ta.oninput = () => state.injuries = ta.value;
      renderSummary();
    }
    body.querySelector('#wz-back').onclick = () => { if (step > 0) { step--; renderStep(); } };
    const nextBtn = body.querySelector('#wz-next');
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (!stepValid()) { toast('Complete as informações desta etapa para continuar.', 'warn'); return; }
        step++; renderStep();
      };
    }
  }

  function bindRender(key) { renderStep(); }

  function renderSummary() {
    const el = body.querySelector('#wz-summary');
    if (!el) return;
    const goal = GOALS.find((g) => g.id === state.goal)?.label || '—';
    const level = LEVELS.find((l) => l.id === state.level)?.label || '—';
    const loc = LOCATIONS.find((l) => l.id === state.location)?.label || '—';
    el.innerHTML = `
      <div class="summary-line"><span>Perfil</span><span>${state.age || '—'} anos · ${state.height_cm || '—'} cm · ${state.weight_kg || '—'} kg</span></div>
      <div class="summary-line"><span>Objetivo e nível</span><span>${goal} · ${level}</span></div>
      <div class="summary-line"><span>Rotina</span><span>${state.days_per_week}x por semana · ${state.minutes_per_session} min</span></div>
      <div class="summary-line"><span>Local e equipamentos</span><span>${loc}${state.equipment.length ? ' · ' + state.equipment.join(', ') : ' · peso do corpo'}</span></div>
      <div class="summary-line"><span>Foco muscular</span><span>${state.focus_muscles.length ? state.focus_muscles.join(', ') : 'equilíbrio completo'}</span></div>
      <div class="summary-line"><span>Limitações</span><span>${state.injuries ? esc(state.injuries).slice(0, 70) : 'nenhuma declarada'}</span></div>`;
  }

  // Passo final: botão gerar
  function updateFinalButton() {
    if (step === WIZARD_STEPS.length - 1) {
      const nav = body.querySelector('.wizard-nav');
      if (!nav.querySelector('#wz-finish')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.id = 'wz-finish';
        btn.innerHTML = `${icon('sparkles')} ${isEdit ? 'Salvar meu perfil' : 'Gerar meu treino com IA'}`;
        btn.onclick = async () => {
          if (!state.goal || !state.level || !state.location) { toast('Volte e complete objetivo, nível e local.', 'warn'); return; }
          setLoading(btn, true, 'Salvando...');
          try {
            const payload = {
              age: Number(state.age), sex: state.sex, height_cm: Number(state.height_cm), weight_kg: Number(state.weight_kg),
              goal: state.goal, level: state.level, days_per_week: Number(state.days_per_week),
              minutes_per_session: Number(state.minutes_per_session), location: state.location,
              equipment: state.equipment, focus_muscles: state.focus_muscles, injuries: state.injuries,
            };
            const res = await API.put('/api/profile', payload);
            App.profile = res.profile;
            sessionStorage.setItem('fitai_intent_modality', state.modality);
            toast('Perfil salvo com sucesso!');
            if (isEdit) { navigate('/perfil'); return; }
            navigate('/treinos?gerar=1');
          } catch (e) {
            setLoading(btn, false);
            toast(e.message, 'error');
          }
        };
        nav.querySelector('.row').appendChild(btn);
      }
    }
  }

  const origRender = renderStep;
  renderStep = function () {
    origRender();
    updateFinalButton();
  };
  origRender();
}

route('/onboarding', (root) => withAuth(() => renderOnboarding(root)));

window.GOALS = GOALS; window.LEVELS = LEVELS; window.LOCATIONS = LOCATIONS;
window.EQUIPMENTS = EQUIPMENTS; window.MUSCLES = MUSCLES; window.MODALITIES = MODALITIES;
