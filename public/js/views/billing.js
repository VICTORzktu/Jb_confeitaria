/* ============================================================
   Planos e cobrança — Pix (BR Code) e cartão
   ============================================================ */
async function renderBilling(root) {
  root.innerHTML = appShell({
    title: 'Planos e cobrança', crumb: 'Sua assinatura',
    content: `<div class="skeleton" style="height:300px;margin-bottom:18px"></div><div class="skeleton" style="height:200px"></div>`,
  });
  bindShell();

  let data, payments;
  try {
    [data, payments] = await Promise.all([API.get('/api/billing'), API.get('/api/billing/payments')]);
  } catch (e) {
    document.getElementById('app-content').innerHTML = `<div class="alert alert-danger">${icon('alert')}<div>${esc(e.message)}</div></div>`;
    return;
  }

  const current = data.current;
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="card mb3" style="background:linear-gradient(150deg,rgba(198,244,50,.09),transparent 55%),var(--surface);border-color:rgba(198,244,50,.25)">
      <div class="row-between wrap" style="gap:16px">
        <div class="row" style="gap:14px">
          <div class="feature-icon" style="margin:0;width:46px;height:46px">${icon('creditCard')}</div>
          <div><div class="fs12 dim" style="text-transform:uppercase;letter-spacing:.08em;font-weight:600">Plano atual</div>
          <div class="row" style="gap:8px"><strong style="font-size:20px;font-family:var(--font-display)">${data.plans.find((p) => p.id === current)?.name}</strong>${badgePlan(current)}</div>
          ${App.user.plan_expires_at ? `<span class="fs12 dim">Renovação em ${fmt.date(App.user.plan_expires_at)}</span>` : '<span class="fs12 dim">Plano gratuito · sem cobrança</span>'}</div>
        </div>
        <div class="row wrap" style="gap:8px">
          <span class="badge">${icon('shield')} Pagamento seguro</span>
          <span class="badge">${icon('pix')} Pix</span>
          <span class="badge">${icon('creditCard')} Cartão</span>
        </div>
      </div>
    </div>

    <div class="billing-grid">
      ${data.plans.map((p) => {
        const isCurrent = p.id === current;
        return `<div class="billing-card ${isCurrent ? 'current' : ''}">
          <div class="row-between"><strong style="font-family:var(--font-display);font-size:17px">${p.name}</strong>
            ${isCurrent ? '<span class="badge badge-lime badge-sm">Seu plano</span>' : p.id === 'pro' ? '<span class="badge badge-sm">Mais popular</span>' : ''}</div>
          <div class="price mt2">${p.price_cents === 0 ? 'R$ 0' : fmt.brl(p.price_cents)}<small>${p.price_cents === 0 ? ' para sempre' : '/mês'}</small></div>
          <ul class="plan-list mt2" style="flex:1">${p.features.map((f) => `<li>${icon('check')}${f}</li>`).join('')}</ul>
          <div class="fs12 dim mb2" style="border-top:1px solid var(--border);padding-top:12px">
            ${p.limits.generations >= 100000 ? 'Treinos ilimitados' : p.limits.generations + ' treinos/mês'} ·
            ${p.limits.chats === 0 ? 'sem chat' : p.limits.chats >= 100000 ? 'chat ilimitado' : p.limits.chats + ' msgs de chat/mês'}
          </div>
          ${isCurrent ? `<button class="btn btn-dark btn-block" disabled>Plano atual</button>`
            : p.id === 'free' ? `<button class="btn btn-ghost btn-block" data-downgrade>Voltar para o Gratuito</button>`
            : `<button class="btn btn-primary btn-block" data-buy="${p.id}">${current !== 'free' ? 'Mudar para ' : 'Assinar '}${p.name}</button>`}
        </div>`;
      }).join('')}
    </div>

    <div class="card mt3">
      <div class="card-head"><h3 class="card-title">${icon('clock')} Histórico de pagamentos</h3></div>
      ${payments.payments.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Referência</th><th>Plano</th><th>Valor</th><th>Método</th><th>Status</th><th>Data</th></tr></thead>
        <tbody>${payments.payments.map((p) => {
          const statusMap = { paid: ['Pago', 'badge-lime'], awaiting_payment: ['Aguardando Pix', 'badge-orange'], pending: ['Pendente', 'badge-orange'], cancelled: ['Cancelado', 'badge-red'] };
          const [lbl, cls] = statusMap[p.status] || ['—', ''];
          return `<tr><td class="mono fs12">${esc(p.ref)}</td><td>${esc(p.plan)}</td><td>${fmt.brl(p.amount_cents)}</td>
            <td>${p.method === 'pix' ? 'Pix' : 'Cartão'}</td><td><span class="badge badge-sm ${cls}">${lbl}</span></td>
            <td class="nowrap">${fmt.date(p.created_at)}</td></tr>`;
        }).join('')}</tbody></table></div>`
      : `<div class="empty" style="padding:28px"><div class="empty-icon">${icon('creditCard')}</div><h4>Nenhum pagamento</h4><p>Seu histórico de cobranças aparecerá aqui.</p></div>`}
    </div>

    <div class="alert alert-info mt3">${icon('info')}<div><strong>Como funciona o pagamento:</strong> via Pix, você recebe um QR Code e o código copia-e-cola. A confirmação é validada pela nossa equipe/provedor e o plano é liberado por 30 dias. Cartão de crédito está preparado para integração com PSP. Os planos são mensais e sem fidelidade.</div></div>`;

  document.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => openCheckout(b.dataset.buy));
  document.querySelectorAll('[data-downgrade]').forEach((b) => b.onclick = async () => {
    const ok = await confirmModal({ title: 'Voltar ao plano gratuito', message: 'Você perderá acesso aos recursos pagos ao fim do período já pago. Deseja continuar?', confirmText: 'Confirmar', danger: true });
    if (ok) toast('Para alterar seu plano, fale com o suporte. Seu acesso permanece até o fim do período pago.', 'warn', 7000);
  });

  function openCheckout(planId) {
    const plan = data.plans.find((p) => p.id === planId);
    let method = 'pix';
    openModal(`
      <div class="modal-head"><div><span class="fs12 dim">Assinar</span><h3 style="margin:0">Plano ${plan.name} · ${fmt.brl(plan.price_cents)}/mês</h3></div>
        <button class="btn-icon" data-close>${icon('x')}</button></div>
      <div class="payment-methods mb2">
        <button class="pay-method active" data-m="pix">${icon('pix')}<span>Pix</span><small>Aprovação imediata</small></button>
        <button class="pay-method" data-m="card">${icon('creditCard')}<span>Cartão de crédito</span><small>Em até 12x</small></button>
      </div>
      <div id="checkout-body"></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button>
        <button class="btn btn-primary" id="ck-confirm">${icon('creditCard')} Continuar</button></div>`, { onMount(m) {
      m.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => {
        method = b.dataset.m;
        m.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('active', x === b));
      });
      m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
      m.querySelector('#ck-confirm').onclick = async () => {
        const btn = m.querySelector('#ck-confirm');
        setLoading(btn, true, 'Gerando cobrança...');
        try {
          const res = await API.post('/api/billing/checkout', { plan: planId, method });
          if (res.pix) { showPix(res); return; }
          closeModal();
          toast(res.card?.message || 'Sessão de pagamento criada.', 'warn', 8000);
          renderBilling(root);
        } catch (e) {
          setLoading(btn, false);
          toast(e.message, 'error', 8000);
        }
      };
    } });
  }

  function showPix(res) {
    openModal(`
      <div class="modal-head"><h3>Pagamento via Pix</h3><button class="btn-icon" data-close>${icon('x')}</button></div>
      <div class="pix-box">
        <div class="pix-qr" id="pix-qr"><div class="skeleton" style="width:100%;height:100%"></div></div>
        <div class="center"><strong style="font-family:var(--font-display);font-size:20px">${fmt.brl(res.intent.amount_cents)}</strong>
          <div class="fs12 dim">Referência: <span class="mono">${esc(res.intent.ref)}</span></div></div>
        <div style="width:100%">
          <div class="fs12 dim mb2">1. Abra o app do seu banco e escolha Pix → Ler QR Code ou Copia e Cola</div>
          <div class="pix-code" id="pix-code">${esc(res.pix.payload)}</div>
          <div class="row mt2" style="gap:8px"><button class="btn btn-dark btn-sm grow" id="copy-pix">${icon('copy')} Copiar código</button>
          <button class="btn btn-dark btn-sm" id="share-pix">${icon('external')}</button></div>
        </div>
        <div class="alert alert-warn" style="width:100%">${icon('alert')}<div style="font-size:12px">Após o pagamento, a confirmação é verificada e seu plano é liberado. Em ambiente de teste, um administrador pode confirmar manualmente em <strong>Admin → Planos e assinaturas</strong>.</div></div>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Fechar</button>
      <a href="/planos" data-link class="btn btn-primary" id="go-plans">Ver status</a></div>`, { onMount(m) {
      m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
      API.get('/api/billing/pix-qr/' + res.intent.id).then((q) => {
        const el = m.querySelector('#pix-qr');
        if (el) el.innerHTML = `<img src="${q.qr}" alt="QR Code Pix" style="width:100%;height:100%">`;
      }).catch(() => {
        m.querySelector('#pix-qr').innerHTML = `<div class="center fs12 dim" style="padding:20px">Não foi possível carregar o QR Code. Use o código copia-e-cola.</div>`;
      }).finally(() => {
        m.querySelector('#go-plans').onclick = (e) => { e.preventDefault(); closeModal(); renderBilling(root); };
      });
      m.querySelector('#copy-pix').onclick = async () => {
        try { await navigator.clipboard.writeText(res.pix.payload); toast('Código Pix copiado!'); }
        catch { toast('Selecione e copie manualmente o código.', 'warn'); }
      };
      m.querySelector('#share-pix').onclick = async () => {
        if (navigator.share) { try { await navigator.share({ title: 'Pagamento FitAI', text: res.pix.payload }); } catch {} }
        else m.querySelector('#copy-pix').click();
      };
    }, closable: true });
  }
}

route('/planos', (root) => withAuth(() => renderBilling(root)));
