/* ============================================================
   Shell do aplicativo: sidebar, topbar, logout, notificações
   ============================================================ */
const NAV_MAIN = [
  { href: '/app', label: 'Visão geral', icon: 'grid' },
  { href: '/treinos', label: 'Meus treinos', icon: 'dumbbell' },
  { href: '/personal-ia', label: 'Personal IA', icon: 'chat', pro: true },
  { href: '/biblioteca', label: 'Exercícios', icon: 'library' },
  { href: '/progresso', label: 'Progresso', icon: 'chart' },
];

const NAV_SECOND = [
  { href: '/planos', label: 'Planos e cobrança', icon: 'creditCard' },
  { href: '/perfil', label: 'Perfil e ajustes', icon: 'settings' },
];

function planBadgeInline() {
  const p = App.user?.plan || 'free';
  if (p === 'premium') return '<span class="badge badge-purple badge-sm">Premium</span>';
  if (p === 'pro') return '<span class="badge badge-lime badge-sm">Pro</span>';
  return '<span class="badge badge-sm">Gratuito</span>';
}

function appShell({ title, crumb = '', actions = '', content }) {
  const user = App.user || {};
  const path = location.pathname;
  const active = (href) => path === href || (href !== '/app' && path.startsWith(href)) || (href === '/app' && (path === '/app' || path === '/registrar-treino' || path === '/treino' || path.startsWith('/treino/'))) ? 'active' : '';
  const isAdmin = user.role === 'admin';
  const planInfo = { free: ['Gratuito', '3 treinos por mês', 'Fazer upgrade'], pro: ['Pro', 'Assinatura ativa', 'Gerenciar'], premium: ['Premium', 'Assinatura ativa', 'Gerenciar'] }[user.plan || 'free'];

  return `
  <div class="app-shell">
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    <aside class="sidebar" id="sidebar">
      <a href="/app" data-link class="logo"><span class="logo-mark">${icon('logo')}</span>Fit<em>AI</em></a>
      <nav class="side-nav">
        <span class="side-label">Principal</span>
        ${NAV_MAIN.map((n) => `<a href="${n.href}" data-link class="side-item ${active(n.href)}">${icon(n.icon)}<span>${n.label}</span>${n.pro && App.user?.plan === 'free' ? '<span class="badge badge-sm">PRO</span>' : ''}</a>`).join('')}
        ${isAdmin ? `<span class="side-label">Administração</span><a href="/admin" data-link class="side-item ${active('/admin')}">${icon('shield')}<span>Painel admin</span></a>` : ''}
        <span class="side-label">Conta</span>
        ${NAV_SECOND.map((n) => `<a href="${n.href}" data-link class="side-item ${active(n.href)}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}
      </nav>
      <div class="side-foot">
        ${user.plan === 'free' ? `
        <div class="plan-mini">
          <div class="name">⚡ Upgrade Pro</div>
          <div class="desc">Treinos ilimitados na prática: 30 por mês + Personal IA.</div>
          <a href="/planos" data-link class="btn btn-primary btn-sm btn-block">Ver planos</a>
        </div>` : `
        <div class="plan-mini">
          <div class="name">⚡ Plano ${planInfo[0]}</div>
          <div class="desc">${planInfo[1]}.</div>
          <a href="/planos" data-link class="btn btn-dark btn-sm btn-block">Gerenciar assinatura</a>
        </div>`}
        <div class="user-chip" id="user-chip" title="Sair da conta">
          <div class="avatar">${initials(user.name)}</div>
          <div class="info"><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span></div>
          <span style="margin-left:auto;color:var(--text-3)">${icon('logout')}</span>
        </div>
      </div>
    </aside>
    <main class="app-main">
      <header class="topbar">
        <button class="icon-btn mobile-top" id="open-sidebar" aria-label="Abrir menu">${icon('menu')}</button>
        <div>
          ${crumb ? `<div class="crumb">${esc(crumb)}</div>` : ''}
          <h1>${esc(title)}</h1>
        </div>
        <div class="actions">${actions}
          <a href="/personal-ia" data-link class="icon-btn" title="Personal IA" aria-label="Personal IA">${icon('chat')}<span class="ping"></span></a>
        </div>
      </header>
      <div class="app-content" id="app-content">${content}</div>
      <footer class="app-footer">
        <span>© ${new Date().getFullYear()} FitAI · Seu treino, sua evolução, sua inteligência.</span>
        <div class="row" style="gap:16px;flex-wrap:wrap">
          <a href="/" data-link>Site</a>
          <a href="/privacidade" data-link>Privacidade</a>
          <a href="/termos" data-link>Termos</a>
        </div>
        <span class="fs11 dim" style="max-width:640px;text-align:center">O FitAI é uma ferramenta educativa e não substitui médicos ou profissionais de educação física.</span>
      </footer>
    </main>
  </div>`;
}

function bindShell() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const openBtn = document.getElementById('open-sidebar');
  if (openBtn && sidebar) {
    openBtn.onclick = () => { sidebar.classList.add('open'); backdrop.classList.add('show'); };
    backdrop.onclick = () => { sidebar.classList.remove('open'); backdrop.classList.remove('show'); };
  }
  const chip = document.getElementById('user-chip');
  if (chip) {
    chip.onclick = async () => {
      const ok = await confirmModal({
        title: 'Sair da conta',
        message: 'Você deseja encerrar sua sessão?',
        confirmText: 'Sair',
      });
      if (ok) {
        await API.post('/api/auth/logout');
        clearAuthToken();
        setSession(null);
        navigate('/');
        toast('Sessão encerrada.');
      }
    };
  }
}

/* Wrapper: garante sessão + perfil completo antes de renderizar */
async function withAuth(render) {
  const session = await loadSession();
  if (!session) { navigate('/entrar?next=' + encodeURIComponent(location.pathname)); return; }
  return render();
}

/* Redireciona para onboarding se o perfil estiver incompleto */
function profileComplete() {
  const p = App.profile;
  return !!(p && p.goal && p.level && p.days_per_week && p.minutes_per_session && p.location);
}

function requireProfileOrOnboarding() {
  if (!profileComplete()) { navigate('/onboarding'); return false; }
  return true;
}

window.appShell = appShell;
window.bindShell = bindShell;
window.withAuth = withAuth;
window.profileComplete = profileComplete;
window.requireProfileOrOnboarding = requireProfileOrOnboarding;
