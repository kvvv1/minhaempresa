# Vida S.A.

Aplicacao Next.js para gerenciar a vida como uma empresa pessoal, com dashboard, rotina, financeiro, metas, relacionamentos, diario e assistentes de IA.

## Stack

- Next.js 16
- React 19
- Prisma 7
- SQLite local
- NextAuth com credenciais
- Tailwind CSS 4

## Rodando localmente

1. Instale as dependencias:

```bash
npm install
```

2. Gere o client Prisma:

```bash
npm run db:generate
```

3. Crie ou atualize o banco SQLite local:

```bash
npm run db:push
```

4. Inicie o projeto:

```bash
npm run dev
```

## Variaveis de ambiente

O projeto usa `.env.local` com estes valores base:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="change-this-to-a-random-secret-string"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="your-anthropic-api-key"
RESEND_API_KEY="your-resend-api-key"
```

Sem `ANTHROPIC_API_KEY`, as rotas de IA nao vao responder corretamente.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:push
```

## Estado atual

- Build de producao esta passando
- Lint esta passando sem erros
- Banco local usa SQLite
- `proxy.ts` substitui o antigo `middleware.ts` para o contrato do Next 16
