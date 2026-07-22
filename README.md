<p align="center">
  <h1 align="center">NxFinance</h1>
  <p align="center">Controle financeiro pessoal com dashboard interativo, parcelamentos com precisão decimal e importação de faturas de cartão de crédito.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma" alt="Prisma"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/NextAuth.js-4-000000?logo=auth0&logoColor=white" alt="NextAuth"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/shadcn%2Fui-New_York-000000" alt="shadcn/ui"/>
  <img src="https://img.shields.io/badge/Zod-4-3E67B1?logo=zod&logoColor=white" alt="Zod"/>
</p>

---

## Sobre o projeto

NxFinance é uma aplicação full-stack de finanças pessoais construída com Next.js App Router. O foco do projeto é resolver dois problemas que planilhas tradicionalmente fazem mal: **parcelamentos** (divisão de valores sem erro de arredondamento) e **faturas de cartão de crédito** (lançamento em lote com categorização por item, sem duplicar o total no dashboard).

## Funcionalidades

- **Dashboard financeiro** — saldo, entradas, saídas, forecast mensal (projeção baseada na média diária de gastos) e indicador de saúde financeira, com gráfico donut de gastos por categoria.
- **Gestão de transações** — CRUD completo com status calculado dinamicamente (`PENDENTE` / `PAGO` / `ATRASADO`).
- **Parcelamento inteligente** — divisão de valores com `decimal.js` (arredondamento para baixo + centavo residual na última parcela), datas de vencimento incrementais por mês, descrições editáveis por parcela.
- **Importação de fatura de cartão de crédito** — upload de CSV que gera uma transação-cabeçalho (`is_invoice_header`) com N itens categorizados individualmente, evitando dupla contagem no gráfico de categorias.
- **Importação de CSV genérica** — mapeamento automático de colunas (título/valor/data), sugestão de categoria por histórico (`MappingSuggestion`) e criação inline de categorias/meios de pagamento.
- **Relatórios filtráveis** — tabela (TanStack Table) com filtros por status, categoria, instituição financeira e meio de pagamento.
- **Agrupamento inteligente de categorias** — normaliza variações de nome (ex.: "Mercado Extra", "Mercadinho" → "Mercado") na agregação do gráfico.
- **Autenticação** — login via Credentials Provider (NextAuth) com sessão JWT; suporte a segundo fator no schema (ver limitações abaixo).
- **Tema claro/escuro** — alternância persistente via `next-themes`.
- **Navegação por URL** — mês/ano do dashboard e relatórios gerenciados via search params, compartilháveis e "bookmarkáveis".

