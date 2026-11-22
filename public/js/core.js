/* ============================================================
   FitAI — Núcleo: API, sessão, toasts, modal e router
   ============================================================ */
/* Fallback de sessão para ambientes onde o cookie httpOnly não é gravado
   (iframe de terceiros, navegação com ITP). O cookie continua sendo o padrão;
   o Bearer só é usado quando detectamos que ele não persistiu. */
const AuthToken = {
  key: 'fitai_bearer',
  get() { try { return sessionStorage.getItem(this.key) || null; } catch { return null; } },
  set(t) { try { t ? sessionStorage.setItem(this.key, t) : sessionStorage.removeItem(this.key); } catch {} },
  clear() { try { sessionStorage.removeItem(this.key); } catch {} },
};

const API = {
  async req(method, url, body, opts = {}) {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    const bearer = AuthToken.get();
    if (bearer) headers.Authorization = 'Bearer ' + bearer;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      ...opts,
    });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
    if (!res.ok) {
      const err = new Error(data?.error || `Erro ${res.status}`);
      err.status = res.status;
      err.data = data;
      err.code = data?.code;
      if (res.status === 401 && !url.includes('/api/auth/')) {
        App.session = null;
        if (location.pathname !== '/entrar' && location.pathname !== '/criar-conta') {
          navigate('/entrar?next=' + encodeURIComponent(location.pathname));
        }
      }
      throw err;
    }
    return data;
  },
  get: (u, o) => API.req('GET', u, null, o),
  post: (u, b) => API.req('POST', u, b || {}),
  put: (u, b) => API.req('PUT', u, b || {}),
  patch: (u, b) => API.req('PATCH', u, b || {}),
  del: (u, b) => API.req('DELETE', u, b || undefined),
};

/* ----------------------------- Estado global ----------------------------- */
const App = {
  session: null,
  user: null,
  plan: null,
  profile: null,
  cache: {},
  route: null,
};

const fmt = {
  brl(cents) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  num(n, d = 0) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  },
  date(v, opts = { day: '2-digit', month: 'short' }) {
    if (!v) return '—';
    const d = parseDate(v);
    if (!d) return '—';
    return d.toLocaleDateString('pt-BR', opts).replace('.', '');
  },
  dateFull(v) {
    return fmt.date(v, { day: '2-digit', month: 'long', year: 'numeric' });
  },
  weekday(v) {
    const d = parseDate(v);
    return d ? d.toLocaleDateString('pt-BR', { weekday: 'long' }) : '—';
  },
  time(v) {
    const d = parseDate(v);
    return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  },
  relative(v) {
    const d = parseDate(v);
    if (!d) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    if (diff < 172800) return 'ontem';
    if (diff < 604800) return `há ${Math.floor(diff / 86400)} dias`;
    return fmt.date(d);
  },
  volume(v) {
    if (!v) return '0 kg';
    if (v >= 1000) return `${fmt.num(v / 1000, 1)} t`;
    return `${fmt.num(v)} kg`;
  },
  pct(n) { return `${Math.round(n)}%`; },
};

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  let s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00');
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    // datetime('now') do SQLite é UTC
    const iso = s.replace(' ', 'T');
    return new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z');
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/* ----------------------------- Toasts ----------------------------- */
function ensureToastRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  return root;
}
function toast(message, type = 'success', ms = 4200) {
  const root = ensureToastRoot();
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : type === 'warn' ? ' warn' : '');
  const ico = type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'checkCircle';
  el.innerHTML = `${icon(ico)}<div>${esc(message)}</div>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); }, ms);
  return el;
}

/* ----------------------------- Modal ----------------------------- */
function openModal(html, { size = '', onMount, closable = true } = {}) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true">${html}</div>`;
  if (closable) {
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
  }
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  backdrop.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  const escHandler = (e) => { if (e.key === 'Escape' && closable) { closeModal(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  if (onMount) onMount(backdrop.querySelector('.modal'));
  return backdrop.querySelector('.modal');
}
function closeModal() {
  const b = document.getElementById('modal-backdrop');
  if (b) b.remove();
  document.body.style.overflow = '';
}
function confirmModal({ title, message, confirmText = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const el = openModal(`
      <div class="modal-head"><h3>${esc(title)}</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <p class="muted" style="margin:0;font-size:14px">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-cancel>Cancelar</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>
      </div>`, { onMount(m) {
      m.querySelector('[data-ok]').onclick = () => { closeModal(); resolve(true); };
      m.querySelector('[data-cancel]').onclick = () => { closeModal(); resolve(false); };
      m.querySelector('[data-close]').onclick = () => { closeModal(); resolve(false); };
    } });
    el.closest('.modal-backdrop').addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('modal-backdrop')) resolve(false);
    });
  });
}

/* ----------------------------- Router (History API) ----------------------------- */
const routes = [];
function route(path, handler) { routes.push({ path, handler }); }

function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  renderRoute();
}

