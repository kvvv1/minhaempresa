# Vida S.A.

Aplicacao Next.js para gerenciar a vida como uma empresa pessoal, com dashboard, rotina, financeiro, metas, relacionamentos, diario e assistentes de IA.

## Stack

- Next.js 16
- React 19
- Prisma 7
- PostgreSQL em desenvolvimento e producao
- NextAuth com credenciais
- Tailwind CSS 4

## Banco de dados

- O projeto usa PostgreSQL como fonte unica de verdade.
- O Prisma CLI carrega `.env` e `.env.local`, com `.env.local` tendo prioridade.
- `DATABASE_URL` deve apontar para PostgreSQL. URLs `file:` nao sao mais suportadas no runtime.
- `dev.db` continua apenas como legado para importacao unica via `npm run db:legacy-import`.

## Rodando localmente

1. Instale as dependencias:

```bash
npm install
```

2. Suba o PostgreSQL local:

```bash
docker compose up -d postgres
```

3. Ajuste `.env.local` se precisar mudar host, porta ou credenciais.

4. Gere o client Prisma:

```bash
npm run db:generate
```

5. Aplique as migracoes versionadas:

```bash
npm run db:deploy
```

6. Inicie o projeto:

```bash
npm run dev
```

## Migrando dados legados do SQLite

Se voce ainda precisa reaproveitar o `dev.db`, importe os dados para o PostgreSQL atual:

```bash
npm run db:legacy-import
```

Variaveis opcionais:

```env
SOURCE_SQLITE_PATH="./dev.db"
TARGET_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vida_sa?schema=public"
```

Quando `TARGET_DATABASE_URL` nao for definido, o script usa `DATABASE_URL`.

Para criar uma nova migracao de schema a partir daqui, use:

```bash
npm run db:migrate -- --name nome-da-mudanca
```

## Variaveis de ambiente

Exemplo base para desenvolvimento local:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vida_sa?schema=public"
NEXTAUTH_SECRET="change-this-to-a-random-secret-string"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="your-anthropic-api-key"
RESEND_API_KEY="your-resend-api-key"
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:deploy
npm run db:push
npm run db:legacy-import
```

## Estado atual

- Build de producao deve usar PostgreSQL
- Prisma local e runtime usam a mesma `DATABASE_URL`
- SQLite ficou restrito ao fluxo de importacao legada
