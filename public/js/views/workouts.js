/* ============================================================
   Meus treinos — geração IA, execução e progressão
   ============================================================ */
const WORKOUT_CACHE = {};

function noticeHtml(text, type = 'warn') {
  return `<div class="alert alert-${type}" style="margin-bottom:10px">${icon(type === 'warn' ? 'alert' : 'info')}<div>${esc(text)}</div></div>`;
}

async function renderWorkouts(root) {
  if (!requireProfileOrOnboarding()) return;
  const params = new URLSearchParams(location.search);
  const shouldGenerate = params.get('gerar') === '1';

  root.innerHTML = appShell({
    title: 'Meus treinos', crumb: 'Programa personalizado',
    actions: `<a href="/biblioteca" data-link class="btn btn-ghost btn-sm">${icon('library')} Biblioteca</a>
      <button class="btn btn-primary btn-sm" id="btn-generate">${icon('sparkles')} Gerar novo treino</button>`,
    content: `<div id="wk-content"><div class="skeleton" style="height:120px;margin-bottom:16px"></div><div class="skeleton" style="height:340px"></div></div>`,
  });
  bindShell();

  const content = document.getElementById('wk-content');

  async function load() {
    content.innerHTML = `<div class="skeleton" style="height:140px;margin-bottom:16px"></div><div class="skeleton" style="height:380px"></div>`;
    try {
      const [active, list] = await Promise.all([API.get('/api/workouts/active'), API.get('/api/workouts')]);
      WORKOUT_CACHE.active = active;
      WORKOUT_CACHE.list = list.workouts;
      renderActive(active);
    } catch (e) {
      content.innerHTML = `<div class="alert alert-danger">${icon('alert')}<div>${esc(e.message)}</div></div>`;
    }
  }

  function renderActive(data) {
    if (!data.workout) {
      content.innerHTML = `
      <div class="card" style="padding:44px 28px;text-align:center">
        <div class="feature-icon" style="margin:0 auto 18px;width:60px;height:60px">${icon('sparkles')}</div>
        <h3 style="font-size:24px">Você ainda não tem um programa ativo</h3>
        <p class="muted" style="max-width:520px;margin:0 auto 24px">Com base no seu perfil (${esc(goalLabel(App.profile?.goal))}, ${esc(levelLabel(App.profile?.level))}, ${App.profile?.days_per_week}x por semana), a IA vai montar sua divisão, exercícios, séries, descanso, aquecimento e progressão.</p>
        <button class="btn btn-primary btn-lg" id="gen-empty">${icon('sparkles')} Gerar meu primeiro treino</button>
        ${App.plan?.id === 'free' ? `<p class="fs12 dim mt2">Plano gratuito: 3 treinos por mês.</p>` : ''}
      </div>`;
      document.getElementById('gen-empty').onclick = () => openGenerator();
      return;
    }

    const w = data.workout;
    const plan = w.plan_json || {};
    const slots = w.slots || [];
    const todayIdx = data.today?.index ?? slots.findIndex((s) => s.weekday_index === new Date().getDay());
    const state = { dayIndex: todayIdx >= 0 ? todayIdx : 0, open: {} };

    content.innerHTML = `
      <div class="card mb3" style="padding:22px 24px">
        <div class="row-between wrap" style="gap:16px;align-items:flex-start">
          <div style="min-width:0">
            <div class="row wrap" style="gap:8px;margin-bottom:8px">
              <span class="badge badge-lime">${icon('sparkles')} ${esc(plan.split_name || w.split || 'Programa')}</span>
              <span class="badge">${esc(goalLabel(w.goal))}</span>
              <span class="badge">${esc(levelLabel(w.level))}</span>
              <span class="badge">${w.days_per_week}x/semana</span>
              ${w.provider && w.provider !== 'exemplo' ? `<span class="badge badge-blue">${icon('cpu')} ${esc(w.provider)}${w.model ? ' · ' + esc(w.model) : ''}</span>` : ''}
            </div>
            <h2 style="font-size:24px;margin-bottom:6px">${esc(w.name)}</h2>
            <p class="muted fs14" style="margin:0;max-width:720px">${esc(plan.summary || '')}</p>
          </div>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" id="btn-activate-other">${icon('grid')} Programas salvos</button>
            <button class="btn btn-dark btn-sm" id="btn-progression">${icon('brain')} Progressão inteligente</button>
          </div>
        </div>
        ${(plan.notices || []).length ? `<div class="mt3"><div class="row wrap" style="gap:8px">${plan.notices.map((n) => `<span class="badge badge-orange" style="white-space:normal;text-align:left;line-height:1.4">${icon('shield')} ${esc(n)}</span>`).join('')}</div></div>` : ''}
      </div>

      <div class="day-tabs" id="day-tabs">
        ${slots.map((s, i) => `
          <button class="day-tab ${i === state.dayIndex ? 'active' : ''}" data-day="${i}">
            <span class="d">${esc(s.workout?.day || String.fromCharCode(65 + i))} · ${esc(s.weekday_name)}${data.today?.index === i ? ' · hoje' : ''}</span>
            <span class="t">${esc(s.workout?.title || '')}</span>
          </button>`).join('')}
      </div>
      <div class="workout-layout">
        <div id="day-detail"></div>
        <div class="recorder" id="recorder"></div>
      </div>`;

    function renderDay() {
      const i = state.dayIndex;
      const day = plan.weekly_schedule[i];
      const slot = slots[i];
      document.querySelectorAll('.day-tab').forEach((t) => t.classList.toggle('active', Number(t.dataset.day) === i));
      document.getElementById('day-detail').innerHTML = `
        <div class="card mb2">
          <div class="row-between wrap mb2">
            <div><h3 style="font-size:19px;margin-bottom:2px">${esc(day.title)}</h3>
            <div class="fs13 dim row wrap" style="gap:14px">
              <span class="row" style="gap:6px">${icon('calendar')}${esc(slot.weekday_name)}</span>
              <span class="row" style="gap:6px">${icon('clock')}${day.estimated_minutes} min</span>
              <span class="row" style="gap:6px">${icon('dumbbell')}${day.exercises.length} exercícios</span>
              ${data.next?.index === i ? '<span class="badge badge-lime badge-sm">Próximo treino</span>' : ''}
            </div></div>
            <button class="btn btn-primary btn-sm" id="start-session">${icon('play')} Iniciar e registrar</button>
          </div>
          <div class="alert alert-lime">${icon('flame')}<div><strong>Aquecimento:</strong> ${esc(day.warmup)}</div></div>
        </div>
        <div id="exercises-list">
          ${day.exercises.map((ex, j) => `
            <div class="exercise-card ${state.open[j] ? 'open' : ''}" data-ex="${j}">
              <div class="ex-head" data-toggle="${j}">
                <div class="ex-thumb">${icon(muscleIcon(ex.muscle))}</div>
                <div class="info">
                  <h4>${j + 1}. ${esc(ex.name)}</h4>
                  <div class="sub"><span>${esc(ex.muscle)}</span>${ex.equipment ? `<span>·</span><span>${icon(equipIcon(ex.equipment))}</span><span>${esc(ex.equipment)}</span>` : ''}${ex.rest_seconds ? `<span>·</span><span>descanso ${ex.rest_seconds}s</span>` : ''}</div>
                </div>
                <span class="ex-sets-badge">${ex.sets} × ${esc(ex.reps)}</span>
                <span style="color:var(--text-3);transition:transform .2s;display:inline-flex" class="chev">${icon('chevronDown')}</span>
              </div>
              <div class="ex-body">
                ${ex.why ? `<div class="why"><strong style="color:var(--lime)">Por que este exercício:</strong> ${esc(ex.why)}</div>` : ''}
                <div class="ex-params">
                  <div class="param"><span class="k">Séries</span><span class="v">${ex.sets}</span></div>
                  <div class="param"><span class="k">Repetições</span><span class="v">${esc(ex.reps)}</span></div>
                  <div class="param"><span class="k">Descanso</span><span class="v">${ex.rest_seconds || 90}s</span></div>
                  ${ex.tempo ? `<div class="param"><span class="k">Cadência</span><span class="v">${esc(ex.tempo)}</span></div>` : ''}
                  <div class="param"><span class="k">Principal</span><span class="v">${esc(ex.muscle)}</span></div>
                  ${(ex.secondary || []).length ? `<div class="param"><span class="k">Secundários</span><span class="v fs12" style="font-weight:500">${esc((ex.secondary || []).join(', '))}</span></div>` : ''}
                </div>
                ${ex.how ? `<div class="how">${icon('info')} ${esc(ex.how)}</div>` : ''}
                ${ex.progression ? `<div class="fs12" style="color:var(--text-3);margin-bottom:14px">${icon('trending')} <strong style="color:var(--text-2)">Progressão:</strong> ${esc(ex.progression)}</div>` : ''}
                <div class="ex-actions">
                  <button class="btn btn-dark btn-sm" data-sub="${j}">${icon('refresh')} Substituir exercício</button>
                  <button class="btn btn-ghost btn-sm" data-log="${j}">${icon('plus')} Registrar série</button>
                  <button class="btn btn-ghost btn-sm" data-guide="${esc(ex.name)}">${icon('library')} Como executar</button>
                </div>
              </div>
            </div>`).join('')}
        </div>
        <div class="grid g2 mt3">
          <div class="card card-tight">
            <div class="row mb2">${icon('trending')}<strong class="fs13">Plano de progressão</strong></div>
            <p class="fs13 muted" style="margin:0">${esc(plan.progression_plan || 'Progrida aumentando carga, repetições ou qualidade de execução — uma variável por vez.')}</p>
          </div>
          <div class="card card-tight">
            <div class="row mb2">${icon('moon')}<strong class="fs13">Recuperação</strong></div>
            <p class="fs13 muted" style="margin:0">${esc(plan.recovery || 'Durma 7 a 9 horas, mantenha-se hidratado e respeite ao menos 48h entre sessões do mesmo grupo muscular.')}</p>
          </div>
        </div>
        ${plan.cardio_notes ? `<div class="card card-tight mt2"><div class="row mb2">${icon('heart')}<strong class="fs13">Cardio</strong></div><p class="fs13 muted" style="margin:0">${esc(plan.cardio_notes)}</p></div>` : ''}
        ${plan.schedule_notes ? `<div class="card card-tight mt2"><div class="row mb2">${icon('calendar')}<strong class="fs13">Distribuição semanal</strong></div><p class="fs13 muted" style="margin:0">${esc(plan.schedule_notes)}</p></div>` : ''}`;

      bindDay();
      renderRecorder();
    }

    function bindDay() {
      document.querySelectorAll('[data-toggle]').forEach((h) => h.onclick = () => {
        const card = h.closest('.exercise-card');
        card.classList.toggle('open');
      });
      document.querySelectorAll('[data-sub]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); substituteExercise(Number(b.dataset.sub)); });
      document.querySelectorAll('[data-log]').forEach((b) => b.onclick = (e) => {
        e.stopPropagation();
        const idx = Number(b.dataset.log);
        document.getElementById('recorder').scrollIntoView({ behavior: 'smooth', block: 'center' });
        const block = document.querySelector(`[data-rec="${idx}"]`);
        if (block) block.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('Use o painel de registro ao lado para anotar carga e repetições.', 'warn', 3200);
      });
      document.querySelectorAll('[data-guide]').forEach((b) => b.onclick = (e) => {
        e.stopPropagation();
        showExerciseGuide(decodeURIComponent(b.dataset.guide));
      });
      document.getElementById('start-session').onclick = () => {
        document.querySelector('.recorder').scrollIntoView({ behavior: 'smooth', block: 'center' });
        startTimerIfStopped();
      };
    }

    async function substituteExercise(idx) {
      const day = plan.weekly_schedule[state.dayIndex];
      const ex = day.exercises[idx];
      const reason = await new Promise((resolve) => {
        const el = openModal(`
          <div class="modal-head"><h3>Substituir exercício</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
          <p class="muted fs14" style="margin-top:0">A IA vai sugerir uma alternativa equivalente para <strong style="color:var(--text)">${esc(ex.name)}</strong>, respeitando seus equipamentos e limitações.</p>
          <div class="field"><label>Por que deseja substituir?</label>
            <select class="select" id="sub-reason">
              <option value="Não tenho o equipamento disponível">Não tenho o equipamento</option>
              <option value="Sinto desconforto neste movimento">Sinto desconforto</option>
              <option value="Quero variar o estímulo">Quero variar o estímulo</option>
              <option value="Prefiro outro exercício para este músculo">Prefiro outro exercício</option>
            </select>
          </div>
          <div class="field mt2"><label>Detalhes (opcional)</label><textarea class="textarea" id="sub-detail" placeholder="Ex.: o ombro incomoda na descida..."></textarea></div>
          <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button>
          <button class="btn btn-primary" id="sub-confirm">${icon('sparkles')} Substituir com IA</button></div>`, { onMount(m) {
          m.querySelector('#sub-confirm').onclick = () => {
            const reason2 = m.querySelector('#sub-reason').value + (m.querySelector('#sub-detail').value ? ' — ' + m.querySelector('#sub-detail').value : '');
            closeModal(); resolve(reason2);
          };
        } });
        el.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => { closeModal(); resolve(null); });
      });
      if (!reason) return;
      const loadingEl = toast('Consultando a IA para substituir...', 'success', 90000);
      try {
        const res = await API.post(`/api/workouts/${w.id}/substitute`, { day_index: state.dayIndex, ex_index: idx, reason });
        plan.weekly_schedule[state.dayIndex].exercises[idx] = res.exercise;
        loadingEl.remove();
        toast(res.message || 'Exercício substituído!');
        state.open[idx] = true;
        renderDay();
        showExerciseGuide(res.exercise.name, res.exercise, res.explanation);
      } catch (e) {
        loadingEl.remove();
        if (e.code === 'QUOTA_EXCEEDED' || e.code === 'UPGRADE_REQUIRED') { upgradeModal('Substituição de exercícios com IA'); return; }
        toast(e.message, 'error');
      }
    }

    /* --------------------------- Painel de registro --------------------------- */
    const rec = { sets: {}, timer: null, seconds: 0, running: false };
    function renderRecorder() {
      const day = plan.weekly_schedule[state.dayIndex];
      const box = document.getElementById('recorder');
      box.innerHTML = `
        <div class="card">
          <div class="rec-top">
            <div><div class="fs12 dim" style="text-transform:uppercase;letter-spacing:.08em;font-weight:600">Sessão de hoje</div>
            <div class="timer ${rec.running ? 'running' : ''}" id="timer">${String(Math.floor(rec.seconds / 60)).padStart(2, '0')}:${String(rec.seconds % 60).padStart(2, '0')}</div></div>
            <button class="btn-icon" id="timer-toggle" title="Iniciar/pausar cronômetro">${icon(rec.running ? 'pause' : 'play')}</button>
          </div>
          <div class="fs13 muted mb2">Marque as séries concluídas e ajuste carga e repetições. Suas cargas alimentam a progressão inteligente.</div>
          <div id="rec-blocks">
            ${day.exercises.map((ex, j) => {
              const nSets = Math.min(8, Math.max(1, Number(ex.sets) || 3));
              const saved = rec.sets[j] || Array.from({ length: nSets }, () => ({ reps: '', weight: '', done: false }));
              rec.sets[j] = saved;
              return `<div class="rec-ex-block" data-rec="${j}">
                <div class="rec-ex-head"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ex.name)}</span><span class="rec-progress" data-progress="${j}">0/${nSets}</span></div>
                <table class="rec-set-table">
                  <thead><tr><th style="width:28px">#</th><th>Reps</th><th>Carga (kg)</th><th style="width:32px"></th></tr></thead>
                  <tbody>
                    ${saved.map((s, k) => `<tr>
                      <td class="dim">${k + 1}</td>
                      <td><input class="rec-input" data-i="${j}-${k}-reps" inputmode="numeric" placeholder="${extractReps(ex.reps)}" value="${s.reps}"></td>
                      <td><input class="rec-input" data-i="${j}-${k}-weight" inputmode="decimal" placeholder="0" value="${s.weight}"></td>
                      <td><button class="check-set ${s.done ? 'done' : ''}" data-check="${j}-${k}" aria-label="Concluir série">${icon('check')}</button></td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>`;
            }).join('')}
          </div>
          <div class="field mt2"><label class="fs12">Esforço percebido (RPE)</label>
            <input type="range" min="1" max="10" value="7" id="rpe" style="margin-top:6px">
            <div class="row-between fs12 dim"><span>Leve</span><span id="rpe-val" class="lime" style="font-weight:600">7 · desafiador</span><span>Máximo</span></div>
          </div>
          <button class="btn btn-primary btn-block mt2" id="finish-session">${icon('checkCircle')} Concluir treino</button>
          <div class="fs11 dim center mt1">Seus dados só são salvos ao concluir.</div>
        </div>`;

      box.querySelector('#timer-toggle').onclick = () => toggleTimer();
      box.querySelectorAll('.rec-input').forEach((inp) => inp.oninput = () => {
        const [j, k, field] = inp.dataset.i.split('-');
        rec.sets[j][k][field === 'reps' ? 'reps' : 'weight'] = inp.value;
      });
      box.querySelectorAll('[data-check]').forEach((b) => b.onclick = () => {
        const [j, k] = b.dataset.check.split('-').map(Number);
        rec.sets[j][k].done = !rec.sets[j][k].done;
        b.classList.toggle('done', rec.sets[j][k].done);
        updateProgress(j);
      });
      const rpe = box.querySelector('#rpe');
      const labels = { 1: 'muito leve', 2: 'muito leve', 3: 'leve', 4: 'leve', 5: 'moderado', 6: 'moderado', 7: 'desafiador', 8: 'difícil', 9: 'muito difícil', 10: 'máximo' };
      rpe.oninput = () => box.querySelector('#rpe-val').textContent = `${rpe.value} · ${labels[rpe.value]}`;
      Object.keys(rec.sets).forEach((j) => updateProgress(Number(j)));
      box.querySelector('#finish-session').onclick = finishSession;
    }

    function updateProgress(j) {
      const el = document.querySelector(`[data-progress="${j}"]`);
      if (!el) return;
      const sets = rec.sets[j];
      el.textContent = `${sets.filter((s) => s.done).length}/${sets.length}`;
    }

    function extractReps(reps) {
      const m = String(reps || '10').match(/\d+/);
      return m ? m[0] : '10';
    }

    function toggleTimer() {
      rec.running = !rec.running;
      const btn = document.querySelector('#timer-toggle');
      if (btn) btn.innerHTML = icon(rec.running ? 'pause' : 'play');
      document.querySelector('#timer')?.classList.toggle('running', rec.running);
      if (rec.running && !rec.timer) {
        rec.timer = setInterval(() => {
          rec.seconds++;
          const t = document.getElementById('timer');
          if (t) t.textContent = `${String(Math.floor(rec.seconds / 60)).padStart(2, '0')}:${String(rec.seconds % 60).padStart(2, '0')}`;
        }, 1000);
      }
    }
    function startTimerIfStopped() { if (!rec.running) toggleTimer(); }

    async function finishSession() {
      const day = plan.weekly_schedule[state.dayIndex];
      const sets = [];
      Object.entries(rec.sets).forEach(([j, arr]) => {
        const ex = day.exercises[Number(j)];
        arr.forEach((s, k) => {
          if (s.done) sets.push({ exercise_name: ex.name, set_number: k + 1, reps: Number(s.reps) || Number(extractReps(ex.reps)), weight_kg: Number(String(s.weight).replace(',', '.')) || 0, completed: true });
        });
      });
      if (!sets.length) {
        const ok = await confirmModal({ title: 'Nenhuma série marcada', message: 'Você ainda não marcou séries como concluídas. Deseja registrar o treino mesmo assim (sem cargas)?', confirmText: 'Registrar mesmo assim' });
        if (!ok) return;
      }
      const btn = document.getElementById('finish-session');
      setLoading(btn, true, 'Salvando...');
      try {
        const duration = Math.max(1, Math.round(rec.seconds / 60)) || day.estimated_minutes;
        await API.post('/api/sessions', {
          workout_id: w.id, day_key: day.day, name: day.title,
          performed_at: localNowISO(), duration_min: duration,
          effort: Number(document.getElementById('rpe').value), sets,
        });
        if (rec.timer) clearInterval(rec.timer);
        toast(`Treino concluído! ${sets.length} séries registradas.`);
        setTimeout(() => navigate('/app'), 600);
      } catch (e) {
        setLoading(btn, false);
        toast(e.message, 'error');
      }
    }

    document.querySelectorAll('[data-day]').forEach((t) => t.onclick = () => {
      state.dayIndex = Number(t.dataset.day);
      state.open = {};
      rec.sets = {};
      renderDay();
    });

    document.getElementById('btn-activate-other').onclick = openWorkoutList;
    document.getElementById('btn-progression').onclick = openProgression;
    renderDay();
  }

  /* --------------------------- Gerador --------------------------- */
  async function openGenerator() {
    const p = App.profile || {};
    const el = openModal(`
      <div class="modal-head"><h3>Gerar novo treino com IA</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <div class="summary-list mb3">
        <div class="summary-line"><span>Perfil</span><span>${p.age || '—'} anos · ${p.height_cm || '—'} cm · ${p.weight_kg || '—'} kg</span></div>
        <div class="summary-line"><span>Objetivo</span><span>${esc(goalLabel(p.goal))}</span></div>
        <div class="summary-line"><span>Nível</span><span>${esc(levelLabel(p.level))}</span></div>
        <div class="summary-line"><span>Disponibilidade</span><span>${p.days_per_week || '—'}x por semana · ${p.minutes_per_session || '—'} min</span></div>
        <div class="summary-line"><span>Local e equipamentos</span><span>${esc(locationLabel(p.location))}${p.equipment ? ' · ' + safeList(p.equipment).join(', ') : ''}</span></div>
        <div class="summary-line"><span>Limitações</span><span>${p.injuries ? esc(p.injuries).slice(0, 60) : 'nenhuma declarada'}</span></div>
      </div>
      <div class="field"><label>Modalidade</label>
        <select class="select" id="gen-modality">
          ${MODALITIES.map((m) => `<option value="${m.id}" ${m.id === 'musculacao' ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </div>
      <div class="field mt2"><label>Ajustes ou pedidos específicos (opcional)</label>
        <textarea class="textarea" id="gen-notes" placeholder="Ex.: quero mais foco em costas, evitar barra livre, treinos mais curtos na sexta..."></textarea>
      </div>
      <a href="/onboarding?edit=1" data-link class="fs12 lime mt2" style="display:inline-block">Alterar meu perfil antes de gerar →</a>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button>
      <button class="btn btn-primary" id="gen-confirm">${icon('sparkles')} Gerar treino</button></div>`, { size: 'modal-lg', onMount(m) {
      m.querySelector('#gen-confirm').onclick = async () => {
        const modality = m.querySelector('#gen-modality').value;
        const notes = m.querySelector('#gen-notes').value;
        const btn = m.querySelector('#gen-confirm');
        setLoading(btn, true, 'A IA está montando seu treino...');
        m.querySelector('[data-close]').disabled = true;
        try {
          const res = await API.post('/api/workouts/generate', { modality, notes });
          closeModal();
          WORKOUT_CACHE.active = res;
          toast('Treino gerado com sucesso!');
          if (res.quota) updateQuotaBadge(res.quota);
          renderActive(res);
        } catch (e) {
          setLoading(btn, false);
          m.querySelector('[data-close]').disabled = false;
          if (e.code === 'QUOTA_EXCEEDED') { closeModal(); upgradeModal('Gerações de treino'); return; }
          if (e.code === 'AI_NOT_CONFIGURED') { closeModal(); aiNotConfiguredModal(); return; }
          // cota da IA esgotada no provedor: aviso longo e explícito, não um toast curto
          if (e.code === 'AI_QUOTA_DAILY') {
            setLoading(btn, false);
            m.querySelector('.modal-actions')?.insertAdjacentHTML('beforeend', '');
            const box = document.createElement('div');
            box.className = 'alert alert-danger mt2';
            box.innerHTML = `${icon('alert')}<div><strong>Serviço de IA temporariamente indisponível.</strong><br>${esc(e.message)}</div>`;
            m.appendChild(box);
            return;
          }
          toast(e.message, 'error', 8000);
        }
      };
    } });
    el.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
  }

  async function openWorkoutList() {
    try {
      const { workouts } = await API.get('/api/workouts');
      openModal(`
        <div class="modal-head"><h3>Programas salvos</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
        ${workouts.length ? workouts.map((w) => `
          <div class="list-item">
            <div class="feature-icon" style="margin:0;width:36px;height:36px;flex:none">${icon('dumbbell')}</div>
            <div class="grow" style="min-width:0">
              <strong class="fs13" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(w.name)}</strong>
              <span class="fs12 dim">${fmt.date(w.created_at)} · ${esc(goalLabel(w.goal))} · ${w.days_per_week}x</span>
            </div>
            ${w.status === 'active' ? '<span class="badge badge-lime badge-sm">Ativo</span>' : `<button class="btn btn-dark btn-sm" data-activate="${w.id}">Ativar</button>`}
            <button class="btn-icon" data-del="${w.id}" title="Excluir">${icon('trash')}</button>
          </div>`).join('') : `<div class="empty"><div class="empty-icon">${icon('dumbbell')}</div><h4>Nenhum programa ainda</h4><p>Gere seu primeiro treino com IA.</p></div>`}
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Fechar</button></div>`, { size: 'modal-lg', onMount(m) {
        m.querySelectorAll('[data-activate]').forEach((b) => b.onclick = async () => {
          await API.post(`/api/workouts/${b.dataset.activate}/activate`);
          closeModal(); toast('Programa ativado.'); load();
        });
        m.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
          const ok = await confirmModal({ title: 'Excluir programa', message: 'O histórico de sessões associado será mantido. Deseja excluir?', confirmText: 'Excluir', danger: true });
          if (!ok) return;
          await API.del(`/api/workouts/${b.dataset.del}`);
          toast('Programa excluído.'); load();
        });
        m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
      } });
    } catch (e) { toast(e.message, 'error'); }
  }

  async function openProgression() {
    const active = WORKOUT_CACHE.active?.workout;
    if (!active) return;
    if (App.user.plan === 'free') { upgradeModal('Progressão inteligente'); return; }
    const analysis = active.plan_json?.progression_analysis;
    if (analysis) return showProgression(analysis, active);
    const loading = openModal(`
      <div class="modal-head"><h3>Progressão inteligente</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <div style="text-align:center;padding:30px 10px">
        <div class="spinner" style="width:34px;height:34px;margin:0 auto 18px;border-width:3px"></div>
        <p class="muted fs14">A IA está analisando suas cargas, esforço e consistência das últimas 4 semanas...</p>
        <p class="fs12 dim">Isso pode levar alguns segundos.</p>
      </div>`);
    try {
      const res = await API.post(`/api/workouts/${active.id}/progress`);
      closeModal();
      showProgression(res.analysis, active);
    } catch (e) {
      closeModal();
      if (e.code === 'UPGRADE_REQUIRED') { upgradeModal('Progressão inteligente'); return; }
      toast(e.message, 'error', 7000);
    }
  }

  function showProgression(a, workout) {
    const readiness = { pronto: ['Pronto para progredir', 'badge-lime'], 'atenção': ['Atenção', 'badge-orange'], 'recuperação': ['Priorize recuperação', 'badge-orange'] }[a.readiness] || ['', 'badge'];
    openModal(`
      <div class="modal-head"><h3>${icon('brain')} Análise de progressão</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <div class="row wrap mb2" style="gap:8px">
        <span class="badge ${readiness[1]}">${readiness[0]}</span>
        ${a.generated_at ? `<span class="fs11 dim">gerado em ${fmt.date(a.generated_at)} ${fmt.time(a.generated_at)}</span>` : ''}
      </div>
      <p class="fs14" style="color:var(--text)">${esc(a.headline || '')}</p>
      ${(a.load_suggestions || []).length ? `<div class="card card-tight mb2"><strong class="fs12" style="text-transform:uppercase;letter-spacing:.06em;color:var(--text-3)">Sugestões de carga</strong>
        ${a.load_suggestions.map((s) => `<div class="goal-row" style="padding:10px 0;border-color:var(--border)"><div class="top"><strong>${esc(s.exercise)}</strong><span class="lime">${esc(s.suggestion)}</span></div>
        <span class="fs12 dim">Atual: ${esc(s.current)} — ${esc(s.reason)}</span></div>`).join('')}</div>` : ''}
      ${a.volume_adjustments ? `<div class="mb2"><strong class="fs13">Volume e séries:</strong> <span class="fs13 muted">${esc(a.volume_adjustments)}</span></div>` : ''}
      ${a.split_advice ? `<div class="mb2"><strong class="fs13">Divisão de treino:</strong> <span class="fs13 muted">${esc(a.split_advice)}</span></div>` : ''}
      ${a.deload ? `<div class="mb2"><strong class="fs13">Recuperação / deload:</strong> <span class="fs13 muted">${esc(a.deload)}</span></div>` : ''}
      ${(a.next_steps || []).length ? `<div class="alert alert-lime mb2">${icon('checkCircle')}<div><strong>Próximos passos</strong><ul style="margin:6px 0 0;padding-left:18px;list-style:disc">${a.next_steps.map((s) => `<li style="margin-bottom:4px">${esc(s)}</li>`).join('')}</ul></div></div>` : ''}
      ${(a.cautions || []).length ? `<div class="alert alert-warn">${icon('alert')}<div>${a.cautions.map(esc).join(' · ')}</div></div>` : ''}
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Fechar</button>
      <button class="btn btn-primary" id="regen-plan">${icon('refresh')} Regenerar treino com ajustes</button></div>`, { size: 'modal-lg', onMount(m) {
      m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
      m.querySelector('#regen-plan').onclick = async () => { closeModal(); openGenerator(); };
    } });
  }

  function updateQuotaBadge(q) { /* placeholder para uso futuro */ }

  document.querySelector('#btn-generate').onclick = openGenerator;
  if (shouldGenerate) { history.replaceState({}, '', '/treinos'); await load(); openGenerator(); }
  else await load();
}

