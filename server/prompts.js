'use strict';
/* Prompts da IA + guardrails determinísticos de segurança.
   Os guardrails rodam SEMPRE, mesmo com IA: nenhum exercício incompatível com limitações declaradas
   chega ao usuário, e avisos obrigatórios (menores, lesões, responsabilidade) são anexados. */

const GOAL_LABELS = {
  hipertrofia: 'Hipertrofia muscular',
  emagrecimento: 'Emagrecimento',
  forca: 'Ganho de força',
  resistencia: 'Resistência muscular',
  condicionamento: 'Condicionamento físico',
  definicao: 'Definição muscular',
  massa: 'Ganho de massa muscular',
  desempenho: 'Melhora do desempenho esportivo',
  funcional: 'Treinamento funcional',
};

const LEVEL_LABELS = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };

const LOCATION_LABELS = {
  academia: 'Academia completa',
  casa: 'Em casa',
  ar_livre: 'Ao ar livre / praça',
  hotel: 'Hotel / quarto',
  condominio: 'Academia de condomínio',
};

const MODALITY_LABELS = {
  musculacao: 'Musculação', casa: 'Treino em casa', calistenia: 'Calistenia', cross: 'Cross training',
  funcional: 'Treino funcional', hiit: 'HIIT', cardio: 'Cardio', 'pesos-livres': 'Treino com pesos livres',
  maquinas: 'Treino com máquinas',
};

const BASE_SYSTEM = `Você é o "Personal IA" do FitAI, especialista em prescrição de treinos de musculação, condicionamento e esporte, com formação em ciências do exercício.

REGRAS DE SEGURANÇA E ÉTICA (obrigatórias):
1. Você NÃO substitui médicos nem profissionais de educação física. Quando fizer sentido, recomende avaliação profissional.
2. NUNCA prescreva exercícios incompatíveis com as lesões/limitações relatadas. Se houver dúvida, escolha alternativa mais segura e explique.
3. Não incentive cargas extremas, treino até a falha em todos os exercícios, "no pain no gain" ou práticas de risco.
4. Respeite idade e nível: iniciantes recebem volume e complexidade menores; menores de 18 anos recebem linguagem adequada, foco em técnica e recomendação de acompanhamento de um profissional de educação física/responsável.
5. NÃO prometa resultados garantidos. Fale em progresso esperado com consistência.
6. Use linguagem clara, motivadora e profissional, em português do Brasil.
7. Nunca invente dados do usuário.`;

const TRACKING_SCHEMA = `{
  "split_name": "nome curto da divisão (ex: Push/Pull/Legs, Upper/Lower, Full Body, ABCD)",
  "summary": "2-4 frases explicando a lógica do programa e por que ele atende ao objetivo e à rotina",
  "weekly_schedule": [
    {
      "day": "A",
      "day_label": "Segunda",
      "title": "título do treino (ex: Push — Peito, Ombros e Tríceps)",
      "focus": ["Peito","Ombros"],
      "estimated_minutes": 60,
      "warmup": "aquecimento específico e progressivo (5-10 min), citando exercícios e séries de aproximação",
      "exercises": [
        {
          "name": "nome do exercício",
          "muscle": "grupo muscular principal",
          "secondary": ["músculos secundários"],
          "equipment": "equipamento necessário",
          "sets": 4,
          "reps": "8-10",
          "rest_seconds": 90,
          "tempo": "2-0-2 (opcional)",
          "why": "por que este exercício foi escolhido para este usuário (1-2 frases)",
          "how": "execução resumida e correta em 1-2 frases",
          "progression": "como progredir neste exercício (1 frase)"
        }
      ]
    }
  ],
  "schedule_notes": "observações sobre distribuição semanal e dias de descanso",
  "progression_plan": "plano de progressão ao longo de 4-6 semanas, explicando sobrecarga progressiva e deload",
  "recovery": "recomendações de recuperação: sono, hidratação, mobilidade, nutrição geral (sem prescrever dieta)",
  "cardio_notes": "orientação de cardio/atividade aeróbica compatível com o objetivo (ou 'não se aplica')",
  "safety_notes": ["avisos de segurança específicos ao perfil"],
  "estimated_weekly_sessions": 4
}`;

