'use strict';
/* Camada de IA — integração REAL com provedores de LLM.
   - Suporta OpenAI, Anthropic, Gemini, Groq, OpenRouter, DeepSeek, Mistral, xAI, Together, Ollama e endpoints OpenAI-compatible.
   - Chaves ficam apenas no backend (banco/settings ou variáveis de ambiente) e nunca são enviadas ao navegador.
   - Configuração definida no Painel Admin > Integração com IA. */
const { getSetting, getJSONSetting, db } = require('./db');
const { AI_PROVIDERS, ENV_AI } = require('./config');

/* Cache curto da configuração: evita 7 idas ao banco por chamada de IA.
   A config muda raramente (Painel Admin) — 10 s é imperceptível e seguro. */
let _cfgCache = null;
let _cfgCacheAt = 0;
const CFG_TTL = 10000;

async function getAIConfig(force = false) {
  if (!force && _cfgCache && Date.now() - _cfgCacheAt < CFG_TTL) return _cfgCache;
  const provider = await getSetting('ai_provider') || ENV_AI.provider || '';
  const apiKey = await getSetting('ai_api_key') || ENV_AI.api_key || '';
  const model = await getSetting('ai_model') || ENV_AI.model || (provider && AI_PROVIDERS[provider] ? AI_PROVIDERS[provider].defaultModel : '');
  const baseUrl = await getSetting('ai_base_url') || ENV_AI.base_url || (provider && AI_PROVIDERS[provider] ? AI_PROVIDERS[provider].baseUrl : '');
  const temperature = parseFloat(await getSetting('ai_temperature') || '0.6');
  const proxyUrl = await getSetting('ai_proxy_url') || '';
  const proxyToken = await getSetting('ai_proxy_token') || '';
  _cfgCache = { provider, apiKey, model, baseUrl, temperature, proxyUrl, proxyToken };
  _cfgCacheAt = Date.now();
  return _cfgCache;
}

function invalidateAIConfigCache() { _cfgCache = null; _cfgCacheAt = 0; }

function isConfigured(cfg) {
  if (!cfg || !cfg.provider || !cfg.model) return false;
  if (cfg.provider === 'ollama') return true;
  return !!cfg.apiKey;
}

async function logUsage(userId, feature, ok, error) {
  const cfg = await getAIConfig();
  try {
    await db.prepare('INSERT INTO ai_usage (user_id, feature, provider, model, ok, error) VALUES (?,?,?,?,?,?)')
      .run(userId || null, feature, cfg.provider || null, cfg.model || null, ok ? 1 : 0, error ? String(error).slice(0, 300) : null);
  } catch { /* noop */ }
}

class AIError extends Error {}