> **Limitação conhecida:** o fluxo de 2FA está parcialmente implementado (campos no banco, verificação de presença do código no login) mas não está conectado de ponta a ponta — não há UI para ativação, o código não é validado contra um segredo, e o envio de e-mail não é acionado. Detalhes técnicos completos em [CONTEXT.md](./CONTEXT.md#6-gaps-e-inconsistências-conhecidas).

---

## Stack

| Categoria | Tecnologia |
|-----------|-----------|
| **Framework** | Next.js 16 (App Router), Server Components por padrão |
| **Linguagem** | TypeScript (strict mode), path alias `@/` → `src/` |
| **ORM / Banco** | Prisma 6 + PostgreSQL |
| **Autenticação** | NextAuth 4 — Credentials Provider + sessão JWT |
| **UI** | shadcn/ui (New York), Tailwind CSS, Radix UI, Lucide React |
| **Formulários** | react-hook-form + Zod |
| **Gráficos** | Recharts (donut chart) |
| **Tabelas** | TanStack Table |
| **CSV** | PapaParse |
| **Precisão numérica** | decimal.js (parcelas sem erro de arredondamento) |
| **Notificações** | Sonner |

---

## Estrutura do projeto

```
src/
├── app/                          # App Router
│   ├── layout.tsx                # RootLayout global (providers, banner, toaster)
│   ├── page.tsx                  # Dashboard principal (rota "/")
│   ├── auth/                     # Login e registro
│   ├── reports/                  # Relatórios com filtros
│   └── dashboard/settings/       # Instituições, categorias, meios de pagamento
├── components/
│   ├── dashboard/                # Componentes de negócio
│   │   ├── transaction-form.tsx           # Formulário com parcelamento
│   │   ├── credit-card-invoice-dialog.tsx # Importação de fatura
│   │   ├── csv-import-dialog.tsx          # Importação CSV genérica
│   │   ├── category-chart.tsx             # Gráfico donut
│   │   ├── summary-cards.tsx              # Cards de resumo
│   │   ├── financial-health.tsx           # Saúde financeira
│   │   └── forecast.tsx                   # Projeção mensal
│   ├── layout/top-nav.tsx        # Navegação superior
│   └── ui/                       # Primitivas shadcn/ui
├── lib/
│   ├── actions.ts                # Server Actions (transações, categorias, etc.)
│   ├── auth.ts                   # Config NextAuth
│   ├── dashboard.ts              # Agregações do dashboard
│   ├── reports.ts                # Dados de relatórios
│   ├── credit-card-actions.ts    # Importação de fatura
│   ├── csv-actions.ts            # Processamento em lote de CSV
│   ├── validations.ts            # Schemas Zod
│   └── db.ts                     # Singleton do PrismaClient
├── proxy.ts                      # Middleware de proteção de rotas
└── types/next-auth.d.ts          # Extensões de tipo da sessão
```

### Modelo de dados (Prisma)

```
User (1) ──< (N) Transaction
User (1) ──< (N) Category
User (1) ──< (N) PaymentMethod
User (1) ──< (N) FinancialInstitution
User (1) ──< (N) MappingSuggestion

Transaction (1) ──< (N) CreditCardInvoiceItem
Category (1) ──< (N) Transaction
Category (1) ──< (N) CreditCardInvoiceItem
```

**Regras principais:**
- Parcelamento disponível apenas para transações do tipo `SAIDA`, e somente na criação.
- Status `ATRASADO` é calculado dinamicamente na query — não é persistido no banco.
- Fatura de cartão (CSV) cria uma `Transaction` com `is_invoice_header = true` + N `CreditCardInvoiceItem` vinculados; só o cabeçalho é liquidado (os itens não têm status próprio).
- Categorias/meios de pagamento/instituições com transações vinculadas não podem ser excluídos.

Documentação técnica completa (regras de negócio, convenções, gaps conhecidos) em **[CONTEXT.md](./CONTEXT.md)**.

---

## Rodando localmente

### Pré-requisitos

- Node.js ≥ 18
- PostgreSQL (local ou via Docker)
- npm

### 1. Clone e instale as dependências

```bash
git clone https://github.com/dallemolle/nx-finance.git
cd nx-finance
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env`:

```env
# Banco de dados
DATABASE_URL="postgresql://user:password@localhost:5432/nx_finance?schema=public"

# NextAuth
NEXTAUTH_SECRET="gere-um-segredo-com-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# SMTP (usado pelo módulo de envio de 2FA — ver limitação conhecida acima)
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="seu-email@example.com"
SMTP_PASS="sua-senha-de-app"
EMAIL_FROM="NxFinance <no-reply@example.com>"
```

### 3. Sincronize o schema do banco

O projeto usa `prisma db push` (schema-first, sem histórico de migrations em produção):

```bash
npx prisma generate
npx prisma db push
```

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000), crie uma conta em `/auth/register` (categorias padrão são criadas automaticamente).

### Alternativa: Docker

```bash
docker-compose up --build -d
npx prisma generate
npx prisma db push
npm run dev
```

---

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Executa `prisma generate` e gera o build de produção |
| `npm run start` | Inicia o servidor de produção (requer build prévio) |
| `npm run lint` | Executa o linter (ESLint config do Next.js) |
| `npx prisma studio` | Interface visual para inspecionar o banco |
| `npx prisma db push` | Sincroniza `schema.prisma` com o banco de dados |

---

## Fluxo de desenvolvimento

```bash
git checkout staging
git pull origin staging
git checkout -b feature/nome-da-feature

# ... desenvolva ...

git add .
git commit -m "feat: descrição da funcionalidade"
git push origin feature/nome-da-feature
```

---

## Licença

MIT