function perfilBlock(profile, extra = {}) {
  const p = profile || {};
  const injuries = (p.injuries || '').trim();
  const equip = Array.isArray(p.equipment) ? p.equipment : safeArr(p.equipment);
  const focus = Array.isArray(p.focus_muscles) ? p.focus_muscles : safeArr(p.focus_muscles);
  return `PERFIL DO ALUNO:
- Idade: ${p.age ?? 'não informada'} anos
- Sexo: ${p.sex === 'F' ? 'Feminino' : p.sex === 'M' ? 'Masculino' : 'Não informado'}
- Altura: ${p.height_cm ?? 'não informada'} cm | Peso: ${p.weight_kg ?? 'não informado'} kg
- Objetivo principal: ${GOAL_LABELS[p.goal] || p.goal || 'não informado'}
- Nível de experiência: ${LEVEL_LABELS[p.level] || p.level || 'não informado'}
- Dias disponíveis por semana: ${p.days_per_week ?? 'não informado'}
- Tempo por treino: ${p.minutes_per_session ?? 'não informado'} minutos
- Local de treino: ${LOCATION_LABELS[p.location] || p.location || 'não informado'}
- Equipamentos disponíveis: ${equip.length ? equip.join(', ') : 'somente peso do corpo'}
- Grupos musculares de interesse: ${focus.length ? focus.join(', ') : 'sem preferência'}
- Lesões, limitações ou restrições: ${injuries || 'nenhuma declarada'}
- Modalidade preferida: ${MODALITY_LABELS[extra.modality] || extra.modality || 'a IA deve sugerir a mais adequada'}${extra.notes ? `\n- Observações do aluno: ${extra.notes}` : ''}`;
}

function safeArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
}

function buildWorkoutPrompt(profile, opts = {}) {
  const system = `${BASE_SYSTEM}

Você montará um programa de treino completo e REALISTA para o aluno descrito.
Diretrizes técnicas:
- Respeite EXATAMENTE o número de dias por semana informado e o tempo por sessão (conte séries, descanso e aquecimento).
- Escolha a divisão mais adequada (ABC, ABCD, ABCDE, Full Body, Upper/Lower, PPL...) e justifique brevemente. Se o aluno pediu uma divisão específica, use-a se fizer sentido para a frequência.
- Use apenas equipamentos que o aluno tem acesso (local + equipamentos declarados).
- Priorize os grupos musculares de interesse SEM negligenciar o equilíbrio do corpo (empurre/puxe, joelho/quadril, core).
- Ajuste volume por nível: iniciante 4-6 exercícios/sessão e RPE ~6-7; intermediário 5-7; avançado 6-8 (quando o tempo permitir).
- Repetições por objetivo: hipertrofia 6-12, força 3-6, resistência/definição 12-20, condicionamento/HIIT intervalos, emagrecimento combina força + gasto calórico.
- Inclua aquecimento específico em cada dia e sugestões de progressão.
- Coloque descanso entre 60-180s conforme exercício e objetivo.
- NUNCA repita exercícios em excesso; máx. 2 exercícios por grupo principal por sessão em iniciantes.
- EXCLUA qualquer movimento incompatível com lesões declaradas; escolha variações seguras.
- Para menores de 18 anos, evite cargas máximas, enfatize técnica e recomende acompanhamento profissional.
- Não prometa resultados. Sem emojis nos campos de dados.

Responda apenas com JSON válido no formato:
${TRACKING_SCHEMA}`;

  const user = `${perfilBlock(profile, opts)}

${opts.previousPlanSummary ? `PROGRAMA ATUAL (o aluno pediu uma nova versão — varie os exercícios e melhore):\n${opts.previousPlanSummary}\n` : ''}
${opts.regenerateNotes ? `MOTIVO DA REGENERAÇÃO / AJUSTES PEDIDOS: ${opts.regenerateNotes}\n` : ''}
Monte o programa completo. Gere EXATAMENTE ${profile?.days_per_week || 4} dias de treino na semana.`;
  return { system, user };
}

