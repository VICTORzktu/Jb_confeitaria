# FitAI — Banco de dados (PostgreSQL)

## Estado atual

O app está rodando com **PostgreSQL no Supabase**.

| Item | Valor |
|---|---|
| Projeto Supabase | `jhnoeprirdxdlcteecft` (região `us-east-1`, plano free) |
| Host do pooler | `aws-1-us-east-1.pooler.supabase.com` |
| Porta | `5432` (session mode) |
| Usuário | `postgres.jhnoeprirdxdlcteecft` |
| Database | `postgres` |
| Tabelas | 15 |

> A conexão direta (`db.<ref>.supabase.co`) resolve **apenas IPv6** e não funciona em
> ambientes sem rota IPv6. Use sempre o **pooler** `aws-1-...pooler.supabase.com` com o
> usuário no formato `postgres.<ref>`.

## String de conexão

```
postgresql://postgres.jhnoeprirdxdlcteecft:SENHA@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

A senha tem `#`, que precisa ser codificada como `%23` dentro da URL.

## Conteúdo do banco

Populado com o seed padrão, idêntico ao ambiente de desenvolvimento:

| Tabela | Registros |
|---|---|
| users | 2 (admin + demo) |
| profiles | 1 |
| exercises | 65 |
| modalities | 9 |
| content | 4 |
| workouts | 1 (programa ABCD ativo) |
| sessions | 24 (6 semanas de histórico) |
| set_logs | 318 |
| weight_logs | 10 (10 semanas) |
| goals | 3 |

## Diferenças de tipo em relação ao SQLite

| SQLite | PostgreSQL | Motivo |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | sequência nativa |
| `TEXT` para datas | `TIMESTAMP` | permite comparação e `ORDER BY` |
| `date(x)` | `(x)::timestamp::date` | `date()` do SQLite equivale a truncar data |
| `LIKE` (ignora caixa) | `ILIKE` | no Postgres `LIKE` diferencia caixa |
| `COLLATE NOCASE` | índice `lower(email)` | unicidade sem caixa |
| `INSERT OR IGNORE` | `ON CONFLICT DO NOTHING` | idempotência |
| `lastInsertRowid` | `RETURNING *` → `rows[0].id` | simulado no driver |

## Backup e restauração

Pelo painel do Supabase (Database → Backups) ou com `pg_dump`:

```bash
pg_dump "postgresql://postgres.<ref>:SENHA@aws-1-us-east-1.pooler.supabase.com:5432/postgres" > fitai.sql
```

Restaurar (banco vazio — o schema é recriado pelo próprio app na primeira consulta):

```bash
psql "$DATABASE_URL" < fitai.sql
```

## Limites do plano free do Supabase

- 500 MB de banco (o FitAI usa ~1 MB)
- O projeto é **pausado após 7 dias sem uso**; volta ao primeiro acesso (pode levar ~30 s)
- Sem backups automáticos de longo prazo
