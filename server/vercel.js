'use strict';
/* Entrypoint para deploy serverless (Vercel).
   Reutiliza integralmente o app Express.

   LIMITAÇÕES EM SERVERLESS (importante):
   - O bundle é read-only; o SQLite é criado em /tmp e vive enquanto a instância existir.
   - Dados NÃO persistem entre cold starts/deploys. Serve para demonstração.
   - Para uso real, aponte DATA_DIR para um volume persistente e rode em container
     (Render/Railway/VPS) ou troque SQLite por Postgres — ver README, seção "Deploy". */
const app = require('./index');

module.exports = app;