/* ------------------------------- Guardrails ------------------------------- */
const CONTRAINDICATIONS = {
  joelho: {
    patterns: [/salto/i, /burpee/i, /box jump/i, /polichinelo/i, /búlgaro/i, /afundo/i, /agachamento l(i|í)vre/i, /agachamento com salto/i, /escalador/i],
    note: 'Pelo relato de limitação no joelho, foram removidos saltos, agachamentos profundos unilaterais e exercícios de alto impacto. Prefira variações controladas e amplitude confortável.',
  },
  ombro: {
    patterns: [/militar/i, /desenvolvimento/i, /mergulho/i, /supino declinado/i, /elevação frontal/i, /barra fixa/i, /supino reto com barra/i, /face pull/i],
    note: 'Pelo relato de limitação no ombro, foram evitados movimentos acima da cabeça e de grande estresse articular. Use amplitude confortável e cargas moderadas.',
  },
  lombar: {
    patterns: [/levantamento terra/i, /stiff/i, /remada curvada/i, /hiperextensão/i, /kettlebell swing/i, /agachamento livre/i, /remada cavalinho/i, /farmer walk/i],
    note: 'Pelo relato de limitação lombar, foram removidos exercícios de grande carga axial e flexão sob carga. Prefira máquinas, apoios e core estabilizador.',
  },
  coluna: {
    patterns: [/levantamento terra/i, /stiff/i, /remada curvada/i, /hiperextensão/i, /kettlebell swing/i, /agachamento livre/i, /box jump/i, /abdominal remador/i],
    note: 'Pelo relato de limitação na coluna, removemos movimentos de alta carga axial e impacto. Mantenha coluna neutra e priorize controle.',
  },
  quadril: {
    patterns: [/búlgaro/i, /agachamento sumô/i, /afundo/i, /corrida na esteira/i, /box jump/i, /agachamento com salto/i],
    note: 'Pelo relato de limitação no quadril, foram removidos exercícios de grande amplitude unilateral e impacto. Trabalhe em amplitude confortável.',
  },
  punho: {
    patterns: [/flexão de braço/i, /flexão fechada/i, /mergulho no banco/i, /barra fixa/i],
    note: 'Pelo relato de limitação no punho, foram evitados apoios extremos de mão. Use pegas neutras quando possível.',
  },
  cotovelo: {
    patterns: [/barra fixa/i, /rosca scott/i, /tríceps francês/i],
    note: 'Pelo relato de limitação no cotovelo, foram removidos exercícios de maior estresse articular. Prefira amplitude parcial sem dor.',
  },
  tornozelo: {
    patterns: [/salto/i, /burpee/i, /polichinelo/i, /pular corda/i, /corrida na esteira em Zona 2/i, /box jump/i],
    note: 'Pelo relato de limitação no tornozelo, removemos atividades de impacto. Prefira bike, elíptico ou caminhada conforme tolerância.',
  },
};

function detectInjuryKeys(injuries) {
  const s = (injuries || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!s.trim()) return [];
  const map = {
    joelho: ['joelho', 'knee', 'menisco', 'ligamento', 'patel'],
    ombro: ['ombro', 'shoulder', 'manguito', 'rotador', 'clavicula'],
    lombar: ['lombar', 'lower back', 'hernia', 'disco'],
    coluna: ['coluna', 'spine', 'escoliose', 'espondilo'],
    quadril: ['quadril', 'hip', 'labral'],
    punho: ['punho', 'wrist', 'carpo'],
    cotovelo: ['cotovelo', 'elbow', 'epicondil'],
    tornozelo: ['tornozelo', 'ankle', 'entorse'],
  };
  const keys = [];
  for (const [k, words] of Object.entries(map)) {
    if (words.some((w) => s.includes(w))) keys.push(k);
  }
  return keys;
}