/* ----------------------------- Helpers de exibição ----------------------------- */
function goalLabel(id) {
  return { hipertrofia: 'Hipertrofia', emagrecimento: 'Emagrecimento', forca: 'Força', resistencia: 'Resistência', condicionamento: 'Condicionamento', definicao: 'Definição', massa: 'Ganho de massa', desempenho: 'Desempenho esportivo', funcional: 'Funcional' }[id] || id || '—';
}
function levelLabel(id) {
  return { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }[id] || id || '—';
}
function locationLabel(id) {
  return { academia: 'Academia', casa: 'Em casa', ar_livre: 'Ao ar livre', hotel: 'Hotel', condominio: 'Condomínio' }[id] || id || '—';
}
function safeList(v) { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } }
function localNowISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function aiNotConfiguredModal() {
  openModal(`
    <div class="modal-head"><h3>Integração com IA não configurada</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
    <div class="alert alert-warn">${icon('alert')}<div>A IA ainda não está configurada neste servidor. Um administrador precisa informar o provedor e a chave de API em <strong>Painel Admin → Integração com IA</strong>.</div></div>
    <p class="fs13 muted mt2">O FitAI não gera treinos fictícios: sem uma integração real configurada, a geração fica bloqueada — como deve ser.</p>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>Entendi</button>
    ${App.user?.role === 'admin' ? '<a href="/admin?tab=ia" data-link class="btn btn-primary">Configurar agora</a>' : ''}</div>`, { onMount(m) { m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal); } });
}