function matchRoute(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  for (const r of routes) {
    const keys = [];
    const pattern = r.path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
    const m = clean.match(new RegExp('^' + pattern + '$'));
    if (m) {
      const params = {};
      keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
  }
  return null;
}

async function renderRoute() {
  const path = location.pathname;
  const match = matchRoute(path);
  const root = document.getElementById('app');
  if (!root) return;
  closeModal();
  const appRoutes = ['/app', '/treinos', '/biblioteca', '/personal-ia', '/progresso', '/planos', '/admin', '/perfil', '/registrar-treino', '/treino'];
  const needsAuth = appRoutes.some((p) => path === p || path.startsWith(p + '/')) || path === '/onboarding';
  if (needsAuth && !App.user) {
    const s = await loadSession();
    if (!s || !s.user) { navigate('/entrar?next=' + encodeURIComponent(path), { replace: true }); return; }
  }
  if (path === '/onboarding' && App.user?.role === 'admin') { navigate('/admin', { replace: true }); return; }
  if (path === '/onboarding' && App.user) {
    // exige perfil completo
    const p = App.profile;
    if (p?.goal && p?.level && p?.days_per_week && p?.minutes_per_session && p?.location) {
      const params = new URLSearchParams(location.search);
      if (!params.get('edit')) { navigate('/app', { replace: true }); return; }
    }
  }
  if (path === '/admin' && App.user?.role !== 'admin') {
    navigate('/app', { replace: true }); return;
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  const view = match ? match.route.handler : null;
  if (!view) {
    root.innerHTML = renderNotFound();
    return;
  }
  App.route = path;
  try {
    await view(root, match.params || {});
  } catch (e) {
    console.error(e);
    if (e.status === 401) return;
    root.innerHTML = `<div class="container" style="padding:80px 0"><div class="empty"><div class="empty-icon">${icon('alert')}</div><h4>Algo deu errado</h4><p>${esc(e.message)}</p><button class="btn btn-primary mt2" onclick="location.reload()">Recarregar</button></div></div>`;
  }
  window.lazyReveals && window.lazyReveals();
}

function renderNotFound() {
  return `<div class="container" style="min-height:70svh;display:grid;place-items:center">
    <div class="empty"><div class="empty-icon">${icon('search')}</div><h4>Página não encontrada</h4>
    <p>O endereço que você tentou acessar não existe.</p>
    <a class="btn btn-primary mt2" href="/">Voltar ao início</a></div></div>`;
}

async function loadSession(force = false) {
  if (App.session && !force) return App.session;
  try {
    const data = await API.get('/api/auth/me');
    // Sem usuário e sem Bearer: sessão realmente inexistente.
    if (!data.user && AuthToken.get()) {
      // O cookie não vale, mas há token em memória — confirma com o Bearer.
      const retry = await API.get('/api/auth/me');
      if (retry.user) { App.session = retry; App.user = retry.user; App.profile = retry.profile; App.plan = retry.plan; return retry; }
      AuthToken.clear();
    }
    App.session = data.user ? data : null;
    App.user = data.user || null;
    App.profile = data.profile || null;
    App.plan = data.plan || null;
    return data;
  } catch {
    App.session = null; App.user = null; App.profile = null; App.plan = null;
    return null;
  }
}

function setSession(data) {
  App.session = data;
  App.user = data?.user || null;
  App.profile = data?.profile || null;
  App.plan = data?.plan || null;
  if (data?.token) AuthToken.set(data.token);
}

/* Após o login, verifica se o cookie httpOnly foi realmente aceito.
   Se não foi (iframe/ITP), mantém o Bearer como mecanismo de sessão. */
async function verifySessionPersistence() {
  if (!App.user) return false;
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    const data = await res.json();
    if (data.user) { AuthToken.clear(); return true; } // cookie ok: não precisa do Bearer
    return false;                                      // sem cookie: seguimos com Bearer
  } catch { return false; }
}

function clearAuthToken() { AuthToken.clear(); }

/* Reavel on scroll */
window.lazyReveals = function () {
  const els = document.querySelectorAll('.reveal:not(.in)');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
};

window.addEventListener('popstate', () => { renderRoute(); });

/* Delegação global de links */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a && !a.getAttribute('target') && !a.hasAttribute('download')) {
    e.preventDefault();
    const href = a.getAttribute('href');
    if (href && href !== location.pathname + location.search) navigate(href);
    else if (href) navigate(href);
  }
});

