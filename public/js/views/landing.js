/* ============================================================
   Landing page — FitAI
   ============================================================ */
const LANDING_FEATURES = [
  { icon: 'sparkles', title: 'Treino gerado por IA de verdade', text: 'Integração real com modelos de linguagem de ponta. O programa é montado a partir do seu corpo, rotina, equipamentos e limitações — não é um template genérico.' },
  { icon: 'shield', title: 'Segurança como regra', text: 'Exercícios incompatíveis com suas lesões são removidos automaticamente. Avisos de faixa etária, restrições e responsabilidade acompanham cada plano.' },
  { icon: 'trending', title: 'Progressão inteligente', text: 'A IA analisa suas cargas, esforço percebido e consistência para sugerir aumentos seguros — nunca saltos arriscados.' },
  { icon: 'chat', title: 'Personal IA 24h', text: 'Tire dúvidas com um treinador que conhece seu histórico, seu programa ativo e sua evolução de cargas.' },
  { icon: 'library', title: 'Biblioteca de exercícios', text: 'Execução correta, erros comuns, músculos trabalhados e filtros por equipamento, modalidade e dificuldade.' },
  { icon: 'chart', title: 'Métricas que importam', text: 'Frequência, volume, cargas, peso corporal e adesão ao plano em gráficos claros — sem planilhas.' },
];

const TESTIMONIALS = [
  { name: 'Marina Costa', role: 'Corrida de rua · Recife', text: 'Em 3 meses consegui organizar meus treinos de força em volta da corrida. A IA ajustou os dias e meu joelho parou de reclamar.' },
  { name: 'João Pedro Lima', role: 'Hipertrofia · São Paulo', text: 'O que mais me surpreendeu foi a progressão: ela não deixa eu pular etapas. Supino saiu de 60 para 82 kg com técnica.' },
  { name: 'Camila Reis', role: 'Treino em casa · Serra Talhada', text: 'Sem academia, com dois halteres e uma barra. O plano foi montado exatamente com o que eu tenho em casa.' },
];

const FAQS = [
  ['O FitAI substitui um personal trainer?', 'Não. O FitAI é uma ferramenta educativa de apoio. Ele ajuda a estruturar e acompanhar treinos, mas não substitui a avaliação de um profissional de educação física nem o acompanhamento médico.'],
  ['Como a IA cria meu treino?', 'Você informa idade, altura, peso, objetivo, nível, disponibilidade, local, equipamentos e limitações. Essas informações são enviadas a um modelo de linguagem de ponta através do nosso backend, que monta a divisão semanal, exercícios, séries, descanso, aquecimento e progressão.'],
  ['Posso treinar em casa sem equipamentos?', 'Sim. Basta selecionar "em casa" e os equipamentos que você tem (ou nenhum). A IA monta planos com peso do corpo, elásticos, mochilas e móveis estáveis.'],
  ['E se eu tiver uma lesão?', 'Ao informar suas limitações, o plano passa por um filtro de segurança que remove exercícios contraindicados e adiciona recomendações específicas. Mesmo assim, consulte um profissional antes de iniciar.'],
  ['Meus dados estão protegidos?', 'Sim. Senhas são armazenadas com hash bcrypt, a autenticação usa cookie httpOnly, e cada conta só acessa os próprios dados. Você pode excluir sua conta e seus dados a qualquer momento.'],
  ['Posso cancelar quando quiser?', 'Sim. Os planos pagos são mensais, sem fidelidade. Você continua com acesso até o fim do período pago e pode voltar ao plano gratuito.'],
];

const PLANS_LANDING = [
  { id: 'free', name: 'Gratuito', price: 0, desc: 'Para começar com o pé direito e sentir a diferença de um treino bem estruturado.', features: ['3 treinos gerados por mês', 'Biblioteca básica de exercícios', 'Dashboard essencial', 'Registro de treinos e cargas'] },
  { id: 'pro', name: 'Pro', price: 2990, featured: true, desc: 'Para quem treina sério e quer acompanhamento inteligente de verdade.', features: ['30 treinos gerados por mês', 'Personalização avançada', 'Chat com Personal IA', 'Progressão inteligente de cargas', 'Relatórios de evolução', 'Biblioteca completa'] },
  { id: 'premium', name: 'Premium', price: 5990, desc: 'Acompanhamento completo, ajustes contínuos e biblioteca total.', features: ['Até 200 treinos por mês', 'Ajustes inteligentes de treino', 'Relatórios detalhados', 'Personalização completa', 'Biblioteca completa + vídeos', 'Suporte prioritário'] },
];

