/* ============================================================
   Autenticação: entrar, criar conta, recuperar senha
   ============================================================ */
function authShell(sideTitle, sideText, content) {
  return `<div class="auth-wrap">
    <aside class="auth-side">
      <a href="/" data-link class="logo"><span class="logo-mark">${icon('logo')}</span>Fit<em>AI</em></a>
      <div>
        <h2>${sideTitle}</h2>
        <p>${sideText}</p>
        <div class="auth-quote">“A IA ajustou minha divisão para os dias que eu realmente tenho. Em dois meses não faltei um treino.”<br><br><strong style="color:var(--text)">Marina C.</strong> <span class="dim">· assinante Pro</span></div>
      </div>
      <div class="fs12 dim" style="display:flex;gap:16px;flex-wrap:wrap">
        <span style="display:inline-flex;gap:6px;align-items:center">${icon('shield')} Dados protegidos</span>
        <span style="display:inline-flex;gap:6px;align-items:center">${icon('lock')} Autenticação segura</span>
      </div>
    </aside>
    <main class="auth-main"><div class="auth-card">${content}</div></main>
  </div>`;
}

function pwdField(id, label, placeholder = 'Mínimo de 8 caracteres') {
  return `<div class="field">
    <label for="${id}">${label}</label>
    <div class="input-icon" style="position:relative">
      ${icon('lock')}
      <input class="input" type="password" id="${id}" name="${id}" placeholder="${placeholder}" autocomplete="current-password" style="padding-right:46px">
      <button type="button" class="pwd-toggle" data-for="${id}" aria-label="Mostrar senha"
        style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:grid;place-items:center;color:var(--text-3);border-radius:8px">${icon('eye')}</button>
    </div>
  </div>`;
}

function bindPwdToggles(scope) {
  scope.querySelectorAll('.pwd-toggle').forEach((btn) => {
    btn.onclick = () => {
      const input = scope.querySelector('#' + btn.dataset.for);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
    };
  });
}

