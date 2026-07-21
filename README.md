<p align="center">
  <h1 align="center">NX Finance</h1>
  <p align="center">Sistema de controle financeiro pessoal com dashboard interativo, parcelamentos inteligentes e importação de faturas de cartão de crédito.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2.2-black?logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.6.3-blue?logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Prisma-6.0.1-2D3748?logo=prisma" alt="Prisma"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/NextAuth-4.24.13-000000?logo=auth0" alt="NextAuth"/>
  <img src="https://img.shields.io/badge/Tailwind-3.4.15-06B6D4?logo=tailwindcss" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/shadcn/ui-New%20York-000000" alt="shadcn/ui"/>
</p>

---

## Funcionalidades

- **Dashboard financeiro** — Saldo, entradas, saídas, forecast mensal e health score com gráfico donut de categorias.
- **Gerenciamento de transações** — CRUD completo com suporte a parcelamento (divisão automática com `decimal.js`).
- **Importação CSV** — Upload em lote com mapeamento inteligente de categorias e sugestões automáticas.
- **Fatura de cartão de crédito** — Importação CSV específica com criação de cabeçalho + itens categorizados.
- **Relatórios** — Tabela filtrável por status, categoria, instituição e meio de pagamento com TanStack Table.
- **Autenticação 2FA** — Login com Credentials Provider e suporte opcional a segundo fator via Nodemailer.
- **Tema dark/light** — Alternância via `next-themes` com persistência de preferência.
- **Navegação por URL** — Mês/ano gerenciados via search params (compartilhável e bookmarkeable).

---

## Stack

| Categoria | Tecnologia |
|-----------|-----------|
| **Framework** | Next.js 16 (App Router) — Server Components por padrão |
| **Linguagem** | TypeScript strict mode, path alias `@/` → `src/` |
| **ORM** | Prisma 6 — PostgreSQL |
| **Autenticação** | NextAuth 4 — Credentials Provider + JWT |
| **UI** | shadcn/ui (New York), Tailwind CSS, Lucide React |
| **Formulários** | react-hook-form + Zod |
| **Gráficos** | Recharts (donut chart) |
| **Tabelas** | TanStack Table |
| **CSV** | PapaParse |
| **Email** | Nodemailer (2FA tokens) |
| **Precisão** | decimal.js (parcelas sem erro de arredondamento) |

---

## Arquitetura

```
src/
├── app/                    # App Router
│   ├── layout.tsx          # RootLayout global
│   ├── providers.tsx       # SessionProvider + ThemeProvider
│   ├── page.tsx            # Dashboard principal
│   ├── auth/               # Login e registro
│   ├── reports/            # Relatórios com filtros
│   └── dashboard/settings/ # Configurações (instituições, categorias, meios de pagamento)
├── components/
│   ├── dashboard/          # Componentes de negócio
│   │   ├── transaction-form.tsx       # Formulário com parcelamento
│   │   ├── credit-card-invoice-dialog.tsx  # Importação de fatura
│   │   ├── csv-import-dialog.tsx      # Importação CSV genérica
│   │   ├── category-chart.tsx         # Gráfico donut
│   │   ├── summary-cards.tsx          # Cards de resumo
│   │   ├── financial-health.tsx       # Saúde financeira
│   │   ├── forecast.tsx              # Projeção mensal
│   │   └── ...
│   └── ui/                 # Primitivas shadcn/ui (20 componentes)
├── lib/
│   ├── actions.ts          # Server Actions (CRUD transações, categorias, etc.)
│   ├── auth.ts             # Config NextAuth
│   ├── dashboard.ts        # Agregações do dashboard
│   ├── validations.ts      # Schemas Zod
│   ├── csv-actions.ts      # Processamento em lote CSV
│   ├── credit-card-actions.ts  # Importação de fatura
│   ├── reports.ts          # Dados de relatórios
│   └── proxy.ts            # Middleware de proteção de rotas
└── types/
    └── next-auth.d.ts      # Extensões de tipo
```

### Modelo de Dados (Prisma)

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

**Principais regras:**
- Parcelamento disponível apenas para `SAIDA` — valor dividido com `decimal.js` (ROUND_DOWN), centavo residual na última parcela, datas incrementais por mês.
- Status `ATRASADO` é calculado dinamicamente na query (não persistido).
- Fatura de cartão (CSV) cria uma `Transaction` com `is_invoice_header = true` + N `CreditCardInvoiceItem` vinculados, permitindo agregação por categoria no dashboard.
- Categorias com transações vinculadas não podem ser excluídas.
- Agrupamento inteligente de categorias no gráfico (ex: "Mercado Extra", "Mercadinho" → "Mercado").

---

## Getting Started

### Pré-requisitos

- Node.js >= 18
- PostgreSQL
- Docker (opcional, para ambiente local)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/nx-finance.git
cd nx-finance

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
```

### Configure o `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/nx_finance"
NEXTAUTH_SECRET="seu-segredo-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

### Inicialize o banco e rode

```bash
# Gere o Prisma Client e aplique o schema
npx prisma generate
npx prisma db push

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Docker (alternativa)

```bash
docker-compose up --build -d
npx prisma generate
npx prisma db push
npm run dev
```

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Gera Prisma Client + build Next.js |
| `npm run start` | Inicia servidor de produção |
| `npm run lint` | Executa linter (Next.js ESLint) |
| `npm run postinstall` | Gera Prisma Client automaticamente |

---

## Fluxo de Desenvolvimento

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