function landingShell(content) {
  return `
  <header class="site-header" id="site-header">
    <div class="container">
      <a href="/" data-link class="logo"><span class="logo-mark">${icon('logo')}</span>Fit<em>AI</em></a>
      <nav class="site-nav">
        <a href="#recursos">Recursos</a>
        <a href="#como-funciona">Como funciona</a>
        <a href="#modalidades">Modalidades</a>
        <a href="#planos">Planos</a>
        <a href="#faq">Dúvidas</a>
      </nav>
      <div class="site-actions">
        <a href="/entrar" class="btn btn-ghost btn-sm" data-link id="login-btn">Entrar</a>
        <a href="/criar-conta" class="btn btn-primary btn-sm" data-link id="signup-btn">Começar grátis ${icon('arrowRight')}</a>
        <button class="btn-icon burger" id="burger" aria-label="Menu">${icon('menu')}</button>
      </div>
    </div>
  </header>
  <div class="mobile-menu" id="mobile-menu">
    <a href="#recursos">Recursos</a>
    <a href="#como-funciona">Como funciona</a>
    <a href="#modalidades">Modalidades</a>
    <a href="#planos">Planos</a>
    <a href="#faq">Dúvidas</a>
    <a href="/entrar" data-link>Entrar</a>
    <a href="/criar-conta" class="btn btn-primary" data-link>Criar conta grátis</a>
  </div>
  ${content}
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="/" data-link class="logo"><span class="logo-mark">${icon('logo')}</span>Fit<em>AI</em></a>
          <p>Seu treino, sua evolução, sua inteligência. Programas de treino personalizados por inteligência artificial, com responsabilidade.</p>
        </div>
        <div><h5>Produto</h5><ul>
          <li><a href="#recursos">Recursos</a></li><li><a href="#planos">Planos</a></li>
          <li><a href="#modalidades">Modalidades</a></li><li><a href="/criar-conta" data-link>Criar conta</a></li>
        </ul></div>
        <div><h5>Institucional</h5><ul>
          <li><a href="#como-funciona">Como funciona</a></li><li><a href="#faq">Perguntas frequentes</a></li>
          <li><a href="/entrar" data-link>Entrar</a></li><li><a href="#seguranca">Segurança e responsabilidade</a></li>
        </ul></div>
        <div><h5>Legal</h5><ul>
          <li><a href="/privacidade" data-link>Política de privacidade</a></li><li><a href="/termos" data-link>Termos de uso</a></li>
          <li><a href="/privacidade#lgpd" data-link>LGPD</a></li>
        </ul></div>
      </div>
      <div class="disclaimer">
        <strong>Aviso importante:</strong> o FitAI é uma plataforma de apoio ao treinamento. O conteúdo gerado por inteligência artificial é educativo e <strong>não substitui</strong> a avaliação de médicos, fisioterapeutas ou profissionais de educação física. Não garantimos resultados físicos. Interrompa qualquer atividade em caso de dor, tontura ou desconforto e procure orientação profissional.
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} FitAI. Todos os direitos reservados.</span>
        <div class="legal"><a href="/privacidade" data-link>Privacidade</a><a href="/termos" data-link>Termos</a><span style="display:inline-flex;align-items:center;gap:6px"><span class="dot"></span>Todos os sistemas operacionais</span></div>
      </div>
    </div>
  </footer>`;
}