async function showExerciseGuide(name, preset, explanation) {
  let ex = preset;
  if (!ex) {
    try {
      const { exercises } = await API.get('/api/exercises?q=' + encodeURIComponent(name));
      ex = exercises.find((e) => e.name.toLowerCase() === name.toLowerCase()) || exercises[0];
    } catch { ex = null; }
  }
  if (!ex) {
    openModal(`<div class="modal-head"><h3>${esc(name)}</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <p class="muted fs14">Este exercício ainda não está na biblioteca. Pergunte ao Personal IA como executá-lo.</p>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Fechar</button><a href="/personal-ia" data-link class="btn btn-primary">Perguntar ao Personal IA</a></div>`,
      { onMount(m) { m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal); } });
    return;
  }
  openModal(`
    <div class="modal-head"><div><span class="badge badge-lime badge-sm mb2">${esc(ex.muscle || ex.primary_muscle || 'Exercício')}</span><h3 style="margin:0">${esc(ex.name)}</h3></div><button class="btn-icon" data-close>${icon('x')}</button></div>
    <div style="height:130px;border-radius:14px;background:radial-gradient(120% 100% at 50% 0%,rgba(198,244,50,.16),transparent 60%),var(--surface-2);display:grid;place-items:center;margin-bottom:16px;border:1px solid var(--border)">
      ${icon(muscleIcon(ex.muscle || ex.primary_muscle))}<span style="position:absolute"></span>
    </div>
    ${ex.why ? `<div class="why fs13" style="border-left:2px solid var(--lime);padding-left:12px;color:var(--text-2);margin-bottom:14px">${esc(ex.why)}</div>` : ''}
    ${explanation ? `<div class="alert alert-lime mb2">${icon('sparkles')}<div>${esc(explanation)}</div></div>` : ''}
    <div class="row wrap fs12 dim mb2" style="gap:14px">
      ${ex.equipment ? `<span class="row" style="gap:5px">${icon(equipIcon(ex.equipment))}${esc(ex.equipment)}</span>` : ''}
      <span class="row" style="gap:5px">${icon('target')}${esc(ex.muscle || ex.primary_muscle)}</span>
      ${ex.difficulty ? `<span class="row" style="gap:5px">${icon('trending')}${esc(ex.difficulty)}</span>` : ''}
    </div>
    ${ex.how || ex.instructions ? `<div class="mb2"><strong class="fs13">Execução</strong><p class="fs13 muted" style="margin:.4em 0 0">${esc(ex.how || ex.instructions)}</p></div>` : ''}
    ${ex.common_errors ? `<div class="mb2"><strong class="fs13">Erros comuns</strong><p class="fs13 muted" style="margin:.4em 0 0">${esc(ex.common_errors)}</p></div>` : ''}
    ${ex.tips ? `<div class="mb2"><strong class="fs13">Dica</strong><p class="fs13 muted" style="margin:.4em 0 0">${esc(ex.tips)}</p></div>` : ''}
    ${ex.locked ? `<div class="alert alert-warn">${icon('lock')}<div>Conteúdo completo deste exercício disponível nos planos Pro e Premium.</div></div>` : ''}
    <div class="modal-actions"><button class="btn btn-ghost" data-close>Fechar</button>
    <a href="/personal-ia?q=${encodeURIComponent('Como executar corretamente ' + ex.name + '?')}" data-link class="btn btn-primary">${icon('chat')} Perguntar ao Personal IA</a></div>`,
    { onMount(m) { m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal); } });
}

route('/treinos', (root) => withAuth(() => renderWorkouts(root)));
window.showExerciseGuide = showExerciseGuide;
window.goalLabel = goalLabel; window.levelLabel = levelLabel; window.locationLabel = locationLabel;
window.aiNotConfiguredModal = aiNotConfiguredModal;
