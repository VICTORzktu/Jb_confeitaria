# FitAI

> **Seu treino, sua evolução, sua inteligência.**
> Plataforma de treinos personalizados por inteligência artificial — fullstack, funcional e pronta para produção.

![stack](https://img.shields.io/badge/stack-Node.js%20%2B%20Express%205%20%2B%20SQLite-0b0f0e) ![ia](https://img.shields.io/badge/IA-multi--provider-c6f432) ![licença](https://img.shields.io/badge/uso-educacional-6f7b75)

---

## 1. O que está implementado

| Área | Recurso |
|---|---|
| **IA real** | Geração de treino via API de LLM (OpenAI, Anthropic, Gemini, Groq, OpenRouter, DeepSeek, Mistral, xAI, Together, Ollama ou gateway OpenAI-compatible). Nenhum treino fictício é gerado: sem chave configurada, a geração é bloqueada com mensagem clara. |
| **Formulário inteligente** | 6 etapas: dados corporais, objetivo (9), nível (3), rotina (dias/minutos/modalidade), local + equipamentos e foco muscular/limitações. |
| **Gerador** | Divisão semanal, exercícios com séries, reps, descanso, cadência, execução, **justificativa de cada escolha**, aquecimento, ordem, progressão e recuperação. |
| **Segurança determinística** | Filtro de contraindicações roda **depois** da IA e remove exercícios incompatíveis com lesões declaradas (joelho, ombro, lombar, coluna, quadril, punho, cotovelo, tornozelo). Avisos para menores de 18 e maiores de 60. Aviso de responsabilidade em todo plano. |
| **Substituição** | Substituir exercício com IA, com o substituto passando pelo mesmo filtro de segurança. |
| **Progressão inteligente** | Análise real de cargas, RPE e adesão dos últimos 28 dias (Pro/Premium). Nunca sugere aumento sem base em execução e recuperação. |
| **Biblioteca** | 65 exercícios com músculo principal/secundários, equipamento, modalidades, dificuldade, execução, erros comuns, dicas e exercícios premium. Filtros por músculo, equipamento, modalidade, dificuldade e busca. |
| **Dashboard** | Treino do dia, próximo treino, calendário semanal com conclusão, histórico, evolução de peso, evolução de cargas, frequência, adesão, metas. |
| **Registro de treino** | Cronômetro, séries com carga/reps, RPE, conclusão de treino e alimentação das estatísticas. |
| **Personal IA** | Chat contextual com perfil, programa ativo, cargas, peso e biblioteca. Histórico persistido. |
| **Usuários** | Cadastro, login, recuperação/redefinição de senha, alteração de senha, exclusão de conta (LGPD), isolamento total de dados por usuário. |
| **Admin** | Estatísticas, gestão de usuários (plano, papel, senha), exercícios, modalidades, conteúdos, planos/preços, confirmação de pagamentos e configuração de IA. |
| **Planos** | Gratuito / Pro / Premium com cotas reais aplicadas no backend (gerações, chat, substituições, progressão, relatórios, biblioteca). |
| **Pagamentos** | **Pix real** com BR Code EMV + QR Code gerado no servidor; cartão preparado (intenção de pagamento, status, webhook-ready). |

---

### Teste automatizado

O projeto inclui uma suíte funcional ponta a ponta da API (55 verificações: autenticação, isolamento de dados,
cotas por plano, biblioteca, Pix/BR Code, admin, recuperação de senha e guardrails de segurança).

```bash
npm start          # em um terminal
npm test           # em outro — usa http://127.0.0.1:3000
```

A suíte é autolimpante: cria os próprios usuários e remove tudo ao final, inclusive zerando a
configuração de IA e Pix. Ela respeita o rate limit de login (aguardando a janela quando necessário).

**Fluxo de IA ponta a ponta** (18 verificações: geração, substituição de exercício, progressão
inteligente e chat contextualizado). Usa um mock local compatível com OpenAI, então não consome
créditos de provedor pago:

```bash
npm run mock:ai    # terminal 1 — mock em http://127.0.0.1:4999
npm start          # terminal 2
npm run test:ai    # terminal 3
```

> O mock existe apenas para testes automatizados. Em produção o FitAI **só** responde quando há um
> provedor real configurado; sem chave, as rotas de IA retornam `503 AI_NOT_CONFIGURED` — nunca um
> treino inventado.

## 2. Rodar localmente

```bash
cd fitai
npm install
cp .env.example .env      # configure JWT_SECRET e a chave de IA
npm start                 # http://localhost:3000
```

No primeiro boot o banco é criado e populado (modalidades, 65 exercícios, conteúdos) junto com:

| Conta | E-mail | Senha |
|---|---|---|
| Admin | `admin@fitai.com` | `Admin@123456` |
| Aluno demo (com 6 semanas de histórico) | `demo@fitai.com` | `Demo@123456` |

> Troque essas credenciais em produção via `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `DEMO_*` **antes** do primeiro boot.
>
> **Contas demo na tela de login:** o bloco "conta de demonstração" só aparece quando
> `SHOW_DEMO_ACCOUNTS=1` ou quando `NODE_ENV` não é `production`. Com `NODE_ENV=production`
> (padrão do `render.yaml` e do `vercel.json`) ele é ocultado automaticamente.

### Configurar a IA (obrigatório para gerar treinos)

**Opção A — Painel Admin (recomendado):** entre como admin → **Integração com IA** → escolha o provedor, cole a chave, clique em **Testar conexão** e salve.

**Opção B — `.env`:**

```env
AI_PROVIDER=openai          # openai|anthropic|gemini|groq|openrouter|deepseek|mistral|xai|together|ollama|custom
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

A chave nunca é enviada ao navegador: todas as chamadas saem do backend, e o painel exibe apenas máscara (`sk-1••••••abcd`).

### Configurar o Pix

Painel Admin → **Config. de pagamentos** → informe chave, nome do recebedor e cidade. O sistema gera o BR Code EMV (CRC16 validado), o QR Code PNG e o código copia-e-cola.

Fluxo: usuário cria a intenção de pagamento → paga no app do banco → o admin confirma em **Planos e assinaturas → Confirmar** (em produção, troque a confirmação manual pelo webhook do PSP).

---

## 3. Arquitetura

```
fitai/
├── server/
│   ├── index.js          # Express 5, segurança (CSP, cookies), SPA fallback
│   ├── config.js         # planos, provedores de IA, segredos, .env loader
│   ├── db.js             # SQLite (better-sqlite3, WAL) + schema + settings
│   ├── auth.js           # JWT httpOnly, middlewares, rate limit, cotas
│   ├── ai.js             # camada multi-provedor + JSON tolerante + uso/erros
│   ├── prompts.js        # prompts + GUARDRAILS de segurança
│   ├── schedule.js       # distribuição dos dias na semana
│   ├── time.js           # datas no fuso local (America/Sao_Paulo)
│   ├── seed.js / seed-exercises.js
│   └── routes/           # auth, profile, workouts, sessions, dashboard,
│                         # exercises, chat, billing, admin
├── public/               # SPA vanilla (sem build, carregamento rápido)
│   ├── index.html
│   ├── css/  base.css · landing.css · app.css
│   └── js/   icons · core (API/router/toasts/charts) · views/*
├── data/                 # SQLite (criado no boot)
├── .env.example
├── render.yaml           # deploy com disco persistente
└── vercel.json           # deploy em Vercel (ver limitação)
```

### Banco de dados (14 tabelas)

`users`, `profiles`, `weight_logs`, `goals`, `workouts`, `sessions`, `set_logs`, `exercises`, `modalities`, `chat_messages`, `ai_usage`, `settings`, `payment_intents`, `password_resets`, `content`.

Todas as consultas são parametrizadas e escopadas por `user_id` — um usuário não consegue ler nem alterar dados de outro.

### Segurança

- Senhas com **bcrypt** (custo 10); mínimo de 8 caracteres com letras e números.
- Sessão em **JWT assinado** dentro de cookie `httpOnly` + `SameSite=Lax` (+ `Secure` em produção).
- **Rate limiting** em login, cadastro, recuperação, geração e chat.
- **CSP**, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Sessão**: cookie `httpOnly` + `SameSite=Lax` como padrão. Quando o navegador bloqueia o cookie
  (iframe de terceiros, Safari/ITP), o cliente cai automaticamente para `Authorization: Bearer`
  com o token mantido apenas em `sessionStorage` — a sessão não é interrompida silenciosamente.
- **Framing**: `EMBED_ALLOWED=1` (padrão) libera exibição em iframe para previews; em produção use
  `EMBED_ALLOWED=0` para `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`.
- Chaves de IA e Pix armazenadas no servidor (`settings`/env), nunca no cliente.
- Recuperação de senha com token de uso único e validade de 1 hora.

---

## 4. Regras de segurança embutidas no produto

1. Nenhum exercício contraindicado por lesão declarada chega ao usuário — o filtro roda em código, não depende do modelo.
2. Avisos obrigatórios para menores de 18 anos (técnica, cargas moderadas, acompanhamento de responsável/profissional).
3. Aviso para maiores de 60 (amplitude, aquecimento, avaliação médica).
4. Disclaimer permanente: a IA **não substitui** médicos e profissionais de educação física e **não garante resultados**.
5. Progressão de carga só com base em execução, RPE e recuperação — e limitada a incrementos conservadores.

---

## 5. Deploy

### Render / Railway / VPS (recomendado para esta arquitetura)

Use `render.yaml` (já incluído) — monta um disco persistente em `/var/data` e define `DATA_DIR`:

```bash
npm install
DATA_DIR=/var/data JWT_SECRET=... AI_PROVIDER=openai AI_API_KEY=... npm start
```

### Vercel

`vercel.json` está incluído para servir a aplicação na plataforma. **Limitação importante:** Vercel é serverless — o filesystem é efêmero e o SQLite não persiste entre invocações. Para uso real na Vercel, troque a camada de dados por um Postgres gerenciado (Neon/Supabase) alterando apenas `server/db.js` (a API do app já usa SQL parametrizado, o que facilita a migração). Para demonstração/preview sem dados persistentes, o deploy funciona.

---

## 6. Contas e limites por plano

| Recurso | Gratuito | Pro (R$ 29,90) | Premium (R$ 59,90) |
|---|---|---|---|
| Treinos gerados/mês | 3 | 30 | 200 |
| Mensagens no Personal IA/mês | 15 | 300 | ilimitado |
| Substituições com IA/mês | 5 | 100 | ilimitado |
| Progressão inteligente | — | ✓ | ✓ |
| Relatórios detalhados | — | ✓ | ✓ |
| Biblioteca completa | — | ✓ | ✓ |

Preços editáveis no Admin → Planos (reflete na landing e no checkout).

---

## 7. Aviso

O FitAI é uma ferramenta educativa de apoio ao treinamento. O conteúdo gerado por IA não constitui prescrição médica ou de educação física. Consulte um profissional antes de iniciar qualquer programa, especialmente em caso de lesão, gestação ou doença crônica.
