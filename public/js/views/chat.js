/* ============================================================
   Personal IA — chat contextual
   ============================================================ */
const CHAT_SUGGESTIONS = [
  'Qual exercício trabalha mais o peitoral?',
  'Como substituir o supino se meu ombro incomoda?',
  'Qual divisão de treino combina com minha rotina?',
  'Como organizar meus dias de descanso?',
  'Como executar corretamente o agachamento?',
  'Como melhorar meu treino de costas?',
  'Estou estagnado no supino, o que fazer?',
];

function mdLite(text) {
  let s = esc(text);
  // blocos de código
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => `<pre style="background:rgba(0,0,0,.3);padding:10px;border-radius:8px;overflow-x:auto;font-size:12px"><code>${c.trim()}</code></pre>`);
  // negrito / itálico / código inline
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // listas
  const lines = s.split('\n');
  const out = [];
  let listType = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  for (const line of lines) {
    const t = line.trim();
    if (!t) { closeList(); continue; }
    if (/^[-•]\s+/.test(t)) {
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push(`<li>${t.replace(/^[-•]\s+/, '')}</li>`);
    } else if (/^\d+[.)]\s+/.test(t)) {
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push(`<li>${t.replace(/^\d+[.)]\s+/, '')}</li>`);
    } else if (/^#{1,4}\s+/.test(t)) {
      closeList(); out.push(`<p><strong>${t.replace(/^#{1,4}\s+/, '')}</strong></p>`);
    } else {
      closeList(); out.push(`<p>${t}</p>`);
    }
  }
  closeList();
  return out.join('');
}