/* ------------------------------- Entrar ------------------------------- */
route('/entrar', (root) => {
  root.innerHTML = authShell(
    'Bem-vindo de volta ao seu progresso.',
    'Seu programa ativo, seu histórico de cargas e o Personal IA estão esperando por você.',
    `
    <h1>Entrar</h1>
    <p class="sub">Acesse sua conta para continuar treinando.</p>
    <form class="auth-form" id="login-form" novalidate>
      <div class="field" id="f-email">
        <label for="email">E-mail</label>
        <div class="input-icon">${icon('mail')}<input class="input" type="email" id="email" placeholder="voce@email.com" autocomplete="email" required></div>
      </div>
      ${pwdField('password', 'Senha', 'Sua senha')}
      <div class="row-between">
        <span></span>
        <a href="/recuperar-senha" data-link class="fs13 lime" style="font-weight:600">Esqueci minha senha</a>
      </div>
      <div class="error-text hidden" id="login-error"></div>
      <button class="btn btn-primary btn-block" type="submit" id="login-submit">Entrar ${icon('arrowRight')}</button>
    </form>
    ${window.__site?.demo_access ? `
    <div class="divider-text" style="margin:22px 0">conta de demonstração</div>
    <div class="demo-creds">
      <span>Aluno: <code>${esc(window.__site.demo_access.student.email)}</code> · <code>Demo@123456</code></span>
      <span>Admin: <code>${esc(window.__site.demo_access.admin.email)}</code> · <code>Admin@123456</code></span>
      <button type="button" id="fill-demo">Usar credenciais de demonstração</button>
    </div>` : ''}
    <p class="auth-switch">Ainda não tem conta? <a href="/criar-conta" data-link>Criar conta grátis</a></p>`);

  bindPwdToggles(root);
  const form = root.querySelector('#login-form');
  const errEl = root.querySelector('#login-error');
  const submit = root.querySelector('#login-submit');
  const fillDemo = root.querySelector('#fill-demo');
  if (fillDemo) fillDemo.onclick = () => {
    form.email.value = window.__site.demo_access.student.email;
    form.password.value = 'Demo@123456';
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    errEl.classList.add('hidden');
    if (!form.email.value.trim() || !form.password.value) {
      errEl.textContent = 'Preencha e-mail e senha.';
      errEl.classList.remove('hidden');
      return;
    }
    setLoading(submit, true, 'Entrando...');
    try {
      const data = await API.post('/api/auth/login', { email: form.email.value.trim(), password: form.password.value });
      setSession(data);
      await verifySessionPersistence();
      toast('Bem-vindo de volta, ' + data.user.name.split(' ')[0] + '!');
      const next = new URLSearchParams(location.search).get('next');
      const p = App.profile;
      const neeedsOnboarding = !p?.goal || !p?.level || !p?.days_per_week || !p?.minutes_per_session || !p?.location;
      if (data.user.role === 'admin' && (!neeedsOnboarding || next === '/admin')) navigate('/admin');
      else if (neeedsOnboarding) navigate('/onboarding');
      else navigate(next && next.startsWith('/') ? next : '/app');
    } catch (err) {
      setLoading(submit, false);
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };
});

/* ------------------------------- Criar conta ------------------------------- */
route('/criar-conta', (root) => {
  const planParam = new URLSearchParams(location.search).get('plan') || 'free';
  root.innerHTML = authShell(
    'Comece com o pé direito.',
    'Crie sua conta em instantes e receba um treino feito para você em menos de três minutos.',
    `
    <h1>Criar conta</h1>
    <p class="sub">Grátis para começar. Sem cartão de crédito.</p>
    <form class="auth-form" id="register-form" novalidate>
      <div class="field"><label for="name">Nome completo</label>
        <div class="input-icon">${icon('user')}<input class="input" type="text" id="name" placeholder="Como devemos te chamar" autocomplete="name" required></div>
      </div>
      <div class="field"><label for="email">E-mail</label>
        <div class="input-icon">${icon('mail')}<input class="input" type="email" id="email" placeholder="voce@email.com" autocomplete="email" required></div>
      </div>
      <div class="field"><label for="age">Idade</label>
        <div class="input-icon">${icon('calendar')}<input class="input" type="number" id="age" min="12" max="100" placeholder="Ex.: 28" inputmode="numeric"></div>
        <span class="hint">Usada para adequar volume e recomendações. Menores de 18 recebem orientação específica.</span>
      </div>
      ${pwdField('password', 'Senha', 'Mínimo de 8 caracteres, com letras e números')}
      <label class="row fs13 muted" style="align-items:flex-start;gap:9px;cursor:pointer">
        <input type="checkbox" id="terms" style="margin-top:3px;accent-color:var(--lime);width:16px;height:16px">
        <span>Li e aceito os <a href="/termos" target="_blank" class="lime">Termos de Uso</a> e a <a href="/privacidade" target="_blank" class="lime">Política de Privacidade</a>, ciente de que o FitAI não substitui acompanhamento médico ou profissional de educação física.</span>
      </label>
      <div class="error-text hidden" id="register-error"></div>
      <button class="btn btn-primary btn-block" type="submit" id="register-submit">Criar minha conta ${icon('arrowRight')}</button>
    </form>
    <p class="auth-switch">Já tem conta? <a href="/entrar" data-link>Entrar</a></p>`);

  bindPwdToggles(root);
  const form = root.querySelector('#register-form');
  const errEl = root.querySelector('#register-error');
  const submit = root.querySelector('#register-submit');
  form.onsubmit = async (e) => {
    e.preventDefault();
    errEl.classList.add('hidden');
    if (!form.terms.checked) { errEl.textContent = 'É necessário aceitar os termos para continuar.'; errEl.classList.remove('hidden'); return; }
    setLoading(submit, true, 'Criando conta...');
    try {
      const payload = {
        name: form.name.value.trim(), email: form.email.value.trim(), password: form.password.value,
        age: form.age.value ? Number(form.age.value) : undefined,
      };
      const data = await API.post('/api/auth/register', payload);
      setSession(data);
      await verifySessionPersistence();
      if (planParam !== 'free') sessionStorage.setItem('fitai_intent_plan', planParam);
      toast('Conta criada. Vamos montar seu perfil!');
      navigate('/onboarding');
    } catch (err) {
      setLoading(submit, false);
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };
});

/* ------------------------------- Recuperar senha ------------------------------- */
route('/recuperar-senha', (root) => {
  root.innerHTML = authShell(
    'Recupere seu acesso.',
    'Informe o e-mail da sua conta e enviaremos as instruções para criar uma nova senha.',
    `
    <h1>Recuperar senha</h1>
    <p class="sub">Enviaremos um link seguro para redefinir sua senha.</p>
    <form class="auth-form" id="forgot-form">
      <div class="field"><label for="email">E-mail cadastrado</label>
        <div class="input-icon">${icon('mail')}<input class="input" type="email" id="email" placeholder="voce@email.com" required></div>
      </div>
      <div class="alert alert-info hidden" id="forgot-result">${icon('info')}<div></div></div>
      <button class="btn btn-primary btn-block" type="submit" id="forgot-submit">Enviar instruções</button>
    </form>
    <p class="auth-switch"><a href="/entrar" data-link>Voltar para o login</a></p>`);
  const form = root.querySelector('#forgot-form');
  const submit = root.querySelector('#forgot-submit');
  const result = root.querySelector('#forgot-result');
  form.onsubmit = async (e) => {
    e.preventDefault();
    setLoading(submit, true, 'Enviando...');
    try {
      const data = await API.post('/api/auth/forgot-password', { email: form.email.value.trim() });
      setLoading(submit, false);
      result.classList.remove('hidden');
      result.querySelector('div').innerHTML = data.reset_token
        ? `Link de recuperação gerado. Como o serviço de e-mail não está configurado neste ambiente, use o link abaixo:<br><br><a href="${data.reset_url}" data-link class="lime" style="font-weight:600">Redefinir minha senha</a><br><span class="fs12 dim">(O link expira em 1 hora.)</span>`
        : data.message;
    } catch (err) {
      setLoading(submit, false);
      toast(err.message, 'error');
    }
  };
});

/* ------------------------------- Redefinir senha ------------------------------- */
route('/redefinir-senha', (root) => {
  const token = new URLSearchParams(location.search).get('token');
  root.innerHTML = authShell('Crie uma senha nova.', 'Escolha uma senha forte e única para proteger sua conta.',
    `<h1>Redefinir senha</h1>
    <p class="sub">Defina uma nova senha para sua conta.</p>
    <form class="auth-form" id="reset-form">
      ${pwdField('password', 'Nova senha', 'Mínimo de 8 caracteres')}
      ${pwdField('password2', 'Confirmar nova senha', 'Repita a senha')}
      <div class="error-text hidden" id="reset-error"></div>
      <button class="btn btn-primary btn-block" type="submit" id="reset-submit">Redefinir senha</button>
    </form>
    <p class="auth-switch"><a href="/entrar" data-link>Voltar para o login</a></p>`);
  bindPwdToggles(root);
  const form = root.querySelector('#reset-form');
  const errEl = root.querySelector('#reset-error');
  form.onsubmit = async (e) => {
    e.preventDefault();
    errEl.classList.add('hidden');
    if (!token) { errEl.textContent = 'Token ausente. Solicite um novo link.'; errEl.classList.remove('hidden'); return; }
    if (form.password.value !== form.password2.value) { errEl.textContent = 'As senhas não coincidem.'; errEl.classList.remove('hidden'); return; }
    const submit = root.querySelector('#reset-submit');
    setLoading(submit, true, 'Salvando...');
    try {
      await API.post('/api/auth/reset-password', { token, password: form.password.value });
      toast('Senha redefinida. Faça login.');
      navigate('/entrar');
    } catch (err) {
      setLoading(submit, false);
      errEl.textContent = err.message; errEl.classList.remove('hidden');
    }
  };
});