function applyGuardrails(plan, profile = {}) {
  const notices = [];
  if (!plan || typeof plan !== 'object') throw new Error('Plano inválido');
  plan.notices = Array.isArray(plan.notices) ? plan.notices : [];
  plan.safety_notes = Array.isArray(plan.safety_notes) ? plan.safety_notes : [];

  // Normalização defensiva
  const sched = Array.isArray(plan.weekly_schedule) ? plan.weekly_schedule : [];
  plan.weekly_schedule = sched.map((d, i) => ({
    day: d.day || String.fromCharCode(65 + i),
    day_label: d.day_label || '',
    title: d.title || `Treino ${String.fromCharCode(65 + i)}`,
    focus: Array.isArray(d.focus) ? d.focus : [],
    estimated_minutes: clampNum(d.estimated_minutes, 20, 180, profile.minutes_per_session || 60),
    warmup: d.warmup || '5-10 minutos de aquecimento geral e séries de aproximação com carga leve.',
    exercises: (Array.isArray(d.exercises) ? d.exercises : []).map((ex) => ({
      name: String(ex.name || 'Exercício'),
      muscle: ex.muscle || '',
      secondary: Array.isArray(ex.secondary) ? ex.secondary : safeArr(ex.secondary),
      equipment: ex.equipment || '',
      sets: clampNum(ex.sets, 1, 10, 3),
      reps: String(ex.reps || '8-12'),
      rest_seconds: clampNum(ex.rest_seconds, 15, 300, 90),
      tempo: ex.tempo || '',
      why: ex.why || '',
      how: ex.how || '',
      progression: ex.progression || '',
    })),
  })).filter((d) => d.exercises.length > 0);

  if (!plan.weekly_schedule.length) throw new Error('A IA não retornou dias de treino válidos.');

  // Filtro de contraindicações
  const injuryKeys = detectInjuryKeys(profile.injuries);
  let removed = 0;
  for (const key of injuryKeys) {
    const rule = CONTRAINDICATIONS[key];
    if (!rule) continue;
    for (const day of plan.weekly_schedule) {
      const before = day.exercises.length;
      day.exercises = day.exercises.filter((ex) => !rule.patterns.some((p) => p.test(ex.name)));
      removed += before - day.exercises.length;
      if (day.exercises.length === 0) day.exercises = [];
    }
    plan.notices.push(rule.note);
  }
  plan.weekly_schedule = plan.weekly_schedule.filter((d) => d.exercises.length > 0);
  if (!plan.weekly_schedule.length) {
    throw new Error('Após o filtro de segurança, nenhum exercício compatível permaneceu. Revise suas limitações no perfil ou consulte um profissional.');
  }
  if (removed > 0) plan.notices.push(`${removed} exercício(s) foram substituídos/removidos automaticamente por segurança, considerando suas limitações.`);

  // Faixa etária
  const age = Number(profile.age) || 0;
  if (age > 0 && age < 18) {
    plan.notices.push('Por ser menor de idade, este programa prioriza técnica, cargas moderadas e progressão conservadora. É recomendável o acompanhamento de um profissional de educação física e a ciência do seu responsável.');
  }
  if (age >= 60) {
    plan.notices.push('Para sua faixa etária, priorize amplitude confortável, cargas moderadas, aquecimento mais longo e avaliação médica antes de aumentar a intensidade.');
  }
  plan.notices.push('Este treino é uma orientação educativa gerada por IA e não substitui acompanhamento médico ou de profissional de educação física.');
  return plan;
}