async function renderChat(root) {
  if (App.user?.plan === 'free') {
    root.innerHTML = appShell({
      title: 'Personal IA', crumb: 'Chat com seu treinador',
      content: `<div class="card" style="max-width:640px;margin:40px auto;text-align:center;padding:48px 32px">
        <div class="feature-icon" style="margin:0 auto 20px;width:64px;height:64px">${icon('chat')}</div>
        <h2 style="font-size:26px">O Personal IA é seu treinador particular</h2>
        <p class="muted" style="max-width:440px;margin:0 auto 10px">Tire dúvidas sobre execução, substituições, divisão de treino e recuperação com um assistente que conhece seu histórico, seu programa ativo e suas cargas.</p>
        <div class="plan-list" style="max-width:360px;margin:24px auto;text-align:left">
          <li>${icon('check')} Respostas contextualizadas com seu perfil</li>
          <li>${icon('check')} Sabe seu programa ativo e evolução de cargas</li>
          <li>${icon('check')} 300 mensagens por mês no Pro</li>
        </div>
        <a href="/planos" data-link class="btn btn-primary btn-lg">${icon('sparkles')} Desbloquear com o Pro</a>
      </div>`,});
    bindShell();
    return;
  }

  root.innerHTML = appShell({
    title: 'Personal IA', crumb: 'Chat com seu treinador',
    actions: `<button class="btn btn-ghost btn-sm" id="clear-chat">${icon('trash')} Limpar</button>`,
    content: `<div class="chat-layout">
      <aside class="chat-side">
        <div class="card card-tight">
          <div class="row mb2"><div class="feature-icon" style="margin:0;width:34px;height:34px">${icon('sparkles')}</div>
            <div><strong class="fs13">Personal IA</strong><div class="fs11 dim">Contextualizado com seu perfil</div></div></div>
          <p class="fs12 dim" style="margin:0">Ele conhece seu programa, suas cargas e suas limitações declaradas.</p>
        </div>
        <div class="card card-tight">
          <div class="fs11 dim mb2" style="text-transform:uppercase;letter-spacing:.08em;font-weight:600">Sugestões</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${CHAT_SUGGESTIONS.map((s) => `<button class="suggest-q" data-q="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
        </div>
        <div class="alert alert-warn" style="font-size:11.5px">${icon('alert')}<div>O Personal IA não substitui médico ou profissional de educação física e não faz diagnósticos.</div></div>
      </aside>
      <section class="chat-panel">
        <div class="chat-head">
          <div class="ai-avatar">${icon('sparkles')}</div>
          <div class="grow"><strong>Personal IA</strong><span><i class="dot" style="width:6px;height:6px;box-shadow:none"></i> online · responde com base no seu histórico</span></div>
          <span class="badge badge-sm" id="chat-quota">—</span>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input">
          <textarea id="chat-text" rows="1" placeholder="Pergunte sobre treino, execução, descanso..."></textarea>
          <button class="chat-send" id="chat-send" aria-label="Enviar">${icon('send')}</button>
        </div>
      </section>
    </div>`,
  });
  bindShell();

  const box = document.getElementById('chat-messages');
  const ta = document.getElementById('chat-text');
  const sendBtn = document.getElementById('chat-send');
  let sending = false;

  function scrollBottom() { box.scrollTop = box.scrollHeight; }

  function addMsg(role, content, animate = true) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    el.innerHTML = role === 'assistant'
      ? `<div class="ai-avatar avatar" style="background:linear-gradient(145deg,var(--lime),#6d9c00)">${icon('sparkles')}</div><div class="bubble">${mdLite(content)}</div>`
      : `<div class="bubble">${mdLite(content)}</div>`;
    if (!animate) el.style.animation = 'none';
    box.appendChild(el);
    scrollBottom();
    return el;
  }

  function addTyping() {
    const el = document.createElement('div');
    el.className = 'msg assistant';
    el.id = 'typing-msg';
    el.innerHTML = `<div class="ai-avatar avatar" style="background:linear-gradient(145deg,var(--lime),#6d9c00)">${icon('sparkles')}</div><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div>`;
    box.appendChild(el);
    scrollBottom();
  }

  function setQuota(q) {
    const el = document.getElementById('chat-quota');
    if (!el || !q) return;
    el.textContent = q.limit >= 100000 ? '∞ mensagens' : `${q.used}/${q.limit} mensagens`;
    el.className = 'badge badge-sm' + (q.remaining <= 3 ? ' badge-orange' : '');
  }

  // Converte falhas do provedor de IA em mensagens úteis em português.
  function friendlyAIError(e) {
    const raw = String(e?.message || '');
    if (/high demand|overloaded|unavailable|capacity|temporarily/i.test(raw)) {
      return 'O modelo de IA está com alta demanda neste momento (isso costuma ser passageiro).\n\n**Tente enviar novamente em instantes** — se persistir, avise um administrador para trocar o modelo em Painel Admin › Integração com IA.';
    }
    if (/limite de uso|quota|rate limit|429/i.test(raw)) {
      return 'O limite de uso do provedor de IA foi atingido. Aguarde um minuto e tente novamente.';
    }
    if (/limite de tamanho|max_tokens|limite de tamanho antes de responder/i.test(raw)) {
      return 'A resposta ficou longa demais para o limite configurado. Tente uma pergunta mais curta.';
    }
    if (/chave|api key|unauthorized|401|403|invalid.*key/i.test(raw)) {
      return 'A chave de API da IA parece inválida ou expirada. Um administrador precisa atualizá-la em Painel Admin › Integração com IA.';
    }
    if (/não está configurado|não foi configurada|AI_NOT_CONFIGURED/i.test(raw)) {
      return 'O Personal IA ainda não foi configurado. Um administrador precisa informar provedor e chave em Painel Admin › Integração com IA.';
    }
    if (/segurança|safety|bloque/i.test(raw)) {
      return 'A resposta foi bloqueada pelo filtro de segurança do provedor. Tente reformular a pergunta.';
    }
    return 'Desculpe, não consegui responder agora.\n\n' + (raw || 'Tente novamente em instantes.');
  }

  async function send(text) {
    const message = (text ?? ta.value).trim();
    if (!message || sending) return;
    sending = true;
    ta.value = '';
    ta.style.height = 'auto';
    sendBtn.disabled = true;
    addMsg('user', message);
    addTyping();
    try {
      const res = await API.post('/api/chat', { message });
      document.getElementById('typing-msg')?.remove();
      addMsg('assistant', res.reply);
      setQuota(res.quota);
    } catch (e) {
      document.getElementById('typing-msg')?.remove();
      if (e.code === 'QUOTA_EXCEEDED' || e.code === 'UPGRADE_REQUIRED') {
        addMsg('assistant', e.message + '\n\nFaça upgrade em **Planos** para continuar conversando.');
      } else {
        // erros do provedor vêm em inglês e com jargão técnico — traduz e orienta
        const msg = friendlyAIError(e);
        addMsg('assistant', msg);
        toast(msg.split('\n')[0], 'error');
      }
    } finally {
      sending = false;
      sendBtn.disabled = false;
      ta.focus();
    }
  }

  sendBtn.onclick = () => send();
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(140, ta.scrollHeight) + 'px';
  });
  document.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => send(decodeURIComponent(b.dataset.q).replace(/&#39;/g, "'")));
  document.getElementById('clear-chat').onclick = async () => {
    const ok = await confirmModal({ title: 'Limpar conversa', message: 'O histórico desta conversa será apagado.', confirmText: 'Limpar', danger: true });
    if (!ok) return;
    await API.del('/api/chat/history');
    box.innerHTML = '';
    renderWelcome();
    toast('Conversa limpa.');
  };

  function renderWelcome() {
    addMsg('assistant', `Olá${App.user?.name ? ', **' + App.user.name.split(' ')[0] + '**' : ''}! Sou seu Personal IA.\n\nConheço seu perfil${App.profile?.goal ? ' (objetivo: ' + goalLabel(App.profile.goal) + ')' : ''}, seu programa ativo e sua evolução de cargas. Pode me perguntar sobre execução de exercícios, substituições, organização dos dias de treino, descanso ou o que mais precisar.\n\nImportante: não substituo médico nem profissional de educação física.`);
  }

  try {
    const data = await API.get('/api/chat/history');
    setQuota(data.quota);
    if (data.messages.length === 0) renderWelcome();
    else {
      // agrupa e exibe histórico
      let lastRole = null;
      for (const m of data.messages) { addMsg(m.role, m.content, false); lastRole = m.role; }
      scrollBottom();
    }
  } catch (e) {
    renderWelcome();
  }
  const params = new URLSearchParams(location.search);
  if (params.get('q')) { const q = params.get('q'); history.replaceState({}, '', '/personal-ia'); setTimeout(() => send(q), 260); }
  ta.focus();
}

route('/personal-ia', (root) => withAuth(() => renderChat(root)));
