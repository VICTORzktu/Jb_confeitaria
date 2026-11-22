'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Carrega .env (se existir) sem depender do pacote dotenv em produção
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  }
} catch { /* ignore */ }

// Em ambiente serverless (Vercel) o bundle é read-only; /tmp é gravável e sobrevive à instância.
// Para dados realmente persistentes, aponte DATA_DIR para um volume ou migre para Postgres.
const IS_SERVERLESS = !!process.env.VERCEL;
const DATA_DIR = process.env.DATA_DIR || (IS_SERVERLESS ? '/tmp/fitai-data' : path.join(__dirname, '..', 'data'));
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Segredo JWT: usa env ou persiste um segredo local (sessões sobrevivem a reinícios)
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (IS_SERVERLESS) {
    // Sem segredo fixo em serverless as sessões caem a cada cold start:
    // deriva um segredo estável a partir de um valor do ambiente (não é ideal, mas mantém consistência).
    const seed = process.env.JWT_SEED || process.env.VERCEL_URL || 'fitai-serverless';
    return crypto.createHash('sha256').update('fitai:' + seed).digest('hex');
  }
  const p = path.join(DATA_DIR, '.jwt-secret');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(p, s, { mode: 0o600 });
  return s;
}

const PLANS = {
  free: {
    id: 'free', name: 'Gratuito', price_cents: 0,
    generations: 3,        // gerações de treino por mês
    chats: 15,             // mensagens de chat por mês
    substitutes: 5,        // substituições de exercício por mês
    progression_ai: false, // análise de progressão com IA
    reports: false,        // relatórios detalhados
    full_library: false,   // exercícios premium da biblioteca
    features: ['3 treinos gerados por mês', 'Biblioteca básica de exercícios', 'Dashboard básico', 'Registro de treinos e cargas'],
  },
  pro: {
    id: 'pro', name: 'Pro', price_cents: 2990,
    generations: 30,
    chats: 300,
    substitutes: 100,
    progression_ai: true,
    reports: true,
    full_library: true,
    features: ['30 treinos gerados por mês', 'Personalização avançada', 'Histórico completo', 'Chat com Personal IA', 'Acompanhamento de evolução', 'Biblioteca completa'],
  },
  premium: {
    id: 'premium', name: 'Premium', price_cents: 5990,
    generations: 200,
    chats: 100000,
    substitutes: 100000,
    progression_ai: true,
    reports: true,
    full_library: true,
    features: ['Até 200 treinos por mês', 'Ajustes inteligentes de treino', 'Relatórios detalhados de evolução', 'Personalização completa', 'Biblioteca completa + vídeos', 'Suporte prioritário'],
  },
};

const AI_PROVIDERS = {
  openai:      { label: 'OpenAI',               defaultModel: 'gpt-4o-mini',                     baseUrl: 'https://api.openai.com/v1' },
  anthropic:   { label: 'Anthropic (Claude)',   defaultModel: 'claude-3-5-haiku-latest',         baseUrl: 'https://api.anthropic.com/v1' },
  gemini:      { label: 'Google Gemini',        defaultModel: 'gemini-2.0-flash',                baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  groq:        { label: 'Groq',                 defaultModel: 'llama-3.3-70b-versatile',         baseUrl: 'https://api.groq.com/openai/v1' },
  openrouter:  { label: 'OpenRouter',           defaultModel: 'openai/gpt-4o-mini',              baseUrl: 'https://openrouter.ai/api/v1' },
  deepseek:    { label: 'DeepSeek',             defaultModel: 'deepseek-chat',                   baseUrl: 'https://api.deepseek.com/v1' },
  mistral:     { label: 'Mistral',              defaultModel: 'mistral-small-latest',            baseUrl: 'https://api.mistral.ai/v1' },
  xai:         { label: 'xAI (Grok)',           defaultModel: 'grok-2-latest',                   baseUrl: 'https://api.x.ai/v1' },
  together:    { label: 'Together AI',          defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', baseUrl: 'https://api.together.xyz/v1' },
  ollama:      { label: 'Ollama (local, sem chave)', defaultModel: 'llama3.1',                   baseUrl: 'http://127.0.0.1:11434/v1' },
  custom:      { label: 'Outro (OpenAI-compatible)', defaultModel: 'gpt-4o-mini',                baseUrl: '' },
};

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATA_DIR,
  DB_PATH: process.env.DB_PATH || path.join(DATA_DIR, 'fitai.db'),
  JWT_SECRET: loadSecret(),
  JWT_TTL_DAYS: 7,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PLANS,
  AI_PROVIDERS,
  // Configuração de IA via ambiente (tem prioridade menor que o painel admin)
  ENV_AI: {
    provider: process.env.AI_PROVIDER || '',
    api_key: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || '',
    model: process.env.AI_MODEL || '',
    base_url: process.env.AI_BASE_URL || '',
  },
  ENV_PIX_KEY: process.env.PIX_KEY || '',
};