function clampNum(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/* ------------------------------ Substituição ------------------------------ */
function buildSubstitutionPrompt(exercise, reason, profile, planContext) {
  const system = `${BASE_SYSTEM}
Você deve substituir UM exercício do programa por uma alternativa equivalente e mais adequada, mantendo o estímulo do grupo muscular.
Responda apenas com JSON válido no formato:
{
  "name": "nome do novo exercício",
  "muscle": "grupo principal",
  "secondary": ["secundários"],
  "equipment": "equipamento",
  "sets": 3,
  "reps": "8-12",
  "rest_seconds": 90,
  "why": "por que substitui bem o original (1-2 frases)",
  "how": "execução resumida",
  "progression": "como progredir",
  "explanation": "explicação geral da troca"
}`;
  const user = `Exercício a substituir: ${exercise.name} (${exercise.muscle || 'grupo não informado'}, ${exercise.sets}x${exercise.reps}).
Motivo da substituição: ${reason || 'preferência do aluno'}.
${perfilBlock(profile)}
${planContext ? `Contexto do programa: ${planContext}` : ''}
Escolha uma alternativa compatível com equipamentos e limitações. Se o motivo for lesão, remova o padrão de movimento que a agrava.`;
  return { system, user };
}

/* ------------------------------ Progressão ------------------------------ */
function buildProgressionPrompt(profile, workout, stats) {
  const system = `${BASE_SYSTEM}
Você é responsável pela progressão inteligente de cargas. Analise o histórico REAL de execução, esforço percebido (RPE) e adesão antes de sugerir qualquer aumento.
Regras:
- Só sugira aumento de carga quando a série prescrita foi completada com RPE moderado; caso contrário, mantenha ou reduza.
- Considere recuperação, frequência e consistência. Nunca proponha saltos bruscos (>10% de carga por ciclo).
- Se houver estagnação, sugira variação de estímulo, deload ou ajuste de volume.
Responda apenas com JSON válido no formato:
{
  "headline": "resumo curto da análise",
  "readiness": "pronto | atenção | recuperação",
  "load_suggestions": [{"exercise": "nome", "current": "carga/rep atual", "suggestion": "sugestão", "reason": "motivo"}],
  "volume_adjustments": "ajustes de séries/repetições sugeridos",
  "split_advice": "se a divisão atual ainda é adequada e por quê",
  "deload": "recomendação de recuperação/deload",
  "next_steps": ["3 a 5 próximos passos práticos"],
  "cautions": ["avisos"]
}`;
  const user = `${perfilBlock(profile)}
PROGRAMA ATUAL: ${workout ? workout.name + ' — ' + (workout.split || '') : 'sem programa cadastrado'}
ESTATÍSTICAS REAIS (últimos 28 dias): ${JSON.stringify(stats)}
Analise e devolva a recomendação de progressão.`;
  return { system, user };
}

/* ------------------------------ Chat ------------------------------ */
function buildChatSystemPrompt(profile, context) {
  return `${BASE_SYSTEM}

Você é o Personal IA dentro do app FitAI. Responda em português do Brasil, com objetividade e clareza (normalmente 2-5 parágrafos curtos; use listas quando útil).
Você tem acesso ao contexto real do aluno abaixo — use-o para personalizar as respostas em vez de dar conselhos genéricos. Se a pergunta envolver dor aguda, lesão suspeita ou condição médica, oriente procurar um profissional de saúde e não prescreva exercícios de risco.

CONTEXTO DO ALUNO:
${perfilBlock(profile)}
${context.program ? `\nPROGRAMA ATIVO: ${context.program}\n` : ''}
${context.recentSessions ? `\nÚLTIMOS TREINOS REALIZADOS:\n${context.recentSessions}\n` : ''}
${context.progress ? `\nEVOLUÇÃO RECENTE DE CARGAS:\n${context.progress}\n` : ''}
${context.weightTrend ? `\nPESO CORPORAL: ${context.weightTrend}\n` : ''}
${context.exerciseLibrary ? `\nEXERCÍCIOS DISPONÍVEIS NA BIBLIOTECA (use estes nomes quando sugerir):\n${context.exerciseLibrary}\n` : ''}

Lembre sempre, quando pertinente, que você não substitui profissionais de saúde e educação física.`;
}

module.exports = {
  GOAL_LABELS, LEVEL_LABELS, LOCATION_LABELS, MODALITY_LABELS,
  buildWorkoutPrompt, applyGuardrails, detectInjuryKeys,
  buildSubstitutionPrompt, buildProgressionPrompt, buildChatSystemPrompt,
  perfilBlock, safeArr,
};
