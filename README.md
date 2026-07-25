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

- **Dashboard financeiro** — KPIs de saldo/entradas/saídas com hierarquia visual (saldo em destaque), forecast mensal (projeção baseada na média diária de gastos), indicador de saúde financeira, gráfico donut de gastos por categoria (top 10 + "Outros", legenda completa) e tendência de saldo dos últimos 6 meses.
- **Toggle de privacidade** — oculta/exibe valores monetários do dashboard com um clique (ícone de olho), persistido em `localStorage`.
- **Busca global** — Ctrl/Cmd+K abre uma paleta de comando para buscar transações por descrição.
- **Gestão de transações** — CRUD completo com status calculado dinamicamente (`PENDENTE` / `PAGO` / `ATRASADO`).
- **Parcelamento inteligente** — divisão de valores com `decimal.js` (arredondamento para baixo + centavo residual na última parcela), datas de vencimento incrementais por mês, descrições editáveis por parcela.
- **Importação de fatura de cartão de crédito** — upload de CSV que gera uma transação-cabeçalho (`is_invoice_header`) com N itens categorizados individualmente; reconhece estornos/reembolsos (valores negativos reduzem o total da fatura) e sugere categoria automaticamente com base no histórico.
- **Importação de CSV genérica** — mapeamento automático de colunas (título/valor/data), sugestão de categoria por histórico (`MappingSuggestion`, casamento por assinatura de estabelecimento) e criação inline de categorias/meios de pagamento.
- **Relatórios filtráveis** — tabela paginada (TanStack Table) com filtros por status, categoria, instituição financeira e meio de pagamento.
- **Agrupamento inteligente de categorias** — normaliza variações de nome (ex.: "Mercado Extra", "Mercadinho" → "Mercado") na agregação do gráfico.
- **Autenticação com 2FA (TOTP)** — login via Credentials Provider (NextAuth) com sessão JWT; segundo fator opcional via app autenticador (QR code de setup em Configurações → Segurança).
- **Exportação** — CSV (compatível com Excel pt-BR) e PDF (via impressão) das transações do período.
- **Tema claro/escuro** — alternância persistente via `next-themes`.
- **Navegação mobile** — barra de navegação inferior fixa em telas pequenas.
- **Navegação por URL** — mês/ano do dashboard e relatórios gerenciados via search params, compartilháveis e "bookmarkáveis".

Gaps e decisões de escopo conhecidas em [CONTEXT.md](./CONTEXT.md#6-gaps-e-inconsistências-conhecidas).

---

## Stack

| Categoria | Tecnologia |
|-----------|-----------|
| **Framework** | Next.js 16 (App Router), Server Components por padrão |
| **Linguagem** | TypeScript (strict mode), path alias `@/` → `src/` |
| **ORM / Banco** | Prisma 6 + PostgreSQL |
| **Autenticação** | NextAuth 4 — Credentials Provider + sessão JWT + 2FA via TOTP (otplib) |
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
│   ├── layout.tsx                # RootLayout global (providers, banner, command palette, nav mobile, toaster)
│   ├── page.tsx                  # Dashboard principal (rota "/")
│   ├── auth/                     # Login (com campo 2FA condicional) e registro
│   ├── reports/                  # Relatórios com filtros
│   └── dashboard/settings/       # Instituições, categorias, meios de pagamento, segurança (2FA)
├── components/
│   ├── dashboard/                # Componentes de negócio
│   │   ├── transaction-form.tsx           # Formulário com parcelamento
│   │   ├── credit-card-invoice-dialog.tsx # Importação de fatura (aceita estorno)
│   │   ├── csv-import-dialog.tsx          # Importação CSV genérica
│   │   ├── category-chart.tsx             # Gráfico donut (top 10 + Outros) + legenda completa
│   │   ├── summary-cards.tsx              # Cards de KPI (saldo em destaque)
│   │   ├── financial-health.tsx           # Saúde financeira
│   │   ├── forecast.tsx                   # Projeção mensal
│   │   ├── security-settings.tsx          # Ativação/desativação de 2FA
│   │   └── privacy-provider.tsx           # Toggle de privacidade (ocultar valores)
│   ├── layout/                   # Navegação (top-nav.tsx, mobile-bottom-nav.tsx)
│   ├── command-palette.tsx       # Busca global (Ctrl/Cmd+K)
│   └── ui/                       # Primitivas shadcn/ui
├── lib/
│   ├── actions.ts                # Server Actions (transações, categorias, etc.)
│   ├── auth.ts                   # Config NextAuth (valida código TOTP no login)
│   ├── two-factor-actions.ts     # Setup/ativação/desativação de 2FA
│   ├── dashboard.ts              # Agregações do dashboard + tendência mensal
│   ├── dashboard-utils.ts        # Normalização/agrupamento de categorias, assinatura de estabelecimento
│   ├── reports.ts                # Dados de relatórios + busca global
│   ├── credit-card-actions.ts    # Importação de fatura
│   ├── csv-actions.ts            # Processamento em lote de CSV
│   ├── validations.ts            # Schemas Zod
│   ├── utils.ts                  # cn(), formatCurrency()/maskCurrency(), tratamento de erro Prisma
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
```

> O segundo fator (2FA) usa TOTP via app autenticador (Google Authenticator, Authy etc.) — não depende de nenhuma variável de e-mail/SMTP. Ative em Configurações → Segurança depois de criar sua conta.

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
```

Sobe o PostgreSQL e a aplicação em containers; o `docker-entrypoint.sh` já executa `prisma db push` automaticamente antes de iniciar o servidor. Acesse [http://localhost:3000](http://localhost:3000) — não é necessário rodar `npm run dev` à parte.

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
