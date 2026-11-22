'use strict';
const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { db, getSetting } = require('../db');
const { requireAuth, planOf } = require('../auth');
const { PLANS, ENV_PIX_KEY } = require('../config');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  res.json({
    plans: Object.values(PLANS).map((p) => ({
      id: p.id, name: p.name, price_cents: p.price_cents, features: p.features,
      limits: { generations: p.generations, chats: p.chats, substitutes: p.substitutes },
      flags: { progression_ai: p.progression_ai, reports: p.reports, full_library: p.full_library },
    })),
    current: req.user.plan,
  });
});

/* ------------------------------ BR Code Pix (EMV) ------------------------------ */
function emv(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}
function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function sanitize(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 40);
}
function buildPixPayload({ key, name, city, amount, txid, description }) {
  const gui = emv('00', 'BR.GOV.BCB.PIX');
  const keyField = emv('01', key);
  const descField = description ? emv('02', sanitize(description).slice(0, 40)) : '';
  const mai = emv('26', gui + keyField + descField);
  const ad = emv('80', `FITAI${txid}`.slice(0, 25));
  const payload = [
    emv('00', '01'),
    emv('01', '12'),
    mai,
    emv('52', '0000'),
    emv('53', '986'),
    emv('54', amount.toFixed(2)),
    emv('58', 'BR'),
    emv('59', sanitize(name).slice(0, 25) || 'FITAI'),
    emv('60', sanitize(city).slice(0, 15) || 'SAO PAULO'),
    emv('62', ad),
    '6304',
  ].join('');
  return payload + crc16(payload);
}

router.post('/checkout', requireAuth, async (req, res) => {
  const planId = String(req.body?.plan || '');
  const method = String(req.body?.method || 'pix');
  const plan = PLANS[planId];
  if (!plan || plan.id === 'free') return res.status(400).json({ error: 'Plano inválido.' });
  if (!['pix', 'card'].includes(method)) return res.status(400).json({ error: 'Método de pagamento inválido.' });

  const pixKey = await getSetting('pix_key') || ENV_PIX_KEY || '';
  const ref = 'FT' + crypto.randomBytes(6).toString('hex').toUpperCase();
  let pixPayload = null;
  if (method === 'pix') {
    if (!pixKey) {
      return res.status(503).json({
        error: 'Pagamento via Pix ainda não está habilitado. O administrador precisa cadastrar a chave Pix em Painel Admin > Pagamentos.',
        code: 'PIX_NOT_CONFIGURED',
      });
    }
    pixPayload = buildPixPayload({
      key: pixKey,
      name: await getSetting('pix_holder') || 'FITAI',
      city: await getSetting('pix_city') || 'SAO PAULO',
      amount: plan.price_cents / 100,
      txid: ref,
      description: `FitAI ${plan.name}`,
    });
  }
  const info = await db.prepare(`INSERT INTO payment_intents (user_id, plan, amount_cents, method, status, pix_payload, ref)
    VALUES (?,?,?,?,?,?,?)`).run(req.user.id, plan.id, plan.price_cents, method,
    method === 'pix' ? 'awaiting_payment' : 'pending', pixPayload, ref);
  const status = await getSetting('card_provider_status') || 'not_configured';
  res.status(201).json({
    intent: { id: info.lastInsertRowid, ref, plan: plan.id, amount_cents: plan.price_cents, method, status: method === 'pix' ? 'awaiting_payment' : 'pending' },
    pix: pixPayload ? { payload: pixPayload, key: pixKey } : null,
    card: method === 'card'
      ? { provider: status, message: status === 'not_configured'
          ? 'A integração de cartão está preparada no backend, mas o provedor ainda não foi configurado. Use Pix para concluir agora ou entre em contato com o suporte.'
          : 'Sessão de pagamento criada. Conclua no provedor.' }
      : undefined,
  });
});

/* QR Code do Pix em imagem PNG (data URL) */
router.get('/pix-qr/:intentId', requireAuth, async (req, res) => {
  const intent = await db.prepare('SELECT * FROM payment_intents WHERE id = ? AND user_id = ?').get(req.params.intentId, req.user.id);
  if (!intent || !intent.pix_payload) return res.status(404).json({ error: 'Cobrança Pix não encontrada.' });
  try {
    const dataUrl = await QRCode.toDataURL(intent.pix_payload, { margin: 1, width: 320, color: { dark: '#0B0F0E', light: '#FFFFFF' } });
    res.json({ qr: dataUrl, payload: intent.pix_payload });
  } catch {
    res.status(500).json({ error: 'Falha ao gerar QR Code.' });
  }
});

/* Confirmação de pagamento: em produção validar via webhook do PSP.
   Aqui o admin confirma manualmente após conferir o Pix recebido. */
router.get('/payments', requireAuth, async (req, res) => {
  const rows = await db.prepare(`SELECT id, plan, amount_cents, method, status, ref, created_at, paid_at
    FROM payment_intents WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json({ payments: rows, current: planOf(req.user) });
});

router.delete('/payments/:id', requireAuth, async (req, res) => {
  await db.prepare("DELETE FROM payment_intents WHERE id = ? AND user_id = ? AND status != 'paid'").run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.buildPixPayload = buildPixPayload;