function bindLanding() {
  const header = document.getElementById('site-header');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobile-menu');
  if (burger && menu) {
    burger.onclick = () => {
      menu.classList.toggle('open');
      burger.innerHTML = icon(menu.classList.contains('open') ? 'x' : 'menu');
    };
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      menu.classList.remove('open'); burger.innerHTML = icon('menu');
    }));
  }
  document.querySelectorAll('.faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((o) => { o.classList.remove('open'); o.querySelector('.faq-a').style.maxHeight = '0'; });
      if (!open) { item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  });
  window.lazyReveals();
  // se já está logado, ajusta CTAs
  if (App.user) {
    const lb = document.getElementById('login-btn');
    const sb = document.getElementById('signup-btn');
    if (lb) { lb.textContent = 'Meu painel'; lb.href = '/app'; }
    if (sb) { sb.innerHTML = 'Ir para o app ' + icon('arrowRight'); sb.href = '/app'; }
  }
}

function renderLanding(root) {
  loadSession().then(() => {
    root.innerHTML = landingShell(`
    <section class="hero">
      <div class="hero-bg"></div><div class="hero-img"></div>
      <div class="container">
        <div class="hero-content">
          <div class="hero-badge"><span class="pill">IA REAL</span> Treinos personalizados gerados por inteligência artificial</div>
          <h1>Seu treino, sua evolução, sua <span class="accent">inteligência</span>.</h1>
          <p class="lead">O FitAI analisa seu corpo, sua rotina e suas limitações para montar um treino que faz sentido para você — com divisão semanal, séries, descanso, aquecimento e progressão. Não é template. É IA de verdade.</p>
          <div class="hero-cta">
            <a href="/criar-conta" class="btn btn-primary btn-lg" data-link>Gerar meu treino grátis ${icon('arrowRight')}</a>
            <a href="#como-funciona" class="btn btn-ghost btn-lg">Ver como funciona</a>
          </div>
          <div class="hero-trust">
            <span class="item">${icon('checkCircle')} Sem cartão de crédito</span>
            <span class="item">${icon('shield')} Dados protegidos (LGPD)</span>
            <span class="item">${icon('sparkles')} Biblioteca com ${(window.__site?.stats?.exercises || 65)}+ exercícios</span>
          </div>
        </div>
        <div class="hero-metrics">
          <div class="metric-float"><div class="label">Volume semanal</div><div class="value">12,4 t</div><div class="delta">${icon('trending')} +18% em 4 semanas</div></div>
          <div class="metric-float"><div class="label">Supino reto</div><div class="value">82,5 kg</div><div class="delta">${icon('trending')} recorde pessoal</div></div>
          <div class="metric-float"><div class="label">Adesão ao plano</div><div class="value">94%</div><div class="delta">${icon('checkCircle')} 15 de 16 treinos</div></div>
        </div>
      </div>
      <div class="hero-scroll">Role para descobrir</div>
    </section>

    <div class="strip"><div class="strip-track" id="strip-track">
      ${['Hipertrofia', 'Emagrecimento', 'Força', 'Resistência', 'Condicionamento', 'Definição', 'Desempenho esportivo', 'Funcional', 'Calistenia', 'HIIT']
        .map((t) => `<span>${icon('zap')}${t}</span>`).join('')}
      ${['Hipertrofia', 'Emagrecimento', 'Força', 'Resistência', 'Condicionamento', 'Definição', 'Desempenho esportivo', 'Funcional', 'Calistenia', 'HIIT']
        .map((t) => `<span>${icon('zap')}${t}</span>`).join('')}
    </div></div>

    <section class="section" id="recursos">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">Plataforma completa</span>
          <h2>Tudo o que um treino personalizado precisa ter</h2>
          <p>Do primeiro formulário ao acompanhamento de cargas, o FitAI cobre o ciclo inteiro — com responsabilidade em cada etapa.</p>
        </div>
        <div class="feature-grid">
          ${LANDING_FEATURES.map((f, i) => `
            <div class="feature reveal ${i === 0 ? 'wide' : ''}" style="transition-delay:${(i % 3) * 70}ms">
              <div class="feature-icon">${icon(f.icon)}</div>
              <h3>${f.title}</h3><p>${f.text}</p>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section section-line" id="como-funciona">
      <div class="container">
        <div class="section-head center reveal">
          <span class="eyebrow">Como funciona</span>
          <h2>Três passos até o seu primeiro treino</h2>
          <p>Em menos de três minutos você sai do zero para um programa completo, com explicação de cada escolha.</p>
        </div>
        <div class="steps">
          <div class="step reveal"><div class="step-num">01</div><h3>Conte seu perfil</h3><p>Idade, altura, peso, objetivo, nível, dias disponíveis, local, equipamentos e limitações. Quanto mais preciso, melhor o plano.</p></div>
          <div class="step reveal" style="transition-delay:100ms"><div class="step-num">02</div><h3>A IA monta tudo</h3><p>Divisão semanal, exercícios com séries e descanso, aquecimento, explicação da escolha de cada exercício e plano de progressão.</p></div>
          <div class="step reveal" style="transition-delay:200ms"><div class="step-num">03</div><h3>Treine e evolua</h3><p>Registre cargas, acompanhe estatísticas e receba ajustes inteligentes. O plano evolui junto com você.</p></div>
        </div>

        <div class="showcase reveal mt4">
          <div class="showcase-bar"><i></i><i></i><i></i><span>fitai.app/app</span></div>
          <div class="showcase-body">
            <aside class="showcase-side">
              <div class="item active">${icon('grid')} Visão geral</div>
              <div class="item">${icon('dumbbell')} Meu treino</div>
              <div class="item">${icon('chat')} Personal IA</div>
              <div class="item">${icon('library')} Exercícios</div>
              <div class="item">${icon('chart')} Progresso</div>
            </aside>
            <div class="showcase-main">
              <div class="showcase-row">
                ${[['Treinos concluídos', '24'], ['Volume total', '38,2 t'], ['Adesão ao plano', '92%']].map(([k, v]) => `
                  <div class="showcase-card"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}
              </div>
              <div class="showcase-card" style="padding:16px">
                <div class="row-between mb2"><span class="fs13 muted">Treino de hoje</span><span class="badge badge-lime badge-sm">${icon('zap')} Push</span></div>
                <div style="display:flex;flex-direction:column;gap:8px">
                  ${[['Supino reto com barra', '4 × 8–10'], ['Supino inclinado com halteres', '3 × 10'], ['Desenvolvimento sentado', '3 × 10'], ['Elevação lateral', '3 × 15']].map(([n, s], i) => `
                    <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:#a8b3ad">
                      <span style="width:20px;height:20px;border-radius:6px;background:#1b231f;display:grid;place-items:center;font-size:10px">${i + 1}</span>
                      <span style="flex:1">${n}</span><span style="color:#6f7b75">${s}</span>
                    </div>`).join('')}
                </div>
              </div>
              <div class="showcase-chart">${Charts.line({
                points: [82, 84, 83.4, 85, 84.2, 86, 85.6, 87, 86.4, 88, 87.2, 88.5].map((v, i) => ({ y: v, xLabel: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12'][i] })),
                width: 620, height: 170, yFmt: (v) => fmt.num(v, 0) + ' kg',
              })}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="modalidades">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">Para todo objetivo</span>
          <h2>Nove modalidades, um só plano inteligente</h2>
          <p>Musculação, treino em casa, calistenia, cross training, funcional, HIIT, cardio, pesos livres e máquinas.</p>
        </div>
        <div class="grid g3" id="modalities-grid">
          ${(window.__site?.modalities || []).map((m) => `
            <div class="card card-hover reveal" style="display:flex;gap:14px;align-items:flex-start">
              <div class="feature-icon" style="margin:0;flex:none">${icon(m.icon)}</div>
              <div><h4 style="font-family:var(--font-display);font-size:15px;margin:0 0 4px">${esc(m.name)}</h4>
              <p class="fs13 muted" style="margin:0">${esc(m.description)}</p></div>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section section-line">
      <div class="container">
        <div class="section-head center reveal"><span class="eyebrow">Prova social</span><h2>Quem treina com o FitAI evolui</h2></div>
        <div class="quotes">
          ${TESTIMONIALS.map((t, i) => `
            <div class="quote reveal" style="transition-delay:${i * 80}ms">
              <div class="stars">${icon('star').repeat(5)}</div>
              <p>“${t.text}”</p>
              <div class="who"><div class="avatar">${initials(t.name)}</div><div><strong>${t.name}</strong><span>${t.role}</span></div></div>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" id="planos">
      <div class="container">
        <div class="section-head center reveal">
          <span class="eyebrow">Planos</span>
          <h2>Comece grátis. Evolua quando quiser.</h2>
          <p>Sem fidelidade. Pagamento via Pix ou cartão. Cancele quando precisar.</p>
        </div>
        <div class="plans">
          ${PLANS_LANDING.map((p, i) => `
            <div class="plan reveal ${p.featured ? 'featured' : ''}" style="transition-delay:${i * 80}ms">
              <div class="plan-name">${p.name}${p.featured ? '<span class="badge badge-lime">Mais popular</span>' : ''}</div>
              <div class="plan-price">
                <span class="currency">R$</span>
                <span class="amount">${p.price === 0 ? '0' : fmt.num(p.price / 100, p.price % 100 === 0 ? 0 : 2)}</span>
                <span class="per">/mês</span>
              </div>
              <p class="plan-desc">${p.desc}</p>
              <ul class="plan-list">${p.features.map((f) => `<li>${icon('check')}${f}</li>`).join('')}</ul>
              <a href="/criar-conta?plan=${p.id}" data-link class="btn ${p.featured ? 'btn-primary' : 'btn-ghost'}">${p.price === 0 ? 'Começar grátis' : 'Assinar ' + p.name}</a>
            </div>`).join('')}
        </div>
        <p class="center fs12 dim mt3">Pagamentos processados com Pix (BR Code) e cartão de crédito. Os planos pagos são renovados mensalmente e podem ser cancelados a qualquer momento.</p>
      </div>
    </section>

    <section class="section section-line" id="faq">
      <div class="container">
        <div class="section-head center reveal"><span class="eyebrow">Dúvidas frequentes</span><h2>Vamos esclarecer</h2></div>
        <div class="faq">
          ${FAQS.map(([q, a], i) => `
            <div class="faq-item reveal" style="transition-delay:${i * 50}ms">
              <button class="faq-q">${q} ${icon('plus')}</button>
              <div class="faq-a"><div>${a}</div></div>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" id="seguranca">
      <div class="container">
        <div class="grid g2 reveal">
          <div class="card" style="padding:32px">
            <div class="feature-icon">${icon('shield')}</div>
            <h3 style="font-size:22px">Segurança e responsabilidade</h3>
            <p class="muted fs14">O FitAI não incentiva treinos extremos nem cargas perigosas. Nossos planos passam por um filtro de contraindicações que considera suas lesões e limitações. Para menores de idade, oferecemos orientações específicas para a faixa etária e recomendamos acompanhamento profissional.</p>
            <ul class="plan-list mt2">
              <li>${icon('check')} Filtro automático de exercícios contraindicados</li>
              <li>${icon('check')} Avisos de segurança em todo plano gerado</li>
              <li>${icon('check')} Progressão de carga conservadora por padrão</li>
              <li>${icon('check')} Orientação profissional sempre recomendada</li>
            </ul>
          </div>
          <div class="card" style="padding:32px">
            <div class="feature-icon">${icon('lock')}</div>
            <h3 style="font-size:22px">Seus dados, suas regras</h3>
            <p class="muted fs14">Cada conta acessa somente os próprios dados. As senhas são protegidas com hash e a sessão usa cookie httpOnly. As chaves de IA ficam exclusivamente no servidor — nunca no navegador.</p>
            <ul class="plan-list mt2">
              <li>${icon('check')} Senhas com hash bcrypt</li>
              <li>${icon('check')} Autenticação com JWT em cookie httpOnly</li>
              <li>${icon('check')} Isolamento total de dados por conta</li>
              <li>${icon('check')} Direito de exclusão de conta e dados (LGPD)</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="cta-final reveal">
          <span class="eyebrow" style="justify-content:center">Comece hoje</span>
          <h2 style="margin-top:14px">Seu próximo treino está a três minutos de distância</h2>
          <p>Crie sua conta gratuita, responda o formulário inteligente e receba um programa feito para o seu corpo e a sua rotina.</p>
          <a href="/criar-conta" class="btn btn-primary btn-lg" data-link>Gerar meu treino com IA ${icon('sparkles')}</a>
        </div>
      </div>
    </section>`);
    bindLanding();
  });
}

/* ----------------------------- Legal pages ----------------------------- */
function legalShell(title, body) {
  return `
  <div class="container" style="max-width:820px;padding:120px 0 80px">
    <a href="/" class="logo mb3" data-link style="display:inline-flex"><span class="logo-mark">${icon('logo')}</span>Fit<em>AI</em></a>
    <h1 style="font-size:clamp(1.9rem,4vw,2.6rem)">${title}</h1>
    <div class="muted" style="font-size:14.5px;line-height:1.75">
      <p class="fs12 dim">Última atualização: ${new Date().toLocaleDateString('pt-BR')}</p>
      ${body}
    </div>
  </div>`;
}

route('/privacidade', (root) => {
  root.innerHTML = legalShell('Política de Privacidade', `
    <h3>1. Dados que coletamos</h3>
    <p>Coletamos nome, e-mail e senha (armazenada apenas como hash) para autenticação; dados de perfil como idade, sexo, altura, peso, objetivo, nível, disponibilidade, local de treino, equipamentos, grupos musculares de interesse e limitações físicas declaradas; registros de treinamento, cargas, sessões, metas e mensagens no chat com o Personal IA. Esses dados são usados exclusivamente para personalizar sua experiência.</p>
    <h3>2. Uso dos dados</h3>
    <p>Usamos seus dados para gerar planos de treino, acompanhar sua evolução, responder no chat e operar a plataforma. Não vendemos dados pessoais. Para gerar treinos e respostas do chat, as informações do seu perfil são enviadas, de forma estritamente necessária, ao provedor de inteligência artificial configurado pela plataforma.</p>
    <h3 id="lgpd">3. Seus direitos (LGPD)</h3>
    <p>Nos termos da Lei 13.709/2018, você pode acessar, corrigir, exportar e excluir seus dados. A exclusão da conta remove permanentemente perfis, treinos, histórico, mensagens e registros associados.</p>
    <h3>4. Segurança</h3>
    <p>Senhas são protegidas com bcrypt, a sessão usa cookie httpOnly e cada conta acessa somente os próprios dados. As chaves de API de IA permanecem exclusivamente no servidor.</p>
    <h3>5. Retenção</h3>
    <p>Mantemos seus dados enquanto sua conta estiver ativa. Registros de pagamento podem ser mantidos pelo prazo legal aplicável.</p>
    <h3>6. Contato</h3>
    <p>Para exercer seus direitos ou tirar dúvidas, entre em contato pelo e-mail <span class="inline-code">privacidade@fitai.app</span>.</p>`);
});

route('/termos', (root) => {
  root.innerHTML = legalShell('Termos de Uso', `
    <h3>1. Natureza do serviço</h3>
    <p>O FitAI é uma plataforma de apoio ao treinamento físico que utiliza inteligência artificial para sugerir programas de exercícios de caráter educativo. O FitAI <strong>não presta serviços médicos</strong> e <strong>não substitui</strong> a avaliação de médicos, fisioterapeutas ou profissionais de educação física.</p>
    <h3>2. Assunção de responsabilidade</h3>
    <p>Ao utilizar a plataforma, você declara estar apto à prática de exercícios físicos ou ter recebido liberação profissional. Interrompa imediatamente qualquer atividade em caso de dor, tontura ou desconforto e procure orientação de um profissional de saúde.</p>
    <h3>3. Menores de idade</h3>
    <p>Usuários menores de 18 anos devem ter a ciência e o consentimento de seus responsáveis legais. Os planos gerados para menores priorizam técnica, cargas moderadas e recomendam acompanhamento profissional.</p>
    <h3>4. Planos e pagamentos</h3>
    <p>Os planos pagos são mensais e sem fidelidade. O pagamento pode ser realizado via Pix ou cartão. O acesso aos recursos pagos permanece ativo até o fim do período já pago.</p>
    <h3>5. Uso aceitável</h3>
    <p>É proibido compartilhar credenciais, tentar burlar limites de plano, extrair dados de outros usuários ou usar a plataforma para finalidades ilícitas.</p>
    <h3>6. Ausência de garantia de resultados</h3>
    <p>Resultados físicos dependem de fatores individuais (genética, alimentação, sono, adesão e consistência). Não garantimos resultados específicos.</p>`);
});

window.renderLanding = renderLanding;
window.legalShell = legalShell;
