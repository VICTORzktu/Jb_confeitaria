/* ============================================================
   Teste do fluxo de IA ponta a ponta contra tests/mock-ai-server.js.
   Pré-requisitos:
     1) servidor FitAI rodando (npm start)
     2) mock de IA rodando (node tests/mock-ai-server.js)
   Execução: node tests/ai-flow.js
   ============================================================ */
const BASE='http://127.0.0.1:3000';
let pass=0,fail=0;
const ok=(n,c,x='')=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+' '+x)); };
async function call(m,u,b,ck){
  const r=await fetch(BASE+u,{method:m,headers:{...(b?{'content-type':'application/json'}:{}),...(ck?{cookie:ck}:{})},body:b?JSON.stringify(b):undefined});
  const t=await r.text(); let d=null; try{d=t?JSON.parse(t):null}catch{d={raw:t}}
  return {s:r.status,d,h:r.headers};
}
(async()=>{
  console.log('\n=== Fluxo de IA (mock) ===\n');
  const adm=await call('POST','/api/auth/login',{email:'admin@fitai.com',password:'Admin@123456'});
  const ac=(adm.h.get('set-cookie')||'').split(';')[0];
  const saved=await call('PUT','/api/admin/ai',{provider:'custom',model:'mock-1',base_url:'http://127.0.0.1:4999/v1',api_key:'sk-mock-1234567890'},ac);
  ok('admin configura provedor custom',saved.s===200);
  const tst=await call('POST','/api/admin/ai/test',{},ac);
  ok('teste de conexão passa',tst.s===200 && tst.d.ok===true, `(${tst.s})`);
  const cfg=await call('GET','/api/admin/ai',null,ac);
  ok('chave mascarada no GET', !cfg.d.config.api_key_masked.includes('sk-mock'));

  const demo=await call('POST','/api/auth/login',{email:'demo@fitai.com',password:'Demo@123456'});
  const dc=(demo.h.get('set-cookie')||'').split(';')[0];

  const gen=await call('POST','/api/workouts/generate',{modality:'musculacao',notes:'Quero priorizar peito e costas.'},dc);
  ok('geração retorna 201',gen.s===201,`(${gen.s} ${JSON.stringify(gen.d).slice(0,120)})`);
  ok('programa tem 4 dias',gen.d.workout?.plan_json?.weekly_schedule?.length===4);
  ok('divisão Upper/Lower',/upper|lower/i.test(gen.d.workout?.split||''));
  ok('cada exercício tem why/how',gen.d.workout.plan_json.weekly_schedule.every(d=>d.exercises.every(e=>e.why&&e.how)));
  ok('aquecimento por dia',gen.d.workout.plan_json.weekly_schedule.every(d=>!!d.warmup));
  const wid=gen.d.workout.id;

  const det=await call('GET','/api/workouts/'+wid,null,dc);
  ok('detalhe do treino com slots',det.s===200 && Array.isArray(det.d.workout.slots) && det.d.workout.slots.length===4);

  const sub=await call('POST',`/api/workouts/${wid}/substitute`,{day_index:0,ex_index:0,reason:'desconforto no ombro'},dc);
  ok('substituição de exercício',sub.s===200,`(${sub.s})`);
  const nomeNovo=sub.d?.exercise?.name||'';
  ok('substituição devolve nome novo',!!nomeNovo,`→ ${nomeNovo}`);
  const det2=await call('GET','/api/workouts/'+wid,null,dc);
  const nomes=det2.d.workout.plan_json.weekly_schedule[0].exercises.map(e=>e.name);
  ok('plano persistiu a substituição',nomes.includes(nomeNovo), `[${nomes.join(' | ')}]`);

  const prog=await call('POST','/api/workouts/'+wid+'/progress',{},dc);
  ok('progressão inteligente',prog.s===200,`(${prog.s} ${JSON.stringify(prog.d).slice(0,150)})`);
  const ls=(prog.d.analysis?.load_suggestions||[]);
  ok('sugestões consideram execução',ls.length>0&&ls.every(s=>s.reason&&s.current&&s.suggestion));

  const chat=await call('POST','/api/chat',{message:'Como melhoro meu supino?'},dc);
  ok('chat responde',chat.s===200 && (chat.d.reply||'').length>50,`(${chat.s})`);

  const hist=await call('GET','/api/chat/history',null,dc);
  ok('histórico do chat salvo',(hist.d.messages||[]).length>=2);

  const dash=await call('GET','/api/dashboard',null,dc);
  ok('dashboard com treino do dia/próximo',!!dash.d.next || !!dash.d.today);
  ok('semana reflete o novo programa',(dash.d.weekly||[]).filter(d=>d.planned).length===4);

  console.log(`\n${pass} passaram · ${fail} falharam\n`);
  process.exit(fail?1:0);
})().catch(e=>{console.error('ERRO:',e);process.exit(1)});
