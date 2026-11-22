/* ============================================================
   Mock de provedor de IA compatível com OpenAI — USO EXCLUSIVO EM TESTES.
   Permite validar o pipeline real (prompt -> HTTP -> parse -> guardrails)
   sem consumir créditos de um provedor pago.

   Uso:
     node tests/mock-ai-server.js            # sobe em http://127.0.0.1:4999
     # no Painel Admin > Integração com IA:
     #   Provedor: custom | Modelo: mock-1
     #   URL base: http://127.0.0.1:4999/v1 | Chave: qualquer texto

   Depois: node tests/ai-flow.js
   ============================================================ */
const http = require('http');
const PLAN = {
  split_name: 'Upper/Lower',
  summary: 'Programa Upper/Lower em 4 dias, equilibrando padrões de empurrar e puxar com volume moderado e progressão gradual.',
  weekly_schedule: [
    { day: 'A', day_label: 'Segunda', title: 'A — Upper (Empurrar)', focus: ['Peito','Ombros','Tríceps'], estimated_minutes: 60,
      warmup: '5 min bike leve + rotação externa de ombro 2x15 + 2 séries de aproximação no supino.',
      exercises: [
        { name: 'Supino reto com barra', muscle: 'Peito', secondary: ['Tríceps'], equipment: 'Barra', sets: 4, reps: '8-10', rest_seconds: 90, why: 'Exercício principal de empurrar.', how: 'Escápulas retraídas, barra na linha do peito.', progression: '+2,5 kg ao completar as séries.' },
        { name: 'Desenvolvimento com halteres sentado', muscle: 'Ombros', secondary: ['Tríceps'], equipment: 'Halteres', sets: 3, reps: '10', rest_seconds: 75, why: 'Fortalece o ombro.', how: 'Sem arquear a lombar.', progression: '+1 kg por haltere.' },
        { name: 'Tríceps na polia com corda', muscle: 'Tríceps', secondary: [], equipment: 'Cabo/Polia', sets: 3, reps: '12', rest_seconds: 60, why: 'Isola o tríceps.', how: 'Cotovelos junto ao tronco.', progression: '+2,5 kg na placa.' },
      ] },
    { day: 'B', day_label: 'Terça', title: 'B — Lower (Pernas)', focus: ['Pernas','Glúteos'], estimated_minutes: 60,
      warmup: '5 min bike + agachamento com peso do corpo 2x15.',
      exercises: [
        { name: 'Agachamento livre com barra', muscle: 'Pernas', secondary: ['Glúteos'], equipment: 'Barra', sets: 4, reps: '8', rest_seconds: 120, why: 'Base de força para membros inferiores.', how: 'Joelhos acompanhando a ponta dos pés.', progression: '+2,5 kg mantendo a profundidade.' },
        { name: 'Leg press 45°', muscle: 'Pernas', secondary: ['Glúteos'], equipment: 'Máquina', sets: 3, reps: '12', rest_seconds: 90, why: 'Volume com estabilidade.', how: 'Lombar apoiada, sem travar joelhos.', progression: '+5 kg a cada 3x12.' },
        { name: 'Panturrilha em pé na máquina', muscle: 'Panturrilha', secondary: [], equipment: 'Máquina', sets: 4, reps: '15', rest_seconds: 45, why: 'Amplitude total.', how: 'Pausa de 1s no topo.', progression: '+5 kg com amplitude.' },
      ] },
    { day: 'C', day_label: 'Quinta', title: 'C — Upper (Puxar)', focus: ['Costas','Bíceps'], estimated_minutes: 60,
      warmup: '5 min remo + ativação escapular 2x12.',
      exercises: [
        { name: 'Puxada frontal na polia', muscle: 'Costas', secondary: ['Bíceps'], equipment: 'Cabo/Polia', sets: 4, reps: '10', rest_seconds: 90, why: 'Trabalha a largura das costas.', how: 'Cotovelos para baixo e para trás.', progression: '+2,5 kg ao fechar 4x10.' },
        { name: 'Remada curvada com barra', muscle: 'Costas', secondary: ['Bíceps'], equipment: 'Barra', sets: 3, reps: '8', rest_seconds: 90, why: 'Espessura das costas.', how: 'Coluna neutra durante todo o movimento.', progression: '+2,5 kg sem perder a coluna neutra.' },
        { name: 'Rosca direta com barra', muscle: 'Bíceps', secondary: [], equipment: 'Barra', sets: 3, reps: '10', rest_seconds: 60, why: 'Exercício básico de bíceps.', how: 'Sem balançar o tronco.', progression: '+1 kg de cada lado.' },
      ] },
    { day: 'D', day_label: 'Sexta', title: 'D — Lower (Posterior e Core)', focus: ['Pernas','Core'], estimated_minutes: 55,
      warmup: '5 min esteira + mobilidade de quadril 4 min.',
      exercises: [
        { name: 'Levantamento terra com barra', muscle: 'Costas', secondary: ['Pernas','Lombar'], equipment: 'Barra', sets: 3, reps: '6', rest_seconds: 150, why: 'Padrão de dobradiça de quadril.', how: 'Barra próxima à canela, coluna neutra.', progression: '+5 kg mantendo a técnica.' },
        { name: 'Cadeira flexora', muscle: 'Pernas', secondary: [], equipment: 'Máquina', sets: 3, reps: '12', rest_seconds: 60, why: 'Flexores do joelho.', how: 'Quadril apoiado.', progression: '+2,5 kg a cada 3x12.' },
        { name: 'Prancha isométrica', muscle: 'Core', secondary: [], equipment: 'Peso do corpo', sets: 3, reps: '45s', rest_seconds: 45, why: 'Estabilidade anterior.', how: 'Quadril alinhado.', progression: '45s para 60s.' },
      ] },
  ],
  schedule_notes: 'Upper/Lower alternado com 48h entre estímulos iguais.',
  progression_plan: 'Semanas 1-2 ajuste; 3-4 sobrecarga; 5 deload; 6 reinício.',
  recovery: '7-9h de sono, hidratação e mobilidade nos dias off.',
  cardio_notes: 'Duas caminhadas leves de 25 min.',
  safety_notes: ['Aqueça antes de cada sessão.'],
  estimated_weekly_sessions: 4,
};
const SUB = { name: 'Supino com halteres no banco reto', muscle: 'Peito', secondary: ['Tríceps'], equipment: 'Halteres', sets: 4, reps: '10', rest_seconds: 90, why: 'Alternativa com amplitude mais confortável para o ombro.', how: 'Desça os halteres até a linha do peito.', progression: '+1 kg por haltere.', explanation: 'O supino com halteres permite ajustar a amplitude e reduz a tensão no ombro.' };
const PROG = { headline: 'Prontidão boa: evolução consistente', readiness: 'pronto', load_suggestions: [{ exercise: 'Supino reto com barra', current: '60 kg', suggestion: '62,5 kg', reason: 'Todas as séries concluídas com técnica estável nas últimas 3 sessões.' },{ exercise: 'Agachamento livre com barra', current: '80 kg', suggestion: '82,5 kg', reason: 'Séries concluídas com RPE 7 — margem segura.' }], volume_adjustments: 'Mantenha o volume atual por 2 semanas antes de adicionar séries.', split_advice: 'A divisão Upper/Lower continua adequada para 4 dias por semana.', deload: 'Deload sugerido apenas na semana 6 se a fadiga acumular.', next_steps: ['Mantenha 48h entre estímulos iguais.', 'Registre o RPE em todas as séries.', 'Reavalie a progressão em 4 semanas.'], cautions: ['Dor articular persistente pede redução de carga e avaliação profissional.'] };
const CHAT = 'Para o seu objetivo de hipertrofia, mantenha 2 a 3 séries de aproximação antes do primeiro exercício do dia e aumente a carga apenas quando as repetições-alvo saírem com técnica estável e RPE próximo de 8.\n\nNo supino, a dica que mais destrava carga é manter as escápulas retraídas e os pés firmes no chão — a base de sustentação vem do corpo todo, não só dos braços. Se o seu ombro incomodar em algum trecho, troque o supino reto com barra por supino com halteres no banco reto, que permite ajustar a amplitude com mais conforto.\n\nLembre-se: não substituo a avaliação de um profissional de educação física nem médico.';

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    let out;
    const b = (body || '').toLowerCase();
    // as aspas chegam escapadas no corpo JSON (\"), então procuramos só as chaves
    if (b.includes('explanation')) out = SUB;              // schema de substituição
    else if (b.includes('readiness')) out = PROG;          // schema de progressão
    else if (b.includes('split_name') || b.includes('weekly_schedule')) out = PLAN;
    else out = CHAT;                                       // chat: texto puro
    res.end(JSON.stringify({ choices: [{ message: { content: typeof out === 'string' ? out : JSON.stringify(out) } }] }));
  });
});
server.listen(4999, '127.0.0.1');
