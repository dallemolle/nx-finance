# Contexto do Projeto: NxFinance

> Documento técnico de referência para IAs e desenvolvedores. Reflete o estado real do código na branch atual (`feature/2026-07-24_previsao_provisao_gasto`, derivada de `staging`). Não documenta features de outras branches não mergeadas — ver seção 6.

## 1. Stack Tecnológica Principal

| Camada | Tecnologia | Versão | Observação |
|--------|-----------|--------|------------|
| Framework | Next.js (App Router) | ^16.2.2 | `src/app/` com Server Components por padrão |
| Linguagem | TypeScript | ^5.6.3 | Strict mode, path alias `@/` → `src/` |
| ORM | Prisma | ^6.0.1 | PostgreSQL via `DATABASE_URL`, engine classic |
| Banco | PostgreSQL | — | Provider configurado no `schema.prisma`; sync via `prisma db push` (sem `migrate deploy` em produção) |
| UI Primitives | shadcn/ui | New York | Componentes via `@/components/ui/`, estilo `new-york` |
| Estilização | Tailwind CSS | ^3.4.15 | Config com `tailwindcss-animate`, CSS variables via `globals.css` |
| Autenticação | NextAuth | ^4.24.13 | Credentials Provider, JWT session strategy, sem adapter (sessão 100% JWT) |
| 2FA (TOTP) | otplib + qrcode | ^13.4.1 / ^1.5.4 | TOTP real (RFC 6238) via API funcional do otplib v13 (`generateSecret`/`generateURI`/`verify`); QR code de setup via `qrcode` |
| Formulários | react-hook-form | ^7.71.2 | Integrado com `@hookform/resolvers` + Zod |
| Validação | Zod | ^4.3.6 | Schemas em `src/lib/validations.ts` |
| Gráficos | Recharts | ^2.13.3 | Pie/Donut charts no dashboard |
| Datas | date-fns | ^4.1.0 | Locale `ptBR` para formatação em português |
| Calendário | react-day-picker | ^9.14.0 | Componente DatePicker |
| Cálculos | decimal.js | ^10.6.0 | Precisão financeira em parcelamentos |
| Ícones | Lucide React | ^0.460.0 | Ícones nos componentes de UI |
| Tabelas | @tanstack/react-table | ^8.21.3 | Tabela de relatórios |
| Tema | next-themes | ^0.4.3 | dark/light/system via classe `.dark` |
| Notificações | Sonner | ^2.0.7 | Toasts rich colors, posição top-right |
| CSV | PapaParse | ^5.5.3 | Importação em lote |
| Senhas | bcryptjs | ^3.0.3 | Hash de senhas (salt rounds = 10) |
| Radix UI | @radix-ui/* | — | 9 componentes: avatar, dialog, dropdown-menu, label, popover, progress, select, slot, tabs |
| Outros | dompurify, cmdk (^1.1.1), class-variance-authority, clsx, tailwind-merge, reflect-metadata | — | Sanitização, command palette, variants CSS, reflexão |

**Scripts de build:**
```
dev         → next dev
build       → prisma generate && next build
start       → next start
lint        → next lint
postinstall → prisma generate
```

**Scripts de verificação (`scripts/`, sem framework de teste):**
- Rodados via `npx tsx scripts/<arquivo>.ts` — `tsx` é devDependency justamente para isso (não há Jest/Vitest no projeto).
- Convenção: imports relativos (não `@/`) para evitar problemas de resolução de path alias fora do Next.js; scripts de integração usam `PrismaClient` bruto (não o singleton `db.ts`) e checam que `DATABASE_URL` aponta pra `localhost`/`127.0.0.1` antes de rodar, abortando caso contrário — nunca devem tocar staging/produção.
- `verify-billing-cycle.ts` / `verify-estimated-installments.ts`: matemática pura do ciclo de fatura e do parcelamento (sem banco).
- `verify-reconciliation.ts` / `verify-csv-installment-import.ts` / `verify-confirm-estimate.ts`: integração contra o banco de dev, criam e limpam seus próprios dados de teste (usuário descartável, cascade delete).

**Configurações notáveis:**
- `tsconfig.json`: strict mode, path alias `@/` → `src/`, target ES2017, moduleResolution bundler
- `next.config.ts`: output `standalone`
- `components.json`: shadcn/ui style `new-york`, baseColor `neutral`, CSS variables habilitadas
- `postcss.config.js`: Tailwind CSS + Autoprefixer
- `prisma.config.ts`: engine `classic`
- `prisma/migrations/`: contém apenas uma pasta vazia (`20260717041037_add_provisionamento_fatura`, sem `migration.sql`) — resíduo de uma feature branch não mergeada. Não afeta o deploy, pois o fluxo usa `prisma db push`, não `prisma migrate deploy`.
- `.gitattributes`: força `eol=lf` (geral e em `*.sh`) — evita que o Windows reintroduza CRLF no `docker-entrypoint.sh` via checkout (`core.autocrlf`), o que quebra o shebang dentro do container Linux.

**Infraestrutura:**
- `Dockerfile`: multi-stage build (node:20-alpine, standalone output); define `DATABASE_URL` placeholder antes de `prisma generate`/`next build` (o valor real só existe em runtime, via docker-compose); usa `--chown=nextjs:nodejs` nas cópias do runner stage para o usuário não-root conseguir rodar `prisma db push` no entrypoint
- `docker-compose.yml`: serviço PostgreSQL 15 + app Next.js
- `docker-entrypoint.sh`: executa `prisma db push --accept-data-loss` antes de iniciar (LF — ver `.gitattributes` acima)
- `.env.example`: template com variáveis `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

**CI/CD:**
- `.github/workflows/db-sync.yml`: sincroniza schema Prisma ao fazer push em staging/main
- Deploy do app é feito pela Vercel (fora do repo, sem workflow próprio aqui) — variáveis `VERCEL_GIT_COMMIT_SHA`/`VERCEL_GIT_COMMIT_REF`/`VERCEL_ENV` são injetadas automaticamente no build e usadas por `/api/version` e `EnvironmentBanner` pra confirmar qual commit está de fato no ar (ver 4.8), já que `db-sync.yml` só sincroniza schema — não garante que o deploy do app em si já rodou.

---

## 2. Arquitetura e Mapeamento de Arquivos

### `src/app/` — Rotas e Layouts (App Router)

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `layout.tsx` | Server Component | RootLayout: `<html lang="pt-BR">`, Providers, EnvironmentBanner, `CommandPalette`, `MobileBottomNav`, Toaster Sonner |
| `providers.tsx` | Client Component | Wrapper: SessionProvider + ThemeProvider (attribute="class", defaultTheme="system", enableSystem) |
| `page.tsx` | Server Component | Dashboard principal (rota `/`): sessão → busca dados → envolve o conteúdo em `PrivacyProvider` → renderiza cards, gráficos, transações (ou `EmptyDashboardState` se o usuário nunca lançou nada); se o usuário tem ao menos um `CreditCard` cadastrado, busca `getInvoiceTimeline()` e renderiza uma seção extra com `InvoiceTimelineChart` + `MonthlyCommitmentCard` (some completamente pra quem não usa cartão) |
| `globals.css` | Estilos | Definição de CSS variables para `:root` (light) e `.dark`; `@tailwind base/components/utilities` |
| `auth/login/page.tsx` | Client Component | Formulário de login com suporte a 2FA (campo `code` aparece condicionalmente quando o servidor responde `2FA_REQUIRED`) |
| `auth/register/page.tsx` | Client Component | Formulário de registro → chama `registerUser()` Server Action |
| `reports/page.tsx` | Server Component | Página de relatórios: busca dados + renderiza `ReportContent` + `MonthPicker` |
| `reports/report-content.tsx` | Client Component | Tabela paginada (50/página) com filtragem por status/categoria/instituição/meio de pagamento; linhas/sub-linhas com `is_provisioned:true` mostram `ProvisionedBadge` em vez do badge de status (dados já vêm sem filtro de provisionado, ver `reports.ts`) |
| `reports/report-filters.tsx` | Client Component | Filtros combinados com Selects com totais por meio de pagamento |
| `dashboard/settings/page.tsx` | Server Component | Tabs de configuração: Instituições (default), Categorias, Meios de Pagamento, Cartões, Segurança (2FA) |
| `api/auth/[...nextauth]/route.ts` | Route Handler | Catch-all NextAuth: exporta GET/POST handler |
| `api/version/route.ts` | Route Handler | Sem autenticação (fora do matcher do middleware). Retorna `{ commit, commitShort, commitMessage, branch, vercelEnv }` lidos de `process.env.VERCEL_*` — permite confirmar qual commit está rodando em staging/produção sem depender de lembrar se um deploy específico já foi feito. `null`/`"local"` em `next dev` (variáveis só existem no build da Vercel) |

### `src/components/dashboard/` — Componentes de Negócio

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `summary-cards.tsx` | Client Component | 3 cards de KPI: Saldo (hero, fundo escuro, badge de tendência), Entradas (`emerald-600/400`), Saídas (`rose-600/400`) — valores mascaráveis via `useIsPrivacyMode()` |
| `category-chart.tsx` | Client Component | Gráfico donut Recharts limitado a 10 fatias + "Outros"; legenda lista **todas** as categorias sem cap, cada uma na própria linha; clique (na fatia ou na legenda) abre diálogo de detalhe — se for "Outros", a lista de despesas vem agrupada por categoria; linhas previstas mostram `ProvisionedBadge` e o total do cabeçalho mostra um subtotal "+ R$X previsto" separado do total confirmado (`categoryItem.value` nunca inclui provisionado) |
| `recent-transactions.tsx` | Client Component | Lista de transações do mês separada por Entradas/Saídas; valores mascaráveis; linhas/sub-itens com `is_provisioned:true` trocam o badge de status por `ProvisionedBadge` e ganham `ConfirmEstimatedExpenseButton` + `CancelProvisionedButton` (genérica) ou só `CancelProvisionedButton` (item de fatura projetada) no lugar dos botões normais |
| `month-picker.tsx` | Client Component | Navegador de mês/ano via URL Search Params (`?month=&year=`); botões com hitbox de 44px; `useTransition` com feedback visual (pulso/disable) durante a navegação |
| `transaction-form.tsx` | Client Component | Formulário completo com suporte a parcelamento (`decimal.js`), Combobox com criação inline |
| `new-transaction-dialog.tsx` | Client Component | Diálogo para nova transação, carrega dados ao abrir |
| `edit-transaction-dialog.tsx` | Client Component | Diálogo de edição com `initialData` |
| `quick-pay-button.tsx` | Client Component | Botão de pagamento rápido (altera status para PAGO) |
| `csv-import-dialog.tsx` | Client Component | Importação CSV em 2 passos: upload + mapeamento de categorias, com sugestão automática por `MappingSuggestion` |
| `credit-card-invoice-dialog.tsx` | Client Component | Importação de fatura de cartão de crédito via CSV, em 2 passos: (1) upload + descrição/vencimento/instituição/meio de pagamento + seletor de `CreditCard` opcional; (2) revisão item a item, com um botão por linha (`Popover`, ícone `Repeat`) pra marcar "isto é uma compra parcelada" (nº da parcela + total), habilitado só se um cartão foi selecionado no passo 1. Cria cabeçalho `is_invoice_header` + itens; aceita valores negativos (estorno/reembolso, reduzem o total da fatura); sugestão automática de categoria com destaque visual sutil (sem badge de texto) |
| `credit-card-form-dialog.tsx` | Client Component | Formulário de criar/editar `CreditCard` (nome, instituição emissora, dia de fechamento, dia de vencimento, limite opcional, cor) |
| `credit-card-settings.tsx` | Client Component | Aba "Cartões" em Configurações: lista de `CreditCard` com edição inline e exclusão (bloqueada se houver `Transaction` vinculada) |
| `card-installment-purchase-dialog.tsx` / `card-installment-purchase-form.tsx` | Client Component | Diálogo "Nova Compra Parcelada no Cartão": divide um valor total em N parcelas (`decimal.js`) e projeta cada uma na fatura futura correta (via `credit-card-cycle.ts`), com prévia ao vivo mês a mês antes de confirmar |
| `estimated-expense-dialog.tsx` | Client Component | Diálogo "Despesa Prevista": lança uma estimativa futura, com toggle "No cartão" (vira item numa fatura projetada) / "Genérica" (vira `Transaction` avulsa com `is_provisioned:true`); suporta parcelamento opcional em ambos os casos, com prévia mês a mês |
| `invoice-timeline-chart.tsx` | Client Component | `BarChart` empilhado (confirmado vs. provisionado) dos próximos meses de fatura por cartão; hospeda os gatilhos de `CardInstallmentPurchaseDialog` e `EstimatedExpenseDialog` no cabeçalho |
| `monthly-commitment-card.tsx` | Client Component | Indicador de comprometimento do mês (% da renda já comprometida com parcelas + estimativas), mesma linguagem visual de `financial-health.tsx` (faixas de cor por limiar) |
| `confirm-estimated-expense-button.tsx` | Client Component | Botão (ícone `BadgeCheck`) que "efetiva" uma despesa prevista **genérica**: mini-diálogo com valor e data de vencimento editáveis, chama `confirmEstimatedExpense()` |
| `cancel-provisioned-button.tsx` | Client Component | Botão (ícone `Trash2`, com `confirm()`) que exclui um lançamento previsto — `kind="transaction"` (despesa prevista genérica, via `deleteTransaction`) ou `kind="invoiceItem"` (parcela/estimativa dentro de fatura projetada, via `deleteProvisionedInvoiceItem`) |
| `provisioned-badge.tsx` | Componente puro | `<ProvisionedBadge />` — pill âmbar "Previsto", mesmo formato dos badges de status; usado em `recent-transactions.tsx`, `category-chart.tsx` e `report-content.tsx` |
| `institution-combobox.tsx` | Client Component | Combobox especializado com criação de instituição via diálogo |
| `export-buttons.tsx` | Client Component | Dropdown de exportação real: checkbox "Incluir despesas previstas" (desmarcado por padrão) filtra `is_provisioned` antes de exportar; CSV (`;`-delimitado, BOM UTF-8 p/ Excel pt-BR) via Blob + `<a download>`, e PDF via janela de impressão (`window.print()`) — linhas previstas incluídas ganham marcação "Previsto"/"PREVISTO" no lugar do status |
| `financial-health.tsx` | Client Component | Indicador visual de saúde financeira com Progress |
| `forecast.tsx` | Client Component | Projeção mensal baseada em média diária |
| `settings-forms.tsx` | Client Component | Linhas editáveis para renomear/excluir registros auxiliares |
| `security-settings.tsx` | Client Component | Ativação/desativação de 2FA: gera QR code de setup, confirma com código de 6 dígitos |
| `empty-dashboard-state.tsx` | Server Component | Estado vazio (usuário sem nenhuma transação): CTAs reaproveitando `NewTransactionDialog`/`CsvImportDialog`/`CreditCardInvoiceDialog` |
| `monthly-trend-chart.tsx` | Client Component | Área Recharts com saldo dos últimos 6 meses (gradiente) |
| `privacy-provider.tsx` | Client Component | `PrivacyProvider` (Context + `localStorage`) e `PrivacyToggleButton` — toggle de olho para ocultar/exibir valores monetários no dashboard; hook `useIsPrivacyMode()` |

### `src/components/layout/` — Componentes de Layout

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `top-nav.tsx` | Client Component | Barra de navegação superior fixa com backdrop-blur; logo linka pra `/`; gatilho de busca central (abre `CommandPalette`); links Dashboard/Relatórios/Configurações ocultos em mobile (`hidden sm:flex` — substituídos pelo `MobileBottomNav`) |
| `mobile-bottom-nav.tsx` | Client Component | Barra fixa inferior (`sm:hidden`) com os mesmos links de navegação, para mobile; oculta em rotas `/auth/*` |

### `src/components/` — Outros Componentes

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `environment-banner.tsx` | Server Component | Banner "AMBIENTE DE HOMOLOGAÇÃO" laranja; oculto apenas quando `NODE_ENV === "production"` (ou `NEXT_PUBLIC_VERCEL_ENV === "production"`) **e** `DATABASE_URL` contém `/nxfinance`; quando visível, mostra também o hash curto do commit (`VERCEL_GIT_COMMIT_SHA`) ao lado do texto, se disponível |
| `theme-toggle.tsx` | Client Component | Dropdown de tema (Claro/Escuro/Sistema) com ícones Sun/Moon |
| `command-palette.tsx` | Client Component | Busca global (Cmd/Ctrl+K ou clique no gatilho do `TopNav`) sobre `searchTransactions()`, debounce de 300ms; exporta `OPEN_COMMAND_PALETTE_EVENT` |

### `src/components/ui/` — Primitivas shadcn/ui

`alert`, `avatar`, `badge`, `button`, `calendar`, `card`, `combobox`, `command` (cmdk, usado pelo `CommandPalette`), `date-picker`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `select`, `skeleton`, `switch`, `table`, `tabs`

### `src/lib/` — Lógica Compartilhada

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `utils.ts` | Utilitário | `cn()` (merge de classes Tailwind); `formatCurrency()`/`maskCurrency()` (formatação BRL centralizada — usado por todo o dashboard); `getErrorMessage()`/`getPrismaErrorMessage()` (mensagens amigáveis para erros do Prisma: P2002/P2025/P2003) |
| `validations.ts` | Schema | Schemas Zod: `transactionSchema`, `categorySchema`, `paymentMethodSchema`, `financialInstitutionSchema`, `loginSchema`, `registerSchema`, `twoFactorCodeSchema`, `creditCardInvoiceSchema`, `creditCardInvoiceItemSchema` (valor aceita negativo — estorno/reembolso; campos opcionais `isInstallment`/`installmentNumber`/`installmentsCount` pra marcar parcela na importação), `creditCardSchema`, `cardInstallmentPurchaseSchema`, `estimatedExpenseSchema` (`.refine` exige cartão OU meio+instituição; `isInstallment`/`installmentsCount` opcionais), `confirmEstimatedExpenseSchema` |
| `actions.ts` | Server Actions | CRUD de transações, categorias, métodos de pagamento, instituições financeiras |
| `auth-actions.ts` | Server Action | `registerUser()` — registro + seed de categorias padrão |
| `auth.ts` | Config | `authOptions` — NextAuth config com Credentials Provider; `authorize()` valida o código TOTP (via `otplib`, `epochTolerance: 30`) contra `secret_2fa` quando `status_2fa` está ativo |
| `two-factor-actions.ts` | Server Actions | `generateTwoFactorSetup()` (gera segredo + QR code, não persiste), `enableTwoFactor()`/`disableTwoFactor()` (validam o código antes de gravar `status_2fa`/`secret_2fa`) |
| `dashboard.ts` | Server Actions | `getDashboardData()` — agrega totais, deltas, health score, forecast, smart category grouping, `hasAnyTransactions` (tudo isso **exclui** `is_provisioned:true`); busca à parte lançamentos previstos do período (`is_provisioned:true`) só pra exibição nas listas (badge "Previsto"), concatenados em `monthlyTransactions` sem afetar nenhuma métrica; `getMonthlyTrend()` — saldo dos últimos 6 meses em buckets mensais (também exclui provisionado) |
| `dashboard-utils.ts` | Utilitário | `getCategoryGroupName()` (sinônimos hardcoded: mercado/mer, comida/restaurante/ifood); `mergeSimilarCategories()` (merge genérico por prefixo normalizado, cobre variações não previstas nos sinônimos); `capToTopNPlusOthers()` (cap fixo + fatia "Outros"); `getMerchantSignature()` (assinatura de 2 palavras p/ aprendizado de `MappingSuggestion`) |
| `reports.ts` | Server Actions | `getReportData()` (sem filtro de `is_provisioned` — relatórios mostram previstos por padrão, com `ProvisionedBadge`), `getCategories/PaymentMethods/Institutions()`, `getCreditCards()`, `searchTransactions()` (usado pelo `CommandPalette`, se autentica via `getServerSession`) |
| `credit-card-actions.ts` | Server Actions | `importCreditCardInvoice()` — importa fatura CSV (soma sinalizada: estornos reduzem o total; bloqueia se total ≤ 0). Categoria/meio de pagamento sintéticos e a busca do `CreditCard` rodam **antes** da transação (idempotentes, não dependem de nada criado nela). Dentro de `db.$transaction(..., { timeout: 20000 })`: cria o cabeçalho, `createMany` (1 query) pros itens comuns e `create()` individual só pros itens marcados como parcelados na revisão (precisam do id gerado pra carimbar); se `credit_card_id` informado, grava `invoice_month`/`invoice_year` (via `getReferenceMonthFromDueDate`), chama `reconcileProvisionedInstallments()` e monta um plano de parcelas futuras, resolvendo os cabeçalhos de fatura projetada **únicos** necessários sequencialmente (find-or-create não é seguro em paralelo pro mesmo cartão+mês) antes de criar os itens em paralelo. Aprendizado de `MappingSuggestion` por item roda **depois** da transação, em try/catch próprio (não crítico, não pode derrubar um import já bem-sucedido) — ver nota de timeout/round-trips em 3.4 + `getInvoiceItems()` + `getInvoiceHeaders()` |
| `credit-card-cycle.ts` | Utilitário puro | Matemática do ciclo de fatura, sem Prisma/`"use server"` (testável isoladamente via `scripts/verify-billing-cycle.ts`): `getInvoiceReferenceMonth()`, `addInvoiceMonths()`, `computeInvoiceDueDate()`, `getReferenceMonthFromDueDate()` (inverso), `splitInstallments()` (split cents-accurate) |
| `credit-card-shared.ts` | Utilitário | Helpers compartilhados entre `credit-card-actions.ts` e `credit-card-provision-actions.ts` (extraídos pra evitar import circular): `getOrCreateInvoiceCategory()`, `getOrCreateProvisionedPaymentMethod()`, `findProvisionedHeader()` |
| `credit-card-provision-actions.ts` | Server Actions | CRUD de `CreditCard`; `provisionCardInstallmentPurchase()` (compra parcelada real → projeta parcelas em faturas futuras); `provisionEstimatedExpense()` (despesa prevista, com ou sem parcelamento, no cartão ou genérica); `confirmEstimatedExpense()` (efetiva despesa prevista **genérica**, guarda `is_provisioned:true && credit_card_id:null` no servidor); `deleteProvisionedInvoiceItem()` (cancela item avulso de fatura projetada, recalcula/remove o cabeçalho); `reconcileProvisionedInstallments()` (migra parcelas provisionadas pra fatura real importada); `getInvoiceTimeline()` (buckets mensais confirmado/provisionado por cartão); `findOrCreateProvisionedHeader()` (exportado, reusado por `credit-card-actions.ts`) |
| `csv-actions.ts` | Server Actions | `processBatchTransactions()`, `getMappingSuggestions()`, `saveMappingSuggestion()` — casamento/aprendizado via `getMerchantSignature()` |
| `db.ts` | Singleton | Instância singleton do PrismaClient (cache em `globalThis`) — **usado por todas as Server Actions** |

### `src/proxy.ts` — Middleware

| Arquivo | Propósito |
|---------|-----------|
| `src/proxy.ts` | Middleware NextAuth `withAuth`: protege `/` e `/dashboard/*`; redireciona usuários logados para fora de `/auth/login`/`/auth/register`. O 2FA é validado inteiramente dentro de `authorize()` (antes do JWT existir) — não há estado "logado mas pendente de 2FA" a checar aqui (a lógica morta que checava isso foi removida) |

**Matcher:** `["/", "/dashboard/:path*", "/auth/:path*"]`

### `src/types/` — Extensões de Tipo

| Arquivo | Propósito |
|---------|-----------|
| `next-auth.d.ts` | Estende `Session.user.id`, `User.id`, `JWT.id` |
| `models.ts` | Re-exporta tipos Prisma (`Category`, `PaymentMethod`, `FinancialInstitution`, `CreditCard`, ...) e define os shapes "de exibição" pós-serialização (`Decimal` → `number`) consumidos por Client Components: `CreditCardDisplay`, `InvoiceItemDisplay`, `TransactionDisplay` (união entre uma `Transaction` real e um `CreditCardInvoiceItem` achatado em formato de transação) |

### `scripts/` — Verificação Standalone (fora do Next.js)

Ver "Scripts de verificação" na seção 1. Não faz parte do build/deploy — só rodados manualmente durante desenvolvimento pra validar lógica de ciclo de fatura, provisionamento e reconciliação sem precisar de UI.

---

## 3. Regras de Negócio Implementadas

### 3.1 Validação e Transformação de Dados (Zod)

Todos os schemas em `src/lib/validations.ts` aplicam transformações **antes** de persistir:

- **Capitalização automática**: campos `nome` e `descricao` sofrem `.transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase())` — isso garante que "ALUGUEL" → "Aluguel", "mercado" → "Mercado".
- **Valor monetário**: `z.coerce.number().positive("Valor deve ser positivo")` — rejeita zero e negativos, **exceto** `creditCardInvoiceItemSchema`, que só rejeita zero (`.refine(v => v !== 0)`) — valores negativos representam estorno/reembolso no item da fatura.
- **Datas**: `z.coerce.date()` — aceita strings ISO e converte.
- **Cores**: `z.string().regex(/^#[0-9A-F]{6}$/i)` — valida formato hexadecimal (ex: `#10b981`). `financialInstitutionSchema` permite cor vazia opcional.
- **Unique constraints**: `@@unique([nome, userId, tipo])` no Prisma para categorias; `@@unique([nome, userId])` para métodos de pagamento e instituições.
- **Refinements**: `transactionSchema` usa `.refine()` para exigir `installmentsCount` quando `isInstallment === true`.

### 3.2 Comportamento Específico por Entidade

**Transaction:**
- `data_lancamento` tem `@default(now())` — sempre registra a data de criação automaticamente.
- `data_pagamento` é opcional (`DateTime?`) — preenchida com `new Date()` por `payTransaction()` em `actions.ts` ao liquidar.
- Status padrão é `PENDENTE`.
- Ao criar uma transação parcelada (`isInstallment === true`):
  - O valor total é dividido usando `decimal.js` com `ROUND_DOWN` e precisão de 2 casas decimais.
  - A última parcela absorve o centavo residual: `lastInstallmentValue = totalValue.minus(installmentValue.times(installmentsCount - 1))`.
  - Cada parcela recebe data de vencimento incremental: `addMonths(dataVencimento, index)`.
  - Nomes das parcelas seguem o padrão `"Descrição (01/12)"` editável pelo usuário via `installmentDescriptions`.
  - **O parcelamento só está disponível para `tipo === "SAIDA"`** e apenas na criação (não edição — `updateTransaction` descarta `isInstallment`/`installmentsCount`).
- Status `ATRASADO` é **calculado dinamicamente** no servidor: se `status !== "PAGO" && dataVencimento < now()`, o status exibido é "ATRASADO" (não é persistido, apenas calculado na query em `dashboard.ts` e `reports.ts`).
- `is_provisioned` (default `false`) marca um lançamento **futuro/estimado**, ainda não real: excluído de todas as métricas do dashboard (KPIs, forecast, health score, tendência), mas exibido nas listas com `ProvisionedBadge`. Ver seção 3.10.
- `credit_card_id`/`invoice_month`/`invoice_year` só são preenchidos em cabeçalhos de fatura (`is_invoice_header:true`) vinculados a um `CreditCard` — `invoice_month`/`invoice_year` guardam o **mês de referência** (ciclo de fechamento), não o mês do vencimento, indexados junto (`@@index([userId, credit_card_id, invoice_month, invoice_year])`) pra achar "já existe fatura projetada desse cartão+mês?" sem recalcular a regra de vencimento a cada busca.

**CreditCardInvoiceItem (modelo auxiliar de fatura de cartão):**
- Relacionamento 1:N com Transaction via `transactionId` — uma transação `is_invoice_header` pode conter N itens.
- `data_vencimento_original` (opcional) armazena a data de vencimento individual do item (se diferente da fatura) — campo existe no schema mas não é preenchido pelo fluxo de importação atual (`importCreditCardInvoice` não define esse valor).
- `categoria_id` vincula cada item a uma Category, permitindo agregação no gráfico de categorias.
- **Liquidação unificada**: apenas a transação principal (`is_invoice_header`) é liquidada (status → PAGO). Os itens não possuem status próprio.
- **Exclusão em cascata**: ao deletar a transação principal, todos os itens associados são removidos via `onDelete: Cascade`.
- **Importação**: o CSV de fatura é processado pelo dialog `credit-card-invoice-dialog.tsx`, que cria cabeçalho + itens em lote via `importCreditCardInvoice()`. A categoria "Fatura Cartão" (`#6366f1`, ícone CreditCard) é auto-criada se não existir, apenas para satisfazer a FK do cabeçalho (é excluída da agregação do gráfico).
- **Estorno/reembolso**: itens com valor negativo são aceitos e preservados (sinal mantido do parse até a gravação — sem `Math.abs()`); o total da fatura é a soma sinalizada dos itens, e a importação é bloqueada (`throw`) se o total ficar ≤ 0 (estornos superando as compras). Telas que exibem sub-itens de fatura (relatórios, lançamentos recentes) tratam o sinal explicitamente para não duplicar o "−" na formatação.
- **Aprendizado de categoria**: após criar os itens, `importCreditCardInvoice()` faz `upsert` de `MappingSuggestion` por item (assinatura via `getMerchantSignature()`), para sugerir automaticamente a categoria em importações futuras do mesmo estabelecimento.
- **Exibição em relatórios/dashboard**: invoice items são expandidos como sub-linhas na tabela de relatórios e mesclados no gráfico de categorias (evitando dupla contagem da transação `is_invoice_header`).
- `is_provisioned`, `installment_group_id`, `installment_number`, `installment_total` (todos opcionais/default `false`/`null`) suportam o módulo de provisionamento — ver seção 3.10. `installment_group_id` é compartilhado por todas as parcelas de uma mesma compra (indexado, `@@index([installment_group_id])`); itens avulsos (despesa prevista sem parcelamento) ficam com `installment_group_id: null`.
- **Conciliação automática só para parcelas** (itens com `installment_group_id` preenchido — gerados pelo próprio sistema, casamento exato por cartão+mês de referência). Despesas previstas avulsas (`installment_group_id: null`) **não** são conciliadas automaticamente: ficam provisionadas até o usuário efetivar (só a genérica) ou excluir manualmente. Não há matching fuzzy por texto/valor.

**Category:**
- Duplicidade verificada antes da criação via `findFirst({ where: { nome: { equals, mode: 'insensitive' }, userId, tipo } })` — case-insensitive.
- Se já existir, retorna o registro existente (idempotência).
- **Proteção de exclusão**: se `transactions.count > 0` vinculadas à categoria, o delete é bloqueado com mensagem específica.
- Também referenciada por `CreditCardInvoiceItem.categoria_id`.

**PaymentMethod & FinancialInstitution:**
- Duplicidade verificada via `findUnique({ where: { nome_userId } })` — usa a unique constraint composta.
- Mesma proteção de exclusão que categorias.
- `FinancialInstitution` possui campo `metadata` (JSON, default `{}`) e `cor` opcional.

**CreditCard:**
- Campos: `nome`, `closingDay`/`dueDay` (1-31), `limite` opcional, `cor` opcional, `institution_id` (banco emissor, FK obrigatória pra `FinancialInstitution`). Unique `@@unique([nome, userId])`.
- **Proteção de exclusão**: bloqueada se houver qualquer `Transaction` vinculada (`credit_card_id`), real ou provisionada.
- Cadastro opcional — o dashboard não muda pra quem não cria nenhum `CreditCard` (a seção de timeline/comprometimento só renderiza se `creditCards.length > 0`).

### 3.3 Agrupamento Inteligente de Categorias (`dashboard-utils.ts`)

Duas camadas, aplicadas em pontos diferentes do pipeline:

1. **`getCategoryGroupName()`** — roda **server-side**, dentro de `aggregateByCategory()` em `dashboard.ts`. Mapeia sinônimos hardcoded (nomes semanticamente iguais, mas grafias diferentes):
   - Se nome começa com "mercado" ou "mer" → `"Mercado"`
   - Se nome começa com "comida", "restaurante" ou "ifood" → `"Alimentação"`
   - Caso contrário → capitaliza a primeira letra
2. **`mergeSimilarCategories()`** — roda **client-side**, em `category-chart.tsx`, sobre o resultado já agrupado do passo 1. Generaliza para categorias quase-duplicadas que o dicionário de sinônimos não cobre (ex.: `"Transp"` e `"Transporte"` como duas `Category` distintas no banco, já que o nome só é único por usuário+tipo): normaliza acento/caixa (NFD) e funde buckets quando o nome normalizado de um é prefixo do outro (mínimo 3 caracteres); o nome canônico exibido é sempre a variante mais completa. Cada bucket resultante carrega `sourceNames: string[]` com os nomes brutos agrupados, usado depois para o filtro do diálogo de detalhe.
3. **`capToTopNPlusOthers()`** — também client-side, aplicado só ao donut (não à legenda): mantém as top 10 categorias por valor + soma o restante numa fatia `"Outros"` (cor fixa neutra), para a pizza não ficar ilegível com muitas fatias finas. A legenda abaixo do gráfico lista **todas** as categorias sem esse cap, cada uma na própria linha.

O clique num item (fatia do donut ou linha da legenda) abre um diálogo com as transações daquela categoria; se for a fatia "Outros", a lista vem agrupada por categoria (com subtotal por grupo) em vez de uma lista plana.

### 3.4 Server Actions — Padrão de Mutação

Todas as mutações seguem o mesmo padrão:

1. Verificar sessão via `getServerSession(authOptions)` (ou `getUserId()` helper local a cada arquivo).
2. Validar entrada com schema Zod (`.parse()`).
3. Executar operação no Prisma.
4. Chamar `revalidatePath("/dashboard")` e `revalidatePath("/reports")`.
5. Padrão de resposta: `{ success: true, data: { ...transaction, valor: Number(transaction.valor) } }` — **sempre converter Decimal para Number** antes de retornar.

**Transações de lote** (`csv-actions.ts:processBatchTransactions`):
- Usa `db.$transaction()` para criar múltiplos registros atomicamente.
- Após importação, cria automaticamente `MappingSuggestion` para aprendizado de categorização futura.

**Timeout de transação interativa (lição aprendida — P2028):** o Prisma fecha uma transação interativa (`db.$transaction(async (tx) => {...})`) depois de 5s por padrão (elevável via `{ timeout: ms }`). Uma transação interativa roda numa **única conexão** com o banco — `Promise.all()` no lado do JS não faz o Postgres processar as queries em paralelo de verdade, só evita o custo de esperar cada resposta antes de mandar a próxima (pipelining). Isso passa despercebido contra o Postgres local (latência ~0), mas em banco remoto (staging/produção) cada round-trip real soma tempo mesmo "paralelizado" — `importCreditCardInvoice()` com faturas de ~20 itens chegou a estourar mesmo com `Promise.all` + `timeout: 20000`. A correção que realmente resolve é **reduzir o número de queries dentro da transação**, não só a forma de dispará-las:
1. **`createMany`** (1 query) para lotes de registros independentes entre si, em vez de N `create()` individuais — só usar `create()` individual quando for genuinamente necessário capturar o id gerado de cada linha (nesse caso, restrito ao subconjunto que precisa disso, não ao lote inteiro).
2. Tirar da transação qualquer query que não precise de atomicidade real com o resto (lookups idempotentes de find-or-create, aprendizado de `MappingSuggestion`) — rodar **antes** (se não depende de nada criado na transação) ou **depois** (se não depende de nada e falha não deve derrubar o que já foi commitado, nesse caso em try/catch próprio).
3. Quando há dependência de ordem entre chamadas (ex.: `findOrCreateProvisionedHeader` não é seguro em paralelo pro mesmo cartão+mês — duas chamadas concorrentes podem criar cabeçalhos duplicados), resolver essas poucas operações sequencialmente **primeiro**, e só paralelizar o resto depois que as dependências já existem.
4. Manter uma margem de timeout explícita (`db.$transaction(fn, { timeout: 20000 })`) como segurança adicional, não como solução principal.
Aplicado em `importCreditCardInvoice`, `provisionCardInstallmentPurchase` e `provisionEstimatedExpense`.

**MappingSuggestion:**
- Modelo auxiliar com unique `@@unique([search_term, userId])`.
- Usa `upsert` para criar ou atualizar sugestão (`saveMappingSuggestion`), tanto no import de CSV genérico quanto no de fatura de cartão (`importCreditCardInvoice`).
- `search_term` é uma **assinatura de estabelecimento** (`getMerchantSignature()`, em `dashboard-utils.ts`): normaliza o texto (minúsculas, remove acento/dígitos/pontuação) e usa as 2 primeiras palavras significativas — não o título bruto inteiro. Isso é necessário porque extratos reais variam número de referência/cidade/data a cada lançamento do mesmo estabelecimento; comparar substring do título inteiro (abordagem antiga) quase nunca batia de novo. O casamento na tela de importação é por **igualdade exata** da assinatura (`s.search_term === getMerchantSignature(title)`), não mais `includes()`.
- Quando uma linha é pré-preenchida por sugestão, a UI marca o campo de categoria com um tom sutil (sem badge de texto); se o usuário mudar a categoria manualmente, a marcação some.

### 3.5 Cálculos do Dashboard

- Ao processar `categoryData`, o dashboard separa transações com `is_invoice_header === true` e as exclui do agrupamento, evitando duplicidade no gráfico. Em vez disso, busca os registros de `CreditCardInvoiceItem` e os mescla na agregação via `aggregateByCategory()`, garantindo que os gastos do cartão apareçam nas categorias corretas.
- Invoice items também são mapeados para estrutura similar a transação (`invoiceItemsAsTransactions`) para inclusão em `monthlyTransactions` e exibição no gráfico/diálogo de detalhes.
- **`is_provisioned:true` é excluído de todas as queries que alimentam `categoryData`/`summary`/`forecast`/`healthScore`/`getMonthlyTrend`** — despesas futuras/estimadas nunca contam como gasto real do mês. Uma busca adicional (também em `getDashboardData()`) traz os lançamentos previstos do mesmo período só pra exibição (concatenados em `monthlyTransactions`, fora dos cálculos acima) — ver 3.10.

**`getDashboardData()` — `src/lib/dashboard.ts`:**

| Métrica | Fórmula |
|---------|---------|
| Saldo total | `totalEntradas - totalSaidas` |
| Delta | `((curr - prev) / prev) * 100` (se prev === 0 → 0) |
| Forecast | `(totalSaidas / diasPassados) * totalDiasNoMes` |
| Health Score | Se `entradas > 0`: `(saidas / entradas) * 100`. Se entradas === 0 e saídas > 0: 100. Senão: 0. |
| Categoria de Gastos | Filtra apenas `tipo === "SAIDA"`, agrupa via `getCategoryGroupName()` |

**`getMonthlyTrend()` — `src/lib/dashboard.ts`:** retorna o saldo (entradas − saídas) dos últimos 6 meses em buckets mensais, usado pelo `MonthlyTrendChart`.

### 3.6 Autenticação e Segurança

- **Credentials Provider** com email + senha + código 2FA (obrigatório apenas se `status_2fa === true`).
- **Registro**: email único verificado; senha hash com bcryptjs salt rounds = 10.
- **Seed automático**: ao registrar, cria 4 categorias padrão: Salário (ENTRADA, `#10b981`, Wallet), Alimentação (SAIDA, `#f43f5e`, Utensils), Transporte (SAIDA, `#3b82f6`, Car), Lazer (SAIDA, `#f59e0b`, Gamepad2).
- **Session strategy**: `jwt` — callback `jwt()` só injeta `token.id`; callback `session()` só injeta `session.user.id`.
- **API Route**: `src/app/api/auth/[...nextauth]/route.ts` — handler NextAuth (GET/POST).
- **2FA — TOTP funcional de ponta a ponta**:
  - Ativação: aba "Segurança" em `/dashboard/settings` (`security-settings.tsx`) → `generateTwoFactorSetup()` gera segredo + QR code (não persiste) → usuário escaneia com app autenticador → confirma com código de 6 dígitos → `enableTwoFactor()` valida o código e só então grava `status_2fa = true` + `secret_2fa`.
  - Login: se `status_2fa` do usuário for `true`, `authorize()` (`auth.ts`) exige o campo `code` (senão lança `"2FA_REQUIRED"`, tratado pela UI de login pra exibir o campo) e valida via `verify()` do `otplib` com `epochTolerance: 30` (1 time-step de tolerância de relógio, pra frente e pra trás) contra `secret_2fa`.
  - Desativação: `disableTwoFactor()` também exige um código válido antes de limpar `status_2fa`/`secret_2fa`.
  - Não há envio de e-mail nem rota `/auth/verify-2fa` — o código é sempre inserido no próprio formulário de login (campo condicional), não em uma etapa separada.

### 3.7 Navegação por URL Search Params

O componente `MonthPicker` gerencia estado de navegação exclusivamente via URL:
- Lê `searchParams.month` e `searchParams.year` da URL.
- Navegação (prev/next month, Selects) chama `router.push()` dentro de `startTransition()`; enquanto `isPending`, o próprio controle fica com opacidade reduzida/pulsando e desabilitado — feedback visual local, sem lifting de estado pros componentes irmãos (`SummaryCards`, `CategoryChart` etc.).
- Server Components lêem os search params para buscar dados corretos — a recarga dos dados é automática via re-render do Server Component `page.tsx`, não exige wiring extra.
- Isso garante que links possam ser compartilhados e bookmarked.
- Botões de navegação (setas prev/next) têm hitbox de 44px (`h-11 w-11`), adequada para toque em mobile.

### 3.8 Processamento de CSV (genérico, `csv-import-dialog.tsx`)

- Parse com PapaParse (`header: true`, `skipEmptyLines: true`).
- Tenta mapear colunas por nome: `title/descricao/description`, `amount/valor/Value`, `date/data/Date`.
- Sugestão automática de categoria usando `MappingSuggestion` — busca por `search_term` contido no título.
- Valor usa `Math.abs()` para forçar positivo; **sinal do valor bruto define `tipo`**: `amount >= 0 → SAIDA`, `amount < 0 → ENTRADA` (`csv-import-dialog.tsx:176`).
- **Bloqueio de submissão**: todas as linhas devem ter categoria atribuída.
- Este fluxo é independente do de fatura de cartão (`credit-card-invoice-dialog.tsx`), que tem seu próprio schema (`creditCardInvoiceSchema`) e sempre grava `is_invoice_header = true` + itens.

### 3.9 Toggle de Privacidade (`privacy-provider.tsx`)

- `PrivacyProvider` envolve o conteúdo de `src/app/page.tsx`; guarda um boolean (`isHidden`) em Context + `localStorage` (chave `nxfinance:dashboard-privacy`), inicializado em `false` no primeiro render (SSR-safe) e corrigido a partir do `localStorage` num `useEffect` no mount do cliente.
- `PrivacyToggleButton` (ícone Eye/EyeOff) fica ao lado do `ThemeToggle` no cabeçalho do dashboard.
- `useIsPrivacyMode()` é consumido por `SummaryCards` (os 3 KPIs), `CategoryChart` (total central do donut) e `RecentTransactions` (valor de cada lançamento/sub-item de fatura), todos passando o valor por `maskCurrency(value, isHidden)` — que retorna `"••••••"` quando oculto. Legenda de categorias e diálogos de detalhe **não** são mascarados (escopo confirmado do recurso).

### 3.10 Compras Parceladas no Cartão e Projeção de Faturas Futuras

Módulo opcional (só ativo pra quem cadastra um `CreditCard`) que resolve 3 necessidades: lançar uma compra parcelada e já projetar as parcelas nas faturas futuras certas; registrar uma despesa prevista pra planejamento; e visualizar o comprometimento futuro antes que ele vire gasto real.

**Regra de ciclo de fatura** (`credit-card-cycle.ts`, funções puras testadas em `scripts/verify-billing-cycle.ts`):
- Compra no dia `D` do cartão com fechamento `closingDay`: se `D >= closingDay`, cai na fatura do **mês seguinte** (ciclo já fechado); senão, cai no mês atual. Cada parcela seguinte soma +1 mês a essa referência (`addInvoiceMonths`).
- Vencimento: fatura do mês de referência M vence no dia `dueDay`, mas **só no mesmo mês M se `dueDay > closingDay`**; se `dueDay <= closingDay` (caso comum — ex. fecha 25/vence 5), o vencimento é no `dueDay` do mês **seguinte** a M (senão venceria antes do próprio fechamento). `getReferenceMonthFromDueDate()` é o inverso exato dessa regra, usado pra descobrir a que mês de referência uma fatura real importada corresponde.
- Split de valor (`splitInstallments()`): `decimal.js`, arredondamento pra baixo por parcela, última parcela absorve o centavo residual — mesma lógica já usada em `createTransaction`.

**Faturas projetadas**: um cabeçalho `Transaction` (`is_invoice_header:true, is_provisioned:true, valor:0` inicial) é criado (ou reaproveitado, via `findOrCreateProvisionedHeader()`) por cartão+mês de referência, satisfazendo as FKs de categoria/meio de pagamento com registros sintéticos (categoria "Fatura Cartão", meio de pagamento "Cartão (Provisionado)" — mesmo truque já usado pra fatura real importada). Cada parcela/estimativa vira um `CreditCardInvoiceItem` dentro desse cabeçalho, incrementando seu `valor`.

**3 formas de gerar provisionamento:**
1. **Compra parcelada real** (`provisionCardInstallmentPurchase`, diálogo "Nova Compra Parcelada no Cartão") — valor total + nº de parcelas + data da compra: calcula o mês de referência da 1ª parcela e projeta todas.
2. **Despesa prevista** (`provisionEstimatedExpense`, diálogo "Despesa Prevista") — usuário escolhe o mês de início diretamente (sem cálculo de `closingDay`, já que não há data de compra real); pode ser "no cartão" (item numa fatura projetada) ou "genérica" (uma `Transaction` avulsa com `is_provisioned:true`, sem cartão nem fatura); suporta parcelamento opcional em ambos os casos (cartão reaproveita a mesma máquina de `CreditCardInvoiceItem`; genérica reaproveita a mesma lógica de `createTransaction`, sem `installment_group_id` — esse campo só existe em `CreditCardInvoiceItem`).
3. **Marcar item na importação de CSV** (`credit-card-invoice-dialog.tsx`, Step 2) — ao importar a fatura real, um item pode ser marcado como parcela nº X de Y (suporta começar no meio de um parcelamento, ex. entrar no app já na parcela 3/6); o item importado **é** a parcela real, então só as parcelas restantes são projetadas nos meses seguintes, **com o mesmo valor do item importado** (extrato de banco já mostra o valor fixo da parcela — não se divide um total).

**Reconciliação** (`reconcileProvisionedInstallments`, chamada de dentro de `importCreditCardInvoice` quando a fatura real importada tem `credit_card_id`): busca a fatura projetada do mesmo cartão+mês de referência e migra pra fatura real **só** os itens com `installment_group_id` preenchido (parcelas — casamento exato, geradas pelo próprio sistema). Remove a fatura projetada se ficar vazia, ou recalcula seu valor caso sobre alguma estimativa avulsa. **Pré-requisito**: o diálogo de import precisa ter um `CreditCard` selecionado no Step 1 — sem isso `credit_card_id` nunca é enviado e a reconciliação nunca dispara.

**Ciclo de vida de uma despesa prevista genérica** (sem cartão): pode ser **efetivada** (`confirmEstimatedExpense` — ajusta valor e data de vencimento reais, `is_provisioned` vira `false`; guarda no servidor exige `credit_card_id: null`, então uma estimativa no cartão nunca passa por aqui) ou **excluída** (`CancelProvisionedButton` com `kind="transaction"`, via `deleteTransaction`). Itens de fatura projetada (parcela futura ou estimativa no cartão) só podem ser excluídos individualmente (`deleteProvisionedInvoiceItem`, recalcula/remove o cabeçalho), não efetivados — evita o problema de uma fatura ficar parcialmente confirmada/parcialmente projetada.

**Timeline e comprometimento** (`getInvoiceTimeline`, `InvoiceTimelineChart` + `MonthlyCommitmentCard`): agrega por mês (bucket) os totais confirmado vs. provisionado dos próximos 6 meses, por cartão. O card de comprometimento mostra quanto da renda do mês corrente já está comprometido (parcelas + estimativas), com faixas de cor por limiar (mesmo padrão de `financial-health.tsx`).

**Fora do dashboard de KPIs, dentro das listas**: `is_provisioned:true` é excluído de `categoryData`/`summary`/`forecast`/`healthScore`/`getMonthlyTrend` (ver 3.5), mas os lançamentos previstos **aparecem** em `RecentTransactions`, no detalhamento por categoria (com subtotal "previsto" separado do total confirmado) e em Relatórios, sempre com `ProvisionedBadge` (pill âmbar). Exportação (CSV/PDF) tem opção explícita "Incluir despesas previstas" (desmarcada por padrão).

---

## 4. Padrões de Design e UI/UX

### 4.1 Tema e Estilo Visual

- **Tema**: dual (light/dark) via `next-themes` + classe `.dark` no `<html>`.
- **Paleta base**: Neutral (`baseColor: "neutral"` no components.json) com CSS variables.
- **Identidade Dark**: fundos `slate-950`, cards `slate-900`, bordas `slate-800`, texto `slate-100/300`.
- **Identidade Light**: fundos `slate-50`, cards `white`, bordas `slate-200`, texto `slate-900`.
- **Destaques**: verde (`emerald`) para entradas/saúde financeira, vermelho (`rose`) para saídas, azul (`blue/indigo`) para links e ações.
- **Effects**: `backdrop-blur`, `shadow-2xl/shadow-lg`, `ring-1 ring-slate-200/800` em cards, `transition-all duration-500/300`, `hover:shadow-md`.
- **Tipografia**: `font-black tracking-tighter` em títulos, `uppercase tracking-wider` em labels, `font-mono` em códigos hex, `italic` em valores monetários.

### 4.2 Padrão de Cards

Cards do dashboard seguem consistência:
```
<Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
```

O card de "Saldo Disponível" quebra o padrão: `bg-slate-950 text-white` com ícone decorativo grande e opacidade, e um `Badge` de tendência com tom suave (`bg-emerald/rose-500/10`) em vez do texto solto.

### 4.3 Navegação

- **TopNav** (`src/components/layout/top-nav.tsx`): barra fixa com backdrop-blur; logo à esquerda linka pra `/` (sem botão "voltar"); gatilho de busca central que abre o `CommandPalette` (Ctrl/Cmd+K); links Dashboard/Relatórios/Configurações à direita com active state via `pathname`, ocultos em mobile (`hidden sm:flex`).
- **MobileBottomNav**: barra fixa inferior (`sm:hidden`) substituindo os links do TopNav em telas pequenas.
- **CommandPalette**: busca global de transações (Ctrl/Cmd+K ou clique no gatilho do TopNav), debounce de 300ms sobre `searchTransactions()`.
- **MonthPicker**: agrupado visualmente em container com background `slate-100/50` e bordas, com botões ChevronLeft/Right (hitbox 44px) e Selects para mês/ano; pulso/opacidade reduzida durante a navegação (`useTransition`).
- **Responsividade**: padrão `flex flex-col md:flex-row` + `grid grid-cols-1 md:grid-cols-3`.

### 4.4 Componentes Reutilizáveis

**Combobox genérico** (`src/components/ui/combobox.tsx`):
- Popover com campo de busca, lista filtrável, opção "+ Criar" se `onAdd` for fornecido e termo não existir.
- Usado por: categorias e meios de pagamento.

**InstitutionCombobox** (`src/components/dashboard/institution-combobox.tsx`):
- Extensão do Combobox com criação via diálogo (nome + cor com seletor color picker).

**DatePicker** (`src/components/ui/date-picker.tsx`):
- Popover com Calendar do react-day-picker, locale ptBR, formato `"dd - MMM - yyyy"`.

### 4.5 Feedback ao Usuário

- **Toasts**: Sonner com `richColors` e posição `top-right`.
- **Loading states**: `useTransition` + ícone `Loader2` com `animate-spin` em botões de submit.
- **Empty states**: mensagens centrais em itálico com ícones decorativos.
- **Validation feedback**: erros inline em vermelho abaixo de cada campo + Alert destrutivo no topo do formulário.
- **Diálogos**: transições suaves com backdrop-blur, bordas semi-transparentes.

### 4.6 Tratamento de Erros em Server Actions

Todas as Server Actions usam `try/catch` com `console.error(...)` seguido de `throw new Error(getPrismaErrorMessage(error, "..."))` — `getPrismaErrorMessage()` (`src/lib/utils.ts`) traduz códigos comuns do Prisma (`P2002` unique constraint, `P2025` not found, `P2003` FK inválida) para mensagens amigáveis em português, com fallback para `getErrorMessage()`.

### 4.7 Exportação

- Dropdown com opções CSV e PDF, ambas funcionais (`export-buttons.tsx`).
- Checkbox "Incluir despesas previstas" no topo do dropdown (`DropdownMenuCheckboxItem`, desmarcado por padrão) filtra `transactions` por `is_provisioned` antes de gerar o arquivo; quando incluídas, a coluna de status mostra "Previsto"/"PREVISTO" em vez do status real.
- **CSV**: monta conteúdo `;`-delimitado com BOM UTF-8 (compatibilidade com Excel pt-BR), gera via `Blob` + `<a download>`.
- **PDF**: abre uma nova janela com uma tabela HTML formatada e chama `window.print()`.

### 4.8 Banner de Ambiente e Verificação de Versão

`EnvironmentBanner` (`src/components/environment-banner.tsx`):
- Exibe banner laranja "AMBIENTE DE HOMOLOGAÇÃO - OS DADOS NÃO SÃO REAIS" quando **não** (`produção` E banco oficial `/nxfinance`) — ver condição exata em 2.
- Oculta apenas em produção com banco oficial.
- Quando visível, mostra o hash curto do commit (`VERCEL_GIT_COMMIT_SHA?.slice(0, 7)`) ao lado do texto — forma rápida de confirmar visualmente se o deploy mais recente já está no ar, sem precisar abrir o painel da Vercel.

**`/api/version`** (`src/app/api/version/route.ts`): endpoint público (fora do matcher do middleware, não exige login) que retorna commit/branch/ambiente em JSON. Existe porque `db-sync.yml` só sincroniza o schema do Prisma — não há workflow de deploy do app neste repo (fica a cargo da Vercel) — então "o push foi feito" não implica "o deploy já rodou". Consultar esse endpoint (ou o banner) sempre que houver dúvida se uma correção específica já está em staging antes de reportar um bug como não resolvido.

### 4.9 Toggle de Privacidade

- Ícone Eye/EyeOff (`PrivacyToggleButton`) ao lado do `ThemeToggle`, no cabeçalho do dashboard — oculta/exibe valores monetários dos 3 KPIs, do total central do gráfico de categorias e da lista de lançamentos recentes. Estado persiste em `localStorage` (ver 3.9).

### 4.10 Convenção de cor para "Previsto"

Âmbar (`amber-500`/`#f59e0b`) com opacidade reduzida é a cor reservada pra tudo que é provisionado/estimado, em contraste com índigo (confirmado/cabeçalho de fatura) e emerald/rose (entradas/saídas efetivas): `InvoiceTimelineChart` usa `fill="#f59e0b" fillOpacity={0.6}` na série "Provisionado"; `ProvisionedBadge` usa `bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400`, mesmo formato dos badges de status (`border-none px-2 py-0 text-[10px] uppercase font-bold tracking-tight`). Não reutilizar âmbar pra outro estado.

---

## 5. Convenções de Código

### 5.1 Nomenclatura

- **Pastas**: `kebab-case` para diretórios de componentes de UI.
- **Arquivos**: `kebab-case.tsx` para componentes, `camelCase.ts` para utilitários.
- **Funções**: `camelCase` para funções utilitárias, `PascalCase` para componentes React.
- **Modelos Prisma**: `PascalCase` (Transaction, Category), campos em `snake_case`.

### 5.2 Imports

- Path alias `@/` → `src/` para todos os imports internos (preferência). **Nota:** alguns arquivos (ex: login page, root dashboard page) ainda usam imports relativos — inconsistência conhecida.
- Componentes de UI importados de `@/components/ui/...`.
- Server Actions importadas de `@/lib/actions` (ou específicas como `@/lib/csv-actions`).
- Schemas de `@/lib/validations`.

### 5.3 Separação Server/Client

| Característica | Server Component | Client Component |
|----------------|-----------------|------------------|
| Busca de dados | ✅ `async` + `getServerSession()` | ❌ |
| Server Actions (chamada) | ✅ import e call direto | ✅ via transition/hook |
| Interatividade (onClick, useState, useEffect) | ❌ | ✅ `"use client"` |
| Hooks (useRouter, useForm, useTransition) | ❌ | ✅ |
| Recharts, Sonner | ❌ | ✅ |
| *Directiva de arquivo* | *nenhuma* | `"use client"` |

> **Nota:** Server Actions são funções assíncronas com `"use server"` no topo do arquivo. Elas podem ser importadas e chamadas tanto por Server Components quanto por Client Components.

---

## 6. Gaps e Inconsistências Conhecidas

Seção para evitar que futuras sessões assumam que algo funciona apenas porque há código relacionado no repositório.

- **`CreditCardInvoiceItem.data_vencimento_original`** existe no schema mas não é escrito por nenhum fluxo (import de fatura real nem provisionamento).
- **Conciliação automática só cobre parcelas** (`installment_group_id` preenchido) — despesas previstas avulsas (estimativas soltas, `installment_group_id: null`) nunca são conciliadas automaticamente contra uma fatura real importada; ficam provisionadas até o usuário efetivar (só a variante genérica, sem cartão) ou excluir manualmente. Decisão deliberada de escopo (matching fuzzy de texto/valor não foi implementado), não bug.
- **Sem proteção contra double-provisioning**: se o usuário lança uma compra parcelada manualmente (diálogo "Compra Parcelada") e depois importa a fatura real marcando o mesmo item como parcelado (Step 2 do import), os dois fluxos geram projeções futuras independentes e não-deduplicadas pro mesmo cartão/mês — a soma nos agregados fica incorreta (duplicada) nesse cenário específico. Não há aviso na UI hoje.
- **Detalhamento por categoria com itens previstos**: o total no cabeçalho do diálogo (`categoryItem.value`) soma só o confirmado; linhas previstas aparecem na lista com um subtotal "+ R$X previsto" separado — mas o agrupamento "Outros" (quando clicado) soma confirmado e previsto juntos no subtotal por categoria dentro do grupo, sem essa mesma separação.
- **Legenda do gráfico de categorias não é mascarada pelo toggle de privacidade**: só o total central do donut e os 3 KPIs/lista de lançamentos são mascarados — decisão de escopo, não bug (ver 3.9).
- **`db-sync.yml`** aplica `prisma db push` direto contra o banco de produção/staging a cada push nessas branches, sem histórico de migração — mudanças de schema que impliquem perda de dados (drop de coluna/tabela não vazia) bloqueiam o workflow até alguém decidir manualmente entre `--accept-data-loss` ou uma correção manual no banco (ex.: rename).

**Já resolvido nesta branch (histórico, para não reabrir por engano):** 2FA agora é TOTP funcional de ponta a ponta (ver 3.6); `prisma.ts`, `mail.ts`/`mail.js` e o `dashboard/page.tsx` mock foram removidos (código morto); `export-buttons.tsx` exporta CSV/PDF de verdade; `data_pagamento` é preenchido por `payTransaction()`; `@auth/prisma-adapter` e `nodemailer` foram removidos do `package.json`; módulo completo de compras parceladas/despesa prevista/provisionamento de fatura futura implementado do zero nesta branch (ver 3.10) — as branches antigas que tentavam isso (`feature/2026-07-15_lancto_previsao_despesa`, `07-17_prev_desp`, `07-18_prev-desc-new_table`) não foram portadas e podem ser ignoradas/descartadas; timeout de transação interativa (P2028) em `importCreditCardInvoice`/`provisionCardInstallmentPurchase`/`provisionEstimatedExpense` corrigido reduzindo o número de queries dentro da transação (`createMany` + lookups/aprendizado movidos pra fora, ver nota em 3.4) — a primeira tentativa (só paralelizar via `Promise.all`) não foi suficiente, porque uma transação interativa roda numa única conexão e `Promise.all` não paraleliza de verdade no banco. Se esse erro reaparecer, confirmar primeiro via `/api/version` (4.8) se o commit da correção já está de fato em staging antes de investigar mais.