/* Chamada unificada de chat completion com mensagens [{role, content}] */
async function chat({ messages, json = false, maxTokens = 4096, timeoutMs = 90000 }) {
  const cfg = await getAIConfig();
  if (!isConfigured(cfg)) {
    throw new AIError('A integração com IA ainda não foi configurada. Um administrador precisa informar o provedor e a chave de API no Painel Admin > Integração com IA.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Gateway/proxy reverso (ex.: plataformas que expõem uma URL compatível com OpenAI)
    if (cfg.proxyUrl) return await callOpenAICompatible({ ...cfg, baseUrl: cfg.proxyUrl, apiKey: cfg.proxyToken || cfg.apiKey }, messages, { json, maxTokens, signal: controller.signal });
    if (cfg.provider === 'anthropic') return await callAnthropic(cfg, messages, { json, maxTokens, signal: controller.signal });
    if (cfg.provider === 'gemini') return await callGemini(cfg, messages, { json, maxTokens, signal: controller.signal });
    return await callOpenAICompatible(cfg, messages, { json, maxTokens, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new AIError('A IA demorou demais para responder. Tente novamente.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAICompatible(cfg, messages, { json, maxTokens, signal }) {
  const url = `${(cfg.baseUrl || '').replace(/\/+$/, '')}/chat/completions`;
  if (!/^https?:\/\//.test(url)) throw new AIError('URL base do provedor de IA inválida.');
  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature,
    max_tokens: maxTokens,
  };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch(url, {
    method: 'POST', signal,
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      ...(cfg.provider === 'openrouter' ? { 'HTTP-Referer': 'https://fitai.app', 'X-Title': 'FitAI' } : {}),
    },
    body: JSON.stringify(body),
  });
  return parseResponse(res, async (d) => {
    const c = d.choices && d.choices[0];
    if (!c) throw new AIError('Resposta vazia da IA.');
    return c.message?.content || c.text || '';
  });
}

async function callAnthropic(cfg, messages, { json, maxTokens, signal }) {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const msgs = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
  const res = await fetch(`${(cfg.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '')}/messages`, {
    method: 'POST', signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model, system: sys || undefined, messages: msgs,
      max_tokens: maxTokens, temperature: cfg.temperature,
    }),
  });
  return parseResponse(res, async (d) => {
    const parts = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text);
    if (!parts.length) throw new AIError('Resposta vazia da IA.');
    return parts.join('\n');
  });
}

async function callGemini(cfg, messages, { json, maxTokens, signal }) {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const url = `${(cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '')}/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
      generationConfig: {
        temperature: cfg.temperature,
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
  return parseResponse(res, async (d) => {
    const cand = d.candidates && d.candidates[0];
    const text = cand?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n');
    if (!text) throw new AIError('Resposta vazia da IA (pode ter sido bloqueada por segurança).');
    return text;
  });
}

async function parseResponse(res, extract) {
  let text = '';
  try { text = await res.text(); } catch { text = ''; }
  if (!res.ok) {
    let msg = `Erro ${res.status} do provedor de IA`;
    try {
      const j = JSON.parse(text);
      msg = j.error?.message || j.error?.[0]?.message || j.message || msg;
    } catch { if (text) msg += `: ${text.slice(0, 200)}`; }
    if (res.status === 401 || res.status === 403) msg = 'Chave de API inválida ou sem permissão. Verifique a configuração no Painel Admin.';
    if (res.status === 429) msg = 'Limite de uso do provedor de IA atingido. Aguarde um pouco e tente novamente.';
    throw new AIError(msg);
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new AIError('Resposta do provedor de IA não pôde ser interpretada.'); }
  return extract(data);
}

/* --------------------------- JSON estruturado tolerante --------------------------- */
function extractJSON(raw) {
  if (!raw) throw new AIError('A IA retornou uma resposta vazia.');
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try { return JSON.parse(s); } catch { /* tenta reparar vírgulas finais */ }
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch (e) {
    throw new AIError('A IA retornou um formato inesperado. Tente gerar novamente.');
  }
}

async function chatJSON({ system, user, maxTokens = 8192, feature = 'json', userId = null }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user + '\n\nResponda SOMENTE com JSON válido, sem texto antes ou depois, sem blocos de código.' });
  try {
    const raw = await chat({ messages, json: true, maxTokens });
    const data = extractJSON(raw);
    await logUsage(userId, feature, true);
    return data;
  } catch (e) {
    await logUsage(userId, feature, false, e.message);
    throw e;
  }
}

async function chatText({ system, messages, maxTokens = 1500, feature = 'chat', userId = null }) {
  const full = [];
  if (system) full.push({ role: 'system', content: system });
  for (const m of messages) full.push({ role: m.role, content: m.content });
  try {
    const out = await chat({ messages: full, json: false, maxTokens });
    await logUsage(userId, feature, true);
    return out;
  } catch (e) {
    await logUsage(userId, feature, false, e.message);
    throw e;
  }
}

/* Teste de conexão usado pelo painel admin */
async function testConnection() {
  const cfg = await getAIConfig(true);
  if (!isConfigured(cfg)) return { ok: false, error: 'Provedor/modelo/chave não configurados.' };
  const t0 = Date.now();
  const out = await chat({ messages: [{ role: 'user', content: 'Responda apenas com a palavra OK.' }], maxTokens: 20, timeoutMs: 30000 });
  return { ok: true, latency_ms: Date.now() - t0, provider: cfg.provider, model: cfg.model, sample: String(out).slice(0, 80) };
}

module.exports = {
  AIError, getAIConfig, isConfigured, invalidateAIConfigCache, chat, chatJSON, chatText, testConnection, logUsage,
};