/* ----------------------------- Chart helpers (SVG puro, sem CDN) ----------------------------- */
const Charts = {
  line({ points, width = 600, height = 220, pad = 28, color = '#c6f432', area = true, yFmt = (v) => fmt.num(v, 1), xLabels = [] }) {
    if (!points || points.length === 0) return `<div class="chart-empty">Sem dados suficientes ainda</div>`;
    const vals = points.map((p) => p.y);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.12; max += span * 0.12;
    const w = width - pad * 2, h = height - pad * 2;
    const x = (i) => pad + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
    const y = (v) => pad + h - ((v - min) / (max - min)) * h;
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    const areaPath = `${line} L${x(points.length - 1).toFixed(1)},${(pad + h).toFixed(1)} L${x(0).toFixed(1)},${(pad + h).toFixed(1)} Z`;
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const gy = pad + h * t;
      const val = max - (max - min) * t;
      return `<line x1="${pad}" x2="${width - pad}" y1="${gy}" y2="${gy}" stroke="rgba(255,255,255,.06)" stroke-dasharray="3 5"/>
        <text x="${pad - 8}" y="${gy + 3.5}" fill="#6f7b75" font-size="9.5" text-anchor="end" font-family="Inter">${yFmt(val)}</text>`;
    }).join('');
    const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="3.2" fill="#050706" stroke="${color}" stroke-width="2"><title>${esc(p.label || '')}: ${yFmt(p.y)}</title></circle>`).join('');
    const labels = points.map((p, i) => {
      if (points.length > 9 && i % Math.ceil(points.length / 7) !== 0 && i !== points.length - 1) return '';
      return `<text x="${x(i)}" y="${height - 6}" fill="#6f7b75" font-size="9.5" text-anchor="middle" font-family="Inter">${esc(p.xLabel || '')}</text>`;
    }).join('');
    return `<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="max-height:${height}px">
      <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".26"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${gridLines}
      ${area ? `<path d="${areaPath}" fill="url(#areaGrad)"/>` : ''}
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${labels}</svg></div>`;
  },

  bars({ values, height = 140, color = '#c6f432', labels = [], unit = '', showValues = true }) {
    if (!values || !values.length) return `<div class="chart-empty">Sem dados ainda</div>`;
    const max = Math.max(...values, 1);
    return `<div class="chart-wrap">
      <div style="display:flex;align-items:flex-end;gap:${Math.max(3, Math.round(28 / values.length))}px;height:${height}px;padding-bottom:2px">
        ${values.map((v, i) => {
          const pct = Math.max(2, (v / max) * 100);
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px" title="${esc(labels[i] || '')}: ${v}${unit}">
            ${showValues ? `<span style="font-size:9.5px;color:#6f7b75;font-variant-numeric:tabular-nums">${v || ''}</span>` : ''}
            <i style="display:block;width:100%;max-width:34px;height:${pct}%;background:linear-gradient(180deg,${color},${color}44);border-radius:4px 4px 2px 2px"></i>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:${Math.max(3, Math.round(28 / values.length))}px;margin-top:6px">
        ${labels.map((l) => `<span style="flex:1;text-align:center;font-size:9px;color:#6f7b75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l)}</span>`).join('')}
      </div>
    </div>`;
  },

  donut({ segments, size = 150, thickness = 16 }) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const r = (size - thickness) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const arcs = segments.map((s) => {
      const len = (s.value / total) * c;
      const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}"
        stroke-dasharray="${len - 2} ${c - len + 2}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="round"><title>${esc(s.label)}: ${s.value}</title></circle>`;
      offset += len;
      return el;
    }).join('');
    return `<svg class="donut-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${thickness}"/>${arcs}</svg>`;
  },
};

/* ----------------------------- Helpers UI ----------------------------- */
function setLoading(el, loading, text) {
  if (!el) return;
  if (loading) {
    el.dataset.html = el.innerHTML;
    el.innerHTML = `<span class="spinner dark"></span>${text ? ` ${esc(text)}` : ''}`;
    el.disabled = true;
  } else {
    if (el.dataset.html) el.innerHTML = el.dataset.html;
    el.disabled = false;
  }
}

function badgePlan(plan) {
  const map = { free: ['Gratuito', 'badge'], pro: ['Pro', 'badge-lime'], premium: ['Premium', 'badge-purple'] };
  const [label, cls] = map[plan] || map.free;
  return `<span class="badge ${cls} badge-sm">${label}</span>`;
}

function upgradeModal(featureLabel) {
  openModal(`
    <div class="modal-head"><h3>Recurso dos planos Pro e Premium</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
    <div class="alert alert-lime mb2">${icon('sparkles')}<div><strong>${esc(featureLabel || 'Este recurso')}</strong> está disponível nos planos pagos. Faça upgrade para desbloquear.</div></div>
    <div class="plan-list mt2">
      <li>${icon('check')} Mais gerações de treino com IA</li>
      <li>${icon('check')} Personal IA no chat com seu histórico</li>
      <li>${icon('check')} Progressão inteligente e relatórios detalhados</li>
    </div>
    <div class="modal-actions"><button class="btn btn-ghost" data-close>Depois</button>
    <a class="btn btn-primary" href="/planos" data-link>Ver planos</a></div>`);
}

window.App = App; window.API = API; window.fmt = fmt; window.esc = esc;
window.icon = icon; window.toast = toast; window.openModal = openModal; window.closeModal = closeModal;
window.confirmModal = confirmModal; window.navigate = navigate; window.route = route;
window.renderRoute = renderRoute; window.loadSession = loadSession; window.setSession = setSession;
window.initials = initials; window.Charts = Charts; window.setLoading = setLoading;
window.badgePlan = badgePlan; window.upgradeModal = upgradeModal; window.parseDate = parseDate;
