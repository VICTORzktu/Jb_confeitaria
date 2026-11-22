'use strict';
const bcrypt = require('bcryptjs');
const { db, setSetting, getSetting } = require('./db');
const { EXERCISES } = require('./seed-exercises');

function slugify(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const MODALITIES = [
  ['Musculação', 'dumbbell', 'Treino com pesos e máquinas para hipertrofia, força e definição.'],
  ['Treino em casa', 'home', 'Treinos eficientes com pouco ou nenhum equipamento.'],
  ['Calistenia', 'body', 'Treino com peso do corpo: força, controle e mobilidade.'],
  ['Cross training', 'bolt', 'Mistura de força, potência, cardio e movimentos funcionais.'],
  ['Treino funcional', 'activity', 'Movimentos que transferem força para o dia a dia e o esporte.'],
  ['HIIT', 'flame', 'Alta intensidade em intervalos curtos para condicionamento e queima calórica.'],
  ['Cardio', 'heart', 'Condicionamento aeróbico com baixo custo e grande benefício à saúde.'],
  ['Treino com pesos livres', 'weight', 'Barras, halteres e kettlebells para força funcional.'],
  ['Treino com máquinas', 'machine', 'Estabilidade e segurança para iniciantes e isolamento muscular.'],
];

async function seedExercises() {
  const count = (await db.prepare('SELECT COUNT(*) c FROM exercises').get()).c;
  if (count > 0) return;
  const ins = await db.prepare(`INSERT OR IGNORE INTO exercises
    (name, slug, primary_muscle, secondary_muscles, equipment, modalities, difficulty, instructions, common_errors, tips, image_key, is_premium)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const imageKeys = ['chest-press', 'chest-incline', 'cable-fly', 'pushup', 'machine', 'machine', 'cable-fly', 'bench'];
  await db.transaction(async () => {
    for (let i = 0; i < EXERCISES.length; i++) {
      const [name, primary, secondary, equipment, modalities, difficulty, instructions, errors, tips, premium] = EXERCISES[i];
      await ins.run(
        name, slugify(name), primary, JSON.stringify(secondary), equipment, JSON.stringify(modalities),
        difficulty, instructions, errors, tips,
        imageKeys[i % imageKeys.length], premium ? 1 : 0
      );
    }
  });
  console.log(`[seed] ${EXERCISES.length} exercícios inseridos`);
}

async function seedModalities() {
  const count = (await db.prepare('SELECT COUNT(*) c FROM modalities').get()).c;
  if (count > 0) return;
  const ins = await db.prepare('INSERT OR IGNORE INTO modalities (name, slug, description, icon) VALUES (?,?,?,?)');
  for (const [name, icon, desc] of MODALITIES) await ins.run(name, slugify(name), desc, icon);
}

async function seedContent() {
  const count = (await db.prepare('SELECT COUNT(*) c FROM content').get()).c;
  if (count > 0) return;
  const items = [
    ['Como montar seu aquecimento ideal', 'Aquecimento não é alongamento estático. Faça 5-10 minutos de movimento leve (bike, esteira, pular corda), seguido de séries de aproximação com a carga utilizada no primeiro exercício. Em dias mais frios, aumente o tempo de aquecimento.', 'artigo'],
    ['Sobrecarga progressiva: o motor da evolução', 'Sem aumentar estímulo, o corpo não se adapta. Aumente carga, repetições, séries ou qualidade de movimento de forma gradual — uma variável por vez, mantendo a técnica. Só aumente quando a série anterior foi feita com bom controle de execução.', 'artigo'],
    ['Sono e recuperação muscular', 'A musculação só gera resultado quando o corpo se recupera. Adultos devem buscar 7 a 9 horas de sono; treine cada grupo muscular com ao menos 48h de intervalo quando o volume for alto. Dor articular persistente é sinal para reduzir carga e avaliar.', 'artigo'],
    ['Aviso de segurança', 'O FitAI oferece orientações educativas e não substitui avaliação médica nem acompanhamento de profissional de educação física. Em caso de lesão, dor persistente, gestação ou doença crônica, consulte um profissional antes de iniciar.', 'aviso'],
  ];
  const ins = await db.prepare('INSERT INTO content (title, body, kind) VALUES (?,?,?)');
  for (const [t, b, k] of items) await ins.run(t, b, k);
}

async function seedUsers() {
  const count = (await db.prepare('SELECT COUNT(*) c FROM users').get()).c;
  if (count > 0) return;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fitai.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const hash = bcrypt.hashSync(adminPass, 10);
  const info = await db.prepare("INSERT INTO users (name, email, password_hash, role, plan) VALUES (?,?,?,?,?)")
    .run('Administrador', adminEmail, hash, 'admin', 'premium');

  // Conta demo com histórico completo
  const demoEmail = process.env.DEMO_EMAIL || 'demo@fitai.com';
  const demoHash = bcrypt.hashSync(process.env.DEMO_PASSWORD || 'Demo@123456', 10);
  const demo = await db.prepare("INSERT INTO users (name, email, password_hash, plan) VALUES (?,?,?,?)")
    .run('Lucas Andrade', demoEmail, demoHash, 'pro');
  await db.prepare(`INSERT INTO profiles (user_id, age, sex, height_cm, weight_kg, goal, level, days_per_week, minutes_per_session, location, equipment, focus_muscles, injuries)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    demo.lastInsertRowid, 28, 'M', 178, 82.4, 'hipertrofia', 'intermediario', 4, 60, 'academia',
    JSON.stringify(['Barra', 'Halteres', 'Cabo/Polia', 'Máquina', 'Banco']), JSON.stringify(['Peito', 'Costas']), ''
  );
  console.log(`[seed] admin: ${adminEmail} / ${adminPass}`);
  console.log(`[seed] demo:  ${demoEmail} / ${process.env.DEMO_PASSWORD || 'Demo@123456'}`);
  const workoutId = await seedDemoWorkout(demo.lastInsertRowid);
  await seedDemoHistory(demo.lastInsertRowid, workoutId);
}

/* Programa ativo de exemplo do usuário demo.
   Conteúdo fixo e revisado (não é gerado por IA nem sorteado) — serve para demonstrar o produto
   com dados coerentes. O seed inteiro é idempotente e só roda em banco vazio. */
async function seedDemoWorkout(uid) {
  const ex = (name, muscle, secondary, equipment, sets, reps, rest, why, how, progression) =>
    ({ name, muscle, secondary, equipment, sets, reps, rest_seconds: rest, why, how, progression });
  const plan = {
    split_name: 'ABCD',
    summary: 'Programa ABCD focado em hipertrofia, com quatro sessões semanais e 60 minutos por treino. A divisão separa empurrar e puxar em dias distintos para dar descanso adequado entre estímulos semelhantes, mantendo frequência de 2x por semana para os grandes grupos (peito/costas) através de estímulos indiretos, e prioriza peito e costas conforme seus grupos de interesse, sem negligenciar pernas e core.',
    weekly_schedule: [
      {
        day: 'A', day_label: 'Segunda', title: 'A — Peito, Tríceps e Ombros',
        focus: ['Peito', 'Tríceps', 'Ombros'], estimated_minutes: 60,
        warmup: '5-10 min de bike ou esteira em ritmo leve, rotação externa de ombro com elástico (2x15) e 2 séries de aproximação no supino com 50% da carga de trabalho.',
        exercises: [
          ex('Supino reto com barra', 'Peito', ['Tríceps', 'Ombros'], 'Barra', 4, '8', 90,
            'Exercício principal do dia: maior potencial de sobrecarga progressiva para o peitoral, com apoio estável e execução simples de monitorar.',
            'Deite com os pés firmes no chão, escápulas retraídas e barra na linha do peito. Desça com controle de 2 segundos e empurre sem destacar os quadris do banco.',
            'Quando conseguir 4x8 com técnica consistente e RPE ≤ 8, aumente 2,5 kg no total da barra.'),
          ex('Supino inclinado com halteres', 'Peito', ['Ombros', 'Tríceps'], 'Halteres', 3, '10', 75,
            'Complementa o supino reto com ênfase na porção superior do peitoral e permite ajustar a amplitude conforme o conforto do ombro.',
            'Banco entre 30° e 45°. Desça os halteres até a linha axilar mantendo punhos neutros e cotovelos a cerca de 45° do tronco.',
            'Aumente 1 kg por haltere quando fechar as 3 séries com 10 repetições limpas.'),
          ex('Tríceps na polia com corda', 'Tríceps', ['Antebraço'], 'Cabo/Polia', 3, '12', 60,
            'Isola o tríceps com tensão contínua e poupa a articulação do ombro ao final do treino de empurrar.',
            'Cotovelos colados ao tronco, abra a corda no final do movimento sem balançar os ombros.',
            'Aumente 2,5 kg na placa quando as 3 séries saírem com 12 repetições e boa pausa de contração.'),
          ex('Elevação lateral com halteres', 'Ombros', ['Trapézio'], 'Halteres', 3, '15', 45,
            'Fortalece a porção lateral do deltoide, que dá amplitude à linha do ombro e sustenta a estabilidade do supino.',
            'Leve inclinação do tronco, cotovelos levemente flexionados, suba até a linha dos ombros sem usar impulso.',
            'Progrida primeiro para 4 séries de 15 e só depois aumente 1 kg.'),
        ],
      },
      {
        day: 'B', day_label: 'Terça', title: 'B — Costas e Bíceps',
        focus: ['Costas', 'Bíceps', 'Antebraço'], estimated_minutes: 60,
        warmup: '5-10 min de remo ergômetro leve, ativação escapular na polia (2x12) e 2 séries de aproximação na puxada com carga moderada.',
        exercises: [
          ex('Puxada frontal na polia', 'Costas', ['Bíceps'], 'Cabo/Polia', 4, '10', 90,
            'Vertical de tração que trabalha a largura das costas e permite progressão controlada com carga fixa na polia.',
            'Pegada um pouco mais aberta que os ombros, puxe levando os cotovelos para baixo e para trás, sem jogar o tronco para trás para completar.',
            'Adicione 2,5 kg quando 4x10 estiver confortável mantendo as escápulas deprimidas no início do movimento.'),
          ex('Remada curvada com barra', 'Costas', ['Bíceps', 'Lombar'], 'Barra', 3, '8', 90,
            'Trabalho horizontal de tração para espessura das costas, complementando a puxada vertical.',
            'Tronco inclinado com coluna neutra, puxe a barra em direção ao abdomen mantendo os cotovelos próximos ao corpo.',
            'Aumente 2,5 kg quando conseguir 3x8 sem perder a neutralidade da coluna.'),
          ex('Rosca direta com barra', 'Bíceps', ['Antebraço'], 'Barra', 3, '10', 60,
            'Exercício básico de bíceps com carga facilmente progressível após o trabalho de tração.',
            'Cotovelos parados ao lado do corpo, suba sem balançar o tronco e desça até a extensão quase completa.',
            'Aumente 1 kg de cada lado quando as 3 séries saírem completas e com pausa no topo.'),
          ex('Face pull na polia', 'Ombros', ['Costas', 'Trapézio'], 'Cabo/Polia', 3, '15', 45,
            'Trabalha a cadeia posterior do ombro e rotadores externos, prevenindo desequilíbrios causados pelo volume de empurrar.',
            'Polia na altura do rosto, puxe a corda em direção à testa separando as mãos e mantendo os cotovelos altos.',
            'Progrida em repetições (15 → 18) antes de aumentar a carga.'),
        ],
      },
      {
        day: 'C', day_label: 'Quinta', title: 'C — Pernas e Glúteos',
        focus: ['Pernas', 'Glúteos', 'Panturrilha'], estimated_minutes: 60,
        warmup: '5-10 min de bike leve, agachamento com peso do corpo (2x15) e mobilidade de quadril e tornozelo (4 min).',
        exercises: [
          ex('Agachamento livre com barra', 'Pernas', ['Glúteos', 'Lombar'], 'Barra', 4, '8', 120,
            'Movimento principal de pernas: grande demanda muscular e base para o desenvolvimento de força e massa nos membros inferiores.',
            'Pés na largura dos ombros, joelhos acompanhando a ponta dos pés, desça até onde mantiver a coluna neutra e os calcanhares apoiados.',
            'Só aumente carga quando 4x8 sair com profundidade consistente e sem perda de alinhamento dos joelhos.'),
          ex('Leg press 45°', 'Pernas', ['Glúteos'], 'Máquina', 3, '12', 90,
            'Permite acumular volume de pernas com estabilidade e menor demanda de coordenação após o agachamento.',
            'Apoie completamente a lombar no banco, não trave os joelhos no topo e desça até cerca de 90° no quadril conforme o conforto.',
            'Aumente 5 kg enquanto mantiver 3x12 com amplitude completa.'),
          ex('Cadeira flexora', 'Pernas', ['Panturrilha'], 'Máquina', 3, '12', 60,
            'Equilibra o trabalho de quadríceps com os flexores do joelho, importante para saúde e desempenho do joelho.',
            'Quadril apoiado no banco, flexione até onde conseguir sem levantar o quadril e controle a volta.',
            'Aumente 2,5 kg após fechar 3x12 com pausa de 1 segundo no topo.'),
          ex('Panturrilha em pé na máquina', 'Panturrilha', ['Pernas'], 'Máquina', 4, '15', 45,
            'Frequência mais alta para panturrilha, que responde bem a volume com boa amplitude.',
            'Suba na ponta dos pés o máximo possível, pausa de 1 segundo e desça até alongar com controle.',
            'Aumente 5 kg ao completar 4x15 com amplitude total.'),
        ],
      },
      {
        day: 'D', day_label: 'Sexta', title: 'D — Ombros e Core',
        focus: ['Ombros', 'Core'], estimated_minutes: 55,
        warmup: '5 min de esteira leve, círculos de ombro e rotação externa com elástico (2x15) e 2 séries de aproximação no desenvolvimento.',
        exercises: [
          ex('Desenvolvimento com halteres sentado', 'Ombros', ['Tríceps', 'Trapézio'], 'Halteres', 4, '10', 90,
            'Exercício principal de empurrar acima da cabeça, com amplitude livre e boa ativação do deltoide anterior.',
            'Encosto do banco a 80-85°, suba os halteres sem arquear a lombar e desça até a linha das orelhas com controle.',
            'Aumente 1 kg por haltere quando 4x10 estiver estável e sem compensação lombar.'),
          ex('Elevação lateral com halteres', 'Ombros', ['Trapézio'], 'Halteres', 3, '15', 45,
            'Volume direcionado ao deltoide lateral, que responde melhor com mais repetições e execução estrita.',
            'Subida controlada até a linha dos ombros, punhos neutros, sem impulso de tronco.',
            'Progrida para 18 repetições mantendo a mesma carga antes de subir o peso.'),
          ex('Prancha isométrica', 'Core', ['Lombar', 'Glúteos'], 'Peso do corpo', 3, '45s', 45,
            'Estabilidade anterior do tronco com baixa demanda articular, útil para transferir força para os demais exercícios.',
            'Antebraços no chão na linha dos ombros, glúteos e abdômen contraídos, quadril alinhado — sem elevar ou afundar.',
            'Quando fizer 3x60s com alinhamento perfeito, passe para a variação com elevação de membros.'),
          ex('Abdominal na polia (crunch)', 'Core', ['Lombar'], 'Cabo/Polia', 3, '15', 45,
            'Trabalho dinâmico de flexão de tronco com carga progressiva, complementando a prancha isométrica.',
            'Ajoelhado, flexione o tronco levando os cotovelos em direção ao quadril sem puxar com os braços.',
            'Aumente 2,5 kg após completar 3x15 com movimento isolado no abdômen.'),
        ],
      },
    ],
    schedule_notes: 'Quatro dias com 48-72h de intervalo entre sessões que compartilham grupos musculares. Quarta, sábado e domingo ficam livres para recuperação ou atividade leve (caminhada, mobilidade).',
    progression_plan: 'Semanas 1-2: ajuste de cargas e consolidação da técnica com RPE 6-7. Semanas 3-4: aumente carga apenas quando as repetições-alvo saírem com boa execução (2,5 kg em exercícios grandes, 1 kg em isolados). Semana 5: reduza volume em ~30% (deload) para recuperar. Semana 6 em diante: reinicie o ciclo com cargas ligeiramente superiores.',
    recovery: 'Durma 7-9 horas por noite, mantenha hidratação ao longo do dia e faça 10 minutos de mobilidade de quadril e ombros nos dias sem treino. Alimentação equilibrada em proteínas e carboidratos ao longo do dia apoia a recuperação — o FitAI não prescreve dietas.',
    cardio_notes: 'Duas caminhadas de 20-30 min ou uma sessão leve de bike em intensidade confortável (conversa possível) nos dias sem musculação. Atividades aeróbicas moderadas ajudam na saúde cardiovascular sem prejudicar a recuperação.',
    safety_notes: [
      'Comece cada sessão pelo aquecimento indicado e não pule as séries de aproximação no primeiro exercício.',
      'Dor aguda, articular ou persistente é sinal para interromper o exercício e buscar avaliação profissional.',
      'Este programa é educativo e não substitui acompanhamento de profissional de educação física.',
    ],
    estimated_weekly_sessions: 4,
  };
  const info = await db.prepare(`INSERT INTO workouts (user_id, name, goal, level, modality, split, days_per_week, minutes, plan_json, provider, model, status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    uid, 'Hipertrofia · ABCD', 'hipertrofia', 'intermediario', 'musculacao', 'ABCD', 4, 60,
    JSON.stringify(plan), 'exemplo', 'programa de demonstração', 'active'
  );
  return info.lastInsertRowid;
}

async function seedDemoHistory(uid, workoutId = null) {
  const today = new Date();
  const dstr = (d) => d.toISOString().slice(0, 10);
  // pesos ao longo de 10 semanas (com pequena variação)
  const weights = [85.2, 84.8, 84.9, 84.1, 83.9, 83.6, 83.4, 83.0, 82.7, 82.4];
  const wIns = await db.prepare('INSERT OR IGNORE INTO weight_logs (user_id, date, weight_kg) VALUES (?,?,?)');
  for (let i = 0; i < weights.length; i++) {
    const d = new Date(today); d.setDate(d.getDate() - (9 - i) * 7);
    await wIns.run(uid, dstr(d), weights[i]);
  }
  // sessões concluídas nas últimas 6 semanas (4x/semana: A, B, C, D)
  const days = ['A — Peito, Tríceps e Ombros', 'B — Costas e Bíceps', 'C — Pernas e Glúteos', 'D — Ombros e Core'];
  const sIns = await db.prepare('INSERT INTO sessions (user_id, workout_id, day_key, name, performed_at, duration_min, effort) VALUES (?,?,?,?,?,?,?)');
  const slIns = await db.prepare('INSERT INTO set_logs (session_id, user_id, exercise_name, set_number, reps, weight_kg) VALUES (?,?,?,?,?,?)');
  const plan = {
    A: [['Supino reto com barra', 4, 8, 60], ['Supino inclinado com halteres', 3, 10, 24], ['Tríceps na polia com corda', 3, 12, 25], ['Elevação lateral com halteres', 3, 15, 10]],
    B: [['Puxada frontal na polia', 4, 10, 55], ['Remada curvada com barra', 3, 8, 50], ['Rosca direta com barra', 3, 10, 30], ['Face pull na polia', 3, 15, 20]],
    C: [['Agachamento livre com barra', 4, 8, 80], ['Leg press 45°', 3, 12, 140], ['Cadeira flexora', 3, 12, 45], ['Panturrilha em pé na máquina', 4, 15, 70]],
    D: [['Desenvolvimento com halteres sentado', 4, 10, 20], ['Elevação lateral com halteres', 3, 15, 10], ['Prancha isométrica', 3, 45, 0], ['Abdominal na polia (crunch)', 3, 15, 30]],
  };
  for (let wk = 5; wk >= 0; wk--) {
    for (let i = 0; i < 4; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (wk * 7 + (3 - i) * 2));
      if (d > today) continue;
      const key = ['A', 'B', 'C', 'D'][i];
      const progres = (5 - wk) * 0.025; // progressão gradual de carga
      const s = await sIns.run(uid, workoutId, key, days[i], dstr(d) + ' 19:00:00', 55 + ((i * 3 + wk) % 12), 6 + (i % 3));
      for (const [name, sets, reps, w0] of plan[key]) {
        for (let st = 1; st <= sets; st++) {
          const w = w0 ? Math.round(w0 * (1 + progres) * 2) / 2 : 0;
          await slIns.run(s.lastInsertRowid, uid, name, st, reps + ((st + wk) % 4 === 0 ? 1 : 0), w);
        }
      }
    }
  }
  await db.prepare("INSERT INTO goals (user_id, title, metric, target, current, unit, deadline) VALUES (?,?,?,?,?,?,?)")
    .run(uid, 'Supino reto — 100 kg', 'load', 100, 62, 'kg', dstr(new Date(today.getTime() + 90 * 864e5)));
  await db.prepare("INSERT INTO goals (user_id, title, metric, target, current, unit, deadline) VALUES (?,?,?,?,?,?,?)")
    .run(uid, 'Treinar 4x por semana', 'sessions_week', 4, 4, 'treinos', null);
  await db.prepare("INSERT INTO goals (user_id, title, metric, target, current, unit) VALUES (?,?,?,?,?,?)")
    .run(uid, 'Peso corporal — 78 kg', 'weight', 78, 82.4, 'kg');
}

async function runSeed() {
  await seedModalities();
  await seedExercises();
  await seedContent();
  await seedUsers();
  if (!(await getSetting('ai_provider')) && process.env.AI_PROVIDER) await setSetting('ai_provider', process.env.AI_PROVIDER);
}

module.exports = { runSeed, slugify };
